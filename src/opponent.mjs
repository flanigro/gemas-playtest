import {copy,other,OWNERS,adjacent,demand} from './config.mjs';
import {legalActions,dispatch,score,attributes} from './engine.mjs';
import {randomFrom,shuffle} from './random.mjs';
export const OPPONENT_VERSION='GEMAS-AI-1';
export function observeGame(state) {
  // Configuration is whitelisted by normalizeConfig: no seed, order or history.
  const {rulesVersion,generatorVersion,config,cards,board,hands,phase,current,turn,moves,endReason}=state;
  return copy({rulesVersion,generatorVersion,config,cards,board,hands,phase,current,turn,moves,endReason,deckCount:state.deck.length,...(phase==='abertura'?{opening:state.deck.slice(0,2)}:{})});
}
function worldFrom(observation,sample=0) {
  const visible=[...observation.board.filter(Boolean).map(c=>c.id),...OWNERS.flatMap(p=>observation.hands[p]),...(observation.opening||[])];
  const unseen=observation.cards.map(c=>c.id).filter(id=>!visible.includes(id));
  const publicKey=JSON.stringify([observation.board,observation.hands,observation.turn,observation.current,sample]);
  const deck=[...(observation.opening||[]),...shuffle(unseen,randomFrom(publicKey))];
  demand(deck.length===observation.deckCount,'Observação pública inconsistente.');
  return {format:'GEMAS-STATE',...copy(observation),seed:'public-information',deck,history:[]};
}
function evaluate(state,owner) {
  const points=score(state),margin=points[owner].total-points[other(owner)].total;
  if(state.phase==='finalizada')return margin*100;
  const potential=side=>{
    const own=state.board.flatMap((c,p)=>c?.owner===side?[{...c,p}]:[]);let value=0;
    for(let i=0;i<own.length;i++)for(let j=i+1;j<own.length;j++)if(adjacent(own[i].p,own[j].p,state.config.columns))for(const kind of ['color','shape'])value+=attributes(state,own[i].id,kind).filter(a=>attributes(state,own[j].id,kind).includes(a)).length*.09;
    return value;
  };
  return margin+potential(owner)-potential(other(owner))+(state.hands[owner].length-state.hands[other(owner)].length)*.18;
}
export function chooseAction(observation,{difficulty='beginner',shortlist=4,samples=2}={}) {
  demand(['beginner','experienced'].includes(difficulty),'Nível inválido.');
  const worlds=Array.from({length:difficulty==='experienced'?Math.max(1,Math.min(3,samples)):1},(_,i)=>worldFrom(observation,i)),state=worlds[0],owner=state.current,actions=legalActions(state);
  if(!actions.length)return {action:null,version:OPPONENT_VERSION,reason:'Partida encerrada.',alternatives:[],candidates:0,replies:0};
  const baseline=score(state)[owner].total;
  const ranked=actions.map((action,index)=>{
    const next=dispatch({...state,history:[]},action,{validate:false});
    let value=worlds.reduce((sum,w)=>sum+evaluate(dispatch({...w,history:[]},action,{validate:false}),owner),0)/worlds.length;
    if(difficulty==='beginner')value=score(next)[owner].total-baseline+(value-(score(next)[owner].total-score(next)[other(owner)].total))*.35;
    return {action,index,value,immediate:score(next)[owner].total-baseline};
  }).sort((a,b)=>b.value-a.value||a.index-b.index);
  let replies=0,considered=ranked;
  if(difficulty==='experienced'&&state.phase!=='abertura'){
    considered=ranked.slice(0,Math.max(1,shortlist));
    for(const candidate of considered){let sum=0;
      for(const world of worlds){const next=dispatch({...world,history:[]},candidate.action,{validate:false});
        if(next.phase==='finalizada'){sum+=evaluate(next,owner);continue;}
        const responses=legalActions(next);let best=next.current===owner?-Infinity:Infinity;
        for(const action of responses){const value=evaluate(dispatch({...next,history:[]},action,{validate:false}),owner);best=next.current===owner?Math.max(best,value):Math.min(best,value);replies++;}
        sum+=Number.isFinite(best)?best:evaluate(next,owner);
      }
      candidate.value=sum/worlds.length;
    }
    considered.sort((a,b)=>b.value-a.value||a.index-b.index);
  }
  // Beginner occasionally picks a nearby legal alternative, deterministically.
  const near=considered.filter(c=>c.value>=considered[0].value-.8).slice(0,4),rng=randomFrom(JSON.stringify([state.board,state.hands,state.turn]));
  const best=difficulty==='beginner'&&state.phase!=='abertura'?near[Math.floor(rng()*near.length)]:considered[0];
  return {action:best.action,version:OPPONENT_VERSION,candidates:actions.length,replies,reason:difficulty==='beginner'?'Pontos imediatos e conexões próximas.':'Saldo de pontos, respostas adversárias e compras possíveis.',information:'Somente tabuleiro, mãos abertas, composição e quantidade do monte. Ordem e semente não são fornecidas.',alternatives:[best,...considered.filter(c=>c!==best).slice(0,2)].map(c=>({action:c.action,value:Number(c.value.toFixed(3)),immediate:c.immediate}))};
}
