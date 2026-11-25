import {freezeLocalTransforms} from './render-lifecycle.js';
import {TRAILS,reservedPlace} from './places.js';
import {placeDetails} from './place-art.js';
import {buildInterior,compilePieces} from './interior-plan.js';
import {cityIdentity} from './city-identity.js';
import {cityForecourtPlan} from './city-forecourts.js';
import {civicCraftPlan} from './civic-craft.js';
import {routeCraft} from './route-craft.js';
import {domesticExteriorPlan} from './domestic-exteriors.js';
import {compileWorldLabels,worldBoardMaterial,weatherBoard} from './world-labels.js';
import {houseShell} from './house-shell.js';
import {consoleMaterial} from './retro-materials.js';
import {bakeLocalAO,bakeFoliageAO,artDetailDebug} from './detail-materials.js';
import {paintArchitecture,paintTerrain,paintBridge,skyNoise,createWetCityMaterial} from './surface-art.js';
import {planarReflUniforms} from './planar-reflection.js';
import {createCapeGroundAtlas} from '../assets/forest-kit/ground-atlas.js';
import {coastalBotany,streetCraft} from './visual-details.js';
import {createCoastalMotion} from './coastal-motion.js';
import {createSettlementLife} from './settlement-life.js';
import {buildSettlement} from './settlement-art.js';
import {FRONTAGES,settlementReserved} from './settlement-plan.js';
import {accessSurface,accessReserved} from './access-plan.js';
import {treeContactShadowGeometry} from './tree-contact-shadows.js';
import * as T from '../vendor/three.module.js';
import {TERRAIN,CITY_GROUND,ROADS,LANDMARKS,HOSPITAL_GENERATOR,random,terrainHeight,baseHeight,bridgeHeight,bridgeAbutments,roadAt,clamp,groundHeight,stationPosition,entranceHeight} from './data.js';

import {authoredDetails} from './authored-details.js';

