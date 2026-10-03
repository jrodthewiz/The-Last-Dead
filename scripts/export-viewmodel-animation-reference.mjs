// Offline geometry reference for Blender; never used by the running game.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import * as T from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {Renderer} from '../renderer.js';
import {installForegroundArms,fitForegroundArms} from '../assets/survivor/foreground-arms.js';
import {WEAPON_HANDLING} from '../weapon-presentation.js';
globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
const raw=await readFile(new URL('../assets/survivor/viewmodel-arms-v1.glb',import.meta.url));
const asset=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
const r=Object.create(Renderer.prototype);r.materials={};r.camera=new T.PerspectiveCamera(110,16/9,.025,200);
r.weaponRig=new T.Group();r.camera.add(r.weaponRig);
r.weaponGroups=[r._makePulseRevolver(),r._makeBreachShotgun(),r._makeArcLance(),r._makeReliquaryAsset(),r._makeRifle('carrion',4),r._makeRifle('mourning',5),r._makeMelee('bat',6),r._makeMelee('chainsaw',7)];
for(const [i,g] of r.weaponGroups.entries()){g.scale.setScalar(.64);g.position.x=[.3,.31,.29,.31,.34,.34,.32,.32][i];r.weaponRig.add(g);}
installForegroundArms(r,asset.scene);
const weapons=r.weaponGroups.map((g,i)=>{
 fitForegroundArms(g);g.updateWorldMatrix(true,true);const meshes=[],v=new T.Vector3();
 g.traverse(o=>{if(!o.isMesh||!o.visible)return;let p=o;while(p){if(!p.visible)return;p=p.parent;}
  const a=o.geometry.attributes.position,positions=[];
  for(let n=0;n<a.count;n++){v.fromBufferAttribute(a,n).applyMatrix4(o.matrixWorld);positions.push(...v.toArray().map(x=>+x.toFixed(6)));}
  const mat=Array.isArray(o.material)?o.material[0]:o.material;
  meshes.push({name:o.name||'Surface',positions,indices:o.geometry.index?Array.from(o.geometry.index.array):Array.from({length:a.count},(_,n)=>n),color:mat.color?.toArray()||[.2,.2,.2]});
 });return {profile:WEAPON_HANDLING[i],meshes};
});
const dir=new URL('../.art-source/viewmodel-motion/',import.meta.url);await mkdir(dir,{recursive:true});
await writeFile(new URL('reference.json',dir),JSON.stringify({weapons}));
console.log('Exported eight fitted weapon/arm references for Blender.');
