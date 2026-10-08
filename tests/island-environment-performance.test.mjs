import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createForestVegetation} from '../forest-vegetation.js';

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
