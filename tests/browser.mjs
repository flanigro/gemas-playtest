// Fluxo real no navegador (Playwright): node tests/browser.mjs, com `npm start` rodando.
// Confere a interface 1.0 contra o motor: nada aqui redefine regra, só compara a tela com o estado.
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.GEMAS_PLAYWRIGHT_MODULE||'playwright');
import {legalActions,score,dispatch} from '../src/engine.mjs';
import {GameSession} from '../src/session.mjs';
import {boardConnections,scoreTableData,conversionMoves} from '../src/game-view.mjs';
import {boardLayout} from '../src/layout.mjs';
import {TUTORIAL} from '../src/tutorial.mjs';

const BASE='http://127.0.0.1:4188/dev.html',KEY='GEMAS-playtest-0.1',PREFS='GEMAS-preferences-0.1',ARCHIVE='GEMAS-playtest-regras-anteriores';
const browser=await chromium.launch({headless:true,channel:process.env.GEMAS_PLAYWRIGHT_CHANNEL||'chrome'}).catch(()=>chromium.launch({headless:true}));
const errors=[],failed=[],checks=[];
async function open({width=390,height=844,motion=false,url=BASE,init=null,touch=false}={}) {
  const context=await browser.newContext({viewport:{width,height},reducedMotion:motion?'no-preference':'reduce',hasTouch:touch});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
  if(init)await page.addInitScript(init);
  await page.goto(url);await page.evaluate(()=>document.fonts.ready);
  return page;
}
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
const state=async page=>(await saved(page)).state;
const live=async page=>{await page.waitForFunction(()=>document.querySelector('#live').textContent.length>0);return page.locator('#live').textContent();};
const cell=(page,i)=>page.locator(`[data-cell="${i}"]`);
const hand=(page,id)=>page.locator(`[data-hand="${id}"]`);
async function inject(page,session) {
  await page.evaluate(([key,text])=>localStorage.setItem(key,text),[KEY,session.serialize()]);
  await page.reload();await page.evaluate(()=>document.fonts.ready);
  await page.getByRole('button',{name:'Continuar partida'}).click();
}
async function play(page,action) {
  if(action.type==='opening'){const s=await state(page),k=action.firstOwner===s.current?0:1;await cell(page,s.config.positions[k]).click();await cell(page,s.config.positions[k]).click();return;}
  await hand(page,action.cardId).click();await cell(page,action.position).click();
  await cell(page,action.mode==='converter'?action.target:action.position).click();
}
const waitHuman=page=>page.waitForFunction(key=>{const s=JSON.parse(localStorage.getItem(key));return s.state.phase==='finalizada'||s.setup.players[s.state.current]==='human';},KEY,{timeout:90000});
const waitEnd=page=>page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).state.phase==='finalizada',KEY,{timeout:120000});
// A session advanced with the engine until `predicate` holds, to start UI checks from a known position.
function sessionUntil(setup,predicate) {
  const session=new GameSession(setup);
  while(session.state.phase!=='finalizada'&&!predicate(session.state)){const actions=legalActions(session.state);session.dispatch(actions.find(a=>a.mode==='normal')||actions[0]);}
  assert.notEqual(session.state.phase,'finalizada','posição de teste não encontrada');
  return session;
}
const manual={players:{branco:'human',preto:'human'},difficulty:'beginner',pointHints:true};
const hasConversion=s=>s.phase==='jogando'&&legalActions(s).some(a=>a.mode==='converter');

// Partida em tela fixa: sem rolagem, nada fora da tela, alvos ≥ 44 px, texto ≥ 14 px, gemas inteiras.
async function checkScreen(page,label,{targets=true}={}) {
  const report=await page.evaluate(()=>{
    const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden';};
    const dialog=document.querySelector('.dialog'),scope=dialog||document.querySelector('#app');
    const small=[...scope.querySelectorAll('button,input[role=switch],summary')].filter(visible).map(el=>({k:el.dataset.k||el.id||el.textContent.trim().slice(0,20),r:el.getBoundingClientRect()})).filter(x=>x.r.width<43.5||x.r.height<43.5).map(x=>`${x.k} ${Math.round(x.r.width)}×${Math.round(x.r.height)}`);
    const tiny=new Set(),walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);
    for(let node=walker.nextNode();node;node=walker.nextNode()){const el=node.parentElement;if(!node.textContent.trim()||!visible(el)||el.closest('.sr-only'))continue;const size=parseFloat(getComputedStyle(el).fontSize);if(size<14)tiny.add(`${node.textContent.trim().slice(0,24)} ${size}px`);}
    const clipped=[...document.querySelectorAll('.card .gem')].filter(visible).filter(g=>{const b=g.getBoundingClientRect(),c=g.closest('.card').getBoundingClientRect();return Math.abs(b.width-b.height)>1||b.left<c.left-1||b.right>c.right+1||b.top<c.top-1||b.bottom>c.bottom+1;}).length;
    const game=document.querySelector('.game'),outside=game?[...game.querySelectorAll('.topbar,.scores,.opp,.tray,.status,.coach,.hand,.hcard')].filter(visible).filter(el=>{const r=el.getBoundingClientRect();return r.left<-1||r.top<-1||r.right>innerWidth+1||r.bottom>innerHeight+1;}).map(el=>el.className):[];
    const cut=[...document.querySelectorAll('.chip,.score .sname span,.ghost,.primary,.secondary')].filter(visible).filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.textContent);
    return {small,tiny:[...tiny],clipped,outside,cut,game:Boolean(game),scrollX:document.documentElement.scrollWidth>innerWidth+1,scrollY:document.documentElement.scrollHeight>innerHeight+1,body:getComputedStyle(document.body).overflow};
  });
  assert.equal(report.scrollX,false,`${label}: rolagem horizontal`);
  if(report.game){assert.equal(report.scrollY,false,`${label}: a partida não rola`);assert.equal(report.body,'hidden',label);assert.deepEqual(report.outside,[],`${label}: tudo dentro da tela`);}
  if(targets)assert.deepEqual(report.small,[],`${label}: alvos de toque com 44 px ou mais`);
  assert.deepEqual(report.tiny,[],`${label}: texto com 14 px ou mais`);
  assert.equal(report.clipped,0,`${label}: gemas quadradas e dentro da carta`);
  assert.deepEqual(report.cut,[],`${label}: rótulos sem corte`);
}
const shot=(page,name,options={})=>page.screenshot({path:`reports/${name}.png`,...options});