const up=new T.Vector3(0,1,0),dummy=new T.Object3D();
const COLORS={stone:0xb3baa5,wood:0x796849,darkwood:0x4b5141,roof:0x5b7976,road:0x6b7369,cream:0xded7b6,metal:0x405a55,glass:0x4e7779,leaf:0x607c49};
// Module registry, grouped by geometry/material and spatial tile. Per-instance
// colours retain the art palette; tile bounds retain useful frustum culling.
function grainTexture(){const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),rng=random(817),pixels=ctx.createImageData(64,64);for(let i=0;i<pixels.data.length;i+=4){const n=222+Math.floor(rng()*30);pixels.data[i]=n;pixels.data[i+1]=n;pixels.data[i+2]=n;pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);const texture=new T.CanvasTexture(c);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.colorSpace=T.SRGBColorSpace;return texture;}
const grain=grainTexture();
class Kit {
  constructor(scene){this.scene=scene;this.parts=new Map();this.labels=[];this.surface=0;this.roomTag=0;this.geometries={box:new T.BoxGeometry(1,1,1),cone:new T.ConeGeometry(1,1,7),dial:new T.CylinderGeometry(1,1,1,12).rotateX(Math.PI/2),cylinder:new T.CylinderGeometry(1,1,1,7),basin:new T.LatheGeometry([[0,-.5],[.66,-.5],[.85,-.40],[1,.30],[1.02,.43],[.96,.50],[.88,.43],[.86,.27],[.65,-.22],[0,-.22]].map(([r,y])=>new T.Vector2(r,y)),10),mug:new T.LatheGeometry([[0,-.5],[.80,-.5],[.91,-.43],[1,.40],[1,.47],[.96,.50],[.82,.47],[.82,.37],[.75,-.31],[0,-.31]].map(([r,y])=>new T.Vector2(r,y)),8),rock:new T.IcosahedronGeometry(1,0),sphere:new T.IcosahedronGeometry(1,1)};for(const geometry of Object.values(this.geometries))bakeLocalAO(geometry);this.material=paintArchitecture(new T.MeshStandardMaterial({color:0xffffff,flatShading:true,roughness:1,metalness:0,envMapIntensity:1.05}));this.count=0;}
  add(shape,x,y,z,sx,sy,sz,color,ry=0,q=null,role=this.surface,roomTag=this.roomTag){const foliage=shape==='fern'||shape==='tuft',interior=!!this.interior,tile=interior?120:foliage?84:210,distance=interior?96:shape==='tuft'?30:shape==='fern'?65:215,detail=interior||foliage||Math.max(sx,sy,sz)<2.1,key=interior?`room:${shape}:${this.interior}`:`world:${shape}:${Math.floor(x/tile)},${Math.floor(z/tile)}:${detail}`;if(!this.parts.has(key))this.parts.set(key,{shape,items:[],detail,distance,roomTile:this.interior||null});this.parts.get(key).items.push({x,y,z,sx,sy,sz,color,ry,q,role,roomTag});this.count++;}
  label(p){this.labels.push({...p,roomTile:this.interior||null});this.count++;}
  box(x,y,z,w,h,d,c,r=0,role=this.surface,roomTag=this.roomTag){this.add('box',x,y,z,w,h,d,c,r,null,role,roomTag);}
  rod(a,b,r,c){const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av),m=av.add(bv).multiplyScalar(.5);this.add('cylinder',m.x,m.y,m.z,r,d.length(),r,c,0,new T.Quaternion().setFromUnitVectors(up,d.normalize()));}
  finish(){
    let calls=0;const detailMeshes=[],roomBounds=new Map();
    for(const {shape,items,detail,distance,roomTile} of this.parts.values()){
      const sourceGeo=this.geometries[shape];
      if(!sourceGeo.attributes.artAO){
        if(shape==='fern'||shape==='tuft')bakeFoliageAO(sourceGeo);else bakeLocalAO(sourceGeo);
      }
      const geometry=sourceGeo.clone();
      const roles=new Float32Array(items.length),meta=new Float32Array(items.length*4);
      for(let i=0;i<items.length;i++){
        const p=items[i],r=p.role;roles[i]=r;
        const isWall=r===1,isFoundation=r===7,isRoom=!!roomTile||p.roomTag>.1;
        const topAO=isRoom?.70:isWall?.46:isFoundation?.60:1.;
        const botAO=isRoom?.66:(isWall||isFoundation)?.50:r===2?.76:1.;
        const tag=p.roomTag>0?p.roomTag:(roomTile?.5:0);
        meta[i*4]=topAO;meta[i*4+1]=botAO;meta[i*4+2]=tag;meta[i*4+3]=p.sy;
      }
      geometry.setAttribute('artRole',new T.InstancedBufferAttribute(roles,1));
      geometry.setAttribute('artMeta',new T.InstancedBufferAttribute(meta,4));
      const mesh=new T.InstancedMesh(geometry,this.material,items.length);
      for(let i=0;i<items.length;i++){const p=items[i];dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.sx,p.sy,p.sz);dummy.rotation.set(0,p.ry,0);if(p.q)dummy.quaternion.copy(p.q);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new T.Color(p.color));}
      mesh.computeBoundingSphere();mesh.receiveShadow=true;mesh.castShadow=shape!=='fern'&&shape!=='tuft';this.scene.add(mesh);
      let bounds=mesh.boundingSphere;
      if(roomTile){if(!roomBounds.has(roomTile))roomBounds.set(roomTile,new T.Sphere());bounds=roomBounds.get(roomTile);bounds.union(mesh.boundingSphere);}
      if(detail)detailMeshes.push({mesh,distance,bounds,room:!!roomTile});calls++;
    }
    // Each building belongs to one room tile, including its offset lettering.
    // All shapes and lettering in that tile share one visibility decision.
    // A plaque must never survive after its backing or partition disappears.
    for(const p of this.labels)if(p.roomTile){if(!roomBounds.has(p.roomTile))roomBounds.set(p.roomTile,new T.Sphere());roomBounds.get(p.roomTile).union(new T.Sphere(new T.Vector3(p.x,p.y,p.z),Math.hypot(p.w,p.h)/2));}
    this.parts.clear();for(const g of Object.values(this.geometries))g.dispose();const labels=compileWorldLabels(this.scene,this.labels,roomBounds);
    return {modules:this.count,batches:calls+labels.batches,detailRoots:detailMeshes.map(d=>d.mesh),labels,update(camera,roomScale=1){labels.update(camera,roomScale);for(const {mesh,distance,bounds,room} of detailMeshes)mesh.visible=camera.distanceToSquared(bounds.center)<(distance*(room?roomScale:1)+bounds.radius)**2;}};
  }
}
function surface(vertices,colors){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));if(colors)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;}
function buildTerrain(scene){
  const {minX,maxX,minZ,maxZ,step:s}=TERRAIN,positions=[],colors=[],slopes=[],color=new T.Color(),rng=random(711);
  const columns=Math.ceil((maxX-minX)/s),rows=Math.ceil((maxZ-minZ)/s),stride=columns+3;
  const heights=new Float64Array(stride*(rows+3));
  for(let row=-1;row<=rows+1;row++)for(let col=-1;col<=columns+1;col++)
    heights[(row+1)*stride+col+1]=baseHeight(minX+col*s,minZ+row*s);
  // Interpolate a shared slope field across grid edges; material transitions
  // should follow a bank rather than expose each triangle's separate normal.
  const slopeAt=i=>{const dx=(heights[i+1]-heights[i-1])/(2*s),dz=(heights[i+stride]-heights[i-stride])/(2*s);return 1-1/Math.sqrt(1+dx*dx+dz*dz);};
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const x=minX+col*s,z=minZ+row*s,i=(row+1)*stride+col+1;
    const a=[x,heights[i],z,i],b=[x+s,heights[i+1],z,i+1],c=[x,heights[i+stride],z+s,i+stride],d=[x+s,heights[i+stride+1],z+s,i+stride+1];
    for(const tri of [[a,c,b],[b,c,d]]){
      const y=(tri[0][1]+tri[1][1]+tri[2][1])/3;
      color.setHex(y<3.8?0xc4c199:y>62?0x8b9668:x>330?0x819875:0x718b4d);
      color.multiplyScalar(.93+rng()*.13);
      for(const [px,py,pz,index] of tri){positions.push(px,py,pz);colors.push(color.r,color.g,color.b);slopes.push(slopeAt(index));}
    }
  }
  const geometry=surface(positions,colors),uv=[];for(let i=0;i<positions.length;i+=3)uv.push(positions[i]/12,positions[i+2]/12);geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geometry.setAttribute('artSlope',new T.Float32BufferAttribute(slopes,1));
  const material=new T.MeshStandardMaterial({vertexColors:true,flatShading:true,map:grain,roughness:1,metalness:0,envMapIntensity:.55});material.userData.artDebug=artDetailDebug;
  // Paint the roads on their actual terrain triangles. Separate draped strips
  // fight the ground at grid diagonals and create ragged shoulders on hills.
  const f=n=>Number(n).toFixed(3),segments=[],roadPaint=[],roads=[...TRAILS,...ROADS];
  const points=roads.flatMap(road=>road.points),padding=Math.ceil(Math.max(...roads.map(road=>road.width*.5))+.85);
  const low=axis=>f(Math.floor(Math.min(...points.map(p=>p[axis])))-padding);
  const high=axis=>f(Math.ceil(Math.max(...points.map(p=>p[axis])))+padding);
  // Outside this conservative rectangle even the widest shoulder contributes
  // zero. Inside it, keep the original nearest-segment and paint calculations.
  const roadBounds=`all(greaterThanEqual(land,vec2(${low(0)},${low(1)})))&&all(lessThanEqual(land,vec2(${high(0)},${high(1)})))`;
  const rounded=n=>Number(f(n));
  for(const road of roads){
    const color=new T.Color(road.width<6?0xb5ae86:COLORS.road);
    const paint=new T.Vector4(...[color.r,color.g,color.b,road.width*.5].map(rounded));
    for(let i=1;i<road.points.length;i++){
      const a=road.points[i-1],b=road.points[i];
      segments.push(new T.Vector4(...[a[0],a[1],b[0],b[1]].map(rounded)));
      roadPaint.push(paint);
    }
  }
  const groundAtlas=createCapeGroundAtlas();
  material.onBeforeCompile=shader=>paintTerrain(shader,segments,roadPaint,roadBounds,groundAtlas);
  const mesh=new T.Mesh(geometry,material);mesh.receiveShadow=true;scene.add(mesh);return mesh;
}
function ribbon(scene,points,width,color,offset=.12,drape=true,finish){
  const p=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],l=Math.hypot(b[0]-a[0],b[2]-a[2]),nx=-(b[2]-a[2])/l*width*.5,nz=(b[0]-a[0])/l*width*.5;for(let j=0;j<6;j++){const left=-1+j/3,right=-1+(j+1)/3;const point=(v,t)=>{const x=v[0]+nx*t,z=v[2]+nz*t;return [x,(drape?terrainHeight(x,z):v[1])+offset,z];};const al=point(a,left),ar=point(a,right),bl=point(b,left),br=point(b,right);p.push(...al,...ar,...bl,...bl,...ar,...br);}}
  const mesh=new T.Mesh(surface(p),new T.MeshLambertMaterial({color,side:T.DoubleSide}));finish?.(mesh.material);mesh.receiveShadow=true;scene.add(mesh);
}
function buildRoads(scene,kit){
  for(const road of ROADS){const points=[];for(let i=1;i<road.points.length;i++){const a=road.points[i-1],b=road.points[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2);for(let j=0;j<n;j++){const t=j/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;points.push([x,terrainHeight(x,z),z]);}}const a=road.points.at(-1);points.push([a[0],terrainHeight(a[0],a[1]),a[1]]);
    if(road.width>=6)for(let i=0;i<points.length-1;i+=7){const a=points[i],b=points[i+1],angle=Math.atan2(b[0]-a[0],b[2]-a[2]);kit.box(a[0],a[1]+.24,a[2],.13,.025,2,0xd2c49a,angle);}
  }
  const c=CITY_GROUND,wetCityGroup=new T.Group();
  const roadMesh=new T.Mesh(new T.BoxGeometry(c.w,.06,c.d),createWetCityMaterial('road'));
  roadMesh.position.set(c.x,c.roadY-.03,c.z);roadMesh.receiveShadow=true;wetCityGroup.add(roadMesh);
  const walkGeo=new T.BoxGeometry(c.walkWidth,.16,c.walkWidth),walkMat=createWetCityMaterial('sidewalk');
  const walks=new T.InstancedMesh(walkGeo,walkMat,c.blocksX*c.blocksZ);let wi=0;
  for(let col=0;col<=c.blocksX;col++)for(let row=0;row<=c.blocksZ;row++){
    const x=c.originX+col*c.spacing,z=c.originZ+row*c.spacing;
    if(row<c.blocksZ&&col<c.blocksX){dummy.position.set(x+c.spacing/2,c.walkY-.08,z+c.spacing/2);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();walks.setMatrixAt(wi++,dummy.matrix);}
    if(row<12)for(let k=0;k<6;k++)kit.box(x,c.roadY+.015,z+k*12+6,.2,.025,5,0xd4cba8);
    if(col<10)for(let k=0;k<6;k++)kit.box(x+k*12+6,c.roadY+.015,z,5,.025,.2,0xd4cba8);
    // Short, legible crosswalks. Empty road ownership is retained at junctions.
    if(col<10&&row<12)for(let k=0;k<5;k++)kit.box(x+10,c.roadY+.022,z-4+k*2,3,.025,.8,0xc8c9b0);
  }
  walks.instanceMatrix.needsUpdate=true;walks.computeBoundingSphere();walks.castShadow=true;walks.receiveShadow=true;
  wetCityGroup.add(walks);scene.add(wetCityGroup);return wetCityGroup;
}
function gable(kit,b,y){const angle=Math.atan2(3.4,b.w*.5+1),length=Math.hypot(b.w*.5+1,3.4);for(const sign of [-1,1]){const q=new T.Quaternion().setFromEuler(new T.Euler(0,0,-sign*angle));kit.add('box',b.x+sign*(b.w*.25+.5),y+1.65,b.z,length,.5,b.d+2,b.accent,0,q,2);}kit.box(b.x,y+3.4,b.z,.5,.4,b.d+2,COLORS.darkwood);
  const positions=[];for(const sign of [-1,1])positions.push(b.x-b.w/2,y,b.z+sign*b.d/2,b.x+b.w/2,y,b.z+sign*b.d/2,b.x,y+3.4,b.z+sign*b.d/2);const caps=new T.Mesh(surface(positions),new T.MeshStandardMaterial({color:b.color,side:T.DoubleSide,roughness:.85,metalness:.02}));kit.scene.add(caps);
  kit.box(b.x+b.w*.28,y+2,b.z-2,.9,3,1.2,0x8d8168);
}
function compileBuilding(kit,b,arrivalTreads){
  const y=b.baseY,rng=random(b.seed),roomHeight=b.interiorHeight||3.4;kit.surface=1;
  kit.box(b.x,(y+b.foundationBottom)/2,b.z,b.w+.5,y-b.foundationBottom,b.d+.5,0x858d78,0,7);
  if(b.enterable){
    const stepDepth=b.entry.length/b.entry.steps;
    const treadRole=arrivalTreads&&b.id==='arrival-house'?10:kit.surface;
    for(let i=0;i<b.entry.steps;i++){
      const z=b.entry.z+(i+.5)*b.entry.length/b.entry.steps;
      const top=entranceHeight(b,b.x,z),bottom=terrainHeight(b.x,z)-.40;
      const treadColor=treadRole===10&&i>=b.entry.steps-4?0xb9b394:0xb3a789;
      kit.box(b.x,(top+bottom)/2,z,3,Math.max(.12,top-bottom),stepDepth,treadColor,0,treadRole);
    }
  }
  for(const side of [-1,1])for(let k=0;k<Math.ceil(b.d/2);k++){const z=b.z-b.d/2+(k+.5)*b.d/Math.ceil(b.d/2),bottom=terrainHeight(b.x+side*b.w/2,z);if(y-bottom>.35)kit.box(b.x+side*(b.w/2+.28),(y+bottom)/2,z,.08,y-bottom,b.d/Math.ceil(b.d/2)-.1,0x727d6c);}
  for(const tier of b.tiers){
    const yy=y+tier.y,oldtown=b.district==='oldtown';
    if(b.enterable&&tier.y===0){
      if(tier.h>roomHeight)kit.box(b.x,yy+roomHeight+(tier.h-roomHeight)/2,b.z,tier.w,tier.h-roomHeight,tier.d,b.color);
      const floorRole=b.id==='arrival-house'?11:b.id==='lightkeeper'?12:kit.surface;
      const floorColor=floorRole===11?0xb5a281:floorRole===12?0x998164:0xb6aa85;
      const baseTag=oldtown?1.5:.5;
      kit.box(b.x,yy+.10,b.z,b.w,.2,b.d,floorColor,0,floorRole,baseTag);
      for(let floor=0;floor<roomHeight/3.4;floor++)for(const w of houseShell({...b,upper:floor>0}).walls){
        const wallTag=floor===0?(oldtown?(w.w===.4?(w.x>0?4:5):(w.z>0?2:3)):(w.w===.4?(w.x>0?8:9):(w.z>0?6:7))):0;
        kit.box(b.x+w.x,yy+w.y+w.h/2+floor*3.4,b.z+w.z,w.w,w.h,w.d,b.color,0,kit.surface,wallTag);
      }
      kit.box(b.x,yy+roomHeight-.08,b.z,b.w-.4,.16,b.d-.4,0xb8b496,0,kit.surface,baseTag);
      // Furniture and room linings have a shorter spatial budget than the
      // exterior shell. Keep every near-room piece, including large counters
      // and partitions, while distant opaque buildings hide their contents.
      kit.surface=0;kit.roomTag=oldtown?1.5:.5;kit.interior=`${Math.floor(b.x/90)},${Math.floor(b.z/90)}`;
      try{buildInterior(kit,b);}finally{kit.interior=false;kit.roomTag=0;kit.surface=1;}
    }else kit.box(b.x,yy+tier.h/2,b.z,tier.w,tier.h,tier.d,b.color);
    // Four exposed surfaces with dimensional floor and bay rhythms.
    for(const side of [0,1,2,3]){
      const along=side<2?tier.w:tier.d,count=Math.floor(along/3.4),span=along/count;
      const front=side===0,back=side===1;
      for(let floor=0;floor<tier.floors;floor++)for(let bay=0;bay<count;bay++){
        if(front&&floor===0&&tier.y===0&&FRONTAGES[b.id])continue;
        if(b.enterable&&front&&floor===0&&tier.y===0&&Math.abs((bay+.5)*span-along/2)<2.8)continue;
        const u=(bay+.5)*span-along/2,wy=yy+floor*3.4+1.9;
        const openWindow=b.enterable&&tier.y===0&&floor*3.4<roomHeight,offset=openWindow?.26:.055;let wx=b.x,wz=b.z;if(side<2){wx+=u;wz+=(front?1:-1)*(tier.d/2+offset);}else{wx+=(side===2?1:-1)*(tier.w/2+offset);wz+=u;}
        const c=rng()>(oldtown?.62:.86)?0xd6bf84:COLORS.glass;
        if(!openWindow)kit.box(wx,wy,wz,side<2?1.25:.09,1.65,side<2?.09:1.25,c,0,c===0xd6bf84?6:5);
        else {
          const ix=wx-(side===2?.52:side===3?-.52:0),iz=wz-(front?.52:back?-.52:0);
          kit.box(ix,wy-.9,iz,side<2?1.55:.27,.16,side<2?.27:1.55,COLORS.cream);
          kit.box(side<2?wx:b.x+(side===2?1:-1)*b.w/2,wy,side<2?b.z+(front?1:-1)*b.d/2:wz,side<2?1.25:.12,.075,side<2?.12:1.25,COLORS.cream);
          kit.box(side<2?wx:b.x+(side===2?1:-1)*b.w/2,wy,side<2?b.z+(front?1:-1)*b.d/2:wz,.075,1.65,.075,COLORS.cream);
        }
        kit.box(wx,wy-.9,wz,side<2?1.55:.27,.16,side<2?.27:1.55,COLORS.cream);
        if(b.district==='village'){kit.box(wx+(side<2?0:side===2?.06:-.06),wy,wz+(front?.06:back?-.06:0),side<2?.08:.08,1.65,side<2?.08:.08,COLORS.cream);for(const sign of [-1,1])kit.box(wx+(side<2?sign*.82:0),wy,wz+(side<2?0:sign*.82),side<2?.26:.12,1.7,side<2?.12:.26,b.accent);}
        if(b.district==='oldtown'&&floor===1&&bay%2===0&&!(front&&FRONTAGES[b.id]))kit.box(wx,wy-.9,wz+(front?.55:back?-.55:0),side<2?2:.7,.18,side<2?.9:2,0x808c7a);
      }
    }
    kit.box(b.x,yy+tier.h+.05,b.z,tier.w+.65,.26,tier.d+.65,COLORS.cream);
    if(!b.enterable){
      for(const sign of [-1,1]){kit.box(b.x+sign*(tier.w/2-.35),yy+tier.h/2,b.z+tier.d/2+.12,.5,tier.h,.28,COLORS.cream);}
    }
  }
  if(b.roof==='gable')gable(kit,b,y+b.height);else if(b.roof==='sawtooth'){
    for(let j=0;j<3;j++){const q=new T.Quaternion().setFromEuler(new T.Euler(-.20,0,0));kit.add('box',b.x,y+b.height+1,b.z-b.d/2+(j+.5)*b.d/3,b.w+1,.3,b.d/3+.4,0x607b73,0,q);kit.box(b.x,y+b.height+.8,b.z-b.d/2+j*b.d/3,b.w,1.4,.16,0x657f79);}
  }else{
    const top=b.tiers.at(-1),topY=y+b.height,tw=top.w,td=top.d;
    kit.box(b.x,topY+.22,b.z,tw-.6,.12,td-.6,0x67776c,0,2);
    if(b.district!=='village'){
      kit.box(b.x,topY+.42,b.z+td/2-.18,tw,.48,.36,0x7b8378,0,1);
      kit.box(b.x,topY+.42,b.z-td/2+.18,tw,.48,.36,0x7b8378,0,1);
      kit.box(b.x-tw/2+.18,topY+.42,b.z,.36,.48,td,0x7b8378,0,1);
      kit.box(b.x+tw/2-.18,topY+.42,b.z,.36,.48,td,0x7b8378,0,1);
    }
    kit.box(b.x+3,topY+1,b.z-2,4,1.5,3,0x8b958b,0,0);
    if(b.seed%2===0&&tw>12&&td>12){
      kit.box(b.x-tw*.22,topY+.85,b.z+td*.16,2.4,1.1,2.1,0x62706b,0,0);
      kit.add('cylinder',b.x-tw*.22+1.6,topY+.95,b.z+td*.16,.28,1.3,.28,COLORS.metal,0,null,0);
    }
    if(b.seed%3===1&&tw>14&&td>14){
      kit.add('cylinder',b.x+tw*.24,topY+1.4,b.z+td*.20,1.05,2.2,1.05,0x5c6f68,0,null,0);
    }
    if(b.roof==='crown'){kit.box(b.x,topY+3,b.z,tw*.5,5,td*.5,b.color);kit.rod([b.x,topY+5,b.z],[b.x,topY+13,b.z],.16,COLORS.metal);}
  }
  if(FRONTAGES[b.id]){kit.surface=0;return;}
  if(b.enterable){kit.box(b.x,y+2.85,b.z+b.d/2+.85,b.cityInterior?5.4:4.3,b.cityInterior?.18:.25,2.2,b.accent);for(const sign of [-1,1])kit.box(b.x+sign*(b.cityInterior?2.45:2),y+1.3,b.z+b.d/2+1.5,b.cityInterior?.22:.16,2.6,b.cityInterior?.22:.16,b.cityInterior?COLORS.metal:COLORS.wood);}
  else{const color=[0x8b5945,0x536d65,0xb9a267][b.seed%3];kit.box(b.x,y+3,b.z+b.d/2+.8,b.w-2,.3,1.8,color);for(let k=0;k<3;k++)kit.box(b.x-6+k*6,y+1.5,b.z+b.d/2+.1,3.6,2.3,.13,0x3c5353,0,5);}kit.surface=0;
  if(b.id==='arrival-house'){
    // Mount the shelter name on the gable, above the porch roof.
    kit.box(b.x,y+4,b.entry.z+.19,6.5,1.22,.38,COLORS.darkwood);
    sign(kit.scene,'MARINER’S REST',b.x,y+4,b.entry.z+.39,6.5);
  }
  if(b.cityInterior){const identity=cityIdentity(b);kit.label({x:b.x,y:y+2.36,z:b.entry.z+1.97,w:4.9,h:.72,text:identity.name,subline:identity.room,colour:identity.colour});}
}
export function sign(scene,text,x,y,z,width=6,rotation=0,dark=false,posts=false){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const c=canvas.getContext('2d');c.fillStyle=dark?'#d6d0ae':'#3d5550';c.fillRect(0,0,512,96);c.strokeStyle=dark?'#4b6255':'#c8c6a5';c.lineWidth=3;c.strokeRect(7,7,498,82);c.fillStyle=dark?'#3d5550':'#e2d8af';c.font='600 36px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText(text,256,48,475);
  weatherBoard(c,0,0,512,96,[...text].reduce((s,ch)=>s+ch.charCodeAt(0),0)+7,dark?'#d6d0ae':'#3d5550');
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.minFilter=T.LinearFilter;
  const m=new T.Mesh(new T.PlaneGeometry(width,width*96/512),worldBoardMaterial(texture,dark?0xd6d0ae:0x3d5550));m.position.set(x,y,z);m.rotation.y=rotation;scene.add(m);
  // Free-standing road signs need their own supports; building-mounted signs do
  // not. Posts land on the actual ground and stop just under the board so the
  // sign never reads as a floating slab.
  if(posts){
    const h=width*96/512,postMaterial=new T.MeshStandardMaterial({color:0x4a5d53,flatShading:true,roughness:.78,metalness:.14});
    for(const side of [-1,1]){
      const lx=(width/2-.4)*side,wx=x+Math.cos(rotation)*lx,wz=z-Math.sin(rotation)*lx,gy=groundHeight(wx,wz),top=y-h/2,height=Math.max(.8,top-gy);
      const post=new T.Mesh(new T.BoxGeometry(.16,height,.16),postMaterial);
      post.position.set(wx,gy+height/2,wz);post.castShadow=true;post.receiveShadow=true;scene.add(post);
    }
  }
  return m;
}
function tree(kit,x,y,z,s=1,kind='pine',rotation=0){
  kit.surface=3;kit.add('cylinder',x,y+4*s,z,.27*s,8*s,.27*s,0x5a4e39);
  kit.add('cone',x,y+.38*s,z,.52*s,.78*s,.52*s,0x4b4030,rotation);
  if(kind==='pine'){
    for(let i=0;i<5;i++){const a=rotation+i*2.4,r=(3.1-i*.48)*s;kit.add('cone',x+Math.cos(a)*.4*s,y+(4.7+i*1.6)*s,z+Math.sin(a)*.4*s,r,(3.6-i*.15)*s,r*.82,[0x364b3a,0x45583d,0x566344,0x626a48,0x74704b][i],a,null,4);}
    for(let i=0;i<3;i++){const a=rotation+i*2.1;kit.rod([x,y+3*s,z],[x+Math.cos(a)*2*s,y+4*s,z+Math.sin(a)*2*s],.10*s,0x695c42);}
  }else{
    const colors=rotation>3?[0x8c8450,0xa38d55,0x7c7d4a]:[0x5b6b45,0x727a4c,0x8a7d4f];
    for(let i=0;i<3;i++){const a=rotation+i*2.1,dx=Math.cos(a)*2*s,dz=Math.sin(a)*2*s;kit.rod([x,y+3*s,z],[x+dx,y+6*s,z+dz],.16*s,0x726347);kit.add('sphere',x+dx,y+(6.6+i*.6)*s,z+dz,3.1*s,2.8*s,3*s,colors[i],a,null,4);}
  }
  if(kind==='orchard')for(let i=0;i<5;i++){const a=rotation+i*2.4;kit.add('rock',x+Math.sin(a)*1.8*s,y+(5.3+i%2)*s,z+Math.cos(a)*1.8*s,.16*s,.2*s,.16*s,0xb59a57,a,null,4);}
  kit.surface=0;
}
function buildBridge(scene,kit){
  const p=[];for(let x=70;x<=370;x+=5)p.push([x,bridgeHeight(x),0]);ribbon(scene,p,23,0x999689,.07,false,material=>paintBridge(material,'concrete'));
  ribbon(scene,p,16,0x696c67,.10,false,material=>paintBridge(material,'asphalt'));
  // Continue the deck edges below the pavement and seat each end in its bank.
  const shell=[];
  const quad=(a,b,c,d)=>shell.push(...a,...b,...c,...a,...c,...d);
  for(let i=1;i<p.length;i++){
    const [x0,h0]=p[i-1],[x1,h1]=p[i];
    for(const z of [-11.5,11.5])quad([x0,h0+.07,z],[x1,h1+.07,z],[x1,h1-.7,z],[x0,h0-.7,z]);
    quad([x0,h0-.7,-11.5],[x1,h1-.7,-11.5],[x1,h1-.7,11.5],[x0,h0-.7,11.5]);
  }
  const soffit=new T.Mesh(surface(shell),new T.MeshLambertMaterial({color:0x82877b,side:T.DoubleSide}));
  paintBridge(soffit.material,'concrete');
  soffit.castShadow=soffit.receiveShadow=true;scene.add(soffit);
  for(const {x,y,h,w,d} of bridgeAbutments)kit.box(x,y+h/2,0,w,h,d,0x8d8a78,0,1);
  // Guardrails follow the grade on each bay. The existing collision and road
  // widths stay fixed, with faded edge lines to mark the pedestrian margin.
  for(let x=70;x<370;x+=5){
    const y=bridgeHeight(x),next=bridgeHeight(x+5);
    if(x%10===0)kit.box(x+2.5,bridgeHeight(x+2.5)+.13,0,3,.02,.14,0xb8a473);
    for(const z of [-9.7,9.7]){
      kit.box(x,y+.51,z,.18,.98,.18,0x565d57);
      for(const [h,r] of [[.96,.08],[.48,.043]])kit.rod([x,y+h,z],[x+5,next+h,z],r,0x48524e);
      kit.box(x+2.5,bridgeHeight(x+2.5)+.13,Math.sign(z)*7.3,2.8,.018,.1,0xa4a194);
    }
  }
  for(const x of [120,320]){
    for(const z of [-10.5,10.5]){
      kit.box(x,34,z,3,84,3,0x9d9b88,0,1);
      kit.box(x,2,z,8,10,7,0x858477,0,1);
      for(const y of [43,69])kit.box(x,y,z,3.4,2.65,3.4,0x838577,0,1);
    }
    kit.box(x,69,0,3,2,20.8,0xada692,0,1);
    kit.box(x,43,0,3,2,20.8,0xada692,0,1);
  }
  for(const z of [-10.5,10.5]){let prev=null;for(let x=70;x<=370;x+=5){const y=x<120?16+(x-70)*1.12:x>320?72-(x-320)*1.12:29+43*((x-220)/100)**2;if(prev)kit.rod(prev,[x,y,z],.16,0x495f59);if(x%10===0)kit.rod([x,bridgeHeight(x)+1,z],[x,y,z],.055,0x5e7469);prev=[x,y,z];}}
  sign(scene,'SAINT ORIN',65,22,0,10,Math.PI/2,false,true);
}
function buildLandmarks(scene,kit){
  const y=terrainHeight(-820,-260);
  kit.add('cylinder',-820,y+13,-260,3.8,26,3.8,0xe1d8b7);kit.add('cylinder',-820,y+18,-260,3.88,4,3.88,0x9b6f53);kit.add('cylinder',-820,y+27,-260,5,.5,5,0x516d65);kit.add('cylinder',-820,y+29,-260,3.4,3.5,3.4,0xd1bd78);kit.add('cone',-820,y+32,-260,4.8,3,4.8,0x506d66);
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;kit.box(-820+Math.cos(a)*3.4,y+29,-260+Math.sin(a)*3.4,.2,3.5,.2,COLORS.metal);}
  const hill=terrainHeight(-420,-280);for(const dx of [-3,3])for(const dz of [-3,3])kit.rod([-420+dx,hill,-280+dz],[-420+dx*.2,hill+31,-280+dz*.2],.2,COLORS.metal);
  for(let i=0;i<6;i++){const h=hill+i*5,w=3-i*.4;kit.rod([-420-w,h,-280-w],[-420+w-.4,h+5,-280-w+.4],.08,COLORS.metal);kit.box(-420,h,-280,2*w,.15,2*w,COLORS.metal);}kit.rod([-420,hill+30,-280],[-420,hill+39,-280],.16,0x86604a);
  // Civic garden: formal paths and a visible clock tower rather than another block.
  kit.box(734,14.235,0,114,.48,130,0x7c925c,0,13);kit.box(734,14.52,0,8,.08,130,0xc4bb93,0,14);kit.box(734,14.52,0,114,.08,8,0xc4bb93,0,14);
  kit.add('cylinder',734,15,0,9,1.4,9,0xc2bca1);kit.add('cylinder',734,15.7,0,7,.2,7,0x719c99);kit.box(734,27,0,7,24,7,0xc9c1a2);kit.box(734,39.5,0,9,2,9,0xe0d7b2);kit.add('cone',734,45,0,7,10,7,0x53756c,Math.PI/4);
  for(const x of [690,778])for(let z=-54;z<=54;z+=27)tree(kit,x,14.4,z,.9,'broad');
  for(const side of [-1,1])sign(scene,'SAINT ORIN · 1894',734,18,side*3.55,6,side>0?0:Math.PI,true);
  const face=document.createElement('canvas');face.width=face.height=512;const fc=face.getContext('2d');fc.scale(4,4);fc.fillStyle='#d6cfaa';fc.beginPath();fc.arc(64,64,61,0,Math.PI*2);fc.fill();fc.strokeStyle='#445d50';fc.lineWidth=5;fc.stroke();for(let i=0;i<12;i++){const a=i/12*Math.PI*2;fc.beginPath();fc.moveTo(64+Math.sin(a)*49,64-Math.cos(a)*49);fc.lineTo(64+Math.sin(a)*55,64-Math.cos(a)*55);fc.stroke();}fc.lineWidth=4;fc.beginPath();fc.moveTo(64,64);fc.lineTo(37,45);fc.moveTo(64,64);fc.lineTo(103,76);fc.stroke();
  const clockTexture=new T.CanvasTexture(face);clockTexture.magFilter=T.LinearFilter;clockTexture.colorSpace=T.SRGBColorSpace;
  for(let i=0;i<4;i++){const a=i*Math.PI/2,m=new T.Mesh(new T.PlaneGeometry(4.5,4.5),new T.MeshLambertMaterial({map:clockTexture,transparent:true}));m.position.set(734+Math.sin(a)*3.56,35,Math.cos(a)*3.56);m.rotation.y=a;scene.add(m);}
  // A canopy fascia carries the hospital name clear of the window bays.
  kit.box(970,18.4,-319.02,13,1.60,.22,COLORS.metal);
  kit.label({x:970,y:18.4,z:-318.90,w:12.7,h:1.40,text:'NORTHPOINT HOSPITAL',subline:'EMERGENCY / WARD & ADMISSIONS',colour:COLORS.metal});
  // East ferry: pier, mooring posts, hull, cabins, and gangway.
  kit.box(1211,13,300,86,2,24,0x9e9e82,0,14);for(let x=1174;x<1250;x+=8)kit.box(x,14.08,300,.15,.04,24,0x6b7465);
  kit.box(1250,8,300,25,8,58,0x3d6667);kit.box(1250,12.2,300,26,.7,58,0xb5baa3);kit.box(1250,15,298,18,5,31,0xd6d0b0);kit.box(1250,18.1,298,20,1,34,0x647f77);kit.box(1250,21,289,13,5,11,0xd7d0af);kit.box(1250,21,283.4,11,2,.1,0x446b70);kit.box(1250,24.4,296,3,5,4,0x9d634a);
  sign(scene,'LAST FERRY',1180,19,292,9);
  for(const p of LANDMARKS){if(p.type==='relay'){const pos=stationPosition(p),gy=groundHeight(pos.x,pos.z);kit.box(pos.x,gy+1.05,pos.z,1.2,2.1,.8,0x5b736c);kit.box(pos.x,gy+1.5,pos.z+.43,.65,.5,.07,0xc69b61);kit.rod([pos.x,gy+2,pos.z],[pos.x,gy+5,pos.z],.045,COLORS.metal);}
    if(p.type==='camp'){const gy=groundHeight(p.x,p.z);kit.add('cylinder',p.x,gy+.1,p.z,1.4,.2,1.4,0x686a57);for(let i=0;i<5;i++)kit.box(p.x+Math.cos(i*1.25)*.5,gy+.3,p.z+Math.sin(i*1.25)*.5,.3,.3,1.3,0x5a4a35,i);}
  }
}
function streetDetails(scene,kit,data,lampSpots){
  const rng=random(843);
  const hasLamp=(col,row)=>col>=0&&col<10&&row>=0&&row<12&&!(Math.abs(400+col*76-740)<65&&Math.abs(-448+row*76)<90);
  const sagWire=(ax,az,bx,bz)=>{
    const segs=3;let px=ax,py=20.6,pz=az;
    for(let s=1;s<=segs;s++){
      const t=s/segs,nx=ax+(bx-ax)*t,nz=az+(bz-az)*t,ny=20.6-Math.sin(t*Math.PI)*1.25;
      kit.rod([px,py,pz],[nx,ny,nz],.012,0x252d2b);px=nx;py=ny;pz=nz;
    }
  };
  for(let col=0;col<10;col++)for(let row=0;row<12;row++){
    if(!hasLamp(col,row))continue;
    const x=400+col*76,z=-448+row*76;
    kit.add('cylinder',x,17.4,z,.12,6.6,.12,COLORS.metal);kit.box(x+1,20.65,z,2.4,.17,.2,COLORS.metal);kit.box(x+2,20.5,z,.8,.18,.5,0xead5a2,0,6);
    lampSpots.push([x+2,20.4,z,6.1]);
    if((col+row)%2===0&&hasLamp(col+1,row))sagWire(x,z,x+76,z);
    if((col+row)%2===1&&hasLamp(col,row+1))sagWire(x,z,x,z+76);
    kit.box(x+9,14.8,z+2,1.1,1.5,1.1,0x5f776b);kit.box(x+13,14.7,z+2,3,.14,.9,0x876e4a);kit.box(x+13,15.1,z+2.4,3,.7,.12,0x876e4a);
    if(rng()>.6){kit.box(x+3,14.6,z+17,1.6,1,1.3,0xad9b73);kit.box(x+4.5,14.4,z+18,1,.7,1,0x9c8a65);}
  }
  const names=['ALDER GENERAL STORE','THE MARINER','POST OFFICE','FIELD SUPPLIES'];let i=0;
  for(const b of data.buildings.filter(b=>b.district==='village').slice(0,8)){sign(scene,names[i++%names.length],b.x,b.baseY+3.1,b.z+b.d/2+1.03,b.w*.73);}
  const shops=['ORIN PROVISIONS','THE RECORD ROOM','NORTH STAR PHARMACY','MORROW & SONS','ALDER BOOKSHOP','COASTAL HARDWARE','LAST LIGHT CAFÉ','SAINT ORIN POST'];i=0;
  for(const b of data.buildings.filter(b=>b.district==='oldtown'&&b.enterable)){const fallback=shops[i++%shops.length],name=b.id==='building-87'?'MORROW MARITIME':fallback;if(!FRONTAGES[b.id])sign(scene,name,b.x,18,b.z+b.d/2+.22,Math.min(b.w-2,15));}
  for(const [x,z,label] of [[-690,264,'ALDER  →'],[-470,55,'←  WESTLIGHT'],[-353,-215,'SIGNAL HILL'],[-240,54,'SAINT ORIN  →']]){const y=terrainHeight(x,z);kit.box(x+6,y+1.5,z,.15,3,.15,COLORS.wood);sign(scene,label,x+6,y+2.6,z,4);}
  // Inland ruins provide a destination and a different silhouette.
  for(let i=0;i<9;i++){const x=-790+i*5,z=12;kit.box(x,terrainHeight(x,z)+1.7,z,3.4,3.4,1.2,0xa1a28a);}for(let i=0;i<5;i++){const x=-790,z=12+i*5;kit.box(x,terrainHeight(x,z)+1.3,z,1.2,2.6,3.7,0xa1a28a);}
  // The canonical orchard in data.trees owns the planted rows and reserves
  // house footprints and access paths. A second scenery grid grew into homes.
}
function createSky(scene){
  const uniforms={time:{value:0},sun:{value:new T.Vector3(-115,135,72).normalize()},top:{value:new T.Color(0x1a2a36)},bottom:{value:new T.Color(0x9b7a5e)},cloudLight:{value:new T.Color(0xcaaa8a)},cloudShade:{value:new T.Color(0x2f3d47)}};
  const material=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms,vertexShader:'varying vec3 vDir; void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
   varying vec3 vDir;uniform float time;uniform vec3 sun,top,bottom,cloudLight,cloudShade;
   ${skyNoise}
   float fbm5(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*artNoise(p);p=p*2.04+vec2(7.3,-5.1);a*=.5;}return s;}
   void main(){vec3 d=normalize(vDir);float h=pow(max(d.y,0.),.55),s=max(dot(d,sun),0.);
    vec3 c=mix(bottom,top,h);
    c+=vec3(.11,.10,.08)*pow(s,6.)+vec3(.12,.11,.09)*pow(s,32.);
    vec2 p=d.xz/max(.14,d.y+.22)*1.6+vec2(time*.0012,0.);
    float field=fbm5(p),ridge=fbm5(p*1.9+vec2(3.1,-2.7));
    float coverage=smoothstep(.34,.68,field*.70+ridge*.30)*smoothstep(.00,.16,d.y);
    float lit=clamp(.36+(fbm5(p+sun.xz*.16)-field)*4.6+d.y*.18,0.,1.);
    vec3 cloud=mix(cloudShade,cloudLight,lit);
    cloud+=vec3(.12,.11,.08)*pow(s,9.)*(1.-lit*.4);
    float shelfY=smoothstep(.00,.14,d.y)*(1.-smoothstep(.20,.46,d.y));
    float shelf=shelfY*smoothstep(.42,.68,fbm5(d.xz/max(.22,d.y+.32)*3.0+vec2(-time*.0006,time*.0004)));
    c=mix(c,cloud,coverage*.90);
    c=mix(c,mix(cloudShade*.80,cloudLight,.52),shelf*.55);
    c=mix(c,vec3(.92,.91,.86),smoothstep(.9991,.9996,dot(d,sun))*(1.-coverage*.88));
    c=mix(bottom,c,smoothstep(-.02,.08,d.y));
    gl_FragColor=vec4(c,1.);
   }`});
  const sky=new T.Mesh(new T.SphereGeometry(4200,24,12),material);sky.frustumCulled=false;scene.add(sky);return {sky,uniforms};
}
function createStormClouds(scene){
  const rng=random(991),lobes=[[-.56,.03,-.06,.74,.58,.62],[0,.30,.02,.92,.78,.74],[.54,.04,-.04,.72,.58,.60],[.14,-.05,.38,.66,.52,.56],[-.26,-.06,-.36,.62,.48,.52],[.32,.14,.32,.56,.46,.50]];
  const verts=[],cols=[],topCol=new T.Color(0x9aaab2),botCol=new T.Color(0x3a4852),col=new T.Color();
  for(const [ox,oy,oz,sx,sy,sz] of lobes){
    const g=new T.IcosahedronGeometry(1,1).toNonIndexed();
    const pos=g.attributes.position;
    for(let i=0;i<pos.count;i++){
      const vx=pos.getX(i)*sx+ox,vy=pos.getY(i)*sy+oy,vz=pos.getZ(i)*sz+oz;
      verts.push(vx,vy,vz);
      const t=clamp((vy+.55)/1.25,0,1);
      col.copy(botCol).lerp(topCol,t);
      cols.push(col.r,col.g,col.b);
    }
    g.dispose();
  }
  const geo=surface(verts,cols),count=16;
  const mat=new T.MeshStandardMaterial({vertexColors:true,roughness:.99,metalness:0,flatShading:true,envMapIntensity:.45,emissive:0x2b363e,emissiveIntensity:.25});
  const mesh=new T.InstancedMesh(geo,mat,count);
  let placed=0;
  while(placed<count){
    const x=-950+rng()*2350,z=-700+rng()*1400,y=258+rng()*75;
    const w=85+rng()*55,h=16+rng()*12,d=70+rng()*45;
    if(Math.hypot(x+900,z-520)<280)continue;
    dummy.position.set(x,y,z);dummy.rotation.set(0,rng()*Math.PI*2,0);dummy.scale.set(w,h,d);dummy.updateMatrix();
    mesh.setMatrixAt(placed++,dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;scene.add(mesh);
  return {mesh,update(time){mesh.position.x=Math.sin(time*.014)*34;mesh.position.z=Math.cos(time*.011)*22;}};
}
function createCoastalRain(scene){
  const count=1100,base=new T.PlaneGeometry(1,1);base.translate(0,.5,0);
  const geo=new T.InstancedBufferGeometry();geo.index=base.index;geo.attributes.position=base.attributes.position;geo.attributes.uv=base.attributes.uv;
  const off=new Float32Array(count*3),seed=new Float32Array(count),rng=random(409);
  for(let i=0;i<count;i++){off[i*3]=(rng()-.5)*44;off[i*3+1]=rng()*28;off[i*3+2]=(rng()-.5)*44;seed[i]=rng();}
  geo.setAttribute('aOff',new T.InstancedBufferAttribute(off,3));
  geo.setAttribute('aSeed',new T.InstancedBufferAttribute(seed,1));
  geo.instanceCount=count;
  const uniforms={uTime:{value:0},uBox:{value:new T.Vector3(44,28,44)}};
  const mat=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,
   vertexShader:`attribute vec3 aOff;attribute float aSeed;uniform float uTime;uniform vec3 uBox;varying float vA;varying float vT;
    void main(){
     float sp=18.+aSeed*8.;
     vec3 p=vec3(aOff.x+uTime*1.8,aOff.y-uTime*sp,aOff.z+uTime*.7);
     p=mod(p-cameraPosition,uBox)-uBox*.5+cameraPosition;
     vec3 right=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
     vec3 dir=normalize(vec3(.07,-1.,.03));
     float len=.55+.45*aSeed;
     vec3 wp=p+right*(position.x*.018)+dir*(position.y*len);
     float d=length(wp.xz-cameraPosition.xz);
     float altFade=1.-smoothstep(45.,85.,cameraPosition.y);
     vA=(1.-smoothstep(10.,22.,d))*(.35+.65*aSeed)*altFade;vT=position.y;
     gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);
    }`,
   fragmentShader:`varying float vA;varying float vT;void main(){float head=pow(clamp(vT,0.,1.),1.3);gl_FragColor=vec4(vec3(.55,.64,.70)*(.12*vA*head),1.);}`});
  const mesh=new T.Mesh(geo,mat);mesh.frustumCulled=false;mesh.renderOrder=6;scene.add(mesh);base.dispose();
  return {mesh,update(t){uniforms.uTime.value=t;}};
}
function createLampCones(scene,spots){
  if(!spots.length)return null;
  const geo=new T.ConeGeometry(2.7,1,14,1,true).translate(0,-.5,0);
  const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,
   vertexShader:`varying vec3 vWorld;varying vec3 vN;varying float vH;
    void main(){
     mat4 m=modelMatrix;
     #ifdef USE_INSTANCING
      m=modelMatrix*instanceMatrix;
     #endif
     vec4 wp=m*vec4(position,1.);vWorld=wp.xyz;vN=normalize(mat3(m)*normal);vH=uv.y;
     gl_Position=projectionMatrix*viewMatrix*wp;
    }`,
   fragmentShader:`varying vec3 vWorld;varying vec3 vN;varying float vH;
    void main(){
     vec3 V=normalize(cameraPosition-vWorld);
     float body=pow(abs(dot(normalize(vN),V)),1.7);
     float yFade=pow(clamp(vH,0.,1.),1.45)*smoothstep(1.,0.76,vH);
     float dFade=1.-smoothstep(55.,135.,distance(cameraPosition,vWorld));
     float a=body*yFade*dFade*.16;
     gl_FragColor=vec4(vec3(1.0,.72,.38)*a,1.);
    }`});
  const mesh=new T.InstancedMesh(geo,mat,spots.length);
  spots.forEach(([x,y,z,h],i)=>{dummy.position.set(x,y,z);dummy.rotation.set(0,0,0);dummy.scale.set(1,h,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.renderOrder=2;scene.add(mesh);
  return mesh;
}
// Warm pools of lamplight on the wet pavement: one instanced decal per lamp,
// broken up painterly so no two read as the same painted ellipse. Cheap: a
// single instanced draw, no per-pixel work on the road shader itself.
function createLampPools(scene,spots){
  if(!spots.length)return null;
  // Painterly lamplight decals on the wet pavement. Uses the exact recipe the
  // codebase's contact shadows prove on these roads: MeshBasicMaterial,
  // canvas texture, polygonOffset, no depth write. The warm pool is baked
  // into the texture with noise broken edges so no two read as one ellipse.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const c=canvas.getContext('2d');
  const g=c.createRadialGradient(64,64,3,64,64,64);
  g.addColorStop(0,'rgba(255,196,110,.95)');
  g.addColorStop(.28,'rgba(255,164,72,.55)');
  g.addColorStop(.62,'rgba(230,128,44,.20)');
  g.addColorStop(1,'rgba(210,110,36,0)');
  c.fillStyle=g;c.fillRect(0,0,128,128);
  // Painterly breakup: erase drifting holes and streaks so the pool edge is
  // ragged like light on wet aggregate rather than a vector ellipse.
  c.globalCompositeOperation='destination-out';
  for(let i=0;i<46;i++){
    const a=Math.random()*Math.PI*2,r=22+Math.random()*42,x=64+Math.cos(a)*r,y=64+Math.sin(a)*r;
    const rad=2+Math.random()*8;
    const hole=c.createRadialGradient(x,y,0,x,y,rad);
    hole.addColorStop(0,'rgba(0,0,0,'+(.25+Math.random()*.5)+')');
    hole.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=hole;c.beginPath();c.arc(x,y,rad,0,Math.PI*2);c.fill();
  }
  c.globalCompositeOperation='source-over';
  const texture=new T.CanvasTexture(canvas);
  const mat=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,blending:T.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-2});
  const geo=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2);
  const mesh=new T.InstancedMesh(geo,mat,spots.length);
  const poolY=CITY_GROUND.roadY+.06;
  spots.forEach(([x,,z],i)=>{
    const seed=fract(Math.sin(i*12.9898)*43758.5453);
    const radius=9.5+seed*3.5;
    dummy.position.set(x,poolY,z);dummy.quaternion.identity();dummy.rotation.set(0,seed*Math.PI*2,0);dummy.scale.set(radius,1,radius*(0.8+seed*0.3));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.renderOrder=2;mesh.userData.lampPools=true;scene.add(mesh);
  return mesh;
}
function fract(x){return x-Math.floor(x);}
function createWater(scene){
  const n=256,pixels=new Uint8Array(n*n);for(let z=0;z<n;z++)for(let x=0;x<n;x++)pixels[z*n+x]=Math.round(clamp((baseHeight(TERRAIN.minX+x/(n-1)*2950,TERRAIN.minZ+z/(n-1)*2000)+8)/32,0,1)*255);
  const depths=new T.DataTexture(pixels,n,n,T.RedFormat);depths.minFilter=depths.magFilter=T.LinearFilter;depths.needsUpdate=true;
  const uniforms={time:{value:0}},material=new T.MeshStandardMaterial({color:0x0d2830,roughness:.22,metalness:.05,envMapIntensity:.65});
  material.onBeforeCompile=shader=>{
    shader.uniforms.uTime=uniforms.time;shader.uniforms.uCoast={value:depths};
    shader.uniforms.tRefl=planarReflUniforms.tRefl;shader.uniforms.tReflBlur=planarReflUniforms.tReflBlur;shader.uniforms.uReflMatrix=planarReflUniforms.uReflMatrix;shader.uniforms.uReflEnabled=planarReflUniforms.uReflEnabled;
    shader.vertexShader='uniform float uTime;uniform mat4 uReflMatrix;varying vec3 vWater;varying vec4 vWaterRefl;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=normalize(vec3(-cos(position.x*.022+uTime*.55)*.00924,-cos(position.y*.034-uTime*.4)*.00918,1.));');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z+=sin(position.x*.022+uTime*.55)*.42+sin(position.y*.034-uTime*.4)*.27;vec4 wWp=modelMatrix*vec4(transformed,1.);vWater=wWp.xyz;vWaterRefl=uReflMatrix*wWp;');
    shader.fragmentShader='uniform float uTime,uReflEnabled;uniform sampler2D uCoast,tRefl,tReflBlur;varying vec3 vWater;varying vec4 vWaterRefl;\n'+skyNoise+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
     vec2 coastUv=(vWater.xz-vec2(-1400.,-1000.))/vec2(2950.,2000.);
     float ground=texture2D(uCoast,coastUv).r*32.-8.;float depth=max(0.,vWater.y-ground);
     float swell=artField(vWater.xz*.014+vec2(uTime*.006,0.));
     diffuseColor.rgb*=.86+swell*.18;
     diffuseColor.rgb=mix(vec3(.020,.072,.088),diffuseColor.rgb,smoothstep(0.,7.0,depth));
     float wash=sin(depth*7.2-uTime*1.05+artNoise(vWater.xz*.14)*2.4);
     float foam=(1.-smoothstep(.15,2.0,depth))*smoothstep(.20,.92,wash);
     diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.74,.80,.82),foam*.52);
     vec3 toEye=normalize(cameraPosition-vWater);float horizon=pow(1.-abs(toEye.y),4.2);
     diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.24,.35,.38),horizon*.26);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
     vec2 wpW=vWater.xz;
     float w1=cos(wpW.x*.28+wpW.y*.14+uTime*.90)*.045;
     float w2=cos(wpW.x*-.19+wpW.y*.37-uTime*1.15)*.038;
     float w3=cos(wpW.x*.75+wpW.y*-.62+uTime*1.65)*.024;
     float rn=artNoise(wpW*.9+vec2(uTime*.35,-uTime*.25))-.5;
     vec3 wNorm=normalize(vec3(-(w1+w2+rn*.06),1.,-(w2+w3+rn*.06)));
     normal=normalize((viewMatrix*vec4(wNorm,0.)).xyz);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
     if(cameraPosition.x<=340.&&uReflEnabled>.5){
      vec2 ruv=vWaterRefl.xy/max(vWaterRefl.w,1e-4);
      float wDist=length(cameraPosition-vWater);
      vec2 jit=wNorm.xz*0.055;
      vec3 rSharp=texture2D(tRefl,clamp(ruv+jit,0.002,0.998)).rgb;
      vec3 rBlur=texture2D(tReflBlur,clamp(ruv+jit*0.5,0.002,0.998)).rgb;
      vec3 wRefl=mix(rSharp,rBlur,smoothstep(40.,220.,wDist)*.65);
      float fres=0.06+0.94*pow(1.-clamp(dot(toEye,wNorm),0.,1.),3.6);
      float rAmt=fres*(1.-smoothstep(180.,620.,wDist))*.84*(1.-foam*.65);
      outgoingLight=outgoingLight*(1.-rAmt*.55)+wRefl*rAmt;
     }
     #include <opaque_fragment>
    `);
  };
  const water=new T.Mesh(new T.PlaneGeometry(8000,8000,200,200),material);water.rotation.x=-Math.PI/2;water.position.y=.2;scene.add(water);return {water,uniforms};
}
export function createWorld(scene,data,{arrivalTreads=false}={}){
  scene.background=new T.Color(0x707878);scene.fog=new T.Fog(0x737b79,110,900);
  const sky=createSky(scene),rain=createCoastalRain(scene),water=createWater(scene),kit=new Kit(scene),lampSpots=[];
  const hemi=new T.HemisphereLight(0x88a4b4,0x27302c,.84);scene.add(hemi);const lighting={key:1.10,fill:1.0};
  const sun=new T.DirectionalLight(0xffc18a,1.5);sun.position.set(-700,850,250);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);Object.assign(sun.shadow.camera,{left:-56,right:56,top:56,bottom:-56,near:24,far:300});sun.shadow.bias=-.00025;sun.shadow.normalBias=.06;sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;scene.add(sun,sun.target);const fill=new T.DirectionalLight(0x7d9fb8,.55);fill.position.set(620,210,-480);scene.add(fill);const sunDir=new T.Vector3(-115,135,72).normalize(),sunRot=new T.Matrix4().lookAt(new T.Vector3(),sunDir.clone().negate(),new T.Vector3(0,1,0)),sunInv=sunRot.clone().invert(),sunPoint=new T.Vector3(),sunTexel=112/1536;let shadowAt=-Infinity,shadowX=NaN,shadowZ=NaN;
  const terrainMesh=buildTerrain(scene);const accessVertices=accessSurface(data.accessPaths,terrainHeight,TERRAIN),accessGeometry=surface(accessVertices),accessUV=[];for(let i=0;i<accessVertices.length;i+=3)accessUV.push(accessVertices[i]/2,accessVertices[i+2]/2);accessGeometry.setAttribute('uv',new T.Float32BufferAttribute(accessUV,2));const accessMesh=new T.Mesh(accessGeometry,new T.MeshStandardMaterial({color:0xb0a17a,map:grain,flatShading:true,roughness:.88,metalness:.02}));accessMesh.receiveShadow=true;scene.add(accessMesh);const wetCityGroup=buildRoads(scene,kit);for(const b of data.buildings){compileBuilding(kit,b,arrivalTreads);compilePieces(kit,cityForecourtPlan(b,groundHeight).pieces);}
  for(const t of data.trees)tree(kit,t.x,t.y,t.z,t.scale,t.kind,t.rotation);
  for(const r of data.rocks)kit.add('rock',r.x,r.y+r.s*.35,r.z,r.s,r.s*.7,r.s*.8,0x9da68e,r.r);
  buildBridge(scene,kit);buildLandmarks(scene,kit);compilePieces(kit,civicCraftPlan().pieces);streetDetails(scene,kit,data,lampSpots);authoredDetails(scene,kit,data,sign);placeDetails(scene,kit,data,sign);streetCraft(kit,data);const botany=coastalBotany(kit,data);
  for(const z of [222,196,172])lampSpots.push([1171.95,19.45,z,5.4]);
  lampSpots.push([HOSPITAL_GENERATOR.x,17.85,HOSPITAL_GENERATOR.z-3,3.8]);
  createLampCones(scene,lampSpots);
  const lampCones=scene.children.at(-1);
  createLampPools(scene,lampSpots);
  const lampPools=scene.children.at(-1);
  const routes=routeCraft(kit,data);
  compilePieces(kit,domesticExteriorPlan(data,terrainHeight).pieces);
  const settlement=buildSettlement(scene,kit,data,sign);
  // Broken coastline is framed by offshore rock stacks and distant silhouettes.
  const rng=random(6);for(let i=0;i<50;i++){const a=i/50*Math.PI*2,x=-490+Math.cos(a)*700,z=Math.sin(a)*600;if(x>20&&Math.abs(z)<220)continue;kit.add('rock',x,-4,z,12+rng()*25,9+rng()*18,15+rng()*20,0x87998b,rng()*6);}
  for(let i=0;i<12;i++)kit.add('rock',-1600+i*280,-25,-1600,250+rng()*180,90+rng()*70,220,0x91afa7,rng()*6);
  // Grass patches and low coastal scrub share the same seed as the terrain.
  const arrivalHouse=data.buildings.find(b=>b.id==='arrival-house');
  for(let i=0;i<4600;i++){
    const x=-1030+rng()*1100,z=-440+rng()*850,y=terrainHeight(x,z),r=roadAt(x,z);
    if(y<5||reservedPlace(x,z,.9)||settlementReserved(x,z,1.5)||accessReserved(data.accessPaths,x,z,1.3)||r.distance<r.width*.5+2||data.buildings.some(b=>Math.abs(x-b.x)<b.w*.5+3&&Math.abs(z-b.z)<b.d*.5+3))continue;
    const s=.48+rng()*.65;
    for(let j=0;j<3;j++){
      const a=j*2.4,x1=x+Math.cos(a)*.65,z1=z+Math.sin(a)*.65;
      const rotation=rng()*6;
      if(arrivalHouse&&entranceHeight(arrivalHouse,x1,z1)!==null)continue;
      kit.add('tuft',x1,terrainHeight(x1,z1)-.015,z1,s,s,s,i%3?0x78864c:0xa2a66b,rotation,null,4);
    }
    if(i%5===0&&(!arrivalHouse||entranceHeight(arrivalHouse,x,z)===null))kit.add('rock',x,y+.22,z,.6,.38,.6,0x738657);
  }
  const stats=kit.finish();stats.botany=botany;stats.routes=routes;const contactShadows=addContactShadows(scene,data);const movingRoots=new Set([sky.sky,rain.mesh,sun,sun.target,settlement.boat]);for(const root of scene.children)if(!root.isCamera&&!movingRoots.has(root))freezeLocalTransforms(root);const coastalMotion=createCoastalMotion(scene),life=createSettlementLife(scene,data);
  const birds=new T.Group();const birdMat=new T.MeshBasicMaterial({color:0x3e5754});for(let i=0;i<12;i++){const geo=surface([-1,0,0,0,.25,0,0,0,.3,0,.25,0,1,0,0,0,0,.3]);const bird=new T.Mesh(geo,birdMat);bird.userData.phase=i*.52;birds.add(bird);}scene.add(birds);
  const reflHide=[{obj:water.water},{obj:rain.mesh},{obj:lampCones},{obj:lampPools},{obj:birds},{obj:wetCityGroup,cityOnly:true},{obj:terrainMesh,cityOnly:true},{obj:accessMesh,cityOnly:true},...contactShadows.map(obj=>({obj})),...stats.detailRoots.map(obj=>({obj}))];
  const worldObj={stats,sun,hemi,lighting,fill,water:water.uniforms,sky,reflHide,shadowUpdated:false,coastalMotion,life,settlement,update(time,player,day=.68,relays=[],fov=60){const roomScale=Math.max(1,Math.min(2.4,Math.tan(Math.PI/6)/Math.tan(fov*Math.PI/360)));stats.update(player,roomScale);kit.material.userData.wind.value=time;life.update(time,player);settlement.update(time,player);water.uniforms.time.value=time;sky.uniforms.time.value=time;sky.sky.position.copy(player);rain.update(time);coastalMotion.update(time,relays);const light=.55+.45*Math.max(0,Math.sin(day*Math.PI));sun.intensity=1.42*light*lighting.key;hemi.intensity=(.78+.20*light)*lighting.fill;const sx=Math.round(player.x),sz=Math.round(player.z),sy=groundHeight(sx,sz);sunPoint.set(sx,sy,sz).applyMatrix4(sunInv);sunPoint.x=Math.round(sunPoint.x/sunTexel)*sunTexel;sunPoint.y=Math.round(sunPoint.y/sunTexel)*sunTexel;sunPoint.z=Math.round(sunPoint.z/sunTexel)*sunTexel;sunPoint.applyMatrix4(sunRot);sun.target.position.copy(sunPoint);sun.position.copy(sunPoint).addScaledVector(sunDir,220);sun.target.updateMatrixWorld();// Keep the 1536px shadow pass at 17Hz; lighting and colour still draw every frame.
    // Teleports invalidate immediately; the cached map stays world anchored
    // between updates under the fixed sun direction.
    const shadowNow=performance.now();const didShadow=shadowNow-shadowAt>=59||!Number.isFinite(shadowX)||Math.hypot(sx-shadowX,sz-shadowZ)>12;if(didShadow){sun.shadow.needsUpdate=true;shadowAt=shadowNow;shadowX=sx;shadowZ=sz;}worldObj.shadowUpdated=didShadow;for(let i=0;i<birds.children.length;i++){const b=birds.children[i],a=time*.06+i*.52;b.position.set(-490+Math.cos(a)*330,95+Math.sin(a*3)*12,30+Math.sin(a)*230);b.rotation.y=-a;b.scale.y=.6+Math.sin(time*3+i)*.4;}}};
  return worldObj;
}

