import {GameSession} from './session.mjs';
import {newGame,score,legal,cardById} from './engine.mjs';
import {OWNERS,COLOR_IDS,COLOR_NAMES,SHAPE_NAMES,RULES_VERSION,GENERATOR_VERSION,other,adjacent,normalizeConfig} from './config.mjs';
import {analyzeDeck} from './generator.mjs';
import {observeGame,chooseAction} from './opponent.mjs';
import {OpponentController} from './opponent-controller.mjs';
import {scoreTableData,boardConnections,conversionMoves,moveSummary,CONNECTION_COLORS} from './game-view.mjs';
import {boardLayout,neighborSlot} from './layout.mjs';
import {TUTORIAL,tutorialSetup} from './tutorial.mjs';

// Interface do GEMAS 1.0. Regras, estado e IA vivem nos outros módulos: aqui só se
// consulta o motor (legal, conversionMoves, score) e se desenha o resultado.
const APP_VERSION='1.0.0';
const root=document.querySelector('#app');
const STORAGE_KEY='GEMAS-playtest-0.1',PREF_KEY='GEMAS-preferences-0.1',ARCHIVE_KEY='GEMAS-playtest-regras-anteriores';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asset=path=>typeof GEMAS_ASSETS==='undefined'?new URL(`./assets/${path}`,document.baseURI).href:GEMAS_ASSETS[path];
document.documentElement.style.setProperty('--atlas',`url("${asset('gemas_atlas_v0.svg')}")`);
const live=document.createElement('div');
live.id='live';live.className='sr-only';live.setAttribute('role','status');live.setAttribute('aria-live','polite');document.body.append(live);
let liveTimer=null;
function announce(text){live.textContent='';clearTimeout(liveTimer);if(text)liveTimer=setTimeout(()=>{live.textContent=text;},80);}

const ICONS={
  menu:['M4 7h16M4 12h16M4 17h16'],undo:['M9 14L4 9l5-5','M4 9h10a6 6 0 0 1 0 12h-3'],up:['M6 15l6-6 6 6'],down:['M6 9l6 6 6-6'],
  plus:['M12 6v12M6 12h12'],close:['M6 6l12 12M18 6L6 18'],check:['M5 12.5l4.5 4.5L19 7.5'],
  convert:['M20 11a8 8 0 0 0-14.9-3.9','M4 4v4h4','M4 13a8 8 0 0 0 14.9 3.9','M20 20v-4h-4']
};
const icon=(name,size=20,width=2)=>`<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name].map(d=>`<path d="${d}"/>`).join('')}</svg>`;

const ownerName=p=>p==='branco'?'Branco':'Preto';
const colorName=c=>COLOR_NAMES[COLOR_IDS.indexOf(c)];
const attributeName=(kind,value)=>kind==='color'?colorName(value):SHAPE_NAMES[value-1];
const gemName=g=>`${colorName(g.color)} ${SHAPE_NAMES[g.shape-1]}`;
const plural=(n,one,many)=>`${n} ${n===1?one:many}`;
const capital=text=>text.charAt(0).toUpperCase()+text.slice(1);
const freshSeed=()=>`GEMAS-${Date.now().toString(36).toUpperCase()}`;
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const isWide=()=>innerWidth>=700&&innerWidth>innerHeight;

const defaultSettings={columns:4,colors:6,shapes:8,opponent:'computer',difficulty:'beginner',human:'branco',opener:'sorteio',allowLastConversion:false};
const defaultView={help:true,chains:true,points:false,playtest:false,tutorialDone:false,oppOpen:true};
let settings={...defaultSettings,seed:freshSeed()},view={...defaultView};
function configFrom(source){return normalizeConfig({columns:source.columns,colors:source.colors,shapes:source.shapes,opener:source.opener,allowLastConversion:source.allowLastConversion,...(source.active?{active:source.active}:{})});}
try{
  const old=JSON.parse(localStorage.getItem(PREF_KEY));
  if(old&&typeof old==='object'){
    const candidate={...settings};
    for(const key of ['columns','colors','shapes','opponent','difficulty','human','opener','allowLastConversion','active'])if(old[key]!==undefined)candidate[key]=old[key];
    configFrom(candidate);
    if(!['computer','manual'].includes(candidate.opponent)||!['beginner','experienced'].includes(candidate.difficulty)||!OWNERS.includes(candidate.human))throw Error('Preferências inválidas.');
    settings=candidate;
    if(old.view&&typeof old.view==='object')for(const key of Object.keys(defaultView))if(typeof old.view[key]==='boolean')view[key]=old.view[key];
  }
}catch{settings={...defaultSettings,seed:freshSeed()};}
if(location.hash==='#playtest')view.playtest=true;

let session=null,screen='home',modal=null,renderedModal=null,returnFocus=null,notice='',noticeError=false;
let selection={cardId:null,position:null,target:null},openingChoice=null,paused=false,tutorial=null,resultSeen=null;
let pendingEffects=null,generation=0,settleAt=0,computerTimer=null,resultTimer=null,wasWide=null,drag=null,suppressClick=false;

const controller=new OpponentController({
  workerFactory:()=>{
    if(typeof GEMAS_WORKER_SOURCE!=='undefined'){
      const url=URL.createObjectURL(new Blob([GEMAS_WORKER_SOURCE],{type:'text/javascript'}));
      try{const worker=new Worker(url),terminate=worker.terminate.bind(worker);worker.terminate=()=>{terminate();URL.revokeObjectURL(url);};return worker;}
      catch(error){URL.revokeObjectURL(url);throw error;}
    }
    return new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
  },
  onResult:(result,key)=>{if(session?.state===key&&isComputer()&&screen==='game'&&!modal){if(result?.action)commit(result.action,result);else controller.onError('Não foi possível escolher uma jogada.');}},
  fallback:message=>chooseAction(message.observation,message.options),
  onError:error=>{paused=true;showNotice(`O computador pausou: ${error}. Toque em Retomar ou use o menu.`,true);}
});

/* ---------- Estado, salvamento e nomes ---------- */
function configFromSettings(){return configFrom(settings);}
function savePreferences(){try{const {seed,...rest}=settings;localStorage.setItem(PREF_KEY,JSON.stringify({...rest,view}));}catch{}}
function persist(){if(tutorial)return;try{localStorage.setItem(STORAGE_KEY,session.serialize());}catch{showNotice('Não foi possível salvar no navegador. Use Exportar partida no menu de playtest.',true);}}
function readStored(){try{return localStorage.getItem(STORAGE_KEY);}catch{return null;}}
function isCurrentSave(text){try{const saved=JSON.parse(text);return saved.format==='GEMAS-SAVE'&&saved.version===1&&saved.rulesVersion===RULES_VERSION&&saved.generatorVersion===GENERATOR_VERSION;}catch{return false;}}
function previousSave(){const stored=readStored();if(stored&&!isCurrentSave(stored))return stored;try{return localStorage.getItem(ARCHIVE_KEY);}catch{return null;}}
function hasSaved(){return isCurrentSave(readStored());}
function resetSelection(){selection={cardId:null,position:null,target:null};openingChoice=null;}
function showNotice(text,error=false){notice=text;noticeError=error;announce(text);render();}
function isComputer(){return Boolean(session&&session.state.phase!=='finalizada'&&session.controller()==='computer');}
const againstComputer=()=>OWNERS.some(p=>session.setup.players[p]==='computer');
const humanSide=()=>OWNERS.find(p=>session.setup.players[p]==='human')??'branco';
const bottomOwner=()=>againstComputer()?humanSide():session.state.current;
const playerLabel=owner=>againstComputer()?(session.setup.players[owner]==='human'?'Você':'Computador'):ownerName(owner);
const subject=owner=>againstComputer()?(session.setup.players[owner]==='human'?'Você':'O computador'):ownerName(owner);
const cardLabel=id=>cardById(session.state,id).gems.map(gemName).join(' e ');
const currentLayout=()=>boardLayout(session.state.config,!isWide());
const lastSummary=()=>session.cursor>0?moveSummary(session.states[session.cursor-1],session.state):null;
const tutorialStep=()=>tutorial&&!tutorial.free?TUTORIAL.steps[tutorial.step]:null;

