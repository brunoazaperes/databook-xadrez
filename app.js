const STORAGE_KEY = 'databook-xadrez:sequencias';

const PIECE_UNICODE = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

const PIECE_ORDER = ['k', 'q', 'r', 'b', 'n', 'p'];

// Notação descritiva antiga: cada coluna recebe o nome da peça que começa nela
const FILE_CODES = ['TD', 'CD', 'BD', 'D', 'R', 'BR', 'CR', 'TR'];
const FILE_NAMES_PT = {
  TD: 'Torre da Dama', CD: 'Cavalo da Dama', BD: 'Bispo da Dama', D: 'Dama',
  R: 'Rei', BR: 'Bispo do Rei', CR: 'Cavalo do Rei', TR: 'Torre do Rei',
};
const PIECE_NAMES_PT = { k: 'Rei', q: 'Dama', r: 'Torre', b: 'Bispo', n: 'Cavalo', p: 'Peão' };

const KNIGHT_OFFSETS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING_OFFSETS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// ---------- Estado ----------

let board = createStandardBoard();
let mode = 'setup'; // 'setup' | 'recording'
let selectedTool = null; // {color,type} | 'eraser' | null
let selectedSquare = null; // {row,col} | null
let currentLegalMoves = []; // destinos possíveis da peça selecionada
let currentMoves = []; // [{color, pieceType, modern, old, oldExpansion, boardAfter, castlingRightsAfter, lastMoveAfter}]
let initialPositionForRecording = null;
let initialCastlingRights = null;
let turn = 'w';

// direitos de roque e controle de en passant
let castlingRights = { w: { k: true, q: true }, b: { k: true, q: true } };
let lastMove = null; // {color, toRow, toCol} quando o último lance foi um peão andando 2 casas

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

