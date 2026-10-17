import {createSurvivorNPCs} from './survivor-npcs.js';
import * as T from '../vendor/three.module.js';
import {mergeGeometries} from '../vendor/utils/BufferGeometryUtils.js';
import {loadGlb} from '../assets/load-glb.js';
import {createMeshySurvivor} from '../assets/survivor/meshy-survivor.js';
import {PLACES,CONTACT,trailDistance} from './places.js';
import {terrainHeight} from './data.js';
import {consoleMaterial,stylizeModel} from './retro-materials.js';
import {dressSurvivor,radioPerformance} from './character-craft.js';

export function heritagePlan(){
 const items=[],add=(name,x,z,size,angle=0)=>items.push({name,x,z,size,angle});
 const p=PLACES[0];
 for(const side of [-1,1])for(let row=0;row<4;row++)for(let col=0;col<3;col++){const x=p.x+side*(6+col*4),z=p.z-12+row*7;if(trailDistance(x,z)<2.2)continue;add(['gravestone-round','gravestone-bevel','gravestone-cross','gravestone-broken'][(row+col)%4],x,z,1.4+(col%2)*.3,.04*(row-1));add('grave-border',x,z+1.5,2.4);}
 for(let j=-4;j<=4;j++)for(const side of [-1,1]){const x=p.x+j*4.2,z=p.z+side*22;if(trailDistance(x,z)>3)add(j%3?'stone-wall':'stone-wall-damaged',x,z,4.1);}
 for(const side of [-1,1]){add('bench-damaged',p.x+side*10,p.z+15,3.4);add('urn-round',p.x+side*3,p.z-8,.7);}
 add('cross-column',p.x,p.z-18,4.2);add('candle-multiple',p.x-2,p.z-7,.5);
 for(const index of [1,3]){const a=PLACES[index];for(const side of [-1,1]){add('bench',a.x+side*6,a.z+5,3.8,side<0?Math.PI/2:-Math.PI/2);add('lantern-candle',a.x+side*3,a.z-4,1.2);}if(index===3){add('pillar-obelisk',a.x,a.z-10,5);for(const side of [-1,1])add('urn-round',a.x+side*4,a.z-10,1.3);}}
 const q=PLACES[2];for(let j=0;j<8;j++){const x=q.x+Math.sin(j)*17,z=q.z+Math.cos(j)*17,size=2+j%3;if(trailDistance(x,z)>size*.5+1)add(j%2?'rocks':'debris',x,z,size,j);}add('trunk',q.x+7,q.z-6,5,.4);
 const m=PLACES[4];for(const side of [-1,1])for(let j=0;j<3;j++)add('iron-fence'+(j===1?'-damaged':''),m.x+side*16,m.z-7+j*6,5.7,Math.PI/2);
 return items;
}
export async function loadExploration(scene,data,source=loadGlb(new URL('../assets/survivor/tld-survivor-v02.glb',import.meta.url).href)){
 const items=heritagePlan(),assets=new Map(),tiles=new Map(),colliders=[],dummy=new T.Object3D(),noteVisuals=[];let material;
 await Promise.all([...new Set(items.map(p=>p.name))].map(async name=>{const gltf=await loadGlb(new URL(`../assets/cc0-graveyard/${name}.glb`,import.meta.url).href),pieces=[];gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if(!o.isMesh)return;const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);for(const key of Object.keys(geometry.attributes))if(!['position','normal','uv'].includes(key))geometry.deleteAttribute(key);pieces.push(geometry.index?geometry.toNonIndexed():geometry);if(!material)material=consoleMaterial(new T.MeshLambertMaterial({map:o.material.map,color:0xc4c5aa,flatShading:true}));});const geometry=mergeGeometries(pieces);for(const g of pieces)g.dispose();geometry.computeBoundingBox();assets.set(name,geometry);}));
 for(const p of items){const geometry=assets.get(p.name),bounds=geometry.boundingBox,size=bounds.getSize(new T.Vector3()),centre=bounds.getCenter(new T.Vector3()),scale=p.size/Math.max(size.x,size.y,size.z);dummy.rotation.set(0,p.angle,0);dummy.scale.setScalar(scale);dummy.position.set(-centre.x*scale,-bounds.min.y*scale,-centre.z*scale).applyQuaternion(dummy.quaternion).add(new T.Vector3(p.x,terrainHeight(p.x,p.z)-.05,p.z));dummy.updateMatrix();const g=geometry.clone().applyMatrix4(dummy.matrix),key=Math.floor(p.x/96)+','+Math.floor(p.z/96);if(!tiles.has(key))tiles.set(key,[]);tiles.get(key).push(g);
  if(!['grave-border','debris','candle-multiple','lantern-candle'].includes(p.name)){const box=bounds.clone().applyMatrix4(dummy.matrix),c=box.getCenter(new T.Vector3()),s=box.getSize(new T.Vector3());colliders.push({id:'heritage-'+p.name,x:c.x,z:c.z,w:s.x*.8,d:s.z*.8,y:box.min.y,h:s.y});}
 }
 const assetCount=assets.size,meshes=[];for(const [key,pieces]of tiles){const geometry=mergeGeometries(pieces);geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,material);mesh.name='Heritage '+key;mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);meshes.push(mesh);for(const g of pieces)g.dispose();}for(const g of assets.values())g.dispose();assets.clear();tiles.clear();
 const wood=new T.MeshLambertMaterial({color:0x6e6247}),paper=new T.MeshLambertMaterial({color:0xd8c795});for(const p of PLACES){const group=new T.Group();group.name=p.name+' field record';const desk=new T.Mesh(new T.BoxGeometry(1.2,.1,.8),wood);desk.position.y=.9;group.add(desk);const post=new T.Mesh(new T.BoxGeometry(.16,.9,.16),wood);post.position.y=.45;group.add(post);const book=new T.Mesh(new T.BoxGeometry(.45,.045,.32),paper);book.position.y=.98;book.rotation.y=.12;group.add(book);group.position.set(p.x,terrainHeight(p.x,p.z),p.z);scene.add(group);noteVisuals.push({id:p.id,group,book});}
 const gltf=await source,operator=createMeshySurvivor(gltf.scene,gltf.animations);stylizeModel(operator);const clothing=dressSurvivor(operator,{operator:true}),performance=radioPerformance(operator,clothing.unit),box=new T.Box3().setFromObject(operator),scale=1.78/(box.max.y-box.min.y);operator.scale.setScalar(scale);operator.position.set(CONTACT.x,terrainHeight(CONTACT.x,CONTACT.z)-box.min.y*scale,CONTACT.z);operator.rotation.y=.3;operator.name='Elias, the radio operator';scene.add(operator);
 colliders.push({id:'radio-operator',x:CONTACT.x,z:CONTACT.z,w:.65,d:.65,y:terrainHeight(CONTACT.x,CONTACT.z),h:1.78});
 const survivors=createSurvivorNPCs(scene,gltf,data);colliders.push(...survivors.colliders);
 const lampMaterial=new T.MeshBasicMaterial({color:0x667962}),lamp=new T.Mesh(new T.OctahedronGeometry(.25,0),lampMaterial);lamp.position.set(CONTACT.x+2.3,terrainHeight(CONTACT.x,CONTACT.z)+3,CONTACT.z);scene.add(lamp);
 return {items,colliders,survivors,operator,performance,lamp,noteVisuals,stats:{assets:assetCount,props:items.length,batches:meshes.length},update(dt,state,camera){survivors.update(dt,state,camera);for(const m of meshes){const b=m.geometry.boundingSphere;m.visible=camera.distanceToSquared(b.center)<(420+b.radius)**2;}operator.visible=camera.distanceToSquared(operator.position)<160**2;if(operator.visible){performance.restore();operator.userData.mixer.update(dt);operator.updateMatrixWorld(true);const s=operator.userData;s.body.skeleton.update();let floor=Infinity;for(const index of s.soleSamples){s.body.getVertexPosition(index,s.point);s.point.applyMatrix4(s.body.matrixWorld);floor=Math.min(floor,s.point.y);}if(Number.isFinite(floor))operator.position.y+=terrainHeight(CONTACT.x,CONTACT.z)-floor;const near=Math.hypot(state.x-CONTACT.x,state.z-CONTACT.z)<7;if(near){const yaw=Math.atan2(state.x-CONTACT.x,state.z-CONTACT.z)+Math.PI,turn=Math.atan2(Math.sin(yaw-operator.rotation.y),Math.cos(yaw-operator.rotation.y));operator.rotation.y+=turn*(1-Math.exp(-3*dt));}performance.update(dt,near);}lampMaterial.color.setHex(state.relays.length?0xffd18a:0x667962);for(const n of noteVisuals)n.book.material=state.records.includes(n.id)?wood:paper;}};
}
