# GEMAS 1.1.0 — formas no comando, gemas maiores e revanche

Data: 15/11/2026. Regras: `GEMAS-RULES-0.3`. Gerador: `GEMAS-GENERATOR-1`, sem alteração.

Pedidos do autor em 15/11/2026, depois de jogar a 1.0.0.

## Regra: conversão por formas ou por cores (GEMAS-RULES-0.3)

Cada partida escolhe o atributo que comanda a conversão: **formas** (padrão) ou **cores**. Para converter, a carta nova e uma carta antiga, ambas vizinhas do alvo, cobrem os dois valores desse atributo no alvo: as duas formas ou as duas cores. O outro atributo não participa da conversão. A pontuação não muda: formas e cores pontuam igual nos dois modos.

- Motor: `config.convertBy` (`'shape'` ou `'color'`, padrão `'shape'`) em `src/config.mjs`; `checkMove` em `src/engine.mjs` usa esse atributo, e a cobertura informa `kind` e `value`. As mensagens de jogada inválida falam em formas ou cores conforme a partida.
- Salvamentos `GEMAS-RULES-0.2` (versões 0.2.0 e 1.0.0) seguem a política de sempre: não são retomados nem reinterpretados, e podem ser exportados sem alteração.
- Testes: os testes de conversão rodam nos dois modos; há um teste novo para o padrão e para valores inválidos.
- Paleta padrão mantida (6 cores, 8 formas). Com ela, a conversão por formas fica um pouco mais rara, porque há 8 formas e só 6 cores. Medida em 30 partidas do Iniciante para cada caso:
  - 6 cores e 8 formas, conversão por formas: 4,4 conversões por partida, possível em 29% dos turnos.
  - 6 cores e 8 formas, conversão por cores: 5,5 conversões por partida, possível em 36% dos turnos.
  - 8 cores e 6 formas, conversão por formas: 5,5 conversões por partida, possível em 35% dos turnos.
  Para a conversão por formas ter a frequência que a conversão por cores tinha, basta inverter a paleta padrão para 8 cores e 6 formas. Fica como decisão do autor.

## Mensagem sobre sequências e dica de pontos

- Enquanto quem joga ainda não tem pontos, a linha de instrução diz: "Ligue 3 ou mais cartas suas pela mesma forma ou pela mesma cor."
- As regras abrem com a meta das sequências e usam "sequência" no lugar de "grupo".
- Dica de pontos, escolhida na nova partida: ao escolher uma carta, cada casa mostra o melhor ganho possível ali (+N), e a prévia mostra os pontos de colocar e de cada conversão. O cálculo consulta o motor sem alterar a partida. Existe contra o Iniciante e entre duas pessoas (ligada por padrão) e não existe contra o Experiente.
- A barra do alto da partida mostra o modo: "conversão por formas" ou "conversão por cores".

## Gemas maiores; linhas entre a carta e as gemas

- O atlas não mudou. Cada célula dele tinha de 12% a 30% de vazio por lado; o recorte agora deixa 11%, o que aumenta a gema visível em 28% na mesma área. A carta também cedeu margem e o tabuleiro ficou com espaços menores.
- Ganho total da gema visível, medido no navegador: cerca de 50% no tabuleiro 4×4 em 390×844, 44% em 360×780, 47% no 6×4 em 390×844, 54% no 6×4 em 360×780, 62% na mão do jogador e 58% na mão do adversário. Nas casas do tabuleiro em pé, a altura disponível limita o ganho nessa faixa.
- As linhas de ligação passaram para baixo das gemas e acima do fundo das cartas. Selos, botões de confirmar e pontos ficam acima de tudo.

## Nova partida no fim

- Ao fim da partida, **Nova partida** aparece ao lado de **Resultado** e recomeça na hora, com a mesma configuração e cartas novas. O mesmo vale para Jogar de novo, na tela de resultado.
- Quem perdeu faz a primeira jogada; quem ganhou escolhe as cartas de abertura. Depois de empate, sorteia-se. A tela de resultado avisa quem começa na próxima.
- Medida que reforça a escolha: em 240 partidas do Iniciante contra ele mesmo, quem faz a primeira jogada venceu 62% (conversão por formas: 76 vitórias de quem começa, 39 de quem escolhe, 5 empates; por cores: 73, 36 e 11). Começar dá vantagem, e a revanche a entrega a quem perdeu.

## Tutorial

O roteiro foi refeito para ensinar a conversão por formas (semente `GEMAS-TUTORIAL-5`): dupla e sequência de quadrados (+3) e conversão de uma carta com quadrado e círculo, chegando a 8 a 0. `tests/tutorial.test.mjs` confere cada passo contra o motor.

## Verificação

- `npm test`: 38 testes.
- `tests/browser.mjs`: tela fixa, alvos de 44 px e texto de 14 px seguem valendo com as gemas maiores; novas verificações para o seletor de conversão, a dica de pontos (cada número conferido contra o motor), a revanche (quem perdeu começa; sorteio depois de empate) e os dois botões do fim.
- `npm run simulate`: 24 partidas com conversão por formas, nenhuma travada.

## Para depois, como combinado

- Animação sutil das linhas, mostrando uma gema ligando a outra.
- Sons.
