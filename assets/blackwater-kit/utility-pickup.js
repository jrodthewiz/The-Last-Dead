import * as THREE from '../../vendor/three.module.js';
import {mergeGeometries} from '../../vendor/utils/BufferGeometryUtils.js';
import {lights} from '../../vendor/three.tsl.js';
import {BlackwaterPaintedMaterial} from '../../blackwater-render-looks.js';

// Original metre-scaled utility pickup. Forward is +X, matching the swept
// 5.2 x 2.4 m driving footprint; ground is Y=0. No imported vehicle geometry.
export function createUtilityPickup({lightSources=[]}={}) {
  const root=new THREE.Group();root.name='BlackwaterUtilityPickup';root.userData.noBatch=true;
  const palette={paint:'#c89037',dark:'#293434',rubber:'#25312e',steel:'#889c97',glass:'#568895',pale:'#e7d8a8',red:'#bd5140',wood:'#816848'};
  const materials=new Map(),parts=new Map(),geometries=new Set(),wheels=[];
  const illumination=lights(lightSources.filter(l=>l?.isLight));
  for(const [slot,tint]of Object.entries(palette)){const m=new BlackwaterPaintedMaterial({color:tint});m.name=`Pickup:${slot}`;m.lightsNode=illumination;materials.set(slot,m);parts.set(slot,[]);}
  const box=(slot,at,size,angle=0)=>{const g=new THREE.BoxGeometry(...size);g.rotateZ(angle);g.translate(...at);parts.get(slot).push(g);};
  const cylinder=(slot,at,r,h,axis='z')=>{const g=new THREE.CylinderGeometry(r,r,h,10);if(axis==='z')g.rotateX(Math.PI/2);if(axis==='x')g.rotateZ(Math.PI/2);g.translate(...at);parts.get(slot).push(g);};
  box('dark',[0,.53,0],[4.62,.22,1.72]);
  // Sill segments and raised shoulders leave real wheel openings in silhouette.
  for(const side of [-1,1]){
    box('paint',[0,.77,side*.95],[2.05,.36,.15]);
    for(const x of [-2.27,2.22])box('paint',[x,.80,side*.96],[.38,.38,.14]);
    for(const x of [-1.62,1.62])box('paint',[x,1.05,side*.96],[1.12,.18,.20]);
    box('dark',[.10,.60,side*1.02],[1.65,.12,.20]);
    box('paint',[.48,1.22,side*.94],[1.45,.49,.13]);
    box('glass',[.43,1.69,side*.963],[1.26,.42,.022]);
    box('dark',[.18,1.69,side*.980],[.045,.47,.026]);
    for(const x of [-.27,1.13])box('paint',[x,1.72,side*.955],[.075,.53,.095]);
    box('paint',[.42,1.96,side*.93],[1.51,.09,.12]);
    box('steel',[.10,1.35,side*1.019],[.21,.035,.045]);
    box('dark',[1.11,1.59,side*1.065],[.095,.047,.24]);
    box('steel',[1.12,1.65,side*1.16],[.17,.20,.045]);
    // Cargo-bed side panels, upper rail, tie-down loops and pressed ribs.
    box('paint',[-1.52,1.03,side*.94],[1.94,.41,.14]);
    box('dark',[-1.52,1.25,side*.95],[2.02,.055,.16]);
    for(let i=0;i<5;i++)box('dark',[-2.30+i*.37,1.04,side*1.019],[.027,.25,.009]);
    for(const x of [-2.20,-.82])cylinder('steel',[x,1.25,side*.95],.044,.055);
  }
  box('paint',[1.81,1.11,0],[1.32,.24,1.82],-.035);
  box('dark',[2.48,.91,0],[.10,.37,1.78]);
  for(let i=0;i<6;i++)box('steel',[2.542,.94,-.49+i*.195],[.018,.035,.15]);
  for(const side of [-1,1]){
    box('pale',[2.544,1.065,side*.69],[.023,.16,.26]);
    box('red',[-2.505,1.04,side*.81],[.03,.22,.16]);
  }
  for(const x of [-2.49,2.49]){box('steel',[x,.64,0],[.15,.14,2.16]);box('dark',[x,.78,0],[.07,.18,.42]);}
  box('paint',[.40,2.07,0],[1.65,.14,1.93]);
  box('glass',[1.18,1.71,0],[.033,.54,1.75],.16);
  box('paint',[1.20,1.47,0],[.08,.06,1.86]);
  box('glass',[-.40,1.75,0],[.026,.38,1.40]);
  box('paint',[-.46,1.20,0],[.10,.44,1.87]);
  // Cabin contents and anchored wipers remain readable through the graphic glass.
  for(const side of [-1,1]){box('dark',[.17,1.22,side*.49],[.52,.16,.57]);box('dark',[-.11,1.48,side*.49],[.15,.49,.57]);}
  box('dark',[.99,1.35,0],[.30,.14,1.63]);
  for(const z of [-.46,.46])box('dark',[1.223,1.50,z],[.027,.035,.49],-.02);
  box('wood',[-1.50,.91,0],[1.89,.11,1.77]);
  for(let i=0;i<6;i++)box('dark',[-1.50,.969,-.75+i*.30],[1.84,.009,.012]);
  box('paint',[-2.47,1.04,0],[.12,.40,1.84]);
  box('dark',[-2.54,1.055,0],[.009,.022,.43]);
  // Strapped recovery box gives the truck an authored survival purpose.
  box('steel',[-1.79,1.22,0],[.69,.49,1.31]);
  box('dark',[-1.79,1.48,0],[.73,.045,1.36]);
  for(const x of [-2.02,-1.56])box('pale',[x,1.23,0],[.065,.53,1.39]);
  box('red',[-.48,1.13,.40],[.16,.31,.45]);
  box('dark',[-.48,1.32,.40],[.14,.045,.29]);
  let triangles=0;
  for(const [slot,list]of parts){if(!list.length)continue;const g=mergeGeometries(list);list.forEach(x=>x.dispose());geometries.add(g);triangles+=g.index.count/3;const mesh=new THREE.Mesh(g,materials.get(slot));mesh.name=`Pickup:${slot}`;mesh.layers.set(1);mesh.castShadow=false;mesh.receiveShadow=true;root.add(mesh);}
  const tire=new THREE.CylinderGeometry(.46,.46,.25,14,1),hub=new THREE.CylinderGeometry(.255,.255,.265,10,1);
  tire.rotateX(Math.PI/2);hub.rotateX(Math.PI/2);geometries.add(tire);geometries.add(hub);
  for(const x of [-1.62,1.62])for(const z of [-.995,.995]){
    const wheel=new THREE.Group();wheel.position.set(x,.46,z);wheel.name=`PickupWheel:${x}:${z}`;
    for(const [g,slot]of [[tire,'rubber'],[hub,'steel']]){const mesh=new THREE.Mesh(g,materials.get(slot));mesh.layers.set(1);mesh.name=`Wheel:${slot}`;wheel.add(mesh);triangles+=g.index.count/3;}root.add(wheel);wheels.push(wheel);
  }
  const bounds=new THREE.Box3().setFromObject(root),diagnostics={original:true,triangles,drawCalls:root.children.length-4+8,materials:materials.size,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},collision:[5.2,2.4]};
  let disposed=false,roll=0,lastDistance=0;
  return {root,diagnostics,update(vehicle){if(!vehicle)return;const distance=vehicle.distance||0;roll+=(distance-lastDistance)*4/.46*Math.sign(vehicle.speed||0);lastDistance=distance;for(const wheel of wheels)wheel.rotation.z=-roll;},dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials.values())m.dispose();}};
}
