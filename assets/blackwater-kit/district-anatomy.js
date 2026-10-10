// Use-specific silhouettes, compiled into the existing shared material batches.
export function districtAnatomy(s) {
 const variant=Math.abs(s.seed)%3;
 if(s.label==='EVACUATION OFFICE')return {family:'civic',roof:'civic-stepped-tower',variant,wall:'render',facade:'civic-hall'};
 if(s.label==='TERMINUS CAFE'||s.label==='HARBOR HARDWARE')return {family:'main-street',roof:s.label==='TERMINUS CAFE'?'civic-neighbor-tile':'civic-neighbor-slate',variant,wall:'brick'};
 if(s.label==='BLACKWATER MARKET'||s.label==='PIER & MAIN')return {family:'main-street',roof:'merchant-gable',variant,wall:'brick'};
 if(s.label==='EAST END LAUNDRY')return {family:'main-street',roof:'laundry-gable',variant,wall:'render',facade:'laundry-order'};
 if(s.label==='LAST STOP GROCER')return {family:'main-street',roof:'merchant-gable',variant,wall:'brick',facade:'grocer-arches'};
 if(/^EAST WORKS (49|58|67) \/ WAREHOUSE$/.test(s.label))return {family:'warehouse',roof:s.label.includes('58')?'hangar-asymmetric':s.label.includes('67')?'hangar-monitor':'hangar-steep',variant,wall:s.label.includes('58')?'brick':s.label.includes('49')?'masonry':'render',facade:'works-hall'};
 if(s.label==='EAST WORKS 55 / WAREHOUSE')return {family:'warehouse',roof:'sawtooth',variant,wall:'brick',facade:'works-hall'};
 if(/WAREHOUSE/.test(s.label))return {family:'warehouse',roof:'sawtooth',variant,wall:'render',...(s.districtProfile?{facade:'works-hall'}:{})};
 if(/WORKSHOP/.test(s.label))return {family:'workshop',roof:variant===1?'sawtooth':'monitor',variant,wall:'masonry',...(s.districtProfile?{facade:'works-hall'}:{})};
 if(/CLINIC|MEDICAL/.test(s.label))return {family:'clinic',roof:'service-pavilion',variant,wall:'render'};
 if(/APARTMENTS/.test(s.label))return {family:'apartment',roof:s.districtProfile?'district-mass':variant===0?'terrace':variant===1?'mansard':'setback-pavilion',variant,wall:s.districtProfile==='stucco-bay'?'render':['brick-mansard','terraced-court'].includes(s.districtProfile)?'brick':variant===1?'render':'brick'};
 return {family:s.kind==='house'?'cottage':'main-street',roof:s.kind==='house'?'pitched':'parapet',variant,wall:'brick'};
}

export function compileCivicHallFacade(w,plan,facadeFrame){
 const s=plan.settings,low=5.1,high=s.height-2.0,y=(low+high)/2;
 // A civic hall has one tall upper window order, rather than the residential
 // floor grid. The opaque sill wall starts above the sealed playable ceiling.
 for(const side of ['front','back','left','right']){
  const face=facadeFrame(side,s.width,s.depth),count=Math.max(2,Math.round(face.span/4)),bay=face.span/count;
  for(let i=0;i<count;i++){
   const x=-face.span/2+bay*(i+.5),opening=bay-1.20;
   face.box(w,'render',x,(3.5+low)/2,-.21,[bay,low-3.5,.26],'civic-hall-sill-wall');
   face.box(w,'render',x,(high+s.height)/2,-.21,[bay,s.height-high,.26],'civic-hall-attic-wall');
   for(const sign of [-1,1])face.box(w,'masonry',x+sign*(opening/2+.30),y,-.20,[.60,high-low,.30],'civic-hall-bearing-pier');
   face.box(w,'dark',x,y,-.29,[opening,high-low,.06],'civic-hall-window-reveal');
   face.box(w,'glass',x,y,-.255,[opening-.16,high-low-.20,.035],'civic-hall-tall-glazing');
   for(const dx of [-opening/2,0,opening/2])face.box(w,'pale',x+dx,y,-.12,[.12,high-low+.18,.20],'civic-hall-window-jamb');
   for(const height of [low,low+(high-low)*.36,high])face.box(w,'pale',x,height,-.12,[opening+.12,.15,.20],'civic-hall-window-transom');
  }
  face.box(w,'pale',0,4.25,-.12,[face.span,.32,.20],'civic-hall-continuous-sill-belt');
 }
}