function openSession(next,guided=null){
  controller.cancel();session=next;tutorial=guided;screen='game';modal=null;paused=false;notice='';noticeError=false;settleAt=0;resultSeen=null;resetSelection();
}
function startGame(){
  const setup={seed:settings.seed,config:configFromSettings(),players:Object.fromEntries(OWNERS.map(p=>[p,settings.opponent==='computer'&&p!==settings.human?'computer':'human'])),difficulty:settings.difficulty};
  const previous=readStored();if(previous&&!isCurrentSave(previous))localStorage.setItem(ARCHIVE_KEY,previous);
  openSession(new GameSession(setup));settings.seed=freshSeed();savePreferences();persist();announce('Nova partida.');render();
}
function rematch(){
  if(session.setup.tutorial){screen='setup';modal=null;render();return;}
  const {seed,...setup}=session.setup;
  openSession(new GameSession({...setup,seed:freshSeed()}));persist();announce('Nova partida.');render();
}
function startTutorial(){openSession(new GameSession(tutorialSetup()),{step:0,free:false});announce(TUTORIAL.steps[0].text);render();}
function advanceTutorial(){
  tutorial.step++;
  if(TUTORIAL.steps[tutorial.step]?.last||tutorial.step>=TUTORIAL.steps.length){view.tutorialDone=true;savePreferences();}
  if(tutorial.step>=TUTORIAL.steps.length)tutorial.free=true;
}
function tutorialAllows(kind,value){
  const step=tutorialStep();if(!step)return true;if(step.type!=='human')return false;
  const a=step.action,s=session.state;
  if(a.type==='opening')return kind==='cell'&&value===s.config.positions[a.firstOwner===s.current?0:1];
  if(kind==='hand')return value===a.cardId;
  if(selection.cardId!==a.cardId)return false;
  if(value===a.position)return !(a.mode==='converter'&&selection.position===a.position);
  return a.mode==='converter'&&value===a.target&&selection.position===a.position;
}
function guided(){
  const step=tutorialStep();if(step?.type!=='human')return {hand:null,cells:[]};
  const a=step.action,s=session.state;
  if(a.type==='opening')return {hand:null,cells:[s.config.positions[a.firstOwner===s.current?0:1]]};
  if(selection.cardId!==a.cardId)return {hand:a.cardId,cells:a.mode==='converter'?[a.target]:[]};
  if(selection.position!==a.position)return {hand:null,cells:[a.position,...(a.mode==='converter'?[a.target]:[])]};
  return {hand:null,cells:[a.mode==='converter'?a.target:a.position]};
}

/* ---------- Textos da jogada: placar, anúncios e instruções ---------- */
function resultSentence(){
  const points=score(session.state);
  if(points.winner==='empate')return `Empate: ${points.branco.total} a ${points.preto.total}.`;
  const loser=other(points.winner);
  return `${subject(points.winner)} venceu por ${points[points.winner].total} a ${points[loser].total}.`;
}
function turnSentence(){
  const s=session.state;if(s.phase==='finalizada')return `Fim da partida. ${resultSentence()}`;
  if(!againstComputer())return `Vez do ${ownerName(s.current)}.`;
  return isComputer()?'Vez do computador.':'Sua vez.';
}
function describeMove(m){
  if(!m)return '';
  const s=session.state,layout=currentLayout(),rival=other(m.owner),board=`Placar: ${playerLabel('branco')} ${m.after.branco}, ${playerLabel('preto')} ${m.after.preto}.`;
  if(m.type==='opening'){
    const [a,b]=m.positions;
    return `Abertura. ${subject(m.firstOwner)} ficou com ${cardLabel(s.board[a].id)}; ${subject(other(m.firstOwner)).toLowerCase()} ficou com ${cardLabel(s.board[b].id)}. ${turnSentence()}`;
  }
  let text=`${subject(m.owner)} colocou ${cardLabel(m.cardId)} na ${layout.label(m.position)}`;
  if(m.converted!==null)text+=` e converteu a carta ${cardLabel(s.board[m.converted].id)}, na ${layout.label(m.converted)}`;
  text+='.';
  if(m.gain>0)text+=` ${subject(m.owner)} ganhou ${plural(m.gain,'ponto','pontos')}.`;
  if(m.loss>0)text+=` ${subject(rival)} perdeu ${plural(m.loss,'ponto','pontos')}.`;
  text+=` ${board}`;
  if(m.passed)text+=` ${subject(m.passed)} está sem cartas e passa a vez.`;
  return `${text} ${turnSentence()}`;
}
function shortMove(m){
  if(!m||m.type!=='move')return '';
  if(againstComputer()&&session.setup.players[m.owner]==='human')return '';
  const layout=currentLayout(),who=againstComputer()?'O computador':ownerName(m.owner);
  return `${who} jogou na ${layout.label(m.position)}${m.converted!==null?` e converteu a carta da ${layout.label(m.converted)}`:''}. `;
}
function statusModel(){
  const s=session.state,two=!againstComputer();
  if(notice)return {text:notice,tone:noticeError?'hint':'',cancel:selection.cardId!==null};
  if(s.phase==='finalizada')return {text:`Partida encerrada. ${resultSentence()}`,button:['result','Resultado']};
  if(s.phase==='abertura'){
    if(isComputer())return {text:'Abertura: o computador escolhe qual carta do centro fica com ele.'};
    const chooser=two?`${ownerName(s.current)} escolhe`:'escolha';
    return openingChoice?{text:'Toque de novo na carta para confirmar. A outra fica com o adversário.',cancel:true}:{text:`Abertura: ${chooser} a carta do centro que será sua. A outra fica com o adversário.`};
  }
  if(isComputer())return paused?{text:'Computador pausado.',button:['pause','Retomar']}:{text:`${shortMove(lastSummary())}O computador está pensando…`};
  const turn=two?`Vez do ${ownerName(s.current)}`:'Sua vez';
  if(selection.cardId===null)return {text:`${shortMove(lastSummary())}${turn}: toque numa carta da mão.`};
  if(selection.position===null){
    if(selection.target!==null)return {text:'Toque numa casa marcada com setas para converter essa carta.',cancel:true};
    const any=view.help&&conversionMoves(s,selection.cardId).length>0;
    return {text:any?'Toque numa casa. As marcadas com setas permitem converter.':'Toque numa casa livre.',cancel:true};
  }
  const targets=conversionMoves(s,selection.cardId,{position:selection.position}).length>0;
  return {text:targets?'Para converter, toque na carta adversária marcada. Para só colocar, toque de novo na casa.':'Toque de novo na casa para confirmar.',cancel:true};
}

