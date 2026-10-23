import {businessDetails} from './business-details.js';

// Occupied side bays retain the tall public spine. Suspended work ceilings use
// real solid volumes; their ties meet the original shell without floor posts
// being introduced into existing doorways, archive aisles or stash approaches.
export function businessOccupancy(k,b,id,{back,front,left,right}){
 const {box,cylinder,disc,desk,chair,shelves,palette}=k,{wood,edge,paper,metal,cloth}=palette;
 const outer=b.w/2-.6;
 const tie=(role,x,z,bottom)=>{
  const top=(b.interiorHeight||3.4)-.34;
  if(top>bottom)box(role,x,(top+bottom)/2,z,.065,top-bottom,.065,metal);
 };
 const bay=(role,x0,x1,z0,z1,{solid=false,color=paper,y=3.14,spacing=4,hung=true}={})=>{
  const x=(x0+x1)/2,z=(z0+z1)/2,w=x1-x0,d=z1-z0;
  for(const xx of [x0,x1])box(role+'-edge',xx,y,z,.14,.20,d+.14,wood,true);
  if(solid)box(role+'-ceiling',x,y+.02,z,w,.14,d,color,true);
  for(let zz=z0;zz<=z1;zz+=spacing){
   box(role+'-rib',x,y,zz,w+.14,.20,.16,solid?wood:color,true);
   if(hung)for(const xx of [x0,x1])tie(role+'-suspension',xx,zz,y+.1);
  }
  box(role+'-end',x,y,z1,w+.14,.20,.16,wood,true);
  if(hung)for(const xx of [x0,x1])tie(role+'-suspension',xx,z1,y+.1);
 };
 const hutch=(role,x,z,w=3.8)=>{
  // A supported upper shelf rises from an existing .89m work surface.
  for(const dx of [-w*.46,w*.46])box(role+'-upright',x+dx,1.59,z,.10,1.40,.11,wood,true);
  box(role+'-shelf',x,2.24,z,w,.12,.40,wood,true);
  for(let i=0;i<4;i++)box(role+'-stock',x-w*.33+i*w*.22,2.47,z,.44,.34,.34,i%2?paper:cloth);
 };
 if((b.interiorHeight||3.4)>4){
  if(id.id==='bank'){
   const z0=back+10,z1=front-10.3;
   bay('teller-staff-bay',right-2.75,outer,z0,z1,{solid:true,color:0xaaa98b,y:3.16});
   // Extend the existing boundary's posts to support its new overhead.
   for(let z=z0;z<=z1;z+=3)box('teller-overhead-support',right-2.75,2.91,z,.13,.58,.13,wood,true);
   desk(right+1,-.15,4.3,1.55,false);chair(right+1,1.25);
   businessDetails(k,id,right+.30,-.15);businessDetails(k,id,right+2.15,-.15,{station:'handover'});
   hutch('teller-ledger-shelf',right+1,-.77,4.0);
   for(const dx of [-1.65,1.65])box('teller-file-pedestal',right+1+dx,.44,-.15,.55,.88,1.15,metal,true);
  }else if(id.id==='radio'){
   bay('control-room-overhead',-8.2,-2.2,-1.4,4.1,{solid:true,color:0x9c9e85,y:3.13});
   const z=back+7;
   bay('broadcast-booth-roof',-7.23,-2.37,z-1.56,z+2.40,{solid:true,color:0xaaa88b,y:3.04});
   for(const x of [-7.1,-2.5])box('booth-roof-post-extension',x,2.94,z+2.3,.13,.25,.13,wood,true);
   box('booth-rear-roof-bond',-4.8,2.90,z-1.48,4.6,.28,.16,wood,true);
   // The console's back edge carries its studio clock and tape storage.
   hutch('control-tape-shelf',left, .37,4.8);
  }else if(id.id==='press'){
   // Alternating light panels and open ribs frame the long production line.
   bay('printing-work-bay',-outer,-2.3,back+4,front-7,{color:0xa7a589,y:3.22,spacing:4.5});
   for(let z=back+5.4;z<front-8;z+=9)box('print-bay-ceiling-panel',(-outer-2.3)/2,3.24,z,outer-2.3,.12,2.8,0xada98a,true);
   shelves(right,front-14,4.6);
   // An apron and folded dispatch sacks belong on the existing packing bench.
   box('packing-cloth',right+.90,.90,back+8.22,1.0,.025,.69,cloth);
  }else if(id.id==='studio'){
   // Drafting gets a timber pergola; the model/display remains in open light.
   bay('drafting-gallery',2.35,outer,back+3.5,front-7,{color:wood,y:3.18,spacing:3.5});
   box('survey-flat-file',right+2.55,.49,back+11,1.1,.98,3.5,metal,true);
   for(let i=0;i<4;i++){
    box('survey-file-drawer',right+2.55,.17+i*.23,back+12.77,.96,.18,.035,cloth);
    box('survey-file-pull',right+2.55,.17+i*.23,back+12.80,.32,.05,.04,paper);
   }
   box('sample-wall-panel',outer-.08,1.87,back+11,.12,1.65,3.4,edge,true);
   for(const dz of [-1.1,0,1.1])box('hanging-material-board',outer-.155,1.87,back+11+dz,.025,1.30,.86,dz===0?wood:paper);
  }else if(id.id==='records'){
   bay('archive-gallery',-outer,-2.45,back+3.5,front-10.8,{color:0xa6aa8e,y:3.11,spacing:4});
   // Return screens bind consultation into a room with a wide front entrance.
   for(const x of [right-2.65,right+2.65])box('consultation-side-screen',x,1.17,-1.05,.12,2.34,3.9,0x9da48a,true);
   box('consultation-back-screen',right,1.17,-3.0,5.42,2.34,.12,0x9da48a,true);
   box('consultation-picture-frame',right,1.85,-2.92,2.3,.68,.06,wood);
   box('consultation-picture-water',right,1.85,-2.88,2.10,.50,.025,metal);
   box('consultation-picture-island',right-.35,1.84,-2.86,1.15,.23,.02,cloth);
  }else if(id.id==='shipping'){
   bay('freight-rack-rails',left-2.4,left+2.4,back+3.5,front-11,{color:metal,y:3.25,spacing:6.5,hung:false});
   for(let z=back+5;z<front-12;z+=6.5)for(const dx of [-2.4,2.4])for(const dz of [-.7,.7])box('freight-rack-post-extension',left+dx,3.03,z+dz,.14,.56,.14,metal,true);
   hutch('packing-stock-shelf',right,.33,5.4);
   for(const dx of [-1.4,0,1.4])cylinder('packing-paper-roll',right+dx,1.35,.33,.17,.90,paper);
  }
 }
 if(id.id==='cafe'){
  const z=front-13;
  box('cafe-preparation-unit',left,.45,z,5.1,.90,1.10,wood,true);
  box('cafe-preparation-top',left,.96,z,5.25,.12,1.25,paper,true);
  // Hutch feet meet the higher preparation surface, with a broad backsplash.
  for(const dx of [-2.35,2.35])box('cafe-prep-hutch-post',left+dx,1.62,z-.45,.11,1.2,.11,wood,true);
  box('cafe-prep-shelf',left,2.23,z-.45,4.9,.12,.4,wood,true);
  box('cafe-prep-backsplash',left,1.45,z-.5,4.8,.8,.08,0xa1aa93);
  box('cafe-plate-rack',left+1.08,1.06,z+.13,2.10,.08,.40,wood);
  for(const dz of [-.17,.17])box('plate-rack-retainer',left+1.08,1.15,z+.13+dz,2.10,.10,.06,wood);
  for(let i=0;i<4;i++){
   cylinder('cafe-pantry-tin',left-1.7+i*1.1,2.46,z-.45,.23,.34,i%2?paper:metal);
   disc('cafe-drying-plate',left+.3+i*.52,1.33,z+.13,.23,.055,paper);
  }
  box('cafe-bread-board',left-1.35,1.06,z+.08,1.05,.08,.66,wood);
  for(const dx of [-.24,.24])box('cafe-bread-loaf',left-1.35+dx,1.22,z+.08,.40,.24,.46,0xb79e72);
 }else if(id.id==='office'){
  // Ticket stock and a framed staff alcove explain the counter's back office.
  const z=back+6;
  hutch('ticket-stock-hutch',left,z-.50,3.15);
  for(const dx of [-1.8,1.8])box('ticket-office-return',left+dx,1.17,z-.10,.12,2.34,1.6,0xa1a68b,true);
  for(let i=0;i<3;i++)box('ticket-stock-book',left+.8,.95+i*.09,z+.20,.54,.08,.72,i%2?paper:cloth);
 }
}

