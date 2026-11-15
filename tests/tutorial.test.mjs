import test from 'node:test';
import assert from 'node:assert/strict';
import {TUTORIAL,tutorialSetup} from '../src/tutorial.mjs';
import {GameSession} from '../src/session.mjs';
import {legal,legalActions,score,cardById} from '../src/engine.mjs';
import {adjacent} from '../src/config.mjs';
import {conversionMoves,moveSummary} from '../src/game-view.mjs';
import {chooseAction,observeGame} from '../src/opponent.mjs';

const shapes=(state,id)=>cardById(state,id).gems.map(g=>g.shape);
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
  assert.equal(state.config.convertBy,'shape','o tutorial ensina a conversão padrão, por formas');
  assert.deepEqual(opening.positions,[5,10]);assert.equal(session.states[1].board[5].owner,'branco');
  // Dupla de quadrados (forma 2), ainda sem pontos, e compra.
  assert.ok(adjacent(1,5,4)&&shapes(state,state.board[1].id).includes(2)&&shapes(state,state.board[5].id).includes(2));
  assert.equal(first.gain,0);assert.notEqual(first.drew,null);
  // Sequência de três quadrados: +3, com uma ligação diagonal.
  assert.equal(trio.gain,3);assert.deepEqual(trio.glow,[0,1,5]);assert.deepEqual(trio.after,{branco:3,preto:0});
  // Conversão: nova cobre o círculo (1), antiga cobre o quadrado (2); sem compra; 3 → 8.
  const check=legal(session.states.at(-2),actions.at(-1).action);
  assert.deepEqual(check.coverage.map(c=>[c.role,c.position,c.kind,c.value]),[['nova',2,'shape',1],['antiga',1,'shape',2]]);
  assert.deepEqual(shapes(state,state.board[6].id).sort(),[1,2]);
  assert.equal(conversion.converted,6);assert.equal(conversion.drew,null);assert.deepEqual(conversion.after,{branco:8,preto:0});
  assert.equal(state.hands.branco.length,3);assert.equal(state.board[6].owner,'branco');
  // Depois do roteiro a partida segue normalmente contra o Iniciante.
  assert.equal(state.phase,'jogando');assert.equal(state.current,'preto');assert.ok(legalActions(state).length>0);
  const reply=chooseAction(observeGame(state),{difficulty:'beginner'});assert.equal(legal(state,reply.action).ok,true);
});
