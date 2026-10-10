import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createBuildingPlan,createModel} from '../assets/blackwater-kit/architecture.js';
import {createCape75UpstairsArtPlan,compileCape75UpstairsArt} from '../assets/blackwater-kit/cape75-upstairs-art.js';
import {primitiveBounds} from '../assets/blackwater-kit/cottage-authored.js';
import {createBlackwaterMaterials} from '../assets/blackwater-kit/materials.js';

const cottage=()=>({kind:'house',width:12,depth:16,height:6.4,seed:1042,enterable:true,doorOffset:0,label:'CAPE LODGE 75'});
const artPlan=(overrides={})=>{const p=createBuildingPlan({...cottage(),...overrides});return createCape75UpstairsArtPlan(p.settings,p.structure);};
const hit=(model,origin,direction,far=20)=>new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction),0,far).intersectObject(model.root,true)[0];
const horizontalDistance=(b,x,z)=>Math.hypot(Math.max(b.min[0]-x,0,x-b.max[0]),Math.max(b.min[2]-z,0,z-b.max[2]));
const area=points=>new THREE.Vector3(...points[1]).sub(new THREE.Vector3(...points[0])).cross(new THREE.Vector3(...points[2]).sub(new THREE.Vector3(...points[0]))).length()/2;
const polygonArea=points=>points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2;
const separates=(a,b)=>a.some((p,i)=>{
  const q=a[(i+1)%a.length],axis=[p[1]-q[1],q[0]-p[0]],project=v=>v[0]*axis[0]+v[1]*axis[1];
  return Math.max(...b.map(project))<=Math.min(...a.map(project))+1e-12;
});
const camera320=(a,position,target)=>{const c=new THREE.PerspectiveCamera(75,1.6,.01,30);c.position.set(...position);c.lookAt(...target);c.updateMatrixWorld(true);return c;};
const projectedPixels=(placements,camera)=>{
  const pixels=new Set(),edge=(a,b,p)=>(p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]);
  for(const p of placements){
    assert.equal(p.shape,'triangle');
    const points=p.points.map(v=>new THREE.Vector3(...v).project(camera)).map(v=>[(v.x+1)*160,(1-v.y)*100]);
    const min=points[0].map((_,i)=>Math.floor(Math.min(...points.map(v=>v[i])))),max=points[0].map((_,i)=>Math.ceil(Math.max(...points.map(v=>v[i]))));
    for(let y=Math.max(0,min[1]);y<=Math.min(199,max[1]);y++)for(let x=Math.max(0,min[0]);x<=Math.min(319,max[0]);x++){
      const signs=points.map((v,i)=>edge(v,points[(i+1)%3],[x+.5,y+.5]));
      if(signs.every(v=>v>=0)||signs.every(v=>v<=0))pixels.add(y*320+x);
    }
  }
  return pixels;
};

test('upstairs art is a deterministic immutable visual plan, with original finite collision ownership',()=>{
  const p=createBuildingPlan(cottage()),before=JSON.stringify(p.structure),a=createCape75UpstairsArtPlan(p.settings,p.structure);
  assert.deepEqual(a,artPlan());assert.deepEqual(JSON.parse(JSON.stringify(a)),a);
  assert.equal(JSON.stringify(p.structure),before,'visual planning never mutates the collision source');
  assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.placements)&&a.placements.every(Object.isFrozen));
  assert.notDeepEqual(a.placements,artPlan({seed:1043}).placements,'a constrained cloth variant changes visual folds');
  assert.deepEqual(a.replacedSolidIds,artPlan({seed:1043}).replacedSolidIds);
  assert.deepEqual(a.replacedSolidIds,p.structure.solids.filter(s=>s.kind==='upper-furniture').map(s=>s.id));
  assert.equal(a.replacedSolidIds.length,26);assert.ok(!a.replacedSolidIds.includes('cape75-upper-bedroom-rug'));
  assert.equal(a.diagnostics.addedCollisionSolids,0);assert.deepEqual(a.diagnostics.duplicateOwners,[]);
  assert.equal(createCape75UpstairsArtPlan({...p.settings,label:'CAPE LODGE 76'},p.structure),null);
  assert.equal(createCape75UpstairsArtPlan(p.settings,null),null);
  assert.equal(new Set(a.placements.map(s=>s.id)).size,a.placements.length);
  for(const placement of a.placements){
    assert.ok(placement.role.startsWith('cape75-upstairs-'));
    const b=primitiveBounds(placement);
    assert.ok([...b.min,...b.max].every(Number.isFinite),placement.id);
    assert.ok(b.min[1]>=a.floor-1e-8&&b.max[1]<=a.floor+1.45,`${placement.id} has a finite upstairs construction height`);
    assert.ok(b.min[0]>=-5.16&&b.max[0]<=4.64&&b.min[2]>=-7.25&&b.max[2]<=-3.15,`${placement.id} stays on its original furnishing island`);
    if(placement.shape==='triangle')assert.ok(area(placement.points)>1e-8,`${placement.id} emits no degenerate triangle`);
  }
});

