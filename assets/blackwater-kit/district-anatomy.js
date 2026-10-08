// Use-specific silhouettes, compiled into the existing shared material batches.
export function districtAnatomy(s) {
 const variant=Math.abs(s.seed)%3;
 if(s.label==='EVACUATION OFFICE')return {family:'civic',roof:'civic-stepped-tower',variant,wall:'render',facade:'civic-hall'};
 if(s.label==='TERMINUS CAFE'||s.label==='HARBOR HARDWARE')return {family:'main-street',roof:s.label==='TERMINUS CAFE'?'civic-neighbor-tile':'civic-neighbor-slate',variant,wall:'brick'};
 if(/^EAST WORKS (49|58|67) \/ WAREHOUSE$/.test(s.label))return {family:'warehouse',roof:s.label.includes('58')?'hangar-asymmetric':s.label.includes('67')?'hangar-monitor':'hangar-steep',variant,wall:s.label.includes('58')?'brick':s.label.includes('49')?'masonry':'render',facade:'works-hall'};
 if(s.label==='EAST WORKS 55 / WAREHOUSE')return {family:'warehouse',roof:'sawtooth',variant,wall:'brick',facade:'works-hall'};
 if(/WAREHOUSE/.test(s.label))return {family:'warehouse',roof:'sawtooth',variant,wall:'render'};
 if(/WORKSHOP/.test(s.label))return {family:'workshop',roof:variant===1?'sawtooth':'monitor',variant,wall:'masonry'};
 if(/CLINIC|MEDICAL/.test(s.label))return {family:'clinic',roof:'service-pavilion',variant,wall:'render'};
 if(/APARTMENTS/.test(s.label))return {family:'apartment',roof:variant===0?'terrace':variant===1?'mansard':'setback-pavilion',variant,wall:variant===1?'render':'brick'};
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
    w.box('roofZinc',[0,s.height+rise/2,z+span/2],[s.width-.8,.13,Math.hypot(rise,span)],[angle,0,0],'factory-sawtooth-roof');
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
   for(const side of [-1,1])w.box('roofZinc',[side*half/2,s.height+rise/2,0],[Math.hypot(half,rise),.13,s.depth-.8],[0,0,-side*angle],'workshop-pitched-roof');
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
