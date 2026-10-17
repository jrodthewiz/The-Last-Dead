import * as T from '../vendor/three.module.js';
import {mergeGeometries} from '../vendor/utils/BufferGeometryUtils.js';
import {terrainHeight} from './data.js';
import {FRONTAGES,LANDING,stairTop,gardenBed} from './settlement-plan.js';

const C={wood:0x82704f,dark:0x4d5846,cream:0xc6b991,metal:0x415d57,red:0x995e48,blue:0x63847e};
function geometry(points,colours){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));if(colours)g.setAttribute('color',new T.Float32BufferAttribute(colours,3));g.computeVertexNormals();return g;}
function archGeometry(){const p=[];for(let i=0;i<10;i++){const a=i/10*Math.PI,b=(i+1)/10*Math.PI;for(const z of [-.22,.22]){const v=[Math.cos(a)*2.88,Math.sin(a)*.88,z],w=[Math.cos(b)*2.88,Math.sin(b)*.88,z],u=[Math.cos(a)*3.2,Math.sin(a)*1.16,z],t=[Math.cos(b)*3.2,Math.sin(b)*1.16,z];p.push(...v,...u,...w,...u,...t,...w);}
 const at=(a,r,h,z)=>[Math.cos(a)*r,Math.sin(a)*h,z];for(const [r,h]of [[2.88,.88],[3.2,1.16]])p.push(...at(a,r,h,-.22),...at(b,r,h,-.22),...at(a,r,h,.22),...at(a,r,h,.22),...at(b,r,h,-.22),...at(b,r,h,.22));}const g=geometry(p);return g;}

// One painted low-poly mesh per vessel, including ribs, gunwale and fittings.
function boatGeometry(cabin=false){
 const parts=[],dummy=new T.Object3D(),up=new T.Vector3(0,1,0),colour=new T.Color();
 const add=(g,c,position=[0,0,0],scale=[1,1,1],q=null)=>{dummy.position.fromArray(position);dummy.scale.fromArray(scale);dummy.quaternion.copy(q||new T.Quaternion());dummy.updateMatrix();g=g.index?g.toNonIndexed():g;g.applyMatrix4(dummy.matrix);colour.setHex(c);g.setAttribute('color',new T.Float32BufferAttribute(Array.from({length:g.attributes.position.count},()=>colour.toArray()).flat(),3));g.deleteAttribute('uv');parts.push(g);};
 const box=(x,y,z,w,h,d,c)=>add(new T.BoxGeometry(w,h,d),c,[x,y,z]);
 const rod=(a,b,r,c)=>{const av=new T.Vector3(...a),bv=new T.Vector3(...b),delta=bv.clone().sub(av);add(new T.CylinderGeometry(r,r,delta.length(),5),c,av.add(bv).multiplyScalar(.5).toArray(),[1,1,1],new T.Quaternion().setFromUnitVectors(up,delta.normalize()));};
 const stations=[[-3,.74,.6],[-2,1,.56],[-.4,1.1,.5],[1.3,.92,.55],[2.5,.5,.76],[3.1,.025,.88]],levels=[[1,0],[.85,-.58],[.4,-1.02],[0,-1.15]];
 for(let i=1;i<stations.length;i++)for(const side of [-1,1])for(let j=1;j<levels.length;j++){
  const a=stations[i-1],b=stations[i],v=(s,l)=>[side*s[1]*l[0],s[2]+l[1],s[0]],points=[...v(a,levels[j-1]),...v(b,levels[j-1]),...v(a,levels[j]),...v(a,levels[j]),...v(b,levels[j-1]),...v(b,levels[j])];add(geometry(points),j===1?(cabin?C.blue:C.cream):j===2?C.red:C.dark);
 }
 for(let i=1;i<stations.length;i++)for(const side of [-1,1]){const a=stations[i-1],b=stations[i];rod([side*a[1],a[2],a[0]],[side*b[1],b[2],b[0]],.065,C.wood);}
 box(0,.13,-2.95,1.45,.85,.1,C.wood);box(0,-.27,-.35,.85,.09,4.65,C.wood);
 for(const z of [-1.8,-.25,1.3]){box(0,.25,z,z>1?1.5:1.85,.13,.36,C.wood);for(const side of [-1,1])rod([side*.42,-.23,z],[side*.94,.45,z],.045,C.wood);}
 if(cabin){box(0,.78,-1.65,1.6,1.25,1.7,C.cream);box(0,1.5,-1.65,1.85,.16,1.95,C.dark);box(0,1.15,-.785,1.3,.5,.02,0x375a5c);for(const side of [-1,1])box(side*.81,1.16,-1.65,.025,.48,1.25,0x375a5c);rod([0,.35,.3],[0,3.8,.3],.055,C.wood);rod([-1.5,3.2,.3],[1.5,3.2,.3],.04,C.wood);rod([0,3.8,.3],[0,.8,2.7],.035,C.metal);box(.56,1.85,-1.8,.18,.65,.2,C.red);for(const side of [-1,1])for(const z of [-1,1.1]){rod([side*1.04,.22,z],[side*1.04,.72,z],.04,C.metal);box(side*1.13,.2,z,.17,.45,.25,C.cream);}}
 else {rod([-.6,.48,-2.1],[.7,.48,1.9],.04,C.wood);box(.72,.48,2.05,.2,.055,.7,C.wood);}
 const merged=mergeGeometries(parts);for(const p of parts)p.dispose();return merged;
}

