import {cityIdentity} from './city-identity.js';
const cache=new WeakMap();
// Two small, usable frontage pockets; the central six metres stay open.
export function cityForecourtPlan(b,ground){
 if(!b.cityInterior)return {pieces:[],solids:[]};
 if(cache.has(b))return cache.get(b);
 const pieces=[],solids=[],identity=cityIdentity(b),front=b.entry.z,wood=0x827052,metal=0x4c6458,cream=0xc3bb96;
 const box=(role,x,y,z,w,h,d,color,solid=false,floor=ground(x,z))=>{pieces.push({shape:'box',role,x,y:floor+y,z,w,h,d,color});if(solid)solids.push({id:b.id+'-forecourt-'+role,x,z,w,d,y:floor+y-h/2,h});};
 const businessFrontage=(x,z)=>{
  if(!['press','radio','shipping','studio'].includes(identity.id))return false;
  // One footing keeps stacked details supported. The noticecase stays behind
  // these compact silhouettes, with room between its posts and each prop.
  const floor=ground(x,z),part=(role,dx,y,dz,w,h,d,color,solid=false)=>box(role,x+dx,y,z+dz,w,h,d,color,solid,floor);
  if(identity.id==='press'){
   part('press-rack-foot',0,.08,0,1.82,.10,.88,metal,true);
   part('press-rack-back',0,.82,-.31,1.62,1.48,.09,metal,true);
   for(const [i,dx] of [-.77,.77].entries())part('press-rack-upright-'+i,dx,.80,0,.09,1.44,.72,metal,true);
   for(let row=0;row<3;row++){
    const y=.32+row*.41;
    part('press-rack-shelf-'+row,0,y,0,1.66,.10,.72,wood,true);
    for(let col=0;col<2;col++){
     const dx=(col-.5)*.76;
     part('press-paper-stack-'+row+'-'+col,dx,y+.14,.02,.66,.18,.54,cream,true);
     part('press-paper-headline-'+row+'-'+col,dx,y+.17,.296,.46,.06,.012,identity.colour);
     part('press-paper-column-'+row+'-'+col,dx-.13,y+.105,.296,.19,.035,.012,identity.colour);
    }
   }
   part('press-rack-header',0,1.56,-.31,1.82,.22,.14,identity.colour,true);
   part('press-rack-header-rule',0,1.56,-.233,1.48,.035,.014,cream);
  }else if(identity.id==='radio'){
   part('radio-cabinet-foot',0,.09,0,1.22,.12,.88,metal,true);
   part('radio-service-cabinet',0,.67,0,1.05,1.04,.72,identity.colour,true);
   part('radio-cabinet-cap',0,1.23,0,1.18,.08,.82,metal,true);
   part('radio-service-door',0,.70,.372,.85,.82,.024,metal);
   part('radio-door-seam',.16,.70,.39,.018,.74,.012,cream);
   part('radio-door-latch',.26,.64,.408,.045,.16,.028,cream);
   for(let row=0;row<3;row++)part('radio-cabinet-vent-'+row,-.19,.86-row*.11,.39,.34,.035,.014,0x263e32);
   part('radio-antenna-mast',-.37,1.88,0,.08,1.22,.08,metal,true);
   part('radio-antenna-collar',-.37,1.31,0,.24,.12,.24,cream);
   part('radio-mast-bracket',-.37,1.49,-.07,.28,.07,.18,metal);
   part('radio-antenna-lower',-.37,1.92,0,1.05,.055,.055,metal,true);
   part('radio-antenna-upper',-.37,2.32,0,.65,.055,.055,metal,true);
  }else if(identity.id==='shipping'){
   part('shipping-cart-axle',0,.21,0,1.62,.07,.08,metal,true);
   for(const [i,dx] of [-.77,.77].entries()){
    const role='shipping-cart-wheel-'+i;
    pieces.push({shape:'dial',role,x:x+dx,y:floor+.21,z,w:.18,h:.18,d:.13,color:metal,rotation:Math.PI/2});
    solids.push({id:b.id+'-forecourt-'+role,x:x+dx,z,w:.13,d:.36,y:floor+.03,h:.36});
    pieces.push({shape:'dial',role:role+'-hub',x:x+dx+(dx<0?-.071:.071),y:floor+.21,z,w:.07,h:.07,d:.02,color:cream,rotation:Math.PI/2});
   }
   part('shipping-cart-deck',0,.43,0,1.45,.12,1.02,wood,true);
   for(const [i,dx] of [-.58,.58].entries())part('shipping-cart-handle-post-'+i,dx,.98,-.47,.07,1.18,.07,metal,true);
   part('shipping-cart-handle',0,1.57,-.47,1.23,.08,.10,metal,true);
   part('shipping-parcel-large',-.27,.77,.10,.82,.56,.77,wood,true);
   part('shipping-parcel-small',.42,.67,.10,.49,.36,.64,identity.colour,true);
   part('shipping-parcel-upper',-.32,1.22,.10,.64,.34,.62,cream,true);
   part('shipping-large-address',-.27,.81,.492,.35,.18,.014,cream);
   part('shipping-upper-address',-.32,1.23,.417,.26,.12,.014,identity.colour);
   part('shipping-parcel-binding',-.32,1.395,.10,.045,.012,.62,metal);
   part('shipping-manifest-board',.42,.875,.12,.40,.05,.53,wood);
   part('shipping-manifest-paper',.42,.908,.12,.32,.016,.43,cream);
   part('shipping-manifest-clip',.42,.924,-.03,.14,.016,.07,metal);
  }else{
   part('studio-plinth-foot',0,.11,0,1.68,.16,1.14,metal,true);
   part('studio-display-plinth',0,.56,0,1.28,.74,.80,identity.colour,true);
   part('studio-plinth-cap',0,.98,0,1.66,.10,1.06,cream,true);
   part('studio-model-base',0,1.065,0,1.42,.07,.86,wood,true);
   part('studio-model-podium',-.22,1.23,0,.84,.26,.55,cream,true);
   part('studio-model-tower',-.35,1.55,-.04,.40,.38,.36,cream,true);
   part('studio-model-wing',.38,1.21,0,.40,.22,.55,cream,true);
   part('studio-model-roof',-.35,1.77,-.04,.47,.06,.43,metal,true);
   part('studio-plinth-plaque',0,.70,.414,.78,.24,.028,cream);
   part('studio-plaque-rule',0,.70,.435,.56,.025,.014,identity.colour);
   for(let col=0;col<3;col++)part('studio-model-window-'+col,-.49+col*.27,1.25,.283,.12,.08,.016,metal);
  }
  return true;
 };
 for(const side of [-1,1]){
  const x=b.x+side*(b.w/2-3.3),z=front+2.7;
  box('forecourt-paving',x,.015,z,4.2,.025,2.5,0xa3ac92);
  if(side===-1&&businessFrontage(x,z+.3))continue;
  if(side===-1&&b.id==='hospital-main'){
   // A parked triage trolley occupies only the left paving pocket. Its
   // undercarriage shares one ground height and stays ahead of the noticecase.
   const tz=z+.3,floor=ground(x,tz),linen=0xcac4a5,rubber=0x344940;
   const part=(role,dx,y,dz,w,h,d,color,solid=false)=>box('triage-'+role,x+dx,y,tz+dz,w,h,d,color,solid,floor);
   part('lower-shelf',0,.41,0,1.76,.06,.56,metal,true);
   for(const [i,dx] of [-.84,.84].entries()){
    part('axle-'+i,dx,.23,0,.08,.08,.72,metal,true);
    for(const [j,dz] of [-.32,.32].entries()){
     part('support-'+i+'-'+j,dx,.55,dz,.09,.48,.09,metal,true);
     const role='triage-wheel-'+i+'-'+j;
     pieces.push({shape:'dial',role,x:x+dx,y:floor+.17,z:tz+dz,w:.14,h:.14,d:.09,color:rubber});
     pieces.push({shape:'dial',role:role+'-hub',x:x+dx,y:floor+.17,z:tz+dz+(dz<0?-.051:.051),w:.065,h:.065,d:.018,color:cream});
     solids.push({id:b.id+'-forecourt-'+role,x:x+dx,z:tz+dz,w:.28,d:.09,y:floor+.03,h:.28});
    }
   }
   part('frame',0,.79,0,2.24,.10,.84,metal,true);
   part('mattress',0,.90,0,2.10,.12,.73,identity.colour,true);
   for(const [i,dx] of [-1.18,1.18].entries())part('end-handle-'+i,dx,.80,0,.16,.08,.76,metal,true);
   for(const [i,dz] of [-.43,.43].entries()){
    for(const [j,dx] of [-.68,.68].entries())part('rail-post-'+i+'-'+j,dx,.94,dz,.055,.20,.055,metal,true);
    part('side-rail-'+i,0,1.04,dz,1.48,.06,.06,metal,true);
   }
   part('folded-linen',-.58,1.04,0,.62,.16,.60,linen,true);
   part('linen-fold',-.58,1.125,.23,.62,.03,.10,cream);
   part('medical-tin',.42,.57,0,.55,.26,.40,metal,true);
   part('medical-tin-lid',.42,.72,0,.59,.04,.44,cream,true);
   part('medical-cross-horizontal',.42,.58,.207,.24,.055,.014,linen);
   part('medical-cross-vertical',.42,.58,.215,.055,.17,.014,linen);
  }else if(side===-1&&b.district!=='industrial'){
   box('bench-seat',x,.52,z,2.55,.14,.64,wood,true);
   box('bench-back',x,.94,z-.29,2.55,.77,.12,wood,true);
   for(const dx of [-.94,.94])box('bench-leg',x+dx,.23,z,.15,.46,.55,metal,true);
   for(const dx of [-1.17,1.17])box('bench-arm',x+dx,.76,z,.09,.34,.64,metal);
   // A folded newspaper or a forgotten parcel belongs to the bench.
   box('bench-left-behind',x+.76,.625,z,.50,.07,.42,identity.id==='press'?cream:identity.colour);
  }else{
   box('raised-planter',x,.31,z,1.35,.62,1.15,wood,true);
   box('planter-earth',x,.64,z,1.18,.045,.98,0x666449);
   for(let i=0;i<3;i++)pieces.push({shape:'sphere',role:'forecourt-leaves',x:x+(i-1)*.35,y:ground(x,z)+.98+(i%2)*.20,z,w:.56,h:.54,d:.49,color:[0x627d4e,0x839152,0x74854e][i],rotation:i*2.4});
  }
  if(side===1){
   const xx=x+1.40;
   box('refuse-bin',xx,.46,z,.67,.92,.67,metal,true);box('bin-lid',xx,.96,z,.75,.08,.75,cream);
   box('bin-slot',xx,.78,z+.345,.40,.14,.025,0x263e32);
  }
 }
 // The timetable has its own frame behind the bench, clear of real windows.
 const nx=b.x-b.w/2+3.3,nz=front+1.9;
 for(const dx of [-.98,.98])box('noticecase-post',nx+dx,.91,nz,.08,1.82,.08,metal,true);
 box('noticecase-frame',nx,1.65,nz,2.4,.56,.10,metal,true);
 pieces.push({shape:'label',x:nx,y:ground(nx,nz)+1.65,z:nz+.056,w:2.3,h:.44,text:identity.notice,subline:identity.detail,colour:identity.colour});
 const plan={pieces,solids};cache.set(b,plan);return plan;
}

// Street trees belong to the same world description as island trees. Reserve
// the full crown against buildings; the old corner grid clipped new lobbies.
export function cityStreetTreePlan(buildings,ground){
 const trees=[],radius=3.5;
 for(let col=0;col<10;col++)for(let row=0;row<12;row++){
  if((col+row)%2!==0)continue;
  const x=392+col*76,z=-456+row*76;
  if(Math.abs(x-734)<72&&Math.abs(z)<90)continue;
  const candidates=[[x+9.2,z+9.2],[x+9.2,z-9.2],[x-9.2,z+9.2],[x-9.2,z-9.2]];
  const p=candidates.find(([xx,zz])=>buildings.every(b=>Math.abs(xx-b.x)>=b.w/2+radius||Math.abs(zz-b.z)>=b.d/2+radius)&&buildings.every(b=>!b.enterable||Math.abs(xx-b.entry.x)>b.entry.width/2+1||zz<b.entry.z-1||zz>b.entry.z+b.entry.length+2));
  if(p)trees.push({x:p[0],z:p[1],y:ground(...p),scale:.62,kind:'broad',rotation:0,urban:true});
 }
 return trees;
}
