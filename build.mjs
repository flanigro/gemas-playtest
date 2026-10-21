import {readFile,writeFile,readdir} from 'node:fs/promises';
import {newGame,assertState} from './src/engine.mjs';
assertState(newGame('build-validation'));
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const strip=source=>source.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const modules=['random','config','generator','engine','session','opponent','opponent-controller','game-view','ui'];
const assets={};
for(const name of ['gemas_atlas_v0.svg',...(await readdir(new URL('./assets/figma/',import.meta.url))).sort().map(p=>'figma/'+p)]){
  const bytes=await readFile(new URL('assets/'+name,import.meta.url));if(!bytes.length)throw Error('Ativo vazio: '+name);assets[name]=`data:image/svg+xml;base64,${bytes.toString('base64')}`;
}
let css=await read('src/styles.css');for(const name of ['Jost','Marcellus']){const font=await readFile(new URL(`assets/fonts/${name}.ttf`,import.meta.url));css=css.replace(`../assets/fonts/${name}.ttf`,`data:font/ttf;base64,${font.toString('base64')}`);}
const worker=(await Promise.all(['random','config','generator','engine','opponent','worker'].map(m=>read(`src/${m}.mjs`)))).map(strip).join('\n');
const script=`const GEMAS_ASSETS=${JSON.stringify(assets)};\nconst GEMAS_WORKER_SOURCE=${JSON.stringify(worker)};\n`+(await Promise.all(modules.map(m=>read(`src/${m}.mjs`)))).map(strip).join('\n');
const licenses=(await Promise.all(['Jost-OFL.txt','Marcellus-OFL.txt'].map(name=>read('assets/fonts/'+name)))).join('\n').replace(/-->/g,'—>');
const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GEMAS · Playtest 0.2.0</title><style>${css}</style><main id="app"></main><script type="module">${script.replace(/<\/script/gi,'<\\/script')}</script><!-- Font licenses: ${licenses} --></html>`;
for(const name of ['index.html','ABRIR_GEMAS.html'])await writeFile(new URL(name,import.meta.url),html);
console.log('index.html e ABRIR_GEMAS.html gerados, com fontes, atlas e Worker incorporados.');
