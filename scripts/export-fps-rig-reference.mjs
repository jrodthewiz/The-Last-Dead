// Offline metric rig reference. Blender owns the new surfaces and actions.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import * as T from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {Renderer} from '../renderer.js';
import {installForegroundArms,fitForegroundArms} from '../assets/survivor/foreground-arms.js';
import {FIRST_PERSON_HOLD_POSES} from '../assets/survivor/viewmodel-hold-poses.js';
import {FPS_GRIP_PROFILES} from '../assets/survivor/fps-grip-profiles.js';
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
const raw=await readFile(new URL('../assets/survivor/viewmodel-arms-v2.glb',import.meta.url));
const asset=(await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'')).scene;
const r=Object.create(Renderer.prototype);r.materials={};r.camera=new T.PerspectiveCamera(75,16/10,.025,220);r.weaponRig=new T.Group();r.camera.add(r.weaponRig);
r.weaponGroups=[r._makePulseRevolver(),r._makeBreachShotgun(),r._makeArcLance(),r._makeReliquaryAsset(),r._makeRifle('carrion',4),r._makeRifle('mourning',5),r._makeMelee('bat',6),r._makeMelee('chainsaw',7)];
for(const [i,g]of r.weaponGroups.entries()){const p=FIRST_PERSON_HOLD_POSES[i];g.position.set(...p.position);g.rotation.set(...p.rotation);g.scale.setScalar(p.scale);r.weaponRig.add(g);}
installForegroundArms(r,asset);
const weapons=r.weaponGroups.map((g,index)=>{
 fitForegroundArms(g);g.updateWorldMatrix(true,true);const inverse=g.matrixWorld.clone().invert();
 const local=o=>inverse.clone().multiply(o.matrixWorld).elements;
 const arms=g.userData.foregroundArmFits,armRoots=new Set(arms.map(f=>f.arm)),hardware=[];
 g.traverse(m=>{if(!m.isMesh||!m.geometry.attributes.position||m.isSkinnedMesh||/Muzzle|Flash|Smoke|Flare|haze/i.test(m.name))return;for(let p=m;p;p=p.parent)if(armRoots.has(p))return;
  const positions=[],v=new T.Vector3(),p=m.geometry.attributes.position,matrix=inverse.clone().multiply(m.matrixWorld);for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(matrix);positions.push(...v.toArray());}
  const indices=m.geometry.index?Array.from(m.geometry.index.array):Array.from({length:p.count},(_,i)=>i);if(matrix.determinant()<0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  const mat=Array.isArray(m.material)?m.material[0]:m.material;hardware.push({name:m.name,positions,indices,color:mat.color?.toArray()||[.15,.18,.20],metalness:mat.metalness||0});
 });
 return {index,name:FIRST_PERSON_HOLD_POSES[index].name,weaponReferences:hardware,placementDepth:g.userData.foregroundFitRig.userData.depth,arms:arms.map(f=>{
  const wrist=f.wrist.getWorldPosition(new T.Vector3()).applyMatrix4(inverse),elbow=f.forearm.localToWorld(new T.Vector3(0,-.34,0)).applyMatrix4(inverse),shoulder=f.upper.localToWorld(new T.Vector3(0,-.40,0)).applyMatrix4(inverse);
  const surfaces=[];for(const [region,node]of [['forearm',f.forearm],['upper',f.upper]])node.traverse(m=>{if(!m.isMesh)return;const positions=[],v=new T.Vector3(),p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld).applyMatrix4(inverse);positions.push(...v.toArray());}surfaces.push({region,positions,indices:Array.from(m.geometry.index.array),colors:Array.from(m.geometry.attributes.color.array),colorSize:m.geometry.attributes.color.itemSize});});
  const side=f.arm.userData.side<0?'left':'right',handFrame=new T.Matrix4().fromArray(local(f.hand));
  // Authored grip-axis roll reveals the firing web and separates the stacked
  // bat palms. It changes only the new Blender reference, never the fallback.
  const roll=index===1&&side==='right'?-Math.PI/6:index===6?(side==='right'?1:-1)*Math.PI/9:0;
  handFrame.multiply(new T.Matrix4().makeRotationY(roll));const handInverse=handFrame.clone().invert();
  const names=side==='right'?['wood-grip','relic-grip','wood-pistol-grip','rear-handle','wooden-handle']:index===1?['support-wood']:index===2?['support-grip-body']:index===3?['support-grip']:index===4?['handguard-shell']:index===5?['wood-support-grip']:index===6?['wooden-handle']:['wrap-handle'];
  const body=hardware.filter(m=>names.includes(m.name));if(!body.length)throw new Error('No real grip surface '+index+'/'+side);
  const triangles=[];for(const mesh of body){const p=mesh.positions;for(let i=0;i<mesh.indices.length;i+=3)triangles.push(mesh.indices.slice(i,i+3).map(j=>new T.Vector3(p[j*3],p[j*3+1],p[j*3+2]).applyMatrix4(handInverse)));}
  const crossSection=y=>{const points=[];for(const tri of triangles)for(let i=0;i<3;i++){const a=tri[i],b=tri[(i+1)%3];if((a.y-y)*(b.y-y)>0||Math.abs(a.y-b.y)<1e-8)continue;const p=a.clone().lerp(b,(y-a.y)/(b.y-a.y));points.push([p.x,p.z]);}if(points.length<3)throw new Error('Grip slice misses hardware '+index+'/'+side+'/'+y+' bounds '+JSON.stringify(new T.Box3().setFromPoints(triangles.flat())));return points;};
  const rows=Object.fromEntries([['Index',.041],['Middle',.014],['Ring',-.015],['Little',-.040]].map(([digit,y])=>[digit,{y,points:crossSection(y)}]));
  const control=hardware.find(m=>/trigger-blade$/.test(m.name));let triggerPoint=null;if(side==='right'&&control){const b=new T.Box3();for(let i=0;i<control.positions.length;i+=3)b.expandByPoint(new T.Vector3(...control.positions.slice(i,i+3)).applyMatrix4(handInverse));triggerPoint=b.getCenter(new T.Vector3()).toArray();}
  return {side,handMatrix:handFrame.elements,wrist:wrist.toArray(),elbow:elbow.toArray(),shoulder:shoulder.toArray(),surfaces,profile:{...FPS_GRIP_PROFILES[index][side],rows,triggerPoint,hardware:names,longitudinalPalm:true}};
 })};
});
await mkdir(new URL('../.art-source/viewmodel-arms-v3/',import.meta.url),{recursive:true});
await writeFile(new URL('../.art-source/viewmodel-arms-v3/rig-reference.json',import.meta.url),JSON.stringify({weapons}));console.log('Exported metric references for eight Blender FPS rigs.');