export function compileOldtownFacades(w,plan,facadeFrame,wallWithWindows,rng){
 const s=plan.settings,kind=plan.anatomy.facade;
 if(!['laundry-order','grocer-arches'].includes(kind))return;
 for(let floor=1;floor<plan.floors;floor++){
  const y0=3.5+(floor-1)*plan.upperFloorHeight,h=plan.upperFloorHeight;
  for(const side of ['front','back','left','right']){
   const face=facadeFrame(side,s.width,s.depth),count=Math.max(2,Math.round(face.span/4)),bay=face.span/count;
   if(kind==='laundry-order'){
    wallWithWindows(w,face,y0,h,count,rng,'render',false,-1,false,[],2.35);
    for(let i=0;i<=count;i++){
     const x=Math.max(-face.span/2+.26,Math.min(face.span/2-.26,-face.span/2+i*bay));
     face.box(w,'brick',x,y0+h/2,-.13,[.42,h,.24],'laundry-continuous-bearing-pilaster');
    }
    face.box(w,'pale',0,y0+.10,-.09,[face.span,.24,.17],'laundry-stone-storey-band');
    continue;
   }
   const r=.85,low=y0+.48,spring=y0+h*.65,high=spring+r;
   for(let i=0;i<count;i++){
    const x=-face.span/2+bay*(i+.5),sideWidth=(bay-r*2)/2;
    face.box(w,'brick',x,(y0+low)/2,-.21,[bay,low-y0,.26],'grocer-arched-lower-infill');
    face.box(w,'brick',x,(high+y0+h)/2,-.21,[bay,y0+h-high,.26],'grocer-arched-upper-infill');
    for(const sign of [-1,1])face.box(w,'brick',x+sign*(r+sideWidth/2),(low+high)/2,-.21,[sideWidth,high-low,.26],'grocer-arched-bearing-pier');
    face.box(w,'dark',x,(low+spring)/2,-.32,[r*2,spring-low,.06],'grocer-deep-window-reveal');
    face.box(w,'glass',x,(low+spring)/2,-.235,[r*2-.10,spring-low-.10,.035],'grocer-arched-window-glazing');
    // Solid infill is compiled around the curved void; no rectangular wall
    // remains behind the arch. Stone voussoirs have actual radial returns.
    const segments=6;
    for(let a=0;a<segments;a++){
     const t0=Math.PI-a*Math.PI/segments,t1=Math.PI-(a+1)*Math.PI/segments;
     const p0=[x+Math.cos(t0)*r,spring+Math.sin(t0)*r],p1=[x+Math.cos(t1)*r,spring+Math.sin(t1)*r];
     w.polygon('brick',face,[p0,p1,[p1[0],high],[p0[0],high]],-.21,.26,'grocer-curved-head-infill');
     const outer0=[x+Math.cos(t0)*(r+.16),spring+Math.sin(t0)*(r+.16)],outer1=[x+Math.cos(t1)*(r+.16),spring+Math.sin(t1)*(r+.16)];
     w.polygon('pale',face,[p0,p1,outer1,outer0],-.085,.14,'grocer-stone-arch-voussoir');
     for(const [slot,out]of [['dark',-.32],['glass',-.235]])w.triangle(slot,[face.point(x,spring,out),face.point(...p1,out),face.point(...p0,out)],'grocer-arched-window-head');
    }
    face.box(w,'wood',x,(low+spring+r)/2,-.19,[.09,spring+r-low,.08],'grocer-arched-window-mullion');
    face.box(w,'wood',x,spring,-.19,[r*2,.10,.08],'grocer-arched-window-transom');
    face.box(w,'pale',x,low-.075,-.085,[r*2+.26,.15,.17],'grocer-deep-stone-sill');
   }
  }
 }
}

