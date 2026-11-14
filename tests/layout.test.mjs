import test from 'node:test';
import assert from 'node:assert/strict';
import {boardLayout,neighborSlot} from '../src/layout.mjs';
import {normalizeConfig,adjacent} from '../src/config.mjs';
import {newGame,dispatch,legalActions,score} from '../src/engine.mjs';
import {moveSummary} from '../src/game-view.mjs';

const slotsAdjacent=(layout,a,b)=>a!==b&&Math.abs(Math.floor(a/layout.columns)-Math.floor(b/layout.columns))<=1&&Math.abs(a%layout.columns-b%layout.columns)<=1;

test('6×4 é o 4×6 transposto só na apresentação: mesmas casas, mesmos vizinhos',()=>{
  for(const columns of [4,6])for(const tall of [false,true]){
    const config=normalizeConfig({columns}),layout=boardLayout(config,tall),cells=config.rows*config.columns;
    assert.equal(layout.transposed,tall&&columns===6);
    assert.deepEqual([layout.rows,layout.columns],layout.transposed?[6,4]:[4,columns]);
    assert.deepEqual([...layout.order].sort((a,b)=>a-b),Array.from({length:cells},(_,i)=>i),'cada casa do motor aparece uma única vez');
    for(let a=0;a<cells;a++){
      assert.equal(layout.order[layout.slotOf.get(a)],a);
      for(let b=0;b<cells;b++)assert.equal(slotsAdjacent(layout,layout.slotOf.get(a),layout.slotOf.get(b)),adjacent(a,b,columns),`vizinhança de ${a} e ${b}`);
    }
  }
});

test('casas de abertura continuam centrais no 6×4 e os rótulos seguem a tela',()=>{
  const config=normalizeConfig({columns:6}),tall=boardLayout(config,true),wide=boardLayout(config,false);
  assert.deepEqual(config.positions.map(i=>tall.place(i)),[{row:3,column:2},{row:4,column:3}]);
  assert.deepEqual(config.positions.map(i=>wide.place(i)),[{row:2,column:3},{row:3,column:4}]);
  assert.equal(tall.label(5),'linha 6, coluna 1');assert.equal(wide.label(5),'linha 1, coluna 6');
  assert.equal(neighborSlot(tall,0,-1,0),null);assert.equal(neighborSlot(tall,0,1,0),1);assert.equal(neighborSlot(tall,0,0,1),4);assert.equal(neighborSlot(tall,23,0,1),null);
});

test('a transposição não muda regras: jogadas legais e pontos independem da apresentação',()=>{
  let state=newGame('GEMAS-LAYOUT',{columns:6,colors:3,shapes:3});
  const tall=boardLayout(state.config,true);
  while(state.phase!=='finalizada'){
    const actions=legalActions(state);
    // Choosing by screen slot instead of engine index only reorders the same legal set.
    const viaScreen=actions.filter(a=>a.type!=='move'||tall.slotOf.has(a.position)).length;
    assert.equal(viaScreen,actions.length);
    state=dispatch(state,actions.find(a=>a.mode==='converter')||actions[0]);
  }
  assert.equal(score(state).winner,score(structuredClone(state)).winner);
});

test('resumo da jogada descreve colocação, compra, conversão, ganho e fim sem alterar estados',()=>{
  let state=newGame('GEMAS-RESUMO',{colors:2,shapes:2}),conversions=0,draws=0,passes=0;
  while(state.phase!=='finalizada'){
    const actions=legalActions(state),action=actions.find(a=>a.mode==='converter')||actions[0],frozen=JSON.stringify(state),next=dispatch(state,action),summary=moveSummary(state,next);
    assert.equal(JSON.stringify(state),frozen);
    assert.equal(summary.owner,state.current);assert.equal(summary.finished,next.phase==='finalizada');
    assert.deepEqual(summary.after,{branco:score(next).branco.total,preto:score(next).preto.total});
    if(action.type==='opening'){assert.equal(summary.type,'opening');assert.deepEqual(summary.positions,state.config.positions);}
    else{
      assert.equal(summary.position,action.position);assert.equal(summary.cardId,action.cardId);
      assert.equal(summary.gain,summary.after[summary.owner]-summary.before[summary.owner]);
      if(action.mode==='converter'){conversions++;assert.equal(summary.converted,action.target);assert.equal(summary.drew,null);assert.equal(next.board[action.target].owner,summary.owner);}
      else{assert.equal(summary.converted,null);if(summary.drew!==null){draws++;assert.ok(next.hands[summary.owner].includes(summary.drew));assert.equal(state.deck[0],summary.drew);}}
      for(const position of summary.glow)assert.equal(next.board[position].owner,summary.owner);
      if(summary.gain>0)assert.ok(summary.glow.includes(action.position)||summary.glow.includes(action.target));
    }
    if(summary.passed)passes++;
    state=next;
  }
  assert.ok(conversions>0&&draws>0);assert.equal(moveSummary(state,state),null);
});
