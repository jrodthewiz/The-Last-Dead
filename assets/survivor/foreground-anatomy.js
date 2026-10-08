import * as THREE from '../../vendor/three.module.js';

const smooth = t => {t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
const digitPaths = new Map();

function orientClosedPalm(geometry) {
  const positions=geometry.attributes.position,indices=geometry.index;
  if(!indices)return;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let volume=0;
  for(let i=0;i<indices.count;i+=3){
    a.fromBufferAttribute(positions,indices.getX(i));b.fromBufferAttribute(positions,indices.getX(i+1));c.fromBufferAttribute(positions,indices.getX(i+2));
    volume+=a.dot(b.cross(c));
  }
  // The saved left palm mirrors positions but retains right-palm winding.
  // Repair only the owned closed surface, including if a later asset fixes it.
  if(volume<0){
    for(let i=0;i<indices.count;i+=3){const b=indices.getX(i+1);indices.setX(i+1,indices.getX(i+2));indices.setX(i+2,b);}
    indices.needsUpdate=true;
  }
}

function profile(keys, y) {
  let i=0;while(i<keys.length-2&&y>keys[i+1][0])i++;
  const a=keys[i],b=keys[i+1],t=smooth((y-a[0])/(b[0]-a[0]));
  return [THREE.MathUtils.lerp(a[1],b[1],t),THREE.MathUtils.lerp(a[2],b[2],t)];
}

function fingerPath(side, digit, wrapped=false) {
  const key=side+digit+(wrapped?'wrapped':'');if(digitPaths.has(key))return digitPaths.get(key);
  const sign=side==='left'?-1:1;
  const sizes={Index:[.043,1],Middle:[.015,1.06],Ring:[-.013,1],Little:[-.039,.86]};
  let points;
  if(digit==='Thumb')points=[[sign*.048,-.019,-.016],[sign*.059,.002,-.027],[sign*.044,.021,-.039],[sign*.026,.028,-.044],[sign*.009,.025,-.032]];
  else if(side==='right'&&digit==='Index'&&!wrapped)points=[[.032,.043,-.016],[.016,.048,-.003],[-.007,.055,.008],[-.029,.061,.014],[-.048,.063,.008],[-.065,.059,-.002]];
  else{
    const [y,length]=sizes[digit];
    points=[[sign*.050,y,-.016],[sign*.052,y-.002,.007],[sign*.035,y-.004,.030],[sign*.010,y-.007,.036],[-sign*.015*length,y-.010,.027],[-sign*.025*length,y-.014,.007]];
  }
  // Use the same uniform Catmull-Rom centreline as the saved Blender digits.
  // Surface padding may grow outwards; the curl and contact side stay fixed.
  const samples=[];
  for(let k=0;k<=128;k++){
    const t=k/128*(points.length-1),i=Math.min(points.length-2,Math.floor(t)),f=t-i;
    const [p0,p1,p2,p3]=[i-1,i,i+1,i+2].map(j=>points[Math.max(0,Math.min(points.length-1,j))]);
    samples.push(new THREE.Vector3(...[0,1,2].map(a=>.5*((2*p1[a])+(-p0[a]+p2[a])*f+(2*p0[a]-5*p1[a]+4*p2[a]-p3[a])*f*f+(-p0[a]+3*p1[a]-3*p2[a]+p3[a])*f*f*f))));
  }
  digitPaths.set(key,samples);return samples;
}

// Sculpt only cloned foreground surfaces in their anatomical frame. Joint
// transforms, UVs, animation pivots and the imported master remain unchanged.
export function sculptForegroundAnatomy(pivot, region, side, {wrappedIndex=false}={}) {
  pivot.updateWorldMatrix(true,true);
  const inverse=pivot.matrixWorld.clone().invert(),point=new THREE.Vector3(),radial=new THREE.Vector3(),outward=new THREE.Vector3();
  const tangent=new THREE.Vector3(),targetTangent=new THREE.Vector3(),transport=new THREE.Quaternion();
  const sign=side==='left'?-1:1;
  const sleeveKeys=region==='forearm'
    ? [[0,1.08,1.08],[.025,1.10,1.10],[.036,1.16,1.13],[.052,1.34,1.28],[.10,1.38,1.34],[.17,1.38,1.34],[.25,1.31,1.29],[.34,1.26,1.26]]
    : [[0,1.26,1.26],[.07,1.25,1.24],[.17,1.24,1.23],[.30,1.22,1.22],[.40,1.22,1.22]];
  pivot.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const geometry=mesh.geometry,positions=geometry.attributes.position;
    const toPivot=inverse.clone().multiply(mesh.matrixWorld),fromPivot=toPivot.clone().invert();
    const digit=mesh.name.match(/^(?:Grip|Nail)(Index|Middle|Ring|Little|Thumb)_/)?.[1];
    const samples=region==='hand'&&digit?fingerPath(side,digit):null;
    const targetSamples=wrappedIndex&&side==='right'&&digit==='Index'?fingerPath(side,digit,true):null;
    const colors=geometry.attributes.color;
    for(let i=0;i<positions.count;i++){
      point.fromBufferAttribute(positions,i).applyMatrix4(toPivot);
      if(region!=='hand'){
        const y=THREE.MathUtils.clamp(-point.y,0,region==='forearm'?.34:.40),[width,depth]=profile(sleeveKeys,y);
        const wave=Math.sin(Math.PI*y/(region==='forearm'?.34:.40)),cx=sign*.005*wave,cz=.005*wave;
        point.x=cx+(point.x-cx)*width;point.z=cz+(point.z-cz)*depth;
      }else if(mesh.name.startsWith('GripPalm_')){
        const originalY=point.y;
        const heel=smooth((point.y+.082)/.030),dorsal=smooth((sign*point.x-.012)/.035);
        // Build the metacarpal arch and thumb mound on the outside of the
        // curled grip. Do not inflate the positive-Z handle contact surface.
        point.x+=sign*.008*heel*dorsal;
        if(point.z<0)point.z*=1+.20*heel;
        const thenar=Math.exp(-(((point.y+.024)/.034)**2))*smooth((-point.z-.010)/.028);
        point.x+=sign*.004*thenar*heel;
        // A continuous gauntlet heel overlaps the wrist; the hand joint and
        // live grip remain at their original positions.
        const cuff=1-smooth((originalY+.087)/.031);
        point.y-=.022*cuff;
        point.x*=1+.12*cuff;point.z=.015+(point.z-.015)*(1+.10*cuff);
        const panel=smooth((originalY+.057)/.010)*(1-smooth((originalY-.027)/.012));
        const outer=dorsal*smooth((.027-Math.abs(point.z+.006))/.008);
        point.x+=sign*.0018*panel*outer;
        if(colors){
          const seam=(Math.exp(-(((originalY+.047)/.0018)**2))+Math.exp(-(((originalY-.027)/.0018)**2)))*outer;
          const wear=panel*outer*.020,thread=Math.min(1,seam)*.021;
          colors.setXYZ(i,colors.getX(i)+wear+thread,colors.getY(i)+wear+thread,colors.getZ(i)+wear*.82+thread*.72);
        }
      }else if(samples){
        let nearest=samples[0],distance=Infinity,index=0;
        for(let j=0;j<samples.length;j++){const centre=samples[j],d=point.distanceToSquared(centre);if(d<distance){distance=d;nearest=centre;index=j;}}
        radial.copy(point).sub(nearest);
        tangent.copy(samples[Math.min(index+1,128)]).sub(samples[Math.max(index-1,0)]).normalize();
        if(targetSamples){
          targetTangent.copy(targetSamples[Math.min(index+1,128)]).sub(targetSamples[Math.max(index-1,0)]).normalize();
          transport.setFromUnitVectors(tangent,targetTangent);radial.applyQuaternion(transport);
          nearest=targetSamples[index];tangent.copy(targetTangent);point.copy(nearest).add(radial);
        }
        outward.set(nearest.x,0,nearest.z).normalize();
        outward.addScaledVector(tangent,-outward.dot(tangent)).normalize();
        const radius=radial.length(),dorsal=Math.max(0,radial.dot(outward)/Math.max(radius,1e-7));
        const fraction=index/128,knuckle=Math.exp(-(((fraction-.27)/.060)**2))+.7*Math.exp(-(((fraction-.62)/.055)**2));
        // Rounded knuckles and flatter phalangeal panels replace uniform
        // inflated bands. Inward handle-contact pads keep their surface.
        point.addScaledVector(radial,.12*dorsal*dorsal);
        point.addScaledVector(outward,.0014*knuckle*dorsal*dorsal);
        if(colors&&mesh.name.startsWith('Grip')){
          const panel=smooth((fraction-.08)/.08)*(1-smooth((fraction-.78)/.12))*dorsal*dorsal;
          const crease=Math.exp(-(((fraction-.34)/.014)**2))+Math.exp(-(((fraction-.69)/.012)**2));
          const lift=.014*panel-.008*Math.min(1,crease)*dorsal;
          colors.setXYZ(i,Math.max(.008,colors.getX(i)+lift),Math.max(.010,colors.getY(i)+lift),Math.max(.008,colors.getZ(i)+lift*.78));
        }
      }
      point.applyMatrix4(fromPivot);positions.setXYZ(i,point.x,point.y,point.z);
    }
    positions.needsUpdate=true;if(colors)colors.needsUpdate=true;
    if(region==='hand'&&mesh.name.startsWith('GripPalm_'))orientClosedPalm(geometry);
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    mesh.userData.foregroundAnatomyRevision=2;
  });
  pivot.userData.foregroundAnatomyRevision=2;
}
