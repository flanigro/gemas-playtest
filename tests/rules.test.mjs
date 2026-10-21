import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,dispatch,legal,legalActions,score,assertState,cardById} from '../src/engine.mjs';
import {generateDeck,analyzeDeck,cardType} from '../src/generator.mjs';
import {normalizeConfig,adjacent,RULES_VERSION} from '../src/config.mjs';
import {GameSession} from '../src/session.mjs';
import {observeGame,chooseAction} from '../src/opponent.mjs';
import {OpponentController} from '../src/opponent-controller.mjs';

test('geração balanceada em 1.470 configurações, com limite mínimo de duplicação',()=>{
  for(const columns of [4,6])for(let colors=2;colors<=8;colors++)for(let shapes=2;shapes<=8;shapes++)for(let seed=0;seed<15;seed++){
    const config=normalizeConfig({columns,colors,shapes}),{cards,report}=generateDeck(`matrix-${seed}`,config);
    assert.equal(cards.length,columns*4+8);assert.ok(report.colorSpread<=1&&report.shapeSpread<=1&&report.gemSpread<=1);
    const possible=colors*(colors-1)*shapes*(shapes-1)/2;
    assert.ok(report.maxCardCopies<=Math.ceil(cards.length/possible));
    if(colors*shapes>=cards.length*2)assert.equal(report.repeatedGems,0);
    if(possible>=cards.length)assert.equal(report.repeatedCards,0);
  }
});
test('semente reproduz cartas, abertura e distribuição; dados de entrada não mudam',()=>{
  const input={colors:3,shapes:7,columns:6},before=structuredClone(input);
  assert.deepEqual(newGame('same',input),newGame('same',input));assert.deepEqual(input,before);
  assert.notDeepEqual(newGame('same',input).cards,newGame('other',input).cards);
  const s=newGame('same',input);assert.equal(s.hands.branco.length,4);assert.equal(s.hands.preto.length,4);
  assert.equal(s.current,s.config.opener==='branco'?'preto':'branco');assert.equal(s.deck.length,24);
});
test('paletas independentes e máscaras usam casas ativas, sem aceitar posições inválidas',()=>{
  const active=[0,1,2,4,5,6,8,9,10],s=newGame('mask',{active,colors:2,shapes:8});
  assert.equal(s.cards.length,17);assert.equal(s.board.length,16);assert.deepEqual(s.config.positions,[5,10]);
  const n=dispatch(s,{type:'opening',firstOwner:'branco'});
  assert.equal(legal(n,{type:'move',mode:'normal',cardId:n.hands[n.current][0],position:15}).ok,false);
  for(const invalid of [{colors:1},{shapes:9},{active:[1,1]},{positions:[1,1]},{active:[3],columns:6}])assert.throws(()=>newGame('bad',invalid));
  assert.equal(adjacent(3,4,4),false);assert.equal(adjacent(0,5,4),true);
});
test('uma máscara de duas casas termina ao confirmar a própria abertura',()=>{
  const s=newGame('two-cells',{active:[0,5]}),n=dispatch(s,{type:'opening',firstOwner:'preto'});
  assertState(n);assert.equal(n.phase,'finalizada');assert.equal(n.endReason,'tabuleiro-cheio');assert.equal(legalActions(n).length,0);
});
function scoringFixture(pieces){
  return {config:{columns:4,colors:8,shapes:8},cards:pieces.map((p,i)=>({id:i+1,gems:p.gems})),board:Array.from({length:16},(_,position)=>{const i=pieces.findIndex(p=>p.position===position);return i<0?null:{id:i+1,owner:pieces[i].owner||'branco'};})};
}
const gems=[{color:'A',shape:1},{color:'B',shape:2}];
test('componentes de 1/2 não pontuam; 3/4/5/6 pontuam por cada atributo sem limite quatro',()=>{
  for(let n=1;n<=6;n++){const s=scoringFixture(Array.from({length:n},(_,i)=>({position:[0,1,5,6,10,11][i],gems}))),p=score(s).branco;
    assert.equal(p.total,n<3?0:4*n);assert.equal(p.colorPoints,n<3?0:2*n);assert.equal(p.shapePoints,n<3?0:2*n);
    assert.ok(p.perCard.every(c=>c.points===(n<3?0:4)));
  }
});
test('ciclos não multiplicam pontos e cartas sem atributo ou adversárias não fazem ponte',()=>{
  const cycle=scoringFixture([0,1,4,5].map(position=>({position,gems})));assert.equal(score(cycle).branco.total,16);
  const bridge=scoringFixture([{position:0,gems},{position:1,gems:[{color:'C',shape:3},{color:'D',shape:4}]},{position:2,gems}]);assert.equal(score(bridge).branco.total,0);
  const enemy=scoringFixture([0,1,2].map((position,i)=>({position,gems,owner:i===1?'preto':'branco'})));assert.equal(score(enemy).branco.total,0);
});
test('oráculo independente confere todos os atributos em tabuleiros aleatórios',()=>{
  for(let seed=0;seed<40;seed++){
    let s=dispatch(newGame('oracle-'+seed,{colors:2+seed%7,shapes:2+(seed*3)%7,columns:seed%2?6:4}),{type:'opening',firstOwner:'branco'});
    while(s.phase!=='finalizada')s=dispatch(s,legalActions(s)[seed%legalActions(s).length]);
    const actual=score(s);
    for(const owner of ['branco','preto']){let total=0;
      for(const kind of ['color','shape'])for(const value of new Set(s.cards.flatMap(c=>c.gems.map(g=>g[kind])))){
        const all=s.board.flatMap((cell,i)=>cell?.owner===owner&&cardById(s,cell.id).gems.some(g=>g[kind]===value)?[i]:[]),seen=new Set();
        for(const start of all)if(!seen.has(start)){const queue=[start];seen.add(start);
          for(let q=0;q<queue.length;q++)for(const candidate of all)if(!seen.has(candidate)&&Math.max(Math.abs(Math.floor(candidate/s.config.columns)-Math.floor(queue[q]/s.config.columns)),Math.abs(candidate%s.config.columns-queue[q]%s.config.columns))===1){seen.add(candidate);queue.push(candidate);}
          if(queue.length>=3)total+=queue.length;
        }
      }
      assert.equal(actual[owner].total,total);
    }
  }
});
function conversionFixture({last=false,allow=false,otherEmpty=false,loneEnemy=false}={}){
  let s=newGame('conversion-fixture',{colors:4,shapes:4,opener:'branco',allowLastConversion:allow});
  const target=s.cards[0],colors=target.gems.map(g=>g.color);
  const placed=s.cards.find(c=>c.id!==target.id&&c.gems.some(g=>g.color===colors[0]));
  const old=s.cards.find(c=>![target.id,placed.id].includes(c.id)&&c.gems.some(g=>g.color===colors[1]));
  s.phase='jogando';s.current='branco';s.turn=3;s.moves={branco:1,preto:1};s.board.fill(null);s.board[5]={id:target.id,owner:'preto'};s.board[4]={id:old.id,owner:'branco'};
  const rest=s.cards.map(c=>c.id).filter(id=>![target.id,placed.id,old.id].includes(id));
  if(!loneEnemy)s.board[15]={id:rest.shift(),owner:'preto'};
  s.hands={branco:[placed.id,...(last?[]:[rest.shift()])],preto:otherEmpty?[]:[rest.shift()]};s.deck=rest;
  assertState(s);return {s,a:{type:'move',mode:'converter',cardId:placed.id,position:1,target:5}};
}
test('conversão cobre duas cores com nova e antiga; conserva gemas e não compra',()=>{
  const {s,a}=conversionFixture(),before=structuredClone(s),check=legal(s,a);assert.equal(check.ok,true);assert.deepEqual(check.coverage.map(c=>c.role),['nova','antiga']);
  const n=dispatch(s,a);assert.equal(n.board[5].owner,'branco');assert.deepEqual(n.cards,s.cards);assert.deepEqual(n.deck,s.deck);assert.equal(n.hands.branco.length,1);assert.deepEqual(s,before);
  assert.equal(legal(s,{...a,source:'topo'}).ok,false);assert.equal(legal(s,{...a,target:4}).ok,false);
  const noOld=structuredClone(s);noOld.deck.push(noOld.board[4].id);noOld.board[4]=null;assert.equal(legal(noOld,a).ok,false);
});
test('normal compra uma e conversão é opcional na mesma posição',()=>{
  const {s,a}=conversionFixture(),n=dispatch(s,{...a,mode:'normal'});assert.equal(n.board[5].owner,'preto');assert.equal(n.hands.branco.length,s.hands.branco.length);assert.equal(n.deck.length,s.deck.length-1);
  assert.equal(legal(s,a).ok,true);
});
test('formas e sequências ativas não dão proteção contra conversão',()=>{
  const {s,a}=conversionFixture();const target=cardById(s,s.board[5].id),wanted=target.gems[0].shape;
  const extra=s.deck.filter(id=>cardById(s,id).gems.some(g=>g.shape===wanted)).slice(0,2);
  for(let i=0;i<extra.length;i++){s.deck.splice(s.deck.indexOf(extra[i]),1);s.board[[6,10][i]]={id:extra[i],owner:'preto'};}
  assert.ok(score(s).preto.chains.some(c=>c.kind==='shape'));assert.equal(legal(s,a).ok,true);assert.equal(legal(s,a).coverage.length,2);
});
test('última carta proibida por padrão; variante passa automaticamente e encerra ambas vazias',()=>{
  const blocked=conversionFixture({last:true});assert.equal(legal(blocked.s,blocked.a).ok,false);
  const {s,a}=conversionFixture({last:true,allow:true}),n=dispatch(s,a);assert.equal(n.hands.branco.length,0);assert.equal(n.current,'preto');
  const next=dispatch(n,legalActions(n)[0]);assert.equal(next.current,'preto');assert.equal(next.history.at(-1).type,'pass');
  const both=conversionFixture({last:true,allow:true,otherEmpty:true}),end=dispatch(both.s,both.a);
  assert.equal(end.phase,'finalizada');assert.equal(end.endReason,'maos-vazias');assert.ok(end.deck.length>0);assert.ok(end.board.some(c=>!c));assert.equal(legalActions(end).length,0);
});
test('primeira jogada é protegida para cada jogador, independentemente do turno ou de opções antigas',()=>{
  assert.equal(normalizeConfig().blockFirstConversion,true);
  assert.equal(normalizeConfig({blockFirstConversion:false}).blockFirstConversion,true);
  for(const owner of ['branco','preto']){
    const {s,a}=conversionFixture();
    if(owner==='preto'){
      for(const cell of s.board)if(cell)cell.owner=cell.owner==='branco'?'preto':'branco';
      [s.hands.branco,s.hands.preto]=[s.hands.preto,s.hands.branco];s.current='preto';
    }
    s.moves[owner]=0;s.moves[owner==='branco'?'preto':'branco']=9;s.turn=34;
    const before=structuredClone(s);assert.equal(legal(s,a).ok,false);assert.match(legal(s,a).reason,/primeira jogada/);
    assert.equal(legalActions(s).some(a=>a.mode==='converter'),false);assert.throws(()=>dispatch(s,a),/primeira jogada/);assert.deepEqual(s,before);
    for(const difficulty of ['beginner','experienced'])assert.equal(chooseAction(observeGame(s),{difficulty}).action.mode,'normal');
    s.moves[owner]=1;assert.equal(legal(s,a).ok,true);
  }
});
test('a última carta adversária do tabuleiro é protegida, inclusive na variante da última carta da mão',()=>{
  for(const allow of [false,true]){
    const {s,a}=conversionFixture({loneEnemy:true,allow});const before=structuredClone(s);
    assert.equal(legal(s,a).ok,false);assert.match(legal(s,a).reason,/última carta adversária/);
    assert.equal(legalActions(s).some(a=>a.mode==='converter'),false);assert.throws(()=>dispatch(s,a),/última carta adversária/);assert.deepEqual(s,before);
    for(const difficulty of ['beginner','experienced'])assert.equal(chooseAction(observeGame(s),{difficulty}).action.mode,'normal');
  }
  const {s,a}=conversionFixture();const after=dispatch(s,a);assert.equal(after.board.filter(c=>c?.owner==='preto').length,1);assertState(after);
});
const setup=(seed='save',config={})=>({seed,config,players:{branco:'human',preto:'human'},difficulty:'beginner',theme:'marble'});
test('salvar, retomar e ramificar preservam cartas, semente, opções e histórico',()=>{
  const session=new GameSession(setup());session.dispatch({type:'opening',firstOwner:'preto'});session.dispatch(legalActions(session.state)[0]);session.undo();session.notes='Teste çã';
  const restored=GameSession.load(session.serialize());assert.equal(restored.serialize(),session.serialize());restored.redo();assert.equal(restored.cursor,2);restored.undo();restored.dispatch(legalActions(restored.state)[1]);assert.equal(restored.commands.length,2);
  const tampered=JSON.parse(restored.serialize());tampered.state.deck.reverse();assert.throws(()=>GameSession.load(JSON.stringify(tampered)),/reprodução/);
  assert.throws(()=>GameSession.load(JSON.stringify({format:'CM-PLAYTEST-SAVE'})),/GEMAS/);
});
test('salvamentos anteriores são identificados e recusados sem alterar o conteúdo',()=>{
  const session=new GameSession(setup()),saved=JSON.parse(session.serialize());saved.rulesVersion='GEMAS-RULES-0.1';
  const text=JSON.stringify(saved);assert.notEqual(saved.rulesVersion,RULES_VERSION);
  assert.throws(()=>GameSession.load(text),/regras anteriores/);assert.equal(JSON.stringify(saved),text);
});
test('relatório adulterado é recusado no carregamento',()=>{
  const session=new GameSession(setup()),report=chooseAction(observeGame(session.state));session.dispatch(report.action,report);
  const saved=JSON.parse(session.serialize());saved.reports[0].candidates='<img src=x>';
  assert.throws(()=>GameSession.load(JSON.stringify(saved)),/Relatório/);
});
test('partidas completas e salvas em 4×4, 4×6, máscaras e variante não travam',()=>{
  for(let seed=0;seed<50;seed++){
    const config={columns:seed%2?6:4,colors:2+seed%7,shapes:2+(seed*2)%7,allowLastConversion:seed%3===0,...(seed%5===0?{active:[0,1,2,4,5,6,8,9,10]}:{})};
    const session=new GameSession(setup('full-'+seed,config));let moves=0;
    while(session.state.phase!=='finalizada'){const actions=legalActions(session.state);assert.ok(actions.length);const conversion=actions.filter(a=>a.mode==='converter');session.dispatch(conversion[seed%conversion.length]||actions[seed%actions.length]);assertState(session.state);assert.ok(++moves<=session.state.config.active.length-1);}
    assert.equal(GameSession.load(session.serialize()).serialize(),session.serialize());
  }
});
test('IA não recebe semente, ordem ou histórico e não muda ao permutar o monte oculto',()=>{
  let s=dispatch(newGame('privacy'),{type:'opening',firstOwner:'branco'});const changed=structuredClone(s);changed.deck.reverse();changed.seed='different';changed.history=[];
  const a=observeGame(s),b=observeGame(changed);assert.deepEqual(a,b);assert.equal('seed' in a,false);assert.equal('deck' in a,false);assert.equal('history' in a,false);
  for(const difficulty of ['beginner','experienced'])assert.deepEqual(chooseAction(a,{difficulty}),chooseAction(b,{difficulty}));
});
test('ambos os níveis completam partidas legais com paletas e variantes distintas',()=>{
  for(const difficulty of ['beginner','experienced'])for(let seed=0;seed<3;seed++){
    let s=newGame('ai-'+seed,{colors:2+seed*2,shapes:3+seed,allowLastConversion:seed===0});let moves=0;
    while(s.phase!=='finalizada'){const report=chooseAction(observeGame(s),{difficulty,shortlist:2,samples:1});assert.ok(report.action);assert.equal(legal(s,report.action).ok,true);s=dispatch(s,report.action);assert.ok(++moves<=15);}
    assert.equal(chooseAction(observeGame(s),{difficulty}).action,null);
  }
});
test('Worker cancelado ignora resposta atrasada e pode ser reiniciado',()=>{
  const workers=[],results=[];const controller=new OpponentController({workerFactory:()=>{const w={postMessage(){},terminate(){}};workers.push(w);return w;},onResult:x=>results.push(x),onError:()=>{}});
  controller.start('one',{});const stale=workers[0].onmessage;controller.cancel();stale({data:{result:1}});assert.deepEqual(results,[]);controller.start('two',{});workers[1].onmessage({data:{result:2}});assert.deepEqual(results,[2]);
});
