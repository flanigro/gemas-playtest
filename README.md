# GEMAS — protótipo independente 0.2.0

Jogo local para dois jogadores, ou contra o computador. A tela de nova partida segue a proposta GEMAS no Figma; as cartas usam o atlas SVG fornecido pelo autor.

[Jogar online pelo GitHub Pages](https://flanigro.github.io/gemas-playtest/) · [Código e histórico](https://github.com/flanigro/gemas-playtest)

CORAÇÕES E MENTES é o projeto principal. GEMAS é um laboratório independente para estudar interface, vínculos, estratégia e formatos de tabuleiro. Seus experimentos não alteram as 48 cartas nem as regras canônicas do CM. Veja a [direção do projeto](docs/DIRECAO_DO_PROJETO.md).

## Abrir

Abra **index.html** ou **ABRIR_GEMAS.html** no navegador. Os dois arquivos incluem fontes, imagens e o computador em segundo plano e funcionam sem servidor ou internet. O navegador tenta salvar a partida automaticamente; os controles do rodapé oferecem exportação para um arquivo portátil.

Para desenvolver: Node.js 20+; nenhuma dependência de produção.

```sh
npm test
npm start
```

Acesse `http://127.0.0.1:4188`. A entrada modular para desenvolvimento fica em `http://127.0.0.1:4188/dev.html`. Ao abrir `dev.html` diretamente como arquivo, ela encaminha para a versão independente em `index.html`. Para atualizar as duas entradas independentes: `npm run build`. `npm run simulate` executa 24 partidas e atualiza `reports/simulation.json`.

## Jogar

Configure tabuleiro, quantidade de cores e formas, adversário, posse e variante. Escolha a abertura quando solicitado. Selecione uma carta e uma casa livre; **OK · colocar** confirma a colocação normal. Arrastar prepara a colocação e mantém a jogada em aberto: escolha OK na carta para colocá-la normalmente ou Converter no alvo adversário para jogar e converter. O arraste nunca encerra a jogada sozinho, mesmo se um modo de conversão tiver sido selecionado antes.

A ajuda de conversão destaca com borda dourada as cartas da mão que têm alguma conversão legal. Ao selecionar uma delas, os alvos possíveis na mesa também ficam destacados. **Converter** na carta da mesa, na carta da mão ou na barra já confirma a conversão quando casa e alvo estão definidos. Se faltar escolher casa ou alvo, a última escolha conclui a jogada, sem outro OK. Havendo mais de um alvo, o jogador escolhe qual converter. Os controles respeitam as regras da partida: primeira jogada de cada jogador sem conversão, última carta adversária protegida no tabuleiro e restrição da última carta da própria mão.

A posse é indicada pelo fundo branco ou preto dos placares e das cartas, sem círculos de identificação. A mão ativa fica no topo, com a barra ao lado em telas largas e logo abaixo em telas menores. As cartas e os intervalos entre as gemas são compactos. O placar geral fica sempre em destaque, fixo durante a rolagem. **Pontos por símbolo**, abaixo do tabuleiro, começa recolhido; Expandir mostra a tabela de cores e formas, e Ver sequências detalha as cartas que pontuam. Abrir ou recolher o painel é preservado durante as jogadas.

As ligações começam visíveis: cor pontilhada e forma contínua fina. Somente sequências confirmadas de três ou mais cartas da mesma posse desenham linhas. **Mostrar ligações** controla o desenho; **Pontos nas cartas** é uma opção independente.

O rodapé mantém Desfazer, Refazer, Exportar partida, Carregar partida e Exportar histórico sempre disponíveis, sem abrir o laboratório. Quando há computador, também oferece Pausar/Retomar e Controle manual. Desfazer e Refazer percorrem uma jogada por vez e pausam o computador para revisão. O laboratório contém semente, máscaras, identificação das cartas, cálculos, histórico e anotações. Configurações são fixadas no início; não alteram uma partida em andamento.

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

A versão 0.2.0 usa `GEMAS-RULES-0.2`. As partidas de regras anteriores não são reinterpretadas nem retomadas sob as novas restrições. Se houver um salvamento antigo neste navegador, a tela de nova partida oferece Exportar partida anterior. Antes de salvar uma nova partida, o jogo copia o anterior para uma chave de arquivo local. Os arquivos antigos permanecem identificados por sua versão. Comece uma nova partida para usar as regras atuais.

## Geração e repetição

Paletas independentes de duas a oito cores e duas a oito formas. Usam as primeiras linhas e colunas do atlas. Todas as cores, formas e gemas têm frequências que diferem no máximo por uma unidade. Sem repetição de gemas quando há capacidade suficiente.

Um fluxo bipartido distribui o restante de gemas e uma busca limitada as pareia em cartas válidas. A multiplicidade máxima de um tipo de carta é `ceil(quantidade / tipos possíveis)`, considerando o par sem ordem. Cartas de composição igual mantêm identificações físicas distintas. O processo é determinístico, mas não pretende sortear uniformemente todos os baralhos válidos. Semente, configuração, versão do gerador e cartas geradas são preservadas no salvamento, conferido por reprodução integral dos comandos.

## Computador

Iniciante avalia pontos imediatos e conexões. Experiente compara candidatas, respostas e compras hipotéticas. Ambos recebem mãos abertas, tabuleiro, composição do baralho e quantidade restante; não recebem a semente, ordem do monte nem histórico. Na abertura recebem somente as duas cartas reveladas. O Worker é cancelado ao desfazer, abrir diálogos ou sair da partida. Se o navegador impedir o Worker, o mesmo cálculo público roda na página após uma breve espera; a interface pode pausar durante esse cálculo. Falhas e demora no Worker acionam essa alternativa, inclusive na abertura. Se o cálculo também falhar, Tentar novamente e Controle manual ficam disponíveis.

## Verificação

`npm test` cobre geração, pontuação por oráculo independente, conversão, encerramento, máscaras, reprodução, privacidade da IA e Worker. `tests/browser.mjs` faz o fluxo real em Chrome com Playwright instalado; a variável opcional `GEMAS_PLAYWRIGHT_MODULE` indica um módulo Playwright já disponível no ambiente. Relatórios de validação e simulação ficam em `reports/`.

Limites: sem multiplayer remoto; temas são tratamentos visuais locais; não há ainda tutorial guiado nem estudo conclusivo de equilíbrio. A tela de partida é uma proposta de protótipo, pois o Figma fornecido especifica a nova partida.

Origem e isolamento: consulte `docs/ORIGEM.md`. Nenhum arquivo de CORAÇÕES E MENTES é usado em tempo de execução.