export function createDistrictUpperMassPlan(s,floors,storey){
 if(!s.districtProfile||!/APARTMENTS/.test(s.label))return null;
 const levels=[];
 for(let floor=1;floor<floors;floor++){
  const inset=s.districtProfile!=='brick-mansard'&&floor>=3&&floors>=4,cap=floor>=5&&s.districtProfile==='terraced-court';
  const width=s.width*(cap?.70:inset?.84:1),depth=s.depth*(cap?.52:inset?.68:1);
  const x=inset?(s.districtProfile==='corner-step'?-1:1)*Math.min(.60,(s.width-width)/2-.1):0;
  const z=inset?-(s.depth-depth)/2+.25:0;
  levels.push({floor,y:3.5+(floor-1)*storey,height:storey,width,depth,x,z});
 }
 const loggia=s.label==='SALTWIND 32 / APARTMENTS'?{side:'front',bays:[2,3],clearWidth:4.9,recess:1.4,returnWidth:.75,pierWidth:.45}:null;
 return{profile:s.districtProfile,levels,top:levels.at(-1),loggia,roof:s.districtProfile==='brick-mansard'?'mansard':s.districtProfile==='stucco-bay'?'compact-hip':s.districtProfile.endsWith('gable')?'pitched':'terrace',roofFeature:s.label==='SALTWIND 12 / APARTMENTS'?'pergola':null};
}

function shiftedWriter(w,x,z){
 return{...w,box(slot,p,size,rotation,role){w.box(slot,[p[0]+x,p[1],p[2]+z],size,rotation,role);},triangle(slot,points,role){w.triangle(slot,points.map(p=>[p[0]+x,p[1],p[2]+z]),role);}};
}
function terraceRing(w,lower,upper,y){
 const ax=lower.x-lower.width/2,bx=lower.x+lower.width/2,az=lower.z-lower.depth/2,bz=lower.z+lower.depth/2;
 const cx=upper.x-upper.width/2,dx=upper.x+upper.width/2,cz=upper.z-upper.depth/2,dz=upper.z+upper.depth/2;
 for(const [x0,x1,z0,z1]of [[ax,cx,az,bz],[dx,bx,az,bz],[cx,dx,az,cz],[cx,dx,dz,bz]]){
  if(x1-x0>.05&&z1-z0>.05)w.box('roof',[(x0+x1)/2,y,(z0+z1)/2],[x1-x0,.16,z1-z0],[0,0,0],'district-exposed-terrace-deck');
 }
 for(const [side,x,z,width,depth]of [['front',lower.x,bz-.12,lower.width,.22],['back',lower.x,az+.12,lower.width,.22],['left',ax+.12,lower.z,.22,lower.depth],['right',bx-.12,lower.z,.22,lower.depth]]){
  w.box('brick',[x,y+.48,z],[width,.88,depth],[0,0,0],'district-terrace-bearing-parapet');
  w.box('pale',[x,y+.95,z],[width,.13,depth],[0,0,0],'district-terrace-coping');
 }
 // Broad raised planters make the terrace inhabitable without filling it
 // with tiny furniture, and remain wholly above the inaccessible ceiling.
 if(bz-dz>2.3)for(const x of [ax+1.6,bx-1.6]){
  w.box('masonry',[x,y+.32,bz-1.3],[1.75,.64,1.05],[0,0,0],'district-terrace-planter');
  w.box('dark',[x,y+.66,bz-1.3],[1.50,.06,.82],[0,0,0],'district-terrace-planter-soil');
 }
}

