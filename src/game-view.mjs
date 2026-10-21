import {OWNERS,COLOR_IDS,adjacent} from './config.mjs';
import {conversionOptions,score} from './engine.mjs';

export const CONNECTION_COLORS=Object.freeze(['#d21f3c','#ee7b1e','#d19b00','#1f9d55','#2d6bd6','#7a3ec8','#e2479c','#1599a9']);

export function scoreTableData(state,points=score(state)) {
  return ['color','shape'].map(kind=>{
    const values=kind==='color'?COLOR_IDS.slice(0,state.config.colors):Array.from({length:state.config.shapes},(_,i)=>i+1);
    const rows=OWNERS.map(owner=>{
      const totals=Object.fromEntries(values.map(value=>[value,0]));
      for(const chain of points[owner].chains)if(chain.kind===kind)totals[chain.value]+=chain.points;
      return {owner,points:totals,total:points[owner][kind==='color'?'colorPoints':'shapePoints']};
    });
    return {kind,values,rows};
  });
}

// A spanning tree shows each connected group without drawing every redundant edge.
export function boardConnections(state) {
  const links=[],points=score(state);
  for(const owner of OWNERS)for(const {kind,value,positions:group} of points[owner].chains){
    const visited=new Set(group.slice(0,1)),pending=new Set(group.slice(1));
    while(pending.size){
      const candidates=[...visited].flatMap(from=>[...pending].filter(to=>adjacent(from,to,state.config.columns)).map(to=>({from,to,distance:Math.abs(Math.floor(from/state.config.columns)-Math.floor(to/state.config.columns))+Math.abs(from%state.config.columns-to%state.config.columns)}))).sort((a,b)=>a.distance-b.distance||a.from-b.from||a.to-b.to);
      const {from,to}=candidates[0];pending.delete(to);visited.add(to);
      links.push({owner,kind,value,from,to,scoring:group.length>=3});
    }
  }
  return links;
}

export function conversionMoves(state,cardId,{position=null,target=null}={}) {
  if(state.phase!=='jogando'||!state.hands[state.current].includes(cardId))return [];
  const positions=position===null?state.config.active.filter(i=>!state.board[i]):state.config.active.includes(position)&&!state.board[position]?[position]:[];
  return positions.flatMap(p=>conversionOptions(state,cardId,p)).filter(option=>target===null||option.target===target);
}