test('map, ear pads, drawer contents and packed clothing have named real supports, with lamp space reserved',()=>{
  const a=artPlan(),supports=new Map(a.supports.map(s=>[s.id,s]));
  assert.ok(a.supportRelations.length>=7);
  for(const {placementId,supportId}of a.supportRelations){
    const p=a.placements.find(p=>p.id===placementId),s=supports.get(supportId),b=primitiveBounds(p);
    assert.ok(s&&s.sourceSolidId.startsWith('cape75-upper-'),`${placementId} inherits an existing furnishing support`);
    assert.ok(Math.abs(b.min[1]-s.top)<.00001,`${placementId} rests on ${supportId}`);
    for(const [axis,i]of [['x',0],['z',2]])assert.ok(b.min[i]>=s.bounds[axis][0]-1e-8&&b.max[i]<=s.bounds[axis][1]+1e-8,`${placementId} fits its ${axis} support`);
  }
  const base=a.workstation.taskLightBase,desk=supports.get(a.workstation.deskSupport);
  assert.deepEqual(base.center,[-4.65,a.floor+.87,-6.58]);assert.equal(base.center[1],desk.top);
  for(const p of a.placements.filter(p=>/route-map-|listening-headphone-/.test(p.role))){
    const b=primitiveBounds(p);
    assert.ok(horizontalDistance(b,base.center[0],base.center[2])>=base.radius,`${p.role} reserves the physical task-light base`);
  }
});

test('broad duvet folds, a doubled-back corner and gravity turn survive the standing 320-pixel view',()=>{
  const a=artPlan(),bounds=a.diagnostics.moduleBounds,top=bounds['cape75-upstairs-bed-broad-fold-duvet'],side=bounds['cape75-upstairs-bed-gravity-side-drape'];
  const focalPixels=200/(2*Math.tan(75*Math.PI/360)),height=top.max[1]-top.min[1];
  assert.ok(height>.16&&height<.30,'a deliberately raised corner combines with broad 10cm crests');
  assert.ok(height*focalPixels/4.3>4,'large fold shape covers more than four pixels at normal 320×200 standing inspection');
  assert.ok(side.max[1]-side.min[1]>.39,'side cloth has a gravity fall rather than a slab edge');
  const drape=a.placements.filter(p=>p.role==='cape75-upstairs-bed-gravity-side-drape').flatMap(p=>p.points);
  for(const point of drape.filter(p=>p[1]<=a.cloth.railBounds.top&&p[1]>=a.floor+.28))assert.ok(point[0]<a.cloth.railBounds.x[0], 'cloth rolls outside the rail before dropping alongside it');
  const corner=a.cloth.turnedCorner;
  assert.ok(corner[2]<-5.42&&corner[1]>a.floor+.79,'the front-left corner physically doubles back and lifts its lining');
  assert.ok(bounds['cape75-upstairs-bed-turned-corner-lining']);
  assert.equal(a.cloth.seamCount,3,'only broad useful seam rhythm is authored');
  const arch=bounds['cape75-upstairs-listening-headphone-large-arch'];
  assert.ok((arch.max[1]-arch.min[1])*focalPixels/2.2>10,'the headphone arch has a standing-view silhouette, beyond painted marks');
});

