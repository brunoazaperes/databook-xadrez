# Databook de Xadrez

Ferramenta para registrar sequências de lances de xadrez narradas em livros — monta a posição que o autor descreve, grava os movimentos clicando nas peças, e salva a sequência com um nome para consultar depois enquanto você lê.

## O que faz

- **Montagem do tabuleiro**: começa na posição inicial padrão, mas você pode limpar e posicionar as peças como quiser (clique numa peça da paleta, depois na casa do tabuleiro).
- **Gravação de lances**: clique na peça e depois na casa de destino — o lance é registrado em notação algébrica simplificada (ex: `e4`, `Cf3`, `Dxh5`), incluindo capturas e promoção de peão.
- **Desfazer lance** e **voltar à montagem** a qualquer momento.
- **Salvar sequência**: dá um nome (ex: "Abertura Italiana - cap. 3") e observações opcionais (página do livro, contexto).
- **Meu databook**: lista todas as sequências salvas. Ao abrir uma, você revê os lances passo a passo (anterior/próximo ou clicando num lance da lista) acompanhando a posição no tabuleiro — ideal para seguir junto com a leitura do livro.
- Tudo salvo no navegador (`localStorage`) — não precisa de servidor nem internet para usar.

## Limitações conhecidas

- Não valida se o lance é legal (de propósito — serve para transcrever o que o livro narra, mesmo que o movimento não seja um lance "oficial" de uma partida real).
- Não tem notação especial para roque (0-0) ou en passant — cada peça é registrada pelo seu próprio movimento.
- Quando duas peças iguais podem ir para a mesma casa, a notação não desambigua (ex: sempre mostra `Cf3`, sem indicar de qual casa saiu o cavalo).

## Como usar

Basta abrir o `index.html` em qualquer navegador. Não precisa instalar nada.

## Tecnologia

HTML, CSS e JavaScript puro — sem frameworks, sem build, sem backend.
