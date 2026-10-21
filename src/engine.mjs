import {RULES_VERSION,GENERATOR_VERSION,OWNERS,COLOR_IDS,normalizeConfig,copy,demand,other,adjacent,components} from './config.mjs';
import {generateDeck,validateCards} from './generator.mjs';
import {randomFrom,shuffle} from './random.mjs';

export const cardById=(state,id)=>state.cards[id-1];
export const attributes=(state,id,kind)=>cardById(state,id).gems.map(g=>g[kind]);
export function assertState(state) {
  demand(state?.format==='GEMAS-STATE'&&state.rulesVersion===RULES_VERSION&&state.generatorVersion===GENERATOR_VERSION,'Partida de GEMAS ou versão incompatível.');
  const config=normalizeConfig(state.config);
  demand(JSON.stringify(config)===JSON.stringify(state.config)&&OWNERS.includes(state.config.opener),'Configuração da partida inválida.');
  demand(typeof state.seed==='string'&&state.seed.length>0&&state.seed.length<=200,'Semente inválida.');
  validateCards(state.cards,config);
  demand(['abertura','jogando','finalizada'].includes(state.phase)&&OWNERS.includes(state.current),'Fase ou posse inválida.');
  demand(Number.isInteger(state.turn)&&state.turn>=0&&Array.isArray(state.history),'Histórico inválido.');
  demand(Array.isArray(state.board)&&state.board.length===config.rows*config.columns,'Geometria divergente.');
  demand(Array.isArray(state.deck)&&OWNERS.every(p=>Array.isArray(state.hands?.[p])&&state.hands[p].length<=4&&Number.isInteger(state.moves?.[p])&&state.moves[p]>=0),'Mãos, monte ou contagem de jogadas inválidos.');
  const ids=[...state.deck,...OWNERS.flatMap(p=>state.hands[p])];
  state.board.forEach((cell,i)=>{if(cell!==null){demand(cell&&Number.isInteger(cell.id)&&OWNERS.includes(cell.owner)&&config.active.includes(i),'Carta fora de casa ativa ou posse inválida.');ids.push(cell.id);}});
  demand(ids.length===state.cards.length&&new Set(ids).size===ids.length&&ids.every(id=>Number.isInteger(id)&&id>=1&&id<=state.cards.length),'Carta perdida, duplicada ou desconhecida.');
  const full=config.active.every(i=>state.board[i]),empty=OWNERS.every(p=>!state.hands[p].length);
  if(state.phase==='abertura')demand(state.board.every(c=>c===null)&&state.turn===0&&state.current===other(config.opener)&&OWNERS.every(p=>state.hands[p].length===4),'Abertura inconsistente.');
  if(state.phase==='jogando')demand(!full&&!empty&&state.hands[state.current].length>0&&state.endReason===null,'Partida sem próximo jogador legal.');
  if(state.phase==='finalizada')demand((full&&state.endReason==='tabuleiro-cheio')||(!full&&empty&&state.endReason==='maos-vazias'),'Fim de partida inconsistente.');
  return true;
}
export function score(state) {
  const result={};
  for(const owner of OWNERS){const indices=state.board.flatMap((cell,i)=>cell?.owner===owner?[i]:[]),chains=[];
    for(const kind of ['color','shape'])for(const value of kind==='color'?COLOR_IDS.slice(0,state.config.colors):Array.from({length:state.config.shapes},(_,i)=>i+1)){
      const eligible=indices.filter(i=>attributes(state,state.board[i].id,kind).includes(value));
      for(const positions of components(eligible,state.config.columns))if(positions.length>=3)chains.push({kind,value,positions,points:positions.length});
    }
    const colorPoints=chains.filter(c=>c.kind==='color').reduce((n,c)=>n+c.points,0),shapePoints=chains.filter(c=>c.kind==='shape').reduce((n,c)=>n+c.points,0);
    const perCard=indices.map(position=>({position,id:state.board[position].id,points:chains.filter(c=>c.positions.includes(position)).length}));
    result[owner]={colorPoints,shapePoints,total:colorPoints+shapePoints,chains,perCard};
  }
  return {...result,winner:result.branco.total===result.preto.total?'empate':result.branco.total>result.preto.total?'branco':'preto'};
}
export function newGame(seed,input={}) {
  const config=normalizeConfig(input);
  if(config.opener==='sorteio')config.opener=shuffle(OWNERS,randomFrom(`${seed}:opener`))[0];
  const generated=generateDeck(seed,config),deck=shuffle(generated.cards.map(c=>c.id),randomFrom(`${seed}:shuffle`)),hands={branco:[],preto:[]};
  for(let i=0;i<4;i++)for(const p of OWNERS)hands[p].push(deck.shift());
  const state={format:'GEMAS-STATE',rulesVersion:RULES_VERSION,generatorVersion:GENERATOR_VERSION,seed,config,cards:generated.cards,board:Array(config.rows*config.columns).fill(null),hands,deck,phase:'abertura',current:other(config.opener),turn:0,moves:{branco:0,preto:0},endReason:null,history:[]};
  assertState(state);return state;
}
// The two colors of the target must be covered by two different allied cards.
// Shapes and scoring components do not participate in conversion eligibility.
export function checkMove(state,action) {
  demand(action&&typeof action==='object','Selecione uma jogada.');
  if(action.type==='opening'){
    demand(state.phase==='abertura','A abertura já foi realizada.');
    demand(OWNERS.includes(action.firstOwner),'Escolha quem terá a carta A.');
    return {ok:true,coverage:[],reason:'Posse das duas cartas de abertura escolhida.'};
  }
  demand(state.phase==='jogando','A partida não está em fase de jogadas.');
  demand(action.type==='move'&&['normal','converter'].includes(action.mode),'Jogada inválida.');
  demand(action.source===undefined||action.source==='mao','Somente cartas da mão podem ser jogadas.');
  demand(Number.isInteger(action.position)&&state.config.active.includes(action.position)&&!state.board[action.position],'Escolha uma casa ativa livre.');
  demand(state.hands[state.current].includes(action.cardId),'Escolha uma carta da sua mão.');
  if(action.mode==='normal')return {ok:true,coverage:[],reason:'Colocação normal; compra uma carta do monte.'};
  demand(state.config.allowLastConversion||state.hands[state.current].length>1,'A última carta da mão não pode converter nesta partida.');
  demand(!state.config.blockFirstConversion||state.moves[state.current]>0,'A primeira jogada deste jogador não permite conversão.');
  const target=state.board[action.target];
  demand(Number.isInteger(action.target)&&target&&target.owner!==state.current,'Escolha uma carta adversária como alvo.');
  demand(adjacent(action.position,action.target,state.config.columns),'A carta nova precisa ser vizinha do alvo.');
  const colors=attributes(state,target.id,'color'),newColors=attributes(state,action.cardId,'color');
  demand(newColors.some(c=>colors.includes(c)),'A carta nova precisa cobrir uma das cores do alvo.');
  for(const color of colors.filter(c=>newColors.includes(c))){const remaining=colors.find(c=>c!==color);
    const oldPosition=state.board.findIndex((cell,i)=>cell?.owner===state.current&&adjacent(i,action.target,state.config.columns)&&attributes(state,cell.id,'color').includes(remaining));
    if(oldPosition>=0)return {ok:true,reason:'Carta nova e apoio antigo cobrem as duas cores; sem compra.',coverage:[{role:'nova',position:action.position,id:action.cardId,color},{role:'antiga',position:oldPosition,id:state.board[oldPosition].id,color:remaining}]};
  }
  throw new Error('Falta outra carta sua, já no tabuleiro e vizinha do alvo, com a outra cor.');
}
export function legal(state,action){try{assertState(state);return checkMove(state,action);}catch(e){return {ok:false,reason:e.message};}}
export function conversionOptions(state,cardId,position) {
  if(state.phase!=='jogando')return [];
  return state.board.flatMap((cell,target)=>{
    if(!cell||cell.owner===state.current||!adjacent(position,target,state.config.columns))return [];
    const action={type:'move',mode:'converter',cardId,position,target};
    try{return [{target,action,...checkMove(state,action)}];}catch{return [];}
  });
}
export function legalActions(state) {
  if(state.phase==='finalizada')return [];
  if(state.phase==='abertura')return OWNERS.map(firstOwner=>({type:'opening',firstOwner}));
  return state.config.active.filter(i=>!state.board[i]).flatMap(position=>state.hands[state.current].flatMap(cardId=>[{type:'move',mode:'normal',cardId,position},...conversionOptions(state,cardId,position).map(o=>o.action)]));
}
export function dispatch(state,action,{validate=true}={}) {
  if(validate)assertState(state);const check=checkMove(state,action),next=copy(state),owner=state.current;
  if(action.type==='opening'){
    const [a,b]=next.config.positions;next.board[a]={id:next.deck.shift(),owner:action.firstOwner};next.board[b]={id:next.deck.shift(),owner:other(action.firstOwner)};
    next.current=next.config.opener;next.phase='jogando';next.turn=1;
    if(next.config.active.every(i=>next.board[i])){next.phase='finalizada';next.endReason='tabuleiro-cheio';}
    next.history.push({type:'opening',owner,firstOwner:action.firstOwner,positions:[a,b],reason:check.reason,score:score(next)});
  }else{
    next.board[action.position]={id:action.cardId,owner};next.hands[owner].splice(next.hands[owner].indexOf(action.cardId),1);
    const converted=action.mode==='converter'?copy(next.board[action.target]):null;
    if(converted)next.board[action.target].owner=owner;
    else if(next.deck.length)next.hands[owner].push(next.deck.shift());
    next.moves[owner]++;next.turn++;
    const full=next.config.active.every(i=>next.board[i]),empty=OWNERS.every(p=>!next.hands[p].length);
    next.endReason=full?'tabuleiro-cheio':empty?'maos-vazias':null;next.phase=next.endReason?'finalizada':'jogando';next.current=other(owner);
    next.history.push({type:'move',owner,action:copy(action),converted,coverage:check.coverage,reason:check.reason,score:score(next)});
    if(!next.endReason&&!next.hands[next.current].length){next.history.push({type:'pass',owner:next.current,reason:'Mão vazia; passagem automática.'});next.current=owner;}
  }
  if(validate)assertState(next);return next;
}