test('closed compressed pillows taper their corners, contact the mattress and carry real volume at 320 pixels',()=>{
  const a=artPlan(),camera=camera320(a,[1.75,a.floor+1.6,-4.5],[3.70,a.floor+.70,-6.60]);
  assert.equal(a.pillowForms.length,2);
  const source=createBuildingPlan(cottage()).structure;
  for(const form of a.pillowForms){
    const pillow=source.solids.find(p=>p.id===form.sourceSolidId),[px,,pz]=form.center;
    assert.equal(form.supportTop,a.cloth.bedCenter[1]);
    assert.equal(form.contact[1],form.supportTop,'a broad lower compression patch touches the actual mattress');
    assert.ok(form.crown[1]-form.supportTop>.15&&form.crown[1]-form.supportTop<.18,'the cushion retains 15–18cm of compressed volume');
    assert.ok(form.corner[1]-form.supportTop<.025,'the corners visibly taper instead of retaining slab thickness');
    assert.ok(Math.abs(form.corner[0]-px)<pillow.size[0]/2*.9&&Math.abs(form.corner[2]-pz)<pillow.size[2]/2*.9,'pinched corners retreat inside the retained footprint');
    const triangles=a.placements.filter(p=>p.role.includes('pillow')&&p.points.every(v=>Math.abs(v[0]-px)<=pillow.size[0]/2+1e-8));
    const signedVolume=triangles.reduce((n,p)=>n+new THREE.Vector3(...p.points[0]).dot(new THREE.Vector3(...p.points[1]).cross(new THREE.Vector3(...p.points[2])))/6,0);
    assert.ok(signedVolume>.018&&signedVolume<.04,`closed outward skins hold ${signedVolume.toFixed(4)}m³ of cushion volume`);
    for(const p of triangles)for(const v of p.points){assert.ok(v[1]>=form.supportTop-1e-8);assert.ok(Math.abs(v[2]-pz)<=pillow.size[2]/2+1e-8);}
    const pixels=projectedPixels(triangles,camera),ys=[...pixels].map(v=>Math.floor(v/320));
    assert.ok(pixels.size>150,'each cushion covers a stable silhouette rather than a subpixel seam');
    assert.ok(Math.max(...ys)-Math.min(...ys)>=8,`depth and curved crown remain measurable in the native close-inspection 320×200 projection (${pixels.size} pixels, ${Math.max(...ys)-Math.min(...ys)}px height)`);
    const crownY=new THREE.Vector3(...form.crown).project(camera).y,contactY=new THREE.Vector3(...form.contact).project(camera).y;
    assert.ok(Math.abs(crownY-contactY)*100>5,'compressed thickness itself projects to more than five pixels, independently of the pillow footprint');
  }
  const model=createModel(cottage());
  try{
    model.root.updateMatrixWorld(true);
    for(const form of a.pillowForms){
      const [x,,z]=form.center,center=hit(model,[x,a.floor+1.1,z],[0,-1,0],.6),corner=hit(model,[x+.68*.40,a.floor+1.1,z+.38*.40],[0,-1,0],.6);
      assert.ok(center&&corner);assert.equal(center.object.userData.blackwaterSlot,'pale');
      assert.ok(center.point.y>form.supportTop+.15&&center.point.y-corner.point.y>.07,'actual front-facing ray hits expose a broad raised crown and compressed corner');
    }
  }finally{model.dispose();}
});

