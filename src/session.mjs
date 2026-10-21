import {newGame,dispatch,assertState} from './engine.mjs';
import {RULES_VERSION,GENERATOR_VERSION,copy,demand,OWNERS} from './config.mjs';
function validateReport(report){
  if(report===null)return;
  demand(report&&typeof report==='object'&&typeof report.reason==='string'&&report.reason.length<2000&&typeof report.information==='string'&&report.information.length<1000&&typeof report.version==='string'&&report.version.length<100&&Number.isInteger(report.candidates)&&report.candidates>=0&&Number.isInteger(report.replies)&&report.replies>=0&&Array.isArray(report.alternatives)&&report.alternatives.length<=3,'Relatório do computador inválido.');
  for(const alternative of report.alternatives)demand(alternative&&Number.isFinite(alternative.value)&&Number.isFinite(alternative.immediate)&&alternative.action&&['move','opening'].includes(alternative.action.type),'Alternativa do computador inválida.');
}
export class GameSession {
  constructor(setup) {
    demand(setup&&typeof setup==='object','Preparação inválida.');
    demand(setup.players&&OWNERS.every(p=>['human','computer'].includes(setup.players[p])),'Jogadores inválidos.');
    demand(['beginner','experienced'].includes(setup.difficulty),'Nível inválido.');
    this.setup=copy(setup);this.commands=[];this.reports=[];this.cursor=0;this.notes='';this.states=[newGame(setup.seed,setup.config)];
  }
  get state(){return this.states[this.cursor];}
  controller(owner=this.state.current){return this.setup.players[owner];}
  dispatch(action,report=null){
    validateReport(report);
    const next=dispatch(this.state,action);
    this.commands=this.commands.slice(0,this.cursor);this.reports=this.reports.slice(0,this.cursor);this.states=this.states.slice(0,this.cursor+1);
    this.commands.push(copy(action));this.reports.push(report?copy(report):null);this.states.push(next);this.cursor++;return next;
  }
  undo(){if(this.cursor)this.cursor--;return this.state;}
  redo(){if(this.cursor<this.commands.length)this.cursor++;return this.state;}
  undoHumanTurn(){do{this.undo();}while(this.cursor>0&&this.controller()==='computer');return this.state;}
  redoHumanTurn(){do{this.redo();}while(this.cursor<this.commands.length&&this.controller()==='computer');return this.state;}
  serialize(){return JSON.stringify({format:'GEMAS-SAVE',version:1,rulesVersion:RULES_VERSION,generatorVersion:GENERATOR_VERSION,setup:this.setup,commands:this.commands,reports:this.reports,cursor:this.cursor,notes:this.notes,state:this.state},null,2);}
  static load(text){
    demand(typeof text==='string'&&text.length<=3_000_000,'Arquivo grande demais ou inválido.');const saved=JSON.parse(text);
    demand(saved.format==='GEMAS-SAVE'&&saved.version===1,'Este arquivo não é uma partida compatível de GEMAS.');
    demand(saved.rulesVersion===RULES_VERSION&&saved.generatorVersion===GENERATOR_VERSION,'Esta partida de GEMAS usa regras anteriores. Guarde o arquivo e inicie uma nova partida para aplicar as regras atuais.');
    const session=new GameSession(saved.setup),max=session.state.config.active.length-1;
    demand(Array.isArray(saved.commands)&&saved.commands.length<=max&&Array.isArray(saved.reports)&&saved.reports.length===saved.commands.length,'Histórico incompatível.');
    demand(Number.isInteger(saved.cursor)&&saved.cursor>=0&&saved.cursor<=saved.commands.length&&typeof saved.notes==='string'&&saved.notes.length<=100000,'Cursor ou notas inválidos.');
    for(let i=0;i<saved.commands.length;i++)session.dispatch(saved.commands[i],saved.reports[i]);session.cursor=saved.cursor;session.notes=saved.notes;
    assertState(saved.state);demand(JSON.stringify(saved.state)===JSON.stringify(session.state),'O estado salvo não confere com a reprodução.');return session;
  }
}
