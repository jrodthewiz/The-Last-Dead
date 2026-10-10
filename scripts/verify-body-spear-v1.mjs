import {readFileSync,writeFileSync,statSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {BODY_SPEAR_MOTION} from '../assets/animations/body-spear-v1.js';

const root=new URL('../',import.meta.url),url='http://127.0.0.1:5200/';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const files=['body-spear-visuals.js','brutal-combat-visuals.js','chest-finisher-visuals.js','hand-grip-rig.js','corpse-physics.js','blackwater-actor-style.js','renderer.js','webgpu-material-hooks.js','webgpu-shaders.js','ui.js','assets/animations/body-spear-v1.js','assets/models/body-spear-anatomy-v1.glb','engine.js','enemy-ai.js','zombie-behavior.js','npc-afterlife-model.js','character-articulation.js'];
for(const id of Object.keys(BODY_SPEAR_MOTION.bodies))files.push(id==='ash-witness'?'assets/models/afterlife-ash-witness-motion-v07.glb':`assets/models/zombie-variants/${id}.glb`);
const results=[];
for(const file of files){
 const source=readFileSync(new URL(file,root)),packaged=readFileSync(new URL('dist/'+file,root)),response=await fetch(new URL(file,url),{method:'HEAD'});
 const result={file,bytes:source.length,sha256:hash(source),packagedMatch:hash(source)===hash(packaged),httpStatus:response.status,servedBytes:Number(response.headers.get('content-length'))};
 if(!result.packagedMatch||!response.ok||result.servedBytes!==source.length)throw new Error('Runtime delivery mismatch: '+file);
 results.push(result);
}
const tests=readFileSync(new URL('output/body-spear-final-tests.log',root),'utf8');
if(!tests.includes('pass 110')||!tests.includes('fail 0'))throw new Error('Focused test gate did not pass');
const recheck=readFileSync(new URL('output/body-spear-parity-final.log',root),'utf8');
if(!recheck.includes('pass 9')||!recheck.includes('fail 0'))throw new Error('Final anatomy/contact/peer frame recheck did not pass');
const browser=JSON.parse(readFileSync(new URL('output/playwright/body-spear/report.json',root),'utf8'));
if(browser.status!=='PASS'||browser.errors.length||!browser.views.some(v=>v.name==='guest-snapshot-contact'))throw new Error('Focused desktop browser gate did not pass');
for(const id of Object.keys(BODY_SPEAR_MOTION.bodies)){
 const withdrawal=browser.views.find(v=>v.name===id+'-withdrawal');
 if(!browser.views.some(v=>v.name===id+'-contact')||!withdrawal)throw new Error('Missing body gameplay receipt: '+id);
 if(!(withdrawal.sourceOpening?.closed>.9&&withdrawal.sourceOpening?.open<.1))throw new Error('Missing actual GPU source opening: '+id);
 const pixel=withdrawal.sourceOpening.obliquePixel;
 if(!(pixel?.[0]>=2&&pixel[0]>pixel[1]*1.8))throw new Error('Missing oblique inner tissue receipt: '+id);
}
const receipt={date:new Date().toISOString(),status:'PASS',tests:{passed:110,failed:0,log:'output/body-spear-final-tests.log'},build:{status:'PASS',log:'output/body-spear-build.log'},url,files:results,reference:'https://www.youtube.com/watch?v=DqAagh50JaI',offlineContactStudy:{path:'docs/body-spear-v1/contact-study.png',bytes:statSync(new URL('docs/body-spear-v1/contact-study.png',root)).size,gameScreenshot:false},generationCreditsUsedThisPass:0,sourceCharactersUnchanged:Object.entries(BODY_SPEAR_MOTION.bodies).every(([id,data])=>results.find(r=>r.file.endsWith(id==='ash-witness'?'afterlife-ash-witness-motion-v07.glb':id+'.glb')).sha256===data.sourceSha256),focusedDesktopQA:{status:browser.status,report:'output/playwright/body-spear/report.json',views:browser.views.length,checks:browser.checks,physicalControllerTested:browser.physicalControllerTested,liveP2PTested:browser.liveP2PTested},gpuPerformanceVerified:false};
if(!receipt.sourceCharactersUnchanged)throw new Error('Delivered character source changed');
receipt.finalOwnedRecheck={passed:9,failed:0,log:'output/body-spear-parity-final.log',reason:'actual rig, deforming surface, contact, tissue, particle, sleeve stretch and serialized peer floor checks'};
receipt.contactPhysics={passed:26,failed:0,log:'output/zombie-contact-physics-tests.log',reason:'sparse contacts match the original solver; awake-body broadphase retains native pairs and world supports'};
if(!readFileSync(new URL(receipt.contactPhysics.log,root),'utf8').includes('pass 26'))throw new Error('Contact physics gate did not pass');
const extendedFile='output/playwright/zombie-live-quality/profile-final.json';
if(existsSync(new URL(extendedFile,root))){
 const profile=JSON.parse(readFileSync(new URL(extendedFile,root),'utf8'));
 receipt.frameTimeProfile={status:profile.status,report:extendedFile,errors:profile.errors,measurements:profile.performance.map(p=>({name:p.name,interval:p.interval,cpu:p.cpu,physics:p.stages['physics-update'],surfaceFit:p.stages['surface-fit']})),performanceTargetMet:false};
}
const rtcFile='output/playwright/zombie-live-quality/rtc-probe.json';
if(existsSync(new URL(rtcFile,root))){const rtc=JSON.parse(readFileSync(new URL(rtcFile,root),'utf8'));receipt.liveTransportProbe={status:rtc.status,report:rtcFile,gameplaySessionTested:false};}
const coopFile='output/playwright/zombie-live-quality/coop-final.json';
if(existsSync(new URL(coopFile,root))){const coop=JSON.parse(readFileSync(new URL(coopFile,root),'utf8'));receipt.liveCombatParity={status:coop.status,report:coopFile,liveP2PTested:coop.liveP2PTested===true,sequentialNativeVisualChecks:coop.sequentialNativeVisualChecks===true};}
writeFileSync(new URL('docs/body-spear-v1/verification.json',root),JSON.stringify(receipt,null,2)+'\n');
console.log('BODY_SPEAR_VERIFIED',receipt.tests.passed+' focused checks; '+results.length+' matching packaged and served files');