function addContactShadows(scene,data){
  const shadows=[];
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d'),gradient=c.createRadialGradient(32,32,2,32,32,32);gradient.addColorStop(0,'rgba(24,34,26,.36)');gradient.addColorStop(.45,'rgba(24,34,26,.18)');gradient.addColorStop(1,'rgba(24,34,26,0)');c.fillStyle=gradient;c.fillRect(0,0,64,64);const texture=new T.CanvasTexture(canvas),material=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  const urbanTrees=data.trees.filter(t=>t.urban);
  if(urbanTrees.length){
   const geometry=new T.PlaneGeometry(2,2);geometry.rotateX(-Math.PI/2);const mesh=new T.InstancedMesh(geometry,material,urbanTrees.length);
   for(let i=0;i<urbanTrees.length;i++){const t=urbanTrees[i];dummy.position.set(t.x+.35,groundHeight(t.x,t.z)+.028,t.z);dummy.quaternion.identity();dummy.scale.set(t.scale*5,1,t.scale*4);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}mesh.computeBoundingSphere();scene.add(mesh);shadows.push(mesh);
  }
  // Building base ambient-occlusion aprons (city decks sit at groundHeight >= 14.16, above terrainHeight).
  const bc=document.createElement('canvas');bc.width=bc.height=64;const bx=bc.getContext('2d'),bg=bx.createRadialGradient(32,32,8,32,32,32);bg.addColorStop(0,'rgba(12,18,16,.52)');bg.addColorStop(.68,'rgba(12,18,16,.34)');bg.addColorStop(1,'rgba(12,18,16,0)');bx.fillStyle=bg;bx.fillRect(0,0,64,64);const bTex=new T.CanvasTexture(bc),bMat=new T.MeshBasicMaterial({map:bTex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  const cityBuildings=data.buildings.filter(b=>b.x>=355);
  if(cityBuildings.length){
   const bGeo=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),bMesh=new T.InstancedMesh(bGeo,bMat,cityBuildings.length);
   for(let i=0;i<cityBuildings.length;i++){const b=cityBuildings[i],y=Math.max(b.baseY,groundHeight(b.x,b.z));dummy.position.set(b.x,y+.024,b.z);dummy.quaternion.identity();dummy.scale.set(b.w+2.0,1,b.d+2.0);dummy.updateMatrix();bMesh.setMatrixAt(i,dummy.matrix);}bMesh.computeBoundingSphere();scene.add(bMesh);shadows.push(bMesh);
  }
  // Natural trees span terrain folds; clip their decals to the same triangles
  // as the ground. One shared mesh/material replaces their tangent instances.
  const natural=treeContactShadowGeometry(data.trees,terrainHeight,TERRAIN);
  if(natural.positions.length){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(natural.positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(natural.uvs,2));geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,material);mesh.name='Natural tree contact shadows';scene.add(mesh);shadows.push(mesh);}
  return shadows;
}
