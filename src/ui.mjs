import {GameSession} from './session.mjs';
import {newGame,score,legal,dispatch,conversionOptions,cardById} from './engine.mjs';
import {OWNERS,COLOR_IDS,COLOR_NAMES,SHAPE_NAMES,other,coordinate,normalizeConfig} from './config.mjs';
import {analyzeDeck} from './generator.mjs';
import {observeGame} from './opponent.mjs';
import {OpponentController} from './opponent-controller.mjs';

const root=document.querySelector('#app'),STORAGE_KEY='GEMAS-playtest-0.1',PREF_KEY='GEMAS-preferences-0.1';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asset=path=>typeof GEMAS_ASSETS==='undefined'?`./assets/${path}`:GEMAS_ASSETS[path];
const ownerName=p=>p==='branco'?'Branco':'Preto';
const colorName=c=>COLOR_NAMES[COLOR_IDS.indexOf(c)];
const attributeName=(kind,value)=>kind==='color'?colorName(value):SHAPE_NAMES[value-1];
const freshSeed=()=>`GEMAS-${Date.now().toString(36).toUpperCase()}`;
const defaultSettings={columns:4,colors:6,shapes:8,opponent:'computer',difficulty:'beginner',human:'branco',theme:'marble',allowLastConversion:false,blockFirstConversion:false,seed:freshSeed()};
let settings={...defaultSettings};
try{const old=JSON.parse(localStorage.getItem(PREF_KEY));if(old){const candidate={...settings,...old,seed:freshSeed()};normalizeConfig(candidate);if(!['computer','manual'].includes(candidate.opponent)||!['beginner','experienced'].includes(candidate.difficulty)||!OWNERS.includes(candidate.human)||!['marble','rococo'].includes(candidate.theme))throw Error('Preferências inválidas.');settings=candidate;}}catch{settings={...defaultSettings};}
let session=null,screen='setup',laboratory=false,modal=null,notice='',isError=false,selection={cardId:null,position:null,target:null,mode:'normal'},openingChoice=null,help=true,showChains=false,paused=false;
const controller=new OpponentController({
  workerFactory:()=>{
    if(typeof GEMAS_WORKER_SOURCE!=='undefined'){const url=URL.createObjectURL(new Blob([GEMAS_WORKER_SOURCE],{type:'text/javascript'}));try{return new Worker(url);}finally{URL.revokeObjectURL(url);}}
    return new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
  },
  onResult:(result,key)=>{if(session?.state===key&&isComputer()&&screen==='game'&&!modal){if(result.action)commit(result.action,result);}},
  onError:error=>{paused=true;notice=`O computador pausou: ${error}. Use Tentar novamente ou controle manual.`;isError=true;render();}
});
function configFromSettings(){return normalizeConfig({columns:settings.columns,colors:settings.colors,shapes:settings.shapes,allowLastConversion:settings.allowLastConversion,blockFirstConversion:settings.blockFirstConversion,...(settings.active?{active:settings.active}:{})});}
function savePreferences(){try{localStorage.setItem(PREF_KEY,JSON.stringify(settings));}catch{}}
function persist(){try{localStorage.setItem(STORAGE_KEY,session.serialize());}catch{notice='Não foi possível salvar no navegador. Use Exportar no laboratório.';}}
function resetSelection(){selection={cardId:null,position:null,target:null,mode:'normal'};openingChoice=null;}
function isComputer(){return Boolean(session&&session.state.phase!=='finalizada'&&session.controller()==='computer');}
function startGame(){
  const setup={seed:settings.seed,config:configFromSettings(),players:Object.fromEntries(OWNERS.map(p=>[p,settings.opponent==='computer'&&p!==settings.human?'computer':'human'])),difficulty:settings.difficulty,theme:settings.theme};
  session=new GameSession(setup);screen='game';paused=false;notice='';isError=false;resetSelection();savePreferences();persist();render();
}
function gem(g,extra=''){
  const x=(g.shape-1)*128,y=COLOR_IDS.indexOf(g.color)*128,label=`${colorName(g.color)}, ${SHAPE_NAMES[g.shape-1]}`;
  return `<svg class="gem ${extra}" viewBox="${x} ${y} 128 128" role="img" aria-label="${label}"><image href="${asset('gemas_atlas_v0.svg')}" width="1024" height="1280"/></svg>`;
}
function cardMarkup(id,owner,{small=false,points=null}={}){
  const c=cardById(session.state,id);
  return `<span class="game-card ${owner} ${small?'small':''}" data-card="${id}">${c.gems.map(g=>gem(g)).join('')}<span class="owner-mark" aria-hidden="true">${owner==='branco'?'○':'●'}</span>${laboratory?`<span class="instance-id">${id}</span>`:''}${points!==null&&points>0?`<span class="card-points">+${points}</span>`:''}</span>`;
}
function cardLabel(id){return cardById(session.state,id).gems.map(g=>`${colorName(g.color)} ${SHAPE_NAMES[g.shape-1]}`).join(' e ');}
function segments(key,values){return `<div class="segments" role="group" aria-label="${key==='opponent'?'Adversário':key==='difficulty'?'Nível':key==='human'?'Sua cor':'Tema'}">${values.map(([value,label])=>`<button type="button" data-setting="${key}" data-value="${value}" aria-pressed="${settings[key]===value}">${label}</button>`).join('')}</div>`;}
function countControl(key,label){return `<div class="count-row"><span>${label}</span><div class="counter"><button data-count="${key}" data-delta="-1" aria-label="Diminuir ${label.toLowerCase()}" ${settings[key]===2?'disabled':''}>−</button><output aria-label="Quantidade de ${label.toLowerCase()}">${settings[key]}</output><button data-count="${key}" data-delta="1" aria-label="Aumentar ${label.toLowerCase()}" ${settings[key]===8?'disabled':''}>+</button></div></div>`;}
function paletteAssets(kind){return `<div class="palette-assets">${Array.from({length:8},(_,i)=>`<span class="palette-slot ${i>=settings[kind]?'inactive':''}" title="${kind==='colors'?COLOR_NAMES[i]:SHAPE_NAMES[i]}"><img src="${asset(`figma/${kind==='colors'?COLOR_IDS[i]+'1':'shape-'+(i+1)}.svg`)}" alt="${kind==='colors'?COLOR_NAMES[i]:SHAPE_NAMES[i]}"></span>`).join('')}</div>`;}
function boardChoice(columns){return `<button class="board-choice ${settings.columns===columns?'selected':''}" data-columns="${columns}" aria-pressed="${settings.columns===columns}"><span class="board-mini" style="--mini-rows:${columns}">${Array.from({length:columns*4},()=>'<i></i>').join('')}</span><strong>4×${columns}</strong><small>${columns*4} casas</small></button>`;}
function deckSummary(){
  const preview=newGame(settings.seed,configFromSettings()),r=analyzeDeck(preview.cards,preview.config),range=values=>{const list=Object.values(values),a=Math.min(...list),b=Math.max(...list);return a===b?String(a):`${a}–${b}`;};
  return `<section class="deck-summary"><h2>Monte desta partida</h2><p class="deck-count">${r.cards} cartas</p><p class="deck-stats">${r.gemSlots} gemas · ${range(r.colors)} de cada cor · ${range(r.shapes)} de cada forma</p><p class="muted">${r.repeatedGems?`As gemas se repetem de forma equilibrada, com até ${r.maxGemCopies} cópias de cada uma.`:'Nenhuma gema se repete.'} O monte tem casas do tabuleiro + 8 cartas e é sorteado no início da partida.</p>${r.repeatedCards?`<p class="muted">${r.repeatedCards} cartas repetem uma composição; até ${r.maxCardCopies} cópias por tipo.</p>`:''}</section>`;
}
function laboratorySetup(){return laboratory?`<section class="lab-setup"><h2>Laboratório</h2><label>Semente da partida<input id="seed" value="${esc(settings.seed)}" maxlength="200" required></label><label class="check-row"><input type="checkbox" id="block-first" ${settings.blockFirstConversion?'checked':''}>Proibir conversão na primeira jogada de cada jogador</label><label>Casas ativas <small>Índices a partir de zero; deixe vazio para todas.</small><input id="mask" value="${esc(settings.active?.join(', ')||'')}" placeholder="0, 1, 2, 4, 5, 6, 8, 9, 10"></label><p class="muted">A mesma semente, versão e configuração reproduzem a distribuição. As opções acima são hipóteses de playtest.</p></section>`:'';}
function setupMarkup(){return `<div class="setup-shell"><header class="setup-header"><div><h1>GEMAS</h1><p>Nova partida</p></div><button class="text-button" data-action="rules">Regras</button></header><div class="setup-columns"><div class="setup-left"><section class="setup-section"><h2>Adversário</h2>${segments('opponent',[['computer','Computador'],['manual','Duas pessoas']])}${settings.opponent==='computer'?segments('difficulty',[['beginner','Iniciante'],['experienced','Experiente']]):''}</section><section class="setup-section"><h2>Sua cor</h2>${segments('human',[['branco','Branco'],['preto','Preto']])}<p class="muted">Quem começa é sorteado. Quem não começa escolhe a cor das duas cartas de abertura.</p></section><section class="setup-section"><h2>Tabuleiro</h2><div class="board-options">${boardChoice(4)}${boardChoice(6)}</div></section><section class="setup-section"><h2>Tema</h2>${segments('theme',[['marble','Mármore'],['rococo','Rococó']])}</section></div><div class="setup-right"><section class="setup-section palette"><h2>Paleta</h2>${countControl('colors','Cores')}${paletteAssets('colors')}${countControl('shapes','Formas')}${paletteAssets('shapes')}<p class="muted">Os níveis usam as primeiras linhas e colunas do atlas: menos cores, mais conversões; menos formas, sequências maiores.</p></section>${deckSummary()}<section class="setup-section"><h2>Regra opcional</h2><label class="optional-row"><span><span>A última carta pode converter</span><small>Quem converte com a última carta fica de mão vazia e passa a vez até o fim da partida.</small></span><input id="allow-last" class="visually-hidden" type="checkbox" role="switch" ${settings.allowLastConversion?'checked':''}><span class="toggle ${settings.allowLastConversion?'on':''}" aria-hidden="true"><img src="${asset('figma/toggle.svg')}" alt=""></span></label></section></div></div>${laboratorySetup()}${notice?`<p class="notice ${isError?'error':''}" role="status">${esc(notice)}</p>`:''}<footer class="setup-footer"><button class="text-button" data-action="lab">${laboratory?'Fechar laboratório':'Laboratório'}</button><div class="start-actions">${hasSaved()?'<button class="text-button" data-action="resume">Retomar</button>':''}<button class="primary" data-action="start">Começar partida</button></div></footer></div>`;}
function hasSaved(){try{return Boolean(localStorage.getItem(STORAGE_KEY));}catch{return false;}}
function handMarkup(owner){const s=session.state,current=s.current===owner&&s.phase==='jogando',disabled=!current||isComputer();
  return `<section class="hand-section ${current?'current-hand':''}"><div class="hand-heading"><h2><span class="player-dot ${owner}"></span>${ownerName(owner)} <span class="muted">· ${s.hands[owner].length} cartas</span></h2>${current?'<span class="turn-tag">Sua vez</span>':''}</div><div class="hand-cards">${s.hands[owner].map(id=>`<button class="hand-card ${selection.cardId===id?'chosen':''}" data-select="${id}" draggable="${!disabled}" aria-label="Selecionar ${cardLabel(id)}" aria-pressed="${selection.cardId===id}" ${disabled?'disabled':''}>${cardMarkup(id,owner)}</button>`).join('')||'<p class="muted">Mão vazia · passa a vez automaticamente.</p>'}</div></section>`;}
