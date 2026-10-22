import {furnishCottage} from './home-details.js';
import {domesticProfile} from './domestic-profile.js';
import {cityInteriorPlan} from './city-interiors.js';

function authoredInterior(k,b,y){
 const x=b.x,z=b.z,wood=0x6b5a43,cream=0xd7d1aa,metal=0x425c56;
 const table=(xx,zz,w,d,h=.85)=>{k.box(xx,y+h,zz,w,.15,d,wood);for(const dx of [-w*.4,w*.4])for(const dz of [-d*.35,d*.35])k.box(xx+dx,y+h/2,zz+dz,.12,h,.12,metal);};
 if(b.id==='lightkeeper'){
  table(x-3,z-3,4,1.4);k.box(x-3,y+1.08,z-3,1.1,.32,.75,metal);for(let j=0;j<4;j++)k.add('cylinder',x-3.35+j*.22,y+1.28,z-3,.055,.06,.055,cream);
  for(let i=0;i<3;i++){const xx=x+2+i*.6;k.add('cylinder',xx,y+1,z-4,.17,1.7,.17,0x7f8b68);k.box(xx,y+1.9,z-4,.45,.15,.45,cream);}
  k.box(x+3,y+1.5,z-5.7,4,2,.12,0x525e46);for(let j=0;j<5;j++)k.box(x+1.5+j*.65,y+1.5,z-5.58,.05,1.4,.03,0xc9b486);
  table(x+3,z,2.3,1.1);k.box(x+3,y+.96,z,1.6,.02,.8,0xd4cb9c);k.box(x+3,y+1,z,.12,.035,.7,metal);
  // The keeper lived here as well as tending the beacon. A narrow cot stays
  // against the side wall, clear of the supply/fuse and workshop approaches.
  k.box(x-4.9,y+.35,z+1,1.7,.55,3.1,wood);k.box(x-4.9,y+.70,z+1,1.66,.18,3,cream);
  k.box(x-4.9,y+.84,z+1.3,1.67,.12,2.25,0x7f8b68);k.box(x-4.9,y+.86,z-.08,1.25,.19,.55,cream);
  k.box(x-4.9,y+.80,z-.6,1.8,1.2,.12,wood);
  k.box(x-4.9,y+.4,z+3.45,1.8,.8,.7,wood);k.box(x-4.9,y+.85,z+3.45,1.6,.08,.6,cream);
  return true;
 }
 if(b.id==='clinic'){
  for(const side of [-1,1])for(let j=0;j<3;j++){const xx=x+side*8,zz=z-5+j*4;k.box(xx,y+.66,zz,2.3,.26,3.2,0x7b8b78);k.box(xx,y+.9,zz,2.2,.2,3.1,cream);k.box(xx,y+1.08,zz-1,1.6,.18,.6,0xaab6a0);for(const dx of [-1,1])for(const dz of [-1.3,1.3])k.box(xx+dx,y+.3,zz+dz,.08,.6,.08,metal);k.rod([xx+1.5,y,zz],[xx+1.5,y+2.2,zz],.04,metal);k.box(xx+1.4,y+1.9,zz,.3,.5,.12,0x91a89c);}
  table(x,z-6,4,1.4);k.box(x,y+1.13,z-6,1.3,.45,.8,0xc1c8aa);k.box(x,y+1.37,z-6,.14,.02,.55,0x975c49);k.box(x,y+1.37,z-6,.55,.02,.14,0x975c49);
  for(const side of [-1,1])k.box(x+side*4.5,y+1.2,z-3,.10,2.3,5,0x799686);return true;
 }
 if(b.id==='arrival-house'){
  table(x-3,z-3,4,1.6);for(let i=0;i<4;i++)k.box(x-4+i*.7,y+.96,z-3,.5,.035,.7,i%2?cream:0xa7b295);
  k.box(x,y+1.7,z-6.25,4,2,.12,0x516b5a);k.box(x,y+1.7,z-6.16,3.5,1.5,.025,0xb8b88f);k.box(x,y+1.7,z-6.13,.1,1.2,.02,0x616f57);k.box(x,y+1.7,z-6.13,3,.06,.02,0x616f57);
  for(let i=0;i<3;i++){const xx=x+3.7,zz=z-3+i*2.2;k.box(xx,y+.48,zz,2.6,.2,1.1,wood);for(const dx of [-1,1])k.box(xx+dx,y+.23,zz,.1,.46,.7,metal);k.box(xx,y+.95,zz-.47,2.6,.8,.12,wood);}
  for(let j=0;j<3;j++)k.box(x-5,y+.4+j*.65,z+2,1.6,.55,1.3,j%2?0x788464:0xa59873);return true;
 }
 return false;
}

