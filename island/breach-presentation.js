import * as T from '../vendor/three.module.js';

// One representative finish: broad worn steel, dark panels, narrow warm edges.
// Shared legacy textures remain owned by the other weapons that still use them.
export function finishExpeditionBreach(model){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#b6b9ab';ctx.fillRect(0,0,32,32);
 ctx.fillStyle='#a7ad9f';ctx.fillRect(0,8,32,6);ctx.fillStyle='#c1c4b6';ctx.fillRect(0,26,32,3);
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
 const m=model.userData.breach.materials;
 for(const role of ['steel','panel','edge','brass']){m[role].map=role==='steel'?map:null;m[role].bumpMap=null;m[role].vertexColors=false;m[role].needsUpdate=true;}
 m.steel.color.setHex(0x738078);m.panel.color.setHex(0x445650);m.edge.color.setHex(0x9a9f84);m.brass.color.setHex(0xb39b68);
 model.userData.expeditionFinish={textureSize:32,roles:['steel','panel','edge','brass']};
}

export function breachGesture(shotAge,equipAge,aim=0,motion=true){
 const draw=1-T.MathUtils.smoothstep(equipAge,0,.28),time=Math.max(0,shotAge),weight=1-aim*.35;
 const kick=time<.4?Math.exp(-time*18):0;
 const settle=time>.09&&time<.34?Math.sin((time-.09)/.25*Math.PI)*.08:0;
 return {kick:(kick-settle)*weight,draw,roll:(motion?kick*.018:0)*weight-draw*.18};
}

export function finishExpeditionSteel(models){
 for(const [index,family]of [[0,'ossuary'],[4,'rifle']]){
  const materials=models[index].userData[family].materials;
  for(const [role,color]of Object.entries({steel:0x718478,panel:0x44584e,edge:0x9da68f,brass:0x9d9270})){
   const m=materials[role];if(!m)continue;m.map=m.bumpMap=m.normalMap=null;m.vertexColors=false;m.color.setHex(color);m.needsUpdate=true;
  }
 }
}