export function compileDistrictUpperMass(w,plan,facadeFrame,wallWithWindows,rng){
 const p=plan.upperMassPlan,s=plan.settings;
 if(!p)return;
 for(const [index,level]of p.levels.entries()){
  const local=shiftedWriter(w,level.x,level.z);
  for(const side of ['front','left','right','back']){
   const face=facadeFrame(side,level.width,level.depth),bays=Math.max(2,Math.round(face.span/(p.profile==='brick-mansard'?3.15:3.8)));
   const oriels=p.profile==='stucco-bay'&&side==='front'?[0,bays-1]:[];
   const loggia=p.loggia?.side===side?p.loggia:null;
   const omitted=loggia?loggia.bays:oriels;
   wallWithWindows(local,face,level.y,level.height,bays,rng,plan.anatomy.wall,false,-1,false,omitted);
   for(const bayIndex of oriels){
    const bay=level.width/bays,x=-level.width/2+bay*(bayIndex+.5),body=shiftedWriter(local,x,level.depth/2+.06);
    // The selected facade bay is omitted above, and its window wall is
    // rebuilt 60 cm forward with full bearing cheeks and a continuous sill.
    wallWithWindows(body,facadeFrame('front',bay,1.20),level.y,level.height,1,rng,'render',false,-1,false,[],Math.min(2.5,bay-.80));
    for(const sign of [-1,1])body.box('render',[sign*(bay/2-.11),level.y+level.height/2,.12],[.22,level.height,.96],[0,0,0],'stucco-oriel-bearing-cheek');
    body.box('masonry',[0,level.y+.05,.15],[bay,.16,1.05],[0,0,0],'stucco-oriel-continuous-sill');
    body.box('pale',[0,level.y+level.height-.02,.15],[bay,.19,1.05],[0,0,0],'stucco-oriel-cornice');
   }
   if(loggia){
    const bay=face.span/bays,left=-face.span/2+bay*loggia.bays[0],right=left+bay*loggia.bays.length;
    const center=(left+right)/2,width=right-left,clear=loggia.clearWidth,recess=loggia.recess;
    // Omitted bays are a true negative volume. The sole closing wall stands
    // behind the covered walk, with genuine inset window apertures and glass.
    const back=shiftedWriter(local,center,-recess-.10);
    wallWithWindows(back,facadeFrame('front',clear,level.depth),level.y,level.height,2,rng,'brick',false,-1,false,[],1.95);
    for(const sign of [-1,1])face.box(local,'brick',center+sign*(clear/2+loggia.returnWidth/2),level.y+level.height/2,-recess/2-.16,[loggia.returnWidth,level.height,recess+.32],'loggia-deep-bearing-return');
    face.box(local,'brick',center,level.y+level.height/2,-.23,[loggia.pierWidth,level.height,.48],'loggia-continuous-bearing-pier');
    face.box(local,'masonry',center,level.y+.08,-recess/2-.14,[width,.19,recess+.28],'loggia-bearing-floor-slab');
    face.box(local,'pale',center,level.y+level.height-.10,-recess/2-.14,[width,.20,recess+.28],'loggia-covered-soffit');
    for(const sign of [-1,1]){
     const guardWidth=(clear-loggia.pierWidth)/2,guardCenter=center+sign*(loggia.pierWidth/2+guardWidth/2);
     face.box(local,'brick',guardCenter,level.y+.48,-.21,[guardWidth,.68,.26],'loggia-solid-balustrade');
     face.box(local,'pale',guardCenter,level.y+.86,-.19,[guardWidth,.12,.30],'loggia-balustrade-coping');
     face.box(local,'metal',guardCenter,level.y+1.04,-.18,[guardWidth,.055,.06],'loggia-guard-rail');
     for(const end of [-1,1])face.box(local,'metal',guardCenter+end*(guardWidth/2-.10),level.y+.94,-.18,[.055,.22,.06],'loggia-guard-stanchion');
    }
    for(const [a,b]of [[-face.span/2,left],[right,face.span/2]])if(b-a>.01)face.box(local,'brick',(a+b)/2,level.y+.10,-.08,[b-a,.20,.15],'district-storey-bearing-band');
   }else if(p.profile!=='stucco-bay')face.box(local,p.profile==='brick-mansard'?'brick':'pale',0,level.y+.10,-.08,[face.span,.20,.15],'district-storey-bearing-band');
  }
  const next=p.levels[index+1];
  if(next&&(next.width!==level.width||next.depth!==level.depth))terraceRing(w,level,next,level.y+level.height-.08);
 }
 const top=p.top,roofY=top.y+top.height;
 w.box('roof',[top.x,roofY-.10,top.z],[top.width-.30,.18,top.depth-.30],[0,0,0],'district-upper-roof-deck');
 const local=shiftedWriter(w,top.x,top.z);
 for(const side of ['front','left','right','back']){
  const face=facadeFrame(side,top.width,top.depth);
  face.box(local,'pale',0,roofY-.13,-.10,[face.span,.28,.19],'district-upper-cornice');
  if(p.roof==='terrace'){
   face.box(local,'brick',0,roofY+.40,-.18,[face.span,.80,.30],'district-top-parapet');
   face.box(local,'pale',0,roofY+.85,-.18,[face.span,.13,.33],'district-top-coping');
  }
 }
 if(p.roof==='terrace'&&p.roofFeature==='pergola'&&top.width>8){
  const x=top.x,z=top.z-.6,width=top.width*.60,depth=top.depth*.55;
  for(const side of [-1,1])for(const end of [-1,1])w.box('wood',[x+side*width/2,roofY+1,z+end*depth/2],[.16,2,.16],[0,0,0],'district-roof-pergola-post');
  for(let i=0;i<5;i++)w.box('wood',[x-width/2+width*i/4,roofY+2.04,z],[.14,.18,depth+.15],[0,0,0],'district-roof-pergola-beam');
 }
 // Eave hardware follows the actual top mass. Pipes descend on its rear
 // bearing wall and stop above the playable sealed ceiling.
 if(p.roof!=='terrace'){
  const left=top.x-top.width/2+.13,right=top.x+top.width/2-.13,back=top.z-top.depth/2+.13,front=top.z+top.depth/2-.13;
  for(const x of [left,right])w.cylinder('metal',[x,roofY+.04,back],[x,roofY+.04,front],.065,'district-roof-rain-gutter');
  for(const x of [left,right]){
   w.cylinder('rust',[x,3.55,back],[x,roofY+.02,back],.045,'district-bearing-wall-downpipe');
   for(let y=5;y<roofY;y+=3.0)w.box('metal',[x,y,back],[.15,.08,.14],[0,0,0],'district-downpipe-clamp');
  }
 }
}

