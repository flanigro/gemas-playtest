// Primeira partida guiada. Usa o motor de verdade, com semente e jogadas fixas:
// nada aqui muda regras; tests/tutorial.test.mjs confere cada passo contra o motor.
const place=(cardId,position)=>({type:'move',mode:'normal',cardId,position});
export const TUTORIAL=Object.freeze({
  seed:'GEMAS-TUTORIAL-12',
  config:Object.freeze({columns:4,colors:4,shapes:4,opener:'preto'}),
  human:'branco',
  steps:Object.freeze([
    {type:'info',text:'Bem-vindo ao GEMAS. Você joga com as cartas brancas e o computador, com as pretas. Cada carta tem duas gemas, e cada gema tem uma cor e uma forma.'},
    {type:'human',action:{type:'opening',firstOwner:'branco'},text:'Abertura: duas cartas entram no centro. Uma fica com você e a outra com o Preto. Toque na carta destacada e toque de novo para confirmar.'},
    {type:'computer',action:place(11,6),text:'O Preto começa. Acompanhe a jogada dele.'},
    {type:'human',action:place(3,1),text:'Sua vez. Toque na carta destacada da sua mão e depois na casa marcada, acima da sua carta. Toque de novo na casa para confirmar.'},
    {type:'info',text:'As duas cartas se ligaram pela gema amarela. Uma dupla ainda não pontua: o grupo precisa de três cartas. Como você só colocou, comprou uma carta do monte.'},
    {type:'computer',action:place(1,13),text:'Agora o Preto joga.'},
    {type:'human',action:place(22,8),text:'Feche o trio amarelo: jogue a carta destacada na casa marcada. As ligações valem pelos lados e pelas diagonais.'},
    {type:'info',text:'Três cartas suas ligadas pela mesma cor valem 1 ponto cada: 3 pontos. Formas iguais pontuam do mesmo jeito, e uma carta pode pontuar em mais de um grupo.'},
    {type:'computer',action:place(24,12),text:'Vez do Preto.'},
    {type:'human',action:{type:'move',mode:'converter',cardId:9,position:9,target:13},text:'Hora de converter. A carta preta destacada tem verde e amarelo. Sua carta nova tem verde, e a sua vizinha no tabuleiro tem amarelo. Jogue na casa marcada e toque na carta preta para converter.'},
    {type:'info',text:'A carta virou sua e entrou nos seus grupos: o placar subiu de 3 para 8. Quem converte não compra carta, por isso sua mão ficou com três.'},
    {type:'info',last:true,text:'Você já sabe o essencial. Lembre: a primeira jogada de cada jogador não converte, e a última carta adversária no tabuleiro é protegida. Vence quem tiver mais pontos no fim.'}
  ])
});
export function tutorialSetup() {
  return {seed:TUTORIAL.seed,config:{...TUTORIAL.config},players:{branco:'human',preto:'computer'},difficulty:'beginner',tutorial:true};
}
