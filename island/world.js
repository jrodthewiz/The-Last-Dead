import {freezeLocalTransforms} from './render-lifecycle.js';
import {TRAILS,reservedPlace} from './places.js';
import {placeDetails} from './place-art.js';
import {buildInterior} from './interior-plan.js';
import {houseShell} from './house-shell.js';
import {consoleMaterial} from './retro-materials.js';
import {paintArchitecture,paintTerrain,skyNoise} from './surface-art.js';
import {coastalBotany,streetCraft} from './visual-details.js';
import {createCoastalMotion} from './coastal-motion.js';
import {createSettlementLife} from './settlement-life.js';
import {buildSettlement} from './settlement-art.js';
import {FRONTAGES,settlementReserved} from './settlement-plan.js';
import {accessSurface,accessReserved} from './access-plan.js';
import * as T from '../vendor/three.module.js';
import {TERRAIN,ROADS,LANDMARKS,random,terrainHeight,baseHeight,bridgeHeight,roadAt,clamp,groundHeight,stationPosition,entranceHeight} from './data.js';

import {authoredDetails} from './authored-details.js';

const up=new T.Vector3(0,1,0),dummy=new T.Object3D();
const COLORS={stone:0xb3baa5,wood:0x796849,darkwood:0x4b5141,roof:0x5b7976,road:0x6b7369,cream:0xded7b6,metal:0x405a55,glass:0x4e7779,leaf:0x607c49};
// Module registry, grouped by geometry/material and spatial tile. Per-instance
// colours retain the art palette; tile bounds retain useful frustum culling.
function grainTexture(){const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),rng=random(817),pixels=ctx.createImageData(64,64);for(let i=0;i<pixels.data.length;i+=4){const n=222+Math.floor(rng()*30);pixels.data[i]=n;pixels.data[i+1]=n;pixels.data[i+2]=n;pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);const texture=new T.CanvasTexture(c);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.NearestFilter;texture.colorSpace=T.SRGBColorSpace;return texture;}
const grain=grainTexture();
class Kit {
  constructor(scene){this.scene=scene;this.parts=new Map();this.surface=0;this.geometries={box:new T.BoxGeometry(1,1,1),cone:new T.ConeGeometry(1,1,7),cylinder:new T.CylinderGeometry(1,1,1,7),rock:new T.IcosahedronGeometry(1,0),sphere:new T.IcosahedronGeometry(1,1)};this.material=paintArchitecture(consoleMaterial(new T.MeshLambertMaterial({color:0xffffff,flatShading:true,map:grain})));this.count=0;}
  add(shape,x,y,z,sx,sy,sz,color,ry=0,q=null,role=this.surface){const detail=Math.max(sx,sy,sz)<2.1,key=`${shape}:${Math.floor(x/180)},${Math.floor(z/180)}:${detail}`;if(!this.parts.has(key))this.parts.set(key,{shape,items:[],detail});this.parts.get(key).items.push({x,y,z,sx,sy,sz,color,ry,q,role});this.count++;}
  box(x,y,z,w,h,d,c,r=0,role=this.surface){this.add('box',x,y,z,w,h,d,c,r,null,role);}
  rod(a,b,r,c){const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av),m=av.add(bv).multiplyScalar(.5);this.add('cylinder',m.x,m.y,m.z,r,d.length(),r,c,0,new T.Quaternion().setFromUnitVectors(up,d.normalize()));}
  finish(){let calls=0;const detailMeshes=[];for(const {shape,items,detail} of this.parts.values()){const geometry=this.geometries[shape].clone();geometry.setAttribute('artRole',new T.InstancedBufferAttribute(new Float32Array(items.map(p=>p.role)),1));const mesh=new T.InstancedMesh(geometry,this.material,items.length);for(let i=0;i<items.length;i++){const p=items[i];dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.sx,p.sy,p.sz);dummy.rotation.set(0,p.ry,0);if(p.q)dummy.quaternion.copy(p.q);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new T.Color(p.color));}mesh.computeBoundingSphere();mesh.receiveShadow=true;mesh.castShadow=true;this.scene.add(mesh);if(detail)detailMeshes.push(mesh);calls++;}this.parts.clear();for(const g of Object.values(this.geometries))g.dispose();return {modules:this.count,batches:calls,update(camera){for(const mesh of detailMeshes){const b=mesh.boundingSphere;mesh.visible=camera.distanceToSquared(b.center)<(270+b.radius)**2;}}};}
}
function surface(vertices,colors){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));if(colors)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;}
function buildTerrain(scene){
  const {minX,maxX,minZ,maxZ,step:s}=TERRAIN,positions=[],colors=[],slopes=[],slopeCache=new Map(),color=new T.Color(),rng=random(711);
  // Interpolate a shared slope field across grid edges; material transitions
  // should follow a bank rather than expose each triangle's separate normal.
  const slopeAt=(x,z)=>{const key=x+','+z;if(!slopeCache.has(key)){const dx=(baseHeight(x+s,z)-baseHeight(x-s,z))/(2*s),dz=(baseHeight(x,z+s)-baseHeight(x,z-s))/(2*s);slopeCache.set(key,1-1/Math.sqrt(1+dx*dx+dz*dz));}return slopeCache.get(key);};
  for(let z=minZ;z<maxZ;z+=s)for(let x=minX;x<maxX;x+=s){
    const a=[x,baseHeight(x,z),z],b=[x+s,baseHeight(x+s,z),z],c=[x,baseHeight(x,z+s),z+s],d=[x+s,baseHeight(x+s,z+s),z+s];
    for(const tri of [[a,c,b],[b,c,d]]){
      const y=(tri[0][1]+tri[1][1]+tri[2][1])/3;
      color.setHex(y<3.8?0xc4c199:y>62?0x8b9668:x>330?0x819875:0x718b4d);
      color.multiplyScalar(.93+rng()*.13);
      for(const p of tri){positions.push(...p);colors.push(color.r,color.g,color.b);slopes.push(slopeAt(p[0],p[2]));}
    }
  }
  const geometry=surface(positions,colors),uv=[];for(let i=0;i<positions.length;i+=3)uv.push(positions[i]/12,positions[i+2]/12);geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geometry.setAttribute('artSlope',new T.Float32BufferAttribute(slopes,1));
  const material=new T.MeshLambertMaterial({vertexColors:true,flatShading:true,map:grain});
  // Paint the roads on their actual terrain triangles. Separate draped strips
  // fight the ground at grid diagonals and create ragged shoulders on hills.
  const f=n=>Number(n).toFixed(3),segments=[];for(const road of [...TRAILS,...ROADS])for(let i=1;i<road.points.length;i++){const a=road.points[i-1],b=road.points[i],color=new T.Color(road.width<6?0xb5ae86:COLORS.road);segments.push(`{vec2 a=vec2(${f(a[0])},${f(a[1])});vec2 b=vec2(${f(b[0])},${f(b[1])});vec2 ab=b-a;float t=clamp(dot(vGround.xz-a,ab)/dot(ab,ab),0.,1.);float d=length(vGround.xz-a-ab*t);if(d<rd){rd=d;rw=${f(road.width*.5)};rc=vec3(${color.toArray().map(f).join(',')});}}`);}
  material.onBeforeCompile=shader=>paintTerrain(shader,segments);
  const mesh=new T.Mesh(geometry,material);mesh.receiveShadow=true;scene.add(mesh);return mesh;
}
function ribbon(scene,points,width,color,offset=.12,drape=true){
  const p=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],l=Math.hypot(b[0]-a[0],b[2]-a[2]),nx=-(b[2]-a[2])/l*width*.5,nz=(b[0]-a[0])/l*width*.5;for(let j=0;j<6;j++){const left=-1+j/3,right=-1+(j+1)/3;const point=(v,t)=>{const x=v[0]+nx*t,z=v[2]+nz*t;return [x,(drape?terrainHeight(x,z):v[1])+offset,z];};const al=point(a,left),ar=point(a,right),bl=point(b,left),br=point(b,right);p.push(...al,...ar,...bl,...bl,...ar,...br);}}
  const mesh=new T.Mesh(surface(p),new T.MeshLambertMaterial({color,side:T.DoubleSide}));mesh.receiveShadow=true;scene.add(mesh);
}
function buildRoads(scene,kit){
  for(const road of ROADS){const points=[];for(let i=1;i<road.points.length;i++){const a=road.points[i-1],b=road.points[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2);for(let j=0;j<n;j++){const t=j/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;points.push([x,terrainHeight(x,z),z]);}}const a=road.points.at(-1);points.push([a[0],terrainHeight(a[0],a[1]),a[1]]);
    if(road.width>=6)for(let i=0;i<points.length-1;i+=7){const a=points[i],b=points[i+1],angle=Math.atan2(b[0]-a[0],b[2]-a[2]);kit.box(a[0],a[1]+.24,a[2],.13,.025,2,0xd2c49a,angle);}
  }
  kit.box(790,14.02,0,858,.06,1000,0x70786f,0,9);
  for(let col=0;col<11;col++)for(let row=0;row<13;row++){
    const x=392+col*76,z=-456+row*76;
    if(row<12&&col<10)kit.box(x+38,14.08,z+38,61,.16,61,0xb1b4a1,0,8);
    if(row<12)for(let k=0;k<6;k++)kit.box(x,14.08,z+k*12+6,.2,.025,5,0xd4cba8);
    if(col<10)for(let k=0;k<6;k++)kit.box(x+k*12+6,14.08,z,5,.025,.2,0xd4cba8);
    // Short, legible crosswalks. Empty road ownership is retained at junctions.
    if(col<10&&row<12)for(let k=0;k<5;k++)kit.box(x+10,14.10,z-4+k*2,3,.025,.8,0xc8c9b0);
  }
}
function gable(kit,b,y){const angle=Math.atan2(3.4,b.w*.5+1),length=Math.hypot(b.w*.5+1,3.4);for(const sign of [-1,1]){const q=new T.Quaternion().setFromEuler(new T.Euler(0,0,-sign*angle));kit.add('box',b.x+sign*(b.w*.25+.5),y+1.65,b.z,length,.5,b.d+2,b.accent,0,q,2);}kit.box(b.x,y+3.4,b.z,.5,.4,b.d+2,COLORS.darkwood);
  const positions=[];for(const sign of [-1,1])positions.push(b.x-b.w/2,y,b.z+sign*b.d/2,b.x+b.w/2,y,b.z+sign*b.d/2,b.x,y+3.4,b.z+sign*b.d/2);const caps=new T.Mesh(surface(positions),new T.MeshLambertMaterial({color:b.color,side:T.DoubleSide}));kit.scene.add(caps);
  kit.box(b.x+b.w*.28,y+2,b.z-2,.9,3,1.2,0x8d8168);
}
function compileBuilding(kit,b){
  const y=b.baseY,rng=random(b.seed);kit.surface=1;
  kit.box(b.x,(y+b.foundationBottom)/2,b.z,b.w+.5,y-b.foundationBottom,b.d+.5,0x858d78,0,7);
  if(b.enterable)for(let i=0;i<b.entry.steps;i++){const z=b.entry.z+(i+.5)*b.entry.length/b.entry.steps,top=entranceHeight(b,b.x,z),bottom=terrainHeight(b.x,z)-.15;kit.box(b.x,(top+bottom)/2,z,3,Math.max(.12,top-bottom),b.entry.length/b.entry.steps,0xb3a789);}
  for(const side of [-1,1])for(let k=0;k<Math.ceil(b.d/2);k++){const z=b.z-b.d/2+(k+.5)*b.d/Math.ceil(b.d/2),bottom=terrainHeight(b.x+side*b.w/2,z);if(y-bottom>.35)kit.box(b.x+side*(b.w/2+.28),(y+bottom)/2,z,.08,y-bottom,b.d/Math.ceil(b.d/2)-.1,0x727d6c);}
  for(const tier of b.tiers){
    const yy=y+tier.y;
    if(b.enterable&&tier.y===0){
      if(tier.h>3.4)kit.box(b.x,yy+3.4+(tier.h-3.4)/2,b.z,tier.w,tier.h-3.4,tier.d,b.color);
      kit.box(b.x,yy+.10,b.z,b.w,.2,b.d,0xb6aa85);
      for(const w of houseShell(b).walls)kit.box(b.x+w.x,yy+w.y+w.h/2,b.z+w.z,w.w,w.h,w.d,b.color);
      kit.box(b.x,yy+3.32,b.z,b.w-.4,.16,b.d-.4,0xb8b496);
      kit.surface=0;buildInterior(kit,b);kit.surface=1;
    }else kit.box(b.x,yy+tier.h/2,b.z,tier.w,tier.h,tier.d,b.color);
    // Four exposed surfaces with dimensional floor and bay rhythms.
    for(const side of [0,1,2,3]){
      const along=side<2?tier.w:tier.d,count=Math.floor(along/3.4),span=along/count;
      const front=side===0,back=side===1;
      for(let floor=0;floor<tier.floors;floor++)for(let bay=0;bay<count;bay++){
        if(front&&floor===0&&tier.y===0&&FRONTAGES[b.id])continue;
        if(b.enterable&&front&&floor===0&&Math.abs((bay+.5)*span-along/2)<2.8)continue;
        const u=(bay+.5)*span-along/2,wy=yy+floor*3.4+1.9;
        const offset=b.enterable&&floor===0?.26:.055;let wx=b.x,wz=b.z;if(side<2){wx+=u;wz+=(front?1:-1)*(tier.d/2+offset);}else{wx+=(side===2?1:-1)*(tier.w/2+offset);wz+=u;}
        const c=rng()>.86?0xd6bf84:COLORS.glass;
        if(!(b.enterable&&floor===0&&tier.y===0))kit.box(wx,wy,wz,side<2?1.25:.09,1.65,side<2?.09:1.25,c,0,c===0xd6bf84?6:5);
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
    kit.box(b.x,yy+tier.h,b.z,tier.w+.65,.35,tier.d+.65,COLORS.cream);
    if(!b.enterable){
      for(const sign of [-1,1]){kit.box(b.x+sign*(tier.w/2-.35),yy+tier.h/2,b.z+tier.d/2+.12,.5,tier.h,.28,COLORS.cream);}
    }
  }
  if(b.roof==='gable')gable(kit,b,y+b.height);else if(b.roof==='sawtooth'){
    for(let j=0;j<3;j++){const q=new T.Quaternion().setFromEuler(new T.Euler(-.20,0,0));kit.add('box',b.x,y+b.height+1,b.z-b.d/2+(j+.5)*b.d/3,b.w+1,.3,b.d/3+.4,0x607b73,0,q);kit.box(b.x,y+b.height+.8,b.z-b.d/2+j*b.d/3,b.w,1.4,.16,0x657f79);}
  }else{
    kit.box(b.x,y+b.height+.22,b.z,b.tiers.at(-1).w-.6,.12,b.tiers.at(-1).d-.6,0x67776c,0,2);
    kit.box(b.x+3,y+b.height+1,b.z-2,4,1.5,3,0x8b958b);
    if(b.roof==='crown'){const top=b.tiers.at(-1);kit.box(b.x,y+b.height+3,b.z,top.w*.5,5,top.d*.5,b.color);kit.rod([b.x,y+b.height+5,b.z],[b.x,y+b.height+13,b.z],.16,COLORS.metal);}
  }
  if(FRONTAGES[b.id]){kit.surface=0;return;}
  if(b.enterable){kit.box(b.x,y+2.85,b.z+b.d/2+.85,4.3,.25,2.2,b.accent);for(const sign of [-1,1])kit.box(b.x+sign*2,y+1.3,b.z+b.d/2+1.5,.16,2.6,.16,COLORS.wood);}
  else{const color=[0x8b5945,0x536d65,0xb9a267][b.seed%3];kit.box(b.x,y+3,b.z+b.d/2+.8,b.w-2,.3,1.8,color);for(let k=0;k<3;k++)kit.box(b.x-6+k*6,y+1.5,b.z+b.d/2+.1,3.6,2.3,.13,0x3c5353,0,5);}kit.surface=0;
}
export function sign(scene,text,x,y,z,width=6,rotation=0,dark=false){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const c=canvas.getContext('2d');c.fillStyle=dark?'#d6d0ae':'#3d5550';c.fillRect(0,0,512,96);c.strokeStyle=dark?'#4b6255':'#c8c6a5';c.lineWidth=3;c.strokeRect(7,7,498,82);c.fillStyle=dark?'#3d5550':'#e2d8af';c.font='600 36px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText(text,256,48,475);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.minFilter=T.LinearFilter;
  const m=new T.Mesh(new T.PlaneGeometry(width,width*96/512),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));m.position.set(x,y,z);m.rotation.y=rotation;scene.add(m);return m;
}
function tree(kit,x,y,z,s=1,kind='pine',rotation=0){
  kit.surface=3;kit.add('cylinder',x,y+4*s,z,.27*s,8*s,.27*s,0x695c42);
  if(kind==='pine'){
    for(let i=0;i<5;i++){const a=rotation+i*2.4,r=(3.1-i*.48)*s;kit.add('cone',x+Math.cos(a)*.4*s,y+(4.7+i*1.6)*s,z+Math.sin(a)*.4*s,r,(3.6-i*.15)*s,r*.82,[0x3f6045,0x517247,0x62814d,0x6b8c53,0x829655][i],a,null,4);}
    for(let i=0;i<3;i++){const a=rotation+i*2.1;kit.rod([x,y+3*s,z],[x+Math.cos(a)*2*s,y+4*s,z+Math.sin(a)*2*s],.10*s,0x695c42);}
  }else{
    const colors=rotation>3?[0x9c9e56,0xb6aa64,0x899752]:[0x68834f,0x899d59,0x9aa761];
    for(let i=0;i<3;i++){const a=rotation+i*2.1,dx=Math.cos(a)*2*s,dz=Math.sin(a)*2*s;kit.rod([x,y+3*s,z],[x+dx,y+6*s,z+dz],.16*s,0x726347);kit.add('sphere',x+dx,y+(6.6+i*.6)*s,z+dz,3.1*s,2.8*s,3*s,colors[i],a,null,4);}
  }
  if(kind==='orchard')for(let i=0;i<5;i++){const a=rotation+i*2.4;kit.add('rock',x+Math.sin(a)*1.8*s,y+(5.3+i%2)*s,z+Math.cos(a)*1.8*s,.16*s,.2*s,.16*s,0xb59a57,a,null,4);}
  kit.surface=0;
}
function buildBridge(scene,kit){
  const p=[];for(let x=70;x<=370;x+=5)p.push([x,bridgeHeight(x),0]);ribbon(scene,p,23,0xaeb6a3,.07,false);ribbon(scene,p,16,0x72796d,.10,false);
  for(let x=75;x<370;x+=10){const y=bridgeHeight(x);kit.box(x,y+.12,0,5,.03,.18,0xded0a0);for(const z of [-9.7,9.7]){kit.box(x,y+.5,z,.2,1,.2,COLORS.metal);kit.box(x,y+1,z,10,.16,.16,COLORS.metal);}}
  for(const x of [120,320])for(const z of [-10.5,10.5]){kit.box(x,34,z,3,84,3,0xb5bca5);kit.box(x,69,0,3,2,23,0xc2c6ae);kit.box(x,43,0,3,2,23,0xc2c6ae);kit.box(x,2,z,8,10,7,0x929e8d);}
  for(const z of [-10.5,10.5]){let prev=null;for(let x=70;x<=370;x+=5){const y=x<120?16+(x-70)*1.12:x>320?72-(x-320)*1.12:29+43*((x-220)/100)**2;if(prev)kit.rod(prev,[x,y,z],.16,0x495f59);if(x%10===0)kit.rod([x,bridgeHeight(x)+1,z],[x,y,z],.055,0x5e7469);prev=[x,y,z];}}
  sign(scene,'SAINT ORIN',65,22,0,10,Math.PI/2);
}
function buildLandmarks(scene,kit){
  const y=terrainHeight(-820,-260);
  kit.add('cylinder',-820,y+13,-260,3.8,26,3.8,0xe1d8b7);kit.add('cylinder',-820,y+18,-260,3.88,4,3.88,0x9b6f53);kit.add('cylinder',-820,y+27,-260,5,.5,5,0x516d65);kit.add('cylinder',-820,y+29,-260,3.4,3.5,3.4,0xd1bd78);kit.add('cone',-820,y+32,-260,4.8,3,4.8,0x506d66);
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;kit.box(-820+Math.cos(a)*3.4,y+29,-260+Math.sin(a)*3.4,.2,3.5,.2,COLORS.metal);}
  const hill=terrainHeight(-420,-280);for(const dx of [-3,3])for(const dz of [-3,3])kit.rod([-420+dx,hill,-280+dz],[-420+dx*.2,hill+31,-280+dz*.2],.2,COLORS.metal);
  for(let i=0;i<6;i++){const h=hill+i*5,w=3-i*.4;kit.rod([-420-w,h,-280-w],[-420+w-.4,h+5,-280-w+.4],.08,COLORS.metal);kit.box(-420,h,-280,2*w,.15,2*w,COLORS.metal);}kit.rod([-420,hill+30,-280],[-420,hill+39,-280],.16,0x86604a);
  // Civic garden: formal paths and a visible clock tower rather than another block.
  kit.box(734,14.3,0,114,.35,130,0x7c925c);kit.box(734,14.52,0,8,.08,132,0xc4bb93);kit.box(734,14.52,0,116,.08,8,0xc4bb93);
  kit.add('cylinder',734,15,0,9,1.4,9,0xc2bca1);kit.add('cylinder',734,15.7,0,7,.2,7,0x719c99);kit.box(734,27,0,7,24,7,0xc9c1a2);kit.box(734,39.5,0,9,2,9,0xe0d7b2);kit.add('cone',734,45,0,7,10,7,0x53756c,Math.PI/4);
  for(const x of [690,778])for(let z=-54;z<=54;z+=27)tree(kit,x,14.4,z,.9,'broad');
  for(const side of [-1,1])sign(scene,'SAINT ORIN · 1894',734,18,side*3.55,6,side>0?0:Math.PI,true);
  const face=document.createElement('canvas');face.width=face.height=128;const fc=face.getContext('2d');fc.fillStyle='#d6cfaa';fc.beginPath();fc.arc(64,64,61,0,Math.PI*2);fc.fill();fc.strokeStyle='#445d50';fc.lineWidth=5;fc.stroke();for(let i=0;i<12;i++){const a=i/12*Math.PI*2;fc.beginPath();fc.moveTo(64+Math.sin(a)*49,64-Math.cos(a)*49);fc.lineTo(64+Math.sin(a)*55,64-Math.cos(a)*55);fc.stroke();}fc.lineWidth=4;fc.beginPath();fc.moveTo(64,64);fc.lineTo(37,45);fc.moveTo(64,64);fc.lineTo(103,76);fc.stroke();
  const clockTexture=new T.CanvasTexture(face);clockTexture.magFilter=T.NearestFilter;clockTexture.colorSpace=T.SRGBColorSpace;
  for(let i=0;i<4;i++){const a=i*Math.PI/2,m=new T.Mesh(new T.PlaneGeometry(4.5,4.5),new T.MeshLambertMaterial({map:clockTexture,transparent:true}));m.position.set(734+Math.sin(a)*3.56,35,Math.cos(a)*3.56);m.rotation.y=a;scene.add(m);}
  sign(scene,'NORTHPOINT HOSPITAL',970,26,-322.9,24,0,true);
  // East ferry: pier, mooring posts, hull, cabins, and gangway.
  kit.box(1211,13,300,86,2,24,0x9e9e82);for(let x=1174;x<1250;x+=8)kit.box(x,14.08,300,.15,.04,24,0x6b7465);
  kit.box(1250,8,300,25,8,58,0x3d6667);kit.box(1250,12.2,300,26,.7,58,0xb5baa3);kit.box(1250,15,298,18,5,31,0xd6d0b0);kit.box(1250,18.1,298,20,1,34,0x647f77);kit.box(1250,21,289,13,5,11,0xd7d0af);kit.box(1250,21,283.4,11,2,.1,0x446b70);kit.box(1250,24.4,296,3,5,4,0x9d634a);
  sign(scene,'LAST FERRY',1180,19,292,9);
  for(const p of LANDMARKS){if(p.type==='relay'){const pos=stationPosition(p),gy=groundHeight(pos.x,pos.z);kit.box(pos.x,gy+1.05,pos.z,1.2,2.1,.8,0x5b736c);kit.box(pos.x,gy+1.5,pos.z+.43,.65,.5,.07,0xc69b61);kit.rod([pos.x,gy+2,pos.z],[pos.x,gy+5,pos.z],.045,COLORS.metal);}
    if(p.type==='camp'){const gy=terrainHeight(p.x,p.z);kit.add('cylinder',p.x,gy+.1,p.z,1.4,.2,1.4,0x686a57);for(let i=0;i<5;i++)kit.box(p.x+Math.cos(i*1.25)*.5,gy+.3,p.z+Math.sin(i*1.25)*.5,.3,.3,1.3,0x5a4a35,i);}
  }
}
function streetDetails(scene,kit,data){
  const rng=random(843);
  for(let col=0;col<10;col++)for(let row=0;row<12;row++){
    const x=400+col*76,z=-448+row*76;if(Math.abs(x-740)<65&&Math.abs(z)<90)continue;
    kit.add('cylinder',x,17.4,z,.12,6.6,.12,COLORS.metal);kit.box(x+1,20.65,z,2.4,.17,.2,COLORS.metal);kit.box(x+2,20.5,z,.8,.18,.5,0xead5a2);
    if((col+row)%2===0)tree(kit,x+4,14.25,z+7,.62,'broad');
    kit.box(x+9,14.8,z+2,1.1,1.5,1.1,0x5f776b);kit.box(x+13,14.7,z+2,3,.14,.9,0x876e4a);kit.box(x+13,15.1,z+2.4,3,.7,.12,0x876e4a);
    if(rng()>.6){kit.box(x+3,14.6,z+17,1.6,1,1.3,0xad9b73);kit.box(x+4.5,14.4,z+18,1,.7,1,0x9c8a65);}
  }
  const names=['ALDER GENERAL STORE','THE MARINER','POST OFFICE','FIELD SUPPLIES'];let i=0;
  for(const b of data.buildings.filter(b=>b.district==='village').slice(0,8)){sign(scene,names[i++%names.length],b.x,b.baseY+3.1,b.z+b.d/2+1.03,b.w*.73);}
  const shops=['ORIN PROVISIONS','THE RECORD ROOM','NORTH STAR PHARMACY','MORROW & SONS','ALDER BOOKSHOP','COASTAL HARDWARE','LAST LIGHT CAFÉ','SAINT ORIN POST'];i=0;
  for(const b of data.buildings.filter(b=>b.district==='oldtown'&&b.enterable)){const name=shops[i++%shops.length];if(!FRONTAGES[b.id])sign(scene,name,b.x,18,b.z+b.d/2+.22,Math.min(b.w-2,15));}
  for(const [x,z,label] of [[-690,264,'ALDER  →'],[-470,55,'←  WESTLIGHT'],[-353,-215,'SIGNAL HILL'],[-240,54,'SAINT ORIN  →']]){const y=terrainHeight(x,z);kit.box(x+6,y+1.5,z,.15,3,.15,COLORS.wood);sign(scene,label,x+6,y+2.6,z,4);}
  // Inland ruins provide a destination and a different silhouette.
  for(let i=0;i<9;i++){const x=-790+i*5,z=12;kit.box(x,terrainHeight(x,z)+1.7,z,3.4,3.4,1.2,0xa1a28a);}for(let i=0;i<5;i++){const x=-790,z=12+i*5;kit.box(x,terrainHeight(x,z)+1.3,z,1.2,2.6,3.7,0xa1a28a);}
  for(let i=0;i<30;i++){const x=-810+(i%6)*17,z=55+Math.floor(i/6)*17;if(roadAt(x,z).distance>9)tree(kit,x,terrainHeight(x,z),z,.65,'broad');}
}
function createSky(scene){
  const uniforms={time:{value:0},sun:{value:new T.Vector3(-110,160,65).normalize()},top:{value:new T.Color(0x698e9f)},bottom:{value:new T.Color(0xd5c4a6)},cloudLight:{value:new T.Color(0xe5ddc4)},cloudShade:{value:new T.Color(0x8a9b9e)}};
  const material=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms,vertexShader:'varying vec3 vDir; void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
   varying vec3 vDir;uniform float time;uniform vec3 sun,top,bottom,cloudLight,cloudShade;
   ${skyNoise}
   void main(){vec3 d=normalize(vDir);float h=pow(max(d.y,0.),.65),s=dot(d,sun);
    vec3 c=mix(bottom,top,h);c+=vec3(.16,.09,.035)*pow(max(s,0.),18.);
    vec2 p=d.xz/max(.16,d.y+.2)*1.8+vec2(time*.0014,0.);
    float field=artField(p),wisps=artNoise(p*3.2+vec2(1.3,-2.));
    float coverage=smoothstep(.49,.67,field+wisps*.07)*smoothstep(.025,.18,d.y);
    float lit=clamp(.48+(artField(p+sun.xz*.18)-field)*4.+d.y*.22,0.,1.);
    vec3 cloud=mix(cloudShade,cloudLight,lit);cloud+=vec3(.1,.065,.025)*pow(max(s,0.),8.);
    c=mix(c,cloud,coverage*.94);
    c=mix(c,vec3(1.,.86,.57),smoothstep(.9993,.99965,s)*(1.-coverage*.8));
    gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
  const sky=new T.Mesh(new T.SphereGeometry(4200,24,12),material);sky.frustumCulled=false;scene.add(sky);return {sky,uniforms};
}
function createWater(scene){
  const n=256,pixels=new Uint8Array(n*n);for(let z=0;z<n;z++)for(let x=0;x<n;x++)pixels[z*n+x]=Math.round(clamp((baseHeight(TERRAIN.minX+x/(n-1)*2950,TERRAIN.minZ+z/(n-1)*2000)+8)/32,0,1)*255);
  const depths=new T.DataTexture(pixels,n,n,T.RedFormat);depths.minFilter=depths.magFilter=T.LinearFilter;depths.needsUpdate=true;
  const uniforms={time:{value:0}},material=new T.MeshPhongMaterial({color:0x457c84,specular:0xb5c5ab,shininess:48});
  material.onBeforeCompile=shader=>{
    shader.uniforms.uTime=uniforms.time;shader.uniforms.uCoast={value:depths};
    shader.vertexShader='uniform float uTime;varying vec3 vWater;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=normalize(vec3(-cos(position.x*.022+uTime*.55)*.00924,-cos(position.y*.034-uTime*.4)*.00918,1.));');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z+=sin(position.x*.022+uTime*.55)*.42+sin(position.y*.034-uTime*.4)*.27;vWater=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader='uniform float uTime;uniform sampler2D uCoast;varying vec3 vWater;\n'+skyNoise+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
     vec2 coastUv=(vWater.xz-vec2(-1400.,-1000.))/vec2(2950.,2000.);
     float ground=texture2D(uCoast,coastUv).r*32.-8.;float depth=max(0.,vWater.y-ground);
     float swell=artField(vWater.xz*.012+vec2(uTime*.006,0.));
     diffuseColor.rgb*=.86+swell*.25;
     diffuseColor.rgb=mix(vec3(.16,.31,.25),diffuseColor.rgb,smoothstep(0.,8.,depth));
     float wash=sin(depth*6.5-uTime*.9+artNoise(vWater.xz*.1)*2.);
     float foam=(1.-smoothstep(.25,2.,depth))*smoothstep(.15,.9,wash);
     diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.55,.63,.48),foam*.62);
     float ripples=sin(vWater.x*.105+vWater.z*.31+uTime*.45+swell*6.);
     float gleam=smoothstep(.94,1.,ripples)*smoothstep(.5,.72,swell);
     diffuseColor.rgb+=vec3(.045,.06,.052)*gleam;
     vec3 toEye=normalize(cameraPosition-vWater);float horizon=pow(1.-abs(toEye.y),5.);
     diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.29,.42,.43),horizon*.25);
    `);
  };
  const water=new T.Mesh(new T.PlaneGeometry(8000,8000,200,200),material);water.rotation.x=-Math.PI/2;water.position.y=.2;scene.add(water);return uniforms;
}
export function createWorld(scene,data){
  scene.background=new T.Color(0xc1c5b3);scene.fog=new T.Fog(0xb7c0b2,340,2300);
  const sky=createSky(scene),water=createWater(scene),kit=new Kit(scene);
  const hemi=new T.HemisphereLight(0xd8e7ed,0x758d65,1.15);scene.add(hemi);
  const sun=new T.DirectionalLight(0xffe6bc,1.8);sun.position.set(-700,850,250);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-90,right:90,top:90,bottom:-90,near:1,far:400});sun.shadow.bias=-.00025;sun.shadow.normalBias=.08;scene.add(sun,sun.target);
  buildTerrain(scene);const accessVertices=accessSurface(data.accessPaths,terrainHeight,TERRAIN),accessGeometry=surface(accessVertices),accessUV=[];for(let i=0;i<accessVertices.length;i+=3)accessUV.push(accessVertices[i]/2,accessVertices[i+2]/2);accessGeometry.setAttribute('uv',new T.Float32BufferAttribute(accessUV,2));const accessMesh=new T.Mesh(accessGeometry,new T.MeshLambertMaterial({color:0xb0a17a,map:grain,flatShading:true}));accessMesh.receiveShadow=true;scene.add(accessMesh);buildRoads(scene,kit);for(const b of data.buildings)compileBuilding(kit,b);
  for(const t of data.trees)tree(kit,t.x,t.y,t.z,t.scale,t.kind,t.rotation);
  for(const r of data.rocks)kit.add('rock',r.x,r.y+r.s*.35,r.z,r.s,r.s*.7,r.s*.8,0x9da68e,r.r);
  buildBridge(scene,kit);buildLandmarks(scene,kit);streetDetails(scene,kit,data);authoredDetails(scene,kit,data,sign);placeDetails(scene,kit,data,sign);streetCraft(kit,data);coastalBotany(kit,data);
  const settlement=buildSettlement(scene,kit,data,sign);
  // Broken coastline is framed by offshore rock stacks and distant silhouettes.
  const rng=random(6);for(let i=0;i<50;i++){const a=i/50*Math.PI*2,x=-490+Math.cos(a)*700,z=Math.sin(a)*600;if(x>20&&Math.abs(z)<220)continue;kit.add('rock',x,-4,z,12+rng()*25,9+rng()*18,15+rng()*20,0x87998b,rng()*6);}
  for(let i=0;i<12;i++)kit.add('rock',-1600+i*280,-25,-1600,250+rng()*180,90+rng()*70,220,0x91afa7,rng()*6);
  // Grass patches and low coastal scrub share the same seed as the terrain.
  for(let i=0;i<9000;i++){const x=-1030+rng()*1100,z=-440+rng()*850,y=terrainHeight(x,z),r=roadAt(x,z);if(y<5||reservedPlace(x,z)||settlementReserved(x,z,1)||accessReserved(data.accessPaths,x,z,.7)||r.distance<r.width*.5+1||data.buildings.some(b=>Math.abs(x-b.x)<b.w*.5+2&&Math.abs(z-b.z)<b.d*.5+2))continue;const s=.2+rng()*.5;kit.add('cone',x,y+s*.5,z,s*.30,s,s*.30,i%3?0x6b8348:0xa2a66b,rng()*6);if(i%5===0)kit.add('rock',x,y+.3,z,.6,.5,.6,0x738657);}
  const stats=kit.finish();addContactShadows(scene,data);const movingRoots=new Set([sky.sky,sun,sun.target,settlement.boat]);for(const root of scene.children)if(!root.isCamera&&!movingRoots.has(root))freezeLocalTransforms(root);const coastalMotion=createCoastalMotion(scene),life=createSettlementLife(scene,data);
  const birds=new T.Group();const birdMat=new T.MeshBasicMaterial({color:0x3e5754});for(let i=0;i<12;i++){const geo=surface([-1,0,0,0,.25,0,0,0,.3,0,.25,0,1,0,0,0,0,.3]);const bird=new T.Mesh(geo,birdMat);bird.userData.phase=i*.52;birds.add(bird);}scene.add(birds);
  return {stats,sun,hemi,water,sky,coastalMotion,life,settlement,update(time,player,day=.64,relays=[]){stats.update(player);kit.material.userData.wind.value=time;life.update(time,player);settlement.update(time,player);water.time.value=time;sky.uniforms.time.value=time;sky.sky.position.copy(player);coastalMotion.update(time,relays);const light=.55+.45*Math.max(0,Math.sin(day*Math.PI));sun.intensity=2.1*light;hemi.intensity=.65+.25*light;const sx=Math.round(player.x),sz=Math.round(player.z),sy=groundHeight(sx,sz);sun.target.position.set(sx,sy,sz);sun.position.set(sx-110,sy+160,sz+65);for(let i=0;i<birds.children.length;i++){const b=birds.children[i],a=time*.06+i*.52;b.position.set(-490+Math.cos(a)*330,95+Math.sin(a*3)*12,30+Math.sin(a)*230);b.rotation.y=-a;b.scale.y=.6+Math.sin(time*3+i)*.4;}}};
}

function addContactShadows(scene,data){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d'),gradient=c.createRadialGradient(32,32,2,32,32,32);gradient.addColorStop(0,'rgba(24,43,27,.45)');gradient.addColorStop(.45,'rgba(24,43,27,.24)');gradient.addColorStop(1,'rgba(24,43,27,0)');c.fillStyle=gradient;c.fillRect(0,0,64,64);const texture=new T.CanvasTexture(canvas),material=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  const entries=[...data.trees.map(t=>({x:t.x,z:t.z,sx:t.scale*5,sz:t.scale*4})),...data.buildings.map(b=>({x:b.x,z:b.z,sx:b.w*.8,sz:b.d*.8}))];const geometry=new T.PlaneGeometry(2,2);geometry.rotateX(-Math.PI/2);const mesh=new T.InstancedMesh(geometry,material,entries.length),normal=new T.Vector3();for(let i=0;i<entries.length;i++){const p=entries[i],y=terrainHeight(p.x,p.z);normal.set(terrainHeight(p.x-1,p.z)-terrainHeight(p.x+1,p.z),2,terrainHeight(p.x,p.z-1)-terrainHeight(p.x,p.z+1)).normalize();dummy.position.set(p.x+.35,y+.11,p.z);dummy.quaternion.setFromUnitVectors(up,normal);dummy.scale.set(p.sx,1,p.sz);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}mesh.computeBoundingSphere();scene.add(mesh);
}
