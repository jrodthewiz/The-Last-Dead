import * as THREE from './vendor/three.module.js';
import {createCoastalInstances} from './coastal-instancing.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';
import {townWoodPieceParameters} from './coastal-town-wood.js';

// One rooted blade cluster and one sagging bag are shared by every address.
function grassGeometry(){
 const positions=[];
 for(let i=0;i<4;i++){
  const a=i*Math.PI*.61,c=Math.cos(a),s=Math.sin(a),x=(i%2-.5)*.28,z=(Math.floor(i/2)-.5)*.28;
  const tri=[x-c*.11,0,z-s*.11,x+c*.11,0,z+s*.11,x+c*.12,1-i*.09,z+s*.12];positions.push(...tri,...tri.slice(6),...tri.slice(3,6),...tri.slice(0,3));
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();g.computeBoundingSphere();return g;
}
function assembledBox(parts){const pieces=parts.map(([size,position])=>new THREE.BoxGeometry(...size).translate(...position)),g=mergeGeometries(pieces);for(const p of pieces)p.dispose();return g;}
// Normalized shipping kit: four posts carry the open rim; uneven boards
// leave real gaps and the four floor planks leave an inspectable cavity.
function shippingCrateGeometry(){
 const parts=[];
 for(const x of[-.455,.455])for(const z of[-.455,.455])parts.push([[.09,1,.09],[x,0,z]]);
 for(const [height,y]of[[.23,-.285],[.16,.035],[.13,.435]]){
  for(const z of[-.455,.455])parts.push([[.82,height,.07],[0,y,z]]);
  for(const x of[-.455,.455])parts.push([[.07,height,.82],[x,y,0]]);
 }
 for(const z of[-.3075,-.1025,.1025,.3075])parts.push([[.82,.09,.18],[0,-.455,z]]);
 const g=assembledBox(parts);g.userData={kit:'open-slatted-shipping-crate',posts:4,sideBoards:12,floorPlanks:4,openTop:true};return g;
}
function cableCoilGeometry(){
 const g=new THREE.TorusGeometry(.42,.08,6,16);g.rotateX(Math.PI/2);g.computeBoundingBox();
 const size=g.boundingBox.getSize(new THREE.Vector3());g.scale(1/size.x,1/size.y,1/size.z);
 g.userData={kit:'horizontal-spare-cable-coil',radialSegments:6,tubularSegments:16};return g;
}
const serviceGlyphs={C:['01110','10001','10000','10000','10000','10001','01110'],A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],L:['10000','10000','10000','10000','10000','10000','11111'],E:['11111','10000','10000','11110','10000','10000','11111'],R:['11110','10001','10001','11110','10100','10010','10001'],P:['11110','10001','10001','11110','10000','10000','10000'],I:['11111','00100','00100','00100','00100','00100','11111']};
function serviceStencilGeometry(){
 const positions=[],lines=['CABLE','REPAIR'],columns=35,rows=17;
 for(const [line,text]of lines.entries())for(const [letter,ch]of[...text].entries())for(let row=0;row<7;row++)for(let col=0;col<5;col++){
  if(serviceGlyphs[ch][row][col]!=='1')continue;
  const offset=(columns-(text.length*6-1))/2,x=(offset+letter*6+col)/columns-.5,z=(line*10+row)/rows-.5,
   right=x+.86/columns,back=z+.86/rows;
  positions.push(x,0,z,x,0,back,right,0,z,right,0,z,x,0,back,right,0,back);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();g.userData={kit:'service-stencil',text:'CABLE / REPAIR',columns,rows};return g;
}
export function buildCoastalCityLife(world){
 const data=world.course.coastal?.cityLife,root=new THREE.Group();root.name='Address-bound city life';root.userData.noBatch=true;
 const townWood=world.townDetails?.root.children.find(m=>m.name.startsWith('TownDetails:wood:'))?.material;
 const materials={foliage:world.materials.foliage||world.materials.coastGrass,wood:world.materials.wood||townWood,
  dark:world.materials.dark,paper:world.materials.paper||world.materials.coastWhite,rust:world.materials.rust,fabric:world.materials.fabric||world.materials.dark};
 for(const part of data?.parts||[])if(!materials[part.slot])throw new Error(`Missing city life borrowed material ${part.slot}`);
 const owned=[grassGeometry(),new THREE.IcosahedronGeometry(.5,1),
  assembledBox([[[1,.09,1],[0,-.455,0]],[[1,1,.08],[0,0,-.46]],[[1,1,.08],[0,0,.46]],[[.08,1,.84],[-.46,0,0]],[[.08,1,.84],[.46,0,0]]]),
  assembledBox([[[1,.21,.25],[0,.25,0]],[[.72,.15,.23],[-.12,.04,.02]],[[.08,.85,.25],[-.36,-.075,0]],[[.08,.85,.25],[.36,-.075,0]],[[.18,.12,1],[-.36,-.44,0]],[[.18,.12,1],[.36,-.44,0]]]),
  shippingCrateGeometry(),cableCoilGeometry(),serviceStencilGeometry()];
 const bag=owned[1],p=bag.attributes.position;
 for(let i=0;i<p.count;i++){const y=p.getY(i);p.setXYZ(i,p.getX(i)*(y>.20?.48:1.05),y,p.getZ(i)*(y>.20?.48:.96));}
 bag.computeVertexNormals();bag.computeBoundingSphere();
 const geometry={grass:owned[0],bag,planter:owned[2],barrier:owned[3],crate:owned[4],coil:owned[5],stencil:owned[6],box:world.unitBox},bins=new Map(),dummy=new THREE.Object3D();
 for(const part of data?.parts||[]){const key=`${part.shape}:${part.slot}:${Math.floor(part.x/64)}:${Math.floor(part.z/64)}`;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(part);}
 for(const [key,parts]of bins){
  const first=parts[0],mesh=createCoastalInstances(geometry[first.shape],materials[first.slot],parts.length);mesh.name=key;mesh.matrixAutoUpdate=false;
  if(first.slot==='wood'&&materials.wood===townWood){const values=new Float32Array(mesh.instanceMatrix.count*4);parts.forEach((p,i)=>values.set(townWoodPieceParameters({size:[p.width,p.height,p.depth],position:[p.x,p.y,p.z],communityId:p.community,role:p.role}),i*4));mesh.geometry.setAttribute('townWoodPiece',new THREE.InstancedBufferAttribute(values,4));}
  for(const [i,p]of parts.entries()){dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.set(p.width,p.height,p.depth);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.castShadow=first.shape!=='grass';mesh.receiveShadow=true;root.add(mesh);
 }
 return {root,diagnostics:{parts:data?.parts.length||0,bins:bins.size,ownedGeometries:owned.length,newTemplateTriangles:owned.slice(4).reduce((n,g)=>n+(g.index?.count||g.attributes.position.count)/3,0),newMaterials:0,newMaps:0,stationary:true},dispose(){for(const mesh of root.children)mesh.dispose();for(const g of owned)g.dispose();root.removeFromParent();}};
}
