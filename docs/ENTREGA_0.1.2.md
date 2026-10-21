# GEMAS 0.1.2 — revisão da mesa de jogo

- Abrir `dev.html` como arquivo encaminha para `index.html`, sem solicitar módulos locais que o Chrome bloqueia. As duas entradas independentes continuam com atlas, fontes e computador incorporados.
- A mão de quem joga fica acima do tabuleiro, com a barra Colocar / Converter / OK imediatamente junto dela. Converter e OK também ficam sobre a carta selecionada, sobre sua prévia na casa de destino e sobre o alvo escolhido. Escolher um alvo prepara a conversão; OK confirma uma única jogada.
- A tabela abaixo do tabuleiro mostra pontos por símbolo de cor e forma, por jogador, e subtotais. A quantidade de colunas acompanha a configuração; todos os números vêm das sequências calculadas pelo motor.
- Ligações vêm ligadas: pontilhado da cor da gema e linha contínua fina para a forma. O desenho liga gemas correspondentes em cartas vizinhas da mesma posse. Uma árvore por componente evita linhas redundantes. Pares mostram conexões; só componentes de três ou mais pontuam. A prévia da jogada não altera as linhas nem os pontos confirmados.
- O computador usa o mesmo cálculo público como alternativa se o navegador bloquear o Worker ou ele falhar/demorar. O endereço temporário do Worker incorporado permanece válido até a resposta ou o cancelamento. Respostas atrasadas são descartadas. Há recuperação de erro também na abertura.

Regras, gerador, formato de salvamento e dados de CORAÇÕES E MENTES permanecem iguais. As mudanças desta revisão ficam em GEMAS.

Validação: testes do motor, geração, pontuação variável e ciclo do computador; partidas reais no Chrome com ambos os níveis, humano Branco/Preto, arquivos independentes, entrada de desenvolvimento, Worker permitido e bloqueado. Revisão visual nas larguras 768, 390 e 320 pixels. O registro executável fica em `reports/validation.json`.