try{
  /* 1. Abertura do app, nova partida e salvamentos antigos */
  let page=await open();
  assert.deepEqual(await page.locator('.home-actions button').allTextContents(),['Nova partida','Aprender a jogar','Regras']);
  assert.match(await page.locator('.home-actions .primary').textContent(),/Aprender a jogar/,'no primeiro acesso o tutorial é a ação principal');
  for(const [width,height] of [[320,568],[360,780],[390,844],[768,1024],[1280,800]]){await page.setViewportSize({width,height});await checkScreen(page,`início ${width}`);}
  await page.setViewportSize({width:390,height:844});await shot(page,'inicio-390');
  await page.getByRole('button',{name:'Regras'}).click();
  assert.equal(await page.locator('.dialog').getAttribute('aria-modal'),'true');assert.match(await page.locator('.dialog-body').textContent(),/primeira jogada de cada jogador não pode converter/);
  await checkScreen(page,'regras');await page.keyboard.press('Escape');assert.equal(await page.locator('.dialog').count(),0);
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset.k),'rules','o foco volta a quem abriu a folha');
  await page.getByRole('button',{name:'Nova partida'}).click();
  for(const [width,height] of [[320,568],[390,844],[768,1024]]){
    await page.setViewportSize({width,height});await checkScreen(page,`nova partida ${width}`);
    await page.waitForFunction(()=>[...document.querySelectorAll('.palette-slot img')].every(i=>i.complete&&i.naturalWidth>0));
    const images=await page.locator('.palette-slot img').evaluateAll(list=>list.map(i=>i.complete&&i.naturalWidth>0&&Math.abs(i.getBoundingClientRect().width-i.getBoundingClientRect().height)<.1));
    assert.equal(images.length,16);assert.ok(images.every(Boolean),'16 símbolos do Figma carregados');
    await shot(page,`nova-partida-${width}`,{fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.fonts.check('16px Jost')&&document.fonts.check('16px Marcellus')),'fontes locais');
  await page.locator('[data-count="colors"][data-delta="-1"]').click();await page.locator('[data-count="shapes"][data-delta="-1"]').click();await page.locator('[data-count="shapes"][data-delta="-1"]').click();
  assert.deepEqual(await page.locator('.counter output').allTextContents(),['5','6'],'cores e formas independentes');
  assert.equal(await page.locator('.palette-slot.off').count(),5);
  await page.locator('[data-columns="6"]').click();assert.match(await page.locator('.deck-line').textContent(),/32\s*cartas/);
  await page.locator('[data-columns="4"]').click();assert.match(await page.locator('.deck-line').textContent(),/24\s*cartas/);
  assert.equal(await page.locator('#seed').count(),0,'laboratório escondido do jogador');
  assert.equal(await page.locator('[data-setting="convertBy"][data-value="shape"]').getAttribute('aria-pressed'),'true','formas comandam a conversão por padrão');
  assert.match(await page.locator('.setup').textContent(),/cobrem as duas formas/);
  await page.locator('[data-setting="convertBy"][data-value="color"]').click();assert.match(await page.locator('.setup').textContent(),/cobrem as duas cores/);
  await page.locator('[data-setting="convertBy"][data-value="shape"]').click();
  assert.equal(await page.locator('#point-hints').isChecked(),true,'Iniciante: dica de pontos ligada');
  await page.locator('[data-setting="difficulty"][data-value="experienced"]').click();assert.equal(await page.locator('#point-hints').count(),0,'Experiente: sem dica de pontos');
  await page.locator('[data-setting="difficulty"][data-value="beginner"]').click();
  checks.push('Conversão por formas (padrão) ou cores escolhida na nova partida; dica de pontos ligada no Iniciante e ausente no Experiente.');
  checks.push('Abertura do app, regras e nova partida em 320/360/390/768/1280 px: sem rolagem horizontal, alvos ≥ 44 px, texto ≥ 14 px, 16 símbolos do Figma, fontes locais, paleta independente e monte variável.');

  const legacy=JSON.stringify({format:'GEMAS-SAVE',version:1,rulesVersion:'GEMAS-RULES-0.1',generatorVersion:'GEMAS-GENERATOR-1',setup:{},commands:[],notes:'antiga'});
  await page.evaluate(([key,text])=>localStorage.setItem(key,text),[KEY,legacy]);await page.reload();
  assert.equal(await page.getByRole('button',{name:'Continuar partida'}).count(),0,'salvamento de regras anteriores não é retomado');
  assert.match(await page.locator('.notice').textContent(),/regras anteriores/);
  const [oldFile]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Exportar partida anterior'}).click()]);
  assert.equal(await readFile(await oldFile.path(),'utf8'),legacy);
  await page.getByRole('button',{name:'Nova partida'}).click();await page.locator('[data-setting="opponent"][data-value="manual"]').click();await page.getByRole('button',{name:'Começar partida'}).click();
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),ARCHIVE),legacy,'partida antiga arquivada sem alteração');
  assert.equal((await saved(page)).rulesVersion,'GEMAS-RULES-0.3');
  checks.push('Salvamentos de regras anteriores: recusados, exportáveis sem alteração e arquivados antes da nova partida.');

  /* 2. Partida em tela fixa, Layout A, nos formatos de referência */
  const position=columns=>sessionUntil({seed:`TELA-${columns}`,config:{columns,colors:3,shapes:4},...manual},hasConversion);
  for(const columns of [4,6])for(const [width,height] of [[390,844],[360,780],[390,664],[360,620],[768,1024],[844,390],[1280,800]]){
    await page.setViewportSize({width,height});await inject(page,position(columns));
    const s=await state(page),label=`partida ${columns===4?'4×4':'6×4'} em ${width}×${height}`,tall=!(width>=700&&width>height),layout=boardLayout(s.config,tall);
    await checkScreen(page,label);
    const action=legalActions(s).find(a=>a.mode==='converter');
    await hand(page,action.cardId).click();await checkScreen(page,`${label}, carta escolhida`);
    await cell(page,action.position).click();await checkScreen(page,`${label}, prévia`);
    assert.equal(await page.locator('.chip').count(),1+conversionMoves(s,action.cardId,{position:action.position}).length);
    // 6×4 é o 4×6 transposto: mesma casa do motor, linha e coluna trocadas na tela.
    assert.deepEqual([layout.rows,layout.columns],columns===6&&tall?[6,4]:[4,columns]);
    assert.equal(await page.locator('.board').getAttribute('aria-label'),`Tabuleiro de ${layout.rows} linhas e ${layout.columns} colunas`);
    const boxes=await page.locator('.slot').evaluateAll(slots=>slots.map(slot=>{const r=slot.getBoundingClientRect();return {i:slot.dataset.slot===undefined?null:Number(slot.dataset.slot),x:Math.round(r.x),y:Math.round(r.y)};}));
    const xs=[...new Set(boxes.map(b=>b.x))].sort((a,b)=>a-b),ys=[...new Set(boxes.map(b=>b.y))].sort((a,b)=>a-b);
    assert.deepEqual([ys.length,xs.length],[layout.rows,layout.columns]);
    for(const box of boxes){const place=layout.place(box.i);assert.deepEqual([ys.indexOf(box.y)+1,xs.indexOf(box.x)+1],[place.row,place.column],`${label}: casa ${box.i}`);}
    assert.match(await cell(page,action.position).getAttribute('aria-label'),new RegExp(`na ${layout.label(action.position)}`));
    if([390,360,844,1280].includes(width)&&height!==664)await shot(page,`partida-${columns===4?'4x4':'6x4'}-${width}x${height}`);
    await page.locator('[data-action="menu"]').click();await page.locator('[data-k="m-home"]').click();
  }
  checks.push('Partida em tela fixa (Layout A), 4×4 e 6×4, em 390×844, 360×780, 390×664, 360×620, 768×1024, 844×390 e 1280×800: sem rolagem, nada fora da tela, alvos ≥ 44 px, texto ≥ 14 px, gemas inteiras; 6×4 transposto só na apresentação.');

  /* 3. Interação: confirmar na casa ou no alvo, arrastar, teclado */
  await page.setViewportSize({width:390,height:844});
  let session=position(4);await inject(page,session);
  let before=await state(page),options=legalActions(before).filter(a=>a.mode==='converter'),action=options[0];
  assert.equal(await page.locator('.badge').count(),before.hands[before.current].filter(id=>conversionMoves(before,id).length).length,'cartas que podem converter já vêm marcadas');
  await cell(page,action.position).click();assert.match(await page.locator('.status p').textContent(),/primeiro numa carta/);assert.deepEqual(await state(page),before);
  await hand(page,action.cardId).click();
  const marked=await page.locator('.cell.conv').evaluateAll(list=>list.map(el=>Number(el.dataset.cell)).sort((a,b)=>a-b));
  assert.deepEqual(marked,[...new Set(conversionMoves(before,action.cardId).map(o=>o.action.position))].sort((a,b)=>a-b),'casas que permitem converter');
  assert.equal(await page.locator('.cell.ok').count(),before.board.filter(c=>!c).length);
  // Dica de pontos: cada casa mostra o melhor ganho possível, calculado pelo motor.
  for(const cellIndex of before.config.active.filter(i=>!before.board[i])){
    const owner=before.current,base=score(before)[owner].total,gains=legalActions(before).filter(a=>a.cardId===action.cardId&&a.position===cellIndex).map(a=>score(dispatch(before,a))[owner].total-base),best=Math.max(...gains);
    const shown=await cell(page,cellIndex).locator('.hint-points').textContent().catch(()=>null);
    assert.equal(shown,best>0?`+${best}`:null,`dica na casa ${cellIndex}`);
  }
  await cell(page,action.position).click();
  assert.deepEqual(await state(page),before,'a prévia não altera a partida');
  assert.match(await cell(page,action.position).getAttribute('aria-label'),/^Confirmar: colocar/);
  assert.match(await cell(page,action.target).getAttribute('aria-label'),/^Converter a carta/);
  await page.getByRole('button',{name:'Cancelar'}).click();assert.equal(await page.locator('.chip').count(),0);assert.deepEqual(await state(page),before);
  // Alvo primeiro: escolhe a carta adversária, depois a casa (ou a única casa possível já entra em prévia).
  await hand(page,action.cardId).click();await cell(page,action.target).click();
  const places=[...new Set(conversionMoves(before,action.cardId,{target:action.target}).map(o=>o.action.position))];
  if(places.length>1){assert.equal(await page.locator('.chip').count(),0);await cell(page,action.position).click();}
  assert.deepEqual(await state(page),before);await cell(page,action.target).click();
  let after=await state(page);assert.deepEqual(after,JSON.parse(JSON.stringify(dispatch(before,action))),'conversão confirmada no alvo, uma única vez');
  assert.match(await live(page),/converteu a carta/);assert.match(await live(page),/Placar: Branco \d+, Preto \d+\./);
  assert.equal(await page.locator('.turned').count(),1);assert.equal(await page.locator('.cell.last').count(),1);
  // Colocação simples: confirmar na própria casa; compra uma carta.
  before=after;action=legalActions(before).find(a=>a.mode==='normal');await play(page,action);
  after=await state(page);assert.deepEqual(after,JSON.parse(JSON.stringify(dispatch(before,action))));
  // Motivo do motor quando a conversão não vale.
  const blocked=sessionUntil({seed:'BLOQUEIO',config:{colors:3,shapes:4},...manual},s=>s.phase==='jogando');await inject(page,blocked);
  before=await state(page);await hand(page,before.hands[before.current][0]).click();await cell(page,before.board.findIndex(c=>c&&c.owner!==before.current)).click();
  assert.match(await page.locator('.status p').textContent(),/primeira jogada/i);assert.deepEqual(await state(page),before);
  checks.push('Interação: cartas, casas e alvos de conversão marcados; prévia sem efeito; confirmação na casa (colocar) ou na carta adversária (converter), casa primeiro ou alvo primeiro; Cancelar; motivo do motor para jogada inválida.');

  // Arrastar faz o mesmo que tocar carta e casa: solta em prévia, sem confirmar.
  await page.getByRole('button',{name:'Cancelar'}).click();
  const drop=legalActions(before).find(a=>a.mode==='normal'),from=await hand(page,drop.cardId).boundingBox(),to=await cell(page,drop.position).boundingBox();
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();
  await page.mouse.move(from.x+from.width/2,from.y-30,{steps:4});assert.equal(await page.locator('.drag-ghost').count(),1);
  await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:6});assert.equal(await cell(page,drop.position).evaluate(el=>el.classList.contains('drop-hover')),true);
  await page.mouse.up();
  assert.equal(await page.locator('.drag-ghost').count(),0);assert.deepEqual(await state(page),before,'soltar não confirma');
  assert.match(await cell(page,drop.position).getAttribute('aria-label'),/^Confirmar: colocar/);
  await cell(page,drop.position).click();assert.deepEqual(await state(page),JSON.parse(JSON.stringify(dispatch(before,drop))));
  const touchPage=await open({touch:true});await inject(touchPage,blocked);
  assert.equal(await touchPage.locator('.hcard').first().evaluate(el=>getComputedStyle(el).touchAction),'none','arrasto por toque não vira rolagem');
  await hand(touchPage,drop.cardId).tap();await cell(touchPage,drop.position).tap();await cell(touchPage,drop.position).tap();
  assert.deepEqual(await state(touchPage),JSON.parse(JSON.stringify(dispatch(before,drop))),'toque: carta, casa, confirmar');await touchPage.context().close();
  checks.push('Arrastar (ponteiro) equivale a tocar carta e casa: prévia sem efeito até confirmar; toque em tela sensível funciona.');

  // Teclado: partida jogável sem mouse, com setas no tabuleiro e Escape.
  before=await state(page);const keyed=legalActions(before).find(a=>a.mode==='normal');
  await hand(page,keyed.cardId).focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset.k),`hand-${keyed.cardId}`,'o foco sobrevive ao redesenho');
  assert.notEqual(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'none','foco visível');
  await page.keyboard.press('Escape');assert.equal(await page.locator('.hcard.sel').count(),0);await page.keyboard.press('Enter');
  const empty=before.board.findIndex(c=>!c);await cell(page,empty).focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset.cell),String(empty));
  await cell(page,keyed.position).focus();await page.keyboard.press('Enter');await page.keyboard.press('Enter');
  assert.deepEqual(await state(page),JSON.parse(JSON.stringify(dispatch(before,keyed))));
  checks.push('Teclado: jogada completa sem mouse, foco visível e preservado, setas no tabuleiro, Escape cancela.');

  /* 4. Partida inteira a dois no 6×4 vertical, placar, ligações, menu, pontos, desfazer */
  session=new GameSession({seed:'DOIS-6X4',config:{columns:6,colors:3,shapes:4},...manual});await inject(page,session);
  let moves=0,conversions=0,engine=session.state;
  while(engine.phase!=='finalizada'){
    const list=legalActions(engine),next=list.find(a=>a.mode==='converter')||list[0];
    await play(page,next);engine=dispatch(engine,next);moves++;if(next.mode==='converter')conversions++;
    const now=await state(page);assert.deepEqual(now,JSON.parse(JSON.stringify(engine)),`jogada ${moves}`);
    const points=score(engine);
    assert.deepEqual(await page.locator('[data-score]').evaluateAll(list=>Object.fromEntries(list.map(el=>[el.dataset.score,Number(el.textContent)]))),{branco:points.branco.total,preto:points.preto.total});
    assert.equal(await page.locator('.links line').count(),boardConnections(engine).length);
    if(engine.phase==='jogando'){assert.equal(await page.locator('.hand .hcard').count(),engine.hands[engine.current].length,'a mão de baixo é de quem joga');assert.equal(await page.locator('.minis .mini').count(),engine.hands[engine.current==='branco'?'preto':'branco'].length);}
    if(moves===12){
      await checkScreen(page,'6×4 no meio da partida');await shot(page,'partida-6x4-meio');
      await page.locator('[data-k="score-branco"]').click();
      for(const group of scoreTableData(engine))for(const row of group.rows){
        const cells=await page.locator(`[data-score-kind="${group.kind}"] [data-score-owner="${row.owner}"] td`).allTextContents();
        assert.deepEqual(cells.map(Number),[...group.values.map(v=>row.points[v]||0),row.total]);
      }
      await checkScreen(page,'pontos por símbolo');await page.keyboard.press('Escape');
      await page.locator('[data-action="menu"]').click();await checkScreen(page,'menu');
      await page.locator('#opt-chains').uncheck({force:true});assert.equal(await page.locator('.links line').count(),0);
      await page.locator('#opt-chains').check({force:true});
      await page.locator('#opt-points').check({force:true});await page.keyboard.press('Escape');
      assert.equal(await page.locator('.card-points').count(),OWNERS_WITH_POINTS(points));
      await page.locator('[data-action="menu"]').click();await page.locator('#opt-points').uncheck({force:true});
      await page.locator('[data-k="m-rules"]').click();assert.equal(await page.locator('.dialog').getAttribute('data-modal'),'rules');await page.keyboard.press('Escape');
      assert.deepEqual(await state(page),JSON.parse(JSON.stringify(engine)),'consultar regras e pontos não mexe na partida');
      await page.locator('[data-action="toggle-opp"]').click();assert.equal(await page.locator('.minis').count(),0);await checkScreen(page,'mão adversária recolhida');
      await page.locator('[data-action="toggle-opp"]').click();assert.equal(await page.locator('.minis').count(),1);
      await page.locator('[data-action="undo"]').click();assert.equal((await saved(page)).cursor,moves-1);assert.match(await live(page),/Jogada desfeita/);await play(page,next);
    }
  }
  assert.ok(conversions>=3);
  await page.locator('.dialog[data-modal="result"]').waitFor();
  const final=score(engine);
  assert.equal(await page.locator('#dialog-title').textContent(),final.winner==='empate'?'Empate':`${final.winner==='branco'?'Branco':'Preto'} venceu`);
  assert.deepEqual((await page.locator('.final-side strong').allTextContents()).map(Number),[final.branco.total,final.preto.total]);
  assert.equal(await page.locator('.final-side.winner').count(),final.winner==='empate'?0:1);
  await checkScreen(page,'resultado');await shot(page,'resultado-390');
  await page.getByRole('button',{name:'Ver o tabuleiro'}).click();await checkScreen(page,'tabuleiro final');
  assert.match(await page.locator('.status p').textContent(),/Partida encerrada/);
  const loser=final.winner==='empate'?null:final.winner==='branco'?'preto':'branco';
  await page.getByRole('button',{name:'Resultado'}).click();
  if(loser)assert.match(await page.locator('.dialog-body .muted').last().textContent(),new RegExp(`${loser==='branco'?'Branco':'Preto'} começa e ${final.winner==='branco'?'Branco':'Preto'} escolhe`,'i'));
  await page.getByRole('button',{name:'Jogar de novo'}).click();
  let again=await saved(page);assert.equal(again.state.phase,'abertura');assert.notEqual(again.setup.seed,'DOIS-6X4');
  assert.deepEqual({...again.setup.config,opener:null},{...session.setup.config,opener:null},'mesma configuração');
  assert.equal(again.setup.config.opener,loser??'sorteio','quem perdeu começa; empate sorteia');
  if(loser){assert.equal(again.state.config.opener,loser);assert.equal(again.state.current,final.winner,'quem ganhou escolhe as cartas de abertura');}
  checks.push(`Partida completa a dois no 6×4 vertical: ${moves} comandos, ${conversions} conversões, estado idêntico ao do motor a cada jogada, placar, ligações, pontos por símbolo, menu, regras durante a partida, mão adversária recolhível, desfazer, tela de resultado e revanche.`);

  // Empate tem tela própria.
  for(let n=1;;n++){const trial=new GameSession({seed:`EMPATE-${n}`,config:{colors:8,shapes:8},...manual});while(trial.state.phase!=='finalizada')trial.dispatch(legalActions(trial.state)[0]);if(score(trial.state).winner==='empate'){await inject(page,trial);break;}assert.ok(n<400,'sem empate para testar');}
  await page.locator('.dialog[data-modal="result"]').waitFor();assert.equal(await page.locator('#dialog-title').textContent(),'Empate');assert.equal(await page.locator('.final-side.winner').count(),0);
  assert.match(await live(page),/Partida retomada\. Fim da partida\. Empate/);
  await page.keyboard.press('Escape');assert.deepEqual(await page.locator('.status-actions button').allTextContents(),['Resultado','Nova partida']);
  await checkScreen(page,'fim com dois botões');
  await page.getByRole('button',{name:'Nova partida'}).click();
  const tieNext=await saved(page);assert.equal(tieNext.setup.config.opener,'sorteio','depois do empate, sorteio');assert.equal(tieNext.state.phase,'abertura');
  assert.equal(tieNext.setup.config.colors,8);assert.equal(tieNext.setup.config.shapes,8);
  checks.push('Vitória e empate conferidos contra score() do motor na tela de resultado; no fim, Nova partida ao lado de Resultado repete a configuração, com quem perdeu começando (quem ganhou escolhe as cartas) e sorteio depois de empate.');

  /* 5. Modo playtest: escondido do jogador, mas completo */
  await page.keyboard.press('Escape');await page.locator('[data-action="menu"]').click();
  assert.equal(await page.locator('[data-action="save"]').count(),0);await page.locator('[data-k="m-home"]').click();
  await page.getByRole('button',{name:/Modo playtest/}).click();await page.getByRole('button',{name:'Nova partida'}).click();
  await page.locator('#seed').fill('LAB-1');await page.locator('#seed').dispatchEvent('change');
  await page.locator('#mask').fill('0, 1, 2, 4, 5, 6, 8, 9, 10');await page.locator('#mask').dispatchEvent('change');
  assert.match(await page.locator('.deck-line').textContent(),/17\s*cartas/);
  await page.locator('[data-setting="opponent"][data-value="computer"]').click();await page.locator('[data-setting="opener"][data-value="branco"]').click();
  await page.getByRole('button',{name:'Começar partida'}).click();await waitHuman(page);
  assert.equal((await state(page)).seed,'LAB-1');assert.equal(await page.locator('.slot.void').count(),7);assert.equal(await page.locator('.card-id').count()>0,true);
  let lab=await state(page);if(lab.phase==='abertura'){await play(page,{type:'opening',firstOwner:'branco'});await waitHuman(page);lab=await state(page);}
  await play(page,legalActions(lab).find(a=>a.mode==='normal'));await waitHuman(page);
  const cursor=(await saved(page)).cursor;
  await page.locator('[data-action="menu"]').click();await checkScreen(page,'menu de playtest');
  assert.match(await page.locator('.lab').textContent(),/Semente: LAB-1/);assert.equal(await page.locator('.lab details').count(),2,'última decisão do computador e histórico');
  await page.locator('#notes').fill('anotação de playtest');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="save"]').click()]);
  const exported=await readFile(await download.path(),'utf8');assert.equal(JSON.parse(exported).notes,'anotação de playtest');
  const [log]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="export-log"]').click()]);assert.equal(JSON.parse(await readFile(await log.path(),'utf8')).seed,'LAB-1');
  await page.locator('[data-action="step-undo"]').click();assert.equal((await saved(page)).cursor,cursor-1);
  assert.match(await page.locator('.lab').textContent(),/computador pausado/);
  await page.locator('[data-action="redo"]').click();assert.equal((await saved(page)).cursor,cursor);
  await page.locator('[data-action="manual"]').click();assert.deepEqual((await saved(page)).setup.players,{branco:'human',preto:'human'});
  await page.locator('[data-action="menu"]').click().catch(()=>{});
  await page.locator('#load-file').setInputFiles({name:'antiga.json',mimeType:'application/json',buffer:Buffer.from(legacy)});
  await page.keyboard.press('Escape');assert.match(await live(page),/regras|versão|inválid|incompat/i,'importação de regras anteriores é recusada');
  await page.locator('#load-file').setInputFiles({name:'partida.json',mimeType:'application/json',buffer:Buffer.from(exported)});
  await page.waitForFunction(([key,n])=>JSON.parse(localStorage.getItem(key)).cursor===n&&JSON.parse(localStorage.getItem(key)).notes==='anotação de playtest',[KEY,cursor]);
  await page.locator('[data-action="menu"]').click().catch(()=>{});await page.locator('[data-k="m-home"]').click();await page.getByRole('button',{name:/Modo playtest/}).click();
  checks.push('Modo playtest escondido do jogador e completo: semente, máscara de casas, identificação das cartas, anotações, exportar/carregar partida, exportar histórico, desfazer/refazer um passo, pausa, controle manual e recusa de importações antigas.');

  /* 6. Computador: Worker real, jogada anunciada e animada, desfazer */
  await page.context().close();page=await open({motion:true});
  await page.getByRole('button',{name:'Nova partida'}).click();await page.locator('[data-setting="opener"][data-value="preto"]').click();
  await page.getByRole('button',{name:'Começar partida'}).click();
  let game=await state(page);assert.equal(game.phase,'abertura');assert.equal(game.current,'branco');
  await cell(page,game.config.positions[1]).click();assert.equal(await page.locator('.chip').count(),1);await cell(page,game.config.positions[1]).click();
  assert.match(await live(page),/^Abertura\. /);
  assert.equal(await page.locator('.hcard').first().getAttribute('aria-disabled'),'true','mão inerte na vez do computador');
  assert.match(await page.locator('.score.active .turn').textContent(),/Pensando/);
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).state.history.some(e=>e.type==='move'),KEY,{timeout:30000});
  assert.ok(await page.evaluate(()=>document.getAnimations().length>0),'a jogada do computador é animada');
  await page.waitForFunction(()=>/O computador colocou .+ na linha \d, coluna \d\..*Placar: Você \d+, Computador \d+\. Sua vez\./.test(document.querySelector('#live').textContent));
  assert.equal(await page.locator('#live').getAttribute('aria-live'),'polite');
  assert.match(await page.locator('.status p').textContent(),/O computador jogou na linha \d, coluna \d\. Sua vez|Sua vez\. Ligue 3 ou mais cartas suas pela mesma forma ou pela mesma cor\./);
  await page.waitForTimeout(1600);game=await state(page);
  const mine=legalActions(game).find(a=>a.mode==='normal');await hand(page,mine.cardId).click();await cell(page,mine.position).click();await cell(page,mine.position).click();
  assert.ok(await page.evaluate(()=>document.getAnimations().length>0),'carta desliza da mão até a casa');
  await waitHuman(page);await page.waitForTimeout(1700);
  const count=(await saved(page)).cursor;await page.locator('[data-action="undo"]').click();
  const undone=await saved(page);assert.equal(undone.cursor,count-2,'desfazer devolve a vez ao jogador');assert.equal(undone.setup.players[undone.state.current],'human');
  await shot(page,'computador-390');
  // Grupo que pontua: acende, mostra o ganho e o placar conta.
  const scoring=new GameSession({seed:TUTORIAL.seed,config:TUTORIAL.config,...manual});
  for(const step of TUTORIAL.steps.filter(s=>s.action).slice(0,4))scoring.dispatch(step.action);
  await inject(page,scoring);const trio=TUTORIAL.steps.filter(s=>s.action)[4].action;await play(page,trio);
  await page.locator('.gain').waitFor();assert.equal(await page.locator('.gain').textContent(),'+3');
  await page.locator('.cell.glow').first().waitFor();assert.equal(await page.locator('.cell.glow').count(),3);
  await page.waitForFunction(()=>document.querySelector('[data-score="branco"]').textContent==='3');
  checks.push('Contra o computador (Worker real): abertura, jogada do computador animada e anunciada por aria-live com placar e vez, mão inerte fora da vez, desfazer devolve a vez; grupo que pontua acende, mostra +3 e o placar conta.');
  await page.context().close();

  // Reduzir movimento desliga todas as animações.
  page=await open();await inject(page,scoring);await play(page,trio);
  assert.equal(await page.evaluate(()=>document.getAnimations().length),0);assert.equal(await page.locator('.cell.glow').count(),0);
  assert.equal(await page.locator('[data-score="branco"]').textContent(),'3');assert.equal(await page.locator('.gain').count(),1,'o ganho aparece parado');
  checks.push('Reduzir movimento: nenhuma animação; o ganho e o placar aparecem de imediato.');

  for(const [difficulty,columns] of [['beginner',4],['experienced',6]]){
    const ai=new GameSession({seed:`IA-${difficulty}`,config:{columns,colors:4,shapes:5},players:{branco:'computer',preto:'computer'},difficulty});
    await inject(page,ai);await waitEnd(page);await page.locator('.dialog[data-modal="result"]').waitFor();
    const done=await saved(page);assert.equal(done.state.board.filter(Boolean).length+0>0,true);assert.ok(done.reports.filter(Boolean).length>=done.state.history.filter(e=>e.type!=='pass').length-1);
    checks.push(`Worker real, ${difficulty==='beginner'?'Iniciante 4×4':'Experiente 4×6'}: partida completa, ${done.state.history.length} registros.`);
    await page.keyboard.press('Escape');await page.locator('[data-action="menu"]').click();await page.locator('[data-k="m-home"]').click();
  }
  for(const human of ['branco','preto'])for(const difficulty of ['beginner','experienced']){
    await page.evaluate(key=>localStorage.removeItem(key),KEY);await page.reload();
    await page.getByRole('button',{name:'Nova partida'}).click();
    await page.locator(`[data-setting="human"][data-value="${human}"]`).click();await page.locator(`[data-setting="difficulty"][data-value="${difficulty}"]`).click();
    await page.locator('[data-setting="opener"][data-value="sorteio"]').click();await page.getByRole('button',{name:'Começar partida'}).click();
    await waitHuman(page);let now=await state(page);
    if(now.phase==='abertura'){await play(page,{type:'opening',firstOwner:human});await waitHuman(page);now=await state(page);}
    assert.equal(now.current,human);await play(page,legalActions(now).find(a=>a.mode==='normal'));await waitHuman(page);
    now=await state(page);assert.equal(now.current,human);assert.ok(now.history.filter(e=>e.type==='move').length>=2);
    assert.equal(await page.locator('.score').first().locator('.dot').getAttribute('class'),`dot ${human}`,'o painel do jogador vem primeiro');
  }
  checks.push('Nova partida contra os dois níveis, com o jogador de Branco e de Preto: a vez volta depois de uma resposta legal.');

  /* 7. Tutorial guiado */
  await page.evaluate(key=>localStorage.removeItem(key),KEY);await page.reload();
  await page.getByRole('button',{name:'Aprender a jogar'}).click();
  const total=TUTORIAL.steps.length;let guard=0,wrong=false;
  while(await page.locator('.coach').count()){
    assert.ok(guard++<80,'tutorial travou');
    const index=Number((await page.locator('.coach-step').textContent()).match(/passo (\d+)/)[1])-1,step=TUTORIAL.steps[index];
    assert.equal((await page.locator('.coach p').nth(1).textContent()),step.text);
    if(step.type==='info'){if(index===0)await checkScreen(page,'tutorial');await page.locator('[data-action="coach-next"]').click();continue;}
    if(step.type==='computer'){await page.waitForFunction(n=>!document.querySelector('.coach-step')?.textContent.includes(`passo ${n} `),index+1,{timeout:15000});continue;}
    if(!wrong&&step.action.type==='move'){wrong=true;await page.locator('.hcard.dim').first().click();assert.match(await page.locator('.coach .hint').textContent(),/destacad/);assert.equal(await page.locator('.hcard.sel').count(),0,'o tutorial só aceita o passo indicado');}
    if(await page.locator('.hcard.guide').count()){await page.locator('.hcard.guide').click();continue;}
    const guide=page.locator('.cell.guide');assert.ok(await guide.count()>0);
    if(index===9&&await guide.count()===1)await shot(page,'tutorial-conversao');
    await (await guide.count()>1&&step.action.position!==undefined?cell(page,step.action.position):guide.first()).click();
  }
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),null,'o tutorial não ocupa o salvamento do jogador');
  assert.equal(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),PREFS)).view.tutorialDone,true);
  assert.equal(await page.locator('[data-score="branco"]').textContent(),'8');
  await page.waitForFunction(()=>/Sua vez/.test(document.querySelector('.status p')?.textContent||''),null,{timeout:20000});
  await page.locator('[data-action="menu"]').click();await page.locator('[data-k="m-home"]').click();
  assert.match(await page.locator('.home-actions .primary').textContent(),/Nova partida/,'depois do tutorial, Nova partida vira a ação principal');
  checks.push(`Tutorial guiado: ${total} passos seguidos pela interface, só aceita o passo indicado, termina em 8 a 0 como o motor prevê, segue em partida livre contra o Iniciante e não ocupa o salvamento.`);
  await page.context().close();

  /* 8. Arquivo autônomo e alternativa sem Worker */
  const requests=[];page=await open({url:new URL('../index.html',import.meta.url).href});page.on('request',r=>requests.push(r.url()));
  assert.equal(await page.title(),'GEMAS');
  assert.ok(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--atlas').includes('data:image/svg+xml')&&document.fonts.check('16px Jost')&&document.fonts.check('16px Marcellus')));
  await page.getByRole('button',{name:'Nova partida'}).click();
  assert.ok((await page.locator('.palette-slot img').evaluateAll(list=>list.every(i=>i.src.startsWith('data:')&&i.complete&&i.naturalWidth>0))));
  await page.locator('[data-setting="opener"][data-value="branco"]').click();await page.getByRole('button',{name:'Começar partida'}).click();
  await waitHuman(page);let alone=await state(page);if(alone.phase==='abertura'){await play(page,{type:'opening',firstOwner:'branco'});await waitHuman(page);alone=await state(page);}
  await play(page,legalActions(alone).find(a=>a.mode==='normal'));await waitHuman(page);
  assert.ok((await state(page)).history.filter(e=>e.type==='move').length>=2,'Worker embutido responde no arquivo aberto direto');
  assert.ok(await page.locator('.card .gem').first().evaluate(el=>getComputedStyle(el).backgroundImage.startsWith('url("data:image/svg+xml')));
  await checkScreen(page,'arquivo autônomo');
  assert.deepEqual(requests.filter(url=>/^https?:/.test(url)),[],'nenhum pedido de rede');
  checks.push('Arquivo autônomo (index.html aberto direto): atlas, fontes e SVGs embutidos, Worker embutido responde, nenhum pedido de rede.');
  await page.goto(new URL('../dev.html',import.meta.url).href);await page.waitForURL('**/index.html');await page.locator('.home').waitFor();
  checks.push('Abrir dev.html direto redireciona para o index.html autônomo.');
  await page.context().close();

  page=await open({init:()=>{window.Worker=class{constructor(){throw new DOMException('Workers unavailable','SecurityError');}};}});
  for(const difficulty of ['beginner','experienced']){
    const ai=new GameSession({seed:`fallback-${difficulty}`,config:{colors:3,shapes:5},players:{branco:'computer',preto:'computer'},difficulty});
    await inject(page,ai);await waitEnd(page);assert.equal(await page.locator('.status .hint').count(),0);
    await page.locator('.dialog[data-modal="result"]').waitFor();await page.keyboard.press('Escape');await page.locator('[data-action="menu"]').click();await page.locator('[data-k="m-home"]').click();
  }
  checks.push('Os dois níveis completam abertura e partida mesmo quando o navegador nega Workers.');
  await page.context().close();

  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  await writeFile(new URL('../reports/validation.json',import.meta.url),JSON.stringify({status:'passed',version:'1.0.0',checks,errors,failed},null,2)+'\n');
  console.log(checks.join('\n'));
}finally{await browser.close();}
function OWNERS_WITH_POINTS(points){return ['branco','preto'].reduce((sum,owner)=>sum+points[owner].perCard.filter(c=>c.points>0).length,0);}
