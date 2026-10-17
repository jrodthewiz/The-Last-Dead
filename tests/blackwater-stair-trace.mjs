import {createWorldData,createColliders,SpatialGrid} from '../island/data.js';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
async function runtimeModule(name){
 if(!process.env.BLACKWATER_BASELINE_ROOT)return import('../island/'+name);
 const source=(await readFile(resolve(process.env.BLACKWATER_BASELINE_ROOT,name),'utf8')).replace(/from '([^']+)'/g,(_,specifier)=>`from '${pathToFileURL(resolve('island',specifier)).href}'`);
 return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
const {freshState,supportHeight,stepPlayer}=await runtimeModule('simulation.js'),{createFirstPersonMotion}=await runtimeModule('first-person-motion.js');
const data=createWorldData(),grid=new SpatialGrid(createColliders(data)),results=[];
for(const [name,x,z,yaw,duration] of [['tidal-descent',1210,220,Math.PI/2,10],['signal-hill',-406,-286,-Math.PI/2,5]]){
 const s={...freshState(),x,z,yaw,y:supportHeight(data,x,z)},motion=createFirstPersonMotion(),frames=[];let airborne=0,maxEyeDrop=0,maxFeetDrop=0,eye=motion.eyeHeight(s.y,true,1/60);
 for(let i=0;i<duration*60;i++){const y=s.y,oldEye=eye,m=stepPlayer(s,{forward:1,strafe:0},data,grid,1/60);eye=motion.eyeHeight(s.y,m.onGround,1/60);if(!m.onGround)airborne++;maxEyeDrop=Math.max(maxEyeDrop,oldEye-eye);maxFeetDrop=Math.max(maxFeetDrop,y-s.y);frames.push({x:s.x,z:s.z,y:s.y,eye,grounded:m.onGround,vy:s.vy});}
 results.push({name,airborne,maxEyeDrop,maxFeetDrop,start:[x,z],end:[s.x,s.z],frames});
}
const output=process.env.BLACKWATER_QA_OUTPUT||'output/playwright/blackwater-continuity/stairs';await mkdir(output,{recursive:true});await writeFile(output+'/report.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(({frames,...summary})=>summary),null,2));