// Primitive records are shared by the renderer and movement. Small tabletop
// objects never acquire a floor-to-ceiling proxy; solid furniture does.
export function interiorPlan(b){
 if(b.cityInterior)return cityInteriorPlan(b);
 const pieces=[],solids=[],floor=b.baseY+.2;
 const k={box(x,y,z,w,h,d,color,rotation=0){pieces.push({shape:'box',x,y,z,w,h,d,color,rotation});},add(shape,x,y,z,w,h,d,color,rotation=0){pieces.push({shape,x,y,z,w,h,d,color,rotation});},rod(a,c,r,color){pieces.push({shape:'rod',a,c,r,color});},lastRole(role){pieces.at(-1).role=role;}};
 const solid=(name,x,z,w,d,h,bottom=0)=>solids.push({id:b.id+'-'+name,x:b.x+x,z:b.z+z,w,d,y:floor+bottom,h});
 if(authoredInterior(k,b,floor)){
  // Existing landmark furniture remains authored; collision uses its actual
  // visible volumes so the bed aisles and supply approaches stay open.
  for(const p of pieces)if(p.shape==='box'&&((p.h>=.12&&p.w>.45&&p.d>.45)||(p.h>1&&Math.min(p.w,p.d)>.075&&Math.max(p.w,p.d)>1)))solids.push({id:b.id+'-furniture',x:p.x,z:p.z,w:p.w,d:p.d,y:p.y-p.h/2,h:p.h});
  return {pieces,solids,kind:b.id};
 }
 const wood=0x96856a,dark=0x535a4d,metal=0x425c56,linen=0xc1b797,green=domesticProfile(b)?.colour||0x84927b,clay=0xb38a68;
 const box=(x,y,z,w,h,d,c)=>k.box(b.x+x,floor+y,b.z+z,w,h,d,c);
 const table=(name,x,z,w=2.8,d=1.4)=>{box(x,.84,z,w,.15,d,wood);for(const dx of [-w*.4,w*.4])for(const dz of [-d*.35,d*.35])box(x+dx,.4,z+dz,.13,.8,.13,dark);solid(name,x,z,w,d,.92);};
 const shelf=(x,z,w=2.7)=>{
  for(const dx of [-w/2,w/2])box(x+dx,1.13,z,.14,2.26,.65,dark);
  box(x,1.13,z-.31,w,2.20,.045,0x817b60);
  const household=domesticProfile(b);
  for(let j=0;j<3;j++){
   const deck=.3+j*.7;box(x,deck,z,w,.12,.65,wood);
   if(!household){for(let i=0;i<4;i++)box(x-w*.36+i*w*.23,deck+.23,z,.3,.34,.38,(i+j)%2?linen:green);continue;}
   // Broad silhouettes survive the console image: preserve shelf space and
   // explain each household with crockery, folded linen, medicine or tools.
   for(let i=0;i<3;i++){
    const xx=x+(i-1)*w*.28,base=deck+.06,kind=household.kind;
    if(kind==='linen'){
     for(let fold=0;fold<2+(i+j)%2;fold++){
      box(xx,base+.05+fold*.10,z,.48-fold*.025,.09,.43,fold%2?linen:green);k.lastRole('shelf-folded-linen');
      box(xx,base+.092+fold*.10,z+.219,.42-fold*.025,.012,.015,wood);
     }
    }else if(kind==='remedies'){
     const h=.25+((i+j)%3)*.055,r=.10+(j===0?.02:0);
     k.add('cylinder',b.x+xx,floor+base+h/2,b.z+z,r,h,r,(i+j)%2?0x698a7b:0x9c775d);k.lastRole('shelf-apothecary-bottle');
     k.add('cylinder',b.x+xx,floor+base+h+.025,b.z+z,r*.64,.05,r*.64,linen);
     box(xx,base+h*.48,z+r+.006,r*1.25,h*.45,.018,linen);
     if(j===0)box(xx,base+.022,z+.16,.38,.035,.32,linen);
    }else if(kind==='pantry'){
     const r=j===1?.18:.14,h=j===1?.31:.27;
     k.add('cylinder',b.x+xx,floor+base+h/2,b.z+z,r,h,r,j===1?clay:0x748469);k.lastRole('shelf-preserving-crock');
     k.add('cylinder',b.x+xx,floor+base+h+.018,b.z+z,r*1.08,.035,r*1.08,linen);
     box(xx,base+h*.55,z+r,.16,.105,.018,linen);
    }else{
     box(xx,base+.13,z,.48,.25,.42,green);k.lastRole('shelf-workshop-tin');
     box(xx,base+.27,z,.51,.035,.45,metal);box(xx,base+.14,z+.219,.20,.095,.018,linen);
     if(j===0){box(xx,base+.32,z,.30,.06,.065,wood);box(xx+.12,base+.33,z,.08,.09,.22,metal);}
    }
   }
  }
  box(x,2.25,z+.02,w+.18,.12,.73,wood);k.lastRole('shelf-cornice');
  solid('shelf',x,z+.02,w+.18,.73,2.31);
 };
 const bed=(x,z)=>{
  for(const dx of [-.85,.85]){box(x+dx,.41,z,.14,.25,3.05,wood);for(const dz of [-1.32,1.32])box(x+dx,.25,z+dz,.18,.5,.18,dark);}
  for(const dz of [-1.40,1.40])box(x,.41,z+dz,1.78,.25,.13,wood);
  box(x,.52,z,1.78,.08,2.85,dark);box(x,.64,z,1.94,.2,3,linen);
  box(x,.79,z+.2,1.95,.13,2.4,green);box(x,.88,z+.90,1.95,.055,.42,green);
  box(x,.913,z+1.06,1.91,.012,.035,linen);box(x,.83,z-1.08,1.4,.2,.55,linen);
  box(x,.65,z-1.62,2.1,1.1,.13,wood);for(const dx of [-.94,.94])box(x+dx,.63,z-1.62,.17,1.26,.18,dark);
  solid('bed',x,z,2,3.1,.92);solid('bed-headboard',x,z-1.62,2.1,.18,1.26);
 };
 const stove=(x,z)=>{
  box(x,.035,z,1.30,.06,1.22,0x777b69);k.lastRole('stove-hearth');
  for(const dx of [-.33,.33])for(const dz of [-.30,.30])box(x+dx,.14,z+dz,.10,.23,.10,dark);
  box(x,.63,z,.9,.94,.85,dark);box(x,1.12,z,.96,.07,.91,metal);
  box(x,.69,z+.44,.62,.49,.055,metal);box(x,.69,z+.475,.51,.38,.025,0x303f39);
  box(x+.22,.71,z+.50,.045,.05,.10,wood);
  for(const dz of [-.18,.18])box(x-.30,.69+dz,z+.49,.07,.10,.055,dark);
  box(x,.30,z+.45,.47,.075,.04,metal);
  // Seat the flue through the ceiling rather than stopping beneath it.
  box(x,2.06,z-.18,.22,2.04,.22,dark);k.lastRole('stove-flue');
  box(x,3.015,z-.18,.38,.08,.38,metal);k.lastRole('stove-ceiling-collar');
  k.add('cylinder',b.x+x,floor+1.25,b.z+z+.18,.24,.18,.24,clay);
  k.add('cylinder',b.x+x,floor+1.352,b.z+z+.18,.25,.035,.25,metal);k.lastRole('stove-kettle-lid');
  k.add('cylinder',b.x+x,floor+1.39,b.z+z+.18,.055,.055,.055,wood);
  k.rod([b.x+x-.19,floor+1.29,b.z+z+.18],[b.x+x-.16,floor+1.58,b.z+z+.18],.025,metal);
  k.rod([b.x+x-.16,floor+1.58,b.z+z+.18],[b.x+x+.16,floor+1.58,b.z+z+.18],.025,wood);
  k.rod([b.x+x+.16,floor+1.58,b.z+z+.18],[b.x+x+.19,floor+1.29,b.z+z+.18],.025,metal);
  k.rod([b.x+x+.18,floor+1.22,b.z+z+.18],[b.x+x+.35,floor+1.39,b.z+z+.18],.055,clay);k.lastRole('stove-kettle-spout');
  solid('stove',x,z,1,.95,3.06);
 };
 const boat=b.id==='building-7',garden=b.id==='building-8',village=b.district==='village';
 if(village){
  const side=boat||garden?1:b.seed%2?-1:1,bedX=side*(b.w/2-2),back=-b.d/2+2.4;
  bed(bedX,back);shelf(-side*(b.w/2-2),-b.d/2+.8,2.6);
  // Keep the central entry and both original pickup positions clear.
  table('work-table',-side*3,-2.6,boat?3.9:2.8,1.45);stove(b.w/2-1.2,b.d/2-2);
  box(0,.025,1,3.1,.035,3,garden?0x8d956e:0x9c8060);
  table('washstand',-b.w/2+1.4,b.d/2-2.5,1.65,.85);
  const washX=-b.w/2+1.4,washZ=b.d/2-2.5;
  k.add('basin',b.x+washX,floor+1.03,b.z+washZ,.48,.23,.32,linen);k.lastRole('wash-basin');
  k.add('cylinder',b.x+washX,floor+.982,b.z+washZ,.295,.008,.195,0x81968b);k.lastRole('wash-basin-bottom');
  box(washX+.59,.938,washZ+.28,.28,.035,.34,green);
  box(washX+.59,.825,washZ+.44,.28,.22,.025,green);k.lastRole('hanging-washcloth');
  box(washX+.59,.746,washZ+.457,.27,.025,.010,linen);
  if(boat){
   box(1.2,1.28,-b.d/2+2.5,.16,2.56,4.7,0xa8a488);solid('sleeping-partition',1.2,-b.d/2+2.5,.16,4.7,2.56);
   box(-3,.95,-2.6,3.6,.035,1.35,linen);
   // Open hull ribs and continuous gunwales read as boat repair from the
   // doorway. Replace the old solid lump; keep the same worktable footprint.
   const frames=[[-1.18,.035,.22],[-.78,.33,.35],[0,.46,.39],[.78,.33,.35],[1.18,.035,.22]];
   for(const [xx,half,h]of frames)for(const side of [-1,1]){
    k.rod([b.x-3+xx,floor+1.01,b.z-2.6],[b.x-3+xx,floor+1.01+h,b.z-2.6+side*half],.033,dark);k.lastRole('boatwright-hull-rib');
   }
   k.rod([b.x-4.18,floor+1.01,b.z-2.6],[b.x-1.82,floor+1.01,b.z-2.6],.045,wood);
   for(let i=0;i<frames.length-1;i++)for(const side of [-1,1])for(const level of [.56,1]){
    const a=frames[i],c=frames[i+1];k.rod([b.x-3+a[0],floor+1.01+a[2]*level,b.z-2.6+side*a[1]*level],[b.x-3+c[0],floor+1.01+c[2]*level,b.z-2.6+side*c[1]*level],level===1?.05:.035,wood);k.lastRole('boatwright-gunwale');
   }
   for(let i=0;i<3;i++)box(-b.w/2+.65,.7+i*.35,0,.18,.19,3.3,wood);
   solid('timber-rack',-b.w/2+.65,0,.5,3.5,1.6);
   box(-3.9,1.07,-2.9,.6,.13,.15,clay);
  }else if(garden){
   box(1.3,1.2,-b.d/2+2.4,.12,2.4,4.3,0xa6b09a);solid('sleeping-screen',1.3,-b.d/2+2.4,.12,4.3,2.4);
   box(-3,.95,-2.6,2.65,.035,1.3,0xb3a17d);
   for(let i=0;i<3;i++){k.add('cylinder',b.x-3.75+i*.6,floor+1.08,b.z-2.6,.22,.35,.22,i===1?green:clay);box(-3.75+i*.6,1.28,-2.6,.23,.05,.23,linen);}
   box(-2.2,1,-2.6,.4,.08,.6,linen);box(b.w/2-2,.35,1,1.4,.7,1,wood);solid('harvest-crate',b.w/2-2,1,1.4,1,.7);
   for(let i=0;i<5;i++)k.add('rock',b.x+b.w/2-2+(i%3-.9)*.3,floor+.8,b.z+.8+Math.floor(i/3)*.3,.26,.22,.26,green);
  }
  furnishCottage(k,b,floor,solid,{side,workX:-side*3,special:boat||garden});
 }else{
  const kind=b.id==='building-54'?'bookshop':b.id==='building-78'?'networkshop':b.id==='building-87'?'chandlery':b.seed%2?'storeroom':'shop';
  table('counter',-4,3,5,1.4);box(-5.2,1.08,3,.6,.4,.6,dark);
  for(const side of [-1,1])for(let row=0;row<Math.max(2,Math.floor(b.d/8));row++)shelf(side*(b.w/2-1),-b.d/2+2.5+row*5.5,1.4);
  if(kind==='bookshop'){
   table('reading-table',3,-3,3,1.6);for(let j=0;j<3;j++)box(2.1+j*.65,1.02,-3,.46,.16,.65,j%2?clay:green);
   const zz=b.d/2-5.5;solid('browsing-island',4,zz,1.5,4.1,1.85);
   box(4,.9,zz,.15,1.8,4,dark);for(const dz of [-2,2])box(4,.9,zz+dz,1.5,1.8,.14,wood);
   for(let row=0;row<3;row++){box(4,.3+row*.57,zz,1.5,.12,4,wood);for(const side of [-1,1])for(let j=0;j<6;j++)box(4+side*.48,.54+row*.57,zz-1.65+j*.63,.46,.38,.37,[0x8a5f4b,0xa9ab80,0x688b83,0xb69d70][(j+row)%4]);}
   box(4,1.84,zz,1.6,.12,4.1,linen);
  }
  else {
   const packingZ=kind==='chandlery'?8:-4;
   table('packing-table',3,packingZ,3.8,1.6);
   if(kind==='chandlery'){
    box(3,.94,packingZ,3.1,.035,1.35,linen);k.lastRole('chandlery-sailcloth');
    for(const xx of [2.05,4.02])for(let strand=0;strand<3;strand++)for(let j=0;j<12;j++){
     const r=.22+strand*.045,a=j*Math.PI/6,c=(j+1)*Math.PI/6;
     k.rod([b.x+xx+Math.cos(a)*r,floor+.99,b.z+packingZ+Math.sin(a)*r],[b.x+xx+Math.cos(c)*r,floor+.99,b.z+packingZ+Math.sin(c)*r],.022,clay);k.lastRole('chandlery-rope');
    }
    box(3.1,.99,packingZ,.62,.08,.83,green);box(3.1,1.04,packingZ,.54,.025,.76,linen);k.lastRole('chandlery-manifest');
    const displayZ=b.d/2-7.5;
    box(-3.2,.14,displayZ,3.4,.28,2.1,wood);solid('sail-display',-3.2,displayZ,3.4,2.1,1.35);
    for(const dx of [-1,0,1]){box(-3.2+dx,.43,displayZ+.38,.84,.32,1.05,linen);box(-3.2+dx,.61,displayZ+.38,.65,.035,.98,dark);}
    for(const dx of [-1.35,1.35])box(-3.2+dx,.78,displayZ-.7,.10,1.2,.10,dark);
    box(-3.2,1.32,displayZ-.7,2.8,.12,.12,wood);box(-3.2,.94,displayZ-.7,2.5,.64,.08,linen);k.lastRole('chandlery-sail-display');
    k.add('cylinder',b.x-3.3,floor+1.01,b.z+3,.21,.08,.21,0xb5a46f);k.lastRole('chandlery-compass');
    k.rod([b.x-3.42,floor+1.06,b.z+3],[b.x-3.18,floor+1.06,b.z+3],.014,dark);
   }else for(let j=0;j<3;j++)box(2+j*.8,1.12,-4,.55,.4,.7,j%2?green:clay);
  }
 }
 return {pieces,solids,kind:boat?'boatwright-house':garden?'garden-house':village?'home':b.id==='building-87'?'chandlery':'shop'};
}

export function buildInterior(kit,b){for(const p of interiorPlan(b).pieces){if(p.shape==='rod')kit.rod(p.a,p.c,p.r,p.color);else kit.add(p.shape,p.x,p.y,p.z,p.w,p.h,p.d,p.color,p.rotation||0);}}

