// Signed distance diagnostic against each actual opaque handle mesh.
// Positive is clear, negative is inside a closed handle. Ray parity deduplicates
// face-diagonal hits. This measures compression; it does not infer pressure.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {Renderer} from '../renderer.js';
import {installFPSArms,sampleFPSClip} from '../assets/survivor/fps-arms.js';
import {installForegroundArms} from '../assets/survivor/foreground-arms.js';
import {FIRST_PERSON_HOLD_POSES as holds} from '../assets/survivor/viewmodel-hold-poses.js';
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
const bytes=await readFile('assets/survivor/fps-arms-v5.glb'),asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const r=Object.create(Renderer.prototype);r.materials={};r.camera=new T.PerspectiveCamera(75,1.6,.025,220);r.weaponRig=new T.Group();r.camera.add(r.weaponRig);
r.weaponGroups=[r._makePulseRevolver(),r._makeBreachShotgun(),r._makeArcLance(),r._makeReliquaryAsset(),r._makeRifle('carrion',4),r._makeRifle('mourning',5),r._makeMelee('bat',6),r._makeMelee('chainsaw',7)];
r.weaponGroups.forEach((g,i)=>{const p=holds[i];g.position.set(...p.position);g.rotation.set(...p.rotation);g.scale.setScalar(p.scale);r.weaponRig.add(g);});
const legacy=await readFile('assets/survivor/viewmodel-arms-v2.glb');installForegroundArms(r,(await new GLTFLoader().parseAsync(legacy.buffer.slice(legacy.byteOffset,legacy.byteOffset+legacy.byteLength),'')).scene);installFPSArms(r,asset);
const right=['wood-grip','relic-grip','wood-pistol-grip','rear-handle','wooden-handle'],left=[null,['support-wood'],['support-grip-body'],['support-grip'],['handguard-shell'],['wood-support-grip'],['wooden-handle'],['wrap-handle']];
const chosen=(process.env.FP_CONTACT_WEAPONS||'0,1,2,3,4,5,6,7').split(',').map(Number),direction=new T.Vector3(.963,.127,.231).normalize();
const point=new T.Vector3(),closest=new T.Vector3(),hit=new T.Vector3();
function volumeClosure(triangles){
 const edges=new Map(),vertices=new Map(),key=v=>v.toArray().map(n=>Math.round(n*1e7)).join(',');
 for(const t of triangles){const ids=[t.a,t.b,t.c].map(v=>{const id=key(v);vertices.set(id,v);return id;});if(new Set(ids).size<3)continue;
  for(let j=0;j<3;j++){const pair=[ids[j],ids[(j+1)%3]].sort(),id=pair.join('|'),edge=edges.get(id)||{pair,count:0};edge.count++;edges.set(id,edge);}
 }
 const boundary=[...edges.values()].filter(e=>e.count===1),nonManifoldEdges=[...edges.values()].filter(e=>e.count!==2).length;
 if(!nonManifoldEdges)return{triangles,closed:true,nonManifoldEdges,cappedBoundaryLoops:0};
 const graph=new Map();for(const {pair:[a,b]}of boundary){for(const [from,to]of [[a,b],[b,a]]){if(!graph.has(from))graph.set(from,[]);graph.get(from).push(to);}}
 if([...graph.values()].some(a=>a.length!==2)||[...edges.values()].some(e=>e.count>2))return{triangles,closed:false,nonManifoldEdges,cappedBoundaryLoops:0,volumeUncertain:true};
 const remaining=new Set(graph.keys()),caps=[];let loops=0;
 while(remaining.size){const first=remaining.values().next().value,loop=[];let current=first,previous=null;
  do{loop.push(vertices.get(current));remaining.delete(current);const next=graph.get(current).find(n=>n!==previous);previous=current;current=next;}while(current!==first&&loop.length<=graph.size);
  if(current!==first||loop.length<3)return{triangles,closed:false,nonManifoldEdges,cappedBoundaryLoops:0,volumeUncertain:true};
  const center=loop.reduce((v,p)=>v.add(p),new T.Vector3()).multiplyScalar(1/loop.length),normal=new T.Vector3().crossVectors(loop[1].clone().sub(loop[0]),loop[2].clone().sub(loop[0])).normalize();
  if(loop.some(p=>Math.abs(p.clone().sub(center).dot(normal))>1e-6))return{triangles,closed:false,nonManifoldEdges,cappedBoundaryLoops:0,volumeUncertain:true};
  for(let j=0;j<loop.length;j++)caps.push(new T.Triangle(center,loop[j],loop[(j+1)%loop.length]));loops++;
 }
 return{triangles:triangles.concat(caps),closed:false,nonManifoldEdges,cappedBoundaryLoops:loops};
}
const report={assetSha256:createHash('sha256').update(bytes).digest('hex'),sourceHashes:{},hardwareSelector:process.env.FP_CONTACT_HARDWARE_REGEX||'production grip surfaces',scope:'Sampled exported weighted skin against actual opaque handle triangle volumes; millimetres. Positive clear, negative interior. Exact for closed triangle meshes; Planar open end loops are capped only for volume classification; contact distances use the original opaque triangles. Nonplanar open volumes remain uncertain.',hardware:[],samples:[]};
for(const file of ['scripts/audit-fps-contact.mjs','weapon-detail-pass.js','weapon-occult-redesign.js','weapon-melee.js','assets/survivor/foreground-arms.js','assets/survivor/fps-arms.js'])report.sourceHashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
for(const index of chosen){const g=r.weaponGroups[index],s=g.userData.authoredFPS;
 sampleFPSClip(g,'idle',0);const thumbBind=new Map(s.sampled.filter(p=>/Thumb\d$/.test(p.bone.name)).map(p=>[p.bone,p.bone.quaternion.clone()]));
 for(const [phase,time]of [['idle',0],['draw',.2],[index<6?'fire':'strike',index<6?.075:.46]]){
  if(process.env.FP_CONTACT_PHASES&&!process.env.FP_CONTACT_PHASES.split(',').includes(phase))continue;
  sampleFPSClip(g,phase,time);
  if(phase==='draw'&&process.env.FP_CONTACT_THUMB_DRAW_SCALE){const scale=Number(process.env.FP_CONTACT_THUMB_DRAW_SCALE);for(const [bone,bind]of thumbBind)bone.quaternion.slerpQuaternions(bind,bone.quaternion.clone(),scale);s.rig.updateMatrixWorld(true);s.rig.traverse(m=>{if(m.isSkinnedMesh)m.skeleton.update();});report.thumbDrawScaleDiagnostic=scale;}
  for(const arm of s.arms){const surfaces=[],names=arm.side==='right'?right:left[index];
   g.traverse(m=>{if(!m.isMesh||!(process.env.FP_CONTACT_HARDWARE_REGEX?new RegExp(process.env.FP_CONTACT_HARDWARE_REGEX).test(m.name):names.includes(m.name)))return;if(process.env.FP_CONTACT_HARDWARE_NEAR&&new T.Box3().setFromObject(m).distanceToPoint(arm.hand.getWorldPosition(new T.Vector3()))>Number(process.env.FP_CONTACT_HARDWARE_NEAR))return;const p=m.geometry.attributes.position,ids=m.geometry.index,triangles=[];
    for(let i=0;i<(ids?.count||p.count);i+=3)triangles.push(new T.Triangle(...[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,ids?ids.getX(i+j):i+j).applyMatrix4(m.matrixWorld))));
    const volume=volumeClosure(triangles);
    if(phase==='idle')report.hardware.push({weapon:s.name,side:arm.side,mesh:m.name,triangles:triangles.length,nonManifoldEdges:volume.nonManifoldEdges,closed:volume.closed,cappedBoundaryLoops:volume.cappedBoundaryLoops,volumeUncertain:!!volume.volumeUncertain});
    surfaces.push({name:m.name,triangles,volume});
   });
   if(!surfaces.length)throw new Error('No audit hardware matched '+s.name+'/'+arm.side);
   const mesh=s.rig.getObjectByName(`FPSGlove_${s.name}_${arm.side}`),ids=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
   for(const digit of ['Thumb','Index','Middle','Ring','Little',...(process.env.FP_CONTACT_DENSE==='1'?['WholeGlove']:[])]){const selected=[];
    for(let i=0;i<ids.count;i++){let w=0;for(let j=0;j<4;j++)if(mesh.skeleton.bones[ids.getComponent(i,j)].name.includes('_'+digit))w+=weights.getComponent(i,j);if(w>.75||digit==='WholeGlove')selected.push(i);}
    let nearest=Infinity,penetration=0,inside=0,count=0,worstVertex=null;
    for(let k=0;k<selected.length;k+=process.env.FP_CONTACT_DENSE==='1'?1:Math.max(1,Math.floor(selected.length/300))){mesh.getVertexPosition(selected[k],point).applyMatrix4(mesh.matrixWorld);let distance=Infinity,depth=0;
     for(const surface of surfaces){const ray=new T.Ray(point,direction),hits=[];let gap=Infinity;
      for(const triangle of surface.triangles){triangle.closestPointToPoint(point,closest);gap=Math.min(gap,point.distanceTo(closest));}
      for(const triangle of surface.volume.triangles)if(ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,hit))hits.push(point.distanceTo(hit));
      hits.sort((a,b)=>a-b);const unique=hits.filter((v,i)=>!i||v-hits[i-1]>1e-6);
      distance=Math.min(distance,gap);if(!surface.volume.volumeUncertain&&unique.length%2===1)depth=Math.max(depth,gap);
     }
     nearest=Math.min(nearest,distance);if(depth>1e-6){if(depth>penetration){penetration=depth;worstVertex={index:selected[k],world:point.toArray(),bind:new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,selected[k]).toArray(),influences:[0,1,2,3].map(j=>({bone:mesh.skeleton.bones[ids.getComponent(selected[k],j)].name,weight:weights.getComponent(selected[k],j)}))};}inside++;}count++;
    }
    report.samples.push({weapon:s.name,side:arm.side,phase,time,digit,count,nearestMillimetres:nearest*1000,maxInteriorMillimetres:penetration*1000,interiorFraction:inside/count,worstVertex,handles:surfaces.map(m=>m.name)});
   }
  }
 }
}
await mkdir('output',{recursive:true});await writeFile(process.env.FP_CONTACT_OUTPUT||'output/fps-arms-v5-contact-audit.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({samples:report.samples.length,maxInteriorMillimetres:Math.max(...report.samples.map(s=>s.maxInteriorMillimetres)),maxNearestMillimetres:Math.max(...report.samples.filter(s=>s.digit!=='Thumb'&&s.phase==='idle').map(s=>s.nearestMillimetres))}));