export function compileWorksHallFacade(w,plan,facadeFrame){
 const s=plan.settings,a=plan.anatomy,low=s.height-2.8,high=s.height-1.0,y=(low+high)/2;
 for(const side of ['front','back','left','right']){
  const face=facadeFrame(side,s.width,s.depth),count=Math.max(2,Math.round(face.span/7)),bay=face.span/count;
  for(let i=0;i<count;i++){
   const x=-face.span/2+bay*(i+.5),opening=bay-1.30;
   face.box(w,a.wall,x,(3.5+low)/2,-.21,[bay,low-3.5,.26],'works-hall-solid-spandrel');
   face.box(w,a.wall,x,(high+s.height)/2,-.21,[bay,s.height-high,.26],'works-hall-upper-infill');
   for(const direction of [-1,1])face.box(w,a.wall,x+direction*(opening/2+.325),y,-.21,[.65,high-low,.26],'works-hall-window-infill');
   face.box(w,'dark',x,y,-.32,[opening,high-low,.06],'works-hall-glazing-recess');
   if(side==='back'&&i===count-1){
    for(let slat=0;slat<9;slat++)face.box(w,'metal',x,low+.13+slat*.19,-.15,[opening-.1,.095,.16],'works-hall-louver');
   }else{
    for(let pane=0;pane<3;pane++){
     const px=x-opening/2+opening*(pane+.5)/3;
     face.box(w,'glass',px,y,-.27,[opening/3-.08,high-low-.18,.035],'works-hall-broad-glazing');
    }
   }
   for(const dx of [-opening/2,opening/2])face.box(w,'metal',x+dx,y,-.12,[.11,high-low+.12,.20],'works-hall-steel-window-jamb');
   for(const dy of [low,high])face.box(w,'metal',x,dy,-.12,[opening+.11,.11,.20],'works-hall-steel-window-header');
  }
  for(let i=0;i<=count;i++){
   const x=Math.max(-face.span/2+.5,Math.min(face.span/2-.5,-face.span/2+i*bay));
   face.box(w,'masonry',x,(3.5+s.height+.44)/2,-.30,[1.0,s.height+.44-3.5,.60],'works-hall-bearing-pier');
  }
  for(const height of [3.68,s.height-.48])face.box(w,'rust',0,height,-.16,[face.span-.08,.28,.28],'works-hall-continuous-ring-beam');
 }
}