function frontages(k,data,sign,scene){
 k.geometries.arcade=archGeometry();
 for(const b of data.buildings){const kind=FRONTAGES[b.id];if(!kind)continue;const y=b.baseY,z=b.z+b.d/2;
  if(b.enterable){for(const side of [-1,1]){k.box(b.x+side*1.57,y+1.4,z+.28,.18,2.8,.26,C.dark);k.box(b.x+side*1.46,y+1.45,z-.85,.075,2.45,1.7,0x3b4f46);}k.box(b.x,y+2.75,z+.28,3.3,.18,.3,C.dark);k.box(b.x,y+2.68,z-.8,2.9,.08,1.6,0x3b4f46);k.box(b.x,y+.225,z-1,2.9,.045,2.7,0x475c50);}
  if(kind==='arcade'){
   for(const dx of [-9.6,-3.2,3.2,9.6]){k.box(b.x+dx,y+1.25,z+2.5,.44,2.5,.52,C.cream);k.box(b.x+dx,y+.16,z+2.5,.66,.32,.72,C.dark);k.box(b.x+dx,y+2.48,z+2.5,.65,.22,.7,C.cream);k.rod([b.x+dx,y+3.25,z+.15],[b.x+dx,y+3.25,z+2.5],.07,C.dark);}
   for(const dx of [-6.4,0,6.4])k.add('arcade',b.x+dx,y+2.5,z+2.5,1,1,1,C.cream);
   k.box(b.x,y+3.68,z+1.4,20.1,.22,3.3,C.dark);
   for(const dx of [-6.4,6.4]){k.box(b.x+dx,y+1.55,z+.29,4.7,2.25,.2,0x304b47);for(const sx of [-2.4,2.4])k.box(b.x+dx+sx,y+1.5,z+.44,.16,2.7,.22,C.wood);k.box(b.x+dx,y+.44,z+.48,4.9,.25,.36,C.wood);for(let row=0;row<2;row++){k.box(b.x+dx,y+.84+row*.8,z+.47,4.4,.12,.22,C.wood);for(let j=0;j<8;j++)k.box(b.x+dx-1.85+j*.52,y+1.1+row*.8,z+.48,.32,.38+(j%3)*.08,.15,[C.red,0x9c9b70,C.blue][j%3]);}}
   sign(scene,'ALDER BOOKS',b.x,y+4.05,z+2.76,7.4);
  }else if(kind==='residence'){
   k.box(b.x,y+1.38,z+.24,2,2.76,.22,C.red);for(const dx of [-1.22,1.22])k.box(b.x+dx,y+1.6,z+.4,.28,3.2,.32,C.cream);k.box(b.x,y+3.18,z+.5,2.8,.25,.65,C.cream);k.box(b.x+.62,y+1.3,z+.39,.08,.24,.07,0xc8ac68);
   for(const dx of [-7,7]){k.box(b.x+dx,y+1.65,z+.23,2.6,2,.2,0x385c59);k.box(b.x+dx,y+.55,z+.4,3.05,.17,.45,C.cream);for(const side of [-1,1]){k.box(b.x+dx+side*1.65,y+1.65,z+.3,.6,2.2,.18,C.blue);for(let h=0;h<5;h++)k.box(b.x+dx+side*1.65,y+.85+h*.4,z+.405,.53,.06,.04,C.dark);}}
   // A single shallow balcony connects upper windows into a domestic silhouette.
   k.box(b.x,y+4.12,z+.8,6,.2,1.55,C.cream);for(const dx of [-2.7,2.7])k.rod([b.x+dx,y+3.3,z+.12],[b.x+dx,y+4,z+1.5],.075,C.dark);
   for(let dx=-2.85;dx<=2.9;dx+=.57)k.box(b.x+dx,y+4.65,z+1.5,.06,1,.06,C.metal);k.box(b.x,y+5.16,z+1.5,6,.08,.09,C.metal);
   sign(scene,'17',b.x,y+2.9,z+.57,1.1,0,true);
  }else{
   for(const dx of [-5.6,5.6]){k.box(b.x+dx,y+1.38,z+.26,6,2.76,.18,C.blue);for(let h=0;h<7;h++)k.box(b.x+dx,y+.24+h*.38,z+.38,5.9,.055,.04,C.dark);for(const side of [-1,1])k.box(b.x+dx+side*3,y+1.5,z+.4,.18,3,.28,C.wood);}
   k.box(b.x,y+3.3,z+1.1,b.w+.4,.25,2.6,C.red);for(const dx of [-b.w*.4,b.w*.4])k.rod([b.x+dx,y+2.4,z+.1],[b.x+dx,y+3.18,z+2.3],.11,C.dark);
   k.rod([b.x-5,y+3.52,z+.2],[b.x+5,y+3.52,z+.2],.08,C.wood);k.add('cylinder',b.x+3,y+3.1,z+1.8,.17,.22,.17,C.metal);
   sign(scene,'NET & TIMBER',b.x,y+4.05,z+.3,7.8);
  }
 }
}