test('coast, crossing route and forest endpoint are broad standing-view shapes tied to the real footbridge',()=>{
  const a=artPlan(),map=a.routeMap,camera=camera320(a,[-2.35,a.floor+1.6,-5.7],a.workstation.listeningSurfaceCenter);
  assert.equal(map.destinationId,'forest');assert.equal(map.destinationName,'Cape Forest Footbridge');assert.deepEqual(map.destinationWorldMetres,[222,340]);
  assert.equal(map.persistent,true,'the authored environment map has no pickup lifetime');
  assert.ok(!a.story.includes('ferry')&&!a.placements.some(p=>/ferry|broadcast-note-mark|destination-dot/.test(p.role)));
  for(const [role,minimumPixels]of [['route-map-painted-coast',100],['route-map-footbridge-path',20],['route-map-forest-endpoint',20],['route-map-forest-arrival-diamond',8],['route-map-forest-footbridge-bar',10]]){
    const shapes=a.placements.filter(p=>p.role===`cape75-upstairs-${role}`);
    const pixels=projectedPixels(shapes,camera).size;
    assert.ok(pixels>=minimumPixels,`${role} owns a broad projected cue at 320×200 (${pixels} pixels)`);
    for(const shape of shapes){
      const [x,y,z]=shape.points.map(p=>new THREE.Vector3(...p));
      assert.ok(y.sub(x).cross(z.sub(x)).y>0,`${role} faces the standing camera above the desk`);
    }
  }
  assert.ok(map.routeWidth>=.04&&map.routeWidth<.06&&map.inkBorderWidth===0&&map.riverWidth>=.08,'a thinner continuous route crosses broad navy water without a dominant black border');
  assert.deepEqual(map.bridge,map.route[2]);assert.deepEqual(map.bridge,map.river[2],'the route crosses exactly the depicted river');
  assert.ok(map.bridgeBar.length>=.18&&map.bridgeBar.width>=.065,'the river crossing is one broad discrete bar');
  const tree=a.diagnostics.moduleBounds['cape75-upstairs-route-map-forest-endpoint'],arrival=a.diagnostics.moduleBounds['cape75-upstairs-route-map-forest-arrival-diamond'];
  assert.ok(tree.min[0]-arrival.max[0]>=.035,'at least 3.5cm of printed paper separates the evergreen silhouette from the arrival marker');
  const model=createModel(cottage()),center=a.workstation.listeningSurfaceCenter;
  const mapRay=(uv)=>hit(model,[center[0]+(uv[0]-.5)*1.01,a.floor+1.30,center[2]+(uv[1]-.5)*.53],[0,-1,0],.5);
  try{
    model.root.updateMatrixWorld(true);
    assert.equal(mapRay([.15,.60]).object.userData.blackwaterSlot,'dark','navy water has a distinct value under the painted task light');
    for(const distance of [-.07,-.035,0,.035,.07]){
      const uv=[map.bridge[0]+map.bridgeBar.axis[0]*distance/1.01,map.bridge[1]+map.bridgeBar.axis[1]*distance/.53];
      assert.equal(mapRay(uv).object.userData.blackwaterSlot,'metal','actual rays find one continuous teal crossing bar rather than two paper-coloured slivers');
    }
    assert.equal(mapRay(map.endpoint).object.userData.blackwaterSlot,'rust','the arrival diamond survives above the forest');
    assert.equal(mapRay([.89,.19]).object.userData.blackwaterSlot,'dark','the broad triangular canopy is visible beyond the separated endpoint');
  }finally{model.dispose();}
});

