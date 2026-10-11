const STORAGE_KEY = 'databook-xadrez:sequencias';

const PIECE_UNICODE = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

const PIECE_ORDER = ['k', 'q', 'r', 'b', 'n', 'p'];

// ---------- Estado ----------

let board = createStandardBoard();
let mode = 'setup'; // 'setup' | 'recording'
let selectedTool = null; // {color,type} | 'eraser' | null
let selectedSquare = null; // {row,col} | null
let currentMoves = []; // [{notation, boardAfter}]
let initialPositionForRecording = null;
let turn = 'w';

let sequences = loadSequences();
let currentReplaySeq = null;
let replayStepIndex = 0;

// ---------- Tabuleiro: helpers ----------

function createEmptyBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(null));
}

function createStandardBoard() {
  const b = createEmptyBoard();
  const backRank = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let c = 0; c < 8; c++) {
    b[0][c] = { color: 'b', type: backRank[c] };
    b[1][c] = { color: 'b', type: 'p' };
    b[6][c] = { color: 'w', type: 'p' };
    b[7][c] = { color: 'w', type: backRank[c] };
  }
  return b;
}

function cloneBoard(b) {
  return b.map(row => row.map(cell => (cell ? { ...cell } : null)));
}

function squareName(row, col) {
  return 'abcdefgh'[col] + (8 - row);
}

function pieceLetterPT(type) {
  return { k: 'R', q: 'D', r: 'T', b: 'B', n: 'C', p: '' }[type];
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Persistência ----------

function loadSequences() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveSequences() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sequences));
}

// ---------- Renderização do tabuleiro (genérica) ----------

function renderBoard(container, boardState, opts = {}) {
  container.innerHTML = '';
  container.className = 'board';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const sq = document.createElement('div');
      const light = (row + col) % 2 === 0;
      sq.className = 'square ' + (light ? 'light' : 'dark');

      const piece = boardState[row][col];
      if (piece) {
        sq.textContent = PIECE_UNICODE[piece.color][piece.type];
        sq.classList.add(piece.color === 'w' ? 'piece-white' : 'piece-black');
      }

      if (opts.selectedSquare && opts.selectedSquare.row === row && opts.selectedSquare.col === col) {
        sq.classList.add('selected');
      }

      if (opts.onClick) {
        sq.addEventListener('click', () => opts.onClick(row, col));
      }

      container.appendChild(sq);
    }
  }
}

function renderMainBoard() {
  renderBoard(document.getElementById('board'), board, {
    onClick: handleSquareClick,
    selectedSquare: mode === 'recording' ? selectedSquare : null,
  });
}

// ---------- Paleta (modo montagem) ----------

function buildPalette() {
  const container = document.getElementById('palettePieces');
  container.innerHTML = '';
  ['w', 'b'].forEach(color => {
    PIECE_ORDER.forEach(type => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tool-btn';
      btn.textContent = PIECE_UNICODE[color][type];
      btn.title = `${color === 'w' ? 'Branco' : 'Preto'} - ${type}`;
      btn.addEventListener('click', () => selectTool({ color, type }, btn));
      container.appendChild(btn);
    });
  });
}

function selectTool(tool, btnEl) {
  selectedTool = tool;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('selected'));
  btnEl.classList.add('selected');
}

function handleSquareClick(row, col) {
  if (mode === 'setup') {
    applyPaletteTool(row, col);
  } else if (mode === 'recording') {
    handleRecordingClick(row, col);
  }
}

function applyPaletteTool(row, col) {
  if (selectedTool === null) return;
  if (selectedTool === 'eraser') {
    board[row][col] = null;
  } else {
    board[row][col] = { color: selectedTool.color, type: selectedTool.type };
  }
  renderMainBoard();
}

// ---------- Gravação de lances ----------

function handleRecordingClick(row, col) {
  if (!selectedSquare) {
    if (board[row][col]) {
      selectedSquare = { row, col };
      renderMainBoard();
    }
    return;
  }
  if (selectedSquare.row === row && selectedSquare.col === col) {
    selectedSquare = null;
    renderMainBoard();
    return;
  }
  doMove(selectedSquare, { row, col });
}

function buildNotation(piece, fc, tr, tc, capturedPiece) {
  const destSq = squareName(tr, tc);
  if (piece.type === 'p') {
    return capturedPiece ? ('abcdefgh'[fc] + 'x' + destSq) : destSq;
  }
  const letter = pieceLetterPT(piece.type);
  return letter + (capturedPiece ? 'x' : '') + destSq;
}

