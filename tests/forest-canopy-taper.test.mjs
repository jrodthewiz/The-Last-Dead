import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
// Rejected experiment: retain its invariants against immutable v66, not the
// restored active forest. The native critic found preservation but no earned
// branch-tier readability gain, so these CPU checks are not visual acceptance.
import {createForestVegetation, FOREST_LOD_DETAILS} from '../output/qa-runtime/island-environment-v66/forest-vegetation.js';
import {createForestVegetation as baselineForest} from '../output/qa-runtime/island-environment-v64/forest-vegetation.js';
import {TreeGeometry} from '../assets/forest-kit/ez-tree/tree.js';
import TreeOptions from '../assets/forest-kit/ez-tree/options.js';
import {PINE_MEDIUM} from '../assets/forest-kit/presets.js';
import {makeHarborCourse} from '../harbor-course.js';
import {makeCourse} from '../engine.js';

const digest = array => crypto.createHash('sha256').update(Buffer.from(array.buffer,array.byteOffset,array.byteLength)).digest('hex');
const placements = makeHarborCourse({...makeCourse(),openWorld:true}).coastal.forestPlacements;
const before = baselineForest({placements,loadTextures:false}), after = createForestVegetation({placements,loadTextures:false});
const geometries = forest => new Map(forest.root.children.map(mesh=>[mesh.geometry.name,mesh.geometry]));
const old = geometries(before), current = geometries(after);
const report = {scope:'Rejected v66 experiment CPU invariants against frozen v64; active source restored. Projected solid-card diagnostics ignore texture alpha, wind, lighting, woody occlusion and other world objects; they are not native changed pixels or frame timings.',baselineSourceHash:digest(fs.readFileSync(new URL('../output/qa-runtime/island-environment-v64/forest-vegetation.js',import.meta.url))),templates:[],projections:[]};

test('only scoped conifer near/middle position and normal buffers change; resources and proxies remain exact',()=>{
  assert.equal(placements.length,554);assert.deepEqual(after.trunkProxies,before.trunkProxies);
  for(const [name,a] of current){const b=old.get(name);assert.ok(b);assert.equal(digest(a.index.array),digest(b.index.array));
    assert.deepEqual(Object.keys(a.attributes),Object.keys(b.attributes));
    for(const [key,attribute] of Object.entries(a.attributes)){
      assert.equal(attribute.array.byteLength,b.attributes[key].array.byteLength);
      if(!(a.userData.species==='conifer'&&a.userData.part==='leaves'&&a.userData.lod<2&&['position','normal'].includes(key)))assert.equal(digest(attribute.array),digest(b.attributes[key].array),name+'/'+key);
      assert.ok(attribute.array.every(Number.isFinite));
    }
    const normals=a.attributes.normal;for(let i=0;i<normals.count;i++)assert.ok(Math.abs(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))-1)<2e-6);
  }
  const keys=['placements','templates','geometries','materials','textures','pooledMeshes','maxDraws','geometryBytes','instanceBytes','triangleCostPerTree'];
  for(const key of keys)assert.deepEqual(after.diagnostics()[key],before.diagnostics()[key],key);
  report.resources=Object.fromEntries(keys.map(key=>[key,after.diagnostics()[key]]));
  report.boundsChanged=after.bounds.filter((b,i)=>JSON.stringify(b)!==JSON.stringify(before.bounds[i])).length;
});

