# Origem e escopo do projeto derivado

Projeto independente iniciado em 21/10/2026 após aprovação da ETAPA 1 de auditoria. Origem auditada: `flanigro/coracoes-e-mentes-playtest`, branch `main`, commit `6f110756ea1a752f7496f6cba27400d4f360f01d` (versão 1.9.0).

O GitHub contém uma distribuição empacotada. Os fontes locais em `output/cm-playtest` foram relacionados à versão publicada: `publish/index.html` tem blob Git `7f98738c09f30c579ee7dcf12e027459a96d6dc3`, igual ao da árvore remota. Os 17 módulos usados pela montagem estão contidos literalmente no HTML após remoção das declarações de importação/exportação; dados operacionais também conferem.

GEMAS adapta o algoritmo de componentes, a adjacência em oito direções, o embaralhamento com semente e o padrão de sessões com reprodução. `src/opponent-controller.mjs` conserva o controle de ciclo de vida dos Workers da base auditada. Modelo de cartas, geração, pontuação, conversão, passagens, formatos, IA e interface foram especializados em módulos independentes. O código histórico e os dados políticos não foram incorporados ao jogo.

Fontes visuais: atlas original `gemas_atlas_v0.svg` recuperado da conversa `6ad7e29c-64f0-83e8-b41f-68bf43fb91e3`; Figma `qtQNhtiExBjmC1II5vTyE8`, frames `5:2` (tablet) e `5:440` (celular). Os SVGs da configuração foram baixados exatamente da resposta de contexto do Figma. Cartas mostram recortes de apresentação do atlas original sem redesenhar suas gemas. Marcellus e Jost são distribuídas com seus respectivos arquivos OFL.

Somente leitura em `sources/` e em todo o projeto CM. O inventário de hashes anterior à derivação está em `reports/original-hashes.json` (local, ignorado pelo Git). O relatório de entrega registra a conferência posterior. Na entrega inicial, nenhum site havia sido publicado. Nenhum arquivo do Figma ou do GitHub original de CM foi alterado.

Na preparação posterior autorizada pelo autor, foi criado o repositório independente `https://github.com/flanigro/gemas-playtest`, inicialmente privado. Ele reúne somente o projeto GEMAS, seus ativos, documentação e testes. Trata-se de uma derivação independente, sem o vínculo formal de fork do GitHub. A conta `flanigro` possui o repositório original; a interface do GitHub não oferece criar um fork dele nessa mesma conta. O histórico original não foi importado nem reescrito. O fluxo automático verifica o motor e a reprodução do pacote.

Em 21/10/2026, a versão 0.2.0 foi publicada no serviço Sites. Após esclarecer que desejava publicar pelo GitHub, o autor autorizou tornar público o repositório GEMAS, incluindo código, arquivos e histórico, e ativar o GitHub Pages. A distribuição para o Pages usa o `index.html` independente da raiz. Essa autorização se aplica ao GEMAS; não altera o repositório de CM.

Na versão inicial, as questões de regra levantadas na auditoria foram resolvidas como parâmetros de protótipo: sem bônus de posse, oito direções, encerramento com ambas as mãos vazias e primeira conversão permitida. A revisão abaixo substituiu esta última regra. O contrato atual está no README. Alterações exigem nova versão das regras, sem migrar silenciosamente partidas salvas.


Na revisão 0.2.0, por instrução explícita do autor, a primeira jogada de cada jogador passou a impedir conversão obrigatoriamente e a última carta adversária no tabuleiro passou a ser protegida. O contrato recebeu a versão GEMAS-RULES-0.2; salvamentos anteriores são preservados para exportação, sem migração silenciosa.
