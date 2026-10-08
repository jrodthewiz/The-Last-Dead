// One local-metre source owns the Cape 75 stair, floors and finite collision.
// Vertical coordinates are Three.js Y. The course serializer owns world/yaw/unit conversion.
import {isAuthoredCottage} from './cottage-authored.js';

export const CAPE75_REPLACED_WALL_ROLES = new Set([
  'wall-infill','wall-pier','house-window-lower-infill','house-window-upper-infill',
  'house-window-side-infill','house-ground-floor-door-wall','house-door-lintel-infill',
]);
export const CAPE75_REPLACED_FLOOR_ROLES = new Set(['walkable-living-wood-floor','walkable-kitchen-linoleum-floor']);

export function solidBounds(solid) {
  return {min:solid.position.map((v,i)=>v-solid.size[i]/2),max:solid.position.map((v,i)=>v+solid.size[i]/2)};
}

export function refreshCape75StructureDiagnostics(structure) {
  const {solids,railGrips=[]}=structure,ids=solids.map(record=>record.id),rendered=solids.filter(record=>record.render!==false);
  structure.diagnostics={solidCount:solids.length,renderedSolidCount:rendered.length,proxyCount:solids.length-rendered.length,
    renderedTriangles:(rendered.length+railGrips.length)*12,railGripCount:railGrips.length,
    railProxyCount:solids.filter(record=>record.visibleGripId).length,
    materialSlots:[...new Set([...rendered,...railGrips].map(record=>record.slot))],duplicateIds:ids.filter((id,i)=>ids.indexOf(id)!==i)};
  return structure;
}

