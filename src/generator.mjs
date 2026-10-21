import {randomFrom,shuffle} from './random.mjs';
import {normalizeConfig,COLOR_IDS,GENERATOR_VERSION,demand} from './config.mjs';
export const gemId=gem=>`${gem.color}${gem.shape}`;
export const cardType=gems=>gems.map(gemId).sort().join('-');
const spread=values=>Math.max(...values)-Math.min(...values);

// A capacitated bipartite flow distributes the remainder. Every gem occurs q or
// q+1 times, while both row/color and column/shape totals differ by at most one.
function balancedGems(config,random) {
  const {colors:C,shapes:S}=config,M=2*(config.active.length+8),q=Math.floor(M/(C*S)),rest=M%(C*S);
  const row=Array(C).fill(Math.floor(rest/C)),col=Array(S).fill(Math.floor(rest/S));
  for(const i of shuffle(row.map((_,i)=>i),random).slice(0,rest%C))row[i]++;
  for(const j of shuffle(col.map((_,j)=>j),random).slice(0,rest%S))col[j]++;
  const end=C+S+1,size=end+1,capacity=Array.from({length:size},()=>Array(size).fill(0));
  const order=Array.from({length:size},()=>shuffle(Array.from({length:size},(_,i)=>i),random));
  for(let i=0;i<C;i++){capacity[0][1+i]=row[i];for(let j=0;j<S;j++)capacity[1+i][1+C+j]=1;}
  for(let j=0;j<S;j++)capacity[1+C+j][end]=col[j];
  let flow=0;
  while(flow<rest){const parent=Array(size).fill(-1),queue=[0];parent[0]=0;
    for(let k=0;k<queue.length&&parent[end]===-1;k++)for(const to of order[queue[k]])if(parent[to]===-1&&capacity[queue[k]][to]>0){parent[to]=queue[k];queue.push(to);}
    demand(parent[end]!==-1,'Não foi possível equilibrar as gemas.');
    for(let to=end;to!==0;to=parent[to]){capacity[parent[to]][to]--;capacity[to][parent[to]]++;}flow++;
  }
  return Array.from({length:C*S},(_,i)=>({color:COLOR_IDS[Math.floor(i/S)],shape:i%S+1,count:q+capacity[1+C+i%S][1+Math.floor(i/S)]}));
}
function pairGems(entries,config,random) {
  const counts=entries.map(g=>g.count),N=config.active.length+8;
  const types=config.colors*(config.colors-1)*config.shapes*(config.shapes-1)/2;
  const limit=Math.ceil(N/types),uses=new Map(),pairs=[];
  const compatible=entries.map(a=>entries.flatMap((b,j)=>a.color!==b.color&&a.shape!==b.shape?[j]:[]));
  const rank=shuffle(entries.map((_,i)=>i),random),tie=new Map(rank.map((v,i)=>[v,i]));
  let nodes=0;
  function search(left) {
    if(!left)return true;
    if(++nodes>60000)return false;
    const present=rank.filter(i=>counts[i]);
    // Necessary matching conditions prune dead ends before another pair is made.
    for(const key of ['color','shape']){
      const totals=new Map();for(const i of present)totals.set(entries[i][key],(totals.get(entries[i][key])||0)+counts[i]);
      if([...totals.values()].some(n=>n>left/2))return false;
    }
    let chosen=-1,options=null;
    for(const i of present){const opts=compatible[i].filter(j=>counts[j]&&(uses.get(cardType([entries[i],entries[j]]))||0)<limit);
      if(!opts.length)return false;
      if(options===null||opts.length<options.length||(opts.length===options.length&&counts[i]>counts[chosen])){chosen=i;options=opts;}
    }
    options.sort((a,b)=>(uses.get(cardType([entries[chosen],entries[a]]))||0)-(uses.get(cardType([entries[chosen],entries[b]]))||0)||counts[b]-counts[a]||tie.get(a)-tie.get(b));
    counts[chosen]--;
    for(const j of options){const key=cardType([entries[chosen],entries[j]]),used=uses.get(key)||0;counts[j]--;uses.set(key,used+1);pairs.push([chosen,j]);
      if(search(left-2))return true;
      pairs.pop();counts[j]++;uses.set(key,used);
    }
    counts[chosen]++;return false;
  }
  return search(N*2)?pairs.map(pair=>pair.map(i=>({color:entries[i].color,shape:entries[i].shape}))):null;
}
export function analyzeDeck(cards,config) {
  const colors=Object.fromEntries(COLOR_IDS.slice(0,config.colors).map(c=>[c,0])),shapes=Object.fromEntries(Array.from({length:config.shapes},(_,i)=>[i+1,0]));
  const gems=Object.fromEntries(Object.keys(colors).flatMap(c=>Object.keys(shapes).map(s=>[c+s,0]))),types={};
  for(const card of cards){types[card.type]=(types[card.type]||0)+1;for(const gem of card.gems){colors[gem.color]++;shapes[gem.shape]++;gems[gemId(gem)]++;}}
  return {cards:cards.length,gemSlots:2*cards.length,colors,shapes,gems,uniqueGems:Object.values(gems).filter(Boolean).length,repeatedGems:Object.values(gems).reduce((n,v)=>n+Math.max(0,v-1),0),repeatedCards:cards.length-Object.keys(types).length,maxGemCopies:Math.max(...Object.values(gems)),maxCardCopies:Math.max(...Object.values(types)),colorSpread:spread(Object.values(colors)),shapeSpread:spread(Object.values(shapes)),gemSpread:spread(Object.values(gems))};
}
export function validateCards(cards,config) {
  demand(Array.isArray(cards)&&cards.length===config.active.length+8,'Quantidade de cartas incompatível com as casas ativas + 8.');
  demand(new Set(cards.map(c=>c?.id)).size===cards.length&&cards.every((c,i)=>c.id===i+1),'Identificações de carta inválidas.');
  for(const card of cards){const g=card.gems;demand(Array.isArray(g)&&g.length===2&&g.every(x=>x&&COLOR_IDS.indexOf(x.color)>=0&&COLOR_IDS.indexOf(x.color)<config.colors&&Number.isInteger(x.shape)&&x.shape>=1&&x.shape<=config.shapes)&&g[0].color!==g[1].color&&g[0].shape!==g[1].shape,'Cada carta exige duas gemas de cores e formas distintas.');demand(card.type===cardType(g),'Tipo de carta divergente.');}
  const report=analyzeDeck(cards,config),types=config.colors*(config.colors-1)*config.shapes*(config.shapes-1)/2;
  demand(report.colorSpread<=1&&report.shapeSpread<=1&&report.gemSpread<=1,'Distribuição de gemas desequilibrada.');
  demand(report.maxCardCopies<=Math.ceil(cards.length/types),'Repetição de cartas além do limite.');
  return report;
}
export function generateDeck(seed,input={}) {
  demand(typeof seed==='string'&&seed.length>0&&seed.length<=200,'Informe uma semente de 1 a 200 caracteres.');
  const config=normalizeConfig(input);
  for(let attempt=0;attempt<16;attempt++){
    const random=randomFrom(`${seed}:composition:${GENERATOR_VERSION}:${JSON.stringify(config)}:${attempt}`),entries=balancedGems(config,random),pairs=pairGems(entries,config,random);
    if(!pairs)continue;
    const cards=shuffle(pairs,random).map((gems,i)=>({id:i+1,type:cardType(gems),gems})),report=validateCards(cards,config);
    return {version:GENERATOR_VERSION,cards,report};
  }
  throw new Error('Não foi possível parear a configuração com os limites de repetição. Escolha outra semente.');
}
