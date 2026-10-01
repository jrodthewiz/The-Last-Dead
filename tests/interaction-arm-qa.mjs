// Serialized into a real browser page; inspect exported skin, not fit metadata.
export async function measureCounterArms() {
  const T=await import('./vendor/three.module.js'),r=window.__DEAD_ARRIVAL__.renderer;
  const a=r.brutalCombatVisuals?.arms,c=r.camera;
  if(!a?.visible)return {active:false,bands:[]};
  a.updateWorldMatrix(true,true);c.updateWorldMatrix(true,false);
  const m=a.getObjectByName('TLD_Remote_Arms');m.skeleton.update();
  const p=m.geometry.attributes.position,si=m.geometry.attributes.skinIndex,sw=m.geometry.attributes.skinWeight;
  const inv=c.matrixWorld.clone().invert(),v=new T.Vector3(),bindV=new T.Vector3(),clip=new T.Vector4();
  const tx=1/c.projectionMatrix.elements[0],ty=1/c.projectionMatrix.elements[5];
  const defs=[['left',new T.Vector3(1,0,-tx).normalize(),0],['right',new T.Vector3(-1,0,-tx).normalize(),0],['bottom',new T.Vector3(0,1,-ty).normalize(),0],['top',new T.Vector3(0,-1,-ty).normalize(),0],['near',new T.Vector3(0,0,-1),-c.near],['far',new T.Vector3(0,0,1),c.far]];
  const bands=['Left','Right'].map(side=>{
    const j=m.skeleton.bones.findIndex(b=>b.name===side+'Arm');
    const toBone=m.skeleton.boneInverses[j].clone().multiply(m.bindMatrix);
    const planes=Object.fromEntries(defs.map(([name])=>[name,-Infinity]));
    let count=0,visible=0;
    for(let i=0;i<p.count;i++){
      let weight=0;for(let k=0;k<4;k++)if(si.getComponent(i,k)===j)weight+=sw.getComponent(i,k);
      if(weight<.5)continue;
      bindV.fromBufferAttribute(p,i).applyMatrix4(toBone);
      if(bindV.y>=3)continue; // Native skeleton uses centimetres.
      count++;m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld).applyMatrix4(inv);
      for(const [name,n,d]of defs)planes[name]=Math.max(planes[name],n.dot(v)+d);
      clip.set(v.x,v.y,v.z,1).applyMatrix4(c.projectionMatrix);
      if(clip.w>0&&Math.abs(clip.x)<=clip.w&&Math.abs(clip.y)<=clip.w&&Math.abs(clip.z)<=clip.w)visible++;
    }
    return{side,count,visible,planes,bottomMargin:-planes.bottom,outsideWithMargin:Object.values(planes).some(d=>d<=-.005)};
  });
  return{active:true,bands};
}

export function assertCounterSleeves(measurement,assert,name) {
  if(!measurement.active)return;
  for(const band of measurement.bands){
    assert.equal(band.count,band.side==='Left'?155:185,name+' measures actual proximal sleeve vertices');
    assert.equal(band.visible,0,name+' '+band.side+' shoulder seam is outside the frame');
    assert(band.outsideWithMargin,name+' '+band.side+' shoulder seam has at least 5mm frustum clearance');
  }
}
