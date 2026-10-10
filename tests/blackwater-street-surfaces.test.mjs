import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {BLACKWATER_STREET_FIELDS,evaluateBlackwaterStreetFields,createBlackwaterStreetSurface} from '../blackwater-street-surfaces.js';
import {makeBlackwaterGraphicMaterial,makeBlackwaterBands} from '../blackwater-render-looks.js';
import {makeHarborCourse} from '../harbor-course.js';
import {PORT_HANDLING_GROUND,portFrontagePlan} from '../coastal-port-frontage.js';
import {canStand} from '../engine.js';
import {TOWN_HANDLING_GROUND} from '../coastal-town-details.js';

test('road traces end at the existing wrecks and leave the authoritative course intact',()=>{
 const course=makeHarborCourse({openWorld:true}),before=JSON.stringify(course.obstacles),props=course.coastal.blackwaterSlice.props;
 for(const path of BLACKWATER_STREET_FIELDS.braking){
  const wreck=props.find(p=>p.id==='blackwater-'+path.id.replace('-braking',''));
  assert.ok(wreck,path.id+' has a real destination');assert.deepEqual(path.points.at(-1),[wreck.x,wreck.z]);
  assert.ok(path.halfWidth>=.08&&path.axleHalfWidth>.5);
 }
 for(const patch of BLACKWATER_STREET_FIELDS.repairs){assert.ok(Object.isFrozen(patch.center));assert.equal(evaluateBlackwaterStreetFields(...patch.center).repair,1);}
 assert.equal(JSON.stringify(course.obstacles),before);
 assert.equal(course.coastal.blackwaterSlice.buildings.filter(b=>b.enterable).length,94);
});

test('road fields remain finite, bounded and deterministic across world scales',()=>{
 for(const pixel of [0,.005,.02,.2,1,4])for(let x=140;x<=236;x+=3)for(let z=44;z<=68;z+=2){
  const field=evaluateBlackwaterStreetFields(x,z,pixel);
  for(const [name,value]of Object.entries(field)){assert.ok(Number.isFinite(value),name);assert.ok(name==='wash'?value>=.94&&value<=1.03:value>=0&&value<=1,name+' '+value);}
  assert.deepEqual(field,evaluateBlackwaterStreetFields(x,z,pixel));
 }
 for(const input of [[NaN,56],[200,Infinity],[200,56,-1]])assert.throws(()=>evaluateBlackwaterStreetFields(...input),TypeError);
 for(const p of [[145,56],[240,56],[200,40],[200,75]]){const f=evaluateBlackwaterStreetFields(...p);assert.deepEqual(f,{repair:0,repairSeam:0,braking:0,cracks:0,gutter:0,wash:1,main:0,handling:0,handlingWheel:0,handlingDeposit:0});}
});

test('handling wear joins the real depot threshold to its existing carriageway without changing traversal',()=>{
 const course=makeHarborCourse({openWorld:true}),before=JSON.stringify(course),threshold=portFrontagePlan(course).find(p=>p.role==='depot-steel-threshold');
 const start=PORT_HANDLING_GROUND.path[0];assert.deepEqual(start,[threshold.position[0],threshold.position[2]+.5]);
 assert.ok(Object.isFrozen(PORT_HANDLING_GROUND.path[0]));
 for(const point of PORT_HANDLING_GROUND.path){
  assert.equal(evaluateBlackwaterStreetFields(...point,.02).handling,1,'continuous handling envelope');
  assert.ok(canStand(course,point[0]/4,point[1]/4,.16),'actual depot loading axis stays traversable');
 }
 for(const side of [-1,1])assert.ok(evaluateBlackwaterStreetFields(64+side*1.55,70,.02).handlingWheel>.9,'wheels meet the actual apron tracks');
 assert.equal(evaluateBlackwaterStreetFields(64,70,.02).handlingWheel,0,'paired wear leaves the route centre open');
 assert.equal(evaluateBlackwaterStreetFields(43.4,56,.02).handling,0,'through lane is outside the handling pocket');
 assert.equal(evaluateBlackwaterStreetFields(65.55,70,4).handlingWheel,0,'subpixel wheel marks fade');
 assert.equal(JSON.stringify(course),before);
});

