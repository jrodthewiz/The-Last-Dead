import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'C:/Users/wolfk/Desktop/dogfight/node_modules/playwright');
const out=new URL('./',import.meta.url);
await mkdir(new URL('textures/',out),{recursive:true});
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage();
 await page.route('http://127.0.0.1:5200/**',async route=>{
  const path=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//,'');
  try {const body=await readFile(new URL('../../'+path,out));await route.fulfill({body,contentType:path.endsWith('.js')?'text/javascript':path.endsWith('.png')?'image/png':path.endsWith('.css')?'text/css':'text/html'});}catch{await route.fulfill({status:404,body:'Not found'});}
 });
 await page.goto('http://127.0.0.1:5200/survivor-review.html');
 const data=await page.evaluate(async()=>{
  const THREE=await import('/vendor/three.module.js');
  let source=await(await fetch('/assets/survivor/player-survivor.js')).text();
  source=source.replace("'../../vendor/three.module.js'",JSON.stringify(location.origin+'/vendor/three.module.js'))
   .replace('batchStatic(root);','').replace("new URL('./reference.png',import.meta.url).href",JSON.stringify(location.origin+'/assets/survivor/reference.png'));
  const mod=await import(URL.createObjectURL(new Blob([source],{type:'text/javascript'})));
  const root=mod.createSurvivor();root.updateMatrixWorld(true);
  await new Promise(r=>setTimeout(r,500));
  const mats=[],meshes=[],landmarks={};const {pelvis,legs,arms,head}=root.userData;
  const world=(o,p=[0,0,0])=>o.localToWorld(new THREE.Vector3(...p)).toArray();
  landmarks.hips=world(pelvis);landmarks.head=world(head,[0,.17,0]);
  legs.forEach((l,i)=>{const s=i?'R':'L';landmarks['hip.'+s]=world(l.hip);landmarks['knee.'+s]=world(l.knee);landmarks['ankle.'+s]=world(l.knee,[0,-.40,0]);landmarks['toe.'+s]=world(l.knee,[0,-.45,-.19]);});
  arms.forEach((a,i)=>{const s=i?'R':'L';landmarks['shoulder.'+s]=world(a.shoulder);landmarks['elbow.'+s]=world(a.elbow);landmarks['wrist.'+s]=world(a.elbow,[0,-.255,-.008]);landmarks['palm.'+s]=world(a.elbow,[0,-.34,-.008]);});
  const texture=t=>{if(!t?.image)return null;const im=t.image;if(im.toDataURL)return im.toDataURL('image/png');if(!im.width)return null;const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);return c.toDataURL('image/png');};
  const ancestors=(o,parent)=>{for(let p=o;p;p=p.parent)if(p===parent)return true;return false;};
  root.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(!p.visible)return;
   let region='torso';if(ancestors(o,head))region='head';
   legs.forEach((l,i)=>{if(ancestors(o,l.hip))region='leg.'+(i?'R':'L');});
   arms.forEach((a,i)=>{if(ancestors(o,a.shoulder))region='arm.'+(i?'R':'L');});
   let m=mats.findIndex(m=>m.uuid===o.material.uuid);if(m<0){m=mats.length;const a=o.material;mats.push({uuid:a.uuid,name:a.name||o.name,color:a.color.toArray(),roughness:a.roughness,metalness:a.metalness,doubleSide:a.side===2,map:texture(a.map),bump:texture(a.bumpMap),rough:texture(a.roughnessMap)});}
   const geo=o.geometry.clone().applyMatrix4(o.matrixWorld);
   meshes.push({name:o.name,region,material:m,matrix:o.matrixWorld.toArray(),position:Array.from(geo.attributes.position.array),uv:Array.from(geo.attributes.uv?.array||[]),indices:Array.from(geo.index?.array||Array.from({length:geo.attributes.position.count},(_,i)=>i))});
  });return {landmarks,materials:mats,meshes};
 });
 for(let i=0;i<data.materials.length;i++)for(const key of ['map','bump','rough']){const v=data.materials[i][key];if(v){const name=`textures/m${i}-${key}.png`;await writeFile(new URL(name,out),Buffer.from(v.split(',')[1],'base64'));data.materials[i][key]=name;}}
 await writeFile(new URL('survivor-source.json',out),JSON.stringify(data));
 console.log(JSON.stringify({meshes:data.meshes.length,materials:data.materials.length,landmarks:data.landmarks}));
}finally{await browser.close();}
