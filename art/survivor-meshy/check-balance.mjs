import {readFile,writeFile} from 'node:fs/promises';
const envText=await readFile('C:/Users/wolfk/Desktop/Dogfight/.env','utf8');
const local={};for(const line of envText.split(/\r?\n/)){const m=line.trim().match(/^([A-Za-z_][\w]*)\s*=\s*(.*)$/);if(m)local[m[1]]=m[2].replace(/^(["'])(.*)\1$/,'$2');}
const key=process.env.MESHY_API_KEY||process.env.MESHY_JROD||process.env.meshy_jrod||local.MESHY_API_KEY||local.MESHY_JROD||local.meshy_jrod;
if(!key)throw new Error('Configured Meshy key not found');
const response=await fetch('https://api.meshy.ai/openapi/v1/balance',{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(30000)});
if(!response.ok)throw new Error('Meshy balance check returned HTTP '+response.status);
const balance=await response.json();
const report={checkedAt:new Date().toISOString(),balance};
await writeFile(new URL(process.argv.includes('--after')?'balance-after.json':'balance-before.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