test('exact vector contours partition one supported sheet with upward compiled normals and no overlap',()=>{
  const a=artPlan(),model=createModel(cottage()),map=a.routeMap,center=a.workstation.listeningSurfaceCenter;
  const surface=a.placements.filter(p=>p.shape==='triangle'&&p.role.startsWith('cape75-upstairs-route-map-'));
  const xCuts=map.paperHeights.map((_,i)=>center[0]+(i/map.paperColumns-.5)*map.paperSize[0]);
  assert.equal(map.partition,'exact convex contour clipping');assert.equal('surfaceColumns' in map,false);assert.equal('surfaceRows' in map,false);
  assert.equal(surface.length,map.surfaceTriangleCount);
  assert.equal(surface.length,map.surfacePolygons.reduce((sum,p)=>sum+p.polygon.length-2,0));
  assert.ok(surface.length<500,'exact vector boundaries replace the former 2,000-face centroid raster');
  assert.equal(map.paperColumns,10,'the original folded paper planes remain unchanged');
  assert.equal(map.inkSeparation,0);assert.equal(map.inkSurface,'one supported inlaid paper surface');
  assert.ok(!a.placements.some(p=>p.role==='cape75-upstairs-route-map-route-ink-border'),'the old stacked black-bordered strip is absent');
  const projectedArea=surface.reduce((sum,p)=>sum+Math.abs((p.points[1][0]-p.points[0][0])*(p.points[2][2]-p.points[0][2])-(p.points[2][0]-p.points[0][0])*(p.points[1][2]-p.points[0][2]))/2,0);
  assert.ok(Math.abs(projectedArea-map.paperSize[0]*map.paperSize[1])<1e-9,'exclusive colour triangles tile exactly one paper area');
  const pieces=map.surfacePolygons;
  assert.ok(Math.abs(pieces.reduce((sum,p)=>sum+polygonArea(p.polygon),0)-1)<1e-10,'exact polygons cover the whole sheet without clipped holes');
  for(let i=0;i<pieces.length;i++){
    const p=pieces[i];assert.ok(polygonArea(p.polygon)>0,'every paper partition has positive area');
    for(const point of p.polygon)assert.ok(point[0]>=p.column/10-1e-12&&point[0]<=(p.column+1)/10+1e-12&&point[1]>=-1e-12&&point[1]<=1+1e-12,'each contour vertex lies on its original physical paper strip');
    for(let j=i+1;j<pieces.length;j++)assert.ok(separates(p.polygon,pieces[j].polygon)||separates(pieces[j].polygon,p.polygon),`${i}/${j} have no overlapping painted interior`);
  }
  const roleArea=role=>surface.filter(p=>p.role===`cape75-upstairs-${role}`).reduce((sum,p)=>sum+Math.abs((p.points[1][0]-p.points[0][0])*(p.points[2][2]-p.points[0][2])-(p.points[2][0]-p.points[0][0])*(p.points[1][2]-p.points[0][2]))/2,0);
  assert.ok(Math.abs(roleArea('route-map-forest-footbridge-bar')-map.bridgeBar.length*map.bridgeBar.width)<1e-10,'the rendered crossing fills its exact solid rectangular contour');
  assert.ok(Math.abs(roleArea('route-map-forest-endpoint')-polygonArea(map.forestCanopy)*map.paperSize[0]*map.paperSize[1])<1e-10,'the rendered tree fills one exact triangular canopy and visible stem');
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,.5);
  const renderedHits=point=>{ray.ray.origin.set(point[0],a.floor+1.30,point[2]);return ray.intersectObject(model.root,true);};
  const paperY=u=>{const t=u*10,i=Math.min(9,Math.floor(t));return map.paperHeights[i]+(map.paperHeights[i+1]-map.paperHeights[i])*(t-i);};
  const colourAt=uv=>{
    const point=[center[0]+(uv[0]-.5)*map.paperSize[0],paperY(uv[0]),center[2]+(uv[1]-.5)*map.paperSize[1]];
    const hits=renderedHits(point).filter(h=>Math.abs(h.point.y-point[1])<1e-6);
    assert.equal(hits.length,1,'an actual ray finds exactly one paint face at the folded-paper height');
    return hits[0].object.userData.blackwaterSlot;
  };
  try{
    model.root.updateMatrixWorld(true);
    for(const v of [.12,.19,.27,.36,.53,.64,.79,.87]){
      assert.equal(colourAt([.035-.0003,v]),'pale');assert.equal(colourAt([.035+.0003,v]),'dark','the actual long navy boundary is straight, with no centroid-raster teeth');
    }
    const boundarySamples=(contour,inside,outside,edges=contour.map((_,i)=>i))=>{
      for(const i of edges){
        const p=contour[i],q=contour[(i+1)%contour.length],dx=q[0]-p[0],dz=q[1]-p[1],length=Math.hypot(dx,dz),normal=[-dz/length*.0005,dx/length*.0005];
        for(const t of [.24,.51,.77]){
          const midpoint=p.map((v,k)=>v+(q[k]-v)*t);
          assert.equal(colourAt(midpoint.map((v,k)=>v+normal[k])),inside,'paint reaches the exact intended vector edge');
          const actual=colourAt(midpoint.map((v,k)=>v-normal[k]));
          if(outside)assert.equal(actual,outside);else assert.notEqual(actual,inside,'the paint stops at the exact intended vector edge');
        }
      }
    };
    boundarySamples(map.bridgeBar.contour,'metal');
    boundarySamples([[.89,.06],[.99,.35],[.79,.35]],'dark','fabric',[0,2]);
    boundarySamples([[.86,.35],[.92,.35],[.92,.44],[.86,.44]],'dark','fabric',[1,2,3]);
    let checkedRenderedFaces=0;
    for(const mark of surface){
      const bounds=primitiveBounds(mark);
      assert.ok(xCuts.some((x,i)=>i<xCuts.length-1&&bounds.min[0]>=x-1e-8&&bounds.max[0]<=xCuts[i+1]+1e-8),`${mark.role} never bridges a fold with an unrelated plane`);
      const centroid=mark.points[0].map((_,i)=>mark.points.reduce((n,p)=>n+p[i],0)/3);
      const hits=renderedHits(centroid).filter(h=>Math.abs(h.point.y-centroid[1])<1e-6);
      assert.equal(hits.length,1,`${mark.role} has exactly one coloured paper face at this point, without an overlapping strip/white-paper wedge`);
      const actual=hits[0];assert.equal(actual.object.userData.blackwaterSlot,mark.slot);
      assert.ok(actual.face.normal.y>.99,`${mark.role} has an upward compiled geometric normal`);
      const normals=actual.object.geometry.attributes.normal;
      for(const i of [actual.face.a,actual.face.b,actual.face.c]){
        const normal=new THREE.Vector3().fromBufferAttribute(normals,i);
        assert.ok(normal.y>.99&&Math.abs(normal.length()-1)<1e-6,`${mark.role} retains a unit upward normal in the actual material batch`);
      }
      checkedRenderedFaces++;
    }
    assert.equal(checkedRenderedFaces,surface.length);
  }finally{model.dispose();}
});

