import {houseShell} from './house-shell.js';
import {interiorPlacement} from './interior-placement.js';

// Independent of the identity modulo and the world's procedural RNG. Neighbours
// with the same occupation retain different, stable finishes and daily habits.
export function interiorLifeProfile(b){
 let h=(b.seed^0x6d2b79f5)|0;h=Math.imul(h^(h>>>16),0x45d9f3b);h=Math.imul(h^(h>>>16),0x45d9f3b);h=(h^(h>>>16))>>>0;
 const variant=h%3;
 return {variant,take:(h>>>8)%3,plaster:[0xc7bca1,0xb7bea8,0xc6af98][variant],trim:[0x7e7861,0x788577,0x8d7861][variant],cloth:[0x8a7965,0x728a80,0x9b6f5c][variant]};
}

export function interiorWallFinish({box},b,life){
 const height=b.interiorHeight||3.4;
 // Line the existing shell pieces on their inward faces. Openings remain real:
 // no continuous overlay across a window, door or upper clerestory.
 for(let tier=0;tier<height/3.4;tier++)for(const p of houseShell({...b,upper:tier>0}).walls){
  const lo=Math.max(.2,p.y+tier*3.4),hi=Math.min(height-.16,p.y+p.h+tier*3.4);if(hi<=lo)continue;
  const y=(lo+hi)/2-.2,frontBack=Math.abs(p.z)===b.d/2,c=frontBack&&p.z<0?life.trim:life.plaster;
  if(frontBack)box('interior-plaster',p.x,y,Math.sign(p.z)*(b.d/2-.209),p.w,hi-lo,.018,c);
  else box('interior-plaster',Math.sign(p.x)*(b.w/2-.209),y,p.z,.018,hi-lo,p.d,c);
 }
}

