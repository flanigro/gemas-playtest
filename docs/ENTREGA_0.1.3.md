# GEMAS 0.1.3 — mesa compacta e conversão direta

- O painel Pontos por símbolo começa recolhido e preserva seu estado aberto/fechado entre jogadas. O placar geral fica fora do painel, em destaque e fixo durante a rolagem.
- Só componentes que pontuam, com três ou mais cartas da mesma posse, desenham ligações. Cor continua pontilhada e forma contínua fina; a opção começa ligada.
- A ajuda marca cartas da mão com alguma conversão legal. Selecionar uma carta destaca seus alvos na mesa; escolher uma casa restringe esses alvos às conversões possíveis naquela posição. O cálculo usa as mesmas opções legais do motor, incluindo variante da última carta, hipótese da primeira jogada e máscara.
- Converter conclui a jogada quando há casa e alvo definidos. Com um único alvo na casa escolhida, o botão da barra o resolve diretamente. Com vários alvos, o jogador escolhe qual e essa escolha conclui a conversão. É possível escolher o alvo antes da casa: a escolha da casa conclui a jogada. Não há outro OK de conversão. A colocação normal mantém seu OK.
- Cartas, gemas e mão ocupam menos altura. Em telas largas, a barra fica ao lado da mão. Em telas estreitas ela fica logo abaixo. Os controles de uma carta em interação podem reservar espaço adicional no tabuleiro de seis colunas para manter as duas gemas visíveis.

Validação: 24 testes de regras, geração, pontuação, ajuda e ciclo do computador. No Chrome, foram conferidos conversão pela barra e pelas cartas, alvo único/múltiplo, escolha de alvo antes da casa, ausência de confirmação adicional, abertura/fechamento do painel, placar fixo, desenhos que pontuam e proporção das gemas. Revisão nas larguras 320, 390, 768 e 1100 pixels, incluindo seis colunas. Ambos os níveis do computador continuam completando partidas. Resultados em `reports/validation.json`.

Motor de regras, distribuição e formato das partidas salvas permanecem compatíveis. As alterações desta revisão ficam no projeto GEMAS.
