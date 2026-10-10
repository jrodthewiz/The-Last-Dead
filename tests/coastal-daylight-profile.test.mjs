import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {COASTAL_DAYLIGHT,COASTAL_DAYLIGHT_GLSL,alignCoastalDaylight} from '../coastal-daylight-profile.js';
import {createHarborShadowCoverage} from '../harbor-shadow-coverage.js';
import {BLACKWATER_LOOKS,createBlackwaterGraphicSky} from '../blackwater-render-looks.js';
import {coastalGLSL,coastalWGSL,coastalWaves} from '../coastal-water.js';
const source=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const direction=light=>light.position.clone().sub(light.target.position).normalize();

test('the single corrective profile separates opposed visible cardinal facade pairs at retained elevation',()=>{
 assert.deepEqual(COASTAL_DAYLIGHT.source,[45,88,-45]);
 const expected=new THREE.Vector3(45,88,-45).normalize(),actual=new THREE.Vector3(...COASTAL_DAYLIGHT.direction);
 assert.ok(actual.distanceTo(expected)<1e-14);assert.ok(Math.abs(actual.length()-1)<1e-14);
 const elevation=Math.atan2(actual.y,Math.hypot(actual.x,actual.z))*180/Math.PI;
 assert.ok(elevation>54&&elevation<55);
 // Required street sees +X/+Z planes; required overview sees their opposites.
 // In both pairs one direct-light incidence is positive and one is negative.
 for(const pair of [[[1,0,0],[0,0,1]],[[-1,0,0],[0,0,-1]]]){
  const incidence=pair.map(n=>new THREE.Vector3(...n).dot(actual));
  assert.ok(incidence[0]*incidence[1]<0&&Math.min(...incidence)<-.4&&Math.max(...incidence)>.4);
 }
 assert.equal(COASTAL_DAYLIGHT.skyOpening,.10);
});

test('actual registered building/forest light setup aligns BEFORE captured coverage and retains owners',()=>{
 const text=source('harbor-visuals.js');
 for(const [prefix,coverageName,lightName,length,map]of [
  ['graphic.sunColor','blackwaterShadowCoverage','blackwaterSun',Math.hypot(30,52,41),2048],
  ['graphic?.sunColor','forestShadowCoverage','forestSun',Math.hypot(30,80,48),1536]]){
  const start=text.indexOf('const sun=new THREE.DirectionalLight('+prefix),end=text.indexOf('createHarborShadowCoverage(sun);',start)+'createHarborShadowCoverage(sun);'.length;
  assert.ok(start>=0&&end>start);const setup=text.slice(start,end),owner={root:new THREE.Group()};let basisCaptured=false;
  const wrap=light=>{basisCaptured=true;assert.ok(direction(light).distanceTo(new THREE.Vector3(...COASTAL_DAYLIGHT.direction))<1e-14);return createHarborShadowCoverage(light);};
  Function('THREE','graphic','alignCoastalDaylight','createHarborShadowCoverage',setup).call(owner,THREE,BLACKWATER_LOOKS.cartoon,alignCoastalDaylight,wrap);
  const light=owner[lightName],coverage=owner[coverageName],shadow=light.shadow;
  assert.ok(basisCaptured);assert.ok(owner.root.children.includes(light)&&owner.root.children.includes(light.target));
  assert.ok(Math.abs(light.position.distanceTo(light.target.position)-length)<1e-12);assert.deepEqual(shadow.mapSize.toArray(),[map,map]);assert.equal(shadow.autoUpdate,false);assert.equal(shadow.map,null);
  for(const [x,z,span]of [[220,62,undefined],[340,382,undefined],[224,208,640],[200,60,undefined]]){
   assert.equal(coverage.update(x,0,z,span),true);assert.ok(direction(light).distanceTo(new THREE.Vector3(...COASTAL_DAYLIGHT.direction))<1e-14);assert.equal(light.shadow,shadow);
   if(span===undefined)assert.ok(Math.abs(light.position.distanceTo(light.target.position)-length)<1e-12);
   if(span===640){
    light.shadow.updateMatrices(light);
    for(const [sx,sz]of [[0,0],[448,0],[448,416],[128,416]])for(const sy of [0,35]){
     const p=new THREE.Vector3(sx,sy,sz).applyMatrix4(light.shadow.matrix);
     assert.ok(p.x>0&&p.x<1&&p.y>0&&p.y<1&&p.z>0&&p.z<1,'actual new basis retains island/skyline inspection coverage');
    }
   }
   light.shadow.needsUpdate=false;assert.equal(coverage.update(x+.001,0,z+.001,span),false);assert.equal(light.shadow.needsUpdate,false);
  }
  light.dispose();
 }
 assert.ok(Object.isFrozen(COASTAL_DAYLIGHT)&&Object.isFrozen(COASTAL_DAYLIGHT.direction)&&Object.isFrozen(COASTAL_DAYLIGHT.horizontal));
});