function doMove(from, to) {
  const fr = from.row, fc = from.col, tr = to.row, tc = to.col;
  const movingPiece = board[fr][fc];
  if (!movingPiece) return;

  const capturedPiece = board[tr][tc];
  const notationBase = buildNotation(movingPiece, fc, tr, tc, capturedPiece);

  board[tr][tc] = { ...movingPiece };
  board[fr][fc] = null;

  const isPromotion = movingPiece.type === 'p' && (tr === 0 || tr === 7);
  if (isPromotion) {
    askPromotion(movingPiece.color, (chosenType) => {
      board[tr][tc].type = chosenType;
      finalizeMove(notationBase + '=' + pieceLetterPT(chosenType));
    });
  } else {
    finalizeMove(notationBase);
  }
}

function finalizeMove(notation) {
  currentMoves.push({ notation, boardAfter: cloneBoard(board) });
  turn = turn === 'w' ? 'b' : 'w';
  selectedSquare = null;
  renderMovesList();
  updateTurnIndicator();
  renderMainBoard();
}

function undoLastMove() {
  if (currentMoves.length === 0) return;
  currentMoves.pop();
  board = currentMoves.length > 0
    ? cloneBoard(currentMoves[currentMoves.length - 1].boardAfter)
    : cloneBoard(initialPositionForRecording);
  turn = turn === 'w' ? 'b' : 'w';
  selectedSquare = null;
  renderMovesList();
  updateTurnIndicator();
  renderMainBoard();
}

function renderMovesList() {
  const list = document.getElementById('movesList');
  list.innerHTML = '';
  currentMoves.forEach((m, i) => {
    const li = document.createElement('li');
    li.textContent = `${i + 1}. ${m.notation}`;
    list.appendChild(li);
  });
}

function updateTurnIndicator() {
  document.getElementById('turnIndicator').innerHTML =
    `Vez das: <strong>${turn === 'w' ? 'Brancas' : 'Pretas'}</strong>`;
}

// ---------- Promoção ----------

function askPromotion(color, callback) {
  const container = document.getElementById('promoOptions');
  container.innerHTML = '';
  ['q', 'r', 'b', 'n'].forEach(type => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = PIECE_UNICODE[color][type];
    btn.addEventListener('click', () => {
      document.getElementById('promoModalOverlay').classList.remove('open');
      callback(type);
    });
    container.appendChild(btn);
  });
  document.getElementById('promoModalOverlay').classList.add('open');
}

// ---------- Troca de modo ----------

function switchToSetupMode() {
  mode = 'setup';
  currentMoves = [];
  selectedSquare = null;
  document.getElementById('setupControls').classList.remove('hidden');
  document.getElementById('palette').classList.remove('hidden');
  document.getElementById('recordingControls').classList.add('hidden');
  document.getElementById('movesEmptyHint').classList.remove('hidden');
  document.getElementById('movesList').innerHTML = '';
  renderMainBoard();
}

function switchToRecordingMode() {
  mode = 'recording';
  initialPositionForRecording = cloneBoard(board);
  currentMoves = [];
  turn = 'w';
  selectedSquare = null;
  document.getElementById('setupControls').classList.add('hidden');
  document.getElementById('palette').classList.add('hidden');
  document.getElementById('recordingControls').classList.remove('hidden');
  document.getElementById('movesEmptyHint').classList.add('hidden');
  renderMovesList();
  updateTurnIndicator();
  renderMainBoard();
}

function voltarMontagem() {
  if (currentMoves.length > 0 &&
    !confirm('Voltar para a montagem vai descartar os lances gravados nesta sessão (ainda não salvos). Continuar?')) {
    return;
  }
  switchToSetupMode();
}

// ---------- Controles: montagem ----------

document.getElementById('posicaoPadraoBtn').addEventListener('click', () => {
  board = createStandardBoard();
  renderMainBoard();
});

document.getElementById('limparBtn').addEventListener('click', () => {
  board = createEmptyBoard();
  renderMainBoard();
});

document.getElementById('iniciarGravacaoBtn').addEventListener('click', switchToRecordingMode);

document.getElementById('paletteEraser').addEventListener('click', (e) => {
  selectedTool = 'eraser';
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('selected'));
  e.currentTarget.classList.add('selected');
});

// ---------- Controles: gravação ----------

document.getElementById('undoBtn').addEventListener('click', undoLastMove);
document.getElementById('voltarMontagemBtn').addEventListener('click', voltarMontagem);

document.getElementById('salvarSequenciaBtn').addEventListener('click', () => {
  if (currentMoves.length === 0) {
    alert('Grave pelo menos um lance antes de salvar.');
    return;
  }
  document.getElementById('saveModalOverlay').classList.add('open');
});

// ---------- Modal: salvar sequência ----------

document.getElementById('saveForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const nome = document.getElementById('seqNome').value.trim();
  const nota = document.getElementById('seqNota').value.trim();

  sequences.push({
    id: 'seq_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    nome,
    nota,
    criadoEm: new Date().toISOString(),
    initialBoard: initialPositionForRecording,
    moves: currentMoves,
  });
  saveSequences();

  document.getElementById('saveModalOverlay').classList.remove('open');
  document.getElementById('saveForm').reset();
  switchToSetupMode();
  renderDatabookList();
  alert('Sequência salva! Veja na aba "Meu databook".');
});

