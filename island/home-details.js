import {houseShell} from './house-shell.js';
import {domesticProfile} from './domestic-profile.js';

// Small, readable domestic objects share the world's existing instanced kit.
// Every substantial addition supplies the same volume to movement and bullets.
export function furnishCottage(k,b,floor,solid,{side,workX,special=false}){
 const profile=domesticProfile(b),wood=0x96856a,edge=0x665e4b,cream=0xd3c7a3,iron=0x43544c;
 const box=(role,x,y,z,w,h,d,color)=>{k.box(b.x+x,floor+y,b.z+z,w,h,d,color);k.lastRole(role);};
 const cylinder=(role,x,y,z,r,h,color)=>{k.add('cylinder',b.x+x,floor+y,b.z+z,r,h,r,color);k.lastRole(role);};
 const back=-b.d/2,prepX=special?-1:0,prepW=special?1.9:3.2,prepZ=back+.85;
 // Ceiling members sit into a continuous wall plate. Their overhead volumes
 // also constrain the camera on a jump; no posts intrude on the room's aisles.
 for(const s of [-1,1]){
  box('ceiling-wall-plate',s*(b.w/2-.32),2.96,0,.17,.17,b.d-.46,edge);
  box('ceiling-wall-plate',0,2.96,s*(b.d/2-.32),b.w-.46,.17,.17,edge);
 }
 for(const z of [-b.d*.25,0,b.d*.25]){
  box('ceiling-cross-joist',0,2.93,z,b.w-.50,.22,.20,wood);
  solid('ceiling-joist-'+z,0,z,b.w-.50,.20,.22,2.82);
 }
 box('living-timber-floor',0,.009,b.d/4,b.w-.5,.014,b.d/2-.25,0x938366);
 const boardCount=Math.floor((b.w-.5)/.7),boardWidth=(b.w-.5)/boardCount;
 for(let i=1;i<boardCount;i++)box('floorboard-joint',-(b.w-.5)/2+i*boardWidth,.019,b.d/4,.018,.005,b.d/2-.25,0x766e55);
 if(!special){
  const px=side*(b.w/2-4.45),pz=back+2.1;
  box('sleeping-nook-screen',px,1.14,pz,.12,2.28,3.7,0xa6ac91);
  box('screen-timber-cap',px,2.31,pz,.18,.07,3.75,wood);
  solid('sleeping-nook-screen',px,pz,.18,3.75,2.35);
 }
 // Hollow cabinet construction leaves room beneath the inset sink. A solid
 // block here would fill the bowl even if the worktop had an opening.
 box('kitchen-plinth',prepX,.08,prepZ,prepW,.16,.88,edge);
 box('kitchen-back',prepX,.52,prepZ-.41,prepW,.80,.06,edge);
 for(const s of [-1,1])box('kitchen-side',prepX+s*(prepW/2-.03),.52,prepZ,.06,.80,.88,edge);
 for(const dx of [-1,1]){
  box('kitchen-door',prepX+dx*prepW*.245,.49,prepZ+.46,prepW*.46,.72,.055,wood);
  box('kitchen-pull',prepX+dx*.16,.70,prepZ+.51,.16,.045,.05,iron);
 }
 const sinkX=prepX-.27,sinkW=.82,sinkD=.58,topLeft=prepX-(prepW+.08)/2,topRight=prepX+(prepW+.08)/2;
 const leftW=sinkX-sinkW/2-topLeft,rightW=topRight-sinkX-sinkW/2;
 box('kitchen-worktop',topLeft+leftW/2,.95,prepZ,leftW,.10,.98,cream);
 box('kitchen-worktop',topRight-rightW/2,.95,prepZ,rightW,.10,.98,cream);
 for(const s of [-1,1])box('kitchen-worktop',sinkX,.95,prepZ+s*(sinkD/2+.10),sinkW,.10,.20,cream);
 solid('kitchen',prepX,prepZ,prepW+.08,.98,1.01);
 box('sink-bowl-floor',sinkX,.80,prepZ,.76,.035,.52,iron);
 for(const s of [-1,1]){
  box('sink-bowl-wall',sinkX+s*.39,.90,prepZ,.04,.20,.56,0x6b8178);
  box('sink-bowl-wall',sinkX,.90,prepZ+s*.27,.76,.20,.04,0x6b8178);
  box('sink-rim',sinkX+s*.39,1.007,prepZ,.065,.026,.61,0x83948a);
  box('sink-rim',sinkX,1.007,prepZ+s*.27,.76,.026,.065,0x83948a);
 }
 cylinder('sink-drain',sinkX,.821,prepZ,.055,.008,0x303f39);
 k.rod([b.x+prepX-.27,floor+1.03,b.z+prepZ-.28],[b.x+prepX-.27,floor+1.34,b.z+prepZ-.28],.027,iron);
 k.rod([b.x+prepX-.27,floor+1.34,b.z+prepZ-.28],[b.x+prepX-.27,floor+1.34,b.z+prepZ-.03],.027,iron);
 k.rod([b.x+sinkX,floor+1.34,b.z+prepZ-.03],[b.x+sinkX,floor+1.26,b.z+prepZ-.03],.027,iron);
 box('tap-lever',sinkX+.10,1.08,prepZ-.30,.16,.045,.045,iron);
 box('folded-tea-towel',prepX+prepW*.32,1.022,prepZ+.06,.32,.035,.47,0x8c9d88);
 if(!special){
  cylinder('ceramic-jug',prepX+.65,1.15,prepZ-.08,.13,.28,0xac8061);
  // The work table also serves as the dining table. Chairs face its surface.
  const chairZ=-1.25;
  for(const x of [workX-.65,workX+.65]){
   box('dining-chair-seat',x,.48,chairZ,.62,.11,.64,wood);
   for(const dx of [-.23,.23])for(const dz of [-.23,.23])box('dining-chair-leg',x+dx,.22,chairZ+dz,.07,.44,.07,edge);
   box('dining-chair-back',x,.89,chairZ+.28,.62,.67,.10,wood);
   solid('dining-chair-'+x,x,chairZ,.64,.72,1.23);
  }
  if(profile?.kind==='linen'){
   box('sewing-workcloth',workX,.948,-2.6,1.90,.035,.85,profile.colour);
   for(const x of [workX-.48,workX-.22]){cylinder('thread-spool',x,1.04,-2.84,.075,.15,cream);cylinder('spool-end',x,1.122,-2.84,.095,.018,wood);}
   // A broad open work basket survives the low-resolution entry view. Its
   // cloth and rim stay on the existing table, with no new floor obstacle.
   const bx=workX+.55,bz=-2.55;
   box('sewing-basket-bottom',bx,.993,bz,.70,.055,.57,edge);
   for(const dx of [-.33,.33])box('sewing-basket-rim',bx+dx,1.11,bz,.055,.24,.57,wood);
   for(const dz of [-.26,.26])box('sewing-basket-rim',bx,1.11,bz+dz,.64,.24,.055,wood);
   box('basket-linen',bx,1.11,bz,.53,.16,.42,cream);
   box('basket-linen-fold',bx+.06,1.205,bz+.08,.42,.035,.25,profile.colour);
   for(const dx of [-.26,.26])k.rod([b.x+bx+dx,floor+1.18,b.z+bz],[b.x+bx+dx*.65,floor+1.47,b.z+bz],.035,edge);
   k.rod([b.x+bx-.17,floor+1.47,b.z+bz],[b.x+bx+.17,floor+1.47,b.z+bz],.035,edge);
   for(const dx of [-.08,.08])k.rod([b.x+workX+dx,floor+.98,b.z-2.4],[b.x+workX-dx,floor+.98,b.z-2.15],.017,iron);
  }else if(profile?.kind==='remedies'){
   box('care-ledger-cover',workX+.43,.94,-2.55,.90,.045,.65,edge);
   for(const dx of [-.22,.22])box('care-ledger-page',workX+.43+dx,.969,-2.55,.42,.018,.60,cream);
   box('remedy-tray',workX-.56,.95,-2.83,.92,.07,.53,iron);
   for(const dz of [-.24,.24])box('remedy-tray-lip',workX-.56,1.00,-2.83+dz,.92,.10,.035,iron);
   for(let i=0;i<3;i++){const xx=workX-.86+i*.30,h=[.32,.43,.35][i];cylinder('remedy-bottle',xx,.985+h/2,-2.83,.10,h,i%2?0x8d6d5b:0x658274);cylinder('remedy-stopper',xx,1.005+h,-2.83,.068,.04,cream);box('remedy-label',xx,.985+h*.48,-2.723,.13,.12,.018,cream);}
   box('clean-gauze',workX+.72,1.013,-2.5,.30,.07,.46,cream);
  }else{
   k.add('basin',b.x+workX+.72,floor+.941,b.z-2.6,.24,.052,.24,cream);k.lastRole('dinner-plate');
   const mugX=workX+.12,mugZ=-2.85,mugColour=0x7a9789;
   k.add('mug',b.x+mugX,floor+1.035,b.z+mugZ,.105,.24,.105,mugColour);k.lastRole('drinking-mug');
   // Thick angular handle joins the wall at both ends; the cup stays hollow.
   for(const y of [.985,1.115])k.rod([b.x+mugX+.09,floor+y,b.z+mugZ],[b.x+mugX+.175,floor+y,b.z+mugZ],.022,mugColour);
   k.rod([b.x+mugX+.175,floor+.985,b.z+mugZ],[b.x+mugX+.175,floor+1.115,b.z+mugZ],.022,mugColour);
   box('bread-board',workX-.60,.946,-2.54,.68,.035,.54,wood);
   k.add('rock',b.x+workX-.60,floor+1.04,b.z-2.54,.44,.19,.30,0xb19867);k.lastRole('household-loaf');
  }
 }
 const bedX=side*(b.w/2-2),bedZ=back+2.4;
 // A nightstand beside the foot, rather than inside the bed or an aisle.
 const nx=bedX-side*1.65,nz=bedZ+.65;
 box('bedside-cabinet',nx,.38,nz,.72,.76,.74,wood);
 box('bedside-drawer',nx,.48,nz+.38,.61,.23,.035,cream);
 box('bedside-pull',nx,.48,nz+.41,.14,.035,.035,iron);
 solid('bedside-cabinet',nx,nz,.72,.74,.78);
 cylinder('bedside-lamp-base',nx,.80,nz,.13,.07,iron);
 cylinder('bedside-lamp-stem',nx,.98,nz,.028,.31,iron);
 cylinder('bedside-lamp-shade',nx,1.17,nz,.23,.23,cream);
 // A finished shade has a lower rim; the unlit lamp and a dog-eared book
 // tell a quiet domestic story without introducing lights or floor clutter.
 cylinder('lamp-shade-rim',nx,1.06,nz,.235,.035,wood);
 box('bedside-book-cover',nx+.20,.802,nz+.23,.24,.035,.24,profile?.colour||iron);
 box('bedside-book-pages',nx+.20,.833,nz+.23,.22,.028,.22,cream);
 box('bedside-book-cover',nx+.20,.855,nz+.23,.24,.018,.24,profile?.colour||iron);
 // A low sideboard occupies the side wall, beyond the loose supply position.
 const sx=-b.w/2+.68,sz=1.6;
 box('linen-sideboard',sx,.53,sz,.78,1.06,1.70,wood);
 for(const z of [sz-.42,sz+.42]){
  box('linen-door',sx+.41,.56,z,.045,.86,.76,cream);
  box('linen-pull',sx+.45,.65,z,.04,.05,.14,iron);
 }
 solid('linen-sideboard',sx,sz,.86,1.70,1.09);
 box('folded-linen',sx,1.11,sz-.27,.57,.08,.69,0xa3ad92);
 box('folded-linen',sx,1.19,sz-.24,.52,.08,.61,cream);
 // Low trim and broad woven bands read at 320p without extra textures/lights.
 for(const s of [-1,1])box('interior-skirting',s*(b.w/2-.24),.12,0,.07,.24,b.d-.5,edge);
 for(const x of [-1.30,1.30])box('woven-rug-band',x,.047,1,.065,.018,2.68,cream);
 for(const s of [-1,1]){
  const windows=houseShell(b).windows.filter(w=>w.side===(s===1?2:3));
  const window=windows.sort((a,c)=>Math.abs(a.u-bedZ)-Math.abs(c.u-bedZ))[0];
  if(!window)continue;
  const wx=s*(b.w/2-.31),shade=profile?.colour||(b.seed%2?0x8b9e8b:0xa78e72);
  for(const end of [-1,1]){
   box('gathered-window-curtain',wx,1.72,window.u+end*.55,.12,1.57,.20,shade);
   box('curtain-tie',wx-s*.075,1.40,window.u+end*.55,.035,.10,.22,cream);
  }
  k.rod([b.x+wx,floor+2.56,b.z+window.u-.78],[b.x+wx,floor+2.56,b.z+window.u+.78],.025,edge);
 }
 const entryZ=b.d/2-1.1;
 if(profile){
  // The door's mat remains flat and clear. Boots live beneath the bench,
  // within its existing solid footprint, rather than becoming aisle hazards.
  box('entry-coir-mat',0,.025,entryZ,2.22,.035,1.02,0x776748);
  for(const x of [-.88,-.44,0,.44,.88])box('entry-mat-weave',x,.046,entryZ,.035,.008,.90,0x9c8a60);
  // A usable entry bench gives the household's supplies an authored place.
  box('scavenging-bench-top',3,.65,entryZ,2.4,.10,.92,wood);
  for(const x of [2.02,3.98])for(const dz of [-.32,.32])box('scavenging-bench-leg',x,.30,entryZ+dz,.12,.60,.12,edge);
  solid('scavenging-bench',3,entryZ,2.4,.92,.70);
  for(const x of [2.65,2.95]){
   box('work-boot-sole',x,.047,entryZ+.06,.23,.075,.48,iron);
   box('work-boot-foot',x,.14,entryZ+.06,.21,.15,.44,edge);
   box('work-boot-shaft',x,.27,entryZ-.08,.20,.26,.22,wood);
   box('work-boot-cuff',x,.40,entryZ-.08,.22,.045,.24,iron);
  }
  // A calendar sits only on a solid back-wall pier. Respect every real
  // window opening, including narrower homes with a central kitchen window.
  const piers=[0,-b.w*.25,b.w*.25].filter(x=>!houseShell(b).windows.some(w=>w.side===1&&Math.abs(w.u-x)<1.03));
  if(piers.length){const x=piers[0],z=-b.d/2+.225;
   box('household-calendar-frame',x,2.03,z,.74,.84,.055,edge);
   box('household-calendar-paper',x,2.03,z+.035,.64,.74,.018,cream);
   box('household-calendar-heading',x,2.29,z+.047,.57,.10,.008,profile.colour);
   for(let row=0;row<3;row++)for(let col=0;col<4;col++)box('household-calendar-days',x-.21+col*.14,2.10-row*.13,z+.049,.055,.045,.008,row===1&&col===b.seed%4?0x995b45:0x7e8064);
  }
  box('household-hook-board',2.7,1.92,b.d/2-.25,1.6,.22,.09,profile.colour);
  for(const x of [2.2,2.7,3.2])box('coat-hook',x,1.90,b.d/2-.38,.055,.13,.22,iron);
  box('hanging-work-cloth',3.2,1.51,b.d/2-.39,.39,.69,.08,profile.colour);
  if(profile.kind==='pantry')for(const [x,h]of [[2.15,.30],[3.83,.23]]){cylinder('pantry-preserving-jar',x,.72+h/2,entryZ-.07,.12,h,0x82936c);cylinder('jar-lid',x,.73+h,entryZ-.07,.13,.035,cream);}
  if(profile.kind==='linen')for(let i=0;i<3;i++)box('household-folded-blanket',2.12,.75+i*.09,entryZ,.38,.08,.62,i%2?cream:profile.colour);
  if(profile.kind==='remedies'){box('medical-tin',2.1,.83,entryZ,.42,.25,.45,cream);box('medical-tin-cross',2.1,.964,entryZ,.26,.018,.07,0x995b45);box('medical-tin-cross',2.1,.965,entryZ,.07,.018,.26,0x995b45);}
  if(profile.kind==='workshop'){box('repair-cloth',3.88,.72,entryZ,.42,.035,.61,profile.colour);box('repair-hammer-handle',2.22,1.65,b.d/2-.42,.07,.50,.07,wood);box('repair-hammer-head',2.22,1.91,b.d/2-.42,.34,.14,.14,cream);}
 }
 return {kitchen:{x:prepX,z:prepZ},bedside:{x:nx,z:nz}};
}
