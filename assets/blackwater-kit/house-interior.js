// Serializable furniture placements are the sole source for visual dimensions
// and the game's conservative furniture/partition collision rectangles.
export function createHouseFurniturePlan(s,ceiling){
 if(!s.enterable||s.kind!=='house')return[];
 const wide=s.width/2, rear=-s.depth/2;
 return[
  {id:'living-sofa',type:'sofa',position:[wide-3.75,.49,3],size:[3.35,.98,1.30]},
  {id:'living-coffee-table',type:'coffee-table',position:[wide-3.95,.36,1.25],size:[1.45,.56,.83]},
  {id:'living-bookcase',type:'bookcase',position:[-wide+1.2,1.02,2.9],size:[1.14,1.90,.53]},
  {id:'hall-shoe-cabinet',type:'cabinet',position:[-wide+1.75,.51,5.20],size:[1.52,.86,.48]},
  {id:'living-kitchen-left-partition',type:'partition',position:[-wide+1.5,ceiling/2,0],size:[3,ceiling-.01,.18]},
  {id:'living-kitchen-right-partition',type:'partition',position:[wide/2+.4,ceiling/2,0],size:[wide-1.2,ceiling-.01,.18]},
  {id:'kitchen-dining-table',type:'table',position:[wide-4.2,.46,-1.30],size:[2.15,.78,1.35]},
  {id:'kitchen-dining-chair-west',type:'chair',position:[wide-5.8,.55,-1.30],size:[.58,.94,.58]},
  {id:'kitchen-dining-chair-east',type:'chair',position:[wide-2.7,.55,-1.30],size:[.58,.94,.58]},
  {id:'kitchen-worktop',type:'kitchen',position:[wide-3.3,.56,rear+2.4],size:[4.30,.96,.80]},
  {id:'kitchen-fridge',type:'fridge',position:[wide-1.3,1.04,rear+4.2],size:[.95,1.92,.85]},
  {id:'kitchen-upper-cabinets',type:'upper-cabinet',position:[wide-3.3,1.82,rear+.30],size:[4.30,.62,.48]},
 ].map(item=>({...item,collisionSize:item.type==='partition'?item.size:[item.size[0]+.12,item.size[1],item.size[2]+.18]}));
}

export function compileHouseFloors(w,plan,{bodyZ,bodyDepth}){
 const width=plan.settings.width-.50,minZ=bodyZ-(bodyDepth-.25)/2,maxZ=bodyZ+(bodyDepth-.25)/2;
 // Both substrates share the original .07 m top surface. Small seam faces sit
 // only half a millimetre above it; no extra floor collision is introduced.
 w.box('interiorWood',[0,.035,maxZ/2],[width,.07,maxZ],[0,0,0],'walkable-living-wood-floor');
 w.box('interiorTile',[0,.035,minZ/2],[width,.07,-minZ],[0,0,0],'walkable-kitchen-linoleum-floor');
 const patch=(slot,x0,x1,z0,z1,y,role)=>{
  w.triangle(slot,[[x0,y,z0],[x0,y,z1],[x1,y,z1]],role);
  w.triangle(slot,[[x0,y,z0],[x1,y,z1],[x1,y,z0]],role);
 };
 for(let i=1;i<6;i++){
  const z=maxZ*i/6;
  patch('furnitureWood',-width/2,width/2,z-.0005,z+.0005,.0705,'living-floor-fine-board-joint');
  const endX=(i%2?1:-1)*width*.16;
  patch('furnitureWood',endX-.0005,endX+.0005,z,maxZ*(i+1)/6,.0705,'living-floor-staggered-end-joint');
 }
 // Broad linoleum sheet joins and two repaired patches avoid a checkerboard.
 for(const x of [-width*.23,width*.23])patch('pale',x-.0005,x+.0005,minZ,-.025,.0705,'kitchen-linoleum-sheet-joint');
 for(const [x,z]of [[-5.8,-4.25],[5.9,-2.60]]){
  patch('pale',x-.27,x+.27,z-.0005,z+.0005,.0705,'linoleum-repair-patch-seam');
  patch('pale',x-.27,x+.27,z+.3495,z+.3505,.0705,'linoleum-repair-patch-seam');
  for(const side of [-1,1])patch('pale',x+side*.27-.0005,x+side*.27+.0005,z,z+.35,.0705,'linoleum-repair-patch-seam');
 }
 const rugX=4.05,rugZ=2.1,rugWidth=4.4,rugDepth=3.35;
 w.box('rug',[rugX,.072,rugZ],[rugWidth,.004,rugDepth],[0,0,0],'family-living-room-rug');
 for(const side of [-1,1]){
  const rx=rugX+side*(rugWidth/2-.14),rz=rugZ+side*(rugDepth/2-.14);
  patch('interiorWood',rx-.023,rx+.023,rugZ-rugDepth/2+.13,rugZ+rugDepth/2-.13,.0745,'rug-woven-edge-band');
  patch('interiorWood',rugX-rugWidth/2+.13,rugX+rugWidth/2-.13,rz-.023,rz+.023,.0745,'rug-woven-edge-band');
 }
}

