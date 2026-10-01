import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {buildSetDressing} from '../world-setdressing.js';
import {batchStaticWorld} from '../world-polish.js';
import {finalizeStaticWorld} from '../world-static.js';
import {HorrorPresence} from '../horror-presence.js';
import {RoomAtmosphereAudio,atmosphereSources,atmosphereOcclusion,ATMOSPHERE_LIMITS} from '../room-atmosphere-audio.js';
import {makeDungeonCourse,DUNGEON_LAYERS} from '../playground/map/dungeon-course.js';

function fixture(){
 const course={id:'ward',w:15,h:15,cells:Array.from({length:225},()=>[0,0,0,0]),enemies:[],rooms:[{id:'ward',bounds:{minX:1,maxX:13,minZ:1,maxZ:13},flow:{role:'entry'}}],
  openings:[{id:'air',kind:'vent',anchor:{x:5,y:5},roomId:'ward'}],landmarks:[],machinery:[]};
 const run={course,x:5,y:5,z:0,time:0,health:100,mode:'play',projectiles:[]},sources=new Map(),starts=[];
 const audio={startSpatialEmitter(id,cue,details){if(sources.size>=4&&!sources.has(id))return false;sources.set(id,{id,...details});starts.push({id,cue,...details});return true;},
  updateSpatialEmitter(id,details){if(!sources.has(id))return false;Object.assign(sources.get(id),details);return true;},stopSpatialEmitter(id){return sources.delete(id);},spatialDiagnostics:()=>({emitters:[...sources.values()]})};
 return {run,audio,sources,starts,director:new RoomAtmosphereAudio(audio)};
}

test('all Story floors have source-bound air and whisper anchors in metres',()=>{
 for(let floor=0;floor<DUNGEON_LAYERS.length;floor++){
  const course=makeDungeonCourse(floor),sources=atmosphereSources(course);
  assert(sources.some(s=>s.family==='wind'));assert(sources.some(s=>s.family==='whisper'));
  assert(!sources.some(s=>s.family==='rustle'),'no rustle without a cloth mesh');
  assert(sources.length<=64);assert.equal(new Set(sources.map(s=>s.id)).size,sources.length);
  for(const s of sources)assert(Object.values(s.position).every(Number.isFinite));
  const vent=course.openings.find(o=>o.kind==='vent'),source=sources.find(s=>s.id===`atmosphere:${vent.id}:wind`);
  assert.deepEqual(source.position,{x:vent.anchor.x*4,y:2.4,z:vent.anchor.y*4});
 }
});

test('rustle belongs only to actual cloth meshes and uses their world transform',()=>{
 const {run}=fixture(),object=(kind,cloth)=>({userData:{setDressing:kind},children:[{name:cloth?'SetDressing_gurney_cloth':'SetDressing_coffin_wood'}],position:{clone:()=>({})},getWorldPosition:()=>({x:21,y:2,z:19})});
 const renderer={_course:run.course,horror:{setDressing:{children:[object('gurney',true),object('coffinStack',false)]}}};
 const sources=atmosphereSources(run.course,renderer),rustles=sources.filter(s=>s.family==='rustle');
 assert.equal(rustles.length,1);assert.deepEqual(rustles[0].position,{x:21,y:2.9,z:19});
 assert.equal(atmosphereSources(run.course,{...renderer,_course:{}}).filter(s=>s.family==='rustle').length,0);
});

test('actual rendered cloth centres survive material batching and empty-group pruning',()=>{
 const course=makeDungeonCourse(0),root=new THREE.Group();root.position.set(3,1,-4);root.rotation.y=.17;
 const dressing=buildSetDressing(root,{},course);root.updateWorldMatrix(true,true);
 const original=dressing.children.flatMap(prop=>prop.children.filter(mesh=>mesh.name.endsWith('_cloth')).map(mesh=>{
  mesh.geometry.computeBoundingBox();return mesh.localToWorld(mesh.geometry.boundingBox.getCenter(new THREE.Vector3()));
 }));
 assert(original.length>0,'the real Story recipe must have visible cloth');assert.equal(dressing.userData.audioAnchors.length,original.length);
 batchStaticWorld(root);finalizeStaticWorld(root);
 const sources=atmosphereSources(course,{_course:course,horror:{setDressing:dressing}}).filter(s=>s.family==='rustle');
 assert.equal(sources.length,original.length);
 for(const [i,source]of sources.entries())assert(new THREE.Vector3(source.position.x,source.position.y,source.position.z).distanceTo(original[i])<1e-6);
 const geometries=new Set(),materials=new Set();root.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const m of Array.isArray(node.material)?node.material:[node.material])if(m)materials.add(m);});
 for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
});

