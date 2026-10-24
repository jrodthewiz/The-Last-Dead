// Functional room anchors are shared by furniture, personal objects and QA.
// The public corridor/doors remain fixed while the flats use different plans.
import {interiorLifeProfile} from './interior-life.js';
import {interiorPlacement} from './interior-placement.js';
export function homeRoomLayout(b,id,side,life=interiorLifeProfile(b)){
 const back=-b.d/2,front=b.d/2,cx=side*(b.w/4+1.2),outer=side*(b.w/2-1.1),garden=id.id==='gardener',photo=id.id==='photographer',arrangement=(life.take+(side>0?1:0))%3,diningLed=id.id==='family'&&arrangement===1;
 return {id:id.id,side,cx,arrangement,roomW:b.w/2-3.8,
  openings:[back+8,2,front-7],wallMount:{z:front-9.6},
  bed:{x:cx,z:back+4},kitchen:{x:cx,z:front-1.65,q:2},
  living:garden?{x:outer,z:front-10,q:side}:photo?{x:cx,z:-2.4,q:0}:{x:outer,z:front-(diningLed?12:10),q:side},
  dining:garden?{x:cx,z:front-10,q:side}:photo?{x:cx,z:front-7.3,q:0}:{x:cx,z:front-(diningLed?7.2:6.1),q:diningLed?side:0},
  bedroom:{z:back+10.7,doorX:side*(arrangement===2?b.w/2-2:4),doorW:1.9},
  workspace:photo?{x:cx,z:-2.4}:null};
}

export function homeRoomStructure({box,palette},b,p){
 const {wood,edge,cloth,paper,metal}=palette,{side,cx,bedroom}=p;
 const a=2.2,c=b.w/2-.2,door=Math.abs(bedroom.doorX),z=bedroom.z;
 for(const [lo,hi]of [[a,door-bedroom.doorW/2],[door+bedroom.doorW/2,c]]){
  box('bedroom-cross-wall',side*(lo+hi)/2,1.32,z,hi-lo,2.64,.14,0xaaa98b,true);
  box('bedroom-wall-cap',side*(lo+hi)/2,2.64,z,hi-lo+.04,.09,.18,wood);
 }
 box('bedroom-door-header',bedroom.doorX,2.48,z,bedroom.doorW+.12,.32,.18,edge,true);
 for(const dx of [-1,1])box('bedroom-door-jamb',bedroom.doorX+dx*(bedroom.doorW/2+.025),1.2,z,.075,2.4,.18,wood,true);
 if(p.id==='family'){
  // The wardrobe belongs to a solid corridor-wall segment, away from portals.
  const x=side*2.73;
  box('hall-wardrobe',x,1.13,-2,.90,2.26,2.6,wood,true);
  for(const dz of [-.65,.65]){
   box('wardrobe-door',x+side*.464,1.14,-2+dz,.035,2.1,1.22,cloth);
   box('wardrobe-pull',x+side*.49,1.10,-2+dz-side*.24,.04,.21,.08,paper);
  }
 }else if(p.id==='gardener'){
  // A low return joins the window potting run and shelters the journal corner.
  const x=side*(b.w/2-2.8),zz=p.living.z+2.5;
  box('garden-return-base',x,.39,zz,3.4,.78,.65,edge,true);
  box('garden-return-top',x,.835,zz,3.5,.11,.72,wood,true);
  for(const dx of [-1.1,0,1.1]){
   box('garden-return-cubby',x+dx,.45,zz+.334,.88,.46,.025,cloth);
   box('seed-return-packet',x+dx,.93,zz,.50,.08,.44,paper);
  }
 }else{
  const w=p.workspace,screenZ=w.z+2.1,outerX=cx+side*2.05;
  box('print-room-front-screen',cx,.725,screenZ,4.1,1.45,.14,0x77867a,true);
  box('print-room-upper-screen',cx,2.225,screenZ,4.1,.35,.14,0x77867a,true);
  for(const dx of [-1.8,1.8])box('print-view-side',cx+dx,1.75,screenZ,.50,.60,.14,0x77867a,true);
  box('print-room-outer-return',outerX,1.2,w.z+.37,.14,2.4,3.6,0x77867a,true);
  box('print-screen-cap',cx,2.43,screenZ,4.22,.09,.20,wood);
  box('print-return-cap',outerX,2.43,w.z+.37,.20,.09,3.68,wood);
  // A high slit hints at the drying line without exposing the whole process.
  box('print-view-sill',cx,1.45,screenZ,3.15,.10,.20,metal);
  box('print-view-header',cx,2.05,screenZ,3.15,.08,.20,wood);
 }
}

export function familyLounge(k,p){
 const {box,palette}=k;
 const {wood,cloth,edge}=palette,{x,z}=p.living,side=p.side;
 box('family-sofa-base',x,.44,z,.95,.70,3,cloth,true);
 box('family-sofa-back',x+side*.36,.91,z,.22,.95,3,edge,true);
 for(const dx of [-.31,.31])for(const dz of [-1.15,1.15])box('family-sofa-foot',x+dx,.06,z+dz,.11,.12,.14,wood);
 for(const dz of [-1.36,1.36])box('family-sofa-arm',x,.72,z+dz,1.02,.28,.25,wood,true);
 for(const dz of [-.76,.76])box('family-sofa-cushion',x-side*.12,.83,z+dz,.62,.08,1.25,cloth);
 // A low, usable focus gives the sofa a purpose. Whole activity groups face
 // the seat and stay outside the inner route between dining and the bedroom.
 const table=interiorPlacement(k,{x:x-side*1.9,z,q:side<0?1:-1}),{paper,metal}=palette;
 table.box('family-low-table',0,.45,0,2.1,.10,1.25,wood,true);
 for(const dx of [-.84,.84])for(const dz of [-.43,.43])table.box('low-table-foot',dx,.20,dz,.10,.40,.10,edge,true);
 if(p.arrangement===0){
  table.box('family-radio-case',0,.69,0,.85,.38,.45,wood);
  table.box('family-radio-grille',-.13,.69,.234,.45,.25,.025,edge);
  table.disc('family-radio-dial',.28,.69,.24,.075,.04,paper);
  for(const dx of [-.31,.31])table.box('radio-handle-post',dx,.93,0,.06,.10,.07,edge);
  table.box('radio-carry-handle',0,1.005,0,.68,.06,.07,edge);
 }else if(p.arrangement===1){
  table.box('family-crossing-board',0,.522,0,1.45,.044,1.03,edge);
  table.box('crossing-board-water',0,.552,0,1.32,.016,.90,metal);
  table.box('crossing-board-island',-.34,.569,0,.48,.018,.67,cloth);
  table.box('crossing-board-city',.48,.569,0,.19,.018,.68,paper);
  table.box('crossing-board-bridge',.12,.583,.02,.47,.012,.055,wood);
  for(const dx of [-.37,.43])table.cylinder('crossing-game-piece',dx,.613,.03,.085,.07,paper);
 }else{
  table.box('family-storybook',-.22,.55,0,.88,.10,.70,cloth);
  table.box('storybook-page',-.22,.607,0,.77,.014,.60,paper);
  for(const dx of [.43,.73])table.cylinder('reading-cup',dx,.61,.04,.095,.22,paper);
 }
}