/* ---------- Peças visuais ---------- */
function gem(g,labelled=false){
  return `<span class="gem" data-color="${g.color}" data-shape="${g.shape}" style="--c:${COLOR_IDS.indexOf(g.color)};--s:${g.shape-1}" ${labelled?`role="img" aria-label="${gemName(g)}"`:'aria-hidden="true"'}></span>`;
}
const chip=(symbol,text)=>`<span class="chip">${icon(symbol,16,2.6)}<span>${text}</span></span>`;
function card(id,owner,extra='',inner=''){
  const c=cardById(session.state,id);
  return `<span class="card ${owner} ${extra}" data-card="${id}">${c.gems.map(g=>gem(g)).join('')}${view.playtest?`<span class="card-id">${id}</span>`:''}${inner}</span>`;
}
function scorePanel(owner,points){
  const s=session.state,active=s.phase!=='finalizada'&&s.current===owner;
  const tag=!active?'':!againstComputer()?'Vez':!isComputer()?'Sua vez':paused?'Pausado':tutorialStep()?.type==='info'?'Vez':'Pensando…';
  return `<button class="score ${active?'active':''}" data-action="score" data-k="score-${owner}" aria-label="${playerLabel(owner)}, cartas ${owner==='branco'?'brancas':'pretas'}: ${plural(points[owner].total,'ponto','pontos')}${tag?`. ${tag}`:''}. Ver pontos por símbolo."><span class="dot ${owner}"></span><span class="sname"><span>${playerLabel(owner)}</span>${tag?`<span class="turn">${tag}</span>`:''}</span><span class="num" data-score="${owner}">${points[owner].total}</span></button>`;
}
function opponentMarkup(owner){
  const s=session.state,hand=s.hands[owner],name=againstComputer()?'computador':ownerName(owner),deck=`monte: ${s.deck.length}`;
  if(!view.oppOpen)return `<div class="opp"><span class="opp-label">Mão do ${name}: ${plural(hand.length,'carta','cartas')} · ${deck}</span><button class="icon bare" data-action="toggle-opp" data-k="toggle-opp" aria-expanded="false" aria-label="Mostrar a mão do ${name}">${icon('down',18)}</button></div>`;
  return `<div class="opp"><span class="opp-label">Mão do ${name}<br>${deck}</span><div class="opp-cards"><div class="minis" role="group" aria-label="Mão do ${name}, ${plural(hand.length,'carta','cartas')}">${hand.map(id=>`<span class="mini" data-mini="${id}" role="img" aria-label="${cardLabel(id)}">${card(id,owner)}</span>`).join('')}</div><button class="icon bare" data-action="toggle-opp" data-k="toggle-opp" aria-expanded="true" aria-label="Recolher a mão do ${name}">${icon('up',18)}</button></div></div>`;
}
function boardMarkup(layout,points,last){
  const s=session.state,opening=s.phase==='abertura',playing=s.phase==='jogando'&&!isComputer(),cardId=playing?selection.cardId:null,guide=guided();
  const all=cardId===null?[]:conversionMoves(s,cardId),targets=new Set(all.map(o=>o.target));
  const fromHere=new Set(selection.position===null?[]:all.filter(o=>o.action.position===selection.position).map(o=>o.target));
  const cellsForTarget=selection.target===null?null:new Set(all.filter(o=>o.target===selection.target).map(o=>o.action.position));
  const convertCell=i=>view.help&&(cellsForTarget?cellsForTarget.has(i):all.some(o=>o.action.position===i));
  const cells=layout.order.map(i=>{
    if(!s.config.active.includes(i))return '<div class="slot void" aria-hidden="true"></div>';
    const where=capital(layout.label(i)),cell=s.board[i],marks=`${guide.cells.includes(i)?'guide':''}`;
    let classes='',inner='',label=`${where}, vazia`;
    if(opening&&s.config.positions.includes(i)){
      const k=s.config.positions.indexOf(i),id=s.deck[k],mine=openingChoice===(k===0?s.current:other(s.current));
      const owner=openingChoice?(mine?s.current:other(s.current)):'neutral';
      classes='filled';inner=card(id,owner,mine?'has-chip':'',mine?chip('check','Confirmar'):'');
      label=mine?`Confirmar: ${cardLabel(id)} fica com ${againstComputer()?'você':ownerName(s.current)}`:`${where}, carta de abertura, ${cardLabel(id)}`;
    }else if(cell){
      const confirm=fromHere.has(i),flipped=last?.converted===i,perCard=view.points?points[cell.owner].perCard.find(c=>c.position===i)?.points:0;
      classes=`filled ${last?.position===i?'last':''} ${view.help&&targets.has(i)?'convertible':''} ${selection.target===i||confirm?'target':''}`;
      inner=card(cell.id,cell.owner,confirm?'has-chip':'',`${flipped&&!confirm?`<span class="turned">${icon('convert',13,2.6)}</span>`:''}${perCard?`<span class="card-points">+${perCard}</span>`:''}${confirm?chip('convert','Converter'):''}`);
      label=confirm?`Converter a carta ${cardLabel(cell.id)}, na ${layout.label(i)}`:`${where}, carta ${cell.owner==='branco'?'branca':'preta'}, ${cardLabel(cell.id)}${view.help&&targets.has(i)?', pode ser convertida':''}${flipped?', convertida na última jogada':''}`;
    }else if(cardId!==null&&selection.position===i){
      classes='filled preview';inner=card(cardId,s.current,'has-chip',chip('check','Colocar'));
      label=`Confirmar: colocar ${cardLabel(cardId)} na ${layout.label(i)}${fromHere.size?', sem converter':''}`;
    }else if(cardId!==null){
      const conv=convertCell(i);classes=conv?'ok conv':'ok';inner=conv?icon('convert',24):icon('plus',20,1.6);
      if(conv)label+=', permite converter';
    }
    return `<div class="slot" data-slot="${i}"><button class="cell ${classes} ${marks}" data-cell="${i}" data-k="cell-${i}" aria-label="${label}">${inner}</button></div>`;
  }).join('');
  return `<div class="tray"><div class="board" style="--cols:${layout.columns}" role="group" aria-label="Tabuleiro de ${layout.rows} linhas e ${layout.columns} colunas">${cells}<svg class="links" aria-hidden="true"></svg></div></div>`;
}
function handMarkup(owner){
  const s=session.state,mine=s.phase==='jogando'&&s.current===owner&&!isComputer(),guide=guided(),step=tutorialStep();
  const title=againstComputer()?'Sua mão':`Mão do ${ownerName(owner)}`;
  const cards=s.hands[owner].map(id=>{
    const convertible=mine&&view.help&&conversionMoves(s,id).length>0,selected=mine&&selection.cardId===id;
    const dim=step?.type==='human'&&step.action.type==='move'&&step.action.cardId!==id;
    return `<button class="hcard ${selected?'sel':''} ${guide.hand===id?'guide':''} ${dim?'dim':''}" data-hand="${id}" data-k="hand-${id}" aria-pressed="${selected}" aria-disabled="${!mine}" aria-label="${cardLabel(id)}${convertible?', pode converter':''}">${card(id,owner)}${convertible?`<span class="badge">${icon('convert',14,2.5)}</span>`:''}</button>`;
  }).join('');
  return `<div class="hand" role="group" aria-label="${title}, ${plural(s.hands[owner].length,'carta','cartas')}">${cards||'<p class="hand-empty">Mão vazia</p>'}</div>`;
}
function statusMarkup(){
  const model=statusModel();
  return `<div class="status"><p class="${model.tone||''}">${esc(model.text)}</p>${model.button?`<button class="ghost" data-action="${model.button[0]}" data-k="status-button">${model.button[1]}</button>`:model.cancel?'<button class="ghost" data-action="cancel" data-k="status-button">Cancelar</button>':''}</div>`;
}
function coachMarkup(){
  const step=tutorialStep(),index=tutorial.step+1,total=TUTORIAL.steps.length;
  return `<div class="coach"><p class="coach-step">Tutorial · passo ${index} de ${total}</p><p>${esc(step.text)}</p>${notice?`<p class="hint">${esc(notice)}</p>`:''}${step.type==='info'?`<button class="primary" data-action="coach-next" data-k="coach-next">${step.last?'Continuar a partida':'Continuar'}</button>`:''}</div>`;
}
function gameMarkup(){
  const s=session.state,wide=isWide(),layout=boardLayout(s.config,!wide),points=score(s),bottom=bottomOwner(),order=againstComputer()?[humanSide(),other(humanSide())]:OWNERS,guiding=Boolean(tutorialStep());
  return `<div class="game ${wide?'wide':'tall'}" data-phase="${s.phase}"><div class="side side-a"><header class="topbar"><button class="icon" data-action="menu" data-k="menu" aria-label="Menu">${icon('menu')}</button><span class="word">GEMAS</span>${guiding?`<button class="icon" data-action="home" data-k="undo" aria-label="Sair do tutorial">${icon('close')}</button>`:`<button class="icon" data-action="undo" data-k="undo" aria-label="Desfazer a última jogada" ${!session.cursor?'disabled':''}>${icon('undo')}</button>`}</header><div class="scores">${order.map(owner=>scorePanel(owner,points)).join('')}</div>${opponentMarkup(other(bottom))}</div><div class="board-zone">${boardMarkup(layout,points,lastSummary())}</div><div class="side side-b">${guiding?coachMarkup():statusMarkup()}${handMarkup(bottom)}</div></div>`;
}

