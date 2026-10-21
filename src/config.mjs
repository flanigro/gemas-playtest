export const RULES_VERSION='GEMAS-RULES-0.1';
export const GENERATOR_VERSION='GEMAS-GENERATOR-1';
export const OWNERS=Object.freeze(['branco','preto']);
export const COLOR_IDS=Object.freeze('ABCDEFGH'.split(''));
export const COLOR_NAMES=Object.freeze(['Vermelha','Laranja','Amarela','Verde','Azul','Violeta','Rosa','Turquesa']);
export const SHAPE_NAMES=Object.freeze(['Círculo','Quadrado','Triângulo','Losango','Hexágono','Estrela','Gota','Lua']);
export const copy=value=>structuredClone(value);
export const demand=(ok,message)=>{if(!ok)throw new Error(message);};
export const other=owner=>owner==='branco'?'preto':'branco';
export const coordinate=(index,columns=4)=>`L${Math.floor(index/columns)+1}C${index%columns+1}`;
export function normalizeConfig(input={}) {
  demand(input&&typeof input==='object'&&!Array.isArray(input),'Configuração inválida.');
  const rows=input.rows??4,columns=input.columns??4,colors=input.colors??6,shapes=input.shapes??8;
  demand(rows===4&&[4,6].includes(columns),'Use um tabuleiro 4×4 ou 4×6.');
  for(const [name,value] of [['cores',colors],['formas',shapes]])demand(Number.isInteger(value)&&value>=2&&value<=8,`Escolha de 2 a 8 ${name}.`);
  const all=Array.from({length:rows*columns},(_,i)=>i),active=input.active===undefined?all:copy(input.active);
  demand(Array.isArray(active)&&active.length>=2&&active.every(i=>Number.isInteger(i)&&all.includes(i))&&new Set(active).size===active.length,'Máscara inválida: use pelo menos duas casas ativas distintas.');
  active.sort((a,b)=>a-b);
  const centers=columns===4?[5,10]:[8,15];
  const positions=input.positions??(centers.every(i=>active.includes(i))?centers:active.slice(0,2));
  demand(Array.isArray(positions)&&positions.length===2&&positions[0]!==positions[1]&&positions.every(i=>active.includes(i)),'A abertura exige duas casas ativas diferentes.');
  const opener=input.opener??'sorteio';demand(opener==='sorteio'||OWNERS.includes(opener),'Primeiro jogador inválido.');
  const allowLastConversion=input.allowLastConversion??false,blockFirstConversion=input.blockFirstConversion??false;
  demand(typeof allowLastConversion==='boolean'&&typeof blockFirstConversion==='boolean','Opções de conversão inválidas.');
  return {rows,columns,colors,shapes,active,positions:[...positions],opener,allowLastConversion,blockFirstConversion};
}
// Eight-neighbor connectivity, inherited from CM; inactive cells are never vertices.
export function adjacent(a,b,columns=4) {
  return a!==b&&Math.abs(Math.floor(a/columns)-Math.floor(b/columns))<=1&&Math.abs(a%columns-b%columns)<=1;
}
export function components(indices,columns) {
  const pending=new Set(indices),result=[];
  while(pending.size){const component=[pending.values().next().value];pending.delete(component[0]);
    for(let i=0;i<component.length;i++)for(const candidate of [...pending])if(adjacent(component[i],candidate,columns)){pending.delete(candidate);component.push(candidate);}
    result.push(component);
  }
  return result;
}
