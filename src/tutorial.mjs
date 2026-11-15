// Primeira partida guiada. Usa o motor de verdade, com semente e jogadas fixas:
// nada aqui muda regras; tests/tutorial.test.mjs confere cada passo contra o motor.
const place=(cardId,position)=>({type:'move',mode:'normal',cardId,position});
export const TUTORIAL=Object.freeze({
  seed:'GEMAS-TUTORIAL-5',
  config:Object.freeze({columns:4,colors:4,shapes:4,opener:'preto',convertBy:'shape'}),
  human:'branco',
  steps:Object.freeze([
    {type:'info',text:'Bem-vindo ao GEMAS. Você joga com as cartas brancas e o computador, com as pretas. Cada carta tem duas gemas, e cada gema tem uma forma e uma cor.'},
    {type:'human',action:{type:'opening',firstOwner:'branco'},text:'Abertura: duas cartas entram no centro. Uma fica com você e a outra com o Preto. Toque na carta destacada e toque de novo para confirmar.'},
    {type:'computer',action:place(13,6),text:'O Preto começa. Acompanhe a jogada dele.'},
    {type:'human',action:place(12,1),text:'Sua vez. Toque na carta destacada da sua mão e depois na casa marcada, acima da sua carta. Toque de novo na casa para confirmar.'},
    {type:'info',text:'As duas cartas se ligaram pelo quadrado. Uma dupla ainda não pontua: a sequência precisa de três cartas. Como você só colocou, comprou uma carta do monte.'},
    {type:'computer',action:place(18,13),text:'Agora o Preto joga.'},
    {type:'human',action:place(9,0),text:'Feche a sequência de quadrados: jogue a carta destacada na casa marcada. As ligações valem pelos lados e pelas diagonais.'},
    {type:'info',text:'Três cartas suas ligadas pela mesma forma valem 1 ponto cada: 3 pontos. Cores iguais pontuam do mesmo jeito, e uma carta pode estar em mais de uma sequência.'},
    {type:'computer',action:place(14,8),text:'Vez do Preto.'},
    {type:'human',action:{type:'move',mode:'converter',cardId:6,position:2,target:6},text:'Hora de converter. A carta preta destacada tem quadrado e círculo. Sua carta nova tem círculo, e a sua vizinha no tabuleiro tem quadrado. Jogue na casa marcada e toque na carta preta.'},
    {type:'info',text:'A carta virou sua e entrou nas suas sequências: o placar subiu de 3 para 8. Quem converte não compra carta, por isso sua mão ficou com três.'},
    {type:'info',last:true,text:'Pronto. Aqui as formas comandam a conversão; na nova partida você pode trocar para cores. A primeira jogada de cada um não converte, e a última carta adversária no tabuleiro fica protegida.'}
  ])
});
export function tutorialSetup() {
  return {seed:TUTORIAL.seed,config:{...TUTORIAL.config},players:{branco:'human',preto:'computer'},difficulty:'beginner',tutorial:true};
}
