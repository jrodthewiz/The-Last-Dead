// Adapted from L1vsun/NEONBAY world.js frontage(), MIT licensed.
// Source commit: baac38fecd1698c67dcf75ccffb1a82592798e9c.
// Copyright and permission notice: ./NEONBAY-LICENSE.txt.
// Adaptation: rectangular street blocks, four-metre collision-grid snapping,
// explicit edge selection, fixed passage gaps, and no renderer dependencies.
export function frontageLots(bounds,{random,wMin=12,wMax=16,dMin=12,dMax=16,edges=[0,2],gap=4}={}){
  const {minX,maxX,minZ,maxZ}=bounds,polygon=[[minX,minZ],[maxX,minZ],[maxX,maxZ],[minX,maxZ]],placed=[];
  const sample=(min,max)=>Math.floor((min+random()*(max-min+4))/4)*4;
  for(const k of edges){
    const a=polygon[k],b=polygon[(k+1)%4],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(length<12)continue;
    const ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length,nx=-uz,nz=ux;
    for(let s=0;s+12<=length;){
      const w=Math.min(sample(wMin,wMax),length-s);let d=sample(dMin,dMax),candidate;
      for(let retry=0;retry<3&&d>=8;retry++,d=Math.floor(d*.72/4)*4){
        const x=a[0]+ux*(s+w/2)+nx*d/2,z=a[1]+uz*(s+w/2)+nz*d/2;
        const corners=[[-w/2,0],[w/2,0],[-w/2,d],[w/2,d]].map(([p,q])=>[a[0]+ux*(s+w/2+p)+nx*q,a[1]+uz*(s+w/2+p)+nz*q]);
        const width=Math.abs(ux)*w+Math.abs(nx)*d,depth=Math.abs(uz)*w+Math.abs(nz)*d;
        const box={x,z,width,depth,yaw:Math.atan2(nx,nz),minX:x-width/2,maxX:x+width/2,minZ:z-depth/2,maxZ:z+depth/2};
        if(corners.every(([cx,cz])=>cx>=minX&&cx<=maxX&&cz>=minZ&&cz<=maxZ)&&!placed.some(p=>p.minX<box.maxX&&p.maxX>box.minX&&p.minZ<box.maxZ&&p.maxZ>box.minZ)){candidate=box;break;}
      }
      if(candidate)placed.push(candidate);
      s+=w+gap;
    }
  }
  return placed;
}