export function homeLife(k,b,id,{cx,side,back,front,layout},life){
 const {box,cylinder,palette}=k,{wood,edge,paper,metal}=palette,z=layout.wallMount.z,bedZ=layout.bed.z,kitchen=interiorPlacement(k,layout.kitchen);
 // This composition occupies a known uninterrupted divider segment between
 // living-room doors. Its coat depth remains inside the existing wall buffer.
 const wall=(role,u,y,w,h,color,depth=.035,offset=0)=>box(role,side*(2.26+offset+depth/2),y,z+u,depth,h,w,color);
 wall('household-peg-rail',0,1.82,2.16,.12,wood,.08);
 wall('household-picture-frame',0,2.28,2.10,.70,edge,.07);
 wall('household-picture-paper',0,2.28,1.96,.56,paper,.012,.071);
 // Painted layers need distinct depths too: overlapping coplanar box faces
 // break the broad ferry windows and photographs into unstable triangles.
 const ink=(role,u,y,w,h,color,layer=0)=>wall(role,u,y,w,h,color,.012,.086+layer*.016);
 if(id.id==='family'){
  ink('child-drawing-sea',0,2.14,1.72,.065,metal);
  ink('child-drawing-ferry',-.20,2.23,1.02,.13,life.cloth,1);
  ink('child-drawing-cabin',-.23,2.35,.65,.16,wood,2);
  for(const u of [-.43,-.16])ink('child-drawing-ferry-window',u,2.37,.12,.075,paper,3);
  ink('child-drawing-beacon',.68,2.33,.12,.38,edge,1);ink('child-drawing-beacon-light',.68,2.51,.22,.07,life.cloth,2);
  const coats=[[-.50,1.70,.94,.55,life.cloth],[.48,1.50,.66,.42,0xb3a17b]];
  for(const [i,[u,top,h,w,c]]of coats.entries()){
   wall('household-coat-peg',u,1.79,.10,.10,edge,.12,.08);
   if((life.variant===1&&i===0)||(life.variant===2&&i===1))continue;
   wall('raincoat-hanging-loop',u,(top+1.82)/2,.09,1.82-top,edge,.075,.08);
   wall('household-raincoat',u,top-h/2,w,h,c,.16,.06);
   for(const sign of [-1,1])wall('raincoat-sleeve',u+sign*w*.57,top-h*.33,.16,h*.57,c,.14,.06);
   wall('raincoat-front-opening',u,top-h/2,.035,h*.82,paper,.018,.22);
   wall('raincoat-hem-band',u,top-h+.13,w,.065,paper,.018,.22);
  }
  if(life.variant===1){
   kitchen.box('folded-adult-raincoat',-1.25,1.12,0,.75,.10,.72,life.cloth);
   kitchen.box('raincoat-folded-band',-1.25,1.177,0,.75,.014,.065,paper);
  }else if(life.variant===2){
   box('folded-child-raincoat',cx+.55,.984,bedZ+.9,.58,.10,.54,0xb3a17b);
   box('child-coat-folded-band',cx+.55,1.041,bedZ+.9,.58,.014,.06,paper);
  }
 }else if(id.id==='gardener'){
  for(const u of [-.59,0,.59]){
   ink('botanical-study-stem',u,2.30,.035,.36,metal);
   for(const sign of [-1,1])ink('botanical-study-leaf',u+sign*.10,2.30+sign*.075,.20,.075,life.cloth,1);
  }
  for(const u of [-.57,.55]){
   wall('garden-apron-loop',u,1.72,.09,.17,edge,.08,.08);
   wall('garden-apron',u,1.21,.54,.90,life.cloth,.12,.06);
   wall('garden-apron-pocket',u,1.13,.37,.21,wood,.025,.19);
  }
 }else{
  for(const [u,y,w,h]of [[-.56,2.31,.52,.43],[.10,2.31,.52,.43],[.69,2.31,.36,.43]]){
   ink('contact-sheet-border',u,y,w,h,edge);ink('contact-sheet-water',u,y-.07,w-.06,.12,metal,1);ink('contact-sheet-island',u-.03,y+.035,w*.55,.08,life.cloth,2);
  }
  wall('camera-bag-strap',-.51,1.41,.055,.74,edge,.09,.08);
  wall('camera-shoulder-bag',-.51,1.05,.66,.46,life.cloth,.22,.02);
  wall('camera-bag-flap',-.51,1.18,.70,.16,paper,.028,.245);
  wall('darkroom-apron-loop',.53,1.72,.09,.17,edge,.08,.08);
  wall('darkroom-apron',.53,1.24,.55,.85,metal,.14,.06);
 }
 // Drawers and a towel belong to the kitchen already in the plan. Their broad
 // bands, rather than new floor clutter, make its blank cabinet read as used.
 const w=Math.min(3.6,b.w/2-3.8);
 for(const dx of [-w*.25,w*.25]){
  kitchen.box('kitchen-door-front',dx,.49,.508,w*.47,.77,.035,life.trim);
  kitchen.box('kitchen-door-pull',dx,.74,.54,.24,.055,.055,metal);
 }
 kitchen.box('kitchen-towel-rail',w*.30,.82,.58,.62,.055,.075,wood);
 kitchen.box('kitchen-used-towel',w*.30,.60,.62,.44,.45,.035,life.cloth);
 kitchen.box('towel-woven-band',w*.30,.44,.642,.44,.055,.012,paper);
 if(id.id==='family'){
  // A repaired blanket repeats the adult coat colour, tying the everyday
  // departure scene to the sleeping area without another written caption.
  for(const dx of [-.55,.55])box('family-blanket-patch',cx+dx,.927,bedZ+.9,.72,.014,.72,life.cloth);
  for(const dx of [-.55,.55])box('blanket-patch-seam',cx+dx,.938,bedZ+.9,.58,.008,.025,paper);
 }
}