test('proximity beds are limited, reused and removed when the listener leaves',()=>{
 const f=fixture();for(let i=0;i<6;i++)f.run.course.machinery.push({id:'pump'+i,type:'pump-bank',anchor:[5+i*.1,5]});
 for(let n=0;n<60;n++){f.run.time=n*.1;f.director.update(f.run,{});}
 assert.equal(f.director.beds.size,ATMOSPHERE_LIMITS.beds);assert.equal(f.starts.length,2,'no per-frame loop stacking');
 assert.notEqual(f.starts[0].offset,f.starts[1].offset,'different anchors do not phase-lock the shared wind recording');
 assert(f.starts.every(s=>s.offset>=0&&s.offset<16));
 f.run.x=13;f.run.y=13;f.run.time=7;f.director.update(f.run,{});assert.equal(f.sources.size,0);
});

test('quiet whisper spacing reserves the horror budget without cancelling itself',()=>{
 const f=fixture(),presence={clock:0,legacyUntil:0,recovery:0,state:()=>({active:null}),claimLegacy(_run,_kind,seconds){this.legacyUntil=this.clock+seconds;return true;}};
 f.director.update(f.run,{}, {presence});assert.equal(f.starts.filter(s=>s.cue==='secret-whisper').length,0);
 f.run.time=f.director.nextWhisper+.01;presence.clock=f.run.time;f.director.update(f.run,{}, {presence});
 assert.equal(f.starts.filter(s=>s.cue==='secret-whisper').length,1);const id=f.director.short;assert(id);
 f.run.time+=.1;presence.clock+=.1;f.director.update(f.run,{}, {presence});assert.equal(f.director.short,id);
 f.sources.delete(id);f.run.time+=5;presence.clock=f.run.time;f.director.update(f.run,{}, {presence});
 assert.equal(f.starts.filter(s=>s.cue==='secret-whisper').length,1);assert(f.director.nextWhisper-f.run.time>30);
});

test('a learned callback retains priority when the real shared budget rejects a whisper',()=>{
 const f=fixture(),presence=new HorrorPresence();presence.bind(f.run);presence.memory.rhythm=[.35,.6];presence.cooldown=0;
 f.director.update(f.run,{}, {presence});f.run.time=f.director.nextWhisper+.1;presence.clock=f.run.time;
 assert.equal(presence.allowLegacy(f.run),false);f.director.update(f.run,{}, {presence});
 assert.equal(f.starts.filter(s=>s.cue==='secret-whisper').length,0);assert.equal(f.director.short,null);
});

test('combat, injury, major horror and recovery cancel details while reducing drafts',()=>{
 for(const mutate of [f=>f.run.bite={phase:'held'},f=>f.run.health=20,f=>f.run.course.rooms[0].flow.role='recovery',f=>f.run.course.enemies.push({x:5,y:5,dead:false})]){
  const f=fixture();f.director.update(f.run,{});assert(f.director.trigger('whisper',f.run));mutate(f);f.run.time=1;f.director.update(f.run,{});
  assert.equal(f.director.short,null);assert(![...f.sources.values()].some(s=>!s.loop));assert([...f.sources.values()].every(s=>s.volume<=.022));
 }
 const f=fixture();f.director.update(f.run,{});f.director.trigger('whisper',f.run);f.run.time=1;
 f.director.update(f.run,{}, {presence:{state:()=>({active:{kind:'witness'}})}});assert.equal(f.director.short,null);
});

test('pause, death, restart and floor change own no stale room voices',()=>{
 for(const stop of [f=>f.run.mode='pause',f=>f.run.health=0]){
  const f=fixture();f.director.update(f.run,{});f.director.trigger('whisper',f.run);stop(f);f.director.update(f.run,{});assert.equal(f.sources.size,0);
 }
 const f=fixture();f.director.update(f.run,{});const old=[...f.sources.keys()];f.run={...f.run,course:{...f.run.course,id:'new',openings:[],machinery:[],landmarks:[]}};f.director.update(f.run,{});
 assert.equal(f.sources.size,0);assert(old.every(id=>!f.director.beds.has(id)));
});

test('occlusion responds to a real intervening cell wall',()=>{
 const f=fixture(),p={x:9*4,y:2,z:5*4};assert.equal(atmosphereOcclusion(f.run,p),false);
 f.run.course.cells[5*15+7][1]=1;assert.equal(atmosphereOcclusion(f.run,p),true);
});
