import {freezeLocalTransforms} from './render-lifecycle.js';
import {reservedPlace} from './places.js';
import {settlementReserved} from './settlement-plan.js';
import {accessReserved} from './access-plan.js';
import * as T from '../vendor/three.module.js';
import {mergeGeometries} from '../vendor/utils/BufferGeometryUtils.js';
import {loadGlb} from '../assets/load-glb.js';
import {random,terrainHeight,roadAt,LANDMARKS,SPAWN} from './data.js';
import {consoleMaterial} from './retro-materials.js';

export const SCENERY_ASSETS=['barrel','box','box-large','bucket','campfire-pit','chest','fence','fence-fortified','bedroll','bedroll-packed','bottle','resource-wood','resource-planks','resource-stone','tent','tent-canvas','tool-axe','tool-shovel','workbench','workbench-anvil','workbench-grind','tree-log','tree-log-small','grass','grass-large','patch-grass','rock-flat','signpost'];
const solid=new Set(['barrel','box-large','chest','tent','tent-canvas','workbench','workbench-anvil','workbench-grind','resource-wood','tree-log']);
export function sceneryPlan(data){
  const rng=random(data.seed+1801),items=[];
  const free=(x,z,r=1)=>{const road=roadAt(x,z);if(reservedPlace(x,z,r)||settlementReserved(x,z,r)||accessReserved(data.accessPaths||[],x,z,r+.6))return false;if(terrainHeight(x,z)<3)return false;if(x<355&&road.distance<road.width/2+r+1)return false;
    if(x>=355){const dx=Math.abs((x-392+38)%76-38),dz=Math.abs(((z+456)%76+76)%76-38);if(dx<8+r||Math.min(dz,Math.abs(dz-76))>30-r)return false;}
    if(Math.hypot(x-SPAWN.x,z-SPAWN.z)<10||LANDMARKS.some(p=>Math.hypot(x-p.x,z-p.z)<7))return false;
    if(data.supplies.some(p=>Math.hypot(x-p.x,z-p.z)<2+r)||data.enemies.some(p=>Math.hypot(x-p.x,z-p.z)<3+r))return false;
    return data.buildings.every(b=>!(Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r)&&!(b.enterable&&Math.abs(x-b.x)<2.7+r&&z>b.entry.z-1&&z<b.entry.z+b.entry.length+2));};
  const add=(name,x,z,size=1,angle=0,force=false)=>{if(force||free(x,z,size*.35))items.push({name,x,z,size,angle,y:terrainHeight(x,z)});};
  // Work yards follow the building footprint and keep the complete front route open.
  for(const b of data.buildings){const village=b.district==='village',side=b.seed%2?1:-1,x=b.x+side*(b.w/2+2.4);
    const kit=village?['workbench','resource-wood','bucket','tree-log-small','barrel','tool-axe','box','bedroll-packed']:b.district==='industrial'?['resource-planks','box-large','barrel','workbench-anvil','resource-stone','box','workbench-grind']:['box','barrel','bucket','box-large','chest','bottle'];
    for(let j=0;j<(village?12:8);j++){const z=b.z-b.d*.42+(j%6)*b.d*.15,xx=x+(j>=6?side*1.8:0),name=kit[j%kit.length];add(name,xx,z,name.startsWith('workbench')?2.0:name.includes('log')?2.3:name==='bottle'?.35:name==='box-large'?1.35:1.05,(rng()-.5)*.45);}
    if(village){for(let j=0;j<6;j++){const xx=b.x-b.w/2+j*b.w/5,z=b.z-b.d/2-3;add('fence',xx,z,2.4,Math.PI/2);add('grass-large',xx,z+1.4,1.1,rng()*6.28);}add('signpost',b.x-3,b.entry.z+3,1.7,.1);}
  }
  // Reuse the bundled tool and provision meshes inside the authored rooms.
  const roomProps={lightkeeper:[['workbench-grind',-4,0,1.6,0],['tool-axe',3,0,.7,.96],['bucket',-5,-3,.65,0],['bottle',-3,-3,.35,.96]],clinic:[['bottle',-.4,-6,.28,.98],['bottle',.4,-6,.28,.98],['box',2,-6,.6,0]],'arrival-house':[['chest',-5,2,1.2,0],['bottle',-3,-3,.28,.98],['bedroll-packed',-4,2,1,0]]};
  for(const b of data.buildings){for(const [name,dx,dz,size,up] of roomProps[b.id]||[])items.push({name,x:b.x+dx,z:b.z+dz,y:b.baseY+.2+up,size,angle:.15});}
  // Each camp has sleeping, storage and a work area, composed around open fire access.
  for(const [cx,cz] of [[-773,290],[-718,99],[-850,-217],[-370,-228],[727,35],[1000,-280]]){
    for(const [name,dx,dz,size,angle] of [['tent',-5,0,4.4,.3],['tent-canvas',5,-3,3.8,-.5],['bedroll',-5,3,2,0],['bedroll',4,1,2,.2],['campfire-pit',0,3,1.6,0],['box-large',7,3,1.3,0],['barrel',-8,3,1.1,0],['workbench',0,-5,2,0],['tool-shovel',1.8,-5,1.5,.7],['chest',-3,-4,1.3,0]])add(name,cx+dx,cz+dz,size,angle);
  }
  // Understorey grows in clusters around existing trees rather than across paths.
  for(let i=0;i<data.trees.length;i+=2){const t=data.trees[i];for(let j=0;j<3;j++){const a=rng()*6.28,r=2+rng()*4;add(j===2&&i%8===0?'rock-flat':j%2?'grass-large':'patch-grass',t.x+Math.sin(a)*r,t.z+Math.cos(a)*r,1.0+rng()*1.5,a);}if(i%20===0)add('tree-log',t.x+3,t.z+2,3.2,t.rotation);}
  return items;
}