test('runtime folio has a finite supported desktop footprint, clear reach and source-derived floor height',()=>{
  for(const height of [6.4,6.075]){
    const source=createBuildingPlan({...cottage(),height}),a=source.upstairsArt,f=a.routeFolio,desk=a.supports.find(s=>s.id===f.supportId),b=primitiveBounds({shape:'box',position:f.position,size:f.size,rotation:[0,f.yaw,0]});
    assert.equal(f.id,'cape75-footbridge-route-folio');assert.equal(f.destinationId,'forest');assert.equal(f.visualKind,'route-folio');assert.equal(f.requiresInteract,true);
    assert.equal(f.floorHeight,source.structure.floors.find(s=>s.id==='upper').top,'local upper floor is taken from this structure, without a world offset');
    assert.equal(f.bottom,desk.top);assert.ok(Math.abs(b.min[1]-desk.top)<1e-8);assert.ok(Math.abs(b.max[1]-f.top)<1e-8);
    assert.deepEqual(f.interactionPoint,[f.position[0],f.top,f.position[2]]);assert.deepEqual(f.approach3D,[f.approach[0],f.floorHeight,f.approach[1]]);
    assert.equal(f.sourceSolidId,desk.sourceSolidId);assert.ok(!a.placements.some(p=>p.id===f.id),'this visual compiler never emits the runtime-owned pickup');
    for(const [axis,i]of [['x',0],['z',2]])assert.ok(b.min[i]>=desk.bounds[axis][0]+.07&&b.max[i]<=desk.bounds[axis][1]-.07,'the whole footprint is supported with at least 7cm edge clearance');
    const base=a.workstation.taskLightBase;assert.ok(horizontalDistance(b,base.center[0],base.center[2])-base.radius>=.039999,'the folio clears the actual lamp base by 4cm');
    for(const p of a.placements){
      const q=primitiveBounds(p);
      if(q.max[1]>f.bottom+1e-8&&q.min[1]<f.top){assert.ok(q.max[0]<=b.min[0]||q.min[0]>=b.max[0]||q.max[2]<=b.min[2]||q.min[2]>=b.max[2],`${p.role} leaves the reserved runtime footprint empty`);}
      if(q.max[1]>a.floor+.02&&q.min[1]<a.floor+1.84)assert.ok(horizontalDistance(q,...f.approach)>=.64,`${p.role} preserves a full actor radius at the folio approach`);
    }
    const map=a.workstation.listeningSurfaceCenter,target=a.workstation.lightingTarget;
    assert.equal(target[0],(map[0]+f.position[0])/2);assert.equal(target[2],(map[2]+f.position[2])/2);
    const model=createModel({...cottage(),height});
    try{
      model.root.updateMatrixWorld(true);
      const supportHit=hit(model,[f.position[0],f.top+.08,f.position[2]],[0,-1,0],.2);
      assert.ok(supportHit&&Math.abs(supportHit.point.y-f.bottom)<1e-6,'a real merged desk surface directly supports the reserved item');
      const eye=new THREE.Vector3(f.approach[0],f.floorHeight+1.6,f.approach[1]),to=new THREE.Vector3(...f.interactionPoint).sub(eye),distance=to.length();
      assert.ok(Math.hypot(f.position[0]-f.approach[0],f.position[2]-f.approach[1])<2.1,'a reachable nearby front approach is supplied');
      assert.equal(hit(model,eye.toArray(),to.normalize().toArray(),distance-.001),undefined,'the standing reach ray clears the chair and desk clutter');
    }finally{model.dispose();}
  }
});