/* ---------- Início e nova partida ---------- */
function oldSaveNotice(){return previousSave()?'<p class="notice">Há uma partida salva com regras anteriores. Ela foi preservada para exportação; novas partidas usam as regras atuais. <button class="link" data-action="save-previous">Exportar partida anterior</button></p>':'';}
function homeMarkup(){
  const saved=hasSaved(),main=saved?'resume':view.tutorialDone?'setup':'tutorial',kind=name=>main===name?'primary':'secondary';
  const gems=[['A',6],['C',4],['E',1],['D',5],['F',8]].map(([color,shape])=>gem({color,shape})).join('');
  return `<div class="page home"><div class="home-gems" aria-hidden="true">${gems}</div><h1>GEMAS</h1><p class="tagline">Ligue cores e formas, converta as cartas do adversário e some mais pontos.</p><div class="home-actions">${saved?'<button class="primary" data-action="resume" data-k="resume">Continuar partida</button>':''}<button class="${kind('setup')}" data-action="setup" data-k="setup">Nova partida</button><button class="${kind('tutorial')}" data-action="tutorial" data-k="tutorial">Aprender a jogar</button><button class="secondary" data-action="rules" data-k="rules">Regras</button></div>${oldSaveNotice()}${notice?`<p class="notice ${noticeError?'error':''}">${esc(notice)}</p>`:''}<div class="home-foot"><span>GEMAS ${APP_VERSION} · regras ${RULES_VERSION.replace('GEMAS-RULES-','')}</span><button class="link" data-action="playtest" data-k="playtest" aria-pressed="${view.playtest}">Modo playtest: ${view.playtest?'ligado':'desligado'}</button></div></div>`;
}
function segments(key,label,values){return `<div class="segments" role="group" aria-label="${label}">${values.map(([value,text])=>`<button type="button" data-setting="${key}" data-value="${value}" data-k="set-${key}-${value}" aria-pressed="${settings[key]===value}">${text}</button>`).join('')}</div>`;}
function countControl(key,label){return `<div class="count-row"><span>${label}</span><div class="counter"><button data-count="${key}" data-delta="-1" data-k="count-${key}-minus" aria-label="Diminuir ${label.toLowerCase()}" ${settings[key]===2?'disabled':''}>−</button><output aria-label="Quantidade de ${label.toLowerCase()}">${settings[key]}</output><button data-count="${key}" data-delta="1" data-k="count-${key}-plus" aria-label="Aumentar ${label.toLowerCase()}" ${settings[key]===8?'disabled':''}>+</button></div></div>`;}
function paletteRow(kind){return `<div class="palette-row">${Array.from({length:8},(_,i)=>{const name=kind==='colors'?COLOR_NAMES[i]:SHAPE_NAMES[i];return `<span class="palette-slot ${i>=settings[kind]?'off':''}"><img src="${asset(`figma/${kind==='colors'?COLOR_IDS[i]+'1':'shape-'+(i+1)}.svg`)}" alt="${name}${i>=settings[kind]?' (fora desta partida)':''}"></span>`;}).join('')}</div>`;}
function boardChoice(columns){
  return `<button class="board-choice" data-columns="${columns}" data-k="board-${columns}" aria-pressed="${settings.columns===columns}"><span class="board-mini" aria-hidden="true">${Array.from({length:columns*4},()=>'<i></i>').join('')}</span><strong>${columns===4?'4×4':'6×4'}</strong><small>${columns*4} casas${columns===6?' · deitado vira 4×6':''}</small></button>`;
}
function deckSummary(){
  const preview=newGame(settings.seed,configFromSettings()),r=analyzeDeck(preview.cards,preview.config),range=values=>{const list=Object.values(values),a=Math.min(...list),b=Math.max(...list);return a===b?String(a):`${a} a ${b}`;};
  return `<p class="deck-line"><strong>${r.cards}</strong>cartas no monte: as casas do tabuleiro mais 8. Cada cor aparece ${range(r.colors)} vezes e cada forma, ${range(r.shapes)}.${r.repeatedCards?` ${plural(r.repeatedCards,'carta repete','cartas repetem')} uma composição.`:''}</p>`;
}
function laboratorySetup(){
  if(!view.playtest)return '';
  return `<section class="panel"><h2>Laboratório</h2><label class="field">Semente da partida<input id="seed" data-k="seed" value="${esc(settings.seed)}" maxlength="200" required></label><label class="field">Casas ativas <small>Índices a partir de zero, separados por vírgula; vazio usa todas.</small><input id="mask" data-k="mask" value="${esc(settings.active?.join(', ')||'')}" placeholder="0, 1, 2, 4, 5, 6, 8, 9, 10"></label><p class="muted">A mesma semente, versão e configuração reproduzem a distribuição. As máscaras são parâmetros de playtest.</p></section>`;
}
function setupMarkup(){
  const computer=settings.opponent==='computer';
  return `<div class="page setup"><header class="page-head"><button class="icon" data-action="home" data-k="back" aria-label="Voltar ao início">${icon('close')}</button><h1>Nova partida</h1><button class="ghost" data-action="rules" data-k="rules">Regras</button></header><div class="setup-grid"><section class="panel"><h2>Adversário</h2>${segments('opponent','Adversário',[['computer','Computador'],['manual','Duas pessoas']])}${computer?segments('difficulty','Nível',[['beginner','Iniciante'],['experienced','Experiente']]):''}</section><section class="panel">${computer?`<h2>Sua cor</h2>${segments('human','Sua cor',[['branco','Branco'],['preto','Preto']])}`:''}<h2>Quem começa</h2>${segments('opener','Quem começa',[['sorteio','Sorteio'],['branco','Branco'],['preto','Preto']])}<p class="muted">Quem não começa escolhe a posse das duas cartas de abertura.</p></section><section class="panel"><h2>Tabuleiro</h2><div class="board-options">${boardChoice(4)}${boardChoice(6)}</div></section><section class="panel"><h2>Paleta</h2>${countControl('colors','Cores')}${paletteRow('colors')}${countControl('shapes','Formas')}${paletteRow('shapes')}<p class="muted">Menos cores, mais conversões. Menos formas, grupos maiores.</p>${deckSummary()}</section><section class="panel"><h2>Regra opcional</h2><label class="switch-row"><span>A última carta pode converter<small>Quem converte com a última carta fica de mão vazia e passa a vez até o fim.</small></span><input id="allow-last" data-k="allow-last" type="checkbox" role="switch" ${settings.allowLastConversion?'checked':''}><span class="switch" aria-hidden="true"></span></label></section>${laboratorySetup()}</div>${oldSaveNotice()}${notice?`<p class="notice ${noticeError?'error':''}">${esc(notice)}</p>`:''}<footer class="setup-foot"><button class="primary" data-action="start" data-k="start">Começar partida</button></footer></div>`;
}