test('all three pinned pine skeletons retain exact attachment ownership, card origins/lengths and untouched tiers',()=>{
  for(const [templateIndex,seed] of [13977,14003,14059].entries()){
    const options=new TreeOptions();options.copy(PINE_MEDIUM);options.seed=seed;
    const generator=new TreeGeometry(options),pairs=FOREST_LOD_DETAILS.map(d=>generator.createGeometry(d));
    let height=0;for(const pair of pairs)for(const g of Object.values(pair)){g.computeBoundingBox();height=Math.max(height,g.boundingBox.max.y);}
    assert.equal(generator.skeleton.branches.length,83);assert.equal(generator.skeleton.leaves.length,82*30);
    let scopedBoughs=0,changedCards=0,minWidth=1,maxAttachmentError=0;
    for(let b=1;b<83;b++){const branch=generator.skeleton.branches[b],y=branch.sections[0].origin.y/height;if(y>=.30&&y<=.72)scopedBoughs++;}
    for(let lod=0;lod<2;lod++){
      const g=current.get(`Forest:conifer:${templateIndex}:${lod}:leaves`),base=old.get(g.name),detail=FOREST_LOD_DETAILS[lod];
      const cards=lod===0?2:1,verts=cards*4;
      for(let i=0,emitted=0;i<generator.skeleton.leaves.length;i+=detail.leafStride,emitted++){
        const leaf=generator.skeleton.leaves[i],branch=generator.skeleton.branches[1+Math.floor(i/30)];
        let distance=Infinity,along=0;
        for(let j=0;j<branch.sections.length-1;j++){
          const a=branch.sections[j].origin,d=new THREE.Vector3().subVectors(branch.sections[j+1].origin,a);assert.ok(d.lengthSq()>0);
          const t=Math.max(0,Math.min(1,new THREE.Vector3().subVectors(leaf.origin,a).dot(d)/d.lengthSq()));
          const error=a.clone().addScaledVector(d,t).distanceTo(leaf.origin);if(error<distance){distance=error;along=(j+t)/(branch.sections.length-1);}
        }
        maxAttachmentError=Math.max(maxAttachmentError,distance);assert.ok(distance<1e-10);
        const y=branch.sections[0].origin.y/height,u=Math.max(0,Math.min(1,(along-.35)/.60));
        const expected=y>=.30&&y<=.72?1-.24*u*u*(3-2*u):1;
        for(let card=0;card<cards;card++){
          const first=emitted*verts+card*4,p=[],q=[];for(let k=0;k<4;k++){p.push(new THREE.Vector3().fromBufferAttribute(g.attributes.position,first+k));q.push(new THREE.Vector3().fromBufferAttribute(base.attributes.position,first+k));}
          // Both longitudinal centre endpoints remain on the same unchanged line.
          assert.ok(p[1].clone().add(p[2]).multiplyScalar(.5).distanceTo(leaf.origin.clone().divideScalar(height))<2e-7);
          assert.ok(p[0].clone().add(p[3]).distanceTo(q[0].clone().add(q[3]))<4e-7);
          const ratio=p[0].distanceTo(p[3])/q[0].distanceTo(q[3]);assert.ok(Math.abs(ratio-expected)<2e-5);
          if(expected===1)for(let k=0;k<4;k++)assert.deepEqual(p[k].toArray(),q[k].toArray());else changedCards++;
          minWidth=Math.min(minWidth,ratio);
        }
      }
    }
    report.templates.push({seed,scopedBoughs,changedCards,minWidth,maxAttachmentError,originalHeight:height});
    for(const pair of pairs)for(const g of Object.values(pair))g.dispose();
  }
});

// Rasterize only card quads in the exact saved cameras and actual tree matrices.
// Pixel-centre occupancy treats every quad as solid. Near-plane-crossing quads
// follow the same omission rule in both sets, but their sets can differ; this
// deliberately supplies neither an upper bound nor a native pixel measurement.
function occupancy(forest,view){
  const camera=new THREE.PerspectiveCamera(view.fov,1280/800,.1,1200);camera.position.fromArray(view.camera);camera.quaternion.fromArray(view.cameraQuaternion);camera.updateMatrixWorld();
  forest.update(camera,0,true);const vp=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),coverage=new Uint16Array(1280*800);let samples=0,quads=0,nearClipped=0;
  const matrix=new THREE.Matrix4(),p=new THREE.Vector3();
  for(const mesh of forest.root.children){if(mesh.userData.species!=='conifer'||mesh.userData.part!=='leaves'||mesh.userData.lod===2)continue;
    for(let instance=0;instance<mesh.count;instance++){mesh.getMatrixAt(instance,matrix);const transform=new THREE.Matrix4().multiplyMatrices(vp,matrix);
      for(let start=0;start<mesh.geometry.attributes.position.count;start+=4){const points=[];let clipped=false;for(let k=0;k<4;k++){p.fromBufferAttribute(mesh.geometry.attributes.position,start+k).applyMatrix4(transform);if(p.z< -1||p.z>1)clipped=true;points.push([(p.x+1)*640,(1-p.y)*400]);}if(clipped){nearClipped++;continue;}
        const minX=Math.max(0,Math.floor(Math.min(...points.map(p=>p[0])))),maxX=Math.min(1279,Math.ceil(Math.max(...points.map(p=>p[0])))),minY=Math.max(0,Math.floor(Math.min(...points.map(p=>p[1])))),maxY=Math.min(799,Math.ceil(Math.max(...points.map(p=>p[1]))));
        if(minX>maxX||minY>maxY)continue;quads++;
        for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){let positive=false,negative=false;for(let k=0;k<4;k++){const a=points[k],b=points[(k+1)%4],cross=(b[0]-a[0])*(y+.5-a[1])-(b[1]-a[1])*(x+.5-a[0]);positive ||= cross>0;negative ||= cross<0;}if(!(positive&&negative)){coverage[y*1280+x]++;samples++;}}
      }
    }
  }
  let union=0,overlap=0;for(const n of coverage){if(n)union++;if(n>1)overlap++;}return {quads,nearClipped,solidCardPixelSamples:samples,unionPixels:union,overlapPixels:overlap,meanOccupancy:union?samples/union:0};
}
test('fixed-camera solid-card overlap diagnostics are saved without claiming alpha or native visibility',()=>{
  const raw=JSON.parse(fs.readFileSync(new URL('../output/playwright/island-art-v65/report.json',import.meta.url)));
  for(const name of ['island-forest-canopy','island-woodland-gameplay','island-woodland-neutral','island-outer-forest-coast']){const view=raw.views.find(v=>v.name===name);assert.ok(view);report.projections.push({name,before:occupancy(before,view),after:occupancy(after,view)});}
  before.dispose();after.dispose();assert.equal(before.diagnostics().disposed,true);assert.equal(after.diagnostics().disposed,true);
  fs.writeFileSync(new URL('../output/island-canopy-taper-cpu-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
});
