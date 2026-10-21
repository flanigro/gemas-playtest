import {writeFile} from 'node:fs/promises';
import {newGame,dispatch,score,assertState} from '../src/engine.mjs';
import {chooseAction,observeGame} from '../src/opponent.mjs';
import {analyzeDeck} from '../src/generator.mjs';
const games=[];
for(const difficulty of ['beginner','experienced'])for(const columns of [4,6])for(const allowLastConversion of [false,true])for(let seed=0;seed<3;seed++){
  const colors=2+seed*2,shapes=2+seed*3,start=performance.now();let s=newGame(`GEMAS-SIM-${seed}`,{columns,colors,shapes,allowLastConversion});let commands=0;
  while(s.phase!=='finalizada'){
    const report=chooseAction(observeGame(s),{difficulty,shortlist:3,samples:2});
    if(!report.action)throw Error('Partida travada.');s=dispatch(s,report.action);assertState(s);
    if(++commands>s.config.active.length-1)throw Error('Partida não termina.');
  }
  const points=score(s),balance=analyzeDeck(s.cards,s.config);
  games.push({seed:s.seed,difficulty,columns,colors,shapes,allowLastConversion,endReason:s.endReason,occupied:s.board.filter(Boolean).length,commands,conversions:s.history.filter(e=>e.type==='move'&&e.action.mode==='converter').length,passes:s.history.filter(e=>e.type==='pass').length,winner:points.winner,branco:points.branco.total,preto:points.preto.total,repeatedCards:balance.repeatedCards,repeatedGems:balance.repeatedGems,ms:Math.round(performance.now()-start)});
  console.log(`${difficulty} 4×${columns} ${colors}/${shapes} última:${allowLastConversion}: ${points.branco.total} × ${points.preto.total}, ${s.endReason}`);
}
const summary={games:games.length,stuck:0,endings:Object.fromEntries(['tabuleiro-cheio','maos-vazias'].map(reason=>[reason,games.filter(g=>g.endReason===reason).length])),wins:Object.fromEntries(['branco','preto','empate'].map(p=>[p,games.filter(g=>g.winner===p).length]))};
await writeFile(new URL('../reports/simulation.json',import.meta.url),JSON.stringify({note:'Amostra exploratória; não comprova equilíbrio de posse, paletas ou níveis. Experiente usa três candidatas e duas compras hipotéticas nesta execução.',summary,games},null,2));
console.log(JSON.stringify(summary));
