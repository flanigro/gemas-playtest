import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.GEMAS_PLAYWRIGHT_MODULE||'playwright');
import {legalActions,score,dispatch} from '../src/engine.mjs';
import {GameSession} from '../src/session.mjs';
import {boardConnections,scoreTableData,conversionMoves} from '../src/game-view.mjs';
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],failed=[],checks=[];
const page=await browser.newPage({viewport:{width:768,height:1024}});
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('GEMAS-playtest-0.1')).state);
const inject=async session=>{await page.evaluate(text=>localStorage.setItem('GEMAS-playtest-0.1',text),session.serialize());await page.reload();await page.getByRole('button',{name:'Retomar',exact:true}).click();};
const checkLayout=async()=>{
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Horizontal page overflow');
  const clipped=await page.locator('.game-card .gem').evaluateAll(gems=>gems.flatMap(g=>{
    const b=g.getBoundingClientRect(),c=g.closest('.game-card').getBoundingClientRect();
    return Math.abs(b.width-b.height)>1||b.top<c.top-1||b.bottom>c.bottom+1?[{gem:b.toJSON(),card:c.toJSON()}]:[];
  }));
  assert.deepEqual(clipped,[],'Each gem keeps a square atlas viewport and fits inside its card');
  assert.deepEqual(await page.locator('.target-card-actions button,.on-card-actions button').evaluateAll(buttons=>buttons.filter(b=>b.scrollWidth>b.clientWidth+1).map(b=>b.textContent)),[],'On-card labels fit their buttons');
};
const screenshot=async options=>{await page.evaluate(()=>window.scrollTo(0,0));await page.evaluate(()=>new Promise(requestAnimationFrame));return page.screenshot(options);};
try{
  await page.goto('http://127.0.0.1:4188/dev.html');await page.evaluate(()=>document.fonts.ready);
  for(const width of [768,390,320]){await page.setViewportSize({width,height:width===768?1024:844});await checkLayout();assert.equal(await page.locator('.palette-slot img').count(),16);
    const images=await page.locator('.palette-slot img').evaluateAll(imgs=>imgs.map(i=>({loaded:i.complete&&i.naturalWidth>0,w:i.getBoundingClientRect().width,h:i.getBoundingClientRect().height})));
    assert.ok(images.every(i=>i.loaded&&Math.abs(i.w-(width<=620?30:34))<.1&&Math.abs(i.h-i.w)<.1));
    await screenshot({path:`reports/setup-${width}.png`,fullPage:true});
  }
  checks.push('Setup 768/390/320px, exact 16 Figma SVG slots and local fonts, no horizontal overflow.');
  await page.setViewportSize({width:768,height:1024});await page.locator('[data-columns="6"]').click();
  assert.match(await page.locator('.deck-summary').innerText(),/32 cartas/);assert.match(await page.locator('.deck-summary').innerText(),/64 gemas/);assert.doesNotMatch(await page.locator('.deck-summary').innerText(),/Nenhuma gema se repete/);
  await page.getByRole('button',{name:'Diminuir cores'}).click();assert.equal(await page.getByLabel('Quantidade de formas').innerText(),'8');checks.push('Independent palette controls and accurate variable deck/repetition text.');
  const previous=JSON.parse(new GameSession({seed:'old-save',config:{},players:{branco:'human',preto:'human'},difficulty:'beginner',theme:'marble'}).serialize());previous.rulesVersion=previous.state.rulesVersion='GEMAS-RULES-0.1';previous.state.config.blockFirstConversion=false;
  const oldText=JSON.stringify(previous);await page.evaluate(text=>localStorage.setItem('GEMAS-playtest-0.1',text),oldText);await page.reload();
  assert.equal(await page.getByRole('button',{name:'Retomar',exact:true}).count(),0);
  const archivedDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar partida anterior',exact:true}).click();assert.equal(await readFile(await (await archivedDownload).path(),'utf8'),oldText);
  await page.locator('[data-setting="opponent"][data-value="manual"]').click();await page.getByRole('button',{name:'Começar partida'}).click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('GEMAS-playtest-regras-anteriores')),oldText);assert.equal((await state()).rulesVersion,'GEMAS-RULES-0.2');
  assert.equal(await page.locator('.test-controls').count(),1);assert.equal(await page.locator('.lab-panel').count(),0);
  assert.equal(await page.locator('.player-dot,.owner-mark').count(),0);
  const scoreBoxes=await page.locator('.player-score').evaluateAll(els=>els.map(el=>({owner:el.classList.contains('preto')?'preto':'branco',bg:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color})));
  assert.deepEqual(scoreBoxes.map(s=>s.bg),['rgb(255, 255, 255)','rgb(41, 43, 47)']);assert.equal(scoreBoxes[1].color,'rgb(255, 255, 255)');
  checks.push('Owner boxes use white/black backgrounds without dots; opening footer controls are visible with laboratory closed; old saves export unchanged and are archived before a new rules-0.2 game.');
  // Real conversion flows: the final choice commits once, with no extra OK.
  function fixture(multiple=false,columns=4){
    const candidate=new GameSession({seed:'direct-conversion',config:{colors:2,shapes:2,opener:'branco',columns},players:{branco:'human',preto:'human'},difficulty:'beginner',theme:'marble'});
    candidate.dispatch({type:'opening',firstOwner:'branco'});
    for(let i=0;i<10;i++){
      const actions=legalActions(candidate.state),moves=actions.filter(a=>a.mode==='converter');
      const action=moves.find(a=>{const count=moves.filter(b=>b.cardId===a.cardId&&b.position===a.position).length;return multiple?count>1:count===1;});
      if(action)return {session:candidate,action};
      candidate.dispatch(actions.find(a=>a.mode==='normal'));
    }
    throw Error('Conversion fixture not found');
  }
  for(const choice of ['place','convert','armed-place','armed-convert']){
    const {session:game,action:a}=fixture();await inject(game);const before=await state();
    if(choice.startsWith('armed')){
      const otherId=before.hands[before.current].find(id=>id!==a.cardId);
      await page.locator(`[data-select="${otherId}"]`).click();await page.locator('[data-card-actions="hand"] [data-action="convert"]').click();
    }
    await page.locator(`[data-select="${a.cardId}"]`).dragTo(page.locator(`[data-cell="${a.position}"]`));
    assert.deepEqual(await state(),before,'Dropping must only preview, including after a previous Converter selection');
    assert.equal(await page.locator(`[data-cell="${a.position}"] .placement-preview [data-card="${a.cardId}"]`).count(),1);
    assert.ok(await page.locator('[data-card-actions="board"] [data-action="play"]').isEnabled());
    assert.ok(await page.locator(`[data-convert-target="${a.target}"]`).isEnabled());
    await page.setViewportSize({width:choice==='place'?1100:390,height:950});await checkLayout();
    if(choice==='place')await screenshot({path:'reports/drag-choice-1100.png',fullPage:true});
    if(choice==='convert')await screenshot({path:'reports/drag-choice-390.png',fullPage:true});
    const convert=choice.endsWith('convert');
    if(convert)await page.locator(`[data-convert-target="${a.target}"]`).click();else await page.locator('[data-card-actions="board"] [data-action="play"]').click();
    assert.deepEqual(await state(),dispatch(before,convert?a:{type:'move',mode:'normal',cardId:a.cardId,position:a.position}),'Only the chosen branch commits');
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('GEMAS-playtest-0.1')));assert.equal(stored.cursor,game.cursor+1);
    const footer=page.locator('.test-controls');assert.equal(await page.locator('.lab-panel').count(),0);
    await footer.getByRole('button',{name:'Desfazer',exact:true}).click();assert.deepEqual(await state(),before);
    await footer.getByRole('button',{name:'Refazer',exact:true}).click();assert.deepEqual(await state(),dispatch(before,convert?a:{type:'move',mode:'normal',cardId:a.cardId,position:a.position}));
    if(choice==='place'){
      const current=await state(),download=page.waitForEvent('download');await footer.getByRole('button',{name:'Exportar partida',exact:true}).click();
      const exported=await readFile(await (await download).path(),'utf8');assert.deepEqual(GameSession.load(exported).state,current);
      const chooser=page.waitForEvent('filechooser');await footer.getByRole('button',{name:'Carregar partida',exact:true}).click();await (await chooser).setFiles({name:'GEMAS.json',mimeType:'application/json',buffer:Buffer.from(exported)});
      await page.waitForFunction(()=>document.querySelector('.notice')?.textContent.includes('restaurada'));assert.deepEqual(await state(),current);
      const oldChooser=page.waitForEvent('filechooser');await page.locator('.test-controls').getByRole('button',{name:'Carregar partida',exact:true}).click();await (await oldChooser).setFiles({name:'GEMAS-antiga.json',mimeType:'application/json',buffer:Buffer.from(oldText)});
      await page.waitForFunction(()=>document.querySelector('.notice.error')?.textContent.includes('regras anteriores'));assert.deepEqual(await state(),current);
    }

  }
  checks.push('Native drag-and-drop preserves state, hand, deck and turn until on-card OK or target Converter; both branches work even after a previous conversion mode; footer undo/redo, save/load roundtrip and refusal of legacy imports work without laboratory.');
  await page.setViewportSize({width:768,height:1024});
  for(const path of ['table','bar-unique','bar-selected','bar-multiple','target-before-cell','hand-before-cell','table-six']){
    const {session:game,action:a}=fixture(path==='bar-multiple',path==='table-six'?6:4);await inject(game);
    const before=await state();assert.equal(await page.locator('#score-panel').getAttribute('open'),null);
    assert.equal(await page.locator('.score-table-body').isVisible(),false);
    const expectedHand=before.hands[before.current].filter(id=>conversionMoves(before,id).length).sort((a,b)=>a-b);
    const hintedHand=await page.locator('.current-hand .hand-card.can-convert').evaluateAll(els=>els.map(e=>Number(e.dataset.select)).sort((a,b)=>a-b));assert.deepEqual(hintedHand,expectedHand);
    await page.locator(`[data-select="${a.cardId}"]`).click();
    const expectedTargets=[...new Set(conversionMoves(before,a.cardId).map(o=>o.target))].sort((a,b)=>a-b);
    assert.deepEqual(await page.locator('.board-cell.convertible').evaluateAll(els=>els.map(e=>Number(e.dataset.cell)).sort((a,b)=>a-b)),expectedTargets);
    if(path==='table'||path==='table-six'){
      await page.locator('#help').uncheck();assert.equal(await page.locator('.can-convert,.board-cell.convertible').count(),0);await page.locator('#help').check();
      await page.locator('#score-panel>summary').click();await page.waitForFunction(()=>document.querySelector('.score-toggle-label').textContent==='Recolher');
      await page.locator(`[data-cell="${a.position}"]`).click();assert.notEqual(await page.locator('#score-panel').getAttribute('open'),null);
      await page.locator('#score-panel>summary').click();await page.waitForFunction(()=>document.querySelector('.score-toggle-label').textContent==='Expandir');
      await page.setViewportSize({width:path==='table'?1100:320,height:950});await checkLayout();
      await screenshot({path:path==='table'?'reports/compact-conversion-1100.png':'reports/compact-conversion-6columns-320.png',fullPage:true});
      const handBox=await page.locator('.current-hand .hand-cards').boundingBox(),barBox=await page.locator('.current-hand .action-bar').boundingBox();
      if(path==='table')assert.ok(Math.abs(handBox.y-barBox.y)<2);
      assert.ok(handBox.height<=92);
      await page.locator(`[data-convert-target="${a.target}"]`).click();
    }else if(path==='target-before-cell'){
      await page.locator(`[data-convert-target="${a.target}"]`).click();assert.deepEqual(await state(),before);
      assert.equal(await page.locator('.action-bar [data-action="play"]').count(),0);
      await page.locator(`[data-cell="${a.position}"]`).click();
    }else if(path==='hand-before-cell'){
      await page.locator('[data-card-actions="hand"] [data-action="convert"]').click();assert.deepEqual(await state(),before);
      await page.locator(`[data-convert-target="${a.target}"]`).click();
      await page.locator(`[data-cell="${a.position}"]`).click();
    }else{
      await page.locator(`[data-cell="${a.position}"]`).click();
      if(path==='bar-selected')await page.locator(`[data-cell="${a.target}"]`).click();
      await page.locator('.action-bar [data-action="convert"]').click();
      if(path==='bar-multiple'){assert.deepEqual(await state(),before);await page.locator(`[data-cell="${a.target}"]`).click();}
    }
    assert.equal((await state()).board[a.target].owner,before.current);
    assert.deepEqual(await state(),game.dispatch(a),'Conversion must dispatch exactly one complete move');
    assert.equal(await page.locator('#score-panel').getAttribute('open'),null);
  }
  await page.setViewportSize({width:768,height:1024});
  checks.push('Conversion help marks legal hand cards and targets before choosing a cell; table/bar/hand conversion paths commit once without extra OK.');
  const session=new GameSession({seed:'browser-conversion',config:{colors:2,shapes:2,allowLastConversion:true,opener:'branco'},players:{branco:'human',preto:'human'},difficulty:'beginner',theme:'marble'});
  await inject(session);assert.equal(await page.locator('.hand-card').count(),8);await page.locator('[data-opening="preto"]').click();await page.getByRole('button',{name:'Confirmar abertura'}).click();
  assert.equal(await page.locator('#chains').isChecked(),true);assert.equal(await page.locator('.connection-overlay line').count(),0);
  assert.equal(await page.locator('.hand-card.can-convert').count(),0);
  for(const owner of ['branco','preto']){assert.equal((await state()).current,owner);assert.equal((await state()).moves[owner],0);assert.equal(conversionMoves(await state(),(await state()).hands[owner][0]).length,0);if(owner==='branco'){const b=await state(),a=legalActions(b)[0];await page.locator(`[data-select="${a.cardId}"]`).click();await page.locator(`[data-cell="${a.position}"]`).click();assert.equal(await page.locator('[data-convert-target]').count(),0);await page.locator('[data-card-actions="board"] [data-action="play"]').click();}}
  await inject(session);await page.locator('[data-opening="preto"]').click();await page.getByRole('button',{name:'Confirmar abertura'}).click();
  await page.locator('#score-panel>summary').click();
  let conversions=0,steps=0;
  while((await state()).phase!=='finalizada'){
    const before=await state(),actions=legalActions(before),a=actions.find(a=>a.mode==='converter')||actions[0];assert.ok(a);
    const placement=await page.locator('.current-hand .action-bar').boundingBox(),board=await page.locator('.game-board').boundingBox();
    assert.ok(placement.y+placement.height<board.y,'Actions must sit beside the active hand, above the board');
    assert.equal(await page.locator('.current-hand').getAttribute('data-hand-owner'),before.current);
    await page.locator(`[data-select="${a.cardId}"]`).click();
    assert.equal(await page.locator('[data-card-actions="hand"] button').count(),2);
    await page.locator(`[data-cell="${a.position}"]`).click();
    assert.equal(await page.locator('[data-card-actions="board"] button').count(),2);
    assert.equal(await page.locator('button button').count(),0,'Card controls must not be nested buttons');
    assert.deepEqual(await state(),before,'Preview modified the saved state');
    if(a.mode==='converter'){
      if(conversions===1){await screenshot({path:'reports/on-card-controls.png',fullPage:true});}
      await page.locator(`[data-convert-target="${a.target}"]`).click();conversions++;
    }else await page.locator('[data-card-actions="board"] [data-action="play"]').click();
    const after=await state();assert.equal(after.board[a.position].id,a.cardId);if(a.mode==='converter')assert.deepEqual(after.cards,before.cards);assert.ok(++steps<=14);
    for(const group of scoreTableData(after))for(const row of group.rows){
      const tr=page.locator(`[data-score-kind="${group.kind}"] [data-score-owner="${row.owner}"]`);
      for(const value of group.values)assert.equal(await tr.locator(`[data-score-value="${value}"]`).innerText(),String(row.points[value]||0));
      assert.equal(await tr.locator('.score-subtotal').innerText(),String(row.total));
    }
    await page.waitForFunction(n=>document.querySelectorAll('.connection-overlay line').length===n,boardConnections(after).length);
    if(steps===5){
      assert.ok(await page.locator('.color-connection').count()>0);assert.ok(await page.locator('.shape-connection').count()>0);
      await page.locator('#score-panel>summary').click();
      for(const width of [768,390,320]){await page.setViewportSize({width,height:width===768?1100:844});await checkLayout();assert.ok((await page.locator('.current-hand .hand-card').first().boundingBox()).height<=(width===768?92:80));await screenshot({path:`reports/game-${width}.png`,fullPage:true});}
      await page.locator('#score-panel>summary').click();
      await page.locator('.score-table-body').scrollIntoViewIfNeeded();
      const sticky=await page.locator('.score-strip').boundingBox();assert.ok(sticky.y>=0&&sticky.y<10,'General score stays visible during scroll');
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.locator('#chains').uncheck();assert.equal(await page.locator('.connection-overlay line').count(),0);await page.locator('#chains').check();
    }
  }
  assert.ok(conversions>0);assert.ok(['maos-vazias','tabuleiro-cheio'].includes((await state()).endReason));
  await page.getByRole('button',{name:'Ver sequências'}).click();await page.locator('.dialog').waitFor();await checkLayout();await page.keyboard.press('Escape');
  assert.equal(await page.locator('.lab-panel').count(),0);await page.locator('.test-controls').getByRole('button',{name:'Desfazer',exact:true}).click();assert.equal((await state()).phase,'jogando');await page.getByRole('button',{name:'Refazer',exact:true}).click();assert.equal((await state()).phase,'finalizada');
  checks.push('Detail panel starts collapsed, preserves toggles during moves, and general score remains sticky; compact cards keep square gem viewports at 320/390/768/1100px, including six columns.');
  checks.push(`Manual game: ${conversions} on-card conversions, on-card OK, preview, active-hand toolbar, per-symbol scores, default links and toggle, 768/390/320px, undo/redo.`);
  for(const difficulty of ['beginner','experienced']){
    const ai=new GameSession({seed:'browser-worker-'+difficulty,config:{colors:4,shapes:4,columns:difficulty==='experienced'?6:4},players:{branco:'computer',preto:'computer'},difficulty,theme:'rococo'});
    await page.setViewportSize({width:1100,height:1000});await inject(ai);
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('GEMAS-playtest-0.1')).state.phase==='finalizada',{},{timeout:60000});
    const s=await state();assert.equal(s.board.filter(Boolean).length,s.config.active.length);assert.ok(Number.isFinite(score(s).branco.total));await screenshot({path:`reports/worker-${difficulty}.png`,fullPage:true});
    await page.locator('.test-controls').getByRole('button',{name:'Desfazer',exact:true}).click();const reviewed=await state();const reviewCursor=await page.evaluate(()=>JSON.parse(localStorage.getItem('GEMAS-playtest-0.1')).cursor);await page.waitForTimeout(150);assert.deepEqual(await state(),reviewed);assert.ok(await page.locator('.test-controls').getByRole('button',{name:'Retomar computador',exact:true}).isVisible());await page.locator('.test-controls').getByRole('button',{name:'Refazer',exact:true}).click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('GEMAS-playtest-0.1')).cursor),reviewCursor+1);assert.deepEqual(await state(),s);
    await page.locator('.test-controls').getByRole('button',{name:'Desfazer',exact:true}).click();
    await page.locator('.test-controls').getByRole('button',{name:'Retomar computador',exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('GEMAS-playtest-0.1')).state.phase==='finalizada',{},{timeout:60000});assert.deepEqual(await state(),s);
    await page.locator('.test-controls').getByRole('button',{name:'Desfazer',exact:true}).click();const manualState=await state();
    await page.locator('.test-controls').getByRole('button',{name:'Controle manual',exact:true}).click();assert.deepEqual(await state(),manualState);
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('GEMAS-playtest-0.1')).setup.players),{branco:'human',preto:'human'});
    checks.push(`Real Worker ${difficulty}: complete ${s.config.rows}×${s.config.columns} game, ${s.history.length} history entries.`);
  }
  for(const difficulty of ['beginner','experienced'])for(const human of ['branco','preto']){
    await page.goto('http://127.0.0.1:4188/dev.html');
    await page.locator('[data-setting="opponent"][data-value="computer"]').click();
    await page.locator(`[data-setting="difficulty"][data-value="${difficulty}"]`).click();
    await page.locator(`[data-setting="human"][data-value="${human}"]`).click();
    await page.getByRole('button',{name:'Começar partida'}).click();
    await page.waitForFunction(owner=>{const s=JSON.parse(localStorage.getItem('GEMAS-playtest-0.1')).state;return s.current===owner;},human,{timeout:60000});
    if((await state()).phase==='abertura'){await page.locator('.opening-option').first().click();await page.getByRole('button',{name:'Confirmar abertura'}).click();}
    await page.waitForFunction(owner=>{const s=JSON.parse(localStorage.getItem('GEMAS-playtest-0.1')).state;return s.phase==='jogando'&&s.current===owner;},human,{timeout:60000});
    const before=await state(),a=legalActions(before)[0];
    await page.locator(`[data-select="${a.cardId}"]`).click();await page.locator(`[data-cell="${a.position}"]`).click();await page.locator('.action-bar [data-action="play"]').click();
    await page.waitForFunction(turn=>{const s=JSON.parse(localStorage.getItem('GEMAS-playtest-0.1')).state;return s.turn>=turn+2;},before.turn,{timeout:60000});
    assert.equal((await state()).current,human);assert.equal(await page.locator('.notice.error').count(),0);
    await page.setViewportSize({width:320,height:844});await checkLayout();
    if(difficulty==='experienced'&&human==='preto')await screenshot({path:'reports/game-variable-palette-320.png',fullPage:true});
  }
  checks.push('New game UI starts both computer levels for human Branco and Preto and returns the turn after a legal reply.');
  // The standalone is opened without a server and receives its own file-origin storage.
  await page.goto(new URL('../ABRIR_GEMAS.html',import.meta.url).href);await page.locator('.setup-header').waitFor();await page.evaluate(()=>document.fonts.ready);await checkLayout();
  await page.locator('[data-setting="opponent"][data-value="manual"]').click();await page.getByRole('button',{name:'Começar partida'}).click();await page.locator('.opening-option').first().click();await page.getByRole('button',{name:'Confirmar abertura'}).click();assert.equal(await page.locator('.board-cell').count(),16);
  checks.push('Standalone file opens without server, with embedded SVGs and fonts.');
  const offline=new GameSession({seed:'offline-worker',config:{colors:3,shapes:5},players:{branco:'computer',preto:'computer'},difficulty:'beginner',theme:'marble'});await inject(offline);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('GEMAS-playtest-0.1')).state.phase==='finalizada',{},{timeout:30000});
  checks.push('Standalone embedded Blob Worker completes a game without imports or server.');
  await page.goto(new URL('../index.html',import.meta.url).href);await page.locator('.setup-header').waitFor();
  await page.locator('[data-setting="opponent"][data-value="manual"]').click();await page.getByRole('button',{name:'Começar partida'}).click();await page.locator('.opening-option').first().click();await page.getByRole('button',{name:'Confirmar abertura'}).click();
  assert.equal(await page.locator('.board-cell').count(),16);
  checks.push('Direct file index.html starts a game without CORS errors.');
  await page.goto(new URL('../dev.html',import.meta.url).href);await page.waitForURL('**/index.html');await page.locator('.setup-header').waitFor();
  checks.push('Opening dev.html directly redirects to the standalone index.html in Chrome.');
  // Simulate browsers that deny background workers, including during opening.
  const fallback=await browser.newPage();const fallbackErrors=[];fallback.on('pageerror',e=>fallbackErrors.push(e.message));
  await fallback.addInitScript(()=>{window.Worker=class{constructor(){throw new DOMException('Workers unavailable','SecurityError');}};});
  await fallback.goto('http://127.0.0.1:4188/dev.html');
  for(const difficulty of ['beginner','experienced']){
    const ai=new GameSession({seed:'fallback-'+difficulty,config:{colors:3,shapes:5},players:{branco:'computer',preto:'computer'},difficulty,theme:'marble'});
    await fallback.evaluate(text=>localStorage.setItem('GEMAS-playtest-0.1',text),ai.serialize());await fallback.reload();await fallback.getByRole('button',{name:'Retomar',exact:true}).click();
    await fallback.waitForFunction(()=>JSON.parse(localStorage.getItem('GEMAS-playtest-0.1')).state.phase==='finalizada',{},{timeout:60000});
    assert.equal(await fallback.locator('.notice.error').count(),0);
  }
  assert.deepEqual(fallbackErrors,[]);await fallback.close();
  checks.push('Both computer levels complete opening and game even when the browser denies Workers.');
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  await writeFile(new URL('../reports/validation.json',import.meta.url),JSON.stringify({status:'passed',checks,errors,failed},null,2));console.log(checks.join('\n'));
}finally{await browser.close();}