/* ---------- Folhas: regras, pontos, resultado, menu ---------- */
function exampleCard(owner,gems){return `<span class="ex-card"><span class="card ${owner}">${gems.map(([color,shape])=>gem({color,shape},true)).join('')}</span></span>`;}
function rulesMarkup(){
  return `<h3>Objetivo</h3><p>Ter mais pontos que o adversário quando a partida acabar. Só as cartas no tabuleiro pontuam.</p>
<h3>As cartas</h3><p>Cada carta tem duas gemas, de cores diferentes e de formas diferentes. As gemas nunca mudam. O fundo mostra de quem a carta é: branco ou preto. As mãos ficam abertas, e os dois jogadores veem todas as cartas.</p>
<h3>Preparação</h3><p>Cada jogador recebe quatro cartas. Duas cartas entram no centro do tabuleiro, e quem não começa escolhe qual delas fica com cada jogador. A abertura não conta como jogada.</p>
<h3>Na sua vez</h3><ol><li><strong>Colocar:</strong> ponha uma carta da mão em qualquer casa livre e compre uma carta do monte.</li><li><strong>Colocar e converter:</strong> ponha a carta ao lado de uma carta adversária e tome essa carta para você. Quem converte não compra.</li></ol>
<h3>Como converter</h3><p>A carta nova e uma carta sua que já estava no tabuleiro precisam ser vizinhas do alvo. Juntas, elas cobrem as duas cores do alvo: uma cor em cada carta. As formas não participam da conversão.</p>
<div class="example">${exampleCard('branco',[['C',1],['A',2]])}${exampleCard('preto',[['D',3],['C',1]])}${exampleCard('branco',[['C',4],['D',1]])}<span class="ex-note">A carta preta tem verde e amarelo. Uma carta branca vizinha cobre o amarelo e a outra cobre o verde: a preta vira branca.</span></div>
<ul><li>Converte-se uma única carta por jogada, sem efeito em cadeia.</li><li>Grupos e formas não protegem nenhuma carta.</li><li>A primeira jogada de cada jogador não pode converter.</li><li>A última carta adversária que restar no tabuleiro não pode ser convertida.</li><li>A última carta da sua mão não pode converter. Na regra opcional ela pode, e quem fica sem cartas passa a vez até o fim.</li></ul>
<h3>Vizinhança</h3><p>Vale pelos lados e pelas diagonais: cada casa tem até oito vizinhas.</p>
<h3>Pontos</h3><p>Cada cor e cada forma contam em separado. Quando três ou mais cartas suas estão ligadas pela mesma cor, ou pela mesma forma, cada carta do grupo vale 1 ponto. Uma carta pode pontuar até quatro vezes: pelas duas cores e pelas duas formas.</p>
<div class="example">${exampleCard('branco',[['A',6],['E',2]])}${exampleCard('branco',[['A',3],['D',5]])}${exampleCard('branco',[['F',7],['A',1]])}<span class="ex-note">Três cartas brancas ligadas pelo vermelho: 3 pontos para o Branco.</span></div>
<p>Cartas do adversário, ou sem aquele símbolo, não fazem ponte. Os pontos são refeitos a cada jogada: uma conversão pode desmanchar um grupo.</p>
<h3>Fim da partida</h3><p>A partida acaba quando o tabuleiro enche ou quando as duas mãos ficam vazias. Vence quem tiver mais pontos; totais iguais dão empate.</p>
<p class="muted">GEMAS ${APP_VERSION} · ${RULES_VERSION}</p>`;
}
function symbolImage(kind,value){return `<img src="${asset(`figma/${kind==='color'?value+'1':'shape-'+value}.svg`)}" alt="${attributeName(kind,value)}">`;}
function chainList(owner,points){
  const layout=currentLayout();
  return `<ul class="chains">${points[owner].chains.map(c=>`<li>${symbolImage(c.kind,c.value)}<span><strong>${attributeName(c.kind,c.value)}</strong> · ${plural(c.positions.length,'carta','cartas')} · +${c.points}<span class="sr-only">: ${c.positions.map(i=>layout.label(i)).join('; ')}</span></span></li>`).join('')||'<li>Nenhum grupo pontua ainda.</li>'}</ul>`;
}
function symbolTables(points){
  return scoreTableData(session.state,points).map(group=>`<div class="score-scroll"><table class="symbols" data-score-kind="${group.kind}"><caption>${group.kind==='color'?'Cores':'Formas'}</caption><thead><tr><th scope="col"><span class="sr-only">Jogador</span></th>${group.values.map(value=>`<th scope="col">${symbolImage(group.kind,value)}</th>`).join('')}<th scope="col">Total</th></tr></thead><tbody>${group.rows.map(row=>`<tr data-score-owner="${row.owner}"><th scope="row">${playerLabel(row.owner)}</th>${group.values.map(value=>`<td data-score-value="${value}">${row.points[value]||0}</td>`).join('')}<td class="sum">${row.total}</td></tr>`).join('')}</tbody></table></div>`).join('');
}
function scoreMarkup(){
  const points=score(session.state);
  return `<p>Cada carta num grupo de três ou mais, da mesma posse e ligado pela mesma cor ou forma, vale 1 ponto.</p>${symbolTables(points)}${OWNERS.map(owner=>`<h3>${playerLabel(owner)} · ${plural(points[owner].total,'ponto','pontos')}</h3>${chainList(owner,points)}`).join('')}<p class="legend"><span><i></i>Ligação por cor</span><span><i class="solid"></i>Ligação por forma</span></p>`;
}
function resultTitle(){
  const winner=score(session.state).winner;
  if(winner==='empate')return 'Empate';
  if(!againstComputer())return `${ownerName(winner)} venceu`;
  return session.setup.players[winner]==='human'?'Você venceu!':'O computador venceu';
}
function resultMarkup(){
  const s=session.state,points=score(s),side=owner=>`<div class="final-side ${points.winner===owner?'winner':''}"><span class="who"><span class="dot ${owner}"></span>${playerLabel(owner)}</span><strong>${points[owner].total}</strong><small>${points[owner].colorPoints} de cores + ${points[owner].shapePoints} de formas</small></div>`;
  const order=againstComputer()?[humanSide(),other(humanSide())]:OWNERS;
  return `<p class="eyebrow">${s.endReason==='maos-vazias'?'As duas mãos ficaram vazias':'Tabuleiro completo'}</p><div class="final">${order.map(side).join('')}</div>${order.map(owner=>`<h3>${!againstComputer()?`Grupos do ${ownerName(owner)}`:session.setup.players[owner]==='human'?'Seus grupos':'Grupos do computador'}</h3>${chainList(owner,points)}`).join('')}<div class="dialog-actions"><button class="primary" data-action="rematch" data-k="rematch">Jogar de novo</button><button class="secondary" data-action="new" data-k="new">Mudar a configuração</button><button class="secondary" data-action="close" data-k="see-board">Ver o tabuleiro</button></div>`;
}
function switchRow(id,label,note,checked){return `<label class="switch-row"><span>${label}${note?`<small>${note}</small>`:''}</span><input id="${id}" data-k="${id}" type="checkbox" role="switch" ${checked?'checked':''}><span class="switch" aria-hidden="true"></span></label>`;}
function laboratoryPanel(){
  const s=session.state,r=analyzeDeck(s.cards,s.config),report=session.reports.slice(0,session.cursor).findLast(Boolean),layout=currentLayout(),computer=againstComputer();
  return `<h3>Playtest</h3><div class="menu-list"><button data-action="step-undo" data-k="step-undo" ${!session.cursor?'disabled':''}>Desfazer um passo</button><button data-action="redo" data-k="redo" ${session.cursor>=session.commands.length?'disabled':''}>Refazer</button>${computer?`<button data-action="pause" data-k="pause" aria-pressed="${paused}">${paused?'Retomar computador':'Pausar computador'}</button><button data-action="manual" data-k="manual">Controle manual</button>`:''}<button data-action="save" data-k="save">Exportar partida</button><button data-action="load" data-k="load">Carregar partida</button><button data-action="export-log" data-k="export-log">Exportar histórico</button></div><div class="lab"><p>Semente: <strong>${esc(s.seed)}</strong> · ${s.config.colors} cores · ${s.config.shapes} formas · ${s.endReason||'em andamento'}${computer&&paused?' · computador pausado':''}</p><p>${r.uniqueGems} gemas distintas · ${r.repeatedGems} repetições de gemas · ${r.repeatedCards} repetições de cartas · ${s.history.filter(e=>e.type==='pass').length} passes</p><label class="field">Anotações<textarea id="notes" data-k="notes" maxlength="100000">${esc(session.notes)}</textarea></label>${report?`<details><summary>Última decisão do computador</summary><p>${esc(report.reason)}</p><p>${report.candidates} candidatas · ${report.replies} respostas</p><p>${esc(report.information)}</p></details>`:''}<details><summary>Histórico · ${s.history.length} registros</summary><ol>${s.history.map(e=>`<li>${ownerName(e.owner)} · ${e.type==='pass'?'Passou':e.type==='opening'?'Abertura':`${e.action.mode==='converter'?'Converteu':'Colocou'} na ${layout.label(e.action.position)} (casa ${e.action.position})`} · ${esc(e.reason)}</li>`).join('')}</ol></details></div>`;
}
function menuMarkup(){
  const guiding=Boolean(tutorial&&!tutorial.free);
  return `<div class="menu-list"><button data-action="rules" data-k="m-rules">Regras</button><button data-action="score" data-k="m-score">Pontos por símbolo</button></div><div class="menu-group">${switchRow('opt-chains','Mostrar ligações','Linhas entre as gemas dos grupos que pontuam.',view.chains)}${switchRow('opt-help','Ajuda de conversão','Marca cartas, casas e alvos que permitem converter.',view.help)}${switchRow('opt-points','Pontos nas cartas','Mostra quanto cada carta soma agora.',view.points)}</div><div class="menu-list">${guiding?'':'<button data-action="new" data-k="m-new">Nova partida</button><button data-action="tutorial" data-k="m-tutorial">Aprender a jogar</button>'}<button data-action="home" data-k="m-home">${guiding?'Sair do tutorial':'Início'}</button></div>${view.playtest&&!guiding?laboratoryPanel():''}`;
}
function modalMarkup(){
  if(!modal)return '';
  const [title,body]=modal==='rules'?['Como jogar',rulesMarkup()]:modal==='score'?['Pontos por símbolo',scoreMarkup()]:modal==='result'?[resultTitle(),resultMarkup()]:['Menu',menuMarkup()];
  return `<div class="backdrop" data-backdrop><section class="dialog" data-modal="${modal}" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1"><header class="dialog-head"><h2 id="dialog-title">${title}</h2><button class="icon" data-action="close" data-k="close" aria-label="Fechar">${icon('close')}</button></header><div class="dialog-body">${body}</div></section></div>`;
}
function openModal(name){if(!modal)returnFocus=document.activeElement?.dataset?.k??null;modal=name;render();}
function closeModal(){if(modal==='result')resultSeen=session?.state??null;modal=null;render();}

