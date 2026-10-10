import * as THREE from './vendor/three.module.js';
import {buildCustomsServiceGallery} from './coastal-customs-gallery.js';

// A service stair headhouse identifies the same portal used by gameplay.
// Surface geometry stays west of the approach; the original dungeon is loaded
// through the door, with its own enclosed geometry and collision authority.
export function buildCoastalBasementEntrance(world) {
 const p=world.course.basementPortal;if(!p)return;
 const x=p.x*4,z=p.y*4;
 const box=(dx,y,dz,w,h,d,mat,name)=>world.box(x-dx,y,z+dz,w,h,d,mat,name);
 box(2,.10,0,4.4,.20,3.2,'concrete','BasementStairFoundation');
 for(const side of [-1,1])box(2,1.35,side*1.4,4.4,2.7,.25,'coastStone','BasementStairSideWall');
 box(4.1,1.35,0,.25,2.7,3,'coastStone','BasementStairBackWall');
 // Ridge runs west to east. Rotated sheets meet at a real raised ridge;
 // their eaves overhang the masonry instead of stacking flat roof boxes.
 const pitch=.27,halfSpan=1.78,rise=halfSpan*Math.tan(pitch),ridgeY=2.84+rise;
 for(const side of [-1,1]){
  const panel=box(2,ridgeY-rise/2,side*halfSpan/2,4.78,.10,halfSpan/Math.cos(pitch),'dark','BasementStairPitchedMetalRoof');
  panel.rotation.x=side*pitch;
  box(2,2.83,side*1.79,4.86,.13,.12,'rust','BasementStairEaveFlashing');
  box(2,2.71,side*1.68,4.65,.16,.12,'dark','BasementStairGutter');
  // Standing seams run with the drainage fall, giving the metal sheet depth.
  for(const dx of [.05,.83,1.61,2.39,3.17,3.95]){
   const seam=box(dx,ridgeY-rise/2+.058,side*halfSpan/2,.035,.025,halfSpan/Math.cos(pitch),'rust','BasementStairRoofStandingSeam');
   seam.rotation.x=side*pitch;
  }
  const fascia=box(-.37,ridgeY-rise/2-.05,side*halfSpan/2,.13,.16,halfSpan/Math.cos(pitch),'rust','BasementStairRakingFascia');
  fascia.rotation.x=side*pitch;
 }
 box(2,ridgeY+.055,0,4.9,.10,.22,'rust','BasementStairRidgeFlashing');
 for(const dx of [-.25,4.25]){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([x-dx,2.7,z-1.4,x-dx,2.7,z+1.4,x-dx,ridgeY-.05,z],3));
  geometry.setIndex(dx<0?[0,2,1]:[0,1,2]);geometry.computeVertexNormals();
  const gable=new THREE.Mesh(geometry,world.materials.coastStone);gable.name='BasementStairMasonryGable';gable.receiveShadow=true;world.root.add(gable);
 }
 // Damp footing, coping and corner quoins root the small structure in the port.
 for(const side of [-1,1]){
  box(2,.28,side*1.48,4.45,.34,.20,'dark','BasementStairDampStonePlinth');
  box(2,.50,side*1.48,4.48,.08,.22,'concrete','BasementStairPlinthCoping');
  for(let row=0;row<4;row++)box(.13,.7+row*.43,side*1.42,.32,.20,.30,'concrete','BasementStairCornerQuoin');
 }
 // Shadowed recess lies behind proud jambs, with a stone reveal and sill.
 box(.92,1.2,0,.10,2.4,2.48,'dark','BasementStairRecessShadow');
 box(.76,1.17,0,.14,2.34,2.35,'dark','BasementStairDarkDoor');
 for(const side of [-1,1])box(.60,1.28,side*1.20,.32,2.56,.18,'rust','BasementStairDoorJamb');
 box(.60,2.47,0,.32,.20,2.57,'rust','BasementStairDoorLintel');
 box(.79,2.37,0,.38,.13,2.35,'concrete','BasementStairRecessedStoneReveal');
 box(.52,.06,0,.55,.12,2.50,'coastWhite','BasementStairThreshold');
 box(.64,1.16,-.77,.10,.32,.08,'signal','BasementStairDoorHandle');
 // Paired safety stripes frame the ground-level interaction position.
 for(const side of [-1,1])for(let i=0;i<5;i++)box(-.50+i*.28,.025,side*1.10,.17,.02,.24,i%2?'dark':'signal','BasementStairSafetyMark');
 // Fascia sign uses the established world sign material. Replace its generic
 // freestanding posts with brackets physically tied into the roof/door frame.
 box(-.27,2.83,0,.18,.46,3.24,'rust','BasementStairSignBacking');
 for(const side of [-1,1]){
  box(.12,2.64,side*1.12,.58,.08,.10,'rust','BasementStairSignBracket');
  box(.36,2.67,side*1.12,.09,.35,.10,'dark','BasementStairSignBracketAnchor');
  box(-.38,2.83,side*1.48,.04,.05,.05,'signal','BasementStairSignBolt');
 }
 const before=world.root.children.length;
 world.sign('CUSTOMS / BASEMENT STAIRS',x+.37,2.83,z,Math.PI/2,3.12);
 for(const child of world.root.children.slice(before))if(child.name==='SignMount'){world.root.remove(child);child.geometry?.dispose();}
 // Salt-dark service plumbing stays beside the west wall, outside the street.
 const pipeGeometry=new THREE.CylinderGeometry(1,1,1,6);
 const pipe=(dx,y,dz,radius,length,axis,name)=>{
  const mesh=new THREE.Mesh(pipeGeometry,world.materials.rust);mesh.name=name;mesh.position.set(x-dx,y,z+dz);mesh.scale.set(radius,length,radius);
  if(axis==='z')mesh.rotation.x=Math.PI/2;else if(axis==='x')mesh.rotation.z=Math.PI/2;
  mesh.receiveShadow=true;world.root.add(mesh);return mesh;
 };
 pipe(3.6,1.43,1.57,.065,2.5,'y','BasementStairRainDownpipe');
 pipe(3.6,.22,1.37,.065,.40,'z','BasementStairDrainElbow');
 for(const y of [.64,1.72,2.45])box(3.6,y,1.50,.20,.055,.18,'dark','BasementStairPipeClamp');
 box(3.6,.035,1.23,.56,.055,.60,'dark','BasementStairDrainSump');
 for(let i=0;i<6;i++)box(3.84-i*.095,.069,1.23,.035,.018,.55,'rust','BasementStairDrainGrille');
 box(.20,2.45,1.49,.14,.36,.18,'dark','BasementStairServiceJunction');
 pipe(1.92,2.50,1.50,.022,3.44,'x','BasementStairSignSupplyConduit');
 pipe(.21,2.68,1.50,.022,.32,'y','BasementStairSignSupplyConduit');
 world.diagnostics.basement={portal:[x,z],destination:'existing authored dungeon',interaction:'E / service stair door',construction:'pitched standing-seam canopy / recessed masonry / drained service plinth'};
 world.basementGallery=buildCustomsServiceGallery(world);
}
