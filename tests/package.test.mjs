import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('index e entrada alternativa abrem sem módulos, CSS ou fontes externos',()=>{
  const index=read('index.html');assert.equal(index,read('ABRIR_GEMAS.html'));
  assert.match(index,/const GEMAS_ASSETS=/);assert.match(index,/const GEMAS_WORKER_SOURCE=/);
  assert.doesNotMatch(index,/<script\b[^>]*\bsrc=/i);assert.doesNotMatch(index,/<link\b[^>]*rel="stylesheet"/i);
  assert.match(index,/data:font\/ttf;base64,/);assert.match(index,/Font licenses:/);
  assert.match(read('dev.html'),/location\.protocol==='file:'/);
  assert.match(read('dev.html'),/location\.replace\(new URL\('\.\/index\.html'/);
  assert.match(read('dev.html'),/entry\.src='\.\/src\/ui\.mjs'/);
});
