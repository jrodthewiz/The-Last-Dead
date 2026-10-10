import test from 'node:test';
import assert from 'node:assert/strict';
import {createCapeGroundAtlas} from '../assets/forest-kit/ground-atlas.js';
import {capeBiomeWeights,capeTrailPeatField} from '../coastal-terrain-fields.js';

test('fine biological litter and compacted mineral grain have distinct bounded material construction',()=>{
 const atlas=createCapeGroundAtlas();try{
  const d=atlas.diagnostics;assert.equal(d.textures,2);assert.ok(d.bytesWithMipmaps<=11*1024*1024);
  assert.ok(d.needleLengthMetres[0]>=.03&&d.needleLengthMetres[1]<=.122);assert.ok(d.needleWidthMetres>=.001&&d.needleWidthMetres<=.003);
  assert.ok(d.gritDiameterMetres[0]>=.002&&d.gritDiameterMetres[1]<=.0081);assert.equal(d.largeAggregateCount,160);
  const packed=atlas.normal.image.data,color=atlas.albedo.image.data,at=(role,x,y)=>((y+32+(role>>1)*512)*1024+x+32+(role%2)*512)*4;
  const rough=[0,0,0,0],height=[0,0,0,0],light=[0,0,0,0];let count=0;
  for(let y=0;y<448;y+=3)for(let x=0;x<448;x+=3){count++;for(let role=0;role<4;role++){const i=at(role,x,y);rough[role]+=packed[i+3];height[role]+=color[i+3];light[role]+=color[i]+color[i+1]+color[i+2];}}
  assert.ok(rough[0]/count>235&&rough[3]/count>225,'pressed residue and grit are matte, not raised glossy straw');
  assert.ok(height[0]/count<height[1]/count,'fine needles sit lower than actual moss cushions');
  assert.ok(light[0]<light[3],'deep pine litter is distinct from exposed mineral grain');
  const core=capeBiomeWeights(340,376),shoulder=capeBiomeWeights(335.97,387.34,{pine:.9});assert.ok(core[3]>.65&&core[0]<.35);assert.ok(shoulder[0]>.7,'loose litter belongs to actual root beds');assert.ok(capeTrailPeatField(340,376)>.2);
 }finally{atlas.dispose();}
});