/* ---------- Desenho, medidas e respostas visuais ---------- */
function fitBoard(){
  const zone=root.querySelector('.board-zone'),board=zone?.querySelector('.board');if(!board)return;
  const layout=currentLayout(),gap=zone.clientWidth<430?6:8,frame=18;
  const wmax=(zone.clientWidth-frame-(layout.columns-1)*gap)/layout.columns,hmax=(zone.clientHeight-frame-(layout.rows-1)*gap)/layout.rows;
  const cw=Math.max(34,Math.floor(Math.min(wmax,hmax*1.3,118))),ch=Math.max(34,Math.floor(Math.min(hmax,cw*1.36))),flat=cw>ch*1.04;
  const size=Math.floor(Math.min(46,flat?Math.min((cw-14)/2,ch-12):Math.min(cw*.6,(ch-13)/2))),chip=Math.floor(Math.min(size,(cw-13)/2,ch-38));
  board.classList.toggle('flat',flat);board.classList.toggle('narrow',cw<78);
  for(const [name,value] of [['--cw',cw],['--ch',ch],['--gap',gap],['--gs',size],['--gc',Math.max(12,chip)]])board.style.setProperty(name,`${value}px`);
}
function drawLinks(){
  const board=root.querySelector('.board'),svg=board?.querySelector('.links');if(!svg)return;
  if(!view.chains){svg.replaceChildren();return;}
  const box=board.getBoundingClientRect();if(!box.width)return;
  svg.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);
  svg.innerHTML=boardConnections(session.state).map(link=>{
    const a=board.querySelector(`[data-cell="${link.from}"] .gem[data-${link.kind}="${link.value}"]`)?.getBoundingClientRect(),b=board.querySelector(`[data-cell="${link.to}"] .gem[data-${link.kind}="${link.value}"]`)?.getBoundingClientRect();
    if(!a||!b)return '';
    // Offset the two kinds so a matching color and shape remain distinguishable.
    const offset=link.kind==='shape'?3:-2,x1=a.x+a.width/2-box.x,y1=a.y+a.height/2-box.y,x2=b.x+b.width/2-box.x,y2=b.y+b.height/2-box.y,dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy),ox=length?-dy/length*offset:0,oy=length?dx/length*offset:0;
    return `<line data-kind="${link.kind}" data-value="${link.value}" data-from="${link.from}" data-to="${link.to}" x1="${x1+ox}" y1="${y1+oy}" x2="${x2+ox}" y2="${y2+oy}" stroke="${link.kind==='color'?CONNECTION_COLORS[COLOR_IDS.indexOf(link.value)]:link.owner==='branco'?'#57534d':'#bfb7a7'}" class="${link.kind}-link"/>`;
  }).join('');
}
function sourceRect(action){
  if(action.type!=='move')return null;
  const el=root.querySelector(`[data-hand="${action.cardId}"]`)||root.querySelector(`[data-mini="${action.cardId}"]`)||root.querySelector('.opp');
  return el?.getBoundingClientRect()??null;
}
function playEffects({summary,from}){
  const gen=generation,still=reducedMotion();
  const later=(ms,run)=>setTimeout(()=>{if(gen===generation)run();},ms);
  let t=0;
  if(summary.type==='opening'){
    if(!still)for(const position of summary.positions)root.querySelector(`[data-cell="${position}"] .card`)?.classList.add('enter');
    settleAt=performance.now()+(still?0:380);return;
  }
  const placed=root.querySelector(`[data-cell="${summary.position}"]`),slot=placed?.parentElement,cardEl=placed?.querySelector('.card'),links=root.querySelector('.links');
  if(!still&&cardEl&&from){
    const to=cardEl.getBoundingClientRect();slot.classList.add('moving');cardEl.style.transformOrigin='0 0';
    cardEl.animate([{transform:`translate(${from.left-to.left}px,${from.top-to.top}px) scale(${from.width/to.width},${from.height/to.height})`},{transform:'none'}],{duration:340,easing:'cubic-bezier(.2,.8,.2,1)'});
    if(links){links.style.opacity='0';later(340,()=>{links.style.transition='opacity .3s';links.style.opacity='1';});}
    later(360,()=>{slot.classList.remove('moving');cardEl.style.transformOrigin='';});
    t=340;
  }
  if(summary.converted!==null&&!still){
    const turned=root.querySelector(`[data-cell="${summary.converted}"] .card`),was=`was-${other(summary.owner)}`;
    if(turned){turned.classList.add(was);later(t+190,()=>turned.classList.remove(was));turned.animate([{transform:'rotateY(0)'},{transform:'rotateY(90deg)'},{transform:'rotateY(0)'}],{duration:380,delay:t,easing:'ease-in-out'});}
    t+=380;
  }
  if(summary.glow.length&&!still)later(t,()=>{for(const position of summary.glow)root.querySelector(`[data-cell="${position}"]`)?.classList.add('glow');});
  if(summary.gain>0&&slot)later(t,()=>{
    const bubble=document.createElement('span');bubble.className='gain';bubble.textContent=`+${summary.gain}`;bubble.setAttribute('aria-hidden','true');slot.append(bubble);
    setTimeout(()=>bubble.remove(),still?1600:1300);
  });
  for(const owner of OWNERS){
    const el=root.querySelector(`[data-score="${owner}"]`),a=summary.before[owner],b=summary.after[owner];
    if(!el||a===b||still)continue;
    el.textContent=a;
    later(t,()=>{const start=performance.now(),tick=now=>{if(gen!==generation)return;const k=Math.min(1,(now-start)/520);el.textContent=Math.round(a+(b-a)*k);if(k<1)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
  }
  if(summary.drew!==null&&!still)(root.querySelector(`[data-hand="${summary.drew}"]`)||root.querySelector(`[data-mini="${summary.drew}"]`))?.animate([{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'none'}],{duration:300,delay:200,fill:'backwards',easing:'ease-out'});
  settleAt=performance.now()+(still?0:t+(summary.gain||summary.loss?700:120));
}
function render(){
  const focusKey=document.activeElement?.dataset?.k,scroll=root.querySelector('.dialog-body')?.scrollTop??0;
  generation++;clearTimeout(resultTimer);
  if(screen!=='game'&&session)controller.cancel();
  document.body.dataset.screen=screen;wasWide=isWide();
  root.innerHTML=(screen==='home'?homeMarkup():screen==='setup'?setupMarkup():gameMarkup())+modalMarkup()+'<input type="file" id="load-file" accept=".json,application/json" hidden>';
  if(screen==='game'){fitBoard();drawLinks();}
  const dialog=root.querySelector('.dialog'),find=key=>key?root.querySelector(`[data-k="${key}"]`):null;
  if(dialog&&modal!==renderedModal)dialog.focus({preventScroll:true});
  else if(dialog){dialog.querySelector('.dialog-body').scrollTop=scroll;(find(focusKey)||dialog).focus({preventScroll:true});}
  else if(renderedModal)(find(returnFocus)||find(focusKey))?.focus({preventScroll:true});
  else find(focusKey)?.focus({preventScroll:true});
  renderedModal=modal;
  if(pendingEffects){const effects=pendingEffects;pendingEffects=null;if(screen==='game')playEffects(effects);}
  scheduleComputer();scheduleResult();
}
function scheduleComputer(){
  clearTimeout(computerTimer);
  if(screen!=='game'||!session||!isComputer()||paused||modal){controller.cancel();return;}
  const step=tutorialStep();if(step?.type==='info')return;
  const key=session.state,wait=Math.max(0,settleAt-performance.now())+(step?1100:520);
  computerTimer=setTimeout(()=>{
    if(session?.state!==key||screen!=='game'||modal||paused)return;
    if(step?.type==='computer'){commit(step.action);return;}
    controller.start(session.state,{observation:observeGame(session.state),options:{difficulty:session.setup.difficulty}});
  },wait);
}
function scheduleResult(){
  if(screen!=='game'||!session||session.state.phase!=='finalizada'||modal||resultSeen===session.state)return;
  const key=session.state;
  resultTimer=setTimeout(()=>{if(session?.state===key&&screen==='game'&&!modal){returnFocus='status-button';modal='result';render();}},Math.max(0,settleAt-performance.now())+700);
}

/* ---------- Jogadas ---------- */
function commit(action,report=null){
  const step=tutorialStep();
  try{
    controller.cancel();
    const previous=session.state,from=sourceRect(action);
    session.dispatch(action,report);
    const summary=moveSummary(previous,session.state);
    if(step?.action)advanceTutorial();
    pendingEffects={summary,from};notice='';noticeError=false;resetSelection();persist();
    announce(tutorialStep()?`${describeMove(summary)} ${tutorialStep().text}`:describeMove(summary));
    render();
  }catch(error){if(report)paused=true;showNotice(error.message,true);}
}
function whyNot(target){
  const s=session.state,near=s.config.active.find(i=>!s.board[i]&&adjacent(i,target,s.config.columns));
  if(near===undefined)return 'Não há casa livre ao lado dessa carta.';
  return legal(s,{type:'move',mode:'converter',cardId:selection.cardId,position:near,target}).reason||'Essa carta não pode ser convertida agora.';
}
function selectCard(id){
  const s=session.state;if(s.phase!=='jogando'||isComputer()||!s.hands[s.current].includes(id))return;
  if(!tutorialAllows('hand',id)){showNotice('Toque na carta destacada em azul.');return;}
  selection=selection.cardId===id?{cardId:null,position:null,target:null}:{cardId:id,position:null,target:null};
  notice='';render();
}
function tapCell(i,dropped=false){
  const s=session.state;
  if(s.phase==='finalizada'||isComputer())return;
  if(tutorialStep()&&!tutorialAllows('cell',i)){showNotice(tutorialStep().type==='human'?'Toque no item destacado em azul.':'Leia o passo e toque em Continuar.');return;}
  if(s.phase==='abertura'){
    const k=s.config.positions.indexOf(i);
    if(k<0){showNotice('Toque numa das duas cartas do centro.');return;}
    const firstOwner=k===0?s.current:other(s.current);
    if(openingChoice===firstOwner){commit({type:'opening',firstOwner});return;}
    openingChoice=firstOwner;notice='';render();return;
  }
  const cell=s.board[i],cardId=selection.cardId;
  if(cardId===null){showNotice('Toque primeiro numa carta da sua mão.');return;}
  if(!cell){
    if(selection.position===i&&!dropped){commit({type:'move',mode:'normal',cardId,position:i});return;}
    selection.position=i;
    if(selection.target!==null&&!conversionMoves(s,cardId,{position:i,target:selection.target}).length)selection.target=null;
    notice='';render();return;
  }
  if(cell.owner===s.current){showNotice('Essa carta já é sua. Escolha uma casa livre ou uma carta adversária.');return;}
  const options=conversionMoves(s,cardId,{target:i});
  if(!options.length){showNotice(whyNot(i));return;}
  if(!dropped&&selection.position!==null&&options.some(o=>o.action.position===selection.position)){commit({type:'move',mode:'converter',cardId,position:selection.position,target:i});return;}
  const places=[...new Set(options.map(o=>o.action.position))];
  selection.target=i;
  if(selection.position===null||!places.includes(selection.position))selection.position=places.length===1?places[0]:null;
  notice='';render();
}
function undo(single=false){
  controller.cancel();
  if(single||view.playtest||!againstComputer()){session.undo();if(single||view.playtest)paused=againstComputer();}
  else session.undoHumanTurn();
  resultSeen=null;notice='';resetSelection();persist();announce(`Jogada desfeita. ${turnSentence()}`);render();
}
function download(name,text){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

/* ---------- Eventos ---------- */
root.addEventListener('click',event=>{
  if(suppressClick)return;
  if(event.target.dataset?.backdrop!==undefined){closeModal();return;}
  const button=event.target.closest('button');if(!button||button.disabled)return;
  try{
    if(button.dataset.setting){settings[button.dataset.setting]=button.dataset.value;notice='';savePreferences();render();return;}
    if(button.dataset.count){const key=button.dataset.count;settings[key]=Math.max(2,Math.min(8,settings[key]+Number(button.dataset.delta)));savePreferences();render();return;}
    if(button.dataset.columns){settings.columns=Number(button.dataset.columns);delete settings.active;savePreferences();render();return;}
    if(button.dataset.hand){if(button.getAttribute('aria-disabled')!=='true')selectCard(Number(button.dataset.hand));return;}
    if(button.dataset.cell!==undefined){tapCell(Number(button.dataset.cell));return;}
    switch(button.dataset.action){
      case 'start':startGame();break;
      case 'resume':openSession(GameSession.load(readStored()));announce(`Partida retomada. ${turnSentence()}`);render();break;
      case 'setup':controller.cancel();screen='setup';modal=null;notice='';render();break;
      case 'tutorial':startTutorial();break;
      case 'home':controller.cancel();screen='home';modal=null;notice='';tutorial=null;resetSelection();render();break;
      case 'new':controller.cancel();screen='setup';modal=null;notice='';tutorial=null;resetSelection();render();break;
      case 'rematch':rematch();break;
      case 'playtest':view.playtest=!view.playtest;savePreferences();render();break;
      case 'menu':openModal('menu');break;
      case 'rules':openModal('rules');break;
      case 'score':openModal('score');break;
      case 'result':openModal('result');break;
      case 'close':closeModal();break;
      case 'cancel':resetSelection();notice='';render();break;
      case 'coach-next':advanceTutorial();notice='';announce(tutorialStep()?.text||turnSentence());render();break;
      case 'toggle-opp':view.oppOpen=!view.oppOpen;savePreferences();render();break;
      case 'undo':undo();break;
      case 'step-undo':undo(true);break;
      case 'redo':controller.cancel();session.redo();paused=againstComputer();resultSeen=null;resetSelection();persist();render();break;
      case 'pause':paused=!paused;notice='';render();break;
      case 'manual':controller.cancel();session.setup.players={branco:'human',preto:'human'};paused=false;persist();showNotice('Controle manual nas duas mãos.');break;
      case 'save-previous':if(previousSave())download('GEMAS-regras-anteriores.json',previousSave());break;
      case 'save':download(`GEMAS-${session.state.seed}.json`,session.serialize());break;
      case 'load':root.querySelector('#load-file').click();break;
      case 'export-log':download('GEMAS-historico.json',JSON.stringify({seed:session.state.seed,config:session.state.config,history:session.state.history},null,2));break;
    }
  }catch(error){showNotice(error.message,true);}
});
root.addEventListener('change',async event=>{
  const el=event.target;
  try{
    if(el.id==='allow-last'){settings.allowLastConversion=el.checked;savePreferences();render();}
    if(el.id==='seed'){if(!el.value.trim())throw Error('Informe uma semente.');settings.seed=el.value.trim();render();}
    if(el.id==='mask'){if(el.value.trim()){const active=el.value.split(',').map(v=>Number(v.trim()));normalizeConfig({...configFromSettings(),active,positions:undefined});settings.active=active;}else delete settings.active;savePreferences();render();}
    if(el.id==='opt-help'){view.help=el.checked;savePreferences();render();}
    if(el.id==='opt-chains'){view.chains=el.checked;savePreferences();render();}
    if(el.id==='opt-points'){view.points=el.checked;savePreferences();render();}
    if(el.id==='load-file'&&el.files[0]){openSession(GameSession.load(await el.files[0].text()));persist();showNotice('Partida de GEMAS restaurada.');}
  }catch(error){showNotice(error.message,true);}
});
root.addEventListener('input',event=>{if(event.target.id==='notes'){session.notes=event.target.value;persist();}});

// Arrastar faz o mesmo que tocar a carta e depois a casa: nada é confirmado ao soltar.
function endDrag(){drag?.ghost?.remove();drag=null;root.querySelectorAll('.drop-hover').forEach(node=>node.classList.remove('drop-hover'));}
root.addEventListener('pointerdown',event=>{
  const button=event.target.closest('[data-hand]');
  if(!button||button.getAttribute('aria-disabled')==='true'||event.button>0||modal)return;
  drag={id:Number(button.dataset.hand),x:event.clientX,y:event.clientY,pointer:event.pointerId,ghost:null};
});
window.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.pointer)return;
  if(!drag.ghost){
    if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<10)return;
    const s=session?.state;
    if(!s||s.phase!=='jogando'||isComputer()||!s.hands[s.current].includes(drag.id)||!tutorialAllows('hand',drag.id)){drag=null;return;}
    selection={cardId:drag.id,position:null,target:null};notice='';render();
    const ghost=document.createElement('div');ghost.className='drag-ghost';ghost.innerHTML=card(drag.id,s.current);document.body.append(ghost);drag.ghost=ghost;
  }
  drag.ghost.style.transform=`translate(${event.clientX-38}px,${event.clientY-64}px)`;
  const cell=document.elementFromPoint(event.clientX,event.clientY)?.closest?.('[data-cell]');
  root.querySelectorAll('.drop-hover').forEach(node=>node.classList.remove('drop-hover'));
  if(cell?.classList.contains('ok'))cell.classList.add('drop-hover');
});
window.addEventListener('pointerup',event=>{
  if(!drag||event.pointerId!==drag.pointer)return;
  const dragging=Boolean(drag.ghost);endDrag();
  if(!dragging)return;
  suppressClick=true;setTimeout(()=>{suppressClick=false;},60);
  const cell=document.elementFromPoint(event.clientX,event.clientY)?.closest?.('[data-cell]');
  if(cell)tapCell(Number(cell.dataset.cell),true);
});
window.addEventListener('pointercancel',endDrag);
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
    if(modal)closeModal();
    else if(screen==='game'&&(selection.cardId!==null||openingChoice)){resetSelection();notice='';render();}
    return;
  }
  if(event.key==='Tab'&&modal){
    const items=[...root.querySelectorAll('.dialog button:not(:disabled),.dialog input,.dialog textarea,.dialog summary')],first=items[0],last=items.at(-1);
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===root.querySelector('.dialog'))){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    return;
  }
  const move={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key],cell=document.activeElement?.closest?.('[data-cell]');
  if(!move||!cell||screen!=='game'||modal)return;
  const layout=currentLayout();let slot=layout.slotOf.get(Number(cell.dataset.cell));
  do{slot=neighborSlot(layout,slot,move[0],move[1]);}while(slot!==null&&!session.state.config.active.includes(layout.order[slot]));
  if(slot!==null){event.preventDefault();root.querySelector(`[data-cell="${layout.order[slot]}"]`)?.focus();}
});
window.addEventListener('resize',()=>{if(screen!=='game')return;if(isWide()!==wasWide)render();else{fitBoard();drawLinks();}});
document.fonts?.ready.then(()=>{if(screen==='game'){fitBoard();drawLinks();}});
render();
