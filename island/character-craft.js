import * as T from '../vendor/three.module.js';

// Retain the authored rig/UVs, but compress busy cloth detail into readable
// shirt, vest, trouser and boot value groups. Skin keeps its original map.
export function dressSurvivor(actor,{operator=false,palette:rolePalette}={}){
 actor.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(actor),height=bounds.max.y-bounds.min.y,point=new T.Vector3(),center=bounds.getCenter(new T.Vector3());
 const palette=rolePalette||(operator?[0x819da6,0xb6a17b,0x7b8c79,0x4d5652]:[0x91aeb4,0xbeb087,0x839889,0x4d5652]),crafted=new Set();let fittedBody;
 for(const [name,part]of Object.entries({body:actor.userData.body,arms:actor.userData.arms})){
  part.skeleton.update();
  const geometry=part.geometry.clone(),p=geometry.attributes.position,indices=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight,colours=[],amount=[],posed=new Float32Array(p.count*3);if(name==='body')fittedBody=posed;
  for(let i=0;i<p.count;i++){
   // The imported bind matrix includes a unit conversion. Raw POSITION values
   // are not posed body coordinates and previously classified every vertex as a boot.
   part.getVertexPosition(i,point).applyMatrix4(part.matrixWorld);point.toArray(posed,i*3);const h=(point.y-bounds.min.y)/height;let bone='';if(indices&&weights){let max=-1;for(let k=0;k<4;k++){const w=weights.getComponent(i,k);if(w>max){max=w;bone=part.skeleton.bones[indices.getComponent(i,k)]?.name||'';}}}
   const skin=/Hand/.test(bone),role=name==='arms'?0:/Foot|Toe/.test(bone)?3:/Leg/.test(bone)||(/Hips/.test(bone)&&h<.55)?2:1,color=new T.Color(palette[role]);colours.push(color.r,color.g,color.b);amount.push(skin?0:1);
  }
  geometry.setAttribute('clothTone',new T.Float32BufferAttribute(colours,3));geometry.setAttribute('clothMix',new T.Float32BufferAttribute(amount,1));part.geometry=geometry;
  for(const material of Array.isArray(part.material)?part.material:[part.material]){if(crafted.has(material))continue;crafted.add(material);const previous=material.onBeforeCompile;material.onBeforeCompile=function(shader,renderer){previous.call(this,shader,renderer);shader.vertexShader='attribute vec3 clothTone;attribute float clothMix;varying vec3 vClothTone;varying float vClothMix;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvClothTone=clothTone;vClothMix=clothMix;');shader.fragmentShader='varying vec3 vClothTone;varying float vClothMix;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float fabricValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
   vec3 painted=vClothTone*(.91+smoothstep(.08,.65,fabricValue)*.18);
   diffuseColor.rgb=mix(diffuseColor.rgb,painted,vClothMix);`);};const key=material.customProgramCacheKey.bind(material);material.customProgramCacheKey=()=>key()+'-expedition-cloth-v2';material.needsUpdate=true;}
 }
 // Fit additions in the asset's rest frame, then attach to the spine so the
 // straps and pack follow the imported walk/run animation without a second rig.
 const unit=height/1.83,kit=new T.Group();kit.name=operator?'Coast radio harness':'Expedition field kit';actor.add(kit);
 const pixels=new Uint8Array(16*16*4);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const i=(y*16+x)*4,v=(x===1||x===14)?193:221+((x*3+y*7)%5)*4;pixels.set([v,v,v,255],i);}const weave=new T.DataTexture(pixels,16,16);weave.colorSpace=T.SRGBColorSpace;weave.magFilter=T.NearestFilter;weave.needsUpdate=true;
 const canvas=new T.MeshLambertMaterial({color:operator?0xa39270:0x879477,map:weave,flatShading:true}),leather=new T.MeshLambertMaterial({color:0x62664c,flatShading:true}),metal=new T.MeshLambertMaterial({color:0xb4b396,flatShading:true});
 const box=(x,y,z,w,h,d,mat)=>{let geometry;if(w>.08&&h>.08){const shape=new T.Shape(),r=Math.min(w,h)*.15;shape.moveTo(-w/2+r,-h/2);for(const [px,py]of [[w/2-r,-h/2],[w/2,-h/2+r],[w/2,h/2-r],[w/2-r,h/2],[-w/2+r,h/2],[-w/2,h/2-r],[-w/2,-h/2+r]])shape.lineTo(px,py);shape.closePath();geometry=new T.ExtrudeGeometry(shape,{depth:d*.8,bevelEnabled:true,bevelSize:.008,bevelThickness:d*.1,bevelSegments:1,steps:1});geometry.translate(0,0,-d*.4);geometry.scale(unit,unit,unit);}else geometry=new T.BoxGeometry(w*unit,h*unit,d*unit);const m=new T.Mesh(geometry,mat);m.position.set(center.x+x*unit,bounds.min.y+y*unit,center.z+z*unit);kit.add(m);return m;};
 const body=actor.userData.body,position=body.geometry.attributes.position;
 const depthAt=(x,y,back=false)=>{let depth=back?-Infinity:Infinity;for(let i=0;i<position.count;i++){point.fromArray(fittedBody,i*3);if(Math.abs(point.x-center.x-x*unit)<.075*unit&&Math.abs(point.y-bounds.min.y-y*unit)<.08*unit)depth=back?Math.max(depth,point.z):Math.min(depth,point.z);}return Number.isFinite(depth)?(depth-center.z)/unit:back?.1:-.1;};
 const packZ=depthAt(0,1.23,true)+.09;
 box(0,1.23,packZ,.31,.40,.16,canvas);box(0,1.39,packZ+.01,.33,.095,.17,leather);box(0,1.12,packZ+.095,.22,.13,.055,canvas);
 for(const x of [-.105,.105]){box(x,1.25,packZ+.099,.025,.33,.025,leather);box(x,1.12,packZ+.12,.04,.035,.014,metal);for(let i=0;i<5;i++){const y=1.22+i*.067;box(x,y,depthAt(x,y)-.017,.038,.075,.026,leather);}box(x,1.22,depthAt(x,1.22)-.038,.05,.045,.017,metal);
  const path=new T.CatmullRomCurve3([[x,1.38,depthAt(x,1.38)-.023],[x,1.52,-.02],[x,1.49,packZ],[x,1.38,packZ+.09]].map(([px,py,pz])=>new T.Vector3(center.x+px*unit,bounds.min.y+py*unit,center.z+pz*unit)));kit.add(new T.Mesh(new T.TubeGeometry(path,8,.016*unit,4,false),leather));}
 const pouch=box(.15,.95,depthAt(.15,.95)-.045,.11,.13,.07,canvas),loop=box(.15,1.025,depthAt(.15,1.025)-.018,.07,.055,.023,leather);actor.updateMatrixWorld(true);actor.userData.bones.Spine02.attach(kit);actor.userData.bones.Hips.attach(pouch);actor.userData.bones.Hips.attach(loop);
 return {kit,unit};
}

// A bounded, bone-attached listening action. The radio is carried in the hand,
// so palm contact survives the reach without moving the world-space actor.
export function radioPerformance(actor,unit){
 const s=actor.userData,b=s.bones,radio=new T.Group();radio.name='Elias handheld receiver';const caseMat=new T.MeshLambertMaterial({color:0x74857b,flatShading:true}),trim=new T.MeshLambertMaterial({color:0xc6c4a6,flatShading:true});
 const body=new T.Mesh(new T.BoxGeometry(.07*unit,.14*unit,.045*unit),caseMat);radio.add(body);for(let j=0;j<3;j++){const slot=new T.Mesh(new T.BoxGeometry(.047*unit,.008*unit,.003*unit),trim);slot.position.set(0,(-.01+j*.019)*unit,-.024*unit);radio.add(slot);}const antenna=new T.Mesh(new T.CylinderGeometry(.004*unit,.004*unit,.16*unit,5),caseMat);antenna.position.set(.024*unit,.14*unit,0);radio.add(antenna);
 actor.updateMatrixWorld(true);const arm=s.arms,verts=arm.geometry.attributes.position,skin=arm.geometry.attributes.skinIndex,weights=arm.geometry.attributes.skinWeight,palm=new T.Vector3(),sample=new T.Vector3();let total=0;
 for(let i=0;i<verts.count;i++){let influence=0;for(let k=0;k<4;k++)if(arm.skeleton.bones[skin.getComponent(i,k)]?.name==='LeftHand')influence+=weights.getComponent(i,k);if(influence<.7)continue;arm.getVertexPosition(i,sample);sample.applyMatrix4(arm.matrixWorld);palm.addScaledVector(sample,influence);total+=influence;}
 const wrist=b.LeftHand.getWorldPosition(new T.Vector3());if(total)palm.multiplyScalar(1/total);else palm.copy(wrist);const fingers=palm.clone().sub(wrist).normalize();actor.add(radio);radio.position.copy(actor.worldToLocal(palm));radio.position.z-=.018*unit;radio.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),fingers);actor.updateMatrixWorld(true);b.LeftHand.attach(radio);
 const scratch={a:new T.Vector3(),c:new T.Vector3(),h:new T.Vector3(),target:new T.Vector3(),pole:new T.Vector3(),axis:new T.Vector3(),elbow:new T.Vector3(),from:new T.Vector3(),to:new T.Vector3(),q:new T.Quaternion(),parent:new T.Quaternion()};
 const saved=[b.LeftArm,b.LeftForeArm,b.LeftHand,b.Head].map(bone=>({bone,q:bone.quaternion.clone()}));let time=0;
 function turn(bone,from,to){scratch.q.setFromUnitVectors(from.normalize(),to.normalize());bone.parent.getWorldQuaternion(scratch.parent);scratch.q.premultiply(scratch.parent.clone().invert()).multiply(scratch.parent).multiply(bone.quaternion);bone.quaternion.copy(scratch.q);bone.updateWorldMatrix(true,true);}
 return {radio,get time(){return time;},restore(){for(const p of saved)p.bone.quaternion.copy(p.q);},update(dt,near){time+=dt;for(const p of saved)p.q.copy(p.bone.quaternion);actor.updateMatrixWorld(true);const q=scratch;const listen=near?1:.5+.5*Math.sin(time*.6);b.Head.getWorldPosition(q.target);actor.getWorldQuaternion(q.parent);q.target.add(q.to.set(-.18*unit,-.06*unit,-.025*unit).applyQuaternion(q.parent));b.LeftHand.getWorldPosition(q.h);q.target.lerp(q.h,(1-listen)*.5);
   b.LeftArm.getWorldPosition(q.a);b.LeftForeArm.getWorldPosition(q.c);b.LeftHand.getWorldPosition(q.h);const l1=q.a.distanceTo(q.c),l2=q.c.distanceTo(q.h),distance=T.MathUtils.clamp(q.a.distanceTo(q.target),Math.abs(l1-l2)+.001,l1+l2-.001);q.axis.copy(q.target).sub(q.a).normalize();q.pole.set(.35,-.5,-.4).applyQuaternion(q.parent);q.pole.addScaledVector(q.axis,-q.pole.dot(q.axis)).normalize();const along=(l1*l1-l2*l2+distance*distance)/(2*distance);q.elbow.copy(q.a).addScaledVector(q.axis,along).addScaledVector(q.pole,Math.sqrt(Math.max(0,l1*l1-along*along)));
   turn(b.LeftArm,q.from.copy(q.c).sub(q.a),q.to.copy(q.elbow).sub(q.a));b.LeftForeArm.getWorldPosition(q.c);b.LeftHand.getWorldPosition(q.h);turn(b.LeftForeArm,q.from.copy(q.h).sub(q.c),q.to.copy(q.target).sub(q.c));b.Head.rotation.z+=Math.sin(time*.8)*.025*(near?1:.4);
 }};
}
