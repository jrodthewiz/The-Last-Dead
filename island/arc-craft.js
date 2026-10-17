import * as T from '../vendor/three.module.js';

// The island adapter keeps the legacy emitter, sockets and skinned hands.
// Broad enamel/iron forms replace the ornamental overlay at console resolution.
export function craftArc(model){
 const a=model.userData.arc,m=a.materials;
 model.getObjectByName('Img2ThreejsMicroDetail-arc')?.removeFromParent();
 a.coilGuards.visible=false;a.baffles.visible=false;
 for(const side of [-1,1])model.getObjectByName(`inner-spine-${side}`)?.removeFromParent();
 const palette={steel:0x556c6d,edge:0x8b9b91,panel:0x3d514d,ceramic:0xb5b798,wood:0x665742,brass:0x8c8866,bone:0x7c938b,black:0x233a38,glow:0x568e86,heat:0x45746c};
 for(const [key,color]of Object.entries(palette)){const material=m[key];material.color.setHex(color);material.map=null;material.bumpMap=null;material.emissive?.setHex(key==='glow'||key==='heat'?0x568f83:0);material.needsUpdate=true;}
 // A compact swept handle meets the measured MCP/palm region. The original
 // saddle and long ornamental grip remain socket owners, but do not render.
 for(const mesh of a.parts.grip.children)if(mesh.isMesh)mesh.visible=false;
 model.getObjectByName('rear-grip-saddle').visible=false;
 const outline=new T.Shape();outline.moveTo(.14,.16);for(const [z,y]of [[.2,.16],[.19,.02],[.18,-.1],[.22,-.24],[.17,-.27],[.12,-.25],[.1,-.12],[.13,-.09],[.14,.02]])outline.lineTo(z,y);outline.closePath();
 const handleGeometry=new T.ExtrudeGeometry(outline,{depth:.06,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:1,steps:1});handleGeometry.translate(0,0,-.03);handleGeometry.rotateY(-Math.PI/2);const handle=new T.Mesh(handleGeometry,m.wood);handle.name='Arc fitted control grip';model.add(handle);
 const tube=(name,points,radius,material)=>{const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),mesh=new T.Mesh(new T.TubeGeometry(curve,10,radius,5,false),material);mesh.name=name;model.add(mesh);};
 tube('Arc trigger bow',[[0,.09,.16],[0,.03,-.065],[0,-.105,-.065],[0,-.115,.12]],.014,m.edge);
 tube('Arc trigger',[[0,.05,.14],[0,0,.07],[.02,-.06,.078]],.014,m.black);
 // Three large inset lamps form a rear-to-muzzle charge ladder, visible from
 // either hand side. The rail and carriage remain separate moving mechanisms.
 const lamps=[],frame=new T.MeshLambertMaterial({color:0x304846,flatShading:true});
 for(let i=0;i<3;i++){
  const material=new T.MeshLambertMaterial({color:0x45625d,emissive:0x000000,flatShading:true});lamps.push(material);
  for(const side of [-1,1]){const surround=new T.Mesh(new T.BoxGeometry(.1,.025,.12),frame);surround.position.set(side*.09,.25,-.26-i*.16);a.reactor.add(surround);const light=new T.Mesh(new T.BoxGeometry(.07,.027,.078),material);light.position.copy(surround.position);light.position.y+=.014;a.reactor.add(light);}
 }
 // Move the collar's carriage, not its fixed track. The factory groups both.
 const rail=model.getObjectByName('charge-rail');a.chargeSlider.updateMatrix();if(rail)model.attach(rail);
 let discharge=0,indexFinger;const axis=new T.Vector3(),modelRotation=new T.Quaternion(),parentRotation=new T.Quaternion(),delta=new T.Quaternion(),local=new T.Quaternion();
 return {lamps,fitHands(group){const hand=group.userData.authoredFPS.arms.find(a=>a.side==='right');hand.grip.position.y+=.2;indexFinger=group.getObjectByName('FPS_arc_right_Index0');},poseFinger(){
  // Separate the index from the gripping fingers toward the forward trigger.
  // sampleFPSClip restores the authored base first, so this cannot accumulate.
  model.getWorldQuaternion(modelRotation);axis.set(0,1,0).applyQuaternion(modelRotation);delta.setFromAxisAngle(axis,-1.15);indexFinger.parent.getWorldQuaternion(parentRotation);local.copy(parentRotation).invert().multiply(delta).multiply(parentRotation);indexFinger.quaternion.premultiply(local);indexFinger.updateWorldMatrix(false,true);
 },update(charge,recoil,dt){
  discharge=T.MathUtils.damp(discharge,recoil,18,dt);
  a.reactor.rotation.z=0;a.coilGuards.rotation.z=0;
  a.chargeSlider.position.z=charge*.22-discharge*.12;
  a.heatVents.scale.set(1+charge*.12,1,1);
  m.glow.emissiveIntensity=.08+charge*.5+discharge*.5;m.heat.emissiveIntensity=.04+charge*.4;
  for(let i=0;i<lamps.length;i++){const level=T.MathUtils.smoothstep(charge,i*.27,i*.27+.18);lamps[i].color.setRGB(.06+level*.22,.12+level*.5,.105+level*.39);lamps[i].emissive.setRGB(level*.045,level*.12,level*.09);}
 }};
}
