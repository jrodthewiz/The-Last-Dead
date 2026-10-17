import * as T from '../vendor/three.module.js';
import {random,terrainHeight,roadAt} from './data.js';
import {reservedPlace} from './places.js';
import {settlementReserved,FRONTAGES} from './settlement-plan.js';
import {accessReserved} from './access-plan.js';

function fernGeometry(){
 const points=[],tri=(a,b,c)=>points.push(...a,...b,...c,...c,...b,...a);
 for(let j=0;j<7;j++){
  const a=j*2.39996,dx=Math.cos(a),dz=Math.sin(a),length=.74+(j%3)*.11;
  const at=(t,side=0)=>[dx*t*length-dz*side,Math.sin(t*2.2)*.46,dz*t*length+dx*side];
  for(let s=1;s<=5;s++){const t=s*.16,w=.18*(1-t)+.025;for(const side of [-1,1])tri(at(t-.11),at(t+.1,side*w),at(t+.14));}
  tri(at(.75,-.025),at(1.05),at(.75,.025));
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.computeVertexNormals();return g;
}

export function coastalBotany(kit,data){
 kit.geometries.fern=fernGeometry();const rng=random(26016);let count=0;
 const plant=(x,z,s)=>{const y=terrainHeight(x,z),r=roadAt(x,z);if(y<4||y>85||reservedPlace(x,z,.5)||settlementReserved(x,z,.5)||accessReserved(data.accessPaths||[],x,z,.7)||r.distance<r.width/2+1.6)return;
  if(Math.abs(terrainHeight(x+.5,z)-terrainHeight(x-.5,z))>1||Math.abs(terrainHeight(x,z+.5)-terrainHeight(x,z-.5))>1)return;
  if(data.buildings.some(b=>Math.abs(x-b.x)<b.w/2+3&&Math.abs(z-b.z)<b.d/2+4))return;
  kit.add('fern',x,y-.025,z,s,s,s,[0x75894d,0x8f9757,0x55774a][count++%3],rng()*6.28,null,4);
 };
 // Ferns grow around shade and sheltered verges, leaving the road/trail strip.
 for(let i=0;i<data.trees.length;i+=4){const t=data.trees[i];for(let j=0;j<2;j++){const a=rng()*6.28,r=2.1+rng()*2.5;plant(t.x+Math.cos(a)*r,t.z+Math.sin(a)*r,.85+rng()*.8);}}
 // A few coherent roadside colonies rather than an evenly filled carpet.
 for(const [cx,cz]of [[-738,269],[-723,280],[-860,153],[-843,139],[-477,177],[-486,189]])for(let j=0;j<14;j++)plant(cx+(rng()-.5)*13,cz+(rng()-.5)*12,.8+rng()*.9);
 return count;
}

export function streetCraft(kit,data){
 const metal=0x42584e,stone=0xb6ae8b,wood=0x766342;
 for(const b of data.buildings){
  if(!['village','oldtown'].includes(b.district))continue;
  const front=b.z+b.d/2,y=b.baseY,colour=b.accent;
  // Rain follows the façade's outside corner, not the centre of a doorway.
  const side=b.seed%2?1:-1,x=b.x+side*(b.w/2-.45);
  kit.rod([x,y+.4,front+.35],[x,y+b.height-.2,front+.35],.065,metal);
  for(let h=1;h<b.height;h+=3.4)kit.box(x,y+h,front+.35,.2,.10,.18,metal);
  if(b.district==='oldtown'){
   const count=Math.floor(b.w/3.4),span=b.w/count;
   for(let floor=1;floor<Math.min(3,b.floors);floor++)for(let bay=0;bay<count;bay++){
    const wx=b.x+(bay+.5)*span-b.w/2,wy=y+floor*3.4+1.9;
    kit.box(wx,wy,front+.115,.07,1.62,.08,0x758477);
    kit.box(wx,wy+.12,front+.115,1.24,.065,.08,0x758477);
    if(!FRONTAGES[b.id]&&b.seed%3===0&&bay%2===0){kit.box(wx,wy-1.12,front+.35,1.8,.3,.7,wood);for(let j=0;j<4;j++)kit.add('rock',wx-.6+j*.4,wy-.91,front+.4,.33,.3,.3,j===1?0x9b7756:0x708451,j);}
   }
  }
  if(b.enterable){
   // Paired brackets carry small lanterns above the clear entrance width.
   for(const sign of [-1,1]){
    const lx=b.x+sign*2.4,lz=front+.8,ly=y+2.5;
    kit.rod([lx,ly+.65,front+.12],[lx,ly+.65,lz],.045,metal);
    kit.rod([lx,ly+.65,lz],[lx,ly+.38,lz],.035,metal);
    kit.box(lx,ly,lz,.26,.5,.25,0xc6b17d,0,6);
    for(const dx of [-.15,.15])for(const dz of [-.15,.15])kit.box(lx+dx,ly,lz+dz,.045,.55,.045,metal);
    kit.add('cone',lx,ly+.34,lz,.27,.22,.27,metal,Math.PI/4);
    kit.box(lx,ly-.3,lz,.38,.07,.38,metal);
   }
   if(b.district==='village'){
    // Knees and rafters make the existing porch read as constructed timber.
    for(const sign of [-1,1])kit.rod([b.x+sign*2,y+1.95,front+1.5],[b.x+sign*1.25,y+2.72,front+1.5],.08,wood);
   }
  }
  // Selected, asymmetrical ivy clings to solid corners below occupied windows.
  if(b.seed%5===0){
   const ix=b.x-side*(b.w/2-.65);for(let j=0;j<10;j++){
    const h=.5+j*.43,xx=ix+Math.sin(j*1.9)*(.25+j*.07);
    kit.rod([ix,y+.2,front+.22],[xx,y+h,front+.25],.025,0x596847);
    kit.add('sphere',xx,y+h,front+.28,.42+(j%3)*.13,.34,.13,j%3?0x647c49:0x85904c,j,null,4);
   }
  }
 }
 // Small grates sit flush with selected gutters; geometry never fills a lane.
 for(let col=0;col<10;col+=2)for(let row=0;row<12;row+=2){const x=392+col*76+6.6,z=-456+row*76+17;kit.box(x,14.065,z,.6,.02,1.1,metal);for(let i=0;i<5;i++)kit.box(x,14.08,z-.4+i*.2,.55,.015,.045,stone);}
}
