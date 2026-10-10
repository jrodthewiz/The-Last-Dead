import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateTimberWorkspaceWear,createBlackwaterStreetSurface} from '../blackwater-street-surfaces.js';
import {TIMBER_WORKSPACE_CONTACTS,TIMBER_BOARD_DRAG} from '../coastal-timber-workspace.js';

test('timber wear belongs to supported feet and a short broken board route, leaving road and passage clear',()=>{
 for(const foot of TIMBER_WORKSPACE_CONTACTS)assert.equal(evaluateTimberWorkspaceWear(...foot,.02).pressure,1);
 let high=0,low=1;
 const [a,b]=TIMBER_BOARD_DRAG;
 for(let i=0;i<=100;i++){const t=i/100,f=evaluateTimberWorkspaceWear(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,.005);high=Math.max(high,f.drag);low=Math.min(low,f.drag);}
 assert.ok(high>.95&&low<.05,'drag breaks into short contact spans rather than a broad continuous band');
 for(const p of [[327,170],[333,169],[318,168],[40,56],[337,386]])assert.deepEqual(evaluateTimberWorkspaceWear(...p),{pressure:0,drag:0});
 for(const foot of TIMBER_WORKSPACE_CONTACTS)assert.deepEqual(evaluateTimberWorkspaceWear(...foot,1),{pressure:0,drag:0});
 for(let x=325;x<=333;x+=.2)for(let z=167;z<=171;z+=.2)for(const v of Object.values(evaluateTimberWorkspaceWear(x,z)))assert.ok(Number.isFinite(v)&&v>=0&&v<=1);
 const paving=createBlackwaterStreetSurface('paving','#99a49c');
 assert.ok(paving.fields.timberPressure&&paving.fields.timberDrag);
 assert.equal(paving.metadata.extraDraws,0);assert.equal(paving.metadata.textures,0);
 assert.equal(createBlackwaterStreetSurface('asphalt','#465056').fields.timberPressure,undefined,'contact belongs to concrete work apron');
});
