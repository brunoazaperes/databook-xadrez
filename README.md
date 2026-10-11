# Databook de Xadrez

Ferramenta para registrar sequências de lances de xadrez narradas em livros — monta a posição que o autor descreve, grava os movimentos clicando nas peças, e salva a sequência com um nome para consultar depois enquanto você lê.

## O que faz

- **Montagem do tabuleiro**: começa na posição inicial padrão, mas você pode limpar e posicionar as peças como quiser (clique numa peça da paleta, depois na casa do tabuleiro) — útil para reproduzir uma posição específica do livro.
- **Gravação de lances com movimentação real**: clique na peça (casas possíveis aparecem com um ponto vermelho, como no chess.com) e depois na casa de destino. Respeita o movimento de cada peça, bloqueios no caminho, roque (pequeno e grande) e captura en passant. Clicar noutra peça sua troca a seleção; clicar fora dos destinos válidos desseleciona.
- **Notação dupla por lance**: cada lance mostra a cor, a peça, a notação **moderna** (ex: `Cc3`) e a notação **descritiva antiga** usada em livros antigos (ex: `C3BD` — Cavalo 3 Bispo da Dama), incluindo roque (`0-0`/`0-0-0`) e en passant (`exd6 e.p.`).
- **Desfazer lance** e **voltar à montagem** a qualquer momento.
- **Salvar sequência**: dá um nome (ex: "Abertura Italiana - cap. 3") e observações opcionais (página do livro, contexto).
- **Meu databook**: lista todas as sequências salvas. Ao abrir uma, você revê os lances passo a passo (anterior/próximo ou clicando num lance da lista) acompanhando a posição no tabuleiro — ideal para seguir junto com a leitura do livro.
- **Exportar / Importar**: baixa um `.json` com todas as sequências salvas (backup) e permite importar de volta, mesclando sem duplicar.
- Tudo salvo no navegador (`localStorage`) — não precisa de servidor nem internet para usar.

## Limitações conhecidas

- Não detecta xeque/xeque-mate — o roque não verifica se o rei passa por casa atacada, por exemplo. O foco é a movimentação física das peças, não a legalidade completa de uma partida.
- Na notação descritiva antiga, capturas mostram a peça e a casa de destino (ex: `CxD3`), não o par peça-contra-peça do estilo mais clássico (ex: `CxP`) — simplificação para manter a notação sempre reconstruível.
- Quando duas peças iguais podem ir para a mesma casa, a notação não desambigua (ex: sempre mostra `Cf3`, sem indicar de qual casa saiu o cavalo).

## Como usar

Basta abrir o `index.html` em qualquer navegador. Não precisa instalar nada.

## Tecnologia

HTML, CSS e JavaScript puro — sem frameworks, sem build, sem backend.