export function businessLife(k,b,id,{back,front,left,right,spaces},life){
 const {box,cylinder,disc,label,palette}=k,{wood,edge,paper,metal,cloth}=palette;
 if(id.id==='radio'){
  const x=-4.8,z=back+7,selected=life.take;
  box('broadcast-tape-board',x,2.40,z-1.23,2.80,.70,.08,wood);
  box('broadcast-tape-shelf',x,2.11,z-1.08,2.86,.08,.38,edge);
  for(let i=0;i<3;i++){
   const xx=x-.88+i*.88;box('tape-slot-back',xx,2.34,z-1.178,.70,.38,.025,edge);
   if(i!==selected){box('stored-tape-case',xx,2.34,z-1.10,.62,.38,.12,i===0?life.cloth:paper);for(const dx of [-.15,.15])disc('stored-case-reel',xx+dx,2.35,z-1.029,.085,.02,metal);}
   box('tape-slot-marker',xx,2.17,z-.99,.20,.028,.05,i===selected?life.cloth:paper);
  }
  // The missing case and selected recording share a colour. The case rests
  // on the existing tape deck; the storage board meets its acoustic wall ribs.
  box('selected-tape-case',x,1.435,z-.10,.68,.05,.44,selected===0?life.cloth:paper);
  box('selected-tape-band',x,1.466,z-.10,.10,.012,.44,life.cloth);
  label('COASTLINE / LIVE','THE NEXT TAPE',x,2.64,z-1.177,2.30,.17);
  box('console-headphone-hook',left+2.35,1.055,1,.10,.33,.10,wood);
  box('headphone-band-top',left+2.35,1.23,1,.58,.07,.09,edge);
  for(const dx of [-.25,.25]){box('headphone-band-side',left+2.35+dx,1.12,1,.07,.20,.09,edge);box('headphone-earpad',left+2.35+dx,1.025,1,.15,.24,.20,cloth);}
 }else if(id.id==='press'){
  box('printer-apron',left+1.9,.61,3.83,.68,.56,.035,life.cloth);
  box('printer-apron-neck',left+1.9,.88,3.83,.24,.10,.035,life.cloth);
  for(const dx of [-1.6,0,1.6]){
   box('edition-bundle-twine',right+dx,1.442,front-9,.06,.02,.79,wood);
   box('edition-top-headline',right+dx,1.444,front-9-.17,.70,.018,.09,edge);
  }
 }else if(id.id==='studio'){
  box('survey-field-satchel',left-2.8,.94,front-8,.64,.32,.53,life.cloth);
  box('satchel-top-flap',left-2.8,1.11,front-8+.04,.68,.08,.55,wood);
  for(const dx of [-.22,.22])box('satchel-buckle',left-2.8+dx,.97,front-7.717,.07,.14,.035,paper);
 }else if(id.id==='bank'){
  const x=right+(life.take-1)*2,z=front-10;
  box('active-teller-slip',x+.43,1.225,z+.15,.37,.03,.42,paper);
  box('teller-stamp-base',x-.40,1.25,z,.28,.08,.23,edge);
  cylinder('teller-stamp-handle',x-.40,1.34,z,.07,.10,wood);
  for(let i=0;i<3;i++)cylinder('counted-coin-stack',x+.60+i*.15,1.25+i*.015,z-.35,.065,.08+i*.03,0xb3a17b);
 }else if(id.id==='shipping'){
  box('packing-tape-base',right+2.45,.94,1.35,.54,.10,.36,metal);
  cylinder('packing-tape-roll',right+2.45,1.11,1.35,.16,.24,paper);
  box('tape-dispenser-nose',right+2.45,1.02,1.58,.38,.15,.12,edge);
  box('packing-shift-apron',right+2.05,.61,1.87,.60,.56,.035,life.cloth);
 }else if(id.id==='records'){
  box('consultation-application',right-1.95,.92,1,.66,.06,.92,life.cloth);
  box('application-open-page',right-1.95,.959,1,.55,.018,.80,paper);
  for(let i=0;i<3;i++)box('application-signature-line',right-1.95,.975,.80+i*.19,.39,.012,.025,edge);
 }else if(id.id==='cafe'){
  const z=spaces.service.z;
  box('serving-towel-rail',left-1.75,.99,z+.76,.76,.055,.07,wood);
  box('cafe-service-towel',left-1.75,.70,z+.80,.54,.58,.035,life.cloth);
  box('cafe-towel-band',left-1.75,.48,z+.825,.54,.065,.012,paper);
 }else if(id.id==='office'){
  const seat=interiorPlacement(k,spaces.waiting[1]),x=-.85,z=-.05;
  seat.box('waiting-passenger-case',x,.855,z,.90,.60,.56,life.cloth,true);
  seat.box('case-seam',x,.855,z-.286,.86,.035,.018,wood);
  for(const dx of [-.28,.28])seat.box('case-travel-strap',x+dx,.855,z-.293,.07,.56,.025,paper);
  for(const dx of [-.19,.19])seat.box('case-handle-upright',x+dx,1.205,z,.055,.10,.075,wood);
  seat.box('case-carry-handle',x,1.28,z,.43,.055,.075,wood);
  interiorPlacement(k,spaces.ticket).box('ferry-ticket-envelope',1.85,1.23,0,.56,.04,.40,life.cloth);
 }
}
