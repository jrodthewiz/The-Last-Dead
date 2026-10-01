import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { ExtractionVFX } from '../extraction-vfx.js';

function fixture(seed = 17) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(92, 1, .025, 220);
  scene.add(camera);
  const fx = new ExtractionVFX({ scene, camera, cell: 4 });
  const run = {
    course: { enemies: [{ id: 17, x: 2, y: 2, z: 0, kind: 0, dead: true, extracted: false }] },
    extraction: {
      targetId: 17,
      phase: 'draw',
      progress: 0,
      stageProgress: 0,
      seed,
    },
  };
  return { fx, run };
}

test('extraction tableau advances through draw, incision, and heart rip without growing pools', () => {
  const { fx, run } = fixture();
  fx.update(run, 0, .016, { gore: true });
  assert.equal(fx.diagnostics().phase, 'draw');
  assert.equal(fx.syringe.visible, true);
  assert.ok(fx.fluid.scale.z > 0);

  run.extraction.phase = 'incise';
  run.extraction.progress = .5;
  run.extraction.stageProgress = .64;
  fx.update(run, 500, .016, { gore: true });
  assert.equal(fx.bladeTool.visible, true);
  assert.ok(fx.woundRim.scale.x > 1.2);

  run.extraction.phase = 'rip';
  run.extraction.progress = .9;
  run.extraction.stageProgress = .76;
  for (let i = 0; i < 240; i += 1) fx.update(run, 600 + i * 16, .016, { gore: true });
  assert.equal(fx.heart.visible, true);
  assert.equal(fx.forceps.visible, true);
  assert.ok(fx.droplets.count <= 36);
  assert.equal(fx.link.visible, false, 'blood stream stays short and ends after the draw');

  run.course.enemies[0].extracted = true;
  fx.update(run, 4700, .016, { gore: true });
  assert.equal(fx.active, false);
  assert.equal(fx.droplets.count, 0);
  fx.dispose();
});

test('seed changes authored incision variation while preserving bounded geometry', () => {
  const first = fixture(31);
  const second = fixture(32);
  for (const { fx, run } of [first, second]) {
    run.extraction.phase = 'rip';
    run.extraction.progress = .8;
    run.extraction.stageProgress = .5;
    fx.update(run, 900, .016, { gore: true });
  }
  assert.notEqual(first.fx.wound.rotation.z, second.fx.wound.rotation.z);
  assert.notEqual(first.fx.corpse.scale.x, second.fx.corpse.scale.x);
  assert.ok(first.fx.diagnostics().pooledDroplets <= 36);
  first.fx.reset();
  second.fx.reset();
  assert.equal(first.fx.tool.visible, false);
  assert.equal(second.fx.corpse.visible, false);
  first.fx.dispose();
  second.fx.dispose();
});

test('completed heart remains visible briefly, then releases pooled visuals', () => {
  const {fx,run}=fixture(37);
  fx.update(run,500,.016,{gore:true});
  run.course.enemies[0].extracted=true;
  run.course.enemies[0].extractionVariation={drawRate:1};
  run.time=4.05;
  run.extraction={targetId:null,phase:'idle',progress:0,lastTargetId:17,lastSeed:37,completedAt:4};
  fx.update(run,4050,.016,{gore:true});
  assert.equal(fx.diagnostics().phase,'complete');
  assert.equal(fx.corpse.visible,true);
  assert.equal(fx.syringe.visible,false);
  assert.equal(fx.forceps.visible,true);
  run.time=4.81;
  fx.update(run,4810,.016,{gore:true});
  assert.equal(fx.active,false);
  assert.equal(fx.droplets.count,0);
  fx.dispose();
});

test('actual-model instruments touch tissue and blood stays small without a floating flow bead',()=>{
  const {fx,run}=fixture(47),frame=new THREE.Group(),heart=new THREE.Group();
  frame.position.set(0,1,0);frame.add(heart);heart.position.set(-.04,.095,.2);fx.scene.add(frame);frame.updateMatrixWorld(true);
  const state={frame,anatomy:{heart}};
  fx.cutaways={current:state,cutPoint(_state,_progress,out){return out.set(0,1,.004);},reset(){},dispose(){}};
  fx._resetVariant(47,run.course.enemies[0]);
  const draw=fx._stageValues({phase:'draw',progress:.25,stageProgress:.7});fx._updateTool(1,draw);fx.scene.updateMatrixWorld(true);
  const needle=new THREE.Vector3(0,.0275,0);fx.needleTip.localToWorld(needle);
  assert(needle.distanceTo(new THREE.Vector3(0,1,.004))<1e-6,'the needle tip contacts the real-model draw point');
  fx._updateLink(new THREE.Vector3(0,1,0),draw);assert.equal(fx.link.visible,false);assert.equal(fx.flowBead.visible,false);
  const rip=fx._stageValues({phase:'rip',progress:.85,stageProgress:.65});fx._updateTool(1,rip);fx._updateLink(new THREE.Vector3(0,1,0),rip);
  assert.equal(fx.flowBead.visible,false,'flow cannot leak from draw into exposed anatomy');
  const left=fx.forceps.getObjectByName('ForcepsLeftJaw'),right=fx.forceps.getObjectByName('ForcepsRightJaw');
  assert(left&&right&&left.position.distanceTo(right.position)>.04,'separated jaws visibly grip the heart');
  let visible=0;
  for(let tick=0;tick<24;tick++){
    fx._updateSourceDroplets(state,1+tick*.016,rip);visible+=fx.droplets.count;
    assert(fx.droplets.count<=10);
    for(let i=0;i<fx.droplets.count;i++){
      const matrix=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();
      fx.droplets.getMatrixAt(i,matrix);matrix.decompose(p,q,scale);
      assert(scale.x*.026<=.0031,'blood diameter cannot become a large organ-sized polygon');
      assert(p.y>=.012&&p.toArray().every(Number.isFinite));
    }
  }
  assert(visible>0);fx.dispose();
});
