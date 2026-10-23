import {businessDetails} from './business-details.js';
import {businessRoomCharacter} from './interior-character.js';
import {businessOccupancy} from './interior-occupancy.js';
import {businessLife,interiorLifeProfile} from './interior-life.js';
import {interiorPlacement} from './interior-placement.js';
import {businessRoomLayout} from './business-spaces.js';

// Street-level plans are organized around work, customers and goods. All
// substantial forms use the caller's shared visual/collision writer. The
// centre spine, front crossover and saved supply-bench anchors stay clear.
export function businessLayout(k,b,identity,{back,front,lx,rx}){
 const {box,cylinder,disc,label,desk,chair,shelves,plant,palette}=k;
 const {wood,edge,paper,metal,cloth}=palette,left=-Math.min(5.2,b.w/2-3.4),right=-left,spaces=businessRoomLayout(b,identity);
 const details=(x,z,options={})=>businessDetails(k,identity,x,z,options);
 const mat=(role,x,z,w,d,color=cloth)=>box(role,x,.025,z,w,.035,d,color);
 const bench=(x,z,w=3.8,write=box)=>{
  write('waiting-bench-seat',x,.48,z,w,.15,.78,wood,true);
  write('waiting-bench-back',x,.89,z+.33,w,.78,.13,cloth,true);
  for(const dx of [-w*.4,w*.4])write('waiting-bench-foot',x+dx,.22,z,.16,.44,.68,edge,true);
 };
 const counter=(role,x,z,w=5.6,write=box)=>{
  write(role+'-body',x,.55,z,w,1.10,1.25,wood,true);
  write(role+'-top',x,1.15,z,w+.18,.12,1.42,paper,true);
  write(role+'-plinth',x,.12,z+.64,w-.16,.20,.07,edge);
  for(const dx of [-w*.31,0,w*.31])write(role+'-front-panel',x+dx,.62,z+.637,w*.27,.66,.035,identity.colour);
 };
 const rack=(x,z,w=4.8)=>{
  for(const dx of [-w/2,w/2])for(const dz of [-.7,.7])box('parcel-rack-upright',x+dx,1.38,z+dz,.14,2.76,.14,metal,true);
  for(let row=0;row<3;row++){
   const y=.24+row*.91;box('parcel-rack-shelf',x,y,z,w+.15,.11,1.62,wood,true);
   for(let col=0;col<3;col++){
    const xx=x+(col-1)*1.35,hh=.44+((row+col)%2)*.20;
    box('sorted-parcel',xx,y+.055+hh/2,z,1.12,hh,1.16,(row+col)%2?cloth:paper,true);
    box('parcel-routing-band',xx,y+.06+hh,z,.10,.016,1.18,edge);
    box('parcel-destination-tag',xx+.29,y+.12+hh/2,z+.59,.38,.15,.018,paper);
   }
  }
 };
 const tea=(x,z)=>{
  desk(x,z,2.7,1,false);cylinder('staff-kettle',x-.68,1.025,z,.20,.27,metal);
  for(const dx of [.12,.52,.92])cylinder('staff-cup',x+dx,1.005,z,.095,.23,paper);
 };
 if(identity.id==='radio'){
  // Public listening seats face a single control suite, beyond which is the
  // existing booth. No rear office pod stands across the booth approach.
  mat('control-suite-mat',left,1,6.2,5.3,0x718777);
  desk(left,1,5.4,1.5,false);details(left+.7,1);details(left-1.45,1,{station:'proof'});
  chair(left+.65,2.35);shelves(lx,back+1,3.3);
  details(-4.8,back+7,{feature:true});businessRoomCharacter(k,b,identity,{back,lx});
  for(const z of [front-8,front-12.5])bench(right,z,3.8);
  desk(right,front-10.1,2.7,.8,false);details(right,front-10.1,{station:'offline'});
  desk(right,back+7,3.2,1.5,false);details(right,back+7,{station:'handover'});
  tea(rx,back+12);plant(rx,front-5.5);
 }else if(identity.id==='press'){
  mat('print-workline',left,-1,6.7,b.d-12,0x989878);
  desk(left,3,5.5,1.6,false);details(left-.9,3);details(left+1.15,3,{station:'proof'});
  chair(left-.8,4.4);details(-4.8,back+7,{feature:true});businessRoomCharacter(k,b,identity,{back,lx});
  shelves(lx,back+1,3.3);
  counter('edition-dispatch',right,front-9,5.6);
  // Bundles sit on the counter rather than floating at the old desk height.
  for(const dx of [-1.6,0,1.6])for(let i=0;i<3;i++)box('newspaper-bundle',right+dx,1.25+i*.075,front-9,.95,.07,.77,paper);
  desk(right,back+8,4.5,1.5,false);details(right-1,back+8,{station:'packing'});details(right+1,back+8,{station:'handover'});
  plant(rx,front-5.5);
 }else if(identity.id==='studio'){
  // The model is an exhibition island; drafting belongs to the window side.
  const modelZ=front-13;
  details(-4.8,modelZ,{feature:true});businessRoomCharacter(k,b,identity,{back,lx,featureZ:modelZ});
  shelves(lx,back+1,3.3);
  for(const z of [-1,front-9]){
   desk(right,z,3.7,1.65,false);details(right,z);chair(right,z+1.4);
   for(const dx of [-1.62,1.62])box('drafting-table-crossbrace',right+dx,.47,z,.09,.12,1.5,metal);
  }
  bench(left,front-8,4.0);
  box('client-side-cabinet',left-2.8,.34,front-8,.85,.68,.9,wood,true);
  box('client-project-folio',left-2.8,.73,front-8,.66,.10,.75,paper);
  // Material samples have a low silhouette, leaving the model's approach open.
  desk(right,back+5,3.6,1.4,false);
  for(let i=0;i<4;i++)box('architect-material-sample',right-1.15+i*.77,.96,back+5,.56,.14,.86,[paper,wood,metal,cloth][i]);
  plant(rx,front-5.3);
 }else if(identity.id==='bank'){
  const z=front-10;
  counter('teller-counter',right,z,6.0);
  // Open teller windows frame three real service bays, with space around the
  // counter ends into the staff zone. The vault sits behind that boundary.
  for(const dx of [-3,-1,1,3])box('teller-screen-post',right+dx,1.93,z-.17,.12,1.46,.12,wood,true);
  box('teller-screen-header',right,2.63,z-.17,6.12,.17,.18,wood,true);
  for(const dx of [-2,0,2]){
   box('teller-ledge',right+dx,1.27,z+.38,1.65,.10,.35,metal);
   box('teller-payment-tray',right+dx,1.25,z-.02,.58,.055,.45,edge);
   cylinder('teller-desk-lamp',right+dx,1.40,z-.40,.13,.38,paper);
  }
  for(const zz of [front-8.5,front-12.5])bench(left,zz,4.2);
  mat('bank-queue-strip',right,z+2.1,5.9,1.0,0x9c9f82);
  // The teller line turns into an L-shaped staff boundary. Framed openings
  // retain visibility; the rear end leaves a full crossover to the vault.
  const staffStart=back+10,staffEnd=z-.3,staffX=right-2.75;
  box('bank-staff-dado',staffX,.52,(staffStart+staffEnd)/2,.14,1.04,staffEnd-staffStart,0x87917c,true);
  box('bank-staff-toprail',staffX,2.63,(staffStart+staffEnd)/2,.16,.17,staffEnd-staffStart+.16,wood,true);
  for(let zz=staffStart;zz<=staffEnd;zz+=3)box('bank-staff-mullion',staffX,1.85,zz,.13,1.54,.13,wood,true);
  details(right,back+5.5,{feature:true});
  desk(left,back+8,3.8,1.6,false);details(left,back+8,{station:'handover'});
  chair(left,back+9.4);chair(left,back+6.6,-1);shelves(lx,back+1,2.8);
  plant(lx,front-5.3);
 }else if(identity.id==='shipping'){
  // Freight is received at the door, sorted along the opposite bench, then
  // stored in deep parcel racks. Heights read as a goods-handling workplace.
  for(let z=back+5;z<front-12;z+=6.5)rack(left,z);
  counter('manifest-counter',left,front-8.5,5.4);
  box('manifest-open-book',left,1.23,front-8.5,1.32,.035,.85,paper);
  for(let i=0;i<4;i++)box('manifest-ruled-entry',left,1.255,front-8.75+i*.15,.98,.012,.035,metal);
  desk(right,1,5.8,1.7,false);
  for(const dx of [-1.8,0,1.8])details(right+dx,1,{station:'packing'});
  desk(right,back+7,3.2,1.5,false);details(right,back+7);
  box('dispatch-wall-board',right,2.0,back+3,4.0,1.25,.12,edge,true);
  for(const dx of [-1.45,-.48,.48,1.45])for(const yy of [1.7,2.23])box('freight-slot-card',right+dx,yy,back+3.074,.72,.38,.025,paper);
  for(const dx of [-1.5,1.5])box('dispatch-board-leg',right+dx,.7,back+3,.14,1.4,.16,wood,true);
  plant(rx,front-5.2);
 }else if(identity.id==='records'){
  // Crosswise stacks make short archive aisles opening onto a side passage.
  for(let z=back+4;z<front-11;z+=4){
   shelves(left,z,5.0);
   box('archive-row-index',left,2.38,z+.32,1.55,.25,.06,paper);
  }
  counter('records-service',left,front-8,5.1);
  desk(right,1,4.8,2.1,false);details(right-.8,1,{station:'handover'});details(right+1.25,1);
  for(const x of [right-1.1,right+1.1]){chair(x,2.65);chair(x,-.65,-1);}
  mat('consultation-area',right,1,6.0,6.4,0x929583);
  // Low filing cabinets define the staff corner without another desk island.
  for(const dx of [-1.25,1.25]){
   box('records-flat-file',right+dx,.56,back+5,2.15,1.12,1.10,metal,true);
   for(let row=0;row<4;row++){
    box('flat-file-drawer',right+dx,.18+row*.26,back+5.57,1.96,.21,.035,cloth);
    box('flat-file-pull',right+dx,.18+row*.26,back+5.605,.38,.06,.04,paper);
   }
  }
  plant(rx,front-5.3);
 }else if(identity.id==='cafe'){
  const z=spaces.service.z;
  counter('cafe-serving-counter',left,z,5.4);
  box('cafe-canopy',left,2.74,z,5.65,.16,1.58,0x8d8061,true);
  for(const dx of [-2.65,2.65])box('cafe-canopy-post',left+dx,1.92,z-.58,.10,1.56,.10,edge,true);
  cylinder('coffee-urn',left-.8,1.57,z,.28,.72,metal);
  cylinder('coffee-urn-lid',left-.8,1.96,z,.30,.06,paper);
  box('coffee-spigot',left-.8,1.42,z+.35,.13,.12,.24,edge);
  for(let i=0;i<3;i++)cylinder('stacked-cups',left+.45+i*.42,1.35,z,.12,.28,paper);
  box('cake-display-base',left+1.6,1.30,z,1.12,.15,.78,wood);
  for(const dx of [-.24,.24])box('cake-slice',left+1.6+dx,1.48,z,.33,.24,.45,paper);
  // Two window banquettes flank a communal table rather than another row of
  // identical pairs. Their inward-facing seats share their real solid plan.
  for(const seat of spaces.banquettes){
   box('cafe-banquette-base',seat.x,.21,seat.z,.85,.42,3.6,wood,true);
   box('cafe-banquette-cushion',seat.x,.47,seat.z,.86,.10,3.5,cloth);
   box('cafe-banquette-back',seat.x+.36,.86,seat.z,.16,.68,3.6,cloth,true);
   const tx=b.w/2-2.85;
   desk(tx,seat.z,2.6,1.4,false);
   for(const dz of [-.39,.39]){cylinder('banquette-mug',tx,1.0,seat.z+dz,.11,.22,paper);box('banquette-menu',tx-.61,.92,seat.z+dz,.40,.06,.46,edge);}
   mat('cafe-banquette-rug',tx,seat.z,3.3,4.2,0x999374);
  }
  desk(spaces.communal.x,0,2.4,4.6,false);
  for(const side of [-1,1])bench(0,0,3.6,interiorPlacement(k,{x:right+side*1.8,z:0,q:side<0?1:-1}).box);
  for(const dz of [-1.5,0,1.5]){cylinder('communal-cup',right-.55,1.0,dz,.11,.22,paper);box('communal-open-book',right+.35,.93,dz,.65,.08,.76,edge);}
  mat('cafe-communal-rug',right,0,6.0,5.6,0x999374);
  bench(left,spaces.reading.z,3.8);desk(left,spaces.reading.z-1.7,2.7,.95,false);
  cylinder('reading-table-mug',left,1.0,spaces.reading.z-1.7,.11,.20,paper);
  // The side return connects preparation and serving into one working L.
  const prepEnd=spaces.prep.z+.625,serviceEnd=spaces.service.z-.71,returnZ=(prepEnd+serviceEnd)/2,returnD=serviceEnd-prepEnd;
  box('cafe-service-return',left-2.50,.45,returnZ,.60,.90,returnD,wood,true);
  box('cafe-return-top',left-2.50,.96,returnZ,.70,.12,returnD,paper,true);
  shelves(lx,back+1,3.0);plant(rx,front-5.2);
 }else{
  // The ferry office is a ticket hall: timetable/counter on one side and
  // connected waiting benches on the other, rather than office cubicles.
  const ticket=interiorPlacement(k,spaces.ticket),z=0;
  counter('ticket-counter',0,z,5.4,ticket.box);
  ticket.box('timetable-board',0,2.52,z-.55,5.35,.72,.12,edge,true);
  for(const dx of [-2.45,2.45])ticket.box('timetable-support',dx,1.73,z-.55,.11,1.04,.12,wood,true);
  for(let i=0;i<3;i++){
   const yy=2.74-i*.22;
   ticket.label(['SAINT ORIN  /  08:10','WESTLIGHT  /  12:40','NORTH STRAIT  /  LAST FERRY'][i],'',0,yy,z-.477,4.8,.17);
  }
  for(const seat of spaces.waiting)bench(0,0,4.0,interiorPlacement(k,seat).box);
  mat('waiting-area',right+1,0,3.2,b.d-11,0x9d9e85);
  const staffRight=spaces.ticket.x-.55;
  box('ticket-staff-side-screen',spaces.staffOuter,1.2,front-10.65,.14,2.4,7.3,0xa1a68b,true);
  box('ticket-staff-rear-return',(spaces.staffOuter+staffRight)/2,1.2,front-14.3,staffRight-spaces.staffOuter,2.4,.14,0xa1a68b,true);
  mat('ticket-queue-pocket',spaces.ticket.x+1.65,spaces.ticket.z,1.4,5.3,0x9d9e85);
  // The terminal, its stock shelf and the chair occupy the same staff bay.
  // Screen faces the seated clerk, who faces outward toward the ticket hall.
  const work=interiorPlacement(k,spaces.staffWork);
  work.desk(0,0,3.3,1.4,false);businessDetails(work,identity,0,0);work.chair(0,1.15);
  shelves(lx,back+1,3.3);tea(right,back+5);
  box('ferry-office-map-frame',left,1.85,-3,3.9,1.70,.15,wood,true);
  box('ferry-office-map-water',left,1.85,-2.91,3.66,1.45,.025,0x769a92);
  box('ferry-map-island',left-.8,1.85,-2.89,1.35,1.20,.02,0xa8b58b);
  box('ferry-map-city',left+1.1,1.85,-2.89,.7,1.20,.02,0xb8bd9a);
  box('ferry-map-crossing',left+.25,1.88,-2.87,1.05,.07,.02,paper);
  for(const dx of [-1.55,1.55])box('ferry-map-upright',left+dx,.83,-3,.14,1.66,.15,wood,true);
  plant(lx,front-5.2);
 }
 businessOccupancy(k,b,identity,{back,front,left,right,spaces});
 businessLife(k,b,identity,{back,front,left,right,spaces},interiorLifeProfile(b));
}
