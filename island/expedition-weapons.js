import * as T from '../vendor/three.module.js';

function paint(material,color){material.color.setHex(color);material.map=null;material.bumpMap=null;material.normalMap=null;material.roughness=1;material.metalness=0;material.needsUpdate=true;}

export function craftExpeditionWeapons(models){
 const model=models[3],m=model.userData.reliquary;
 model.getObjectByName('Img2ThreejsMicroDetail-reliquary')?.removeFromParent();
 m.ribcage.visible=false;m.heatVents.visible=false;
 for(const [key,color]of Object.entries({steel:0x738b83,panel:0x53675f,edge:0xa4ad94,brass:0x8e8967,bone:0xb0a58a,wood:0x736048}))paint(m.materials[key],color);
 // Retain the distinctive ceremonial muzzle; simplify the repeated ribs and
 // replace the decorative rear face with an actual hinged loading closure.
 for(const name of ['chamber-face','chamber-inset'])model.getObjectByName(name).visible=false;
 model.getObjectByName('chamber-band-0.24').visible=false;
 for(const child of m.parts.grip.children)if(child.isMesh)child.visible=false;
 // Leave an index recess above the three gripping fingers. The old solid
 // upper grip occupied the new control path even though its socket was right.
 const gripShape=new T.Shape();gripShape.moveTo(.205,-.16);for(const [z,y]of [[.22,-.29],[.25,-.46],[.18,-.5],[.12,-.47],[.10,-.28],[.14,-.23],[.17,-.22],[.17,-.16]])gripShape.lineTo(z,y);gripShape.closePath();
 const gripGeometry=new T.ExtrudeGeometry(gripShape,{depth:.08,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:1,steps:1});gripGeometry.translate(0,0,-.04);gripGeometry.rotateY(-Math.PI/2);const grip=new T.Mesh(gripGeometry,m.materials.wood);grip.name='Reliquary fitted control grip';model.add(grip);
 const collar=new T.Mesh(new T.CylinderGeometry(.122,.17,.15,10,1,true),m.materials.steel);collar.rotation.x=Math.PI/2;collar.position.set(0,.031,.275);model.add(collar);
 const hinge=new T.Group();hinge.name='Reliquary breech hinge';hinge.userData.weaponMechanism=true;hinge.position.set(.12,.031,.35);model.add(hinge);
 const cap=new T.Mesh(new T.CylinderGeometry(.115,.115,.028,8),m.materials.panel);cap.rotation.x=Math.PI/2;cap.position.x=-.12;hinge.add(cap);
 const lock=new T.Mesh(new T.BoxGeometry(.13,.035,.04),m.materials.edge);lock.position.set(-.12,0,.035);hinge.add(lock);
 const rim=new T.Mesh(new T.RingGeometry(.082,.122,8),m.materials.edge);rim.position.set(0,.031,.345);model.add(rim);
 const bore=new T.Mesh(new T.CylinderGeometry(.081,.081,.22,8,1,true),m.materials.black);bore.rotation.x=Math.PI/2;bore.position.set(0,.031,.23);model.add(bore);
 const tube=(name,points,material)=>{const mesh=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),10,.012,5,false),material);mesh.name=name;model.add(mesh);return mesh;};
 tube('Reliquary trigger bow',[[0,-.12,.12],[0,-.14,.015],[0,-.24,.015],[0,-.25,.12]],m.materials.edge);
 tube('Reliquary launch trigger',[[0,-.125,.105],[0,-.16,.08],[.005,-.19,.10]],m.materials.black);
 const round=new T.Group();round.name='Single Reliquary cartridge';round.userData.weaponMechanism=true;model.add(round);
 const caseMat=new T.MeshLambertMaterial({color:0xb3a277,flatShading:true}),tipMat=new T.MeshLambertMaterial({color:0x8f5544,flatShading:true});
 const shell=new T.Mesh(new T.CylinderGeometry(.065,.065,.24,8),caseMat);shell.rotation.x=Math.PI/2;round.add(shell);const nose=new T.Mesh(new T.ConeGeometry(.065,.09,8),tipMat);nose.rotation.x=-Math.PI/2;nose.position.z=-.165;round.add(nose);const base=new T.Mesh(new T.CylinderGeometry(.073,.073,.025,8),m.materials.edge);base.rotation.x=Math.PI/2;base.position.z=.13;round.add(base);round.visible=false;
 // Each existing model keeps its silhouette and characteristic material split.
 // Mourning's white receiver was the contrast outlier at 240p.
 const rifle=models[5].userData.rifle;paint(rifle.materials.steel,0x85958d);paint(rifle.materials.edge,0xa7ac93);paint(rifle.materials.panel,0x62766e);
 const saw=models[7].userData.melee;paint(saw.materials.red,0x955947);paint(saw.materials.edge,0xa2a58d);paint(saw.materials.steel,0x85928a);
 // The bat keeps its original handle and grip frames, with broad worn ash
 // and iron surfaces that survive the 240p image instead of near-black grain.
 const bat=models[6],finishBat=()=>{for(const [key,color]of Object.entries({wood:0xa68c69,edge:0x929d8a,brass:0x8c8568,rubber:0x626954,danger:0x704e39})){const material=bat.userData.melee.materials[key];paint(material,color);material.flatShading=true;}};finishBat();bat.userData.resourcesReady?.then(finishBat);
 for(const [name,geometry]of [['hardwood-barrel',new T.CylinderGeometry(.052,.105,.80,12)],['splintered-bat-head',new T.SphereGeometry(.112,10,6)]]){const part=bat.getObjectByName(name);if(part){part.geometry.dispose();part.geometry=geometry;}}
 let reload,indexFinger;const axis=new T.Vector3(),modelRotation=new T.Quaternion(),parentRotation=new T.Quaternion(),delta=new T.Quaternion(),local=new T.Quaternion();
 return {hinge,round,bind(group){
  const left=group.userData.authoredFPS.arms.find(a=>a.side==='left'),socket=new T.Object3D();socket.matrixAutoUpdate=false;model.add(socket);
  const middle=group.userData.authoredFPS.rig.getObjectByName('FPS_reliquary_left_Middle0');
  indexFinger=group.getObjectByName('FPS_reliquary_right_Index0');
  reload={group,left,home:left.grip,socket,knuckle:left.hand.worldToLocal(middle.getWorldPosition(new T.Vector3())),inverse:left.offset.clone().invert(),goal:new T.Matrix4(),local:new T.Matrix4(),point:new T.Vector3(),homePoint:new T.Vector3(),rotation:new T.Quaternion(),scale:new T.Vector3(),offset:new T.Vector3()};
 },poseFinger(){model.getWorldQuaternion(modelRotation);axis.set(0,1,0).applyQuaternion(modelRotation);delta.setFromAxisAngle(axis,-1.1);indexFinger.parent.getWorldQuaternion(parentRotation);local.copy(parentRotation).invert().multiply(delta).multiply(parentRotation);indexFinger.quaternion.premultiply(local);indexFinger.updateWorldMatrix(false,true);},update(progress){
  m.core.rotation.z=0;m.core.scale.setScalar(1);m.materials.glow.emissiveIntensity=.08+m.flash*.6;m.materials.heat.emissiveIntensity=.06+m.flash*.5;
  const p=Math.max(0,progress),ease=(a,b)=>T.MathUtils.smoothstep(p,a,b),open=ease(.06,.22)-ease(.79,.94);hinge.rotation.y=-open*2.2;
  round.visible=progress>=.28&&progress<.72;round.position.set(-.22*(1-ease(.3,.43)),.031-.12*(1-ease(.3,.43)),.68-.49*ease(.44,.7));
  if(!reload)return;const r=reload;if(progress<0){r.left.grip=r.home;return;}
  r.group.updateWorldMatrix(true,true);r.home.updateWorldMatrix(true,false);r.goal.multiplyMatrices(r.home.matrixWorld,r.left.offset).decompose(r.homePoint,r.rotation,r.scale);
  const insert=ease(.18,.32)*(1-ease(.72,.86));r.point.copy(round.position);r.point.x-=.025;r.point.z+=.14;model.localToWorld(r.point);r.offset.copy(r.knuckle).multiply(r.scale).applyQuaternion(r.rotation);r.point.sub(r.offset);r.point.lerp(r.homePoint,1-insert);r.goal.compose(r.point,r.rotation,r.scale);r.local.copy(model.matrixWorld).invert().multiply(r.goal).multiply(r.inverse);r.socket.matrix.copy(r.local);r.left.grip=r.socket;
 }};
}