test('the room door route and both native inspection points retain the full 64cm actor radius',()=>{
  const a=artPlan(),points=[...a.inspectionPoints];
  for(let z=-2.45;z>=-5.0;z-=.10)points.push([0,a.floor,z]);
  for(const [x,feet,z]of points)for(const p of a.placements){
    const b=primitiveBounds(p);
    if(b.max[1]<=feet+.02||b.min[1]>=feet+1.84)continue;
    assert.ok(horizontalDistance(b,x,z)>=.64,`${p.role} preserves the circular standing/travel space at ${x},${z}`);
  }
});

test('the compiler emits only the owned placements and existing seven semantic slots',()=>{
  const a=artPlan(),compiled=[];
  const writer=Object.fromEntries(['box','bevelBox','cylinder','triangle'].map(shape=>[shape,(slot,...args)=>compiled.push({shape,slot,args})]));
  compileCape75UpstairsArt(writer,null);assert.equal(compiled.length,0);
  compileCape75UpstairsArt(writer,a);assert.equal(compiled.length,a.placements.length);
  assert.deepEqual([...new Set(compiled.map(p=>p.slot))],a.diagnostics.materialSlots);
  assert.deepEqual(new Set(a.diagnostics.materialSlots),new Set(['furnitureWood','pale','rug','fabric','dark','metal','rust']));
  assert.ok(a.diagnostics.triangleEstimate>3000&&a.diagnostics.triangleEstimate<7501,'the conservative primitive estimate retains the bounded art allocation');
});

test('merged room geometry exposes actual open storage and constructed cloth within the retained draw budget',()=>{
  const shared=createBlackwaterMaterials({loadTextures:false});let borrowedDisposals=0,geometryDisposals=0;
  for(const material of Object.values(shared))material.addEventListener('dispose',()=>borrowedDisposals++);
  const model=createModel({...cottage(),materials:shared}),a=model.diagnostics.plan.upstairsArt;
  const meshes=model.root.children.filter(c=>c.isMesh);
  for(const mesh of meshes)mesh.geometry.addEventListener('dispose',()=>geometryDisposals++);
  try{
    assert.ok(a,'the architecture owns the integrated upstairs visual plan');
    assert.ok(a.replacedSolidIds.every(id=>model.diagnostics.plan.structure.solids.find(s=>s.id===id).render===false),'original upper boxes remain finite hidden collision proxies');
    model.root.updateMatrixWorld(true);
    for(const cavity of a.cavities){
      const surface=hit(model,cavity.probe,cavity.direction,cavity.far);
      assert.ok(surface,`${cavity.id} has a recessed physical lining/content surface`);
      assert.ok(surface.distance>.18,`${cavity.id} is an actual cavity with more than 18cm of empty depth`);
      assert.ok(['dark','fabric','pale','furnitureWood'].includes(surface.object.userData.blackwaterSlot));
    }
    const upper=a.floor,map=a.workstation.listeningSurfaceCenter;
    const mapSurface=hit(model,[map[0]-.20,upper+1.20,map[2]],[0,-1,0],.40);
    assert.ok(mapSurface&&mapSurface.point.y>upper+.881,'the route paper has a real center fold above the desk');
    const heights=[];
    for(const x of [3.16,3.40,3.65,3.90,4.17,4.36])for(const z of [-6.40,-6.08,-5.76]){
      const cloth=hit(model,[x,upper+1.0,z],[0,-1,0],.50);assert.ok(cloth);heights.push(cloth.point.y);
    }
    assert.ok(Math.max(...heights)-Math.min(...heights)>.082,'actual physical rays find broad blanket crests');
    const added=Object.entries(model.diagnostics.trianglesPerModule).filter(([role])=>role.startsWith('cape75-upstairs-')).reduce((n,[,count])=>n+count,0);
    assert.ok(added>=3000&&added<=7200,`${added} real triangles fit the refined paper-surface allowance`);
    assert.ok(model.diagnostics.triangleCount<45000,'the complete Cape cottage stays under its whole-model ceiling');
    assert.equal(model.diagnostics.drawCalls,15,'visual detail stays in the fifteen active material batches');
    for(const mesh of meshes)for(const attr of Object.values(mesh.geometry.attributes))assert.ok(attr.array.every(Number.isFinite));
  }finally{model.dispose();model.dispose();}
  assert.equal(geometryDisposals,meshes.length,'the existing merged writer retains single geometry disposal ownership');
  assert.equal(borrowedDisposals,0);shared.dispose();assert.equal(borrowedDisposals,Object.keys(shared).length);
});
