# GEMAS 1.0

Jogo de cartas para dois jogadores, no mesmo aparelho ou contra o computador. Cada carta tem duas gemas; ligue cores e formas, converta as cartas do adversário e some mais pontos. As cartas usam o atlas SVG do autor.

[Jogar online pelo GitHub Pages](https://flanigro.github.io/gemas-playtest/) · [Código e histórico](https://github.com/flanigro/gemas-playtest)

CORAÇÕES E MENTES é o projeto principal. GEMAS é um laboratório independente para estudar interface, vínculos, estratégia e formatos de tabuleiro. Seus experimentos não alteram as 48 cartas nem as regras canônicas do CM. Veja a [direção do projeto](docs/DIRECAO_DO_PROJETO.md) e a [entrega 1.0.0](docs/ENTREGA_1.0.0.md).

## Abrir

Abra **index.html** ou **ABRIR_GEMAS.html** no navegador. Os dois arquivos são idênticos, incluem fontes, imagens e o computador em segundo plano e funcionam sem servidor ou internet. A partida é salva automaticamente no navegador.

Para desenvolver: Node.js 20+; nenhuma dependência de produção.

```sh
npm test
npm start
```

Acesse `http://127.0.0.1:4188`. A entrada modular para desenvolvimento fica em `http://127.0.0.1:4188/dev.html`. Ao abrir `dev.html` diretamente como arquivo, ela encaminha para a versão independente em `index.html`. Para atualizar as duas entradas independentes: `npm run build`. `npm run simulate` executa 24 partidas e atualiza `reports/simulation.json`.

## Jogar

A tela inicial oferece Continuar partida, Nova partida, Aprender a jogar e Regras. **Aprender a jogar** é uma primeira partida guiada: abertura, colocação, grupo de três e conversão, passo a passo, e depois a partida segue livre contra o Iniciante. Em **Nova partida** escolha adversário, nível, sua cor, quem começa, tabuleiro (4×4 ou 6×4), quantidade de cores e formas e a regra opcional da última carta. As configurações são fixadas no início e não alteram uma partida em andamento.

A partida cabe numa tela fixa, sem rolagem. Em pé: placar no alto, mão do adversário logo abaixo (pode ser recolhida), tabuleiro no meio e a sua mão embaixo. Deitado ou no computador: adversário e placar de um lado, tabuleiro no centro, sua mão do outro. O tabuleiro de 24 casas aparece como 6×4 em pé e 4×6 deitado: é o mesmo tabuleiro transposto, só na apresentação.

Uma jogada:

1. Toque numa carta da mão. As que podem converter trazem um selo com setas.
2. Toque numa casa livre. A carta aparece ali em prévia; casas marcadas com setas permitem converter.
3. Confirme no próprio tabuleiro: toque de novo na casa para **colocar**, ou toque na carta adversária marcada para **converter**. Também é possível escolher primeiro a carta adversária e depois a casa.

Arrastar a carta até a casa faz o mesmo que os passos 1 e 2 e nunca confirma sozinho. Cancelar, Escape ou tocar de novo na carta desfaz a escolha. Tudo funciona por teclado, com setas para andar pelo tabuleiro.

Depois de cada jogada a carta desliza até a casa, a carta convertida vira de posse, o grupo que pontua acende com o ganho e o placar conta até o novo valor. A jogada do computador é mostrada do mesmo jeito e anunciada para leitores de tela. Com “reduzir movimento” ligado no sistema, nada se anima.

A posse é o fundo branco ou preto da carta. As ligações entre gemas de grupos que pontuam aparecem sobre o tabuleiro: cor pontilhada, forma contínua. Toque no placar para ver **Pontos por símbolo**. O menu dá acesso às regras durante a partida e às opções Mostrar ligações, Ajuda de conversão e Pontos nas cartas. Ao fim, a tela de resultado mostra o placar, os grupos de cada jogador e Jogar de novo.

**Modo playtest** (ligado no rodapé da tela inicial, ou abrindo a página com `#playtest`): acrescenta à nova partida a semente e a máscara de casas ativas; no menu da partida, desfazer e refazer um passo, pausar o computador, controle manual, exportar e carregar partida, exportar histórico, anotações, última decisão do computador e histórico; nas cartas, a identificação física.

## Contrato de playtest

- Tabuleiro padrão 4×4; opção 4×6; casas ativas configuráveis no laboratório.
- Baralho total: casas ativas + 8 cartas, incluindo as oito da mão e duas da abertura.
- Cada carta tem duas gemas: cores distintas e formas distintas. Os atributos nunca mudam na conversão; apenas a posse Branco/Preto muda.
- Quatro cartas abertas por jogador. Quem não começa escolhe a posse das duas cartas centrais. Cada jogador recebe uma; quem começa é sorteado.
- Colocar em qualquer casa livre compra uma carta do monte. Não existe carta pública nem colocação diretamente do monte.
- Converter exige carta nova e apoio antigo, distintos e vizinhos do alvo, cobrindo suas duas cores. Formas não participam. Um alvo, sem cascata, sem compra e sem proteção de sequência.
- Para cada posse, cada cor e forma pontua independentemente: +1 por carta em componente de três ou mais, por lados e diagonais. Uma carta pode somar até +4. Não há bônus de grupo de posse nem de combo cadastrado.
- A última carta da mão não converte por padrão. Na variante ela pode converter; mãos vazias passam automaticamente. Fim com tabuleiro cheio ou ambas as mãos vazias; a conversão final é resolvida antes da contagem. Só o tabuleiro pontua.
- Não é permitido converter na primeira jogada de cada jogador. A abertura não conta como jogada. Esta restrição é obrigatória.
- A última carta adversária restante no tabuleiro não pode ser convertida. Essa proteção continua valendo mesmo quando a variante permite usar a última carta da própria mão para converter. Cada jogador conserva pelo menos uma carta no tabuleiro.
- Estas regras são de GEMAS; os arquivos e as regras de CORAÇÕES E MENTES não são alterados.

## Partidas anteriores

A versão 1.0.0 usa `GEMAS-RULES-0.2`, as mesmas regras da 0.2.0: partidas salvas na 0.2.0 continuam válidas. Partidas de regras anteriores não são reinterpretadas nem retomadas. Se houver um salvamento antigo neste navegador, as telas de início e de nova partida oferecem Exportar partida anterior. Antes de salvar uma nova partida, o jogo copia o anterior para uma chave de arquivo local. Os arquivos antigos permanecem identificados por sua versão.

## Geração e repetição

Paletas independentes de duas a oito cores e duas a oito formas. Usam as primeiras linhas e colunas do atlas. Todas as cores, formas e gemas têm frequências que diferem no máximo por uma unidade. Sem repetição de gemas quando há capacidade suficiente.

Um fluxo bipartido distribui o restante de gemas e uma busca limitada as pareia em cartas válidas. A multiplicidade máxima de um tipo de carta é `ceil(quantidade / tipos possíveis)`, considerando o par sem ordem. Cartas de composição igual mantêm identificações físicas distintas. O processo é determinístico, mas não pretende sortear uniformemente todos os baralhos válidos. Semente, configuração, versão do gerador e cartas geradas são preservadas no salvamento, conferido por reprodução integral dos comandos.

## Computador

Iniciante avalia pontos imediatos e conexões. Experiente compara candidatas, respostas e compras hipotéticas. Ambos recebem mãos abertas, tabuleiro, composição do baralho e quantidade restante; não recebem a semente, ordem do monte nem histórico. Na abertura recebem somente as duas cartas reveladas. O Worker é cancelado ao desfazer, abrir o menu ou sair da partida. Se o navegador impedir o Worker, o mesmo cálculo público roda na página após uma breve espera; a interface pode pausar durante esse cálculo. Falhas e demora no Worker acionam essa alternativa, inclusive na abertura. Se o cálculo também falhar, a partida pausa com a opção Retomar; o controle manual fica no modo playtest.

## Estrutura

Regras e estado: `src/config.mjs`, `src/generator.mjs`, `src/engine.mjs`, `src/session.mjs` (puros e testados). Computador: `src/opponent.mjs`, `src/opponent-controller.mjs`, `src/worker.mjs`. Interface: `src/ui.mjs`, `src/styles.css`, `src/game-view.mjs` (dados derivados), `src/layout.mjs` (transposição do tabuleiro na tela) e `src/tutorial.mjs` (roteiro da partida guiada). A interface consulta o motor e não redefine regras.

## Verificação

`npm test` cobre geração, pontuação por oráculo independente, conversão, encerramento, máscaras, reprodução, privacidade da IA, Worker, transposição do tabuleiro, resumo das jogadas e o roteiro do tutorial. `tests/browser.mjs` faz o fluxo real em Chrome com Playwright (com `npm start` rodando); a variável opcional `GEMAS_PLAYWRIGHT_MODULE` indica um módulo Playwright já disponível no ambiente. Ele confere tela fixa, alvos de toque de 44 px, texto de 14 px, interação, partidas completas, tutorial, arquivo autônomo e a alternativa sem Worker. Relatórios de validação e simulação ficam em `reports/`.

Limites: sem multiplayer remoto, sem som e sem código alternativo de cor (o jogo depende de distinguir cores); não há estudo conclusivo de equilíbrio; totais iguais dão empate, sem critério de desempate.

Origem e isolamento: consulte `docs/ORIGEM.md`. Nenhum arquivo de CORAÇÕES E MENTES é usado em tempo de execução.
