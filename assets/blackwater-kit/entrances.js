// Wall-mounted hardware and flush floor markings only. The existing doorway,
// porch, furniture and movement plans retain ownership of usable space.
const DIGITS=['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg'];
const SEGMENTS={a:[0,.10,.115,.018],b:[.060,.053,.018,.09],c:[.060,-.053,.018,.09],d:[0,-.10,.115,.018],e:[-.060,-.053,.018,.09],f:[-.060,.053,.018,.09],g:[0,0,.115,.018]};

export function createEntranceDetailPlan(settings,doorHeight) {
 const s=settings,modules=[],frontZ=s.depth/2-(s.kind==='house'?1.79:.055);
 const add=(role,slot,position,size)=>modules.push({id:`entry-${modules.length}`,role:`entry-${role}`,slot,position,size,rotation:[0,0,0],surface:/address-stencil|entry-notice-lines|entry-notice-paper|doorbell-button/.test(role)?'front':/mat|safety-mark|porch-joint/.test(role)?'top':null});
 const faceBox=(side,role,slot,x,y,outset,size)=>add(role,slot,side==='back'?[-x,y,-s.depth/2-outset]:[x,y,frontZ+outset],size);
 if(!s.enterable)return {version:1,theme:'closed',modules,additionalMaterials:0,additionalLights:0};
 const leftSpace=s.doorOffset-2+s.width/2,rightSpace=s.width/2-s.doorOffset-2;
 const plaqueSide=leftSpace>=rightSpace?-1:1,plaqueX=s.doorOffset+plaqueSide*2.52;
 const theme=s.kind==='house'?'residential':/HARDWARE|WORKSHOP|WAREHOUSE|LAUNDRY/.test(s.label)?'industrial':'commercial';
 if(s.kind==='house'){
  const address=(String(s.label).match(/\d+/)?.[0]||String(Math.abs(s.seed)%90+10)).slice(-3);
  faceBox('front','address-enamel','pale',plaqueX,1.66,.012,[Math.max(.38,address.length*.19+.10),.30,.026]);
  for(const [i,digit]of [...address].entries())for(const segment of DIGITS[Number(digit)]){
   const [x,y,w,h]=SEGMENTS[segment];
   faceBox('front','address-stencil','dark',plaqueX+(i-(address.length-1)/2)*.19+x,1.66+y,.028,[w,h,.005]);
  }
  faceBox('front','doorbell-backplate','metal',plaqueX,1.17,.016,[.105,.19,.034]);
  faceBox('front','doorbell-button','pale',plaqueX,1.20,.040,[.052,.048,.014]);
  for(const x of [-s.width*.24,s.width*.24])add('porch-joint','dark',[x,.0805,s.depth/2-.84],[.012,.001,1.61]);
  // The mat lies directly on the already authored 8 cm porch slab.
  add('woven-door-mat','fabric',[s.doorOffset,.082,s.depth/2-.94],[2.50,.004,.61]);
  for(const x of [-1.19,1.19])add('mat-border','pale',[s.doorOffset+x,.085,s.depth/2-.94],[.045,.003,.57]);
  for(const z of [-.275,.275])add('mat-border','pale',[s.doorOffset,.085,s.depth/2-.94+z],[2.41,.003,.035]);
  return {version:1,theme,address,modules,doorHeight,frontZ,additionalMaterials:0,additionalLights:0};
 }
 // A rolled security shutter fits above the real 2.8 m opening. Its ribbed
 // curtain, end plates and guide heads form a supported mechanism.
 const lobby=/APARTMENTS/.test(s.label);
 if(!lobby){
 faceBox('front','shutter-housing','metal',s.doorOffset,3.245,-.11,[4.23,.24,.26]);
 for(let i=0;i<4;i++)faceBox('front','raised-shutter-slat',i%2?'pale':'metal',s.doorOffset,2.935+i*.067,-.06,[3.96,.056,.071]);
 for(const sign of [-1,1]){
  faceBox('front','shutter-end-plate','rust',s.doorOffset+sign*2.105,3.245,-.11,[.055,.24,.27]);
  faceBox('front','shutter-guide-head','metal',s.doorOffset+sign*2.075,2.935,-.085,[.075,.24,.16]);
 }
 }
 // A wall-owned frame and retained latch read at eye height next to the door.
 faceBox('front','entry-notice-frame','metal',plaqueX,1.70,.004,[.43,.48,.034]);
 if(lobby)modules.at(-1).surface='front';
 faceBox('front','entry-notice-paper','pale',plaqueX,1.70,.025,[.35,.40,.012]);
 for(let i=0;i<3;i++)faceBox('front','entry-notice-lines','dark',plaqueX,1.82-i*.09,.034,[i===2?.19:.27,.024,.005]);
 const doorLeft=s.doorOffset-2;
 if(!lobby){
 faceBox('front','parked-door-latch','rust',doorLeft-.23,1.02,-.14,[.105,.15,.06]);
 faceBox('front','parked-door-retainer','metal',doorLeft-.22,.76,-.14,[.08,.22,.06]);
 }
 // Every industrial threshold is marked on the existing masonry sill, rather
 // than introducing collision-free crates or a raised loading platform.
 if(theme==='industrial')for(let i=0;i<9;i++){
  const x=s.doorOffset-1.76+i*.44;
  add('threshold-safety-mark',i%2?'dark':'pale',[x,.132,s.depth/2-.14],[.29,.004,.24]);
 }
 if(!lobby&&!/PHARMACY/.test(s.label)){
  const rearOffset=-s.doorOffset,left=rearOffset-2,right=rearOffset+2;
  for(const x of [left-.052,right+.052]){
   faceBox('back','service-guide-cap','rust',x,2.81,-.032,[.09,.075,.04]);
   for(const y of [.52,1.44,2.26])faceBox('back','service-guide-fastener','pale',x,y,-.012,[.027,.027,.022]);
  }
  const panelX=right+.85;
  faceBox('back','service-push-bar','pale',panelX,1.07,-.014,[.93,.052,.018]);
  for(const x of [panelX-.44,panelX+.44])faceBox('back','service-push-bar-foot','metal',x,1.07,-.019,[.055,.11,.024]);
 }
 return {version:1,theme,modules,doorHeight,frontZ,additionalMaterials:0,additionalLights:0};
}

export function compileEntranceDetails(writer,plan) {
 for(const p of plan.modules){
  if(!p.surface){writer.box(p.slot,p.position,p.size,p.rotation,p.role);continue;}
  const [x,y,z]=p.position,[w,h,d]=p.size;
  const points=p.surface==='top'?[[x-w/2,y+h/2,z-d/2],[x-w/2,y+h/2,z+d/2],[x+w/2,y+h/2,z+d/2],[x+w/2,y+h/2,z-d/2]]:
   [[x-w/2,y-h/2,z+d/2],[x+w/2,y-h/2,z+d/2],[x+w/2,y+h/2,z+d/2],[x-w/2,y+h/2,z+d/2]];
  writer.triangle(p.slot,points.slice(0,3),p.role);writer.triangle(p.slot,[points[0],points[2],points[3]],p.role);
 }
}
