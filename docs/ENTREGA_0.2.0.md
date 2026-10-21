# GEMAS 0.2.0 — posse, controles e restrições de conversão

## Interface

O placar geral identifica Branco e Preto pelo fundo de cada caixa, com texto contrastante. Os círculos de posse foram retirados do placar, das cartas, dos cabeçalhos das mãos e da tabela detalhada. As gemas e seus símbolos continuam iguais.

Controles do playtest ficam no rodapé, mesmo com o laboratório fechado e inclusive na abertura e no fim da partida. Há Desfazer, Refazer, Exportar partida, Carregar partida e Exportar histórico. Com computador, também há Pausar/Retomar e Controle manual. A revisão percorre uma jogada por vez e pausa a IA para impedir que uma jogada desfeita seja refeita automaticamente.

Arrastar uma carta para uma casa livre sempre cria uma prévia, mesmo que o jogador tivesse selecionado Converter antes. Mão, monte, posse, pontuação e turno permanecem intactos até OK na carta nova ou Converter no alvo adversário. A colocação normal repõe do monte; a conversão não repõe. Converter continua incluindo a confirmação.

## Regras GEMAS-RULES-0.2

- A primeira jogada de cada jogador não pode converter. A escolha da abertura não conta como jogada. Esta proteção é obrigatória e não há opção de laboratório que a desative.
- A última carta adversária restante no tabuleiro não pode ser convertida. A contagem considera todas as cartas daquela posse no tabuleiro, incluindo componentes desconectados.
- A variante da última carta da própria mão permanece independente. Mesmo com a variante ligada, a última carta adversária do tabuleiro continua protegida.

O motor, a lista de jogadas legais, a ajuda e os dois níveis do computador aplicam as mesmas restrições. Nenhuma proteção por forma ou sequência foi acrescentada.

## Salvamentos e verificação

Os salvamentos registram a nova versão de regras. Arquivos anteriores não são reinterpretados. O salvamento antigo do navegador pode ser exportado na tela de nova partida; antes de gravar a nova partida, ele é copiado para uma chave de arquivo local. Importar uma partida antiga é recusado sem substituir a atual. O gerador permanece na versão GEMAS-GENERATOR-1; a configuração registra a restrição obrigatória de primeira conversão.

Validação: 26 testes automatizados de regras, pontuação, geração, persistência e computador. Chrome: arraste nativo com as duas escolhas, modo de conversão anterior ao arraste, estado intacto até confirmação, controles fora do laboratório, salvar/carregar, revisão e retomada do computador, cores de fundo e ausência dos círculos de posse. Simulação de 24 partidas completas com ambos os níveis, tabuleiros e variante. Relatórios em `reports/validation.json` e `reports/simulation.json`.

Os arquivos de CORAÇÕES E MENTES e os materiais sincronizados permanecem preservados.
