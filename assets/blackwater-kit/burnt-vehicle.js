import * as THREE from '../../vendor/three.module.js';
import {MARITIME_PALETTE} from './maritime-vehicles.js';

export const BURNT_VEHICLE_IDS=Object.freeze(['street-main-16-resident','street-works-46-delivery','street-saltwind-38-resident','street-works-69-service']);
// Same borrowed slot/part-array convention as makeMaritimeKit. +X forward,
// +Y up, +Z right. Damage stays inside the existing parked-car solid bounds.
export function makeBurntVehicleKit(kind){
 if(!['estate','van'].includes(kind))throw new RangeError('Burnt vehicle must be estate or van');
 const parts=new Map(Object.keys(MARITIME_PALETTE).map(slot=>[slot,[]])),L=kind==='van'?5.4:4.65,W=kind==='van'?2.35:2.13;
 const put=(slot,g,tag)=>{g.userData.part=tag;parts.get(slot).push(g);};
 const box=(slot,p,size,tag,angle=0)=>{const g=new THREE.BoxGeometry(...size);g.rotateZ(angle);g.translate(...p);put(slot,g,tag);};
 const panel=(slot,points,tag)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();put(slot,g,tag);};
 const rod=(a,b,r,tag)=>{const x=new THREE.Vector3(...a),y=new THREE.Vector3(...b),d=y.clone().sub(x),g=new THREE.CylinderGeometry(r,r,d.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(...x.add(y).multiplyScalar(.5).toArray());put('steel',g,tag);};
 box('dark',[0,.34,0],[L*.89,.13,W*.79],'BurntFloorPan');
 for(const side of [-1,1]){
  box('dark',[0,.48,side*W*.40],[L*.85,.28,.075],'CharredSill');
  panel('red',[[-L*.43,.42,side*W*.40],[L*.42,.46,side*W*.40],[L*.35,.75,side*W*.37],[-L*.37,.66,side*W*.39]],'ScorchedLowerBody');
  for(const x of [-L*.29,L*.29]){
   const wheel=new THREE.CylinderGeometry(.31,.31,.18,10);wheel.rotateX(Math.PI/2);wheel.translate(x,.31,side*W*.40);put('rubber',wheel,'CarriedBurntWheel');
   const rim=new THREE.CylinderGeometry(.20,.20,.185,8);rim.rotateX(Math.PI/2);rim.translate(x,.31,side*W*.40);put('steel',rim,'ExposedWheelRim');
   if(side===1)rod([x,.34,-W*.39],[x,.34,W*.39],.045,'CarriedAxle');
  }
  rod([-L*.24,.64,side*W*.36],[-L*.15,1.13,side*W*.30],.043,'EmptyRearWindowPillar');
  rod([L*.15,.66,side*W*.37],[L*.07,.93,side*W*.27],.037,'BentWindshieldPillar');
  // Unequal crushed roof stations leave the cabin/window openings genuinely
  // empty; no dark glazing volume disguises an otherwise intact car.
  rod([-L*.15,1.13,side*W*.30],[L*.07,.93,side*W*.27],.042,'CollapsedRoofRail');
 }
 panel('dark',[[-L*.15,1.14,-W*.30],[-L*.12,.97,W*.31],[L*.08,.87,W*.27],[L*.07,.95,-W*.27]],'CollapsedRoofSkin');
 panel('paint',[[L*.15,.70,-W*.34],[L*.40,.59,-W*.38],[L*.41,.57,W*.37],[L*.17,.66,W*.33]],'BentHoodPaintRemnant');
 panel('dark',[[-L*.44,.63,-W*.37],[-L*.18,.72,-W*.34],[-L*.18,.62,W*.34],[-L*.43,.57,W*.38]],'FoldedRearDeck');
 panel('steel',[[L*.03,.40,W*.43],[L*.27,.42,W*.39],[L*.21,.90,W*.34],[L*.04,.73,W*.37]],'BuckledRightDoor');
 panel('red',[[-L*.12,.45,-W*.42],[L*.05,.39,-W*.42],[L*.02,.83,-W*.32],[-L*.11,.69,-W*.38]],'TornLeftDoor');
 for(const x of [-.45,.36])box('dark',[x,.48,0],[.36,.16,.57],'BurntSeatFrame',x<0?.14:-.08);
 for(const x of [-L*.44,L*.44])box('steel',[x,.42,0],[.08,.10,W*.75],'ExposedBumper');
 return parts;
}
