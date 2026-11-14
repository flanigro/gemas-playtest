# GEMAS 1.0.0 — versão 1

Data: 14/11/2026. Regras: `GEMAS-RULES-0.2`, sem alteração. Gerador: `GEMAS-GENERATOR-1`, sem alteração.

Esta entrega troca a apresentação e a interação do protótipo 0.2.0 pelo redesenho aprovado no briefing de 24/10/2026. Motor, gerador, sessão e computador não foram tocados: `src/engine.mjs`, `src/config.mjs`, `src/generator.mjs`, `src/session.mjs`, `src/opponent.mjs`, `src/opponent-controller.mjs` e `src/worker.mjs` são os mesmos do commit `93562d9`. Partidas salvas na 0.2.0 continuam abrindo.

## Decisões do autor aplicadas (14/11/2026)

- Modos: contra o computador é o padrão; duas pessoas no mesmo aparelho é escolhido na nova partida.
- Identidade: direção Carrara, com o mármore um tom mais escuro para a carta branca se destacar. Tema único; o Rococó saiu.
- Tipografia: Marcellus (títulos) e Jost (texto e números).
- 6×4: transposição só na apresentação, sem mexer no motor.
- Tutorial guiado: entra na versão 1.
- Publicação direta na `main`.

## Decisão técnica do 6×4

O motor continua guardando o tabuleiro como 4 linhas por N colunas. `src/layout.mjs` decide apenas a ordem em que as casas são desenhadas: em telas em pé, o tabuleiro de 6 colunas aparece com linhas e colunas trocadas (6 linhas por 4 colunas); deitado, aparece como 4×6. A casa de índice `i` do motor é sempre a mesma casa; mudam a posição na tela e o rótulo lido (“linha 3, coluna 2”). Como a vizinhança por lados e diagonais é simétrica, a transposição preserva todos os vizinhos, e portanto conversões e pontos. `tests/layout.test.mjs` confere que cada casa aparece uma única vez e que duas casas são vizinhas na tela exatamente quando são vizinhas no motor. Salvamentos, histórico e exportações continuam usando os índices do motor.

## Telas

- Início: continuar partida, nova partida, aprender a jogar, regras. No primeiro acesso, o tutorial é a ação principal.
- Nova partida: adversário, nível, sua cor, quem começa, tabuleiro, paleta com os símbolos do Figma, regra opcional. Com o modo playtest ligado, semente e máscara de casas.
- Partida, em tela fixa e sem rolagem (Layout A): barra com menu e desfazer, placar, mão do adversário recolhível, tabuleiro, instrução e a mão do jogador. Deitado e no computador, adversário e placar ficam de um lado e a mão do outro.
- Resultado: quem venceu ou empate, placar, pontos de cores e de formas, grupos de cada jogador, jogar de novo, mudar a configuração, ver o tabuleiro.
- Regras: folha consultável a qualquer momento, com dois exemplos desenhados com as gemas do atlas.
- Pontos por símbolo: tabela de cores e formas e lista de grupos, aberta pelo placar ou pelo menu.
- Tutorial: 12 passos sobre uma partida real de semente fixa (`src/tutorial.mjs`), conferidos contra o motor em `tests/tutorial.test.mjs`. Não ocupa o salvamento do jogador.

## Interação

O botão de confirmar aparece no tabuleiro, onde a jogada acontece: na casa, para colocar; na carta adversária, para converter. O jogador escolhe casa e alvo, em qualquer ordem; quando só uma casa serve para o alvo escolhido, ela já entra em prévia. Nada muda na partida antes da confirmação. Arrastar usa eventos de ponteiro (funciona no toque) e equivale a tocar carta e casa. Em casas estreitas, o rótulo do botão vira ícone para não cortar texto.

Desfazer, contra o computador, volta até a vez do jogador. No modo playtest, desfaz e refaz um passo por vez e pausa o computador.

## Respostas visuais e anúncios

