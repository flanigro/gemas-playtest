# GEMAS 0.1 — entrega local

21 de outubro de 2026. Entrega inicial de projeto local independente em `output/gemas`. O jogo pode ser experimentado em `index.html` ou `ABRIR_GEMAS.html`, com todos os ativos incorporados, ou pelo servidor local na porta 4188.

## Implementado

- Modelo independente de posse e atributos; cartas identificadas individualmente mesmo quando repetem composição.
- Gerador por semente com paletas de 2–8 cores e 2–8 formas, equilíbrio simultâneo de cores, formas e gemas, limite de cópias por tipo e baralho de casas ativas + 8.
- Tabuleiros 4×4/4×6, máscaras e abertura em casas ativas, incluindo máscara mínima preenchida pela própria abertura.
- Pontuação por componentes em oito direções, separada por posse, cor e forma, até quatro pontos por carta, sem grupo ou combo adicional.
- Conversão pelas duas cores com carta nova e apoio antigo; atributos fixos; nenhuma proteção de sequência.
- Mão inicial aberta de quatro; colocação compra; conversão não compra; sem carta pública.
- Última conversão proibida por padrão; variante com passes automáticos e fim antecipado por ambas as mãos vazias.
- Interface de nova partida baseada nos frames tablet/celular do Figma; SVGs exatos e fontes locais; contagens e texto de repetição dinâmicos.
- Interface de partida própria com ajuda, prévia/OK, arrastar, pontuação, cálculo de sequências e dois temas.
- IA iniciante/experiente em Worker, com observação pública e compras hipotéticas, inclusive no arquivo independente.
- Salvamento próprio validado por reprodução, isolamento de formatos/armazenamento, desfazer/refazer e laboratório com histórico, notas e exportação.

## Evidências

- 18 testes automatizados passaram. Incluem oráculo independente de pontuação, invariantes de conversão, máscaras, adulteração de salvamento e privacidade do monte.
- Matriz de geração: 1.470 configurações no teste automatizado; mais 1.127 configurações adicionais com máscaras de duas a 24 casas verificadas em memória. Todas passaram.
- Navegador Chrome: configuração em 768, 390 e 320px; 16 slots SVG do Figma carregados e na geometria esperada; sem transbordamento horizontal; jogo manual com sete conversões; confirmação sem alterar o estado na prévia; cálculo, desfazer e refazer.
- Workers reais concluíram partidas 4×4 no iniciante e 4×6 no experiente. O Worker incorporado também concluiu uma partida pelo arquivo local, sem importações externas ou servidor.
- 24 simulações: 17 terminaram com tabuleiro cheio, sete com ambas as mãos vazias, nenhuma travou. Houve oito vitórias de Branco, 13 de Preto e três empates. A amostra não comprova equilíbrio.
- Conferência posterior dos 812 arquivos de referência/origem inventariados antes do fork: nenhum alterado.

Relatórios detalhados: `reports/validation.json`, `reports/simulation.json` e `reports/delivery.json`.

## Próxima revisão

O protótipo adota as decisões propostas na auditoria; elas estão explícitas no README e não alteram o cânone de CORAÇÕES E MENTES. A próxima revisão deve priorizar sensação de jogo por paleta, duração, custo de conversão e conveniência do fim antecipado. A primeira conversão é permitida por padrão; o laboratório oferece a hipótese contrária.

A tela de partida é uma proposta própria; a referência Figma cobre nova partida. Tutorial guiado e multiplayer remoto não fazem parte desta entrega.

## Preparação do GitHub · 0.1.1

Após solicitação do autor, foi criado o repositório privado independente `flanigro/gemas-playtest`. O pacote inclui código-fonte, testes, ativos e licenças, documentação e verificação automática em Node 20 e 24. Nenhum site foi publicado.

A abertura direta de `index.html` estava bloqueada pela política de módulos locais do navegador. Agora a montagem gera `index.html` e `ABRIR_GEMAS.html` idênticos e independentes. A entrada modular de desenvolvimento ficou em `dev.html`, servida localmente.

Os 19 testes passaram, incluindo um novo teste de empacotamento. A verificação no navegador também cobre a abertura direta de `index.html`, além do fluxo modular e do computador incorporado.
