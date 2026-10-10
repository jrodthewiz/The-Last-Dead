import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {capeGroundHeight} from '../coastal-terrain.js';
export const RIDGE_Y_RECORDS=JSON.parse(readFileSync(new URL('./fixtures/coastal-residential-ridge-y.json',import.meta.url),'utf8'));
const allowed=new Set([...RIDGE_Y_RECORDS.forestPlacements,...RIDGE_Y_RECORDS.understoryPlacements]);
// Restore ONLY explicitly declared measured support IDs for historical full
// record digests; no other field or Y value is normalized away.
export function preRidgeRecords(records){
 return records.map(p=>{
  const old=capeGroundHeight(p.x,p.z,{residentialRidge:false}),now=capeGroundHeight(p.x,p.z),delta=now-old;
  if(delta===0)return p;
  assert.ok(allowed.has(p.id),'no undeclared support record may change');
  assert.ok(p.x>393&&p.x<447&&p.z>5&&p.z<112&&delta>=-.450001&&delta<=4.2);
  assert.equal(p.y,now,'declared records stand on shared new ground');
  return {...p,y:old};
 });
}