export function createCape75Structure(s, furniture, floorHeight) {
  if(!isAuthoredCottage(s))return null;
  const solids=[],railGrips=[],upperWindows=[],floor=.07,upper=floorHeight+.0425,eave=floorHeight*2;
  const bodyZ=-.825,bodyDepth=s.depth-1.65,width=s.width-.4,depth=bodyDepth-.2;
  const halfW=(s.width-.50)/2,minZ=bodyZ-(bodyDepth-.25)/2,maxZ=bodyZ+(bodyDepth-.25)/2;
  const add=(id,kind,position,size,slot='pale',support=false,extra={})=>{
    const record={id:`cape75-${id}`,kind,position,size,slot,support,...extra};solids.push(record);return record;
  };
  const rect=(id,kind,x0,x1,z0,z1,top,thickness,slot,support=true)=>add(id,kind,[(x0+x1)/2,top-thickness/2,(z0+z1)/2],[x1-x0,thickness,z1-z0],slot,support);
  rect('lower-living-floor','floor',-halfW,halfW,0,maxZ,floor,.07,'interiorWood');
  rect('lower-kitchen-floor','floor',-halfW,halfW,minZ,0,floor,.07,'interiorTile');
  const opening={x:[-5.46,-2.00],z:[-.65,3.05],bottom:upper-.075,top:upper};
  rect('upper-slab-wall-strip','slab',-halfW,opening.x[0],minZ,maxZ,upper,.075,'interiorWood');
  rect('upper-slab-main-room','slab',opening.x[1],halfW,minZ,maxZ,upper,.075,'interiorWood');
  rect('upper-slab-bedroom-end','slab',opening.x[0],opening.x[1],minZ,opening.z[0],upper,.075,'interiorWood');
  rect('upper-landing-exit','slab',opening.x[0],opening.x[1],opening.z[1],maxZ,upper,.075,'interiorWood');
  rect('upper-room-ceiling','ceiling',-halfW,halfW,minZ,maxZ,eave-.015,.08,'pale',false);

  // Exterior opaque infill and closed glazing share the existing facade grammar.
  // In particular an upper doorway is never inherited from the ground-level portal.
  const faceBox=(side,id,kind,along,y,outset,size,slot='render')=>{
    const isEnd=side==='front'||side==='back',normal=side==='left'||side==='back'?-1:1;
    const position=isEnd?[normal*along,y,bodyZ+normal*(depth/2+outset)]:[normal*(width/2+outset),y,bodyZ-normal*along];
    return add(`${side}-${id}`,kind,position,isEnd?size:[size[2],size[1],size[0]],slot,false,{side});
  };
  const windowBay=(side,prefix,x,y0,h,bay,windowW,windowH,windowY,inset=.21,thickness=.26)=>{
    const low=windowY-windowH/2,high=windowY+windowH/2;
    faceBox(side,`${prefix}-lower`,'wall',x,(y0+low)/2,-inset,[bay,low-y0,thickness]);
    faceBox(side,`${prefix}-upper`,'wall',x,(high+y0+h)/2,-inset,[bay,y0+h-high,thickness]);
    for(const sign of [-1,1])faceBox(side,`${prefix}-pier-${sign}`,'wall',x+sign*(windowW/2+(bay-windowW)/4),windowY,-inset,[(bay-windowW)/2,windowH,thickness]);
    faceBox(side,`${prefix}-closed-glazing`,'window',x,windowY,-.362,[windowW,windowH,.018],'glass');
    if(prefix.startsWith('upper-')){
      const damaged=side==='back'&&prefix==='upper-1';
      const record={id:`cape75-${side}-${prefix}`,side,along:x,y:windowY,width:windowW,height:windowH,
        variant:damaged?'evacuated-sash':'intact-painted-sash',closedGlassId:`cape75-${side}-${prefix}-closed-glazing`};
      upperWindows.push(record);
      // The west stair wall has only 8cm between plaster and tread. Its slim
      // trim stays outside the entire 1.60m flight instead of stealing width.
      const frameInset=side==='left'?-.337:-.390,frameDepth=side==='left'?.080:.14;
      for(const sign of [-1,1])faceBox(side,`${prefix}-interior-jamb-${sign}`,'window-frame',x+sign*(windowW/2+.045),windowY,frameInset,[.09,windowH+.17,frameDepth],'pale');
      faceBox(side,`${prefix}-interior-header`,'window-frame',x,high+.055,frameInset,[windowW+.18,.11,frameDepth],'pale');
      faceBox(side,`${prefix}-interior-sill`,'window-frame',x,low-.065,side==='left'?-.294:-.415,[windowW+.28,.13,side==='left'?.15:.23],'furnitureWood');
      faceBox(side,`${prefix}-interior-sill-apron`,'window-frame',x,low-.17,frameInset,[windowW+.12,.09,.075],'pale');
      faceBox(side,`${prefix}-interior-mullion`,'window-frame',x,windowY,frameInset,[.055,windowH,.07],'furnitureWood');
      faceBox(side,`${prefix}-interior-sash`,'window-frame',x,windowY+.14,frameInset,[windowW,.055,.07],'furnitureWood');
      if(damaged){
        // An abandoned evacuation attempt owns one bay: a splintered lower
        // sash, rusted latch and two unequal timber patches. The glazing is
        // still closed in the authoritative finite collision plan.
        faceBox(side,`${prefix}-evacuation-latch`,'window-frame',x+.075,windowY+.195,-.455,[.07,.06,.035],'rust');
        for(const [i,sign]of [-1,1].entries())faceBox(side,`${prefix}-evacuation-sash-splinter-${i}`,'window-frame',x+sign*.13,low+.055,-.44,[.18,.035,.035],'dark');
        faceBox(side,`${prefix}-evacuation-patch-short`,'window-frame',x-.30,low+.27,-.45,[.40,.07,.035],'wood');
        faceBox(side,`${prefix}-evacuation-patch-long`,'window-frame',x+.30,low+.39,-.45,[.52,.07,.035],'wood');
      }
    }
  };
  for(const side of ['front','back','left','right']){
    const span=side==='front'||side==='back'?width:depth,count=Math.max(2,Math.round(span/3)),bay=span/count;
    if(side==='front'||side==='back'){
      const offset=side==='back'?-s.doorOffset:s.doorOffset;
      for(const [i,[a,b]]of [[-span/2,offset-2],[offset+2,span/2]].entries()){
        const w=b-a,x=(a+b)/2;
        if(w>2)windowBay(side,`lower-${i}`,x,0,floorHeight,w,Math.min(1.65,w-.65),1.35,1.36,.20,.30);
        else if(w>.005)faceBox(side,`lower-${i}`,'wall',x,floorHeight/2,-.20,[w,floorHeight,.30]);
      }
      faceBox(side,'lower-door-lintel','wall',offset,floorHeight-.085,-.20,[4,.17,.30]);
    }else for(let i=0;i<count;i++)windowBay(side,`lower-${i}`,-span/2+bay*(i+.5),0,floorHeight,bay,Math.min(1.18,bay-.65),Math.min(1.72,floorHeight-.95),floorHeight*.51);
    for(let i=0;i<count;i++)windowBay(side,`upper-${i}`,-span/2+bay*(i+.5),floorHeight,floorHeight,bay,Math.min(1.18,bay-.65),Math.min(1.72,floorHeight-.95),floorHeight+floorHeight*.51);
  }

  const rise=(upper-floor)/14,run=.30,landingTop=floor+7*rise;
  const flights=[{id:'lower',x:-2.88,direction:-1,startZ:3.05,startTop:floor},{id:'upper',x:-4.58,direction:1,startZ:.95,startTop:landingTop}];
  const stairPath=[[-1.30,floor,3.50],[-2.88,floor,3.50]];
  const post=(id,x,z,bottom,gripY,width,depth,newel,extra={})=>{
    const height=gripY-bottom-.033,bodyWidth=newel?width*.66:width*.68,bodyDepth=newel?depth*.66:depth*.68;
    const common={guardPart:'baluster',...extra};
    add(`${id}-foot`,'rail',[x,bottom+.045,z],[width,.09,depth],'furnitureWood',false,common);
    add(`${id}-shaft`,'rail',[x,bottom+.09+(height-.18)/2,z],[bodyWidth,height-.18,bodyDepth],'pale',false,common);
    add(`${id}-neck`,'rail',[x,bottom+height-.070,z],[bodyWidth*.80,.050,bodyDepth*.80],'furnitureWood',false,common);
    add(`${id}-capital`,'rail',[x,bottom+height-.0275,z],[width,.055,depth],'furnitureWood',false,common);
  };
  const slopeGrip=(id,a,b,width,extra={})=>{
    const dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dy,dz),angle=-Math.atan2(dy,dz),height=.062;
    const visual={id:`cape75-${id}`,kind:'rail-grip',slot:'furnitureWood',position:a.map((v,i)=>(v+b[i])/2),size:[width,height,length],rotation:[angle,0,0],a,b,...extra};
    railGrips.push(visual);
    // Each finite proxy bounds at most 5cm of the visible slope. The maximum
    // empty AABB corner is below 3cm; nothing closes the baluster shot gaps.
    const count=Math.ceil(Math.abs(dz)/.05),crossY=Math.abs(Math.cos(angle))*height,crossZ=Math.abs(Math.sin(angle))*height;
    for(let i=0;i<count;i++){
      const t0=i/count,t1=(i+1)/count,p=a.map((v,j)=>v+(b[j]-v)*(t0+t1)/2),spanY=Math.abs(dy)/count,spanZ=Math.abs(dz)/count;
      add(`${id}-proxy-${i+1}`,'rail',p,[width,spanY+crossY,spanZ+crossZ],'furnitureWood',false,
        {render:false,guardPart:'grip-proxy',visibleGripId:visual.id,segment:[t0,t1],horizontalSpan:spanZ,cornerSlack:spanY/2,...extra});
    }
  };
  for(const [flightIndex,flight]of flights.entries()){
    if(flightIndex){stairPath.push([-2.88,landingTop,.15],[-4.58,landingTop,.15]);}
    for(let i=0;i<7;i++){
      const z=flight.startZ+flight.direction*run*(i+.5),top=flight.startTop+rise*(i+1);
      add(`${flight.id}-tread-${i+1}`,'tread',[flight.x,top-rise/2,z],[1.60,rise,run],'furnitureWood',true,{flight:flight.id,step:i+1});
      stairPath.push([flight.x,top,z]);
      for(const sign of [-1,1]){
        const passageEdge=flight.id==='lower'&&sign===1,railX=passageEdge?-2.04:flight.x+sign*.85,railWidth=passageEdge?.08:.10;
        const startZ=flight.id==='lower'?2.80:1.10,endZ=flight.id==='lower'?1.10:2.90;
        const startY=flight.startTop+rise+.995,endY=flight.startTop+7*rise+.995;
        const railZ=flight.id==='lower'&&i===0?startZ:z,gripY=startY+(endY-startY)*(railZ-startZ)/(endZ-startZ);
        const newel=i===0||i===6,postWidth=newel?railWidth:.046,postDepth=newel?.08:.046;
        post(`${flight.id}-rail-${i+1}-${sign}`,railX,railZ,top,gripY,postWidth,postDepth,newel,{flight:flight.id,step:i+1,guardId:`cape75-${flight.id}-${sign}`,starter:flight.id==='lower'&&i===0});
        if(i===0)slopeGrip(`${flight.id}-sloped-grip-${sign}`,[railX,startY,startZ],[railX,endY,endZ],railWidth,{flight:flight.id,guardId:`cape75-${flight.id}-${sign}`});
      }
    }
  }
  rect('turning-landing','landing',-5.46,-2,-.65,.95,landingTop,.12,'furnitureWood');
  const levelGuard=(id,a,b,bottom,cross=.08)=>{
    const axis=Math.abs(a[0]-b[0])>.01?0:2,length=Math.abs(b[axis]-a[axis]),count=Math.ceil(length/.30),gripY=bottom+.995;
    for(let i=0;i<=count;i++){
      const p=a.map((v,j)=>v+(b[j]-v)*i/count),end=i===0||i===count;
      post(`${id}-baluster-${i}`,p[0],p[2],bottom,gripY,axis===0?(end?.08:.044):cross,axis===2?(end?.08:.044):cross,end,{guardId:`cape75-${id}`});
    }
    add(`${id}-grip`,'rail',[(a[0]+b[0])/2,gripY,(a[2]+b[2])/2],axis===0?[length+.08,.066,cross]:[cross,.066,length+.08],'furnitureWood',false,{guardPart:'level-grip',guardId:`cape75-${id}`});
  };
  levelGuard('landing-rear-guard',[-5.42,0,-.61],[-2.04,0,-.61],landingTop);
  // Actual baluster gaps stop broad actors while allowing sights and bullets
  // through the opening. The returning flight's front exit stays open.
  levelGuard('upper-opening-inner-guard',[-2.04,0,-.61],[-2.04,0,3.01],upper);
  levelGuard('upper-opening-rear-guard',[-5.42,0,-.61],[-2.04,0,-.61],upper);
  levelGuard('upper-opening-front-guard',[-3.64,0,3.01],[-2.12,0,3.01],upper);
  stairPath.push([-4.58,upper,3.50],[-4.58,upper,4.00],[-1.20,upper,4.00],[0,upper,1.20]);

  // Only the detailed lower furnishings use conservative finite body proxies;
  // their existing authored meshes retain their own surface construction.
  for(const item of furniture.filter(item=>!item.structureOverride))add(`lower-${item.id}`,'lower-furniture',[...item.position],[...(item.collisionSize||item.size)],item.slot||'furnitureWood',false,{render:false,furnitureId:item.id});

  // Upper lodger room: load-bearing/open door partition, modest real furniture.
  const ceilingBottom=eave-.095,roomHeight=ceilingBottom-upper;
  for(const [i,[a,b]]of [[-5.46,-1],[1,5.46]].entries())add(`upper-bedroom-divider-${i}`,'wall',[(a+b)/2,upper+roomHeight/2,-2.45],[b-a,roomHeight,.12],'pale',false);
  add('upper-bedroom-door-header','wall',[0,ceilingBottom-.16,-2.45],[2,.32,.12],'pale',false);
  const furnitureBox=(id,x,y,z,size,slot)=>add(id,'upper-furniture',[x,upper+y,z],size,slot,false);
  for(const x of [2.98,4.42])for(const z of [-5.28,-7.02])furnitureBox(`upper-bed-leg-${x}-${z}`,x,.17,z,[.10,.34,.10],'furnitureWood');
  furnitureBox('upper-bed-rail',3.70,.36,-6.15,[1.70,.16,2.10],'furnitureWood');
  furnitureBox('upper-bed-mattress',3.70,.53,-6.15,[1.62,.18,2.02],'pale');
  furnitureBox('upper-bed-blanket',3.70,.64,-5.87,[1.64,.055,1.38],'fabric');
  for(const x of [3.28,4.12])furnitureBox(`upper-bed-pillow-${x}`,x,.66,-6.88,[.68,.16,.38],'pale');
  furnitureBox('upper-bed-headboard',3.70,.74,-7.18,[1.80,1.12,.09],'furnitureWood');
  for(const x of [-4.96,-3.12])for(const z of [-6.81,-6.27])furnitureBox(`upper-writing-desk-leg-${x}-${z}`,x,.40,z,[.09,.80,.09],'furnitureWood');
  furnitureBox('upper-writing-desk-top',-4.04,.83,-6.54,[2.02,.08,.75],'furnitureWood');
  furnitureBox('upper-writing-desk-open-drawer',-4.04,.67,-6.24,[.84,.10,.57],'pale');
  furnitureBox('upper-writing-desk-chair-seat',-4.04,.46,-5.33,[.66,.09,.64],'furnitureWood');
  for(const x of [-4.30,-3.78])for(const z of [-5.57,-5.09])furnitureBox(`upper-chair-leg-${x}-${z}`,x,.22,z,[.075,.44,.075],'furnitureWood');
  furnitureBox('upper-writing-desk-chair-back',-4.04,.78,-5.06,[.66,.59,.075],'pale');
  furnitureBox('upper-packed-trunk-base',3.94,.28,-3.57,[1.16,.52,.62],'furnitureWood');
  furnitureBox('upper-packed-trunk-lid',3.94,.56,-3.57,[1.21,.07,.66],'pale');
  for(const x of [3.64,4.24])furnitureBox(`upper-trunk-strap-${x}`,x,.605,-3.57,[.045,.017,.66],'metal');
  // The finite woven rug has a real top 13mm above the slab. It owns that
  // reachable support surface so collision can step onto its physical edge.
  add('upper-bedroom-rug','finish',[0,upper+.007,-5.00],[2.20,.012,2.84],'rug',true);
  return refreshCape75StructureDiagnostics({id:'cape75-two-storey-retreat',coordinateSystem:'local-three-metres',solids,railGrips,upperWindows,stairPath,
    floors:[{id:'lower',top:floor},{id:'upper',top:upper}],opening,
    stairs:{rise,run,clearWidth:1.60,stepCount:14,landingTop,flights,landing:{x:[-5.46,-2],z:[-.65,.95]}},
    rooms:[{id:'upper-lodger-bedroom',floor:upper,bounds:{x:[-5.46,5.46],z:[-7.56,-2.51]},door:[0,upper,-2.45]},
      {id:'upper-landing-room',floor:upper,bounds:{x:[-1.98,5.46],z:[-2.39,5.91]}}],
    });
}

export function compileCape75Structure(writer, structure) {
  if(!structure)return;
  for(const solid of structure.solids)if(solid.render!==false)writer.box(solid.slot,solid.position,solid.size,[0,0,0],`cape75-structure-${solid.kind}`);
  for(const grip of structure.railGrips||[])writer.box(grip.slot,grip.position,grip.size,grip.rotation,'cape75-structure-rail-grip');
}
