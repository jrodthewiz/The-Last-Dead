// Read and download assets included in the approved rig job; never submit a task.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=new URL('./',import.meta.url),dir=new URL('tld-survivor-v02/',base);
const journal=JSON.parse(await readFile(new URL('generation.json',dir),'utf8'));
if(!journal.rig?.taskId)throw new Error('Approved rig task has not been submitted yet');
const envText=await readFile('C:/Users/wolfk/Desktop/Dogfight/.env','utf8');
const local={};for(const line of envText.split(/\r?\n/)){const m=line.trim().match(/^([A-Za-z_][\w]*)\s*=\s*(.*)$/);if(m)local[m[1]]=m[2].replace(/^(["'])(.*)\1$/,'$2');}
const key=process.env.MESHY_API_KEY||process.env.MESHY_JROD||process.env.meshy_jrod||local.MESHY_API_KEY||local.MESHY_JROD||local.meshy_jrod;
if(!key)throw new Error('Configured Meshy key not found');
const r=await fetch('https://api.meshy.ai/openapi/v1/rigging/'+encodeURIComponent(journal.rig.taskId),{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(30000)});
if(!r.ok)throw new Error('Rig status HTTP '+r.status);const task=await r.json();
if(task.status!=='SUCCEEDED')throw new Error('Rig task is not complete');
const report={taskId:task.id,additionalCredits:0,assets:[]};
await mkdir(new URL('basic-animations/',base),{recursive:true});
for(const name of ['walking','running']){
 const url=task.result?.basic_animations?.[name+'_glb_url'];if(!url)continue;
 const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.hostname!=='assets.meshy.ai')throw new Error('Unexpected asset host');
 const file=new URL('basic-animations/'+name+'.glb',base);
 let bytes;try{bytes=await readFile(file);}catch{
  const response=await fetch(url,{signal:AbortSignal.timeout(180000)});if(!response.ok)throw new Error('Animation download HTTP '+response.status);
  const chunks=[];let length=0;for await(const chunk of response.body){length+=chunk.length;if(length>50*1024*1024)throw new Error('Animation exceeds size limit');chunks.push(chunk);}bytes=Buffer.concat(chunks);if(bytes.toString('utf8',0,4)!=='glTF')throw new Error('Invalid animation GLB');await writeFile(file,bytes);
 }
 report.assets.push({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await writeFile(new URL('basic-animations/manifest.json',base),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
