import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {Renderer} from '../renderer.js';
import {WeaponAim,WEAPON_AIM} from '../weapon-aim.js';
import {FIRST_PERSON_HOLD_POSES} from '../assets/survivor/viewmodel-hold-poses.js';

function scene(aspect,scale=1) {
 const r=Object.create(Renderer.prototype);r.materials={};
 r.camera=new T.PerspectiveCamera(75,aspect,.025,220);r.weaponRig=new T.Group();r.camera.add(r.weaponRig);
 r.weaponGroups=[r._makePulseRevolver(),r._makeBreachShotgun(),r._makeArcLance(),r._makeReliquaryAsset(),r._makeRifle('carrion',4),r._makeRifle('mourning',5)];
 r.weaponGroups.forEach((g,i)=>{const p=FIRST_PERSON_HOLD_POSES[i];g.position.fromArray(p.position);g.position.x*=Math.min(1,aspect/.9);g.rotation.fromArray(p.rotation);g.scale.setScalar(p.scale*scale);const wrapper=new T.Group();wrapper.position.set(.02,-.04,.03);r.weaponRig.add(wrapper);wrapper.add(g);});
 return r;
}

test('actual sights and braced holds align across viewport widths and reach wrappers',()=>{
 for(const [aspect,scale] of [[16/10,1],[9/16,5/7]]){
  const r=scene(aspect,scale),aim=new WeaponAim();
  for(let weapon=0;weapon<6;weapon++){
   r.weaponRig.position.set(.02,-.012,0);r.weaponRig.quaternion.identity();
   aim.apply(r.weaponRig,r.weaponGroups[weapon],weapon,1);r.camera.updateMatrixWorld(true);
   const p=WEAPON_AIM[weapon],model=r.weaponGroups[weapon].userData.model||r.weaponGroups[weapon];
   for(const point of [p.rear,p.front]){
    const actual=new T.Vector3().fromArray(point);model.localToWorld(actual);r.camera.worldToLocal(actual);
    assert(Math.abs(actual.x-p.target[0])<1e-6,`${weapon}: ${actual.x}`);
    assert(Math.abs(actual.y-p.target[1])<1e-6,`${weapon}: ${actual.y}`);
    assert(actual.z<-.025,'sights must remain in front of the near plane');
   }
  }
 }
});

test('aim changes the held assembly without changing gun or grip local frames',()=>{
 const r=scene(16/10),aim=new WeaponAim();
 for(let weapon=0;weapon<6;weapon++){
  const g=r.weaponGroups[weapon],matrix=g.matrix.clone();g.updateMatrix();matrix.copy(g.matrix);
  for(const amount of [0,.1,.4,.7,1,.7,.1,0]){
   r.weaponRig.position.set(.02,-.012,0);r.weaponRig.quaternion.identity();
   aim.apply(r.weaponRig,g,weapon,amount);
   assert.deepEqual(g.matrix.elements,matrix.elements);
   assert([...r.weaponRig.position,...r.weaponRig.quaternion].every(Number.isFinite));
  }
 }
});

test('melee and invalid aim do not inherit a gun alignment',()=>{
 const r=scene(16/10),aim=new WeaponAim();
 for(const [weapon,amount] of [[6,1],[7,1],[0,NaN],[0,0]]){
  r.weaponRig.position.set(.02,-.012,0);r.weaponRig.quaternion.identity();
  aim.apply(r.weaponRig,r.weaponGroups[0],weapon,amount);
  assert.deepEqual(r.weaponRig.position.toArray(),[.02,-.012,0]);assert.equal(r.weaponRig.quaternion.w,1);
 }
});
