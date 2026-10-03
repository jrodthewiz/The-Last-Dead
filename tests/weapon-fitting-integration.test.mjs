import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCourse,newRun,shoot,switchWeapon,weapons} from '../engine.js';
import {upgradeWeapon} from '../scavenger-pack.js';

test('a projectile retains its fitted weapon damage after switching equipment',()=>{
 const r=newRun(makeCourse());r.mode='play';r.backpack.scrap=8;
 assert.ok(upgradeWeapon(r,3).ok);switchWeapon(r,3);shoot(r);
 const rocket=r.projectiles.find(p=>p.kind==='rocket');
 assert.equal(rocket.damage,weapons[3].damage*1.25);
 switchWeapon(r,0);assert.equal(rocket.damage,weapons[3].damage*1.25);
});

test('shotgun cores carry their own fitting without borrowing a later selected weapon',()=>{
 const r=newRun(makeCourse());r.mode='play';r.backpack.scrap=8;
 assert.ok(upgradeWeapon(r,1).ok);switchWeapon(r,1);shoot(r,true);
 const core=r.projectiles.find(p=>p.core);
 assert.equal(core.damageMultiplier,1.25);switchWeapon(r,0);
 assert.equal(core.damageMultiplier,1.25);
});
