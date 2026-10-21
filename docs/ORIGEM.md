# Origem e escopo do fork local

Projeto independente iniciado em 21/10/2026 após aprovação da ETAPA 1 de auditoria. Origem auditada: `flanigro/coracoes-e-mentes-playtest`, branch `main`, commit `6f110756ea1a752f7496f6cba27400d4f360f01d` (versão 1.9.0).

O GitHub contém uma distribuição empacotada. Os fontes locais em `output/cm-playtest` foram relacionados à versão publicada: `publish/index.html` tem blob Git `7f98738c09f30c579ee7dcf12e027459a96d6dc3`, igual ao da árvore remota. Os 17 módulos usados pela montagem estão contidos literalmente no HTML após remoção das declarações de importação/exportação; dados operacionais também conferem.

GEMAS adapta o algoritmo de componentes, a adjacência em oito direções, o embaralhamento com semente e o padrão de sessões com reprodução. `src/opponent-controller.mjs` conserva o controle de ciclo de vida dos Workers da base auditada. Modelo de cartas, geração, pontuação, conversão, passagens, formatos, IA e interface foram especializados em módulos independentes. O código histórico e os dados políticos não foram incorporados ao jogo.

Fontes visuais: atlas original `gemas_atlas_v0.svg` recuperado da conversa `6ad7e29c-64f0-83e8-b41f-68bf43fb91e3`; Figma `qtQNhtiExBjmC1II5vTyE8`, frames `5:2` (tablet) e `5:440` (celular). Os SVGs da configuração foram baixados exatamente da resposta de contexto do Figma. Cartas mostram recortes de apresentação do atlas original sem redesenhar suas gemas. Marcellus e Jost são distribuídas com seus respectivos arquivos OFL.

Somente leitura em `sources/` e em todo o projeto CM. O inventário de hashes anterior ao fork está em `reports/original-hashes.json` (local, ignorado pelo Git). O relatório de entrega registra a conferência posterior. Nenhum site foi publicado e nenhum arquivo do Figma ou do GitHub original de CM foi alterado.

Na preparação posterior autorizada pelo autor, foi criado o repositório privado independente `https://github.com/flanigro/gemas-playtest`. Ele reúne somente o projeto GEMAS, seus ativos, documentação e testes. O fluxo automático verifica o motor e a reprodução do pacote; não configura hospedagem.

Questões de regra levantadas na auditoria foram resolvidas como parâmetros de protótipo, documentados no README: sem bônus de posse, oito direções, encerramento com ambas as mãos vazias e primeira conversão permitida por padrão. Alterá-las exige nova versão das regras, sem migrar silenciosamente partidas salvas.