export function compileHouseInterior(writer,plan){
 // Exterior timber has a weathered green cast. Furniture keeps an owned warm
 // wood role without altering shared building or pharmacy materials.
 const w={};
 for(const method of ['box','cylinder','bevelBox'])w[method]=(slot,...args)=>writer[method](slot==='wood'?'furnitureWood':slot,...args);
 const {settings:s,upperFloorHeight:ceiling}=plan;
 const floor=.08;
 const soft=(slot,p,size,role,rotation=[0,0,0])=>w.bevelBox(slot,p,size,.055,rotation,role);
 const leg=(x,y,z,h,role)=>w.cylinder('wood',[x,floor,z],[x,y,z],.035,role);
 for(const item of plan.furniture){
  const [x,y,z]=item.position,[width,height,depth]=item.size;
  if(item.type==='partition'){
   w.box('pale',item.position,item.size,[0,0,0],item.id);
   for(const dz of [-1,1])w.box('wood',[x,.20,z+dz*.103],[width,.19,.042],[0,0,0],'room-partition-skirting');
   continue;
  }
  if(item.type==='sofa'){
   w.box('wood',[x,.27,z],[width-.13,.22,depth-.16],[0,0,0],'sofa-timber-frame');
   soft('fabric',[x,.39,z],[width-.05,.26,depth-.08],'sofa-lower-upholstery');
   for(const side of [-1,1]){
    soft('fabric',[x+side*(width/2-.16),.67,z],[.29,.57,depth],'sofa-rounded-arm');
    for(const end of [-1,1])w.cylinder('wood',[x+side*(width/2-.27),floor,z+end*(depth/2-.16)],[x+side*(width/2-.27),.30,z+end*(depth/2-.16)],.05,'sofa-turned-leg');
   }
   for(let i=0;i<3;i++){
    const cx=x+(i-1)*(width-.75)/3;
    soft('fabric',[cx,.54,z+.075],[(width-.69)/3-.036,.18,depth-.40],'separate-sofa-seat-cushion');
    soft('fabric',[cx,.78,z-depth/2+.20],[(width-.68)/3-.02,.47,.25],'sofa-back-cushion',[.12,0,0]);
    w.box('wood',[cx,.565,z+depth/2-.10],[(width-.7)/3-.07,.018,.018],[0,0,0],'sofa-seat-piping');
   }
   continue;
  }
  if(['table','coffee-table'].includes(item.type)){
   const top=item.type==='table'?.80:.60;
   soft('wood',[x,top-.045,z],[width,.09,depth],`${item.type}-beveled-top`);
   for(const side of [-1,1])for(const end of [-1,1])leg(x+side*(width/2-.13),top-.085,z+end*(depth/2-.13),top-floor,`${item.type}-leg`);
   w.box('wood',[x,top-.18,z-depth/2+.13],[width-.22,.16,.055],[0,0,0],'table-apron');
   w.box('wood',[x,top-.18,z+depth/2-.13],[width-.22,.16,.055],[0,0,0],'table-apron');
   continue;
  }
  if(item.type==='chair'){
   soft('wood',[x,.52,z],[width,.065,depth-.045],'dining-chair-seat');
   for(const side of [-1,1])for(const end of [-1,1])leg(x+side*(width/2-.07),.48,z+end*(depth/2-.065),.40,'dining-chair-leg');
   for(const side of [-1,1])w.cylinder('wood',[x+side*(width/2-.065),.44,z-depth/2+.045],[x+side*(width/2-.065),1.02,z-depth/2-.04],.024,'chair-back-post');
   soft('wood',[x,.85,z-depth/2-.01],[width-.06,.25,.052],'chair-back-rest',[-.10,0,0]);
   continue;
  }
  if(item.type==='bookcase'){
   w.box('wood',[x,y,z-depth/2+.025],[width,height,.05],[0,0,0],'family-bookcase-back');
   for(const side of [-1,1])w.box('wood',[x+side*(width/2-.035),y,z],[.07,height,depth],[0,0,0],'bookcase-side');
   for(let j=0;j<5;j++)w.box('wood',[x,.12+j*(height-.1)/4,z],[width,.055,depth],[0,0,0],'bookcase-shelf');
   for(let row=0;row<3;row++)for(let book=0;book<4;book++){
    const bx=x-width*.32+book*.18,by=.24+row*.44,bz=z+.035;
    w.box(book%2?'fabric':'pale',[bx,by+.12,bz],[.12,.24+book*.013,.19],[0,0,book===3?.13:0],'abandoned-family-book');
   }
   continue;
  }
  if(item.type==='cabinet'){
   soft('wood',item.position,item.size,'shoe-cabinet-carcass');
   for(const side of [-1,1]){
    w.box('pale',[x+side*width*.25,y,z+depth/2+.025],[width*.46,height-.09,.039],[0,0,0],'shoe-cabinet-door');
    w.cylinder('metal',[x+side*.09,y,z+depth/2+.06],[x+side*.09,y+.08,z+depth/2+.06],.016,'cabinet-pull');
   }
   continue;
  }
  if(item.type==='fridge'){
   soft('pale',item.position,item.size,'enamel-refrigerator-shell');
   const front=z+depth/2+.006;
   w.box('dark',[x,1.40,front],[width-.045,.021,.026],[0,0,0],'fridge-door-seal');
   soft('pale',[x,.93,front+.023],[width-.08,1.05,.033],'refrigerator-lower-door');
   soft('pale',[x,1.70,front+.023],[width-.08,.43,.034],'refrigerator-freezer-door');
   for(const handleY of [.98,1.62])w.cylinder('metal',[x-width*.31,handleY-.12,front+.085],[x-width*.31,handleY+.12,front+.085],.018,'fridge-door-handle');
   for(let j=0;j<6;j++)w.box('dark',[x,.16+j*.025,front+.033],[width*.82,.008,.025],[0,0,0],'fridge-base-vent');
   continue;
  }
  if(item.type==='upper-cabinet'){
   for(let i=0;i<3;i++){
    const cx=x-width*.28+i*width*.28;
    w.box('wood',[cx,y,z],[width*.265,height,.34],[0,0,0],'kitchen-upper-cabinet');
    w.box('pale',[cx,y,z+.19],[width*.245,height-.07,.035],[0,0,0],'kitchen-upper-door');
    w.cylinder('metal',[cx+.30,y-.13,z+.23],[cx+.30,y+.01,z+.23],.014,'upper-cabinet-pull');
   }
   continue;
  }
  if(item.type==='kitchen'){
   const pieces=4,unitWidth=width/pieces;
   for(let i=0;i<pieces;i++){
    const cx=x-width/2+unitWidth*(i+.5);
    w.box('wood',[cx,.56,z],[unitWidth-.013,.92,depth],[0,0,0],'kitchen-base-cabinet');
    w.box('pale',[cx,.58,z+depth/2+.024],[unitWidth-.09,.75,.032],[0,0,0],'painted-kitchen-door');
    w.cylinder('metal',[cx-.12,.86,z+depth/2+.058],[cx+.12,.86,z+depth/2+.058],.014,'kitchen-cabinet-handle');
   }
   soft('pale',[x,1.015,z],[width+.02,.09,depth+.03],'kitchen-worktop');
   w.box('dark',[x,.15,z+depth/2+.034],[width-.035,.06,.023],[0,0,0],'kitchen-kick-recess');
   const stoveX=x+width*.29,sinkX=x-width*.25;
   w.box('metal',[stoveX,1.069,z],[.88,.027,.62],[0,0,0],'stove-enamel-hob');
   for(const dx of [-1,1])for(const dz of [-1,1])w.cylinder('dark',[stoveX+dx*.21,1.083,z+dz*.17],[stoveX+dx*.21,1.099,z+dz*.17],.12,'four-stove-burners');
   w.box('dark',[stoveX,.63,z+depth/2+.045],[.69,.40,.035],[0,0,0],'oven-window');
   w.cylinder('metal',[stoveX-.30,.85,z+depth/2+.072],[stoveX+.30,.85,z+depth/2+.072],.019,'oven-handle');
   for(let j=0;j<4;j++)w.cylinder('dark',[stoveX-.27+j*.18,.95,z+depth/2+.055],[stoveX-.27+j*.18,.95,z+depth/2+.078],.03,'oven-control-knob');
   w.box('metal',[sinkX,1.068,z],[.93,.028,.61],[0,0,0],'kitchen-sink-rim');
   w.box('dark',[sinkX,1.085,z],[.72,.014,.41],[0,0,0],'sink-basin');
   w.cylinder('metal',[sinkX,1.08,z-.21],[sinkX,1.36,z-.21],.023,'sink-tap-stem');
   w.cylinder('metal',[sinkX,1.36,z-.21],[sinkX,1.36,z-.03],.022,'sink-tap-spout');
  }
 }
}
