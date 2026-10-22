// Furnished street levels share one inspectable plan with movement and bullets.
// The three-metre centre aisle and the front four metres remain clear.
const plans=new WeakMap();
export function cityInteriorPlan(b){
 if(plans.has(b))return plans.get(b);
 const pieces=[],solids=[],floor=b.baseY+.2;
 const palette={wood:0x88795e,edge:0x4c5b51,cream:0xc9c4a0,cloth:0x879582,metal:0x496762,paper:0xd5caa6};
 const box=(role,x,y,z,w,h,d,color=palette.wood,solid=false)=>{
  pieces.push({shape:'box',role,x:b.x+x,y:floor+y,z:b.z+z,w,h,d,color,rotation:0});
  if(solid)solids.push({id:b.id+'-'+role,x:b.x+x,z:b.z+z,w,d,y:floor+y-h/2,h});
 };
 const cylinder=(role,x,y,z,r,h,color)=>pieces.push({shape:'cylinder',role,x:b.x+x,y:floor+y,z:b.z+z,w:r,h,d:r,color,rotation:0});
 const desk=(x,z,w=2.4,d=1.2)=>{
  box('desk-top',x,.82,z,w,.14,d,palette.wood,true);
  for(const dx of [-w*.4,w*.4])box('desk-pedestal',x+dx,.39,z,.32,.72,d*.8,palette.edge,true);
  box('desk-paper',x-.42,.907,z+.12,.62,.025,.43,palette.paper);
  box('desk-ledger',x+.58,.94,z-.09,.44,.09,.61,b.accent);
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
 box('entry-mat',0,.016,front-1.1,2.6,.025,1.4,0x6d7761);
 // A broad runner, ceiling panels and a dado establish a complete room.
 box('aisle-runner',0,.018,0,2.5,.028,b.d-5,kind==='workshop'?0x8e8b6e:0x788979);
 for(const side of [-1,1]){
  box('wall-dado',side*(b.w/2-.23),.60,0,.045,1.20,b.d-.45,0xa5aa90);
  box('wall-skirting',side*(b.w/2-.26),.10,0,.08,.20,b.d-.5,palette.edge);
 }
 for(let z=back+3;z<front-3;z+=6){
  box('ceiling-light-frame',0,2.96,z,1.4,.10,.65,palette.edge);
  box('ceiling-light-diffuser',0,2.90,z,1.23,.035,.49,palette.paper);
  box('ceiling-cross-member',0,2.99,z+2,b.w-.45,.15,.12,0xa9ad93);
 }
 if(kind==='tower-lobby'||kind==='office'){
  // Reception, visitors and a closed lift bank explain the tower's street level.
  desk(lx+1,front-7,4.2,1.55);chair(lx+1,front-8.3);
  box('reception-front',lx+1,.64,front-6.25,4.3,1.28,.12,b.accent,true);
  box('reception-directory',lx+1,1.57,front-7.35,1.35,.72,.10,palette.edge);
  for(let row=0;row<4;row++)box('directory-line',lx+1,1.78-row*.15,front-7.28,.95,.035,.02,palette.paper);
  for(let i=0;i<3;i++)chair(rx-.2,front-7-i*1.25,-1);
  // Work pods and a visitors' lounge occupy the middle of the long podium.
  // Keep every piece beyond the protected centre aisle, with cross aisles.
  for(const side of [-1,1]){
   const cx=side*(b.w/4+1.1);
   for(const z of [-3,3]){desk(cx,z,Math.min(3,b.w/2-4),1.2);chair(cx,z+1.1,-1);}
   box('pod-divider',cx,1.02,0,Math.min(4,b.w/2-4),2.04,.12,0x929d88,true);
   box('noticeboard-frame',cx,1.47,.08,1.2,.65,.05,palette.edge);
   for(let i=0;i<3;i++)box('noticeboard-paper',cx-.37+i*.37,1.46,.112,.28,.42,.014,palette.paper);
  }
  desk(rx,back+10,2.7,1.0);
  cylinder('staff-kettle',rx-.7,.99,back+10,.20,.27,palette.metal);
  for(const dx of [.15,.5,.85])cylinder('staff-cup',rx+dx,.99,back+10,.095,.23,palette.paper);
  desk(rx-1,back+5,3.2,1.5);chair(rx-1,back+6.4,-1);
  shelves(lx,back+1,3.3);shelves(lx,back+6,3.3);
  const liftZ=back+.28;
  box('lift-bank-stone',0,1.45,liftZ,5.4,2.9,.16,palette.edge,true);
  for(const side of [-1,1]){
   box('closed-lift-door',side*1.12,1.33,liftZ+.10,2.1,2.6,.08,0x788b80);
   box('lift-door-seam',side*1.12,1.33,liftZ+.15,.025,2.5,.015,palette.edge);
   box('lift-transom',side*1.12,2.76,liftZ+.14,.8,.18,.025,palette.paper);
  }
  box('lift-call-panel',0,1.32,liftZ+.15,.22,.42,.04,palette.wood);
  plant(rx,front-3.8);plant(lx,back+10);
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
   box('sofa-base',cx,.44,2.2,Math.min(3,roomW-.4),.70,.95,palette.cloth,true);
   box('sofa-back',cx,.91,1.8,Math.min(3,roomW-.4),.95,.22,palette.edge,true);
   desk(cx,5,Math.min(2.3,roomW-.4),1.1);
   const bedZ=back+4;
   box('bed-frame',cx,.35,bedZ,2.0,.6,3.2,palette.wood,true);
   box('bed-mattress',cx,.72,bedZ,1.92,.20,3.1,palette.paper);
   box('bed-blanket',cx,.86,bedZ+.35,1.94,.12,2.3,b.accent);
   box('bed-pillow',cx,.90,bedZ-1.05,1.4,.22,.55,palette.paper);
   shelves(side*(b.w/2-.9),back+9,1.0);
   box('bedside-cabinet',cx+side*1.6,.40,bedZ+.3,.65,.80,.70,palette.wood,true);
   cylinder('bedside-lamp',cx+side*1.6,1.0,bedZ+.3,.18,.32,palette.paper);
   box('flat-wall-picture',side*(b.w/2-.25),1.8,4,.06,.82,1.10,palette.edge);
   box('flat-picture-print',side*(b.w/2-.29),1.8,4,.025,.66,.92,0xa4ae8f);
   box('kitchen-unit',cx,.49,back+.8,Math.min(3.6,roomW),.98,1.0,palette.wood,true);
   box('kitchen-top',cx,1.02,back+.8,Math.min(3.7,roomW+.1),.10,1.10,palette.paper);
   cylinder('cooking-pot',cx-.4,1.16,back+.8,.23,.22,palette.edge);
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
 }else{
  for(const side of [-1,1])for(let row=0;row<3;row++){
   const x=side*(b.w/2-3.1),z=back+4+row*6;
   desk(x,z,2.4,1.3);chair(x,z+1.2,-1);
   cylinder('cafe-cup',x+.2,.98,z,.10,.18,palette.paper);
   box('cafe-menu',x-.5,.916,z,.42,.035,.56,palette.edge);
  }
  box('service-counter',lx+1,.57,front-6,4.5,1.14,1.5,palette.wood,true);
  box('service-top',lx+1,1.18,front-6,4.7,.12,1.7,palette.paper);
  shelves(rx,back+1,2.5);plant(rx,front-4);
 }
 const plan={pieces,solids,kind};plans.set(b,plan);return plan;
}
