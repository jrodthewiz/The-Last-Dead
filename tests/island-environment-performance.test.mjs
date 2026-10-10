import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createForestVegetation} from '../forest-vegetation.js';

test('far crowns join actual boughs and leaf occupancy without isolated discs within the shared LOD resource budget', () => {
  const placements=Array.from({length:18},(_,i)=>({id:`crown-profile-${i}`,species:i%2?'conifer':'deciduous',seed:i,x:i*8,y:0,z:0,height:12}));
  const forest=createForestVegetation({placements,loadTextures:false});
  try {
    const d=forest.diagnostics();assert.equal(d.templates,6);assert.equal(d.pooledMeshes,36);assert.equal(d.geometries,36);assert.equal(d.materials,3);
    for(const cost of d.triangleCostPerTree)assert.ok(cost.lod[2]<=2800,'far silhouette retains bounded per-tree cost');
    for(const mesh of forest.root.children.filter(m=>m.userData.lod===2&&m.userData.part==='leaves')) {
      const g=mesh.geometry,p=g.attributes.position;
      assert.ok(g.attributes.normal.array.every(Number.isFinite));assert.ok(g.attributes.forestCrownCoverage.array.every(x=>x===1),'opaque coverage retains overhead crowns');
      if(mesh.userData.species==='conifer') {
        assert.equal(g.userData.crownProfile,'connected-drooping-boughs');assert.equal(p.count,g.userData.crownLobes*20+64);
        const leader=[];
        for(let j=0;j<8;j++){const center=new THREE.Vector3();for(let k=0;k<8;k++)center.add(new THREE.Vector3().fromBufferAttribute(p,g.userData.crownLobes*20+j*8+k));leader.push(center.multiplyScalar(1/8));}
        let drooping=0;
        for(let start=0;start<g.userData.crownLobes*20;start+=20){
          const root=new THREE.Vector3(),tip=new THREE.Vector3();
          for(let k=0;k<4;k++){root.add(new THREE.Vector3().fromBufferAttribute(p,start+k));tip.add(new THREE.Vector3().fromBufferAttribute(p,start+16+k));}root.multiplyScalar(.25);tip.multiplyScalar(.25);
          const rootDistance=Math.min(...leader.slice(1).map((point,j)=>new THREE.Line3(leader[j],point).closestPointToPoint(root,true,new THREE.Vector3()).distanceTo(root)));
          assert.ok(rootDistance<.035,'foliage bough roots attach to the grown central trunk');
          if(tip.y<root.y)drooping++;
          assert.ok(root.distanceTo(tip)>.0001,'continuous bough includes its actual woody branch, including short leader shoots');
        }
        assert.ok(drooping>g.userData.crownLobes*.85,'grown evergreen bough tiers predominantly droop, with short leader shoots allowed to curl upward');
      } else {
        assert.equal(g.userData.crownProfile,'joined-leaf-occupancy-envelope');
        const parent=Array.from({length:p.count},(_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
        for(let i=0;i<g.index.count;i+=3){const a=find(g.index.getX(i));parent[find(g.index.getX(i+1))]=a;parent[find(g.index.getX(i+2))]=a;}
        assert.equal(new Set(parent.map((_,i)=>find(i))).size,1,'broadleaf crown is a single joined canopy, not isolated bean clusters');
      }
    }
  } finally {forest.dispose();}
});

test('stationary forest cameras retain visibility without repeated tree scans, while projection and parent transforms invalidate it', () => {
  const placements=Array.from({length:512},(_,i)=>({id:`perf-${i}`,species:'deciduous',seed:0,x:(i%32)*4-64,y:0,z:20+Math.floor(i/32)*8,height:10}));
  const forest=createForestVegetation({placements,loadTextures:false});
  const camera=new THREE.PerspectiveCamera(70,16/9,.1,500),rig=new THREE.Group();rig.add(camera);
  camera.position.set(0,1.75,0);camera.lookAt(0,4,100);rig.updateMatrixWorld(true);
  try {
    forest.update(camera,1,true);const settled=forest.diagnostics();
    const versions=forest.root.children.map(m=>[m.instanceMatrix.version,m.instanceColor.version]);
    for(let i=0;i<60;i++)forest.update(camera,2+i*.2);
    const still=forest.diagnostics();
    assert.equal(still.updateCount,settled.updateCount,'sixty elapsed periodic refresh opportunities perform zero additional tree scans');
    assert.equal(still.visibleTrees,settled.visibleTrees);assert.deepEqual(still.lodTrees,settled.lodTrees);
    forest.root.children.forEach((m,i)=>assert.deepEqual([m.instanceMatrix.version,m.instanceColor.version],versions[i]));
    // Wind time is a mutable uniform even when geometry/visibility is cached.
    const leaves=forest.root.children.find(m=>m.userData.part==='leaves');
    const times=[];leaves.material.positionNode.traverse(n=>{if(n.isUniformNode&&typeof n.value==='number')times.push(n.value);});
    assert.ok(times.includes(13.8),'rooted leaf wind time continues advancing');
    camera.fov=25;camera.updateProjectionMatrix();forest.update(camera,13.81);
    assert.equal(forest.diagnostics().updateCount,settled.updateCount+1,'projection changes bypass movement/time throttle');
    assert.ok(forest.diagnostics().visibleTrees<settled.visibleTrees,'narrower real view culls more crowns');
    rig.position.x=50;rig.updateMatrixWorld(true);forest.update(camera,14.1);
    assert.equal(forest.diagnostics().updateCount,settled.updateCount+2,'parent movement invalidates cached world camera matrix');
    forest.update(camera,14.2,true);assert.equal(forest.diagnostics().updateCount,settled.updateCount+3,'forced QA refresh remains available');
    forest.setVisible(false);assert.equal(forest.diagnostics().visibleTrees,0);
    forest.setVisible(true);forest.update(camera,14.3);assert.ok(forest.diagnostics().visibleTrees>0,'hide/show invalidates the cached camera');
  } finally {forest.dispose();}
});
