import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.GEMAS_PLAYWRIGHT_MODULE||'playwright');
import {legalActions,score} from '../src/engine.mjs';
import {GameSession} from '../src/session.mjs';
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],failed=[],checks=[];
const page=await browser.newPage({viewport:{width:768,height:1024}});
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('GEMAS-playtest-0.1')).state);
const inject=async session=>{await page.evaluate(text=>localStorage.setItem('GEMAS-playtest-0.1',text),session.serialize());await page.reload();await page.getByRole('button',{name:'Retomar',exact:true}).click();};
const checkLayout=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Horizontal page overflow');
try{
  await page.goto('http://127.0.0.1:4188/dev.html');await page.evaluate(()=>document.fonts.ready);
  for(const width of [768,390,320]){await page.setViewportSize({width,height:width===768?1024:844});await checkLayout();assert.equal(await page.locator('.palette-slot img').count(),16);
    const images=await page.locator('.palette-slot img').evaluateAll(imgs=>imgs.map(i=>({loaded:i.complete&&i.naturalWidth>0,w:i.getBoundingClientRect().width,h:i.getBoundingClientRect().height})));
    assert.ok(images.every(i=>i.loaded&&Math.abs(i.w-(width<=620?30:34))<.1&&Math.abs(i.h-i.w)<.1));
    await page.screenshot({path:`reports/setup-${width}.png`,fullPage:true});
  }
  checks.push('Setup 768/390/320px, exact 16 Figma SVG slots and local fonts, no horizontal overflow.');
  await page.setViewportSize({width:768,height:1024});await page.locator('[data-columns="6"]').click();
  assert.match(await page.locator('.deck-summary').innerText(),/32 cartas/);assert.match(await page.locator('.deck-summary').innerText(),/64 gemas/);assert.doesNotMatch(await page.locator('.deck-summary').innerText(),/Nenhuma gema se repete/);
  await page.getByRole('button',{name:'Diminuir cores'}).click();assert.equal(await page.getByLabel('Quantidade de formas').innerText(),'8');checks.push('Independent palette controls and accurate variable deck/repetition text.');
  const session=new GameSession({seed:'browser-conversion',config:{colors:2,shapes:2,allowLastConversion:true,opener:'branco'},players:{branco:'human',preto:'human'},difficulty:'beginner',theme:'marble'});
  await inject(session);assert.equal(await page.locator('.hand-card').count(),8);await page.locator('[data-opening="preto"]').click();await page.getByRole('button',{name:'Confirmar abertura'}).click();
  let conversions=0,steps=0;
  while((await state()).phase!=='finalizada'){
    const before=await state(),actions=legalActions(before),a=actions.find(a=>a.mode==='converter')||actions[0];assert.ok(a);
    await page.locator(`[data-select="${a.cardId}"]`).click();await page.locator(`[data-cell="${a.position}"]`).click();
    assert.deepEqual(await state(),before,'Preview modified the saved state');
    if(a.mode==='converter'){await page.locator('[data-mode="converter"]').click();await page.locator(`[data-cell="${a.target}"]`).click();conversions++;}
    await page.getByRole('button',{name:'OK · confirmar',exact:true}).click();
    const after=await state();assert.equal(after.board[a.position].id,a.cardId);if(a.mode==='converter')assert.deepEqual(after.cards,before.cards);assert.ok(++steps<=14);
    if(steps===5){await page.setViewportSize({width:390,height:844});await page.locator('#chains').check();await page.screenshot({path:'reports/game-390.png',fullPage:true});await checkLayout();}
  }
  assert.ok(conversions>0);assert.ok(['maos-vazias','tabuleiro-cheio'].includes((await state()).endReason));
  await page.getByRole('button',{name:'Ver sequências'}).click();await page.locator('.dialog').waitFor();await checkLayout();await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Laboratório',exact:true}).click();await page.getByRole('button',{name:'Desfazer',exact:true}).click();assert.equal((await state()).phase,'jogando');await page.getByRole('button',{name:'Refazer',exact:true}).click();assert.equal((await state()).phase,'finalizada');
  checks.push(`Manual game: ${conversions} conversions, immutable gems, preview/OK, score dialog, undo/redo and mobile board.`);
  for(const difficulty of ['beginner','experienced']){
    const ai=new GameSession({seed:'browser-worker-'+difficulty,config:{colors:4,shapes:4,columns:difficulty==='experienced'?6:4},players:{branco:'computer',preto:'computer'},difficulty,theme:'rococo'});
    await page.setViewportSize({width:1100,height:1000});await inject(ai);
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('GEMAS-playtest-0.1')).state.phase==='finalizada',{},{timeout:60000});
    const s=await state();assert.equal(s.board.filter(Boolean).length,s.config.active.length);assert.ok(Number.isFinite(score(s).branco.total));await page.screenshot({path:`reports/worker-${difficulty}.png`,fullPage:true});
    checks.push(`Real Worker ${difficulty}: complete ${s.config.rows}×${s.config.columns} game, ${s.history.length} history entries.`);
  }
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
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  await writeFile(new URL('../reports/validation.json',import.meta.url),JSON.stringify({status:'passed',checks,errors,failed},null,2));console.log(checks.join('\n'));
}finally{await browser.close();}
