// Occupations change the room silhouette, not only the label on a desk.
// All coordinates are local to the building and use the shared solid writer.
export function businessRoomCharacter(k,b,identity,{back,lx,featureZ=back+7}){
 const {box,cylinder,disc,palette}=k,{wood,edge,paper,metal}=palette,z=featureZ;
 if(identity.id==='radio'){
  const x=-4.8;
  // A glazed studio front has a real 1.8 m doorway. Empty window areas retain
  // a view of the microphone and tape equipment from the central corridor.
  for(const dx of [-2.3,2.3])box('studio-corner',x+dx,1.42,z+2.3,.13,2.84,.13,wood,true);
  box('studio-transom',x,2.80,z+2.3,4.73,.15,.16,wood,true);
  for(const dx of [-.95,.95])box('studio-door-jamb',x+dx,1.40,z+2.3,.10,2.80,.15,wood,true);
  box('studio-door-lintel',x,2.45,z+2.3,1.9,.13,.16,wood,true);
  for(const side of [-1,1]){
   box('studio-knee-wall',x+side*1.63,.45,z+2.3,1.27,.90,.16,0x8a8064,true);
   box('studio-window-sill',x+side*1.63,1.0,z+2.3,1.33,.13,.21,paper);
   box('studio-window-top',x+side*1.63,2.48,z+2.3,1.33,.08,.12,wood);
  }
  box('studio-acoustic-wall',x,1.38,z-1.48,4.6,2.76,.16,0x746d51,true);
  for(let i=0;i<5;i++){
   box('acoustic-panel',x-1.76+i*.88,1.50,z-1.36,.68,1.92,.10,0x535e50);
   box('acoustic-panel-rib',x-1.76+i*.88,1.50,z-1.29,.055,1.77,.035,0x8b8764);
  }
  // A second treatment wall ties the console and rear booth into one room.
  for(const zz of [-3,1,5])box('radio-wall-baffle',lx-.65,1.68,zz,.18,2.0,2.7,0x6d735c,true);
  const mx=x+1.25,mz=z+.90;
  cylinder('microphone-base',mx,.065,mz,.30,.13,metal);
  cylinder('microphone-stand',mx,.95,mz,.035,1.86,metal,true);
  box('microphone-boom',mx-.30,1.88,mz,.67,.065,.065,metal);
  box('broadcast-microphone',mx-.62,1.76,mz,.22,.40,.22,paper);
  for(let i=0;i<3;i++)box('microphone-grille',mx-.62,1.89-i*.11,mz+.117,.17,.035,.014,edge);
  box('booth-recording-lamp',x,2.64,z+2.40,.50,.15,.07,0xb3845b);
 }else if(identity.id==='press'){
  // Proofs face the machine and finished bundles move toward the front desk.
  const x=lx+.05;
  for(const zz of [-1.4,1.4])box('proofboard-leg',x,.79,zz,.14,1.58,.17,wood,true);
  box('proofboard',x,1.85,0,.15,1.60,3.45,0x776d51,true);
  for(let i=0;i<4;i++){
   const zz=-1.2+i*.8;
   box('pasted-front-page',x+.09,1.83,zz,.025,1.23,.65,paper);
   box('page-masthead',x+.109,2.28,zz,.014,.13,.50,edge);
   for(const dz of [-.16,.16])box('page-print-column',x+.112,1.86,zz+dz,.014,.49,.15,0x8d886a);
  }
  const rx=-8.15,rz=z+2;
  for(const dx of [-.72,.72])box('drying-rack-upright',rx+dx,.84,rz,.12,1.68,.12,metal,true);
  for(let row=0;row<4;row++){
   const yy=.30+row*.37;
   box('drying-rack-tray',rx,yy,rz,1.58,.07,.94,wood,true);
   box('drying-sheet',rx+(row%2)*.06,yy+.06,rz+.06,1.35,.035,.74,paper);
   box('drying-sheet-ink',rx,yy+.085,rz+.40,.87,.018,.035,edge);
  }
  box('press-ink-tray',-6.55,1.0,z-.15,.57,.10,.72,0x3c4c41);
  box('ink-stand',-6.55,.46,z-.15,.60,.92,.75,metal,true);
 }else if(identity.id==='studio'){
  // Face the entrance: the island-crossing drawing belongs behind its model.
  const x=-4.8,zz=z-2.05;
  for(const dx of [-1.65,1.65]){
   box('drawing-display-foot',x+dx,.08,zz,.40,.16,.8,wood,true);
   box('drawing-display-post',x+dx,1.28,zz,.13,2.56,.14,wood,true);
  }
  box('drawing-display',x,1.91,zz,3.78,1.65,.16,palette.cloth,true);
  box('crossing-drawing-sheet',x,1.91,zz+.095,3.51,1.46,.025,paper);
  box('drawing-waterline',x,1.85,zz+.115,3.1,.10,.014,metal);
  for(const dx of [-.78,.78]){
   box('drawing-bridge-pier',x+dx,2.0,zz+.12,.06,.78,.014,edge);
   box('drawing-island-outline',x+dx,1.57,zz+.12,.87,.12,.014,0x87976d);
  }
  box('drawing-bridge-deck',x,1.92,zz+.12,1.7,.055,.014,edge);
  for(let i=0;i<3;i++)cylinder('rolled-survey',lx+.1,.95,back+4+i*.34,.12,1.8,i%2?paper:palette.cloth);
  box('model-work-mat',-4.8,.027,z,4.2,.035,3.1,0x899676);
 }
}

