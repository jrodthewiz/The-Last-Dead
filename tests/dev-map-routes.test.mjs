import test from 'node:test';
import assert from 'node:assert/strict';
import {DEV_MAPS,devMapHref} from '../dev-map-routes.js';

for(const map of DEV_MAPS)test(`development link loads ${map.name} despite prior floor or arena selectors`,()=>{
  const href=devMapHref(map.id,'?dungeon=4&campaign=1&sector=2&world=harbor&extended=0&debug=1&worldSeed=123');
  const params=new URLSearchParams(href.slice(1));
  assert.equal(params.get('dev'),'1');assert.equal(params.get('inspect'),'1');
  assert.equal(params.get('debug'),'1');assert.equal(params.get('worldSeed'),'123');
  assert.equal(params.get('world'),map.id==='island'?'island':null);
  for(const key of ['dungeon','campaign','sector','extended'])assert.equal(params.has(key),false,`${key} must not override the chosen map`);
});
test('development links reject unknown worlds',()=>assert.throws(()=>devMapHref('missing'),/Unknown development map/));
