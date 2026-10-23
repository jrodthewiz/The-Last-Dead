// Furnished street levels share one inspectable plan with movement and bullets.
// The three-metre centre aisle and the front cross aisle remain clear.
import {cityIdentity} from './city-identity.js';
import {businessLayout} from './business-layouts.js';
import {residentialActivity} from './interior-character.js';
import {homeTableActivity} from './interior-occupancy.js';
const plans=new WeakMap();
export function cityInteriorPlan(b){
 if(plans.has(b))return plans.get(b);
 const pieces=[],solids=[],floor=b.baseY+.2,identity=cityIdentity(b),roomHeight=b.interiorHeight||3.4;
 const palette={wood:0x88795e,edge:0x4c5b51,cream:0xc9c4a0,cloth:0x879582,metal:0x496762,paper:0xd5caa6};
 const box=(role,x,y,z,w,h,d,color=palette.wood,solid=false)=>{
  pieces.push({shape:'box',role,x:b.x+x,y:floor+y,z:b.z+z,w,h,d,color,rotation:0});
  if(solid)solids.push({id:b.id+'-'+role,x:b.x+x,z:b.z+z,w,d,y:floor+y-h/2,h});
 };
 const cylinder=(role,x,y,z,r,h,color,solid=false)=>{pieces.push({shape:'cylinder',role,x:b.x+x,y:floor+y,z:b.z+z,w:r,h,d:r,color,rotation:0});if(solid)solids.push({id:b.id+'-'+role,x:b.x+x,z:b.z+z,w:r*2,d:r*2,y:floor+y-h/2,h});};
 const cone=(role,x,y,z,w,h,d,color,rotation=0)=>pieces.push({shape:'cone',role,x:b.x+x,y:floor+y,z:b.z+z,w,h,d,color,rotation});
 const disc=(role,x,y,z,r,depth,color)=>pieces.push({shape:'dial',role,x:b.x+x,y:floor+y,z:b.z+z,w:r,h:r,d:depth,color,rotation:0});
 const label=(text,subline,x,y,z,w,h,rotation=0)=>pieces.push({shape:'label',x:b.x+x,y:floor+y,z:b.z+z,w,h,text,subline,colour:identity.colour,rotation});
 const desk=(x,z,w=2.4,d=1.2,dressed=true)=>{
  box('desk-top',x,.82,z,w,.14,d,palette.wood,true);
  for(const dx of [-w*.4,w*.4])box('desk-pedestal',x+dx,.39,z,.32,.72,d*.8,palette.edge,true);
  if(dressed){box('desk-paper',x-.42,.907,z+.12,.62,.025,.43,palette.paper);box('desk-ledger',x+.58,.94,z-.09,.44,.09,.61,b.accent);}
 };
 const chair=(x,z,back=1)=>{
  box('chair-seat',x,.48,z,.72,.12,.70,palette.cloth,true);
  box('chair-back',x,.89,z+back*.31,.72,.72,.12,palette.cloth,true);
  for(const dx of [-.28,.28])for(const dz of [-.25,.25])box('chair-leg',x+dx,.23,z+dz,.07,.46,.07,palette.edge);
 };
 const shelves=(x,z,w=2.4)=>{
  box('shelf-frame',x,1.12,z,w,2.24,.60,palette.edge,true);
  for(let row=0;row<3;row++){
   box('shelf-board',x,.30+row*.68,z+.035,w+.06,.10,.70,palette.wood);
   for(let col=0;col<4;col++){
    const xx=x-w*.35+col*w*.23,y=.54+row*.68;
    box('archive-box',xx,y,z+.37,.35,.36,.30,(row+col+b.seed)%2?palette.paper:palette.cloth);
    box('archive-label',xx,y,z+.528,.16,.065,.018,palette.paper);
   }
  }
 };
 const plant=(x,z)=>{
  cylinder('planter-pot',x,.30,z,.36,.60,0x9b8060);
  for(let i=0;i<3;i++)pieces.push({shape:'cone',role:'indoor-plant',x:b.x+x+Math.cos(i*2.4)*.16,y:floor+.90+i*.10,z:b.z+z+Math.sin(i*2.4)*.16,w:.43,h:.80,d:.38,color:0x667e58,rotation:i*2.4});
 };
 const lx=-b.w/2+2.4,rx=b.w/2-2.4,back=-b.d/2,front=b.d/2;
 const kind=b.id==='hospital-main'?'hospital':b.district==='downtown'?'tower-lobby':b.district==='industrial'?'workshop':b.district==='civic'?'apartments':b.seed%2?'cafe':'office';
 const business=kind==='tower-lobby'||kind==='office'||kind==='cafe';
 box('entry-mat',0,.016,front-1.1,2.6,.025,1.4,0x6d7761);
 // Businesses use a short entry runner and local work-area floor treatments.
 // Their clear central travel spine no longer reads as the same hotel lobby.
 if(business)box('business-entry-runner',0,.018,front-3.5,2.5,.028,3,0x788979);
 else box('aisle-runner',0,.018,0,2.5,.028,b.d-5,kind==='workshop'?0x8e8b6e:0x788979);
 for(const side of [-1,1]){
  box('wall-dado',side*(b.w/2-.23),.60,0,.045,1.20,b.d-.45,0xa5aa90);
  box('wall-skirting',side*(b.w/2-.26),.10,0,.08,.20,b.d-.5,palette.edge);
 }
 for(let z=back+3;z<front-3;z+=6){
  const height=roomHeight>3.4?4.25:2.96;
  box('ceiling-light-frame',0,height,z,1.4,.10,.65,palette.edge);
  box('ceiling-light-diffuser',0,height-.06,z,1.23,.035,.49,palette.paper);
  box('ceiling-cross-member',0,roomHeight-.41,z+2,b.w-.45,.15,.12,0xa9ad93);
  if(roomHeight>3.4)box('pendant-suspension',0,(height+roomHeight-.42)/2,z,.055,roomHeight-.42-height,.055,palette.edge);
 }
 if(roomHeight>3.4){
  for(const side of [-1,1]){
   box('clerestory-band',side*(b.w/2-.28),3.19,0,.12,.24,b.d-.5,palette.cream);
   for(const z of [-b.d/4,b.d/4])box('lobby-pilaster',side*(b.w/2-.43),roomHeight/2-.1,z,.42,roomHeight-.2,.55,0xb6b69a,true);
  }
  const brandX=(['bank','shipping'].includes(identity.id)?1:-1)*b.w/4;
  box('business-name-board',brandX,3.76,back+.26,6.1,.90,.10,palette.edge);
  label(identity.name,identity.room,brandX,3.76,back+.316,6,.86);
 }
 if(business){
  businessLayout({box,cylinder,disc,label,desk,chair,shelves,plant,palette},b,identity,{back,front,lx,rx});
  if(kind==='tower-lobby'){
  const liftZ=back+.28;
  box('lift-bank-stone',0,1.45,liftZ,5.4,2.9,.16,palette.edge,true);
  for(const side of [-1,1]){
   box('closed-lift-door',side*1.12,1.33,liftZ+.10,2.1,2.6,.08,0x788b80);
   box('lift-door-seam',side*1.12,1.33,liftZ+.15,.025,2.5,.015,palette.edge);
   box('lift-transom',side*1.12,2.76,liftZ+.14,.8,.18,.025,palette.paper);
  }
  box('lift-call-panel',0,1.32,liftZ+.15,.22,.42,.04,palette.wood);
  }
 }else if(kind==='apartments'){
  for(const side of [-1,1]){
   const cx=side*(b.w/4+1.2),roomW=b.w/2-3.8;
   // Separate living and sleeping zones, with a real 1.6 m room opening.
   const openings=[back+8,2,front-7].sort((a,c)=>a-c),start=back+.5,end=front-4;
   let cursor=start;
   for(const z of openings){
    if(z-1>cursor)box('room-divider',side*2.2,1.32,(cursor+z-1)/2,.12,2.64,z-1-cursor,0xaaa98b,true);
    box('flat-door-lintel',side*2.2,2.50,z,.17,.28,2,palette.edge,true);cursor=z+1;
   }
   if(cursor<end)box('room-divider',side*2.2,1.32,(cursor+end)/2,.12,2.64,end-cursor,0xaaa98b,true);
   const gapZ=front-7;
   box('flat-door-jamb',side*2.2,1.32,gapZ-1.1,.16,2.64,.18,palette.edge,true);
   box('living-rug',cx,.022,3,roomW-.7,.035,3.5,b.accent);
   if(side<0&&['gardener','photographer'].includes(identity.id))residentialActivity({box,cylinder,cone,disc,label,palette},identity,cx,2.2,roomW);
   else{box('sofa-base',cx,.44,2.2,Math.min(3,roomW-.4),.70,.95,palette.cloth,true);box('sofa-back',cx,.91,1.8,Math.min(3,roomW-.4),.95,.22,palette.edge,true);}
   desk(cx,5,Math.min(2.3,roomW-.4),1.1,false);
   homeTableActivity({box,cylinder,palette},identity,cx,5,side);
   chair(cx-.65,6.2);
   if(identity.id==='family'&&side<0)chair(cx+.65,6.2);
   const bedZ=back+4;
   box('bed-frame',cx,.35,bedZ,2.0,.6,3.2,palette.wood,true);
   box('bed-mattress',cx,.72,bedZ,1.92,.20,3.1,palette.paper);
   box('bed-blanket',cx,.86,bedZ+.35,1.94,.12,2.3,b.accent);
   box('bed-pillow',cx,.90,bedZ-1.05,1.4,.22,.55,palette.paper);
   shelves(side*(b.w/2-.9),back+9,1.0);
   box('bedside-cabinet',cx+side*1.6,.40,bedZ+.3,.65,.80,.70,palette.wood,true);
   cylinder('bedside-lamp',cx+side*1.6,1.0,bedZ+.3,.18,.32,palette.paper);
   const photoX=cx+side*1.6,photoZ=bedZ+.64;
   box('family-photo-frame',photoX,1.08,photoZ,.48,.42,.065,palette.edge);
   box('family-photo-stand',photoX,.84,photoZ-.015,.28,.08,.12,palette.edge);
   box('family-photo-paper',photoX,1.08,photoZ+.039,.39,.33,.012,palette.paper);
   if(identity.id==='photographer'){
    box('bedside-coast-sea',photoX,1.025,photoZ+.049,.34,.14,.008,0x829c91);
    box('bedside-coast-island',photoX-.04,1.105,photoZ+.05,.20,.085,.008,0x7d8e67);
   }else for(const dx of [-.09,.09]){box('family-photo-head',photoX+dx,1.13,photoZ+.049,.07,.08,.008,identity.colour);box('family-photo-figure',photoX+dx,1.02,photoZ+.05,.105,.15,.008,identity.colour);}
   box('flat-wall-picture',side*(b.w/2-.25),1.8,4,.06,.82,1.10,palette.edge);
   box('flat-picture-print',side*(b.w/2-.29),1.8,4,.025,.66,.92,0xa4ae8f);
   box('kitchen-unit',cx,.49,back+.8,Math.min(3.6,roomW),.98,1.0,palette.wood,true);
   box('kitchen-top',cx,1.02,back+.8,Math.min(3.7,roomW+.1),.10,1.10,palette.paper);
   cylinder('cooking-pot',cx-.4,1.16,back+.8,.23,.22,palette.edge);
   if(identity.id==='photographer'){
    box('camera-body',cx+.65,1.18,back+.8,.53,.28,.26,palette.edge);disc('camera-lens',cx+.65,1.18,back+.98,.115,.18,palette.metal);
    for(let i=0;i<3;i++)box('photo-prints',cx+.65+i*.10,1.08+i*.015,back+1.2,.37,.015,.26,palette.paper);
   }else if(identity.id==='gardener'){
    box('seed-tray',cx+.65,1.11,back+.8,.86,.10,.53,palette.wood);
    for(let i=0;i<3;i++){cylinder('seedling-pot',cx+.39+i*.26,1.21,back+.8,.09,.16,palette.edge);box('seedling-leaf',cx+.39+i*.26,1.35,back+.8,.16,.18,.035,0x728a52);}
   }else{
    box('family-breakfast-tray',cx+.65,1.105,back+.8,.80,.06,.56,palette.wood);for(const dx of [-.22,.22])cylinder('family-breakfast-mug',cx+.65+dx,1.23,back+.8,.09,.20,palette.paper);
   }
   label(identity.notice,identity.detail,side*2.29,1.8,-.2,1.7,.34,side*Math.PI/2);
   plant(side*(b.w/2-1.2),front-5);
  }
 }else if(kind==='hospital'){
  for(const side of [-1,1])for(let row=0;row<4;row++){
   const x=side*(b.w*.28),z=back+4+row*5;
   box('ward-bed',x,.57,z,2.4,.32,3.2,palette.metal,true);
   box('ward-mattress',x,.80,z,2.3,.18,3.1,palette.paper);
   box('ward-sheet',x,.92,z+.3,2.31,.10,2.4,palette.cloth);
   box('ward-pillow',x,1,z-1.1,1.6,.18,.5,palette.paper);
   box('ward-locker',x+2,.59,z,1.0,1.18,1.0,palette.metal,true);
   box('ward-screen',x+3.2,1.20,z,.10,2.40,3.7,0x94a395,true);
  }
  desk(-6,front-6,6,1.5);shelves(7,back+1,5);
 }else if(kind==='workshop'){
  for(const side of [-1,1]){
   const x=side*(b.w/2-2.8);
   for(let row=0;row<3;row++){
    const z=back+4+row*6;
    box('pallet',x,.12,z,3.2,.24,2.5,palette.edge,true);
    for(let i=0;i<3;i++)box('freight-crate',x+(i%2-.5)*1.4,.67+Math.floor(i/2)*.95,z,1.3,.95,2.0,i%2?palette.wood:palette.cloth,true);
    for(const dx of [-.5,.5])box('crate-strap',x+dx,.68,z+1.01,.08,.91,.025,palette.paper);
   }
  }
  desk(lx+1,front-6,4,1.5);box('bench-toolbox',lx+.5,1.04,front-6,.85,.28,.48,palette.metal);
  cylinder('workshop-drum',rx,.58,front-6,.48,1.16,palette.metal);
  cylinder('drum-rim',rx,1.17,front-6,.49,.05,palette.edge);
 }
 let stashAnchor=null;
 if(b.seed%4===0){
  const x=3,z=front-2;
  box('supplies-bench-top',x,.65,z,1.8,.10,1,palette.wood,true);
  for(const dx of [-.72,.72])box('supplies-bench-leg',x+dx,.30,z,.12,.60,.82,palette.edge,true);
  for(const dx of [-.75,.75])box('supplies-board-upright',x+dx,.76,z-.85,.07,1.52,.08,palette.edge,true);
  box('supplies-board',x,1.54,z-.85,1.8,.34,.08,palette.edge,true);
  label('FOR THE NEXT SHIFT','TAKE WHAT YOU NEED',x,1.54,z-.802,1.65,.30);
  stashAnchor={x:b.x+x,z:b.z+z,y:floor+.70};
 }
 const plan={pieces,solids,kind,identity:identity.id,stashAnchor};plans.set(b,plan);return plan;
}
