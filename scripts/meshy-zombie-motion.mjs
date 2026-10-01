// Offline asset tooling. Default command only reads tasks/library and downloads
// already-paid outputs. Paid commands require explicit operator credit approval.
import {readFile,writeFile,mkdir,rename,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
// Paid outputs and no-rebill journals survive diagnostic-directory cleanup.
const OUT=path.join(ROOT,'.art-source/enemy-motion-v04');
const OLD_RIG='01a0cdaf-1182-7473-b631-c659f7d0e138';
const SOURCE=path.join(ROOT,'.art-source/afterlife-iteration/ash-witness-meshy-source/model.glb');
const SAVED_RIG=path.join(ROOT,'.art-source/afterlife-iteration/ash-witness-meshy-source/tasks/rig.json');
const ACTIONS=[112,113,386,214,178,189];
const API='https://api.meshy.ai/openapi/v1/';
const args=process.argv.slice(2),command=args[0]||'probe';
const flag=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const report=value=>console.log(JSON.stringify(value,null,2));
const readJSON=async file=>JSON.parse(await readFile(file,'utf8'));
async function optionalJSON(file){try{return await readJSON(file);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function save(name,value){const file=path.join(OUT,name),temp=file+'.tmp';await writeFile(temp,JSON.stringify(value,null,2)+'\n');await rename(temp,file);}
async function key(){
 const names=['MESHY_API_KEY','MESHY_JROD','meshy_jrod'];
 for(const name of names)if(process.env[name])return process.env[name];
 let env='';try{env=await readFile('C:/Users/wolfk/Desktop/Dogfight/.env','utf8');}catch{}
 for(const line of env.split(/\r?\n/)){const match=line.trim().match(/^([A-Za-z_][\w]*)\s*=\s*(.*)$/);if(match&&names.includes(match[1]))return match[2].replace(/^(["'])(.*)\1$/,'$2');}
 throw new Error('Meshy credentials unavailable; no task submitted');
}
let apiKey;
async function request(endpoint,{body}={}){
 apiKey??=await key();
 let response;
 try{response=await fetch(API+endpoint,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${apiKey}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(body?120000:30000)});}catch{throw new Error('Meshy network request failed; submission state may be uncertain; inspect journal before retrying');}
 if(!response.ok){const error=new Error(`Meshy HTTP ${response.status}`);error.status=response.status;throw error;}
 return response.json();
}
function summary(task){return {id:task.id,status:task.status,progress:task.progress,consumedCredits:task.consumed_credits,expiresAt:task.expires_at,expired:!!task.expires_at&&task.expires_at<Date.now(),resultKeys:Object.keys(task.result||{})};}
function glbInfo(bytes){
 if(bytes.length<20||bytes.toString('utf8',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2)throw new Error('Invalid GLB');
 const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
 const primitives=(json.meshes||[]).flatMap(mesh=>mesh.primitives);
 const bounds=primitives.map(primitive=>{const a=json.accessors[primitive.attributes.POSITION];return{min:a.min,max:a.max};});
 return {bytes:bytes.length,sha256:hash(bytes),triangles:primitives.reduce((n,p)=>n+(json.accessors[p.indices??p.attributes.POSITION]?.count||0)/3,0),primitiveLocalBounds:bounds,skins:json.skins?.length||0,joints:(json.skins||[]).map(s=>s.joints.map(i=>json.nodes[i].name)),clips:(json.animations||[]).map(a=>({name:a.name,channels:a.channels.length,duration:Math.max(...a.samplers.map(s=>json.accessors[s.input].max?.[0]||0))}))};
}
async function download(url,name){
 const file=path.join(OUT,name);
 try{return{file:name,cached:true,...glbInfo(await readFile(file))};}catch(e){if(e.code!=='ENOENT')throw e;}
 const parsed=new URL(url);
 if(parsed.protocol!=='https:'||parsed.hostname!=='assets.meshy.ai')throw new Error('Unexpected asset host');
 const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(180000)});
 if(!response.ok)throw new Error(`Asset download HTTP ${response.status}`);
 const chunks=[];let length=0;
 for await(const chunk of response.body){length+=chunk.length;if(length>100*1024*1024)throw new Error('Asset exceeds 100 MiB limit');chunks.push(chunk);}
 const bytes=Buffer.concat(chunks),info=glbInfo(bytes);
 await writeFile(file,bytes);
 return{file:name,cached:false,...info};
}
async function task(kind,id){if(!/^[a-z0-9-]{20,50}$/i.test(id||''))throw new Error('Invalid task ID');return request(`${kind}/${id}`);}
async function probe(){
 const source=glbInfo(await readFile(SOURCE));
 const saved=await readJSON(SAVED_RIG),output={checkedAt:new Date().toISOString(),source:{file:path.relative(ROOT,SOURCE).replaceAll('\\','/'),...source},oldRig:summary(saved),downloads:[],actions:[],pricing:{animationPerAction:3,animationTotal:18,rerig:5,maxTotal:23},docs:['https://docs.meshy.ai/en/api/animation','https://docs.meshy.ai/en/api/rigging','https://docs.meshy.ai/en/api/pricing']};
 let live;
 try{live=await task('rigging',OLD_RIG);output.liveRig=summary(live);}catch(e){output.liveRig={error:e.message,httpStatus:e.status};}
 for(const name of ['walking','running']){
  const url=live?.result?.basic_animations?.[`${name}_glb_url`]||saved.result?.basic_animations?.[`${name}_glb_url`];
  if(url)try{output.downloads.push(await download(url,`existing-${name}.glb`));}catch(e){output.downloads.push({file:`existing-${name}.glb`,error:e.message.replace(/https?:\/\/\S+/g,'[redacted URL]')});}
 }
 try{const library=await request(`animations/library?action_ids=${ACTIONS.join(',')}`);output.actions=library.map(({action_id,name,key,category,sub_category})=>({action_id,name,key,category,sub_category}));}catch(e){output.libraryError=e.message;}
 output.existingRigUsable=live?.status==='SUCCEEDED'&&!output.liveRig.expired&&output.downloads.some(d=>d.sha256);
 output.allActionsAvailable=ACTIONS.every(id=>output.actions.some(a=>a.action_id===id));
 await save('preflight.json',output);report(output);
}
async function submit(kind){
 const budget=Number(flag('--approve-credits'));
 const required=kind==='rigging'?5:18;
 if(!Number.isInteger(budget)||budget<required||budget>23)throw new Error(`Paid command requires --approve-credits ${required} (or approved combined budget 23)`);
 const name=kind==='rigging'?'rigging':'animation',journalFile=path.join(OUT,`${name}-journal.json`);
 const prior=await optionalJSON(journalFile);
 if(prior){if(prior.taskId){report({resumed:true,taskId:prior.taskId,...summary(await task(kind,prior.taskId))});return;}throw new Error('Submission journal already exists without task ID. Do not resubmit; reconcile task history first.');}
 const preflight=await readJSON(path.join(OUT,'preflight.json'));
 if(Date.now()-Date.parse(preflight.checkedAt)>24*3600*1000)throw new Error('Preflight older than 24 hours; run probe again');
 let body,details;
 if(kind==='rigging'){
  if(preflight.existingRigUsable)throw new Error('Existing rig is usable; refusing unnecessary re-rig');
  const bytes=await readFile(SOURCE),info=glbInfo(bytes);
  if(info.sha256!==preflight.source.sha256||info.triangles>300000||bytes.length>50*1024*1024)throw new Error('Source changed or exceeds rigging limit');
  body={model_url:`data:model/gltf-binary;base64,${bytes.toString('base64')}`,height_meters:1.86};
  details={sourceSha256:info.sha256,sourceBytes:bytes.length,heightMeters:1.86};
 }else{
  if(!preflight.allActionsAvailable)throw new Error('Library has not verified every requested action');
  const rigJournal=await optionalJSON(path.join(OUT,'rigging-journal.json'));
  const rigId=rigJournal?.taskId||(preflight.existingRigUsable?OLD_RIG:null);
  if(!rigId)throw new Error('No usable rig; re-rig is required');
  const rig=await task('rigging',rigId);
  if(rig.status!=='SUCCEEDED'||(rig.expires_at&&rig.expires_at<Date.now()))throw new Error('Rig is incomplete or expired');
  body={rig_task_id:rigId,action_ids:ACTIONS};details=body;
 }
 const journal={createdAt:new Date().toISOString(),state:'submitting',estimatedCredits:required,approvedCommandBudget:budget,request:details};
 // Exclusive creation is a durable no-rebill latch, including ambiguous network
 // failures. No automatic retry of POST is allowed, even after a timeout.
 const handle=await open(journalFile,'wx');try{await handle.writeFile(JSON.stringify(journal,null,2)+'\n');await handle.sync();}finally{await handle.close();}
 try{const response=await request(kind,{body});if(typeof response.result!=='string')throw new Error('Create response did not contain task ID');journal.taskId=response.result;journal.state='submitted';await save(`${name}-journal.json`,journal);report({taskId:journal.taskId,estimatedCredits:required,state:journal.state});}
 catch(e){journal.state='uncertain';journal.error=e.message;await save(`${name}-journal.json`,journal);throw e;}
}
async function poll(){
 const kind=flag('--kind')||'animations';if(!['animations','rigging'].includes(kind))throw new Error('Invalid task kind');
 const journal=await optionalJSON(path.join(OUT,kind==='rigging'?'rigging-journal.json':'animation-journal.json'));
 const id=flag('--id')||journal?.taskId;if(!id)throw new Error('No task ID to poll');
 const seconds=Math.min(50,Math.max(0,Number(flag('--seconds')||0))),end=Date.now()+seconds*1000;
 while(true){
  const result=await task(kind,id),state=summary(result);await save(`${kind}-status.json`,state);report(state);
  if(result.status==='SUCCEEDED'){
   const downloads=[];
   if(kind==='rigging'){
    if(result.result?.rigged_character_glb_url)downloads.push(await download(result.result.rigged_character_glb_url,'fresh-rig.glb'));
    for(const name of ['walking','running'])if(result.result?.basic_animations?.[`${name}_glb_url`])downloads.push(await download(result.result.basic_animations[`${name}_glb_url`],`fresh-${name}.glb`));
   }else if(result.result?.animation_glb_url)downloads.push(await download(result.result.animation_glb_url,'zombie-six-actions.glb'));
   if(!downloads.length)throw new Error('Succeeded task has no expected GLB result');
   await save(`${kind}-downloads.json`,{taskId:id,downloads});report({taskId:id,downloads});return;
  }
  if(['FAILED','CANCELED'].includes(result.status))throw new Error(`Task ${result.status}; no automatic paid retry`);
  if(Date.now()>=end)return;
  await new Promise(resolve=>setTimeout(resolve,Math.min(5000,end-Date.now())));
 }
}
async function main(){await mkdir(OUT,{recursive:true});if(command==='probe')return probe();if(command==='submit-rig')return submit('rigging');if(command==='submit-animation')return submit('animations');if(command==='poll')return poll();throw new Error('Commands: probe | submit-rig --approve-credits 5 | submit-animation --approve-credits 18 | poll --kind rigging|animations --seconds 50');}
main().catch(error=>{console.error(error.message.replace(/https?:\/\/\S+/g,'[redacted URL]'));process.exitCode=1;});
