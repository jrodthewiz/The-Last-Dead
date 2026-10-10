import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {TIMBER_WORKSPACE_CONTACTS as contacts,TIMBER_BOARD_DRAG as drag,makeCoastalTimberWorkspace} from '../coastal-timber-workspace.js';
import {evaluateTimberWorkspaceWear as wear,evaluateTimberWorkspaceSurface as surface,createBlackwaterStreetSurface} from '../blackwater-street-surfaces.js';
import {makeBlackwaterDistrict} from '../blackwater-district-layout.js';
import {makeCoastalNeighborhoods} from '../coastal-neighborhood-layout.js';
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// Evaluate the ACTUAL node adapter under double arithmetic. This exercises its
// argument order and shared expression, without claiming a GPU compiler test.
const source=readFileSync(new URL('../blackwater-street-surfaces.js',import.meta.url),'utf8');
class N{constructor(v){this.v=Number(v instanceof N?v.v:v);}add(v){return new N(this.v+Number(v));}sub(v){return new N(this.v-Number(v));}mul(v){return new N(this.v*Number(v));}div(v){return new N(this.v/Number(v));}abs(){return new N(Math.abs(this.v));}min(v){return new N(Math.min(this.v,Number(v)));}max(v){return new N(Math.max(this.v,Number(v)));}sin(){return new N(Math.sin(this.v));}clamp(a,b){return new N(Math.max(Number(a),Math.min(Number(b),this.v)));}smoothstep(a,b){return new N(smooth(Number(a),Number(b),this.v));}valueOf(){return this.v;}}
const begin=source.indexOf('const nodes='),end=source.indexOf('export function evaluateTimberWorkspaceWear');
const nodeWear=vm.runInNewContext(source.slice(begin,end)+'\n(x,z,p)=>timberWearAt(float(x),float(z),float(p),nodes)',{float:v=>new N(v),TIMBER_WORKSPACE_CONTACTS:contacts,TIMBER_BOARD_DRAG:drag});
const nodeGate=vm.runInNewContext(source.slice(begin,source.indexOf('function timberWearAt'))+source.slice(source.indexOf('function timberSurfaceGate'),source.indexOf('export function evaluateTimberWorkspaceSurface'))+'\n(y,n)=>timberSurfaceGate(float(y),float(n),nodes)',{float:v=>new N(v)});
test('scalar/node adapter parity and physical square contact skirts retain bounded filtering',()=>{
 for(const pixel of [0,.005,.02,.08,.2,1])for(let x=326.2;x<=330.5;x+=.071)for(let z=168.1;z<=169.65;z+=.037){const a=wear(x,z,pixel),b=nodeWear(x,z,pixel);for(const key of ['pressure','drag'])assert.ok(Math.abs(a[key]-Number(b[key]))<1e-12,key);}
 for(const [x,z] of contacts){assert.equal(wear(x+.14,z+.14,.005).pressure,1,'square corner just beyond .125m foot remains seated');assert.ok(wear(x+.17,z,.02).pressure>0,'visible exterior skirt');assert.equal(wear(x+.186,z,.005).pressure,0,'strict .06m exterior cap');assert.equal(wear(x,z,1).pressure,0,'subpixel pressure fades');}
 for(const [a,b] of [[drag[0],drag[1]],[drag[1],drag[2]]]){let high=0,low=1;for(let i=0;i<=100;i++){const t=i/100,p=a.map((v,j)=>v+(b[j]-v)*t);const f=wear(...p,.005);high=Math.max(high,f.drag);low=Math.min(low,f.drag);}assert.ok(high>.95&&low<.05);}
});
test('only actual apron/sidewalk tops receive wear, with clean curb and other levels',()=>{
 const [x,z]=contacts[0];
 for(const y of [0,.132,.133,.134,.135,.136,.137,.138,.162,.165,.166,.168,.21])for(const n of [-1,0,.64,.65,.8,.92,1])assert.ok(Math.abs(surface(x,y,z,n).pressure-Number(nodeGate(y,n)))<1e-12);
 for(const y of [.135,.165])assert.equal(surface(x,y,z,1).pressure,1);
 for(const y of [0,.12,.145,.155,.18,.21,.4,2])assert.deepEqual(surface(x,y,z,1),{pressure:0,drag:0});
 for(const normal of [-1,-.8,0,.1,.64])assert.deepEqual(surface(x,.165,z,normal),{pressure:0,drag:0});
 for(const p of [[326.5,.165,170,1],[333,.165,169.48,1],[330,.21,169.48,0]])assert.deepEqual(surface(...p),{pressure:0,drag:0});
 for(const bad of [[NaN,.165,z,1],[x,Infinity,z,1],[x,.165,z,1,-1]])assert.throws(()=>surface(...bad),TypeError);
 const paving=createBlackwaterStreetSurface('paving','#99a49c');assert.ok(paving.fields.timberPressure&&paving.fields.timberDrag);assert.equal(paving.metadata.extraDraws,0);assert.equal(paving.metadata.textures,0);assert.equal(createBlackwaterStreetSurface('asphalt','#465056').fields.timberPressure,undefined);
 assert.match(source,/timberSurfaceGate\(positionWorld.y,normalWorld.y,nodes\)/,'actual native graph uses shared height/normal cause');
});
test('transfer authoring changes no supported workspace part, collider or contact',()=>{
 const p=makeCoastalTimberWorkspace({buildings:makeBlackwaterDistrict(makeCoastalNeighborhoods()).lots});
 const hash=createHash('sha256').update(JSON.stringify({parts:p.parts,communities:p.communities,obstacles:p.obstacles,bounds:p.bounds})).digest('hex');
 assert.equal(hash,'be69107d50d13f8698730132cc5995cb0b414e6b013b43c8f7f5f510e48a151b','accepted actual geometry/authority digest');
 assert.deepEqual(drag,[[330.2,169.48],[328.5,169.48],[327.2,169.44]]);assert.equal(contacts.length,4);assert.equal(drag.length-1,2);
});
