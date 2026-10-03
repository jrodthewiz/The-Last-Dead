import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output='output/playwright/viewmodel-blender';await mkdir(output,{recursive:true});
const server=await startServer({root:process.cwd(),port:0,spaFallback:false});
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:960,height:540}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/animation-qa',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0;background:#151a20"><div id="label" style="position:absolute;top:20px;left:24px;color:white;font:18px sans-serif"></div></body>'}));
 await page.goto(`http://127.0.0.1:${server.port}/animation-qa`);
 const report=await page.evaluate(async()=>{
  const T=await import('/vendor/three.module.js'),{Renderer}=await import('/renderer.js'),{GLTFLoader}=await import('/vendor/loaders/GLTFLoader.js');
  const {installForegroundArms,fitForegroundArms}=await import('/assets/survivor/foreground-arms.js');
  const {VIEWMODEL_CLIPS}=await import('/assets/survivor/viewmodel-motion-clips.js'),{sampleViewmodelClip}=await import('/assets/survivor/viewmodel-motion.js');
  const r=Object.create(Renderer.prototype);r.materials={};r.camera=new T.PerspectiveCamera(110,960/540,.025,200);r.camera.layers.enable(1);
  const scene=new T.Scene();scene.background=new T.Color('#303940');scene.add(r.camera);r.weaponRig=new T.Group();r.camera.add(r.weaponRig);
  r.weaponGroups=[r._makePulseRevolver(),r._makeBreachShotgun(),r._makeArcLance(),r._makeReliquaryAsset(),r._makeRifle('carrion',4),r._makeRifle('mourning',5),r._makeMelee('bat',6),r._makeMelee('chainsaw',7)];
  for(const [i,g] of r.weaponGroups.entries()){g.scale.setScalar(.64);g.position.x=[.3,.31,.29,.31,.34,.34,.32,.32][i];r.weaponRig.add(g);}
  const asset=await new GLTFLoader().loadAsync('/assets/survivor/viewmodel-arms-v1.glb');installForegroundArms(r,asset.scene);
  const light=new T.HemisphereLight(0xe2e8ff,0x655044,3);light.layers.enableAll();scene.add(light);
  const sun=new T.DirectionalLight(0xffe4c5,2);sun.position.set(-2,3,2);sun.layers.enableAll();scene.add(sun);
  const gl=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});gl.setSize(960,540);document.body.appendChild(gl.domElement);
  const names=['ossuary','breach','arc','reliquary','carrion','mourning','bat','chainsaw'],pose=new Float64Array(6),v=new T.Vector3(),w=new T.Vector3();
  let maxGap=0,maxWrist=0,frames=0;
  function show(i,kind,t,render=true){
   const g=r.weaponGroups[i];r.weaponGroups.forEach((g,j)=>g.visible=i===j);
   sampleViewmodelClip(names[i]+'/'+kind,t,pose);r.weaponRig.position.set(pose[0]+.02,pose[1]-.012,pose[2]);r.weaponRig.rotation.set(...pose.slice(3));
   fitForegroundArms(g);if(render)gl.render(scene,r.camera);
   document.getElementById('label').textContent=`${names[i]} / ${kind} / ${t.toFixed(3)} s`;
   for(const f of g.userData.foregroundArmFits){maxGap=Math.max(maxGap,f.arm.userData.gripSocket.getWorldPosition(v).distanceTo(f.grip.getWorldPosition(w)));maxWrist=Math.max(maxWrist,f.wristAngle);}
   frames++;
  }
  for(let i=0;i<8;i++)for(const kind of ['draw','fire','land','idle','walk']){const clip=VIEWMODEL_CLIPS[names[i]+'/'+kind];if(!clip)continue;for(let n=0;n<=20;n++)show(i,kind,clip.duration*n/20,false);}
  window.showAnimation=show;
  return {clips:Object.keys(VIEWMODEL_CLIPS).length,frames,maxGap,maxWrist};
 });
 for(let i=0;i<8;i++)for(const [kind,t] of [['draw',.12],[i<6?'fire':'land',.035],['rest',2]]){
  await page.evaluate(({i,kind,t})=>window.showAnimation(i,kind==='rest'?'draw':kind,t),{i,kind,t});
  await page.screenshot({path:`${output}/weapon-${i}-${kind}.png`});
 }
 await writeFile(`${output}/report.json`,JSON.stringify({...report,errors},null,2));
 assert.deepEqual(errors,[]);assert(report.maxGap<1e-6);assert(report.maxWrist<Math.PI*75/180+1e-6);
 console.log(JSON.stringify({...report,errors,output}));
}finally{await browser?.close();await new Promise(resolve=>server.server.close(resolve));}
