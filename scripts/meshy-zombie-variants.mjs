// Offline Meshy intake. Credentials stay in Dogfight's environment and never
// enter a runtime asset. Every paid POST has an exclusive durable journal;
// an uncertain submission is reconciled instead of automatically rebilled.
import {readFile,writeFile,mkdir,rename,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const ARCHIVE=path.join(ROOT,'.art-source/zombie-variants-meshy');
const REPORTS=path.join(ROOT,'docs/zombie-variants');
const API='https://api.meshy.ai/openapi/';
const common='Full-body human zombie for a realistic coastal horror FPS. Neutral T-pose, arms horizontal apart from torso, straight legs and separated feet, open five-finger hands. Clear complete humanoid anatomy, facing +Z, entire body visible. No props, weapons, base, scene or text. Detailed anatomy and readable clothing silhouette.';
export const VARIANTS=Object.freeze([
 {id:'drowned-dockworker',label:'Drowned Dockworker',motion:'shambler',height:1.86,prompt:common+' Heavy middle-aged male, broad shoulders, thick forearms, swollen waterlogged belly, sunken eyes and a slack slightly open jaw. Torn yellow-green fisherman bib overalls with short straps over a faded dark work shirt, heavy rubber boots, bare gray mottled hands. Waterlogged salt-corroded fabric and algae stains, unsettling human face.',texture:'Natural desaturated coastal horror PBR: mottled gray-blue dead skin, sunken eyes, dirty teeth inside slightly open mouth, faded ochre-green rubber bib overalls, charcoal cotton shirt, muddy black rubber boots, wet patches and salt stains. Detailed roughness and normal maps. No painted lights, pure metal skin, symbols, text or emissive eyes.'},
 {id:'fever-runner',label:'Fever Runner',motion:'runner',height:1.86,prompt:common+' Lean adult female infected runner, narrow waist, long wiry limbs, tense neck tendons, visible cheekbones, short ragged hair and hollow staring eyes. Torn burgundy athletic windbreaker with hood down, fitted dark trousers and worn running shoes. Fully clothed body, bare pallid hands, slightly parted lips and unhealthy facial asymmetry. Human joint proportions.',texture:'Realistic muted horror PBR: pale clammy skin with subtle bruised veins, tired dark eyes, dirty teeth inside parted lips, faded burgundy windbreaker with torn cuffs and gray fabric lining, charcoal fitted trousers, scuffed running shoes. Cloth roughness and fine normal details, salt grime. No shiny plastic skin, printed lettering, glowing eyes or baked lighting.'},
 {id:'crooked-crawler',label:'Crooked Crawler',motion:'crawler',height:1.86,prompt:common+' Gaunt adult male with long thin but anatomically human arms, large bony hands, angular shoulder blades and wasted legs. Bald scalp, deep eye sockets, pale hollow face and slightly open mouth. Short torn off-white hospital tunic over dark fitted knee-length shorts, bare forearms and lower legs, thin worn slippers. Limbs remain straight in neutral T-pose for rigging; frightening bent stalking posture will be animated later.',texture:'Grounded desaturated horror PBR: ashen pallid skin with purple bruises around shoulders, darkened fingernails, sunken sockets, dirty exposed teeth, bloodless face. Worn off-white hospital cloth with dull rust stains and frayed edges, dark gray shorts and slippers. Fine skin roughness and cloth normals. No exposed organs, glowing eyes, lettering or painted lighting.'},
]);
const args=process.argv.slice(2),command=args[0]||'probe',variant=VARIANTS.find(v=>v.id===args[1]);
const digest=b=>createHash('sha256').update(b).digest('hex');
async function optional(file){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function save(file,value){await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.tmp',JSON.stringify(value,null,2)+'\n');await rename(file+'.tmp',file);}
async function credentials(){
 const names=['MESHY_API_KEY','MESHY_JROD','meshy_jrod'];
 for(const name of names)if(process.env[name])return{value:process.env[name],source:'process environment',name};
 for(const file of ['.env','.env.local','.env.development.local','my-server/.env.development']){
  let source;try{source=await readFile(path.join('C:/Users/wolfk/Desktop/dogfight',file),'utf8');}catch(e){if(e.code==='ENOENT')continue;throw e;}
  for(const line of source.split(/\r?\n/)){
   const match=line.trim().match(/^(?:export\s+)?([A-Za-z_][\w]*)\s*=\s*(.*)$/);
   if(match&&names.includes(match[1])){const value=match[2].replace(/^(["'])(.*)\1$/,'$2').trim();if(value)return{value,source:'Dogfight/'+file,name:match[1]};}
  }
 }
 throw new Error('MESHY_API_KEY=MISSING; no provider task submitted');
}
let key;
async function request(endpoint,body){
 key??=await credentials();let response;
 try{response=await fetch(API+endpoint,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${key.value}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(body?120000:45000)});}catch{throw new Error('Meshy request failed; inspect the submission journal before retrying a paid task');}
 if(!response.ok){
  const detail=await response.json().catch(()=>null),message=String(detail?.message||detail?.error?.message||'').replaceAll(key.value,'[redacted]').slice(0,500);
  const error=new Error(`Meshy HTTP ${response.status}${message?': '+message:''}`);error.httpStatus=response.status;throw error;
 }
 return response.json();
}
const endpoint=stage=>stage==='rig'?'v1/rigging':stage==='retexture'?'v1/retexture':'v2/text-to-3d';
const folder=v=>path.join(ARCHIVE,v.id);
const journalFile=(v,stage)=>path.join(folder(v),stage+'-journal.json');
const summary=t=>({id:t.id,status:t.status,progress:t.progress,consumedCredits:t.consumed_credits,taskError:t.task_error?.message||null,resultKeys:Object.keys(t.result||{}),hasGLB:!!(t.model_urls?.glb||t.result?.rigged_character_glb_url)});
function validateGLB(bytes){
 if(bytes.length<20||bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length){const error=new Error('Incomplete cached GLB; recovering provider download');error.code='INVALID_GLB';throw error;}
 JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
}
async function download(url,file){
 const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.hostname!=='assets.meshy.ai')throw new Error('Unexpected Meshy asset host');
 const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(180000)});if(!r.ok)throw new Error(`Meshy asset HTTP ${r.status}`);
 const chunks=[];let size=0;for await(const chunk of r.body){size+=chunk.length;if(size>80*1024*1024)throw new Error('Meshy asset exceeds80MiB intake limit');chunks.push(chunk);}
 const bytes=Buffer.concat(chunks);if(file.endsWith('.glb'))validateGLB(bytes);
 await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.download.tmp',bytes);await rename(file+'.download.tmp',file);
 return{file:path.relative(ROOT,file).replaceAll('\\','/'),bytes:size,sha256:digest(bytes)};
}
async function status(v,stage){
 const journal=await optional(journalFile(v,stage));if(!journal?.taskId)return{variant:v.id,stage,status:journal?.state||'NOT_SUBMITTED'};
 const task=await request(endpoint(stage)+'/'+journal.taskId);await save(path.join(folder(v),stage+'-task.json'),task);
 const out={variant:v.id,stage,...summary(task)};
 if(task.status==='SUCCEEDED'){
  const url=task.model_urls?.glb||task.result?.rigged_character_glb_url;
  const modelFile=path.join(folder(v),stage+'.glb');
  if(url){try{const bytes=await readFile(modelFile);validateGLB(bytes);out.asset={file:path.relative(ROOT,modelFile).replaceAll('\\','/'),bytes:bytes.length,sha256:digest(bytes)};}catch(e){if(e.code!=='ENOENT'&&e.code!=='INVALID_GLB')throw e;out.asset=await download(url,modelFile);}}
  if(task.thumbnail_url){const preview=path.join(folder(v),stage+'-preview.png');try{await readFile(preview);}catch(e){if(e.code!=='ENOENT')throw e;await download(task.thumbnail_url,preview);}}
  await save(path.join(REPORTS,v.id+'-'+stage+'.json'),out);
 }
 return out;
}
async function submit(v,stage){
 const file=journalFile(v,stage),prior=await optional(file);
 if(prior){
  if(prior.taskId)return{resumed:true,...await status(v,stage)};
  const rejected=prior.state==='rejected'||prior.error==='Meshy HTTP 400';
  if(rejected&&args.includes('--retry-rejected'))await rename(file,file+'.rejected-'+Date.now()+'.json');
  else throw new Error(v.id+' '+stage+' has an unresolved paid submission; reconcile instead of rebilling');
 }
 const credits={preview:20,refine:10,retexture:10,rig:5}[stage];
 const balance=await request('v1/balance');if(Number(balance.balance)<credits)throw new Error(`Insufficient Meshy balance for ${v.id} ${stage}: needs${credits}credits`);
 let body;
 if(stage==='preview'){
  if(v.prompt.length>800)throw new Error('Meshy preview prompt exceeds800characters: '+v.prompt.length);
  body={mode:'preview',prompt:v.prompt,ai_model:'meshy-7.1',model_type:'standard',should_remesh:true,topology:'triangle',target_polycount:20000,pose_mode:'t-pose',target_formats:['glb']};
 }
 else if(stage==='retexture'){
  if(v.id!=='fever-runner')throw new Error('Only the visibly healthy runner needs this texture correction');
  const source=await optional(journalFile(v,'refine'));if(!source?.taskId)throw new Error('No original textured runner task');
  body={input_task_id:source.taskId,ai_model:'meshy-7',enable_original_uv:true,enable_pbr:true,texture_resolution:'2k',target_formats:['glb'],text_style_prompt:'A dead infected female zombie, explicitly an undead corpse, severe ashen gray-green cadaver skin everywhere including face and hands, dark purple bruised eye sockets and hollow black eyes, cracked gray lips, mottled purple neck veins and lifeless discolored hands. No pink living skin, no healthy complexion, no makeup. Torn faded burgundy fabric jacket and dark gray trousers with grime. Terrifying gaunt corpse face. Natural realistic horror PBR materials, rough skin and worn cloth, no glowing eyes and no painted light.'};
 }
 else{
  const sourceStage=stage==='refine'?'preview':stage==='rig'&&await optional(journalFile(v,'retexture'))?'retexture':'refine',source=await optional(journalFile(v,sourceStage));
  if(!source?.taskId)throw new Error('Submit '+sourceStage+' first');
  const task=await request(endpoint(sourceStage)+'/'+source.taskId);if(task.status!=='SUCCEEDED')throw new Error(sourceStage+' is not ready');
  body=stage==='refine'?{mode:'refine',preview_task_id:source.taskId,ai_model:'meshy-7.1',enable_pbr:true,texture_resolution:'2k',texture_prompt:v.texture,target_formats:['glb']}:{input_task_id:source.taskId,height_meters:v.height};
 }
 await mkdir(folder(v),{recursive:true});
 const journal={variant:v.id,stage,createdAt:new Date().toISOString(),state:'submitting',estimatedCredits:credits,authorization:'User requested a few Meshy zombie variations using Dogfight account; bounded batch of three',request:body};
 const handle=await open(file,'wx');try{await handle.writeFile(JSON.stringify(journal,null,2)+'\n');await handle.sync();}finally{await handle.close();}
 try{const result=await request(endpoint(stage),body);if(typeof result.result!=='string')throw new Error('Meshy returned no task ID');journal.taskId=result.result;journal.state='submitted';await save(file,journal);return{variant:v.id,stage,taskId:journal.taskId,estimatedCredits:credits};}
 catch(error){journal.state=[400,401,402,422].includes(error.httpStatus)?'rejected':'uncertain';journal.error=error.message;journal.httpStatus=error.httpStatus||null;await save(file,journal);throw error;}
}
async function main(){
 await mkdir(REPORTS,{recursive:true});
 if(command==='probe'){
  const found=await credentials(),balance=await request('v1/balance');
  const receipt={checkedAt:new Date().toISOString(),credential:'MESHY_API_KEY=SET',credentialSource:found.source,creditBalance:Number(balance.balance),plannedBatch:VARIANTS.map(({id,label,motion,height})=>({id,label,motion,height})),estimatedTotalCredits:105,model:'meshy-7.1',facesPerCharacter:20000,textureResolution:'2k',docs:['https://docs.meshy.ai/en/api/text-to-3d','https://docs.meshy.ai/en/api/rigging','https://docs.meshy.ai/en/api/pricing','https://docs.meshy.ai/en/api/balance']};
  await save(path.join(REPORTS,'meshy-preflight.json'),receipt);console.log(JSON.stringify(receipt,null,2));return;
 }
 if(!variant)throw new Error('Specify one of: '+VARIANTS.map(v=>v.id).join(', '));
 if(command==='reconcile'){
  const journal=await optional(journalFile(variant,'rig'));if(!journal)throw new Error('No rig journal to reconcile');
  const history=await request('v1/rigging?page_num=1&page_size=100');
  await save(path.join(folder(variant),'rig-reconciliation-history.json'),history);
  const tasks=Array.isArray(history)?history:history.result||history.data||[];
  console.log(JSON.stringify(tasks.map(task=>({...summary(task),createdAt:task.created_at,inputTaskId:task.input_task_id||null,keys:Object.keys(task)})),null,2));return;
 }
 if(command==='status'){for(const stage of ['preview','refine','retexture','rig'])console.log(JSON.stringify(await status(variant,stage)));return;}
 if(!['preview','refine','retexture','rig'].includes(command))throw new Error('Commands: probe, preview, refine, retexture, rig, status, reconcile');
 console.log(JSON.stringify(await submit(variant,command)));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