export function compileDistrictAnatomy(w,plan,facadeFrame) {
 const s=plan.settings,a=plan.anatomy;
 if(plan.upperMassPlan)return;
 if(a.family==='main-street'||a.family==='cottage'||a.family==='civic')return;
 const front=facadeFrame('front',s.width,s.depth);
 if(a.family==='warehouse'||a.family==='workshop'){
  // Upper frame stays above the playable doors and entirely within the lot.
  for(const face of a.facade==='works-hall'?[]:[front,facadeFrame('back',s.width,s.depth)]){
   const bays=Math.max(2,Math.round(face.span/4.5));
   for(let i=0;i<=bays;i++){
    const x=Math.max(-face.span/2+.19,Math.min(face.span/2-.19,-face.span/2+i*face.span/bays));
    face.box(w,'masonry',x,(s.height+3.5)/2,-.10,[.28,s.height-3.5,.18],'industrial-frame-pier');
   }
   face.box(w,'metal',0,s.height-.5,-.10,[face.span-.3,.32,.16],'industrial-ring-beam');
  }
  if(a.roof.startsWith('hangar-'))return;
  if(a.roof==='sawtooth'){
   const rows=a.family==='warehouse'?3:2,span=(s.depth-.8)/rows,rise=2.15;
   for(let row=0;row<rows;row++){
    const z=-s.depth/2+.4+row*span,angle=Math.atan2(rise,span);
    w.box('roofZinc',[0,s.height+rise/2,z+span/2],[s.width-.8,.13,Math.hypot(rise,span)],[angle,0,0],'factory-sawtooth-roof',{type:1,eave:[-(s.width-.8)/2,0,Math.hypot(rise,span)/2],along:[1,0,0],up:[0,0,-1],run:Math.hypot(rise,span),topOnly:true});
    w.box('dark',[0,s.height+rise/2,z+.015],[s.width-.9,rise,.08],[0,0,0],'factory-clerestory-reveal');
    w.box('glass',[0,s.height+rise/2,z+.068],[s.width-1.1,rise-.26,.035],[0,0,0],'factory-clerestory-glass');
    for(let x=-s.width/2+.55;x<s.width/2-.4;x+=2.2)w.box('metal',[x,s.height+rise/2,z+.10],[.075,rise,.08],[0,0,0],'factory-clerestory-mullion');
    w.box('metal',[0,s.height+rise+.03,z],[s.width-.7,.12,.20],[0,0,0],'factory-ridge-flashing');
    for(const side of [-1,1]){
     const x=side*(s.width/2-.42),p=[[x,s.height,z],[x,s.height,z+span],[x,s.height+rise,z]];
     w.triangle('metal',side>0?[...p].reverse():p,'factory-roof-end');
    }
   }
  }else{
   const half=s.width/2-.5,rise=2.25,angle=Math.atan2(rise,half);
   for(const side of [-1,1])w.box('roofZinc',[side*half/2,s.height+rise/2,0],[Math.hypot(half,rise),.13,s.depth-.8],[0,0,-side*angle],'workshop-pitched-roof',{type:1.25,eave:[side*Math.hypot(half,rise)/2,0,-(s.depth-.8)/2],along:[0,0,1],up:[-side,0,0],run:Math.hypot(half,rise),topOnly:true});
   for(const z of [-s.depth/2+.42,s.depth/2-.42]){
    const p=[[-half,s.height,z],[half,s.height,z],[0,s.height+rise,z]];
    w.triangle('metal',z>0?p:[...p].reverse(),'workshop-gable');
   }
   w.box('metal',[0,s.height+rise+.45,0],[2.3,.9,s.depth*.55],[0,0,0],'workshop-ridge-monitor');
   for(const side of [-1,1])w.box('glass',[side*1.16,s.height+rise+.48,0],[.035,.53,s.depth*.50],[0,0,0],'workshop-monitor-glass');
   w.box('roofZinc',[0,s.height+rise+.96,0],[2.65,.15,s.depth*.59],[0,0,0],'workshop-monitor-cap');
  }
 }else{
  // Real balcony returns cast shadows under one metre from the facade; all
  // support geometry remains above head height, clear of street circulation.
  if(a.family==='apartment')for(let floor=1;floor<plan.floors;floor++){
   const y=3.5+(floor-1)*plan.upperFloorHeight+.25;
   for(const x of [-s.width*.28,s.width*.28]){
    const width=Math.min(3.5,s.width*.28);
    front.box(w,'masonry',x,y,.32,[width,.20,.82],'apartment-balcony-slab');
    front.box(w,'pale',x,y+.65,.70,[width,.78,.13],'apartment-balcony-parapet');
    for(const side of [-1,1])front.box(w,'pale',x+side*(width/2-.07),y+.65,.30,[.13,.78,.85],'apartment-balcony-return');
   }
  }
  if(a.roof==='terrace'){
   const x=-s.width*.18,z=-s.depth*.14,width=s.width*.46,depth=s.depth*.42;
   for(const side of [-1,1])for(const end of [-1,1])w.box('wood',[x+side*width/2,s.height+1,z+end*depth/2],[.16,2,.16],[0,0,0],'roof-terrace-pergola-post');
   for(let i=0;i<7;i++)w.box('wood',[x-width/2+width*i/6,s.height+2.04,z],[.14,.18,depth+.2],[0,0,0],'roof-terrace-pergola-beam');
  }else if(a.roof!=='mansard'){
   const width=s.width*(a.family==='clinic'?.64:.55),depth=s.depth*.47,h=a.family==='clinic'?1.8:2.45,z=-s.depth*.12;
   w.box('render',[0,s.height+h/2,z],[width,h,depth],[0,0,0],'setback-roof-pavilion');
   w.box('roof',[0,s.height+h+.12,z],[width+.35,.24,depth+.35],[0,0,0],'setback-pavilion-coping');
   for(let i=0;i<3;i++){
    const x=(i-1)*width*.27;
    w.box('dark',[x,s.height+h*.53,z+depth/2+.012],[width*.20,h*.49,.045],[0,0,0],'pavilion-window-reveal');
    w.box('glass',[x,s.height+h*.53,z+depth/2+.040],[width*.18,h*.44,.025],[0,0,0],'pavilion-window-glass');
   }
  }
 }
}
