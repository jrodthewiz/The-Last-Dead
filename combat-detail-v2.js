import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';

// Smooth continuous fluid profiles, shared by fixed-size instance pools.
export function fluidDropGeometry(radius=1){
  const points=[[0,-1],[.46,-.82],[.83,-.42],[1,0],[.86,.40],[.52,.78],[.18,1.05],[0,1.2]];
  const geometry=new THREE.LatheGeometry(points.map(([x,y])=>new THREE.Vector2(x*radius,y*radius)),16);
  geometry.name='FluidDropletProfile';return geometry;
}

export function coreCanisterGeometry(){
  const points=[[0,-.23],[.09,-.23],[.125,-.19],[.125,-.14],[.108,-.12],[.108,.12],[.125,.14],[.125,.19],[.08,.23],[0,.23]];
  const geometry=new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(...p)),24);
  geometry.name='BreachPressureCanister';return geometry;
}

export function ricochetCoinGeometry(){
  const parts=[new THREE.CylinderGeometry(.18,.18,.035,40)];
  for(const y of [-.021,.021]){
    const rim=new THREE.TorusGeometry(.156,.009,5,40);rim.rotateX(Math.PI/2);rim.translate(0,y,0);parts.push(rim);
    for(const [x,z]of [[.018,.18],[.11,.022]]){const stamp=new THREE.BoxGeometry(x,.008,z);stamp.translate(0,y,0);parts.push(stamp);}
  }
  const result=mergeGeometries(parts.map(g=>g.toNonIndexed()),false);
  for(const part of parts)part.dispose();
  result.name='EmbossedRicochetCoin';return result;
}

export class OrdnanceDetails{
  constructor(parent,capacity){
    const geometry=new THREE.TorusGeometry(.111,.008,6,24);geometry.rotateX(Math.PI/2);
    // Two glowing pressure seals are merged, so all live cores cost one draw.
    const a=geometry.clone().translate(0,-.10,0),b=geometry.clone().translate(0,.10,0);
    const joined=mergeGeometries([a,b]);geometry.dispose();a.dispose();b.dispose();
    this.bands=new THREE.InstancedMesh(joined,new THREE.MeshStandardMaterial({color:0xe0b170,emissive:0xff842c,emissiveIntensity:1.3,roughness:.45,metalness:.35}),capacity);
    this.bands.name='CorePressureSeals';this.bands.count=0;this.bands.frustumCulled=false;this.bands.instanceMatrix.setUsage(THREE.DynamicDrawUsage);parent.add(this.bands);
  }
  update(core){this.bands.count=core.count;this.bands.instanceMatrix.array.set(core.instanceMatrix.array);this.bands.instanceMatrix.needsUpdate=true;}
}