export function residentialActivity(k,identity,cx,z,width,life={take:0}){
 const {box,cylinder,cone,palette}=k,{wood,edge,paper,metal}=palette,w=Math.min(identity.id==='gardener'?4.2:3.0,width-.4);
 box('resident-workbench',cx,.78,z,w,.14,1.0,wood,true);
 for(const dx of [-w*.4,w*.4])box('resident-bench-leg',cx+dx,.36,z,.14,.72,.78,edge,true);
 if(identity.id==='gardener'){
  box('potting-soil-tray',cx-.30,.92,z,1.50,.14,.75,edge);
  box('potting-soil',cx-.30,1.00,z,1.34,.04,.59,0x5c6144);
  for(let i=0;i<3;i++){
   const x=cx-.78+i*.48;
   cylinder('potting-clay-pot',x,1.13,z,.17,.24,0x9d7956);
   cylinder('potting-pot-rim',x,1.25,z,.20,.055,0xb0946b);
   if(life.take===1&&i!==1||life.take===2&&i===1)continue;
   const growth=life.take===0?1.8:life.take===1?.65:1;
   cylinder('seedling-stem',x,1.26+.16*growth,z,.024,.32*growth,0x667c48);
   for(const [dx,dz,h]of [[-.10,.02,.28],[.10,-.04,.34],[0,.04,.48]])cone('tapered-seedling-leaf',x+dx,1.27+h*growth/2,z+dz,.14*growth,h*growth,.095*growth,dx>0?0x91a063:0x738b51,i*.7);
  }
  cylinder('watering-can',cx+.98,1.04,z,.22,.37,metal);
  box('watering-can-handle',cx+.98,1.33,z,.36,.07,.07,paper);
  for(const dx of [-.13,.13])box('watering-handle-upright',cx+.98+dx,1.26,z,.055,.15,.07,paper);
  box('watering-can-spout',cx+.63,1.12,z,.43,.10,.10,metal);
  // A small plant shelf uses the footprint formerly occupied by the sofa back.
  for(const dx of [-w*.44,w*.44])box('plant-shelf-post',cx+dx,1.16,z-.40,.10,2.32,.10,wood,true);
  box('plant-shelf-top',cx,2.25,z-.40,w,.13,.40,wood,true);
  for(const dx of [-.68,.42]){
   cylinder('shelf-pot',cx+dx,2.45,z-.40,.18,.29,0xa2805e);
   if(life.take!==1)for(const [ox,oz,h]of [[-.09,0,.29],[.09,-.04,.34],[0,.04,.40]])cone('shelf-plant-leaf',cx+dx+ox,2.59+h/2,z-.40+oz,.13,h,.095,ox>0?0x91a063:0x738b51,dx);
  }
 }else{
  // An enlarger and hanging proofs explain the photographer without a caption.
  box('enlarger-base',cx-.4,.91,z,.77,.12,.64,metal);
  box('enlarger-column',cx-.62,1.53,z-.29,.11,1.24,.12,metal);
  box('enlarger-head',cx-.34,2.08,z-.15,.68,.34,.47,edge);
  cylinder('enlarger-lens',cx-.34,1.82,z-.15,.14,.19,paper);
  box('photo-paper-easel',cx-.34,1.0,z+.13,.56,.045,.52,paper);
  box('developing-tray',cx+.76,.94,z,.65,.18,.76,metal);
  box('developing-print',cx+.76,1.04,z,.49,.025,.59,paper);
  for(const dx of [-w*.44,w*.44])box('photo-drying-post',cx+dx,1.15,z-.40,.08,2.30,.08,wood,true);
  box('photo-drying-line',cx,2.25,z-.40,w,.035,.035,edge);
  for(const dx of [-.66,0,.66]){
   box('hanging-coast-print',cx+dx,1.95,z-.40,.52,.52,.025,paper);
   box('coast-print-sea',cx+dx,1.87,z-.38,.44,.18,.012,0x829c91);
   box('coast-print-island',cx+dx-.05,1.98,z-.38,.25,.11,.014,0x7d8e67);
  }
 }
}
