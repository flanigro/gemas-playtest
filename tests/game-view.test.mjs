import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,dispatch,legalActions,score,attributes} from '../src/engine.mjs';
import {OWNERS,adjacent} from '../src/config.mjs';
import {scoreTableData,boardConnections,conversionMoves} from '../src/game-view.mjs';
import {OpponentController} from '../src/opponent-controller.mjs';

test('tabela por símbolo acompanha configurações variáveis e soma os mesmos pontos do motor',()=>{
  for(const colors of [2,4,8])for(const shapes of [2,5,8]){
    let state=newGame(`table-${colors}-${shapes}`,{colors,shapes,columns:6});
    while(state.phase!=='finalizada'){
      const groups=scoreTableData(state),points=score(state);
      assert.equal(groups[0].values.length,colors);assert.equal(groups[1].values.length,shapes);
      for(const group of groups)for(const row of group.rows){
        assert.equal(Object.values(row.points).reduce((a,b)=>a+b,0),row.total);
        for(const value of group.values)assert.equal(row.points[value]||0,points[row.owner].chains.filter(c=>c.kind===group.kind&&c.value===value).reduce((sum,c)=>sum+c.points,0));
      }
      state=dispatch(state,legalActions(state).at(-1));
    }
  }
});

test('ligações usam gemas vizinhas da mesma posse, sem atravessar máscaras nem emendar linhas',()=>{
  const state=newGame('connections',{colors:2,shapes:2,active:[0,1,2,3,4,7,8,9,10,11]});
  state.board=Array(16).fill(null);
  // All these cards have A/B and forms 1/2 in this configuration.
  for(const [position,id,owner] of [[0,1,'branco'],[1,2,'branco'],[2,3,'branco'],[3,4,'preto'],[4,5,'preto'],[7,6,'preto'],[9,7,'branco'],[10,8,'branco']])state.board[position]={id,owner};
  const links=boardConnections(state);
  assert.ok(links.length>0);assert.ok(links.every(l=>l.scoring));
  assert.ok(links.every(l=>l.from<3&&l.to<3),'Pairs never draw a line.');
  for(const l of links){
    assert.ok(adjacent(l.from,l.to,4));assert.ok(state.config.active.includes(l.from)&&state.config.active.includes(l.to));
    assert.equal(state.board[l.from].owner,l.owner);assert.equal(state.board[l.to].owner,l.owner);
    assert.ok(attributes(state,state.board[l.from].id,l.kind).includes(l.value));assert.ok(attributes(state,state.board[l.to].id,l.kind).includes(l.value));
    assert.notDeepEqual([l.from,l.to],[3,4]);
  }
  for(const owner of OWNERS)for(const kind of ['color','shape'])for(const value of kind==='color'?['A','B']:[1,2]){
    const group=links.filter(l=>l.owner===owner&&l.kind===kind&&l.value===value);
    assert.equal(group.length,owner==='branco'?2:0,'Only scoring components have a spanning tree.');
  }
});

test('ajuda de conversão coincide com jogadas legais para cada carta, casa e alvo',()=>{
  for(const allowLastConversion of [false,true]){
    let state=newGame(`hints-${allowLastConversion}`,{colors:2,shapes:2,allowLastConversion,active:[0,1,2,4,5,6,9,10,11,12,13,14]});
    state=dispatch(state,{type:'opening',firstOwner:'branco'});
    while(state.phase!=='finalizada'){
      const actions=legalActions(state),conversions=actions.filter(a=>a.mode==='converter');
      for(const id of [...state.hands[state.current],999]){
        const hints=conversionMoves(state,id);
        assert.deepEqual(hints.map(h=>h.action),conversions.filter(a=>a.cardId===id));
        for(const hint of hints){
          assert.ok(conversionMoves(state,id,{position:hint.action.position,target:hint.target}).some(o=>JSON.stringify(o.action)===JSON.stringify(hint.action)));
          assert.ok(hint.coverage.some(c=>c.role==='nova')&&hint.coverage.some(c=>c.role==='antiga'));
        }
        assert.deepEqual(conversionMoves(state,id,{position:state.config.active.find(i=>state.board[i])}),[]);
      }
      state=dispatch(state,conversions[0]||actions[0]);
    }
    assert.deepEqual(conversionMoves(state,state.hands[state.current][0]),[]);
  }
});

test('computador calcula sem Worker, e cancelar impede a jogada alternativa',async()=>{
  const delivered=[],errors=[];
  const controller=new OpponentController({workerFactory:()=>{throw Error('Worker indisponível');},fallback:message=>({action:message}),onResult:(result,key)=>delivered.push([result,key]),onError:error=>errors.push(error)});
  controller.start('cancelada',{id:1});controller.cancel();
  controller.start('válida',{id:2});
  await new Promise(resolve=>setTimeout(resolve,60));
  assert.deepEqual(delivered,[[{action:{id:2}},'válida']]);assert.deepEqual(errors,[]);
});

test('erro assíncrono e demora no Worker acionam a alternativa uma vez',async()=>{
  for(const failure of ['error','timeout']){
    const delivered=[],errors=[];let worker,calls=0;
    const controller=new OpponentController({timeout:5,workerFactory:()=>worker={postMessage(){},terminate(){}},fallback:()=>{calls++;return 'pronta';},onResult:x=>delivered.push(x),onError:x=>errors.push(x)});
    controller.start('estado',{});if(failure==='error'){worker.onerror({message:'Bloqueado',preventDefault(){}});worker.onmessage({data:{result:'atrasada'}});}
    await new Promise(resolve=>setTimeout(resolve,70));assert.equal(calls,1);assert.deepEqual(delivered,['pronta']);assert.deepEqual(errors,[]);
  }
});
