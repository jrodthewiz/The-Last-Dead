import * as THREE from '../../vendor/three.module.js';
import {MeshStandardNodeMaterial} from '../../vendor/three.webgpu.js';
import {lights} from '../../vendor/three.tsl.js';
import {mergeGeometries} from '../../vendor/utils/BufferGeometryUtils.js';
// Utility airframe: local metres, +X nose/+Y up/+Z right. Skid contact datum Y=0.
export function makeUtilityHelicopter({lightSources=[]}={}){
 const root=new THREE.Group();root.name='UtilityHelicopter';root.userData.noBatch=true;
 const palette={paint:'#5b7670',cream:'#c7c7b3',metal:'#778888',dark:'#273739',glass:'#3e6471',rubber:'#252f2e'};
 const materials=new Map(Object.entries(palette).map(([slot,c])=>{const m=new MeshStandardNodeMaterial({color:c,roughness:slot==='glass'?.25:slot==='metal'?.42:.78,metalness:slot==='metal'?.65:0});m.name='UtilityHelicopter:'+slot;if(lightSources.length)m.lightsNode=lights(lightSources.filter(l=>l?.isLight));return[slot,m];}));
 const parts=new Map([...materials.keys()].map(k=>[k,[]]));
 const put=(s,g,tag)=>{g.deleteAttribute('uv');g.userData.part=tag;parts.get(s).push(g);};
 const box=(s,p,size,tag)=>{const g=new THREE.BoxGeometry(...size);g.translate(...p);put(s,g,tag);};
 const rod=(s,a,b,r,tag,n=8)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start),g=new THREE.CylinderGeometry(r,r,d.length(),n);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(...start.add(end).multiplyScalar(.5).toArray());put(s,g,tag);};
 const pane=(s,q,tag)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(q.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();put(s,g,tag);};
 const stations=[[-2.65,.45,1.35,2.00],[-1.8,1.14,.60,2.40],[.25,1.2,.60,2.56],[1.65,.98,.75,2.38],[2.65,.42,1.15,1.90]];
 const pos=[],idx=[];for(const[x,w,low,high]of stations)for(const[y,z]of[[low,-w],[high,-w*.73],[high,w*.73],[low,w]])pos.push(x,y,z);
 for(let i=0;i<stations.length-1;i++)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4;idx.push(a,b,a+4,b,b+4,a+4);}idx.push(0,2,1,0,3,2,16,17,18,16,18,19);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();put('paint',g,'carried-station-fuselage');
 for(const side of[-1,1]){
  pane('glass',[[.35,1.42,side*1.15],[1.62,1.40,side*.98],[1.60,2.25,side*.74],[.35,2.42,side*.89]],'pilot-side-glazing');
  pane('glass',[[-1.7,1.4,side*1.13],[-.25,1.4,side*1.20],[-.25,2.33,side*.89],[-1.7,2.29,side*.84]],'utility-cabin-window');
  for(const x of[-1.8,-.20,.30,1.65])rod('cream',[x,1.34,side*(x>1?.97:1.21)],[x,2.42,side*.88],.035,'carried-window-pillar');
  rod('cream',[-1.78,1.28,side*1.18],[1.68,1.30,side*.98],.035,'door-sill');
  rod('cream',[-1.8,2.44,side*.87],[1.6,2.36,side*.75],.034,'door-header');
  box('metal',[-.42,1.48,side*1.23],[.23,.035,.025],'door-handle');
  rod('metal',[-1.7,.68,side*.80],[-1.65,.13,side*1.22],.07,'rear-skid-loadpath');
  rod('metal',[1.22,.79,side*.78],[1.16,.13,side*1.22],.07,'front-skid-loadpath');
  rod('metal',[-2.30,.09,side*1.22],[2.27,.09,side*1.22],.085,'grounded-skid');
  rod('metal',[2.27,.09,side*1.22],[2.61,.24,side*1.22],.085,'skid-toe');
  box('rubber',[-1.75,.04,side*1.22],[.45,.08,.19],'skid-contact');box('rubber',[1.3,.04,side*1.22],[.45,.08,.19],'skid-contact');
 }
 pane('glass',[[1.68,1.47,-.89],[2.58,1.43,-.39],[2.54,1.87,-.30],[1.65,2.25,-.71]],'left-windscreen');
 pane('glass',[[1.68,1.47,.89],[1.65,2.25,.71],[2.54,1.87,.30],[2.58,1.43,.39]],'right-windscreen');
 rod('cream',[1.68,1.47,0],[2.54,1.87,0],.035,'windscreen-keel');
 rod('dark',[-2.3,1.82,0],[-6.17,2.08,0],.24,'tail-boom',10);
 box('paint',[-5.65,2.13,0],[1.35,.085,2.1],'horizontal-stabilizer');
 pane('paint',[[-6.45,1.97,-.045],[-5.48,1.98,-.045],[-5.95,3.30,-.045],[-6.34,3.30,-.045]],'vertical-tail-fin');
 rod('metal',[-.5,2.5,0],[-.5,3.22,0],.13,'main-rotor-mast',10);box('dark',[-.9,2.63,0],[1.15,.22,.74],'engine-fairing');
 rod('dark',[-1.55,2.58,.40],[-1.95,2.72,.40],.11,'exhaust',10);
 const rotor=new THREE.Group();rotor.name='MainRotor';rotor.position.set(-.5,3.25,0);
 const rotorParts=[];for(let i=0;i<4;i++){const blade=new THREE.BoxGeometry(4.9,.045,.26);blade.translate(2.75,0,0);blade.rotateY(i*Math.PI/2);rotorParts.push(blade);}const hub=new THREE.CylinderGeometry(.29,.29,.16,12);rotorParts.push(hub);
 const rotorFlat=rotorParts.map(p=>p.toNonIndexed()),rotorGeometry=mergeGeometries(rotorFlat,false);for(const p of [...rotorParts,...rotorFlat])p.dispose();const rotorMesh=new THREE.Mesh(rotorGeometry,materials.get('dark'));rotorMesh.castShadow=true;rotor.add(rotorMesh);root.add(rotor);
 const tailRotor=new THREE.Group();tailRotor.name='TailRotor';tailRotor.position.set(-6.12,2.45,.32);const tailParts=[];
 for(let i=0;i<3;i++){const blade=new THREE.BoxGeometry(1.10,.13,.035);blade.translate(.64,0,0);blade.rotateZ(i*Math.PI*2/3);tailParts.push(blade);}const tailFlat=tailParts.map(p=>p.toNonIndexed()),tailGeometry=mergeGeometries(tailFlat,false);for(const p of [...tailParts,...tailFlat])p.dispose();const tailMesh=new THREE.Mesh(tailGeometry,materials.get('dark'));tailMesh.castShadow=true;tailRotor.add(tailMesh);root.add(tailRotor);
 const geometries=[rotorGeometry,tailGeometry];let triangles=rotorGeometry.attributes.position.count/3+tailGeometry.attributes.position.count/3;
 for(const[slot,list]of parts){if(!list.length)continue;const flat=list.map(p=>p.index?p.toNonIndexed():p),merged=mergeGeometries(flat,false);for(const p of new Set([...list,...flat]))p.dispose();merged.computeBoundingBox();merged.computeBoundingSphere();const mesh=new THREE.Mesh(merged,materials.get(slot));mesh.name='UtilityAirframe:'+slot;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);geometries.push(merged);triangles+=merged.attributes.position.count/3;}
 root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root);let disposed=false;
 return {root,rotor,tailRotor,bounds,diagnostics:{triangles,draws:root.children.reduce((n,c)=>n+(c.isMesh?1:c.children.length),0),materials:materials.size,textures:0,attributeBytes:geometries.reduce((n,g)=>n+Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0),0)},updatePose(v){root.position.set(v.x*4,v.altitudeM,v.y*4);root.rotation.set(v.roll||0,-v.angle,v.pitch||0,'YXZ');rotor.rotation.y=v.rotorAngle||0;tailRotor.rotation.z=(v.rotorAngle||0)*3.7;},dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials.values())m.dispose();}};
}
