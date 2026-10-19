import * as T from '../vendor/three.module.js';
import {SALVAGE_CONTACTS} from './salvage-motion.js';

// These are tools recovered from Blackwater, built in the bat's metre-space.
// Both hands retain the authored bat socket frames. Contact anchors identify
// the blade edge, hammer face and pipe coupling rather than a generic tip.
const geometries=new Map(),materials={};
const PALETTE={steel:0x74857f,edge:0xa6afa0,iron:0x424f4c,wood:0x9b805d,cloth:0x777e68,brass:0xa08f67,rust:0x795543,black:0x303d39};
for(const [name,color]of Object.entries(PALETTE)){
 const material=new T.MeshLambertMaterial({color,flatShading:true,emissive:0});
 material.name=`Blackwater salvage ${name}`;material.userData.sharedAsset=true;
 materials[name]=material;
}
// animateMeleeWeapon updates these channels after an actual hit. They remain
// black: world blood/spark feedback owns contact, never a luminous tool rim.
materials.glow=materials.black;materials.danger=materials.rust;
materials.black.side=T.BackSide;
function geometry(key,build){if(!geometries.has(key)){const g=build();g.userData.sharedAsset=true;geometries.set(key,g);}return geometries.get(key);}
const BOX=geometry('box',()=>new T.BoxGeometry(1,1,1));
const CYLINDER=geometry('cylinder',()=>new T.CylinderGeometry(1,1,1,10));
function mesh(parent,name,g,material,position=[0,0,0],scale=[1,1,1],rotation=[0,0,0]){
 const m=new T.Mesh(g,material);m.name=name;m.position.set(...position);m.scale.set(...scale);m.rotation.set(...rotation);m.castShadow=m.receiveShadow=false;m.userData.explodeWithParent=true;parent.add(m);return m;
}
function box(parent,name,material,p,s,r){return mesh(parent,name,BOX,material,p,s,r);}
function cylinder(parent,name,material,p,radius,length){return mesh(parent,name,CYLINDER,material,p,[radius,length,radius],[Math.PI/2,0,0]);}
function anchor(root,name,p){const a=new T.Object3D();a.name=name;a.position.set(...p);a.userData.weaponBatchIgnore=true;a.userData.viewmodelAnchor=true;root.add(a);root.userData[name]=a;return a;}
function protectedPivot(root,name){const p=new T.Group();p.name=name;p.userData.weaponMechanism=true;p.userData.weaponBatchIgnore=true;root.add(p);return p;}

function handle(root,id){
 cylinder(root,`${id} continuous fitted handle`,id==='pipe'?materials.iron:materials.wood,[0,-.055,.175],.037,.47);
 // Broad overlapping wraps follow the same .04m envelope as the bat. Keeping
 // their full cylinders avoids floating strips and survives console sampling.
 for(let i=0;i<7;i++)cylinder(root,`${id} grip binding ${i}`,materials.cloth,[0,-.055,.015+i*.058],.041,.047);
 cylinder(root,`${id} heel ferrule`,materials.iron,[0,-.055,.411],.046,.034);
}