document.getElementById('cancelSaveBtn').addEventListener('click', () => {
  document.getElementById('saveModalOverlay').classList.remove('open');
});

// ---------- Abas ----------

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'databook') renderDatabookList();
  });
});

// ---------- Exportar / Importar ----------

document.getElementById('exportBtn').addEventListener('click', () => {
  if (sequences.length === 0) {
    alert('Não há sequências salvas para exportar.');
    return;
  }
  const blob = new Blob([JSON.stringify(sequences, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `databook-xadrez-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importFile').click();
});

document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    let imported;
    try {
      imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error('formato inválido');
    } catch {
      alert('Arquivo inválido. Selecione um .json exportado por este app.');
      e.target.value = '';
      return;
    }

    const existingIds = new Set(sequences.map(s => s.id));
    let added = 0;
    imported.forEach(seq => {
      if (seq && seq.id && !existingIds.has(seq.id)) {
        sequences.push(seq);
        existingIds.add(seq.id);
        added++;
      }
    });
    saveSequences();
    renderDatabookList();
    alert(`${added} sequência(s) importada(s). ${imported.length - added} já existiam e foram ignoradas.`);
    e.target.value = '';
  };
  reader.readAsText(file);
});

// ---------- Databook: lista e replay ----------

function renderDatabookList() {
  const listEl = document.getElementById('databookList');
  const emptyHint = document.getElementById('databookEmptyHint');
  listEl.innerHTML = '';

  if (sequences.length === 0) {
    emptyHint.classList.remove('hidden');
    return;
  }
  emptyHint.classList.add('hidden');

  sequences.slice().reverse().forEach(seq => {
    const item = document.createElement('div');
    item.className = 'databook-item' + (currentReplaySeq && currentReplaySeq.id === seq.id ? ' active' : '');
    item.innerHTML = `
      <div>
        <div class="databook-item-title">${escapeHtml(seq.nome)}</div>
        <div class="databook-item-meta">${seq.moves.length} lance(s) · ${new Date(seq.criadoEm).toLocaleDateString('pt-BR')}</div>
      </div>
    `;
    item.addEventListener('click', () => {
      currentReplaySeq = seq;
      replayStepIndex = 0;
      renderDatabookList();
      renderReplay();
    });
    listEl.appendChild(item);
  });
}

function boardStateForStep(seq, stepIndex) {
  return stepIndex === 0 ? seq.initialBoard : seq.moves[stepIndex - 1].boardAfter;
}

function renderReplay() {
  const seq = currentReplaySeq;
  const area = document.getElementById('replayArea');

  area.innerHTML = `
    <h2>${escapeHtml(seq.nome)}</h2>
    ${seq.nota ? `<p class="empty-hint">${escapeHtml(seq.nota)}</p>` : ''}
    <div id="replayBoardContainer"></div>
    <div class="replay-controls">
      <button id="replayPrev" class="secondary">◀ Anterior</button>
      <span class="replay-step-label" id="replayStepLabel"></span>
      <button id="replayNext" class="secondary">Próximo ▶</button>
      <button id="deleteSeqBtn" class="danger">Excluir sequência</button>
    </div>
    <ol class="moves-list" id="replayMovesList" style="margin-top:14px;"></ol>
  `;

  renderBoard(document.getElementById('replayBoardContainer'), boardStateForStep(seq, replayStepIndex), {});
  document.getElementById('replayStepLabel').textContent = `Lance ${replayStepIndex} de ${seq.moves.length}`;

  const list = document.getElementById('replayMovesList');
  seq.moves.forEach((m, i) => {
    const li = document.createElement('li');
    li.textContent = `${i + 1}. ${m.notation}`;
    if (i + 1 === replayStepIndex) li.className = 'current';
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => { replayStepIndex = i + 1; renderReplay(); });
    list.appendChild(li);
  });

  document.getElementById('replayPrev').disabled = replayStepIndex === 0;
  document.getElementById('replayNext').disabled = replayStepIndex === seq.moves.length;
  document.getElementById('replayPrev').addEventListener('click', () => {
    replayStepIndex = Math.max(0, replayStepIndex - 1);
    renderReplay();
  });
  document.getElementById('replayNext').addEventListener('click', () => {
    replayStepIndex = Math.min(seq.moves.length, replayStepIndex + 1);
    renderReplay();
  });
  document.getElementById('deleteSeqBtn').addEventListener('click', () => {
    if (confirm('Excluir esta sequência salva?')) {
      sequences = sequences.filter(s => s.id !== seq.id);
      saveSequences();
      currentReplaySeq = null;
      renderDatabookList();
      area.innerHTML = '<p class="empty-hint">Selecione uma sequência à esquerda para revisar os lances.</p>';
    }
  });
}

// ---------- Init ----------

buildPalette();
renderMainBoard();
