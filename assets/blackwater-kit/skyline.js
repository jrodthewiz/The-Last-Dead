// Roof-scale forms are authored above the existing sealed ceiling. Their
// silhouette belongs to the district; none adds a ground collision or portal.
function quad(w,slot,p,role){
 w.triangle(slot,[p[0],p[1],p[2]],role);
 w.triangle(slot,[p[0],p[2],p[3]],role);
}
function hip(w,{x=0,z=0,y,width,depth,rise,slot='roofSlate',role='hipped-roof',top=.28}){
 const a=width/2,b=depth/2,ta=a*top,tb=b*top;
 quad(w,slot,[[x-a,y,z+b],[x+a,y,z+b],[x+ta,y+rise,z+tb],[x-ta,y+rise,z+tb]],role);
 quad(w,slot,[[x+a,y,z+b],[x+a,y,z-b],[x+ta,y+rise,z-tb],[x+ta,y+rise,z+tb]],role);
 quad(w,slot,[[x+a,y,z-b],[x-a,y,z-b],[x-ta,y+rise,z-tb],[x+ta,y+rise,z-tb]],role);
 quad(w,slot,[[x-a,y,z-b],[x-a,y,z+b],[x-ta,y+rise,z+tb],[x-ta,y+rise,z-tb]],role);
 w.box(slot,[x,y+rise,z],[ta*2,.12,tb*2],[0,0,0],role+'-cap');
}
function dormers(w,s,width,depth,y,rise){
 for(const x of [-width*.27,width*.27]){
  const z=depth*.32;
  w.box('pale',[x,y+rise*.58,z],[1.45,1.45,1.30],[0,0,0],'mansard-dormer-cheek');
  w.box('dark',[x,y+rise*.59,z+.662],[1.05,1.03,.035],[0,0,0],'mansard-dormer-reveal');
  w.box('glass',[x,y+rise*.59,z+.687],[.85,.86,.025],[0,0,0],'mansard-dormer-window');
  w.box('wood',[x,y+rise*.59,z+.704],[.06,.88,.045],[0,0,0],'mansard-dormer-mullion');
  hip(w,{x,z,y:y+rise*.58+.75,width:1.68,depth:1.56,rise:.64,slot:'roofSlate',role:'dormer-hip',top:.12});
 }
}
function clockTower(w,s){
 const p=civicSkylinePlan(s),{x,z,base,tiers}=p;
 // Lower tower and upper belfry are substantial occupied-looking masses.
 // Flanking roofs terminate at the lower tower's exposed edges, so there is
 // no complete roof hidden under a tower or detached rooftop ornament.
 for(const roof of p.wings)hip(w,{...roof,y:base,slot:'roofSlate',role:'civic-wing-roof',top:.45});
 for(const [index,tier]of tiers.entries()){
  const {width,depth,y,height}=tier;
  w.box(index?'render':'pale',[x,y+height/2,z],[width,height,depth],[0,0,0],index?'civic-clock-tower':'civic-tower-bearing-base');
  for(const a of [-1,1])for(const b of [-1,1])w.box('pale',[x+a*(width/2-.17),y+height/2,z+b*(depth/2-.17)],[.34,height,.34],[0,0,0],'civic-tower-corner');
  w.box('pale',[x,y+height+.12,z],[width+.40,.24,depth+.40],[0,0,0],'civic-tower-setback-cornice');
  for(let face=0;face<4;face++){
   const yaw=face*Math.PI/2,span=face%2?depth:width,out=(face%2?width:depth)/2;
   const box=(slot,u,v,size,role,roll=0)=>w.box(slot,[x+Math.cos(yaw)*u+Math.sin(yaw)*(out+.034),v,z-Math.sin(yaw)*u+Math.cos(yaw)*(out+.034)],size,[0,yaw,roll],role);
   if(!index){
    // Vertical paired openings keep the bearing tier readable as architecture.
    for(const u of [-span*.24,span*.24]){
     box('dark',u,y+height*.52,[1.48,height*.62,.05],'civic-base-window-reveal');
     box('glass',u,y+height*.52,[1.24,height*.60,.06],'civic-base-window-glazing');
     box('pale',u,y+height*.52,[.09,height*.62,.13],'civic-base-window-mullion');
    }
   }else{
    const cy=y+height-2.05;
    box('dark',0,cy,[3.25,3.25,.05],'civic-clock-face');
    for(let tick=0;tick<12;tick++){
     const angle=tick*Math.PI/6;
     box('pale',Math.sin(angle)*1.31,cy+Math.cos(angle)*1.31,[.13,.28,.14],'civic-clock-tick',-angle);
    }
    box('pale',0,cy+.47,[.12,.99,.16],'civic-clock-minute-hand');
    box('pale',.33,cy,[.73,.12,.17],'civic-clock-hour-hand');
    for(const u of [-1.70,1.70]){
     box('dark',u,y+height*.43,[1.75,5.2,.05],'civic-belfry-opening');
     for(let slat=0;slat<7;slat++)box('metal',u,y+height*.43-2.2+slat*.72,[1.56,.13,.20],'civic-belfry-louver');
    }
   }
  }
 }
 const top=tiers.at(-1),roofY=top.y+top.height+.30;
 hip(w,{x,z,y:roofY,width:top.width+.65,depth:top.depth+.65,rise:6.5,slot:'roofSlate',role:'civic-steep-spire',top:.06});
 w.cylinder('metal',[x,roofY+6.5,z],[x,roofY+7.25,z],.065,'civic-weather-vane');
 w.box('metal',[x,roofY+7.10,z],[1.35,.12,.07],[0,0,0],'civic-weather-vane-arrow');
}