function bladeGeometry(edge){
 // Sections carry spine, fuller ridge and cutting edge explicitly. A diamond
 // section keeps the blade from reading as a paper plane from the idle hold.
 const sections=[[-.065,.070,-.048,.010],[-.18,.074,.015,.012],[-.48,.066,.015,.011],[-.73,.057,.015,.008],[-.85,.033,.015,.005],[-.94,.001,.015,.001]];
 const rings=sections.map(([z,w,y,t])=>[[-w*.55,y-t,z],[w*.24,y-t*1.35,z],[w*.55,y,z],[w*.24,y+t*1.35,z],[-w*.55,y+t,z]]);
 const p=[],uv=[];
 const tri=(a,b,c)=>{for(const v of[a,b,c]){p.push(...v);uv.push(v[0]*8,-v[2]*2);}};
 for(let s=0;s<rings.length-1;s++)for(let i=0;i<5;i++){
  const isEdge=i===1||i===2;if(isEdge!==edge)continue;
  const j=(i+1)%5,a=rings[s][i],b=rings[s][j],c=rings[s+1][i],d=rings[s+1][j];tri(a,c,b);tri(b,c,d);
 }
 if(!edge)for(const [s,reverse]of[[0,false],[rings.length-1,true]]){
  const r=rings[s];for(let i=1;i<r.length-1;i++)reverse?tri(r[0],r[i+1],r[i]):tri(r[0],r[i],r[i+1]);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}
function sword(root){
 mesh(root,'forged boarding blade spine',geometry('sword-spine',()=>bladeGeometry(false)),materials.steel);
 mesh(root,'honed single cutting edge',geometry('sword-edge',()=>bladeGeometry(true)),materials.edge);
 // A simple pressed guard, with an upward lip at each end. The long repair
 // wrapping is deliberate: this recovered boarding blade accepts both hands.
 box(root,'boarding blade guard',materials.iron,[0,-.055,-.058],[.255,.032,.065]);
 box(root,'guard left lip',materials.brass,[-.121,-.045,-.077],[.025,.052,.070],[0,-.20,0]);
 box(root,'guard right lip',materials.brass,[.121,-.045,-.077],[.025,.052,.070],[0,.20,0]);
 cylinder(root,'blade tang collar',materials.brass,[0,-.052,-.027],.046,.035);
 cylinder(root,'boarding pommel',materials.brass,[0,-.055,.433],.050,.025);
 // Two wide forge scars, kept on the spine side rather than floating over the
 // cutting edge. No noise textures or modern polished-metal reflection.
 box(root,'blade forge scar',materials.iron,[-.020,.030,-.40],[.012,.002,.090],[0,-.10,0]);
 box(root,'blade maker stamp',materials.iron,[-.017,.031,-.22],[.017,.002,.024]);
}

function hammerHead(){
 const x=.218,y=.091,c=.027,shape=new T.Shape();
 shape.moveTo(-x+c,-y);for(const p of[[x-c,-y],[x,-y+c],[x,y-c],[x-c,y],[-x+c,y],[-x,y-c],[-x,-y+c]])shape.lineTo(...p);shape.closePath();
 // The octagonal eye is real topology. The hickory haft passes through it,
 // rather than terminating at the face of an unexplained solid metal block.
 const eye=new T.Path();for(let i=0;i<8;i++){const a=-i*Math.PI/4,p=[Math.cos(a)*.047,Math.sin(a)*.047];i?eye.lineTo(...p):eye.moveTo(...p);}eye.closePath();shape.holes.push(eye);
 const g=new T.ExtrudeGeometry(shape,{depth:.16,steps:1,bevelEnabled:true,bevelSegments:1,bevelSize:.008,bevelThickness:.008,curveSegments:1});g.translate(0,.015,-.94);return g;
}
function hammer(root){
 // A two-handed repair hammer with a broad, short head and a visibly seated
 // shaft. The pale hickory reads separately from the dark, scarred tool steel.
 cylinder(root,'repair hammer continuous haft',materials.wood,[0,-.020,-.405],.038,.93);
 mesh(root,'repair hammer forged head with eye',geometry('hammer-head',hammerHead),materials.iron);
 cylinder(root,'hammer shaft socket collar',materials.steel,[0,.015,-.755],.052,.060);
 cylinder(root,'hammer eye wedge',materials.wood,[0,.015,-.923],.043,.049);
 box(root,'hammer split wedge',materials.iron,[0,.016,-.949],[.014,.075,.008],[0,0,.13]);
 for(const side of[-1,1]){
  box(root,`hammer polished striking face ${side}`,materials.steel,[side*.221,.015,-.86],[.012,.130,.119]);
  box(root,`hammer face dent ${side}`,materials.rust,[side*.228,.034,-.85],[.002,.019,.047],[.20,0,0]);
 }
 box(root,'hammer surviving red identification paint',materials.rust,[0,-.011,-.54],[.071,.046,.12],[0,0,.12]);
}

function bentPipeGeometry(){
 const curve=new T.CatmullRomCurve3([[0,-.055,.408],[0,-.055,-.04],[-.035,-.008,-.31],[-.050,.015,-.58],[0,.015,-.94]].map(p=>new T.Vector3(...p))),steps=18,sides=10,frames=curve.computeFrenetFrames(steps,false);
 const rings=[],positions=[],uv=[];
 for(let i=0;i<=steps;i++){
  const c=curve.getPointAt(i/steps),r=[];for(const radius of[.043,.031]){
   const ring=[];for(let j=0;j<sides;j++)ring.push(c.clone().addScaledVector(frames.normals[i],Math.cos(j/sides*Math.PI*2)*radius).addScaledVector(frames.binormals[i],Math.sin(j/sides*Math.PI*2)*radius));r.push(ring);
  }rings.push(r);
 }
 const tri=(a,b,c)=>{for(const v of[a,b,c]){positions.push(...v);uv.push(v.x*4,-v.z);}};
 for(let i=0;i<steps;i++)for(let j=0;j<sides;j++)for(let face=0;face<2;face++){
  const k=(j+1)%sides,a=rings[i][face][j],b=rings[i][face][k],c=rings[i+1][face][j],d=rings[i+1][face][k];
  if(face){tri(a,c,b);tri(b,c,d);}else{tri(a,b,c);tri(b,d,c);}
 }
 for(const end of[0,steps])for(let j=0;j<sides;j++){
  const k=(j+1)%sides,a=rings[end][0][j],b=rings[end][0][k],c=rings[end][1][j],d=rings[end][1][k];
  if(end){tri(a,c,b);tri(b,c,d);}else{tri(a,b,c);tri(b,d,c);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}
function pipe(root){
 mesh(root,'bent hollow utility pipe',geometry('bent-pipe',bentPipeGeometry),materials.steel);
 const coupling=geometry('pipe-open-coupling',()=>{const g=new T.CylinderGeometry(.064,.064,.12,10,1,true);g.rotateX(Math.PI/2);return g;});
 mesh(root,'utility pipe threaded coupling',coupling,materials.iron,[0,.015,-.87]);
 const rim=geometry('pipe-coupling-rim',()=>new T.RingGeometry(.031,.064,10));
 mesh(root,'utility pipe open end rim',rim,materials.edge,[0,.015,-.932],[1,1,1],[0,Math.PI,0]);
 mesh(root,'utility pipe coupling shoulder',rim,materials.iron,[0,.015,-.808]);
 const thread=geometry('pipe-thread',()=>new T.TorusGeometry(.064,.0035,4,10));
 for(const z of[-.827,-.858,-.889])mesh(root,`pipe broad coupling thread ${z}`,thread,materials.steel,[0,.015,z]);
 // The inside remains genuinely open. A short dark inner wall provides depth
 // at the lip; an opaque end disc would turn the pipe into a capped staff.
 const bore=geometry('pipe-bore',()=>{const g=new T.CylinderGeometry(.0305,.0305,.14,10,1,true);g.rotateX(Math.PI/2);return g;});
 mesh(root,'pipe recessed bore wall',bore,materials.black,[0,.015,-.87],[1,1,1],[0,Math.PI,0]);
 for(const [i,p]of[[0,[-.014,.055,-.59]],[1,[.022,.035,-.72]],[2,[-.043,.017,-.36]]])box(root,`pipe oxidised scar ${i}`,materials.rust,p,[.025,.008,.09],[0,.05,i*.4]);
}

export function createSalvageMelee(id){
 if(!['sword','hammer','pipe'].includes(id))throw new RangeError(`Unknown salvage melee weapon: ${id}`);
 const root=new T.Group();root.name=`Blackwater salvaged ${id}`;handle(root,id);
 ({sword,hammer,pipe})[id](root);
 const sockets={grip:anchor(root,'grip',[0,-.055,.31]),supportGrip:anchor(root,'supportGrip',[0,-.055,.09]),impactTip:anchor(root,'impactTip',SALVAGE_CONTACTS[id].point)};
 const swingPivot=protectedPivot(root,`${id} swing pivot`),impactPulse=protectedPivot(swingPivot,`${id} contact pulse`);impactPulse.visible=false;
 const diagnostics={asset:`blackwater-salvage-${id}-v1`,variant:id,triangles:0,meshes:0,materials:0,textures:0,budget:{targetTriangles:2500,staticBatchSafe:true}};
 const usedMaterials=new Set();root.traverse(n=>{if(n.isMesh){diagnostics.meshes++;diagnostics.triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;usedMaterials.add(n.material);}});diagnostics.materials=usedMaterials.size;
 root.userData.weaponDynamic=false;root.userData.resourcesReady=Promise.resolve();root.userData.diagnostics=diagnostics;
 root.userData.salvageMelee={id,contactPoint:[...SALVAGE_CONTACTS[id].point],contactNormal:[...SALVAGE_CONTACTS[id].normal],sourceRig:'bat-skin',motion:'authored-working-surface',finish:'muted-forged-salvage',diagnostics};
 root.userData.melee={variant:id,parts:{},materials,sockets,mechanisms:{swingPivot},impactPulse,lastSequence:0,swingValue:0,contactValue:0,restCaptured:false,restPosition:new T.Vector3(),restRotation:new T.Euler(),timeline:{windup:.24,strike:.48,contact:.4,recover:1}};
 return root;
}
