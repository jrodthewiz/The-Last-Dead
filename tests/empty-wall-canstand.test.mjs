import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {makeCourse,canStand} from '../engine.js';
import {makeHarborCourse} from '../harbor-course.js';
import {harborRoomAt,roomCollision} from '../harbor-interiors.js';
import {propCanStand} from '../harbor-collision.js';
import {supportAt,canStandStructure,structureAt,isStructureWall,STRUCTURE_BODY_HEIGHT} from '../coastal-structures.js';
import {groundAt} from '../coastal-terrain.js';

const frozen=fs.readFileSync(new URL('../output/qa-runtime/island-environment-v86/engine.js',import.meta.url),'utf8'),current=fs.readFileSync(new URL('../engine.js',import.meta.url),'utf8');
const declaration=text=>{const line=text.match(/^export function canStand\([^\r\n]+/m)?.[0];assert(line);return line.replace(/^export /,'');};
const oldLine=declaration(frozen),newLine=declaration(current);
const added=';if(!walls[0]&&!walls[1]&&!walls[2]&&!walls[3])continue;const segments=';
assert.equal(newLine.replace(added,',segments='),oldLine,'exact scope: only empty-wall continue differs');
function oracle(line,counters={segmentSites:0}){
 const marker='segments=[[cx,cy,cx+1,cy],[cx+1,cy,cx+1,cy+1],[cx,cy+1,cx+1,cy+1],[cx,cy,cx,cy+1]];';assert(line.includes(marker));
 line=line.replace(marker,'segments=(counters.segmentSites++,[[cx,cy,cx+1,cy],[cx+1,cy,cx+1,cy+1],[cx,cy+1,cx+1,cy+1],[cx,cy,cx,cy+1]]);');
 return new Function('harborRoomAt','roomCollision','propCanStand','supportAt','groundAt','canStandStructure','structureAt','isStructureWall','STRUCTURE_BODY_HEIGHT','clamp','counters',`return (${line});`)(harborRoomAt,roomCollision,propCanStand,supportAt,groundAt,canStandStructure,structureAt,isStructureWall,STRUCTURE_BODY_HEIGHT,(x,a,b)=>Math.max(a,Math.min(b,x)),counters);
}
const before=oracle(oldLine),after=oracle(newLine);let comparisons=0;
function equal(course,x,y,radius,feet,height){const a=before(course,x,y,radius,feet,height),b=after(course,x,y,radius,feet,height);assert.equal(b,a,`${x}/${y} radius${radius} feet${feet}`);assert.equal(canStand(course,x,y,radius,feet,height),a);comparisons++;}
const real=makeHarborCourse({openWorld:true}),legacy=makeCourse(0);
test('real coastal and legacy cells retain exact old decisions across all cell centres',()=>{
 for(const course of [real,legacy])for(let y=0;y<course.h;y++)for(let x=0;x<course.w;x++)equal(course,x+.5,y+.5,.16,undefined);
});
test('real routes, wall edges, interior/structure support, exceptional feet and radii retain frozen decisions',()=>{
 const points=[[58,58],[0,0],[real.w,real.h],[58.9999999,58],[59,58],[59.0000001,58],[335.97/4,387.34/4],[434.2/4,25.4/4],[NaN,58],[58,NaN],[Infinity,58],[-Infinity,58],...real.coastal.structures.flatMap(s=>[[(s.bounds.minX+s.bounds.maxX)/2,(s.bounds.minY+s.bounds.maxY)/2],...s.stairPath.map(p=>[p.x,p.y])])];
 const rooms=real.harborRooms.slice(0,2);for(const room of rooms)points.push([room.x/4,room.z/4],[(room.x-room.width/2)/4,room.z/4]);
 for(const active of [null,...rooms]){real.activeInterior=active;for(const [x,y]of points)for(const radius of [undefined,0,.075,.16,.22,.5,NaN,Infinity])for(const feet of [undefined,null,NaN,-Infinity,Infinity,0,groundAt(real,x,y),groundAt(real,x,y)+.05])equal(real,x,y,radius,feet);}
 real.activeInterior=null;
});
test('ordinary wall-array mutations and every side retain truthy/falsy collision authority',()=>{
 const course={w:8,h:8,cells:Array.from({length:64},()=>[0,0,0,0])},cell=course.cells[3*8+3];
 for(let mask=0;mask<16;mask++){for(let side=0;side<4;side++)cell[side]=(mask>>side)&1;
  for(const [x,y]of [[3.5,3.5],[3.03,3.5],[3.97,3.5],[3.5,3.03],[3.5,3.97],[3,3],[4,4]])for(const r of [.075,.16,.5])equal(course,x,y,r);
 }
 for(const value of [0,false,null,undefined,NaN,1,true,'0'])for(let side=0;side<4;side++){
  cell.fill(0);cell[side]=value;for(const [x,y]of [[3.5,3.5],[3.03,3.5],[3.97,3.5],[3.5,3.03],[3.5,3.97]])equal(course,x,y,.16);
 }cell.fill(0);
});
test('open-cell array-construction sites disappear while wall-rich sites and results remain',()=>{
 const open={w:8,h:8,cells:Array.from({length:64},()=>[0,0,0,0])},wall={w:8,h:8,cells:Array.from({length:64},()=>[1,0,0,0])};
 const rows=[];
 for(const [name,course]of [['open',open],['wall-rich',wall]]){
  const a={segmentSites:0},b={segmentSites:0},old=oracle(oldLine,a),now=oracle(newLine,b);
  for(let i=0;i<6720;i++)assert.equal(now(course,3.5,3.5,.16),old(course,3.5,3.5,.16));
  if(name==='open'){assert.equal(a.segmentSites,6720);assert.equal(b.segmentSites,0);}else assert.equal(a.segmentSites,b.segmentSites);
  rows.push({name,queries:6720,oldSegmentConstructionSites:a.segmentSites,newSegmentConstructionSites:b.segmentSites,sourceArrayLiteralsPerSite:5});
 }
 const report={scope:'Exact frozenv86 canStand with identical current authority dependencies. Construction-site counts describe JS source operations, not JIT heap allocation, elapsed cost/FPS or VRAM.',comparisons,realCells:real.w*real.h,legacyCells:legacy.w*legacy.h,rows,sourceSHA256:createHash('sha256').update(newLine).digest('hex'),ownedChange:'Only all-four-falsy early continue before wall segment construction'};
 fs.writeFileSync('output/island-empty-wall-performance-findings.json',JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync('output/island-empty-wall-performance-findings.md',`# Empty-wall collision construction\n\n${comparisons} exact frozenv86/current decisions passed over actual coastal/legacy cells, real interiors/supports, borders/exceptional inputs and mutated wall sides. The engine function differs only by the all-falsy early continue.\n\nBounded equal-result6720-query open-cell fixture: segment construction sites6720→0. Wall-rich fixture retains equal construction sites. Each source site contains five array literals; this is not a measurement of JIT allocation or native time. Added retained resources: zero. Native performance/art validation remains pending.\n`);
});