// Serializable roof mass grammar is also available to QA: the civic hall is
// a 10 m bearing tier, a 14 m clock/belfry tier, and two subordinate roof wings.
export function civicSkylinePlan(s){
 const base=s.height+.48,x=-s.width*.084375,z=-s.depth*.084375;
 const width=Math.min(11.2,s.width*.70),depth=Math.min(10.2,s.depth*.6375);
 const lower={width,depth,y:base,height:10},upper={width:width*.732142857,depth:depth*.803921569,y:base+10,height:14};
 const right=s.width/2-.30,left=x+width/2+.10,front=s.depth/2-.30,back=z+depth/2+.10;
 return{x,z,base,tiers:[lower,upper],wings:[
  {x:(left+right)/2,z:0,width:right-left,depth:s.depth-.60,rise:3.3},
  {x:x,z:(front+back)/2,width,depth:front-back,rise:2.6},
 ]};
}
function furnaceGantry(w,s){
 const y=s.height+.50,half=s.width/2-.5,d=s.depth/2-.5,h=19;
 // One broad, asymmetrical service mass and a genuinely open lifting frame
 // distinguish the old foundry from the surrounding single-storey works.
 w.box('brick',[4,y+6,-1.6],[10.6,12,9.4],[0,0,0],'foundry-raised-furnace-house');
 for(const offset of [-4.7,4.7])w.box('masonry',[4+offset,y+6,-1.6],[.42,12,9.5],[0,0,0],'foundry-furnace-house-pier');
 w.box('roofZinc',[4,y+12.18,-1.6],[11.1,.36,9.9],[0,0,0],'foundry-raised-monitor-cap');
 for(const z of [-6.33,3.13]){
  w.box('dark',[4,y+9.6,z],[9.5,1.7,.05],[0,0,0],'foundry-clerestory-reveal');
  w.box('glass',[4,y+9.6,z+(z>0?.04:-.04)],[9.2,1.4,.04],[0,0,0],'foundry-clerestory-band');
  for(let i=0;i<6;i++)w.box('metal',[i*1.6,y+9.6,z+(z>0?.07:-.07)],[.12,1.8,.10],[0,0,0],'foundry-clerestory-post');
 }
 for(const [x,z,height,radius]of [[-5.6,-3,24,1.45],[-1.5,-3,18.5,1.05]]){
  w.cylinder('brick',[x,y,z],[x,y+height,z],radius,'foundry-monumental-stack');
  w.cylinder('pale',[x,y+height-.55,z],[x,y+height-.30,z],radius+.16,'foundry-stack-collar');
  w.cylinder('dark',[x,y+height-.10,z],[x,y+height+.015,z],radius*.83,'foundry-stack-mouth');
 }
 for(const x of [-half,half])for(const z of [-d,d]){
  // These four large bearing piers continue directly through the upper hall
  // into the lifting frame; the playable ground room retains its ceiling.
  w.box('masonry',[x,(3.5+y)/2,z],[1.0,y-3.5,1.0],[0,0,0],'foundry-continuous-gantry-bearing');
  w.box('rust',[x,y+h/2,z],[.62,h,.68],[0,0,0],'foundry-gantry-leg');
  w.box('masonry',[x,y+.45,z],[.90,.90,.90],[0,0,0],'foundry-gantry-foot');
 }
 for(const z of [-d,d]){
  for(const dy of [h-2,h])w.box('rust',[0,y+dy,z],[half*2+.55,.50,.62],[0,0,0],'foundry-gantry-truss-chord');
  const bays=6,step=half*2/bays;
  for(let i=0;i<bays;i++)w.cylinder('rust',[-half+i*step,y+h-2,z],[-half+(i+1)*step,y+h,z],.17,'foundry-gantry-truss-diagonal');
 }
 for(const x of [-half,half]){
  w.box('rust',[x,y+h-1,0],[.62,2.4,d*2+.6],[0,0,0],'foundry-gantry-end-beam');
  for(const z of [-d,d])w.cylinder('rust',[x,y+3,z],[x,y+h-2,-z],.21,'foundry-gantry-leg-brace');
 }
 w.box('rust',[0,y+h-.5,0],[3.2,.85,d*2],[0,0,0],'foundry-crane-traveller');
 w.box('metal',[0,y+h+.30,1.8],[2.8,1.25,2.2],[0,0,0],'foundry-crane-motor');
 w.cylinder('dark',[0,y+h-.7,3],[0,y+9,3],.095,'foundry-crane-hoist');
 w.box('metal',[0,y+8.8,3],[.8,.8,.6],[0,0,0],'foundry-crane-hook-block');
}
function hangarLoft(w,s,roof){
 const y=s.height+.48,half=s.width/2-.45,d=s.depth-.8;
 const rise=roof==='hangar-asymmetric'?8.2:roof==='hangar-monitor'?7.4:6.2;
 const ridge=roof==='hangar-asymmetric'?half*.34:0;
 // Full-width eaves and closed triangular ends make this a substantial loft,
 // rather than a small pavilion placed on another generic flat box.
 for(const [side,span,center]of [[-1,half+ridge,(-half+ridge)/2],[1,half-ridge,(half+ridge)/2]]){
  const angle=Math.atan2(rise,span);
  w.box('roofZinc',[center,y+rise/2,0],[Math.hypot(span,rise),.19,d],[0,0,-side*angle],'works-hangar-roof-slope');
  // Three broad standing seams provide scale without a field of tiny details.
  for(const z of [-d*.30,0,d*.30])w.box('metal',[center,y+rise/2+.105,z],[Math.hypot(span,rise),.065,.075],[0,0,-side*angle],'works-hangar-standing-seam');
 }
 for(const z of [-d/2,d/2]){
  const p=[[-half,y,z],[half,y,z],[ridge,y+rise,z]];
  w.triangle('metal',z>0?p:[...p].reverse(),'works-hangar-triangular-end');
  for(const x of [-half,half])w.cylinder('pale',[x,y,z+(z>0?.03:-.03)],[ridge,y+rise,z+(z>0?.03:-.03)],.12,'works-hangar-bargeboard');
  w.box('dark',[ridge,y+rise*.40,z+(z>0?.025:-.025)],[3.1,1.55,.04],[0,0,0],'works-hangar-end-loft-reveal');
  w.box('glass',[ridge,y+rise*.40,z+(z>0?.055:-.055)],[2.85,1.30,.035],[0,0,0],'works-hangar-end-loft-window');
  for(const dx of [-.95,0,.95])w.box('metal',[ridge+dx,y+rise*.40,z+(z>0?.08:-.08)],[.09,1.57,.05],[0,0,0],'works-hangar-end-mullion');
 }
 w.box('metal',[ridge,y+rise+.08,0],[.30,.16,d+.08],[0,0,0],'works-hangar-ridge');
 if(roof==='hangar-monitor'){
  w.box('metal',[ridge,y+rise+.65,0],[2.8,1.3,d*.73],[0,0,0],'works-hangar-monitor-body');
  for(const side of [-1,1])w.box('glass',[ridge+side*1.42,y+rise+.70,0],[.04,.85,d*.69],[0,0,0],'works-hangar-monitor-glazing');
  w.box('roofZinc',[ridge,y+rise+1.4,0],[3.35,.20,d*.79],[0,0,0],'works-hangar-monitor-cap');
 }
}
export function compileDistrictSkyline(w,plan){
 const s=plan.settings,a=plan.anatomy;
 if(a.family==='cottage'||plan.focalCollapse)return;
 if(s.label==='EVACUATION OFFICE'){clockTower(w,s);return;}
 if(a.roof.startsWith('civic-neighbor-')){
  // Neighbours reuse their existing slate-dark roof slot; the height/hip
  // contrast adds civic hierarchy without another spatial material batch.
  hip(w,{y:s.height+.48,width:s.width-.60,depth:s.depth-.60,rise:a.roof.endsWith('tile')?2.6:3.4,slot:'roof',role:'merchant-hipped-roof',top:.16});
  return;
 }
 if(s.label==='EAST WORKS 55 / WAREHOUSE')furnaceGantry(w,s);
 if(a.roof.startsWith('hangar-'))hangarLoft(w,s,a.roof);
 if(a.family==='apartment'&&a.roof==='mansard'){
  const width=s.width-.65,depth=s.depth-.65,rise=3.6;
  hip(w,{y:s.height+.45,width,depth,rise,slot:'roofSlate',role:'apartment-mansard',top:.54});
  dormers(w,s,width,depth,s.height+.45,rise);
 }else if(a.family==='main-street'&&a.variant===1){
  hip(w,{y:s.height+.48,width:s.width-.48,depth:s.depth-.48,rise:2.8,slot:'roofTile',role:'merchant-hipped-roof',top:.10});
 }else if(a.family==='warehouse'||a.family==='workshop'){
  // Twin tall flues at the service edge break the regular roof ridge rhythm.
  if(Math.abs(s.seed)%2===0){
   for(const [i,dx] of [[0,-.31],[1,-.17]]){
    const x=s.width*dx,z=-s.depth*.30,h=i?4.4:6.1;
    w.box('brick',[x,s.height+h/2,z],[.92,h,1.05],[0,0,0],'industrial-service-stack');
    w.box('rust',[x,s.height+h+.10,z],[1.16,.24,1.26],[0,0,0],'industrial-stack-crown');
    w.box('dark',[x,s.height+h+.228,z],[.69,.025,.77],[0,0,0],'industrial-stack-flue');
   }
  }
 }
}
