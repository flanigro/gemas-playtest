# GEMAS — protótipo independente 0.1

Jogo local para dois jogadores, ou contra o computador. A tela de nova partida segue a proposta GEMAS no Figma; as cartas usam o atlas SVG fornecido pelo autor.

## Abrir

Abra **index.html** ou **ABRIR_GEMAS.html** no navegador. Os dois arquivos incluem fontes, imagens e o computador em segundo plano e funcionam sem servidor ou internet. O navegador tenta salvar a partida automaticamente; o laboratório oferece exportação para um arquivo portátil.

Para desenvolver: Node.js 20+; nenhuma dependência de produção.

```sh
npm test
npm start
```

Acesse `http://127.0.0.1:4188`. A entrada modular para desenvolvimento fica em `http://127.0.0.1:4188/dev.html` e exige o servidor. Para atualizar as duas entradas independentes: `npm run build`. `npm run simulate` executa 24 partidas e atualiza `reports/simulation.json`.

## Jogar

Configure tabuleiro, quantidade de cores e formas, adversário, posse e variante. Escolha a abertura quando solicitado. Selecione uma carta e uma casa livre; **OK** confirma. Para converter, escolha Converter e o alvo. Arrastar prepara a colocação, sem confirmar a jogada. Abra **Ver sequências** para conferir a pontuação.

O laboratório contém semente, máscaras, hipótese de primeira conversão, identificação das cartas, cálculos, histórico, anotações, desfazer/refazer e exportação/importação. Configurações são fixadas no início; não alteram uma partida em andamento.

## Contrato de playtest

- Tabuleiro padrão 4×4; opção 4×6; casas ativas configuráveis no laboratório.
- Baralho total: casas ativas + 8 cartas, incluindo as oito da mão e duas da abertura.
- Cada carta tem duas gemas: cores distintas e formas distintas. Os atributos nunca mudam na conversão; apenas a posse Branco/Preto muda.
- Quatro cartas abertas por jogador. Quem não começa escolhe a posse das duas cartas centrais. Cada jogador recebe uma; quem começa é sorteado.
- Colocar em qualquer casa livre compra uma carta do monte. Não existe carta pública nem colocação diretamente do monte.
- Converter exige carta nova e apoio antigo, distintos e vizinhos do alvo, cobrindo suas duas cores. Formas não participam. Um alvo, sem cascata, sem compra e sem proteção de sequência.
- Para cada posse, cada cor e forma pontua independentemente: +1 por carta em componente de três ou mais, por lados e diagonais. Uma carta pode somar até +4. Não há bônus de grupo de posse nem de combo cadastrado.
- A última carta da mão não converte por padrão. Na variante ela pode converter; mãos vazias passam automaticamente. Fim com tabuleiro cheio ou ambas as mãos vazias; a conversão final é resolvida antes da contagem. Só o tabuleiro pontua.
- Por padrão, a primeira jogada pode converter. A hipótese de proibi-la por jogador está disponível no laboratório. Estes são os parâmetros adotados para o protótipo após o plano da auditoria, não alterações nas regras de CORAÇÕES E MENTES.

## Geração e repetição

Paletas independentes de duas a oito cores e duas a oito formas. Usam as primeiras linhas e colunas do atlas. Todas as cores, formas e gemas têm frequências que diferem no máximo por uma unidade. Sem repetição de gemas quando há capacidade suficiente.

Um fluxo bipartido distribui o restante de gemas e uma busca limitada as pareia em cartas válidas. A multiplicidade máxima de um tipo de carta é `ceil(quantidade / tipos possíveis)`, considerando o par sem ordem. Cartas de composição igual mantêm identificações físicas distintas. O processo é determinístico, mas não pretende sortear uniformemente todos os baralhos válidos. Semente, configuração, versão do gerador e cartas geradas são preservadas no salvamento, conferido por reprodução integral dos comandos.

## Computador

Iniciante avalia pontos imediatos e conexões. Experiente compara candidatas, respostas e compras hipotéticas. Ambos recebem mãos abertas, tabuleiro, composição do baralho e quantidade restante; não recebem a semente, ordem do monte nem histórico. Na abertura recebem somente as duas cartas reveladas. O Worker é cancelado ao desfazer, abrir diálogos ou sair da partida.

## Verificação

`npm test` cobre geração, pontuação por oráculo independente, conversão, encerramento, máscaras, reprodução, privacidade da IA e Worker. `tests/browser.mjs` faz o fluxo real em Chrome com Playwright instalado; a variável opcional `GEMAS_PLAYWRIGHT_MODULE` indica um módulo Playwright já disponível no ambiente. Relatórios de validação e simulação ficam em `reports/`.

Limites: sem multiplayer remoto; temas são tratamentos visuais locais; não há ainda tutorial guiado nem estudo conclusivo de equilíbrio. A tela de partida é uma proposta de protótipo, pois o Figma fornecido especifica a nova partida.

Origem e isolamento: consulte `docs/ORIGEM.md`. Nenhum arquivo de CORAÇÕES E MENTES é usado em tempo de execução.
