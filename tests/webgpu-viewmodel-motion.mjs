import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'C:/Users/wolfk/Desktop/Dogfight/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Users/wolfk/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',args:['--enable-unsafe-webgpu']});
const output='output/playwright/webgpu-viewmodel-motion';await mkdir(output,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/motion-qa',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto('http://127.0.0.1:5200/motion-qa');
 const report=await page.evaluate(async()=>{
  const T=await import('/vendor/three.module.js'),{BodycamPass}=await import('/bodycam-pass.js'),{installViewmodelDepthBoundary}=await import('/assets/survivor/viewmodel-depth.js');
  const renderer=await (await import('/webgpu-backend.js')).createWebGPUBackend(document.createElement('canvas'));renderer.setSize(800,600);document.body.append(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(75,4/3,.025,200);scene.add(camera);scene.background=new T.Color('#5c6268');
  for(let i=-12;i<13;i++){const wall=new T.Mesh(new T.BoxGeometry(.12,6,.2),new T.MeshBasicMaterial({color:i%2?0xe0ddd1:0x152a2c}));wall.position.set(i*.3,0,-5);scene.add(wall);}
  const foreground=new T.Group();camera.add(foreground);
  for(let i=0;i<8;i++){const strip=new T.Mesh(new T.BoxGeometry(.035,.4,.06),new T.MeshBasicMaterial({color:i%2?0xffbe72:0x14231b}));strip.position.set(-.12+i*.035,-.2,-.7);foreground.add(strip);}installViewmodelDepthBoundary(foreground);
  const pass=new BodycamPass(renderer);pass.fixedTime=5;let blur=0;pass._motion=()=>pass._blur.set(blur,0);
  const capture=new T.WebGLRenderTarget(800,600);capture.texture.colorSpace=T.SRGBColorSpace;renderer.setRenderTarget(capture);
  const pixels=async()=>{const raw=await renderer.readRenderTargetPixelsAsync(capture,0,0,800,600),p=new Uint8Array(800*600*4),stride=Math.ceil(800*4/256)*256;for(let y=0;y<600;y++)p.set(raw.subarray(y*stride,y*stride+3200),(599-y)*3200);return p;};
  pass.render(scene,camera,1000);const still=await pixels();blur=.018;pass.render(scene,camera,1016);const moving=await pixels();
  let foregroundError=0,worldError=0,n=0;
  for(let y=160;y<245;y++)for(let x=375;x<425;x++){const at=(y*800+x)*4;for(let c=0;c<3;c++)foregroundError+=Math.abs(still[at+c]-moving[at+c]);n+=3;}
  foregroundError/=n;n=0;for(let y=400;y<450;y++)for(let x=150;x<650;x++){const at=(y*800+x)*4;for(let c=0;c<3;c++)worldError+=Math.abs(still[at+c]-moving[at+c]);n+=3;}worldError/=n;
  const debugMat=new T.ShaderMaterial({vertexShader:pass.material.vertexShader,fragmentShader:'uniform sampler2D tDepth;varying vec2 vUv;void main(){gl_FragColor=vec4(vec3(texture2D(tDepth,vUv).r),1.);}',uniforms:pass.material.uniforms,depthTest:false,depthWrite:false,toneMapped:false});pass.quad.material=debugMat;renderer.render(pass.scene,pass.camera);const depthData=await pixels();const depthValue=depthData[(200*800+400)*4];pass.quad.material=pass.material;
  const fixedShader=pass.material.fragmentShader;pass.material.fragmentShader=fixedShader.replace('float worldMotion=step(.012,texture2D(tDepth,uv).r);','float worldMotion=1.;');pass.material.needsUpdate=true;pass.render(scene,camera,1032);const legacy=await pixels();let legacyForegroundError=0;n=0;
  for(let y=160;y<245;y++)for(let x=375;x<425;x++){const at=(y*800+x)*4;for(let c=0;c<3;c++)legacyForegroundError+=Math.abs(still[at+c]-legacy[at+c]);n+=3;}legacyForegroundError/=n;
  pass.material.fragmentShader=fixedShader;pass.material.needsUpdate=true;
  foreground.visible=false;
  const {Renderer}=await import('/renderer.js'),{GLTFLoader}=await import('/vendor/loaders/GLTFLoader.js'),{installForegroundArms,fitForegroundArms}=await import('/assets/survivor/foreground-arms.js'),{animateOssuary}=await import('/weapon-ossuary.js');
  camera.fov=110;camera.updateProjectionMatrix();const r=Object.create(Renderer.prototype);r.materials={};r.camera=camera;r.weaponRig=new T.Group();camera.add(r.weaponRig);r.weaponGroups=[r._makePulseRevolver()];r.weaponGroups[0].scale.setScalar(.64);r.weaponRig.add(r.weaponGroups[0]);
  const asset=await new GLTFLoader().loadAsync('/assets/survivor/viewmodel-arms-v1.glb');installForegroundArms(r,asset.scene);camera.layers.enable(1);const light=new T.HemisphereLight(0xffffff,0x6b5343,3);light.layers.enable(1);scene.add(light);
  let maxGripGap=0;for(let i=0;i<32;i++){camera.rotation.y=Math.sin(i*.7)*1.8;r.weaponRig.position.z=i%8<3?.088:0;animateOssuary(r.weaponGroups[0],i%8<3?1:0,i/60,1/60);fitForegroundArms(r.weaponGroups[0]);pass.render(scene,camera,1100+i*16);for(const f of r.weaponGroups[0].userData.foregroundArmFits)maxGripGap=Math.max(maxGripGap,f.arm.userData.gripSocket.getWorldPosition(new T.Vector3()).distanceTo(f.grip.getWorldPosition(new T.Vector3())));}
  renderer.setRenderTarget(null);pass.render(scene,camera,1700);
  const debug=document.createElement('canvas');debug.width=800;debug.height=600;debug.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(still),800,600),0,0);
  return {depthValue,capture:debug.toDataURL(),foregroundError,legacyForegroundError,worldError,maxGripGap,frames:32,depthTexture:!!pass.target.depthTexture};
 });
 await writeFile(`${output}/readback.png`,Buffer.from(report.capture.split(',')[1],'base64'));delete report.capture;
 await page.screenshot({path:`${output}/turning-recoil.png`});await writeFile(`${output}/report.json`,JSON.stringify({report,errors},null,2));
 assert.deepEqual(errors,[]);assert.ok(report.foregroundError<.5,JSON.stringify(report));assert.ok(report.legacyForegroundError>5);assert.ok(report.worldError>1);assert.ok(report.maxGripGap<1e-6);console.log(JSON.stringify(report));
}finally{await browser.close();}

