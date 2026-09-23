import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three.module.js';
import {inPlaceClip} from '../assets/survivor/meshy-survivor.js';

test('in-place gait retains vertical bob and leaves shared source animation unchanged',()=>{
 const positions=[2,90,3,8,92,12,14,89,22];
 const source=new THREE.AnimationClip('Walk_Forward',1,[new THREE.VectorKeyframeTrack('Hips.position',[0,.5,1],positions),new THREE.QuaternionKeyframeTrack('Head.quaternion',[0,1],[0,0,0,1,0,0,0,1])]);
 const clip=inPlaceClip(source);
 assert.deepEqual([...clip.tracks[0].values],[2,90,3,2,92,3,2,89,3]);
 assert.deepEqual([...source.tracks[0].values],positions);
 assert.notEqual(clip,source);assert.deepEqual([...clip.tracks[1].values],[...source.tracks[1].values]);
});

test('runtime model includes separate torso, remote arms, head, sleeves and locomotion',async()=>{
 const bytes=await readFile(new URL('../assets/survivor/tld-survivor-v02.glb',import.meta.url));
 assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);assert.ok(bytes.length<12_000_000);
 const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 const names=new Set(gltf.nodes.map(n=>n.name));
 for(const name of ['TLD_Local_Torso_Legs','TLD_Remote_Arms','TLD_Head_Hide_For_Local_Player','TLD_ViewSleeve_Left','TLD_ViewSleeve_Right'])assert.ok(names.has(name),name);
 assert.deepEqual(gltf.animations.map(a=>a.name).sort(),['Idle_Relaxed','Run_Forward','Walk_Forward']);
 for(const name of ['TLD_Local_Torso_Legs','TLD_Remote_Arms','TLD_Head_Hide_For_Local_Player'])assert.equal(typeof gltf.nodes.find(n=>n.name===name).skin,'number');
 for(const name of ['TLD_ViewSleeve_Left','TLD_ViewSleeve_Right'])assert.equal(gltf.nodes.find(n=>n.name===name).skin,undefined);
 for(const material of gltf.materials){assert.ok(!material.emissiveTexture);assert.ok(!material.emissiveFactor?.some(v=>v>0),'clothing must respond to lighting');}
});