Carta deslizando da mão (ou da mão do adversário) até a casa; carta convertida virando de posse; grupo que pontua acendendo, com o ganho subindo da jogada; placar contando até o novo valor; carta comprada entrando na mão. A jogada do computador espera a animação anterior terminar. Com `prefers-reduced-motion`, nenhuma animação roda: o ganho aparece parado e o placar muda de imediato. A última carta jogada fica com um ponto dourado e a última convertida com um selo de setas, com ou sem movimento.

Uma região `aria-live` fixa anuncia cada jogada: quem jogou, carta, casa, conversão, pontos ganhos e perdidos, placar, passe automático, de quem é a vez e o resultado final.

## Acessibilidade (WCAG 2.1 AA)

Conferido por `tests/browser.mjs` em 320, 360, 390, 768, 844 e 1280 px de largura:

- Alvos de toque: todos os botões, casas, cartas da mão e interruptores com 44×44 px ou mais, nas telas de referência 390×844 e 360×780 e também em 390×664 e 360×620 (navegador de celular com as barras visíveis). Abaixo de 600 px de altura, o 6×4 fica com casas menores que 44 px; o 4×4 continua dentro do critério.
- Texto: nada visível abaixo de 14 px.
- Teclado: partida inteira sem mouse; foco visível e preservado a cada redesenho; setas andam pelo tabuleiro; Escape cancela a escolha e fecha folhas; folhas prendem o foco e o devolvem a quem abriu.
- Leitor de tela: casas, cartas, placar e mãos com nomes; anúncios descritos acima.
- Orientação: em pé e deitado.
- Contraste de texto (mínimo 4,5:1): texto sobre mármore 9,1; texto secundário sobre mármore 5,9 e sobre a zona mais escura 4,7; texto dourado sobre painel 7,2; texto de botão de veludo 13,3; aviso de erro sobre mármore 6,4 e sobre a zona mais escura 5,0.
- Contraste gráfico (mínimo 3:1): borda da carta branca contra o branco 4,0; carta preta contra a bandeja 7,5; bordas douradas contra o mármore 5,0; anel de foco contra o mármore 5,1.
- Gemas rosa e azul-claro sobre carta branca (UX-6): o atlas não mudou. Cada gema ganhou um contorno fino desenhado pela carta (escuro na carta branca, claro na preta), que dá a borda de 3:1.
- Exceção mantida por decisão do autor: não há código alternativo de cor para daltônicos.

## Verificação desta entrega

- `npm test`: 31 testes (26 anteriores, intactos, mais 5 novos de transposição, resumo de jogada e tutorial).
- `tests/browser.mjs`: 18 verificações, registradas em `reports/validation.json`.
- `npm run simulate`: 24 partidas, nenhuma travada (13 por tabuleiro cheio, 11 por mãos vazias).
- Amostra exploratória de qualidade do computador: em 24 partidas Experiente contra Iniciante, 4×4 e 4×6, alternando cores, o Experiente venceu 15, perdeu 8 e empatou 1; a decisão mais lenta do Experiente levou 0,13 s nesta máquina. Não é critério aprovado, só uma medida para o autor decidir.

## Bugs do protótipo tratados

- UX-1 (alvos menores que 44 px) e UX-2 (texto de 9 a 11 px): resolvidos e cobertos por teste.
- UX-3 (jogada do computador sem animação nem anúncio): resolvido.
- UX-4 (confirmação em vários lugares): a confirmação ficou só no tabuleiro.
- UX-5 (arrastar): refeito com eventos de ponteiro; falta a avaliação do autor no celular.
- UX-6 (contraste de gemas claras): resolvido pelo contorno, sem redesenhar o atlas.

## Fora desta versão e pendências do autor

- Partida de usabilidade do autor no celular (critério de conclusão que só ele pode fechar).
- Som; tablet como formato próprio; níveis adicionais do computador e critério de qualidade da IA.
- Critério de desempate (hoje, totais iguais dão empate).
- `GEMAS-RULES-0.3` (formas comandam a conversão): não aplicada; exige especificação e nova versão de regras.
- Arquivo `LICENSE`: o repositório continua sem licença declarada; atlas e SVGs do Figma são do autor.