export function homeTableActivity({box,cylinder,palette},id,x,z,side,life){
 const {wood,edge,paper,metal,cloth}=palette;
 if(id.id==='family'&&side<0){
  box('family-breakfast-runner',x,.905,z,1.75,.025,.66,life.cloth);
  for(const dx of [-.48,.48]){
   cylinder('breakfast-plate',x+dx,.94,z,.26,.035,paper);
   if(dx<0){box('breakfast-bread',x+dx-.06,.99,z,.20,.065,.25,0xb49a6a);box('breakfast-cut-slice',x+dx+.12,.975,z+.05,.10,.035,.19,paper);}
   else{box('saved-breakfast-parcel',x+dx,1.015,z,.37,.12,.30,paper);box('breakfast-parcel-band',x+dx,1.081,z,.065,.012,.30,life.cloth);}
   cylinder('breakfast-cup',x+dx,1.01,z-.32,.09,.22,paper);
  }
 }else if(id.id==='gardener'){
  box('garden-journal',x-.35,.93,z,.86,.08,.67,cloth);
  box('garden-journal-page',x-.35,.976,z,.72,.014,.56,paper);
  for(const dx of [-.16,.16])for(const dz of [-.13,.13])box('journal-planting-square',x-.35+dx,.99,z+dz,.21,.012,.16,metal);
  for(let i=0;i<3;i++)box('saved-seed-envelope',x+.45+i*.17,.93+i*.035,z,.35,.06,.48,i%2?wood:paper);
 }else if(id.id==='photographer'){
  box('coastal-photo-album',x,.93,z,1.55,.08,.84,edge);
  for(const dx of [-.38,.38]){
   box('album-paper-page',x+dx,.978,z,.70,.016,.75,paper);
   box('album-print-water',x+dx,.990,z,.53,.012,.48,metal);
   box('album-print-island',x+dx-.06,.999,z-.035,.30,.008,.18,cloth);
  }
 }else{
  box('mending-basket',x-.35,1.04,z,.72,.30,.58,wood);
  box('folded-repair-cloth',x-.35,1.21,z,.62,.09,.47,cloth);
  for(const dx of [.35,.65]){cylinder('sewing-spool',x+dx,1.0,z,.085,.22,paper);cylinder('spool-thread',x+dx,1.0,z,.09,.12,metal);}
 }
}