function cloneCastlingRights(cr) {
  return { w: { ...cr.w }, b: { ...cr.b } };
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function squareName(row, col) {
  return 'abcdefgh'[col] + (8 - row);
}

function descRank(row, color) {
  return color === 'w' ? (8 - row) : (row + 1);
}

function pieceLetterPT(type) {
  return { k: 'R', q: 'D', r: 'T', b: 'B', n: 'C', p: '' }[type];
}

function pieceLetterOldPT(type) {
  return { k: 'R', q: 'D', r: 'T', b: 'B', n: 'C', p: 'P' }[type];
}

function colorNamePT(color) {
  return color === 'w' ? 'Brancas' : 'Pretas';
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

      if (opts.highlightSquares && opts.highlightSquares.some(m => m.row === row && m.col === col)) {
        sq.classList.add('highlight');
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
    highlightSquares: mode === 'recording' ? currentLegalMoves : [],
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

// ---------- Geração de lances legais (movimentação real das peças) ----------

function getPieceMoves(row, col) {
  const piece = board[row][col];
  if (!piece) return [];
  switch (piece.type) {
    case 'p': return getPawnMoves(row, col, piece);
    case 'n': return getLeaperMoves(row, col, piece, KNIGHT_OFFSETS);
    case 'b': return getSliderMoves(row, col, piece, BISHOP_DIRS);
    case 'r': return getSliderMoves(row, col, piece, ROOK_DIRS);
    case 'q': return getSliderMoves(row, col, piece, [...BISHOP_DIRS, ...ROOK_DIRS]);
    case 'k': return getKingMoves(row, col, piece);
    default: return [];
  }
}

function getSliderMoves(row, col, piece, directions) {
  const moves = [];
  directions.forEach(([dr, dc]) => {
    let r = row + dr, c = col + dc;
    while (inBounds(r, c)) {
      const occupant = board[r][c];
      if (!occupant) {
        moves.push({ row: r, col: c, capture: false });
      } else {
        if (occupant.color !== piece.color) moves.push({ row: r, col: c, capture: true });
        break;
      }
      r += dr; c += dc;
    }
  });
  return moves;
}

function getLeaperMoves(row, col, piece, offsets) {
  const moves = [];
  offsets.forEach(([dr, dc]) => {
    const r = row + dr, c = col + dc;
    if (!inBounds(r, c)) return;
    const occupant = board[r][c];
    if (!occupant) moves.push({ row: r, col: c, capture: false });
    else if (occupant.color !== piece.color) moves.push({ row: r, col: c, capture: true });
  });
  return moves;
}

function getKingMoves(row, col, piece) {
  const moves = getLeaperMoves(row, col, piece, KING_OFFSETS);
  const rights = castlingRights[piece.color];
  const homeRow = piece.color === 'w' ? 7 : 0;

  if (row === homeRow && col === 4) {
    if (rights.k && !board[homeRow][5] && !board[homeRow][6] &&
      board[homeRow][7] && board[homeRow][7].type === 'r' && board[homeRow][7].color === piece.color) {
      moves.push({ row: homeRow, col: 6, capture: false, special: 'castle-k' });
    }
    if (rights.q && !board[homeRow][1] && !board[homeRow][2] && !board[homeRow][3] &&
      board[homeRow][0] && board[homeRow][0].type === 'r' && board[homeRow][0].color === piece.color) {
      moves.push({ row: homeRow, col: 2, capture: false, special: 'castle-q' });
    }
  }
  return moves;
}

function getPawnMoves(row, col, piece) {
  const moves = [];
  const dir = piece.color === 'w' ? -1 : 1;
  const startRow = piece.color === 'w' ? 6 : 1;

  const oneRow = row + dir;
  if (inBounds(oneRow, col) && !board[oneRow][col]) {
    moves.push({ row: oneRow, col, capture: false });
    const twoRow = row + 2 * dir;
    if (row === startRow && !board[twoRow][col]) {
      moves.push({ row: twoRow, col, capture: false });
    }
  }

  [-1, 1].forEach(dc => {
    const nr = row + dir, nc = col + dc;
    if (!inBounds(nr, nc)) return;
    const occupant = board[nr][nc];
    if (occupant && occupant.color !== piece.color) {
      moves.push({ row: nr, col: nc, capture: true });
    } else if (!occupant && lastMove && lastMove.color !== piece.color &&
      lastMove.toRow === row && lastMove.toCol === nc) {
      moves.push({ row: nr, col: nc, capture: true, special: 'enpassant' });
    }
  });

  return moves;
}

// ---------- Gravação de lances ----------

function handleRecordingClick(row, col) {
  const clickedPiece = board[row][col];

  if (!selectedSquare) {
    if (clickedPiece && clickedPiece.color === turn) {
      selectedSquare = { row, col };
      currentLegalMoves = getPieceMoves(row, col);
      renderMainBoard();
    }
    return;
  }

  if (selectedSquare.row === row && selectedSquare.col === col) {
    selectedSquare = null;
    currentLegalMoves = [];
    renderMainBoard();
    return;
  }

  if (clickedPiece && clickedPiece.color === turn) {
    selectedSquare = { row, col };
    currentLegalMoves = getPieceMoves(row, col);
    renderMainBoard();
    return;
  }

  const dest = currentLegalMoves.find(m => m.row === row && m.col === col);
  if (dest) {
    doMove(selectedSquare, dest);
  } else {
    selectedSquare = null;
    currentLegalMoves = [];
    renderMainBoard();
  }
}

function buildFullNotation(piece, fc, tr, tc, capturedPiece, special) {
  if (special === 'enpassant') {
    const s = 'abcdefgh'[fc] + 'x' + squareName(tr, tc) + ' e.p.';
    return { modern: s, old: s, oldExpansion: `Peão captura em passagem, em ${squareName(tr, tc)}` };
  }

  const destSqModern = squareName(tr, tc);
  let modern;
  if (piece.type === 'p') {
    modern = capturedPiece ? ('abcdefgh'[fc] + 'x' + destSqModern) : destSqModern;
  } else {
    modern = pieceLetterPT(piece.type) + (capturedPiece ? 'x' : '') + destSqModern;
  }

  const letterOld = pieceLetterOldPT(piece.type);
  const fileCode = FILE_CODES[tc];
  const rankOld = descRank(tr, piece.color);
  const destSqOld = rankOld + fileCode;
  const pieceName = PIECE_NAMES_PT[piece.type];
  const fileNameFull = FILE_NAMES_PT[fileCode];

  let old, oldExpansion;
  if (capturedPiece) {
    old = letterOld + 'x' + destSqOld;
    oldExpansion = `${pieceName} captura em ${rankOld} ${fileNameFull}`;
  } else {
    old = letterOld + destSqOld;
    oldExpansion = `${pieceName} ${rankOld} ${fileNameFull}`;
  }

  return { modern, old, oldExpansion };
}

function updateCastlingRightsOnMove(movingPiece, fr, fc, tr, tc, capturedPiece) {
  if (movingPiece.type === 'k') {
    castlingRights[movingPiece.color].k = false;
    castlingRights[movingPiece.color].q = false;
  }
  if (movingPiece.type === 'r') {
    if (movingPiece.color === 'w' && fr === 7 && fc === 0) castlingRights.w.q = false;
    if (movingPiece.color === 'w' && fr === 7 && fc === 7) castlingRights.w.k = false;
    if (movingPiece.color === 'b' && fr === 0 && fc === 0) castlingRights.b.q = false;
    if (movingPiece.color === 'b' && fr === 0 && fc === 7) castlingRights.b.k = false;
  }
  if (capturedPiece && capturedPiece.type === 'r') {
    if (tr === 7 && tc === 0) castlingRights.w.q = false;
    if (tr === 7 && tc === 7) castlingRights.w.k = false;
    if (tr === 0 && tc === 0) castlingRights.b.q = false;
    if (tr === 0 && tc === 7) castlingRights.b.k = false;
  }
}

function executeCastle(kingPiece, fr, fc, tr, tc, special) {
  const row = fr;
  const rookFromCol = special === 'castle-k' ? 7 : 0;
  const rookToCol = special === 'castle-k' ? 5 : 3;

  board[tr][tc] = board[fr][fc];
  board[fr][fc] = null;
  board[row][rookToCol] = board[row][rookFromCol];
  board[row][rookFromCol] = null;

  castlingRights[kingPiece.color].k = false;
  castlingRights[kingPiece.color].q = false;

  const label = special === 'castle-k' ? '0-0' : '0-0-0';
  const expansion = special === 'castle-k' ? 'Roque pequeno' : 'Roque grande';
  finalizeMove(kingPiece, { modern: label, old: label, oldExpansion: expansion }, false, tr, tc);
}

function doMove(from, destMove) {
  const fr = from.row, fc = from.col, tr = destMove.row, tc = destMove.col;
  const movingPiece = board[fr][fc];
  if (!movingPiece) return;

  if (destMove.special === 'castle-k' || destMove.special === 'castle-q') {
    executeCastle(movingPiece, fr, fc, tr, tc, destMove.special);
    return;
  }

  let capturedPiece;
  if (destMove.special === 'enpassant') {
    capturedPiece = board[fr][tc];
    board[fr][tc] = null;
  } else {
    capturedPiece = board[tr][tc];
  }

  const isDoubleStep = movingPiece.type === 'p' && Math.abs(tr - fr) === 2;
  const notation = buildFullNotation(movingPiece, fc, tr, tc, capturedPiece, destMove.special);

  updateCastlingRightsOnMove(movingPiece, fr, fc, tr, tc, capturedPiece);

  board[tr][tc] = { ...movingPiece };
  board[fr][fc] = null;

  const isPromotion = movingPiece.type === 'p' && (tr === 0 || tr === 7);
  if (isPromotion) {
    askPromotion(movingPiece.color, (chosenType) => {
      board[tr][tc].type = chosenType;
      notation.modern += '=' + pieceLetterPT(chosenType);
      notation.old += '=' + pieceLetterOldPT(chosenType);
      notation.oldExpansion += `, promovendo a ${PIECE_NAMES_PT[chosenType]}`;
      finalizeMove(movingPiece, notation, isDoubleStep, tr, tc);
    });
  } else {
    finalizeMove(movingPiece, notation, isDoubleStep, tr, tc);
  }
}

function finalizeMove(movingPiece, notation, isDoubleStep, tr, tc) {
  lastMove = isDoubleStep ? { color: movingPiece.color, toRow: tr, toCol: tc } : null;

  currentMoves.push({
    color: movingPiece.color,
    pieceType: movingPiece.type,
    modern: notation.modern,
    old: notation.old,
    oldExpansion: notation.oldExpansion,
    boardAfter: cloneBoard(board),
    castlingRightsAfter: cloneCastlingRights(castlingRights),
    lastMoveAfter: lastMove ? { ...lastMove } : null,
  });

  turn = turn === 'w' ? 'b' : 'w';
  selectedSquare = null;
  currentLegalMoves = [];
  renderMovesList();
  updateTurnIndicator();
  renderMainBoard();
}

function undoLastMove() {
  if (currentMoves.length === 0) return;
  currentMoves.pop();

  if (currentMoves.length > 0) {
    const prev = currentMoves[currentMoves.length - 1];
    board = cloneBoard(prev.boardAfter);
    castlingRights = cloneCastlingRights(prev.castlingRightsAfter);
    lastMove = prev.lastMoveAfter ? { ...prev.lastMoveAfter } : null;
  } else {
    board = cloneBoard(initialPositionForRecording);
    castlingRights = cloneCastlingRights(initialCastlingRights);
    lastMove = null;
  }

  turn = turn === 'w' ? 'b' : 'w';
  selectedSquare = null;
  currentLegalMoves = [];
  renderMovesList();
  updateTurnIndicator();
  renderMainBoard();
}

function buildMoveLi(m, index, isCurrent) {
  const li = document.createElement('li');
  if (isCurrent) li.className = 'current';

  const modern = m.modern || m.notation || '?';
  const old = m.old || m.notation || '?';
  const oldExpansion = m.oldExpansion || '';
  const colorLabel = m.color ? colorNamePT(m.color) : '';
  const pieceLabel = m.pieceType ? PIECE_NAMES_PT[m.pieceType] : '';

  li.innerHTML = `
    <div class="move-row">
      <span><span class="move-index">${index + 1}.</span>${escapeHtml(colorLabel)} · ${escapeHtml(pieceLabel)}</span>
    </div>
    <div class="move-notations">
      <span class="move-modern"><strong>Moderno:</strong> ${escapeHtml(modern)}</span>
      <span class="move-old"><strong>Antigo:</strong> ${escapeHtml(old)} <em>(${escapeHtml(oldExpansion)})</em></span>
    </div>
  `;
  return li;
}

function renderMovesList() {
  const list = document.getElementById('movesList');
  list.innerHTML = '';
  currentMoves.forEach((m, i) => list.appendChild(buildMoveLi(m, i, false)));
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
  currentLegalMoves = [];
  document.getElementById('setupControls').classList.remove('hidden');
  document.getElementById('palette').classList.remove('hidden');
  document.getElementById('recordingControls').classList.add('hidden');
  document.getElementById('movesEmptyHint').classList.remove('hidden');
  document.getElementById('movesList').innerHTML = '';
  renderMainBoard();
}

function initCastlingRights() {
  castlingRights = { w: { k: false, q: false }, b: { k: false, q: false } };

  if (board[7][4] && board[7][4].color === 'w' && board[7][4].type === 'k') {
    if (board[7][7] && board[7][7].color === 'w' && board[7][7].type === 'r') castlingRights.w.k = true;
    if (board[7][0] && board[7][0].color === 'w' && board[7][0].type === 'r') castlingRights.w.q = true;
  }
  if (board[0][4] && board[0][4].color === 'b' && board[0][4].type === 'k') {
    if (board[0][7] && board[0][7].color === 'b' && board[0][7].type === 'r') castlingRights.b.k = true;
    if (board[0][0] && board[0][0].color === 'b' && board[0][0].type === 'r') castlingRights.b.q = true;
  }

  initialCastlingRights = cloneCastlingRights(castlingRights);
  lastMove = null;
}

function switchToRecordingMode() {
  mode = 'recording';
  initialPositionForRecording = cloneBoard(board);
  initCastlingRights();
  currentMoves = [];
  turn = 'w';
  selectedSquare = null;
  currentLegalMoves = [];
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
    const li = buildMoveLi(m, i, i + 1 === replayStepIndex);
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