test('subpixel cracks and tyre traces fade while macro repairs remain visible',()=>{
 const crack=BLACKWATER_STREET_FIELDS.cracks[0].points[0];
 assert.ok(evaluateBlackwaterStreetFields(...crack,.005).cracks>.9);
 assert.equal(evaluateBlackwaterStreetFields(...crack,.2).cracks,0);
 const path=BLACKWATER_STREET_FIELDS.braking[0],p=path.points[0];
 for(const side of [-1,1])assert.ok(evaluateBlackwaterStreetFields(p[0],p[1]+side*path.axleHalfWidth,.02).braking>.95);
 assert.equal(evaluateBlackwaterStreetFields(...p,.02).braking,0,'paired wheels leave an unmarked centre');
 assert.equal(evaluateBlackwaterStreetFields(p[0],p[1]+path.axleHalfWidth,1).braking,0);
 assert.equal(evaluateBlackwaterStreetFields(199.8,57.7,1).repair,1);
 assert.equal(evaluateBlackwaterStreetFields(205,50.35).gutter,1);
 assert.equal(evaluateBlackwaterStreetFields(205,56).gutter,0);
});

test('small handling routes start at actual carried carts and join the open road',()=>{
 const course=makeHarborCourse({openWorld:true}),before=JSON.stringify(course.obstacles);
 const parts=course.coastal.townDetails.parts;
 for(const route of TOWN_HANDLING_GROUND){
  assert.ok(Object.isFrozen(route.path)&&route.path.every(Object.isFrozen));
  const role=route.id==='netmakers-net-cart'?'net-cart-deck':'maintenance-hand-truck-platform';
  const cart=parts.find(p=>p.communityId===route.communityId&&p.role===role);
  assert.ok(cart,'wear belongs to an actual wheeled work station');
  const origin=route.path[0];
  assert.ok(Math.hypot(origin[0]-cart.position[0],origin[1]-cart.position[2])<.06);
  for(const point of route.path)assert.equal(evaluateBlackwaterStreetFields(...point,.02).handling,1);
  for(let segment=1;segment<route.path.length;segment++)for(let step=1;step<=10;step++){
   const a=route.path[segment-1],b=route.path[segment],t=step/10,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
   const obstacle=course.coastal.townDetails.communities.find(p=>p.id===route.communityId).obstacle;
   if(z<obstacle.minY*4-.65)assert.ok(canStand(course,x/4,z/4,.16),'clear handling approach');
  }
  assert.equal(evaluateBlackwaterStreetFields(...route.path.at(-1),4).handlingWheel,0);
 }
 assert.equal(JSON.stringify(course.obstacles),before);
});

test('cargo deposits collect at actual turns and are washed through the constructed drains',()=>{
 assert.ok(evaluateBlackwaterStreetFields(25,64.4).handlingDeposit>.5);
 assert.ok(evaluateBlackwaterStreetFields(39,56.4).handlingDeposit<.1,'through travel does not paint a continuous dust ribbon');
 for(const p of [[28.36,62.3],[55.08,62.3]]){
  const field=evaluateBlackwaterStreetFields(...p);
  assert.ok(field.handling>.9,'actual handling route crosses the drain');
  assert.equal(field.handlingDeposit,0,'drain clears the loose deposit while keeping wheel route authority');
 }
});

test('production graphic materials retain single-pass field diagnostics without owning borrowed resources',()=>{
 const bands=makeBlackwaterBands([.075,.34,1]),map=new THREE.Texture();let disposed=0;map.addEventListener('dispose',()=>disposed++);
 for(const role of ['asphalt','paving']){
  const source=new THREE.MeshStandardMaterial({map});source.userData.lookRole=role;source.addEventListener('dispose',()=>disposed++);
  const material=makeBlackwaterGraphicMaterial(source,bands),surface=material.blackwaterSurfaceNodes;
  assert.ok(material.colorNode&&surface);assert.equal(material.map,null);assert.equal(surface.metadata.extraDraws,0);assert.equal(surface.metadata.textures,0);
  assert.equal(surface.metadata.coordinates,'stable world XZ metres');assert.equal(surface.metadata.surface,role);
  for(const channel of surface.metadata.debugChannels){surface.setDebug(channel);assert.ok(surface.debug.value>0);assert.ok(surface.fields[channel].isNode);}
  surface.setDebug();assert.equal(surface.debug.value,0);assert.throws(()=>surface.setDebug('bogus'),RangeError);
  assert.equal(material.side,source.side);material.dispose();assert.equal(disposed,0);
 }
 assert.equal(createBlackwaterStreetSurface('brick','#ffffff'),null);
 const sign=new THREE.MeshStandardMaterial({map});sign.userData.lookRole='sign';const graphicSign=makeBlackwaterGraphicMaterial(sign,bands);
 assert.equal(graphicSign.map,map);assert.equal(graphicSign.blackwaterSurfaceNodes,undefined);graphicSign.dispose();bands.dispose();
 assert.equal(disposed,0);
});