export function buildSettlement(scene,k,data,sign){
 frontages(k,data,sign,scene);const clock={value:0},cloths=[],ropes=[],material=new T.MeshLambertMaterial({vertexColors:true,flatShading:true,side:T.DoubleSide});
 const repair=new T.Mesh(boatGeometry(),material),ry=Math.max(...[[-538,175],[-536,181],[-538,181],[-536,175]].map(([x,z])=>terrainHeight(x,z)))+1;
 repair.position.set(-537,ry,178);repair.castShadow=repair.receiveShadow=true;repair.name='Dinghy on repair trestles';scene.add(repair);
 for(const z of [176,180]){k.box(-537,ry-.42,z,2.8,.18,.34,C.wood);for(const x of [-538,-536])k.rod([x,terrainHeight(x,z),z],[x,ry-.42,z],.11,C.dark);}
 const by=terrainHeight(-541,175);k.box(-541,by+.95,175,2.7,.18,1.1,C.wood);for(const x of [-542.1,-539.9])for(const z of [174.65,175.35])k.rod([x,terrainHeight(x,z),z],[x,by+.95,z],.075,C.dark);k.box(-541,by+1.08,175.3,1.4,.06,.15,C.dark);k.box(-540.2,by+1.15,175,.35,.28,.35,C.red);
 const pileY=Math.max(terrainHeight(-541.4,182),terrainHeight(-537.4,182))+.08;
 for(const x of [-540.4,-538.4]){const ground=terrainHeight(x,182);k.box(x,(ground+pileY)/2,182,.22,pileY-ground,.6,C.dark);}
 for(let i=0;i<5;i++)k.box(-540+i*.25,pileY+.06+i*.12,182,2.8,.12,.22,C.wood,.12);
 // Domestic work gathers around two planted beds, a drying frame and fuel stack.
 for(const z of [180,185]){const {top,bottom}=gardenBed(z,terrainHeight);k.box(-502,(top+bottom)/2,z,5.2,top-bottom,2.6,0x71634b);for(const side of [-1,1]){k.box(-502+side*2.65,(top+bottom)/2,z,.14,top-bottom+.16,2.8,C.wood);k.box(-502,(top+bottom)/2,z+side*1.4,5.4,top-bottom+.16,.14,C.wood);for(const x of [-504.5,-499.5])k.box(x,(top+bottom)/2,z+side*1.48,.13,top-bottom+.22,.15,C.dark);}for(let j=0;j<5;j++)for(const dz of [-.65,.65])k.add('rock',-504+j,top+.2,z+dz,.34,.28,.3,j%3?0x738654:0x947b55,j,null,4);}
 const laundryY=Math.max(terrainHeight(-506,174),terrainHeight(-499,174))+3.1;
 for(const x of [-506,-499])k.rod([x,terrainHeight(x,174),174],[x,laundryY+.1,174],.075,C.wood);
 for(let i=0;i<8;i++){const x=-506+i*.875;k.rod([x,laundryY-Math.sin(i/8*Math.PI)*.16,174],[x+.875,laundryY-Math.sin((i+1)/8*Math.PI)*.16,174],.014,C.dark);}
 const clothMat=new T.MeshLambertMaterial({color:0xc5bea0,side:T.DoubleSide,flatShading:true});clothMat.onBeforeCompile=s=>{s.uniforms.uWind=clock;s.vertexShader='uniform float uWind;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfloat loose=clamp(-position.y/1.3,0.,1.);transformed.z+=loose*(sin(position.x*3.+uWind*1.5)*.12+.1);');};
 for(const [x,w,h]of [[-504.8,1.6,1.3],[-502.5,.9,1],[-500.8,1.1,.7]]){const g=new T.PlaneGeometry(w,h,4,4);g.translate(0,-h/2,0);const m=new T.Mesh(g,clothMat);m.position.set(x,laundryY-.13,174);m.castShadow=true;scene.add(m);cloths.push(m);for(const dx of [-w*.37,w*.37])k.box(x+dx,laundryY-.12,174,.07,.13,.09,C.wood);}
 for(let j=0;j<3;j++)for(let i=0;i<4-j;i++)k.rod([-498.1+i*.55+j*.27,terrainHeight(-497,185)+.24+j*.39,184.5],[-498.1+i*.55+j*.27,terrainHeight(-497,185)+.24+j*.39,185.6],.23,C.wood);
 // Tidal stairs descend with the same per-tread support used by movement.
 const p=LANDING;for(let x=p.start;x<p.end;x++){const top=stairTop(x,terrainHeight),bottom=Math.min(terrainHeight(x,p.z),terrainHeight(x+1,p.z))-.3;k.box(x+.5,(top+bottom)/2,p.z,1,top-bottom,p.width,C.cream,0,7);}
 for(let x=p.start;x<p.end;x+=4)for(const side of [-1,1]){const z=p.z+side*(p.width/2+.13),top=stairTop(x,terrainHeight);k.rod([x,top,z],[x,top+1.05,z],.065,C.metal);k.rod([x,top+1,z],[Math.min(x+4,p.end),stairTop(Math.min(x+4,p.end)-.01,terrainHeight)+1,z],.045,C.metal);}
 for(let x=1266;x<1282;x+=.4)k.box(x+.2,p.deckY-.1,220,.37,.2,14,C.wood);
 for(const x of [1267,1274,1281])for(const z of [213,227]){k.rod([x,-5,z],[x,p.deckY+1,z],.16,C.dark);k.rod([x,p.deckY+1,z],[Math.min(x+7,1281),p.deckY+1,z],.04,C.dark);}
 for(const z of [216,225]){k.add('cylinder',1281,p.deckY+.28,z,.19,.56,.19,C.metal);k.box(1281,p.deckY+.55,z,.7,.1,.12,C.metal);}
 for(const x of [1274,1278])k.rod([x,p.deckY,226],[x,p.deckY+2.6,226],.09,C.wood);k.rod([1274,p.deckY+2.6,226],[1278,p.deckY+2.6,226],.075,C.wood);
 // A slack diamond net hangs from its frame; larger floats carry the read at 240p.
 for(let i=0;i<5;i++){const x=1274+i;for(const side of [-1,1]){const end=Math.max(1274,Math.min(1278,x+side*1.3));k.rod([x,p.deckY+2.5,226],[end,p.deckY+.55,226+.15*Math.sin(i)],.032,0x596e59);}k.add('sphere',x,p.deckY+2.46,226,.12,.17,.12,C.red);}
 for(const x of [1269,1270.3]){k.add('cylinder',x,p.deckY+.36,225,.55,.72,.55,C.wood);for(const h of [.12,.6])k.add('cylinder',x,p.deckY+h,225,.57,.07,.57,C.dark);}
 const boat=new T.Mesh(boatGeometry(true),material);boat.name='Moored fishing launch';boat.position.set(p.boatX,.55,p.boatZ);boat.scale.setScalar(1.6);boat.castShadow=boat.receiveShadow=true;scene.add(boat);
 for(const [z,localZ]of [[216,-2.65],[225,2.4]]){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(9),3));const line=new T.Line(geometry,new T.LineBasicMaterial({color:0x8b8565}));line.frustumCulled=false;scene.add(line);ropes.push({line,anchor:new T.Vector3(1281,p.deckY+.52,z),end:new T.Vector3(-1.03,.57,localZ)});}
 const end=new T.Vector3(),stats={frontages:3,yards:2,cloths:cloths.length,boats:2,landingSteps:56};
 return {boat,repair,clock,cloths,ropes,stats,update(time,camera){clock.value=time;boat.position.y=.55+Math.sin(time*.9)*.075;boat.rotation.z=Math.sin(time*.7)*.018;boat.rotation.x=Math.sin(time*.63)*.012;boat.visible=boat.position.distanceToSquared(camera)<700**2;repair.visible=repair.position.distanceToSquared(camera)<320**2;for(const m of cloths)m.visible=m.position.distanceToSquared(camera)<230**2;boat.updateMatrixWorld(true);for(const r of ropes){r.line.visible=boat.visible;end.copy(r.end).applyMatrix4(boat.matrixWorld);const a=r.line.geometry.attributes.position;a.setXYZ(0,r.anchor.x,r.anchor.y,r.anchor.z);a.setXYZ(1,(r.anchor.x+end.x)/2,(r.anchor.y+end.y)/2-.3,(r.anchor.z+end.z)/2);a.setXYZ(2,end.x,end.y,end.z);a.needsUpdate=true;}}};
}
