import test from 'node:test';
import assert from 'node:assert/strict';
import {TUTORIAL,tutorialSetup} from '../src/tutorial.mjs';
import {GameSession} from '../src/session.mjs';
import {legal,legalActions,score,cardById} from '../src/engine.mjs';
import {adjacent} from '../src/config.mjs';
import {conversionMoves,moveSummary} from '../src/game-view.mjs';
import {chooseAction,observeGame} from '../src/opponent.mjs';

const colors=(state,id)=>cardById(state,id).gems.map(g=>g.color);
test('tutorial guiado: cada passo é uma jogada legal do motor e ensina o que o texto afirma',()=>{
  const session=new GameSession(tutorialSetup()),actions=TUTORIAL.steps.filter(step=>step.action);
  assert.equal(session.state.current,'branco','o humano escolhe a abertura');
  assert.equal(actions.length,7);assert.ok(TUTORIAL.steps.every(step=>typeof step.text==='string'&&step.text.length>=10&&step.text.length<=230));
  assert.equal(TUTORIAL.steps.at(-1).last,true);
  const summaries=[];
  for(const step of actions){
    const owner=session.state.current;
    assert.equal(owner,step.type==='human'?'branco':'preto',`vez de ${step.type}`);
    assert.equal(legal(session.state,step.action).ok,true,JSON.stringify(step.action));
    if(step.type==='human'&&step.action.mode==='normal')assert.equal(conversionMoves(session.state,step.action.cardId,{position:step.action.position}).length,0,'colocações guiadas não escondem uma conversão');
    const previous=session.state;session.dispatch(step.action);summaries.push(moveSummary(previous,session.state));
    assert.equal(score(session.state).preto.total,0,'o Preto não pontua durante o roteiro');
  }
  const [opening,,first,,trio,,conversion]=summaries,state=session.state;
  assert.deepEqual(opening.positions,[5,10]);assert.equal(session.states[1].board[5].owner,'branco');
  // Dupla amarela (C), ainda sem pontos, e compra.
  assert.ok(adjacent(1,5,4)&&colors(state,state.board[1].id).includes('C')&&colors(state,state.board[5].id).includes('C'));
  assert.equal(first.gain,0);assert.notEqual(first.drew,null);
  // Trio amarelo: +3, por diagonal.
  assert.equal(trio.gain,3);assert.deepEqual(trio.glow,[1,5,8]);assert.deepEqual(trio.after,{branco:3,preto:0});
  // Conversão: nova cobre verde (D), antiga cobre amarelo (C); sem compra; 3 → 8.
  const check=legal(session.states.at(-2),actions.at(-1).action);
  assert.deepEqual(check.coverage.map(c=>[c.role,c.position,c.color]),[['nova',9,'D'],['antiga',8,'C']]);
  assert.deepEqual(colors(state,state.board[13].id).sort(),['C','D']);
  assert.equal(conversion.converted,13);assert.equal(conversion.drew,null);assert.deepEqual(conversion.after,{branco:8,preto:0});
  assert.equal(state.hands.branco.length,3);assert.equal(state.board[13].owner,'branco');
  // Depois do roteiro a partida segue normalmente contra o Iniciante.
  assert.equal(state.phase,'jogando');assert.equal(state.current,'preto');assert.ok(legalActions(state).length>0);
  const reply=chooseAction(observeGame(state),{difficulty:'beginner'});assert.equal(legal(state,reply.action).ok,true);
});
