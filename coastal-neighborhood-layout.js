// Deterministic street-front subdivision in four-metre increments. Each block
// keeps a shared rear alley and regular side passages back to the main roads.
import {frontageLots} from './assets/community/neonbay-frontage.js';
export function makeCoastalNeighborhoods(seed=17031){
  let state=seed>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const lots=[],alleys=[],courtyards=[],props=[];
  const models=['concrete-walk-up-flat-block','student-dormitory-block','low-rise-condominium','bangkok-apartment-block'];
  const bands=[{min:8,max:48,zone:'residential'},{min:64,max:104,zone:'residential'},{min:120,max:168,zone:'industrial'},{min:184,max:224,zone:'industrial'},{min:240,max:296,zone:'coastal-park'}];
  for(const [bandIndex,band]of bands.entries())for(const [blockIndex,[left,right]]of [[152,224],[240,360]].entries()){
    const depth=band.zone==='industrial'?16:band.zone==='coastal-park'?20:16;
    const middle=(band.min+band.max)/2,alleyDepth=band.max-band.min-depth*2;
    alleys.push({x:(left+right)/2,z:middle,width:right-left,depth:alleyDepth,zone:band.zone});
    courtyards.push({x:(left+right)/2,z:middle,width:Math.min(24,right-left),depth:alleyDepth,zone:band.zone});
    const prop=(kind,x,z,width,depth)=>props.push({id:`coast-${kind}-${props.length}`,kind,x,z,yaw:0,width,depth});
    for(let i=0;i<6;i++)prop('tree',left+4+i*(right-left-8)/5,middle-alleyDepth/2+1,.35,.35);
    for(let i=0;i<4;i++)prop('bench',left+10+i*(right-left-20)/3,middle+alleyDepth/2-1,1.8,.65);
    for(const x of [left+1,right-1])prop('lamp',x,middle+alleyDepth/2-1,.2,.2);
    for(let side=0;side<2;side++){
      const minZ=side===0?band.min:band.max-depth,maxZ=minZ+depth;
      const frontage=frontageLots({minX:left,maxX:right,minZ,maxZ},{random,wMin:band.zone==='industrial'?20:12,wMax:band.zone==='industrial'?24:16,dMin:depth-4,dMax:depth,edges:[side===0?0:2]});
      for(const [index,p]of frontage.entries()){
        const {x,z,width,depth:minDepth,minX,maxX,minZ,maxZ}=p;
        const lighthouseApron=maxX>344&&minX<364&&maxZ>280&&minZ<300;
        if(lighthouseApron)continue;
        const asset=band.zone==='industrial'&&random()<.35?'bangkok-hospital-clinic-building':models[Math.floor(random()*models.length)];
        const height=band.zone==='coastal-park'?6+Math.floor(random()*3)*3:band.zone==='industrial'?9+Math.floor(random()*3)*3:12+Math.floor(random()*4)*3;
        lots.push({id:`coast-lot-${bandIndex}-${blockIndex}-${side}-${index}`,name:`${band.zone==='residential'?'SALTWIND':band.zone==='industrial'?'EAST WORKS':'CAPE LODGE'} ${lots.length+1}`,asset,x,z,width,depth:minDepth,height,zone:band.zone,yaw:side===0?Math.PI:0});
        const passageX=side===0?maxX+2:minX-2;
        if(passageX>left&&passageX<right)alleys.push({x:passageX,z:side===0?band.min+depth/2:band.max-depth/2,width:4,depth,zone:band.zone});
      }
    }
  }
  return {seed,lots,alleys,courtyards,props};
}