function selectedAction(){return {type:'move',cardId:selection.cardId,position:selection.position,mode:selection.mode,...(selection.mode==='converter'?{target:selection.target}:{})};}
function availableConversions(){if(!selection.cardId)return [];const s=session.state,positions=selection.position===null?s.config.active.filter(i=>!s.board[i]):[selection.position];return positions.flatMap(p=>conversionOptions(s,selection.cardId,p));}
function boardMarkup(){const s=session.state,points=score(s),targets=help?new Set(availableConversions().map(o=>o.target)):new Set();
  return `<div class="board-scroll"><div class="game-board" style="--columns:${s.config.columns}" role="group" aria-label="Tabuleiro de 4 linhas e ${s.config.columns} colunas">${s.board.map((cell,i)=>{
    if(!s.config.active.includes(i))return '<div class="inactive-cell" aria-label="Casa inativa"></div>';
    const selected=selection.position===i,target=selection.target===i,perCard=cell?points[cell.owner].perCard.find(c=>c.position===i):null;
    return `<button class="board-cell ${cell?'occupied':'empty'} ${selected?'destination':''} ${target?'target':''} ${targets.has(i)?'convertible':''} ${showChains&&perCard?.points?'scoring-cell':''}" data-cell="${i}" aria-label="${coordinate(i,s.config.columns)}${cell?', '+ownerName(cell.owner)+', '+cardLabel(cell.id):', vazia'}" ${isComputer()||s.phase!=='jogando'?'disabled':''}>${cell?cardMarkup(cell.id,cell.owner,{small:true,points:showChains?perCard.points:null}):selected&&selection.cardId?`<span class="placement-preview">${cardMarkup(selection.cardId,s.current,{small:true})}</span>`:`<span class="empty-plus">＋</span><span class="cell-coordinate">${coordinate(i,s.config.columns)}</span>`}</button>`;
  }).join('')}</div></div>`;
}
function openingMarkup(){const s=session.state,computer=isComputer();return `<section class="opening-panel"><p class="eyebrow">ABERTURA · ${ownerName(s.current)}</p><h2>${computer?'O computador escolhe a abertura':'Escolha a carta que ficará na sua cor'}</h2><p class="muted">${ownerName(s.config.opener)} fará a primeira jogada. A outra carta ficará com ${ownerName(other(s.current))}.</p><div class="opening-cards">${s.deck.slice(0,2).map((id,i)=>`<button data-opening="${i===0?s.current:other(s.current)}" class="opening-option ${openingChoice===(i===0?s.current:other(s.current))?'chosen':''}" aria-label="Escolher carta ${i===0?'A':'B'}" ${computer?'disabled':''}><span>${i===0?'A':'B'}</span>${cardMarkup(id,s.current)}</button>`).join('')}</div><button class="primary" data-action="opening" ${!openingChoice||computer?'disabled':''}>Confirmar abertura</button></section>`;}
function actionMarkup(){const s=session.state;if(s.phase==='finalizada')return '';if(isComputer())return `<section class="action-bar"><p role="status">${paused?'Computador pausado.':'Computador pensando…'}</p><button data-action="pause">${paused?'Tentar novamente':'Pausar'}</button>${paused?'<button data-action="manual">Controle manual</button>':''}</section>`;
  const check=legal(s,selectedAction()),options=availableConversions();
  return `<section class="action-bar"><div class="action-modes"><button data-mode="normal" aria-pressed="${selection.mode==='normal'}">Colocar</button><button data-mode="converter" aria-pressed="${selection.mode==='converter'}" ${!options.length?'disabled':''}>Converter</button></div><p class="action-instruction" role="status">${!selection.cardId?'Escolha ou arraste uma carta da sua mão.':selection.position===null?'Escolha uma casa livre.':selection.mode==='converter'&&selection.target===null?'Escolha uma carta adversária destacada.':check.ok?check.reason:esc(check.reason)}</p><div class="action-buttons"><button class="text-button" data-action="clear">Limpar</button><button class="primary" data-action="play" ${!check.ok?'disabled':''}>OK · confirmar</button></div>${check.ok&&check.coverage.length?`<div class="coverage">${check.coverage.map(c=>`<span>${c.role==='nova'?'Carta nova':'Apoio antigo'} · ${coordinate(c.position,s.config.columns)} · ${colorName(c.color)}</span>`).join('')}</div>`:''}</section>`;
}
function scoreMarkup(){const p=score(session.state);return `<section class="score-strip" aria-label="Pontuação">${OWNERS.map(owner=>`<div class="player-score"><span class="player-dot ${owner}"></span><span>${ownerName(owner)}</span><strong>${p[owner].total}</strong><small>${p[owner].colorPoints} cores + ${p[owner].shapePoints} formas</small></div>`).join('')}<button class="text-button" data-action="score">Ver sequências</button></section>`;}
function labMarkup(){if(!laboratory)return '';const s=session.state,r=analyzeDeck(s.cards,s.config),report=session.reports.slice(0,session.cursor).findLast(Boolean);
  return `<section class="lab-panel"><h2>Laboratório da partida</h2><p>Semente: <strong>${esc(s.seed)}</strong> · ${s.config.colors} cores · ${s.config.shapes} formas · ${s.endReason||'em andamento'}</p><p>${r.uniqueGems} gemas distintas · ${r.repeatedGems} repetições de gemas · ${r.repeatedCards} repetições de cartas · ${s.history.filter(e=>e.type==='pass').length} passes</p><div class="lab-actions"><button data-action="undo" ${!session.cursor?'disabled':''}>Desfazer</button><button data-action="redo" ${session.cursor>=session.commands.length?'disabled':''}>Refazer</button><button data-action="save">Exportar partida</button><button data-action="load">Carregar partida</button><button data-action="export-log">Exportar histórico</button></div><label>Anotações<textarea id="notes" maxlength="100000">${esc(session.notes)}</textarea></label>${report?`<details><summary>Última decisão do computador</summary><p>${esc(report.reason)}</p><p>${report.candidates} candidatas · ${report.replies} respostas</p><p>${esc(report.information)}</p></details>`:''}<details><summary>Histórico · ${s.history.length} registros</summary><ol>${s.history.map(e=>`<li>${ownerName(e.owner)} · ${e.type==='pass'?'Passou':e.type==='opening'?'Abertura':`${e.action.mode==='converter'?'Converteu':'Colocou'} em ${coordinate(e.action.position,s.config.columns)}`} · ${esc(e.reason)}</li>`).join('')}</ol></details></section>`;
}
function gameMarkup(){const s=session.state,p=score(s),human=OWNERS.find(o=>session.setup.players[o]==='human')||s.current,top=session.setup.players.branco===session.setup.players.preto?s.current:human;
  const result=s.phase==='finalizada'?`<section class="result"><p class="eyebrow">${s.endReason==='maos-vazias'?'AMBAS AS MÃOS VAZIAS':'TABULEIRO COMPLETO'}</p><h2>${p.winner==='empate'?'Empate':ownerName(p.winner)+' venceu'}</h2><p>Branco ${p.branco.total} × Preto ${p.preto.total}</p><button class="primary" data-action="new">Nova partida</button></section>`:'';
  return `<div class="play-shell"><header class="game-header"><button class="brand-link" data-action="home">GEMAS</button><div class="game-meta">${s.config.rows}×${s.config.columns} · ${s.board.filter(Boolean).length}/${s.config.active.length} casas · ${s.deck.length} no monte</div><nav><button class="text-button" data-action="new">Nova partida</button><button class="text-button" data-action="rules">Regras</button><button class="text-button" data-action="lab">Laboratório</button></nav></header>${scoreMarkup()}${result}${handMarkup(top)}${s.phase==='abertura'?openingMarkup():`<div class="board-toolbar"><span>Tabuleiro</span><label><input id="help" type="checkbox" ${help?'checked':''}>Ajuda de conversão</label><label><input id="chains" type="checkbox" ${showChains?'checked':''}>Pontuação nas cartas</label></div>${boardMarkup()}${actionMarkup()}`}${handMarkup(other(top))}${notice?`<p class="notice ${isError?'error':''}" role="status">${esc(notice)}</p>`:''}${labMarkup()}</div>`;
}
function rulesMarkup(){return `<h2>Como jogar GEMAS</h2><p>Branco e Preto disputam as cartas do tabuleiro. Cada carta tem duas gemas de cores e formas diferentes. Elas permanecem iguais quando a posse muda.</p><ol><li>Comece com quatro cartas abertas. Quem não começa escolhe a posse das duas cartas de abertura; cada jogador recebe uma.</li><li>Coloque uma carta da mão em qualquer casa livre. Uma colocação normal compra uma carta do monte.</li><li>Para converter, coloque da mão ao lado de uma carta adversária. A carta nova cobre uma cor do alvo; outra carta sua, já no tabuleiro e vizinha do alvo, cobre a outra cor. São sempre duas cartas diferentes. Converta um único alvo e não compre. Formas e sequências não dão proteção.</li><li>Conexões incluem lados e cantos. Para cada jogador, uma sequência conectada de três ou mais cartas vale +1 por carta, separadamente para cada cor e forma. Uma carta pode pontuar pelos quatro atributos. Cartas sem o atributo ou de outra posse não fazem ponte. Não há bônus por simples grupo de posse.</li><li>A última carta da mão não pode converter, exceto na variante. Nela, a mão vazia passa automaticamente. A partida termina com todas as casas ativas ocupadas ou com as duas mãos vazias. Conte somente as cartas no tabuleiro.</li></ol><p>Os pontos são recalculados após cada jogada. Vence o maior total; igualdade é empate. A primeira jogada pode converter, salvo quando a opção de laboratório proíbe.</p><p class="muted">Protótipo GEMAS 0.1 · contrato de playtest. As opções de laboratório permitem investigar regras sem alterar a partida em andamento.</p>`;}
function scoreDetails(){const s=session.state,p=score(s);return `<h2>Sequências que pontuam</h2><p>+1 por carta em cada componente de 3 ou mais, por cor ou forma.</p>${OWNERS.map(owner=>`<section><h3>${ownerName(owner)} · ${p[owner].total} pontos</h3><ul>${p[owner].chains.map(c=>`<li><strong>${attributeName(c.kind,c.value)}</strong> · ${c.positions.map(i=>coordinate(i,s.config.columns)).join(', ')} · +${c.points}</li>`).join('')||'<li>Nenhuma sequência pontua ainda.</li>'}</ul></section>`).join('')}`;}
function modalMarkup(){if(!modal)return '';return `<div class="modal-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-label="${modal==='rules'?'Regras':'Sequências'}" tabindex="-1"><button class="dialog-close" data-action="close" aria-label="Fechar">×</button>${modal==='rules'?rulesMarkup():scoreDetails()}</section></div>`;}
function render(){document.body.dataset.theme=screen==='game'?session.setup.theme:settings.theme;root.innerHTML=(screen==='setup'?setupMarkup():gameMarkup())+modalMarkup()+'<input type="file" id="load-file" accept=".json,application/json" hidden>';
  if(modal){controller.cancel();root.querySelector('.dialog').focus();}else scheduleComputer();
}
function scheduleComputer(){if(screen!=='game'||!isComputer()||paused||modal){controller.cancel();return;}controller.start(session.state,{observation:observeGame(session.state),options:{difficulty:session.setup.difficulty}});}
function commit(action,report=null){try{controller.cancel();session.dispatch(action,report);notice='';isError=false;resetSelection();persist();render();}catch(error){notice=error.message;isError=true;render();}}
function download(name,text){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function setDestination(position){if(!session||isComputer()||session.state.phase!=='jogando')return;
  if(session.state.board[position]){if(selection.mode==='converter'&&availableConversions().some(o=>o.target===position))selection.target=position;}
  else{selection.position=position;selection.target=null;if(selection.mode==='converter'){const opts=conversionOptions(session.state,selection.cardId,position);if(opts.length===1)selection.target=opts[0].target;}}
  render();
}
root.addEventListener('click',event=>{const button=event.target.closest('button');if(!button||button.disabled)return;
  try{
    if(button.dataset.setting){settings[button.dataset.setting]=button.dataset.value;savePreferences();render();return;}
    if(button.dataset.count){const key=button.dataset.count;settings[key]=Math.max(2,Math.min(8,settings[key]+Number(button.dataset.delta)));savePreferences();render();return;}
    if(button.dataset.columns){settings.columns=Number(button.dataset.columns);delete settings.active;savePreferences();render();return;}
    if(button.dataset.select){selection.cardId=Number(button.dataset.select);selection.target=null;if(selection.mode==='converter'){const opts=availableConversions();if(!opts.length)selection.mode='normal';else if(selection.position!==null&&opts.length===1)selection.target=opts[0].target;}render();return;}
    if(button.dataset.cell!==undefined){setDestination(Number(button.dataset.cell));return;}
    if(button.dataset.opening){openingChoice=button.dataset.opening;render();return;}
    if(button.dataset.mode){selection.mode=button.dataset.mode;selection.target=null;const opts=availableConversions();if(selection.mode==='converter'&&selection.position!==null&&opts.length===1)selection.target=opts[0].target;render();return;}
    switch(button.dataset.action){
      case 'start':startGame();break;
      case 'resume':session=GameSession.load(localStorage.getItem(STORAGE_KEY));screen='game';notice='';paused=false;resetSelection();render();break;
      case 'home':controller.cancel();screen='setup';notice='';render();break;
      case 'new':controller.cancel();screen='setup';settings.seed=freshSeed();notice='';resetSelection();render();break;
      case 'lab':laboratory=!laboratory;render();break;
      case 'rules':modal='rules';render();break;
      case 'score':modal='score';render();break;
      case 'close':modal=null;render();break;
      case 'opening':commit({type:'opening',firstOwner:openingChoice});break;
      case 'play':commit(selectedAction());break;
      case 'clear':resetSelection();render();break;
      case 'undo':controller.cancel();session.undoHumanTurn();paused=false;resetSelection();persist();render();break;
      case 'redo':controller.cancel();session.redoHumanTurn();paused=false;resetSelection();persist();render();break;
      case 'pause':paused=!paused;render();break;
      case 'manual':controller.cancel();session.setup.players={branco:'human',preto:'human'};paused=false;notice='Controle manual nas duas mãos.';persist();render();break;
      case 'save':download(`GEMAS-${session.state.seed}.json`,session.serialize());break;
      case 'load':root.querySelector('#load-file').click();break;
      case 'export-log':download('GEMAS-historico.json',JSON.stringify({seed:session.state.seed,config:session.state.config,history:session.state.history},null,2));break;
    }
  }catch(error){notice=error.message;isError=true;render();}
});
root.addEventListener('change',async event=>{const el=event.target;
  try{
    if(el.id==='allow-last'){settings.allowLastConversion=el.checked;savePreferences();render();}
    if(el.id==='block-first'){settings.blockFirstConversion=el.checked;savePreferences();}
    if(el.id==='seed'){if(!el.value.trim())throw Error('Informe uma semente.');settings.seed=el.value.trim();savePreferences();render();}
    if(el.id==='mask'){if(el.value.trim()){const active=el.value.split(',').map(v=>Number(v.trim()));normalizeConfig({...configFromSettings(),active,positions:undefined});settings.active=active;}else delete settings.active;savePreferences();render();}
    if(el.id==='help'){help=el.checked;render();}
    if(el.id==='chains'){showChains=el.checked;render();}
    if(el.id==='load-file'&&el.files[0]){session=GameSession.load(await el.files[0].text());screen='game';paused=false;notice='Partida de GEMAS restaurada.';resetSelection();persist();render();}
  }catch(error){notice=error.message;isError=true;render();}
});
root.addEventListener('input',event=>{if(event.target.id==='notes'){session.notes=event.target.value;persist();}});
root.addEventListener('dragstart',event=>{const button=event.target.closest('[data-select]');if(!button||button.disabled)return;selection.cardId=Number(button.dataset.select);selection.target=null;event.dataTransfer.setData('text/plain',button.dataset.select);event.dataTransfer.effectAllowed='move';});
root.addEventListener('dragover',event=>{if(event.target.closest('[data-cell]'))event.preventDefault();});
root.addEventListener('drop',event=>{const cell=event.target.closest('[data-cell]');if(!cell)return;event.preventDefault();setDestination(Number(cell.dataset.cell));});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&modal){modal=null;render();}if(event.key==='Tab'&&modal){const buttons=[...root.querySelectorAll('.dialog button')],first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
root.addEventListener('click',event=>{if(event.target.classList.contains('modal-backdrop')){modal=null;render();}});
render();