test('actual world-key coast branch and noncoast rebuilding reset exactly without changing light budget',()=>{
 const text=source('renderer.js'),start=text.indexOf('this._worldKeyLight.target.position.set(shadowCenterX'),end=text.indexOf('this._worldKeyLight.shadow.camera.updateProjectionMatrix();',start)+'this._worldKeyLight.shadow.camera.updateProjectionMatrix();'.length;
 assert.ok(start>=0&&end>start);
 const setup=Function('course','shadowCenterX','shadowCenterZ','alignCoastalDaylight',text.slice(start,end));
 const owner={_worldKeyLight:new THREE.DirectionalLight(0xffdfa5,2.5)},light=owner._worldKeyLight;
 const shadow=light.shadow,color=light.color.toArray(),intensity=light.intensity;
 setup.call(owner,{coastal:true},280,140,alignCoastalDaylight);
 assert.ok(direction(light).distanceTo(new THREE.Vector3(...COASTAL_DAYLIGHT.direction))<1e-14);assert.ok(Math.abs(light.position.distanceTo(light.target.position)-Math.hypot(32,44))<1e-12);
 setup.call(owner,{coastal:false},12,28,alignCoastalDaylight);
 assert.deepEqual(light.position.toArray(),[12,32,-16]);assert.deepEqual(light.target.position.toArray(),[12,0,28]);assert.equal(light.shadow,shadow);assert.deepEqual(light.color.toArray(),color);assert.equal(light.intensity,intensity);light.dispose();
});

test('GLSL and existing WGSL translation share daylight with unchanged optical/wave source',()=>{
 assert.ok(coastalGLSL.includes(`sunDirection=normalize(vec3(${COASTAL_DAYLIGHT_GLSL}))`));assert.ok(coastalWGSL.includes(`sunDirection=normalize(vec3f(${COASTAL_DAYLIGHT_GLSL}))`));
 const values=COASTAL_DAYLIGHT_GLSL.split(',').map(Number);assert.ok(Math.abs(Math.hypot(...values)-1)<1e-12);
 for(let i=0;i<3;i++)assert.ok(Math.abs(values[i]-COASTAL_DAYLIGHT.direction[i])<5e-13);
 assert.deepEqual(coastalWaves,[[.94,.32,.32,34],[-.42,.91,.19,21],[.78,-.52,.11,13]]);
 // Pin the entire optical source except its one intentionally changed vector,
 // including derivative normal bands, foam, absorption and horizon haze.
 const opticalBaseline=coastalGLSL.replace(COASTAL_DAYLIGHT_GLSL,'-.5,.4,-.6').replace(/\r\n/g,'\n');
 assert.equal(createHash('sha256').update(opticalBaseline).digest('hex'),'bddfb30b7d9b5350df1431ad2f02b205cbbb9eec6eabb786926e9b774f456812','entire generated wave/normal/optical source stays frozenv46 except sun direction');
});

test('runtime sky retains geometry, palette, four noise fields and lifecycle with static orientation',()=>{
 const text=source('blackwater-render-looks.js'),runtime=text.slice(text.indexOf('export function createBlackwaterGraphicSky'),text.indexOf('function reliefMap'));
 assert.equal((runtime.match(/mx_noise_float\(/g)||[]).length,4);assert.ok(runtime.includes('COASTAL_DAYLIGHT.horizontal')&&runtime.includes('COASTAL_DAYLIGHT.direction'));
 const sky=createBlackwaterGraphicSky();let geometries=0,materials=0;sky.root.geometry.addEventListener('dispose',()=>geometries++);sky.root.material.addEventListener('dispose',()=>materials++);
 assert.equal(sky.root.geometry.parameters.widthSegments,24);assert.equal(sky.root.geometry.parameters.heightSegments,12);assert.equal(sky.root.material.map,null);assert.equal(sky.root.material.depthWrite,false);assert.equal(sky.root.material.fog,false);assert.equal(sky.root.frustumCulled,false);assert.equal(sky.root.renderOrder,-1000);assert.ok(sky.root.material.colorNode);
 assert.equal(BLACKWATER_LOOKS.cartoon.sun,2.05);assert.equal(BLACKWATER_LOOKS.cartoon.fill,1.45);assert.equal(BLACKWATER_LOOKS.cartoon.sky,'#526d85');assert.equal(BLACKWATER_LOOKS.cartoon.horizon,'#b6c6cd');assert.equal(BLACKWATER_LOOKS.cartoon.sunColor,'#f0e2cf');
 assert.equal(BLACKWATER_LOOKS.cartoon.exposure,1);assert.equal(BLACKWATER_LOOKS.cartoon.fillSky,'#a3bac9');assert.equal(BLACKWATER_LOOKS.cartoon.ground,'#40534f');assert.deepEqual(BLACKWATER_LOOKS.cartoon.bands,[.075,.34,1]);
 sky.dispose();sky.dispose();assert.equal(geometries,1);assert.equal(materials,1);
});
