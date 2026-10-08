import {LowTideVisuals} from './low-tide-visuals.js';
import {HarborInteriorVisuals} from './harbor-interior-visuals.js';
import {HarborThaiVisuals} from './harbor-thai-visuals.js';
import * as THREE from './vendor/three.module.js';
import {harborSurface,finishHarborDetail,harborMooring} from './harbor-detail.js';
import {makeCoastalWater} from './coastal-water.js';
import {buildCoastalScenery} from './coastal-world-visuals.js';
import {buildCoastalFrontages} from './coastal-neighborhood-visuals.js';
import {buildBlackwaterDistrict} from './blackwater-district-visuals.js';
import {applyBlackwaterGraphicStyle,applyBlackwaterCoastalSurfaces} from './blackwater-graphic-style.js';
import {createBlackwaterGraphicSky,BLACKWATER_LOOKS} from './blackwater-render-looks.js';
import {createForestVegetation} from './forest-vegetation.js';
import {buildCoastalMaritime} from './coastal-maritime-visuals.js';
import {createCoastalUnderstory} from './coastal-understory.js';
import {instanceHarborStaticDetails,isStaticHarborDetail} from './harbor-static-details.js';
import {createHarborShadowCoverage} from './harbor-shadow-coverage.js';

export const HARBOR_PALETTE={background:0x728f97,fog:0x728f97,fogNear:80,fogFar:280,exposure:1.25};
const waveSource=`
float sea(vec2 p,float t){return .18*sin(dot(p,vec2(.23,.12))-t*1.55)+.09*sin(dot(p,vec2(-.31,.37))-t*2.1)+.045*sin(dot(p,vec2(.72,.51))-t*2.85);}
vec2 slope(vec2 p,float t){return .18*vec2(.23,.12)*cos(dot(p,vec2(.23,.12))-t*1.55)+.09*vec2(-.31,.37)*cos(dot(p,vec2(-.31,.37))-t*2.1)+.045*vec2(.72,.51)*cos(dot(p,vec2(.72,.51))-t*2.85);}`;
export class HarborWorld {
 constructor(parent,course){
  this.course=course;this.root=new THREE.Group();this.root.name='QuarantineHarbor';this.root.userData.afterlifeSkip=true;parent.add(this.root);
  this.disposed=false;this.diagnostics={loaded:[],errors:[],water:'three shared displaced analytic waves; sky reflection; deep-water body color approximation'};
  this.materials={asphalt:new THREE.MeshStandardMaterial({color:0x343b3c,roughness:.97}),concrete:new THREE.MeshStandardMaterial({color:0x85877c,roughness:.94}),rust:new THREE.MeshStandardMaterial({color:0x745642,roughness:.82,metalness:.32}),stripe:new THREE.MeshStandardMaterial({color:0xcbbb87,roughness:.85}),dark:new THREE.MeshStandardMaterial({color:0x697471,roughness:.82}),signal:new THREE.MeshStandardMaterial({color:0xdb9d47,emissive:0x9c5019,emissiveIntensity:.2})};
  harborSurface(this.materials.asphalt,'asphalt');harborSurface(this.materials.concrete,'concrete');harborSurface(this.materials.dark,'metal');
  this.unitBox=new THREE.BoxGeometry(1,1,1);
  if(course.coastal)buildCoastalScenery(this);
  else this.box(64,-.17,60,128,.3,120,'asphalt','HarborGround');
  if(course.coastal?.blackwaterSlice)this.blackwater=buildBlackwaterDistrict(this.root,course.coastal.blackwaterSlice);
  if(this.blackwater)this.diagnostics.blackwater=this.blackwater.diagnostics;
  if(this.blackwater){
   const legacySky=this.root.getObjectByName('CoastalSky');if(legacySky)legacySky.visible=false;
   this.graphicSky=createBlackwaterGraphicSky();this.root.add(this.graphicSky.root);
  }
  // Raised pavement is physically separated from the road, never coplanar.
  for(const b of course.buildings)this.box((b.x+b.w/2)*4,-.005,(b.y+b.h/2)*4,(b.w+1)*4,.24,(b.h+1)*4,'concrete','BlockPavement');
  this.box(64,.005,114,128,.25,12,'concrete','SeafrontPromenade');
  this.box(64,-1,120,128,2,.55,'rust','Seawall');
  // Readable paired road axes, broken paint, crossed freight loading bays.
  for(let x=3;x<126;x+=7)this.box(x,.018,56,3,.02,.14,'stripe','RoadDash');
  for(const x of [44,84])for(let z=3;z<110;z+=7)this.box(x,.018,z,.14,.02,3,'stripe','RoadDash');
  for(let x=5;x<125;x+=8)harborMooring(this,x,119.3);
  if(!course.coastal){for(const x of [0,128]){this.box(x,.7,60,.28,1.4,120,'concrete','BoundaryWall');}this.box(64,.7,0,128,1.4,.28,'concrete','BoundaryWall');}
  const graphic=this.blackwater?BLACKWATER_LOOKS.cartoon:null;
  const hemi=new THREE.HemisphereLight(graphic?.fillSky||0xc5dee3,graphic?.ground||0x4a493d,graphic?.fill||2.1);hemi.name='HarborSkyFill';this.root.add(hemi);
  if(this.blackwater){
   // Explicit TSL sunlight keeps authored value groups independent of the
   // viewmodel keys. Its local shadow region follows coastal exploration.
   const sun=new THREE.DirectionalLight(graphic.sunColor,graphic.sun);sun.name='BlackwaterGraphicSun';sun.position.set(155,52,15);sun.target.position.set(185,0,56);sun.layers.set(2);sun.castShadow=true;
   sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-60,right:60,top:60,bottom:-60,near:1,far:180});sun.shadow.bias=-.00015;sun.shadow.normalBias=.035;sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;
   this.blackwaterSun=sun;this.root.add(sun,sun.target);this.blackwaterShadowCoverage=createHarborShadowCoverage(sun);
   const practicals=[];this.blackwater.root.traverse(o=>{if(o.isLight){o.layers.set(2);practicals.push(o);}});
   this.blackwaterGraphic=applyBlackwaterGraphicStyle(this.blackwater.root,{lightSources:[sun,hemi,...practicals]});
   this.diagnostics.blackwater.artDirection={...this.blackwaterGraphic.diagnostics,shadowMap:2048,shadowFootprint:'120m local region follows exploration;cached between recentering'};
  }
  this.shoreline?.setLighting([this.blackwaterSun,hemi].filter(Boolean));
  if(course.coastal?.forestPlacements){
   const sun=new THREE.DirectionalLight(graphic?.sunColor||0xffdbad,graphic?.sun||2);sun.name='CapeForestSun';sun.layers.set(2);sun.position.set(310,80,302);sun.target.position.set(340,0,350);sun.castShadow=true;
   sun.shadow.mapSize.set(1536,1536);Object.assign(sun.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:1,far:180});sun.shadow.bias=-.00018;sun.shadow.normalBias=.045;sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;
   this.forestSun=sun;this.root.add(sun,sun.target);this.forestShadowCoverage=createHarborShadowCoverage(sun);
   this.forest=createForestVegetation({placements:course.coastal.forestPlacements,lightSources:[sun,hemi],palette:{bark:'#706b5d',deciduous:'#6d896b',conifer:'#41695e'},lodDistances:[0,28,65],cullDistance:900,shadowDistance:35});this.root.add(this.forest.root);this.terrain?.setLighting([sun,hemi]);
  }
  if(course.coastal?.understoryPlacements){this.understory=createCoastalUnderstory({placements:course.coastal.understoryPlacements,lightSources:[this.forestSun||this.blackwaterSun,hemi]});this.root.add(this.understory.root);this.diagnostics.understory=this.understory.diagnostics;}
  this.maritime=buildCoastalMaritime(this,{lightSources:[this.blackwaterSun||this.forestSun,hemi].filter(Boolean)});
  this.water=course.coastal?makeCoastalWater(THREE,course.water):this.makeWater(course.water);this.root.add(this.water);
  if(course.coastal)this.diagnostics.water=this.water.userData.waterDiagnostics;
  // Working-harbor scale cues live beyond the collision shore.
  for(let i=0;i<7;i++){
   const x=12+i*17,z=157+(i%3)*13;
   harborMooring(this,x,z,true);
  }
  // Low far-bank silhouettes stop the water reading as an unbounded blue floor.
  if(!course.coastal)for(let i=0;i<9;i++)this.box(-28+i*24,3+(i%3)*2,262+(i%2)*16,25,8+(i%3)*4,18,'dark','FarBankWarehouse');
  this.vehicle=new THREE.Group();this.vehicle.name='DockTruck';this.vehicle.userData.noBatch=true;this.root.add(this.vehicle);
  this.vehicle.position.set(course.vehicle.x*4,0,course.vehicle.y*4);this.vehicle.rotation.y=-course.vehicle.angle;
  const contact=new THREE.Mesh(new THREE.CircleGeometry(1,24),new THREE.MeshBasicMaterial({color:0x111919,transparent:true,opacity:.28,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));contact.name='TruckContact';contact.rotation.x=-Math.PI/2;contact.scale.set(2.6,1.2,1);contact.position.y=.04;this.vehicle.add(contact);
  const pending=[];
  if(this.forest)pending.push(this.forest.ready.then(()=>{this.diagnostics.forest=this.forest.diagnostics();}));
  this.thaiWorld=new HarborThaiVisuals(this.root,course.thaiLayout);
  pending.push(this.thaiWorld.ready.then(d=>{this.diagnostics.thai=d;this.diagnostics.loaded.push(...d.loaded);this.diagnostics.errors.push(...d.errors);if(!d.errors.length){buildCoastalFrontages(this);finishHarborDetail(this);this.interiors=new HarborInteriorVisuals(this);if(course.lowTide)this.lowTideVisuals=new LowTideVisuals(this);}}));
  for(const b of course.buildings){
   if(b.passage){this.buildPowerCut(b);continue;}
   if(b.yard){this.buildServiceYard(b);continue;}
   for(const z of [b.y*4,(b.y+b.h)*4])this.box((b.x+b.w/2)*4,.6,z,b.w*4,1.2,.25,'concrete','BuildingBoundary');
   for(const x of [b.x*4,(b.x+b.w)*4])this.box(x,.6,(b.y+b.h/2)*4,.25,1.2,b.h*4,'concrete','BuildingBoundary');
   this.sign(b.name,(b.x+b.w/2)*4,3.3,(b.y+b.h)*4+.3,0);
  }
  this.sign('QUARANTINE HARBOR',64,5,1,0,12);
  this.sign('FERRY / EXTRACTION  →',109,2.8,117,0,9);
  this.sign('SALVAGE / DOCK ROAD',84,4.6,71,Math.PI,8);
  this.sign('← NETMAKERS     FERRY →',84,4.6,71,0,12);
  this.sign('DOCK ROAD / WEST SERVICE',36,2.6,40.2,0,10);
  this.sign('POWER LANE / FERRY →',84,4.6,96.2,0,10);
  // Crosswalk paint lives just above asphalt, clear of the centre stripe.
  for(const x of [44,84])for(const z of [49,51,53,59,61,63])this.box(x,.037,z,2.6,.014,.85,'stripe','DockRoadCrosswalk');
  // Mark the actual extraction area at the quay, with an open front edge.
  const ex=course.exit.x*4,ez=course.exit.y*4;
  for(const side of [-1,1])this.box(ex+side*2,.15,ez,.16,.015,4,'signal','FerryExtractionPaint');
  this.box(ex,.15,ez+2,4,.015,.16,'signal','FerryExtractionPaint');
  this.sign('FERRY / EVACUATION POINT',ex,3,ez+2.4,0,8);
  this.ready=Promise.all(pending).then(()=>{if(this.blackwaterSun){this.staticDetails=instanceHarborStaticDetails(this.root,{eligible:o=>isStaticHarborDetail(o,this)});this.diagnostics.staticDetails=this.staticDetails.diagnostics;this.coastalGraphic=applyBlackwaterCoastalSurfaces(this.root,this.materials,{lightSources:[this.forestSun||this.blackwaterSun,hemi]});this.diagnostics.coastalArtDirection=this.coastalGraphic.diagnostics;this.blackwaterSun.shadow.needsUpdate=true;}return this.diagnostics;});
 }
 box(x,y,z,w,h,d,material,name){const m=new THREE.Mesh(this.unitBox,this.materials[material]);m.name=name;m.position.set(x,y,z);m.scale.set(w,h,d);m.receiveShadow=true;this.root.add(m);return m;}
 buildPowerCut(b){
  const p=b.passage,x=p.x*4,z=p.y*4,w=p.w*4,d=p.h*4;
  // Store wings and the clear through-passage use the same two-cell bands as
  // collision. Tall inner walls establish an enclosed service-lane silhouette.
  for(const side of [-1,1]){
   const edge=side<0?x:x+w,outer=side<0?b.x*4:(b.x+b.w)*4;
   this.box(edge,1.8,z+d/2,.24,3.6,d,'dark','PowerCutWingWall');
   this.box(outer,.6,z+d/2,.24,1.2,d,'concrete','PowerCutOuterBoundary');
   for(const end of [z,z+d])this.box((edge+outer)/2,.6,end,8,1.2,.24,'concrete','PowerCutWingEnd');
   for(const station of [z+.2,z+8,z+16,z+d-.2]){
    this.box(edge,2.5,station,.4,5,.4,'rust','PowerCutFramePost');
    this.box(edge,3.9,station,.45,.14,.55,'signal','PowerCutGuideLamp');
   }
  }
  for(const end of [z+.2,z+d-.2])this.box(x+w/2,5,end,w,.3,.4,'rust','PowerCutFrameBeam');
  this.box(x+w/2,5.2,z+2.2,w,.18,4,'dark','PowerCutEntryCanopy');
  for(let i=0;i<8;i++)this.box(x+w/2,.135,z+1+i*2.8,.15,.012,1.25,'stripe','PowerCutRoutePaint');
  this.sign('POWER CUT / WATERFRONT',x+w/2,4.4,z-.24,Math.PI,7.5);
  this.sign('POWER CUT / DOCK ROAD',x+w/2,4.4,z+d+.24,0,7.5);
 }
 buildServiceYard(b){
  const q=b.yard,x=q.x*4,z=q.y*4,w=q.w*4,d=q.h*4,gate=q.gateX*4,opening=q.gateWidth*4;
  // Rear store occupies the same two blocked rows as the authority. Its
  // backing wall closes the gap under the smaller imported roof silhouette.
  this.box(x+w/2,1.65,z,w,3.3,.24,'dark','NetmakersRearWall');
  this.box(x+w/2,.6,b.y*4,w,1.2,.24,'concrete','NetmakersStoreBoundary');
  for(const edge of [x,x+w])this.box(edge,.6,b.y*4+4,.24,1.2,8,'concrete','NetmakersStoreBoundary');
  for(const edge of [x,x+w])this.box(edge,1,z+d/2,.24,2,d,'rust','NetmakersYardWall');
  const left=gate-x,right=x+w-gate-opening;
  this.box(x+left/2,1,z+d,left,2,.24,'rust','NetmakersGateLeft');
  this.box(gate+opening+right/2,1,z+d,right,2,.24,'rust','NetmakersGateRight');
  for(const edge of [gate,gate+opening]){
   this.box(edge,1.7,z+d,.35,3.4,.35,'dark','NetmakersGatePost');
   this.box(edge,3.25,z+d,.48,.15,.48,'signal','NetmakersGateLamp');
  }
  this.sign('NETMAKERS / SALVAGE YARD',gate+opening/2,3.8,z+d+.2,0,10);
  this.sign('TOOLS + FIELD EQUIPMENT',x+w/2,2.7,z+.16,0,10);
  // Nonblocking paint makes the entrance readable without new collision props.
  for(let i=0;i<5;i++)this.box(gate+opening/2,.13,z+d-1-i*2.6,.16,.012,1.3,'stripe','YardAccessStripe');
 }
 fit(model,w,h,d){
  model.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(model),s=b.getSize(new THREE.Vector3());
  const scale=Math.min(w/s.x,h/s.y,d/s.z);model.scale.multiplyScalar(scale);model.updateMatrixWorld(true);
  const out=new THREE.Box3().setFromObject(model),c=out.getCenter(new THREE.Vector3());model.position.sub(new THREE.Vector3(c.x,out.min.y,c.z));
 }
 sign(text,x,y,z,angle,width=9){
  if(typeof document==='undefined')return;
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#1b3539';ctx.fillRect(0,0,1024,128);ctx.fillStyle='#dec994';ctx.fillRect(0,0,12,128);ctx.font='bold 53px sans-serif';ctx.textAlign='center';ctx.fillText(text,512,83);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  if(text.startsWith('NETMAKERS'))this.box(x,y-.34,z-.15,8,.16,.15,'rust','GateSignCrossbar');
  width=Math.min(width,6);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width/8),new THREE.MeshStandardMaterial({map,roughness:.88,side:THREE.FrontSide}));mesh.position.set(x,y,z);mesh.rotation.y=angle;mesh.name=text;this.root.add(mesh);
  if(!text.startsWith('POWER CUT')&&!text.startsWith('NETMAKERS')){
   for(const side of [-1,1]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,y+.22,8),this.materials.rust);post.position.set(x+Math.cos(angle)*side*(width/2-.22),y/2,z-Math.sin(angle)*side*(width/2-.22)-.08);post.name='SignMount';this.root.add(post);}
  }
  return mesh;
 }
 makeWater(b){
  const geometry=new THREE.PlaneGeometry(b.maxX-b.minX,b.maxZ-b.minZ,128,96);geometry.rotateX(-Math.PI/2);geometry.translate((b.minX+b.maxX)/2,b.level,(b.minZ+b.maxZ)/2);
  const material=new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:`uniform float time;varying vec3 vWorld;${waveSource}void main(){vec3 p=position;p.y+=sea(p.xz,time);vWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,
   fragmentShader:`uniform float time;varying vec3 vWorld;${waveSource}void main(){vec2 g=slope(vWorld.xz,time);vec3 n=normalize(vec3(-g.x,1.,-g.y));vec3 v=normalize(cameraPosition-vWorld);float f=.02+.98*pow(1.-max(dot(n,v),0.),5.);vec3 r=reflect(-v,n);vec3 sky=mix(vec3(.025,.095,.105),vec3(.10,.22,.24),clamp(r.y*.7+.35,0.,1.));vec3 body=vec3(.009,.068,.072);float sun=pow(max(dot(r,normalize(vec3(-.5,.4,-.6))),0.),100.);vec3 color=mix(body,sky,min(f,.78))+sun*.065;float crest=smoothstep(.22,.31,sea(vWorld.xz,time))*.055;color=mix(color,vec3(.20,.32,.30),crest);float haze=1.-exp(-length(cameraPosition-vWorld)*.003);color=mix(color,vec3(.09,.18,.19),haze*.4);gl_FragColor=vec4(color,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`.replace(';#include',';\n#include')});
  const mesh=new THREE.Mesh(geometry,material);mesh.name='HarborDisplacedWater';mesh.frustumCulled=false;mesh.userData.noBatch=true;return mesh;
 }
 update(time,vehicle,run,camera){
  this.interiors?.update(run);this.lowTideVisuals?.update(run);
  if(this.graphicSky&&run)this.graphicSky.root.position.set(run.x*4,0,run.y*4);
  let x=run?.x*4||0,z=run?.y*4||0,wide=false;
  if(camera){
   this._shadowEye??=new THREE.Vector3();this._shadowDirection??=new THREE.Vector3();
   camera.getWorldPosition(this._shadowEye);camera.getWorldDirection(this._shadowDirection);
   wide=this._shadowEye.y>35;
   if(wide&&this._shadowDirection.y<-.1){
    const distance=-this._shadowEye.y/this._shadowDirection.y;
    x=THREE.MathUtils.clamp(this._shadowEye.x+this._shadowDirection.x*distance,0,448);
    z=THREE.MathUtils.clamp(this._shadowEye.z+this._shadowDirection.z*distance,0,416);
   }
  }
  this.blackwaterShadowCoverage?.update(x,0,z,wide?640:120);
  this.water.material.uniforms.time.value=Number.isFinite(time)?time:0;
  this.terrain?.update(time,camera);if(camera)this.understory?.update(camera,time);
  this.utilityPickup?.update(vehicle);
  if(camera&&this.forest){
   this.forest.update(camera,time);this.forestShadowCoverage?.update(x,0,z,wide?640:96);
   if(this._forestWide!==wide){this._forestWide=wide;this.forestSun.shadow.needsUpdate=true;}
  }
  if(vehicle){this.vehicle.position.set(vehicle.x*4,0,vehicle.y*4);this.vehicle.rotation.y=-vehicle.angle;}
 }
 release(root){const seen=new Set();root.traverse(o=>{if(o.geometry&&!seen.has(o.geometry)){seen.add(o.geometry);o.geometry.dispose();}for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){if(seen.has(m))continue;seen.add(m);for(const value of Object.values(m))if(value?.isTexture&&!seen.has(value)){seen.add(value);value.dispose();}m.dispose();}});}
 dispose(){if(this.disposed)return;this.disposed=true;this.maritime?.dispose();this.shoreline?.dispose();this.coastalGraphic?.dispose();this.staticDetails?.dispose();this.utilityPickup?.dispose();this.understory?.dispose();this.forest?.dispose();this.terrain?.dispose();this.forestSun?.dispose();this.blackwaterGraphic?.dispose();this.blackwaterSun?.dispose();this.graphicSky?.dispose();this.blackwater?.dispose();this.thaiWorld?.dispose();}
}