export async function loadScenery(scene,data){
  const items=sceneryPlan(data),assets=new Map(),tiles=new Map(),colliders=[],matrix=new T.Matrix4(),q=new T.Quaternion(),pos=new T.Vector3(),scale=new T.Vector3();let material;
  await Promise.all(SCENERY_ASSETS.map(async name=>{const gltf=await loadGlb(new URL(`../assets/cc0-survival/${name}.glb`,import.meta.url).href);gltf.scene.updateMatrixWorld(true);const pieces=[];gltf.scene.traverse(o=>{if(o.isMesh){const g=o.geometry.clone().applyMatrix4(o.matrixWorld);for(const key of Object.keys(g.attributes))if(!['position','normal','uv'].includes(key))g.deleteAttribute(key);pieces.push(g.index?g.toNonIndexed():g);if(!material)material=consoleMaterial(new T.MeshLambertMaterial({map:o.material.map,color:0xd5d3b7,flatShading:true}));}});const geometry=mergeGeometries(pieces);geometry.computeBoundingBox();assets.set(name,{geometry,bounds:geometry.boundingBox.clone()});}));
  for(const p of items){const a=assets.get(p.name),dimensions=a.bounds.getSize(new T.Vector3()),s=p.size/Math.max(dimensions.x,dimensions.y,dimensions.z),centre=a.bounds.getCenter(new T.Vector3());
    q.setFromAxisAngle(new T.Vector3(0,1,0),p.angle);pos.set(-centre.x*s,-a.bounds.min.y*s,-centre.z*s).applyQuaternion(q).add(new T.Vector3(p.x,p.y,p.z));matrix.compose(pos,q,scale.setScalar(s));
    // Coarser render batches reduce CPU draw submission. Every authored prop
    // and its individual collider remain; solid/detail ranges stay separate.
    const tile=`${Math.floor(p.x/192)},${Math.floor(p.z/192)}:${solid.has(p.name)?'solid':'detail'}`;if(!tiles.has(tile))tiles.set(tile,[]);tiles.get(tile).push(a.geometry.clone().applyMatrix4(matrix));
    if(solid.has(p.name)){const box=a.bounds.clone().applyMatrix4(matrix),size=box.getSize(new T.Vector3()),centre=box.getCenter(new T.Vector3());colliders.push({x:centre.x,z:centre.z,w:size.x*.86,d:size.z*.86,y:box.min.y,h:size.y,id:'scenery-'+p.name});}
  }
  const meshes=[];for(const [key,geometries] of tiles){const geometry=mergeGeometries(geometries);geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,material);mesh.name='Survival scenery '+key;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.distance=key.endsWith('detail')?230:600;scene.add(mesh);freezeLocalTransforms(mesh);meshes.push(mesh);for(const g of geometries)g.dispose();}
  for(const a of assets.values())a.geometry.dispose();assets.clear();tiles.clear();
  return {items,colliders,stats:{assets:SCENERY_ASSETS.length,props:items.length,batches:meshes.length},update(camera){for(const m of meshes){const b=m.geometry.boundingSphere;m.visible=camera.distanceToSquared(b.center)<(m.userData.distance+b.radius)**2;}}};
}
