import {PLACES} from './places.js';
import {terrainHeight} from './data.js';
import * as T from '../vendor/three.module.js';

export const FLIGHT_VIEWS=[
 {name:'Island overview',pose:[-1030,310,620,-320,35,-40]},
 {name:'Village & terrain',pose:[-495,48,260,-390,25,120]},
 {name:'Westlight coast',pose:[-890,100,-130,-800,40,-275]},
 {name:'Bridge crossing',pose:[90,65,130,380,24,0]},
 {name:'City skyline',pose:[525,155,220,850,40,-180]},
 {name:'Old Town street',pose:[469,16,6,850,20,6]},
 {name:'Hospital district',pose:[989,32,-240,960,25,-330]},
 {name:'East Docks',pose:[1260,70,430,1160,20,260]},
 ...PLACES.map(p=>({name:p.name,pose:[p.x+21,terrainHeight(p.x,p.z)+17,p.z+30,p.x,terrainHeight(p.x,p.z)+1,p.z]})),
 {name:'Village working yards',pose:[-550,25,204,-522,18,178]},
 {name:'Bookshop & workshop block',pose:[475,16.2,-4,565,17,-23]},
 {name:'Netmakers’ tidal landing',pose:[1300,6,240,1274,1,220]},
];
const quantile=(values,q)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*q))]||0;};
export function createFlight(renderer,camera){
 let active=false,from='title',position=new T.Vector3(),yaw=0,pitch=0,speed=65,samples=[],latest=null,benchmark=null,report=null;
 const panel=document.getElementById('flight-panel'),stats=document.getElementById('flight-stats'),status=document.getElementById('flight-status'),select=document.getElementById('flight-location');
 for(const [i,v] of FLIGHT_VIEWS.entries()){const option=document.createElement('option');option.value=i;option.textContent=v.name;select.append(option);}select.onchange=()=>jump(Number(select.value));document.getElementById('flight-benchmark').firstChild.textContent=`Run ${FLIGHT_VIEWS.length}-view survey `;
 const pose=(p)=>{position.set(...p.slice(0,3));yaw=Math.atan2(p[3]-p[0],-(p[5]-p[2]));pitch=Math.atan2(p[4]-p[1],Math.hypot(p[3]-p[0],p[5]-p[2]));samples=[];};
 function jump(i){pose(FLIGHT_VIEWS[i].pose);select.value=i;}
 function startBenchmark(){if(benchmark)return;report=null;benchmark={index:0,time:0,samples:[],calls:[],triangles:[],rows:[],restore:{position:position.clone(),yaw,pitch,selected:select.value}};jump(0);document.getElementById('flight-export').disabled=true;status.textContent=`Surveying ${FLIGHT_VIEWS.length} views · 1.5 s warm-up + 2.5 s measurement per view`;}
 function summary(){const median=quantile(samples,.5),p95=quantile(samples,.95);return {medianMs:median,p95Ms:p95,fps:median?1000/median:0,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,width:renderer.domElement.width,height:renderer.domElement.height};}
 function finish(){const gl=renderer.getContext(),extension=gl.getExtension('WEBGL_debug_renderer_info');report={date:new Date().toISOString(),renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),resolution:[renderer.domElement.width,renderer.domElement.height],method:'Fixed camera survey; combat paused; 1.5 seconds warm-up then 2.5 seconds of actual requestAnimationFrame intervals per view. Shader/upload warm-up excluded. Frame time includes browser scheduling; not a GPU timer or a universal performance guarantee.',views:benchmark.rows};position.copy(benchmark.restore.position);yaw=benchmark.restore.yaw;pitch=benchmark.restore.pitch;select.value=benchmark.restore.selected;samples=[];latest=null;benchmark=null;status.textContent=`Survey complete · worst p95 ${Math.max(...report.views.map(r=>r.p95Ms)).toFixed(1)} ms · export the measurements`;document.getElementById('flight-export').disabled=false;}
 document.getElementById('flight-benchmark').onclick=startBenchmark;document.getElementById('flight-export').onclick=()=>{if(!report)return;const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='blackwater-flight-survey.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);};
 return {get active(){return active;},get from(){return from;},get report(){return report;},get benchmark(){return benchmark;},get pose(){return {x:position.x,y:position.y,z:position.z,yaw,pitch,speed};},startBenchmark,jump,metrics:summary,
   enter(mode){from=mode;active=true;position.copy(camera.position);yaw=-camera.rotation.y;pitch=camera.rotation.x;samples=[];panel.hidden=false;status.textContent='Survival paused · your survivor stays where you left them';if(mode==='title')jump(0);},exit(){active=false;panel.hidden=true;benchmark=null;return from;},look(dx,dy){if(benchmark)return;yaw+=dx*.002;pitch=T.MathUtils.clamp(pitch-dy*.002,-1.5,1.5);},zoom(delta){speed=T.MathUtils.clamp(speed*Math.exp(-delta*.001),5,450);},
   update(dt,raw,keys){if(!active)return;if(benchmark){const b=benchmark;b.time+=raw;if(b.time>1.5){b.samples.push(raw*1000);b.calls.push(renderer.info.render.calls);b.triangles.push(renderer.info.render.triangles);}if(b.time>=4){b.rows.push({name:FLIGHT_VIEWS[b.index].name,frames:b.samples.length,medianMs:quantile(b.samples,.5),p95Ms:quantile(b.samples,.95),maxMs:Math.max(...b.samples),drawCalls:Math.max(...b.calls),triangles:Math.max(...b.triangles)});if(++b.index>=FLIGHT_VIEWS.length)finish();else{b.time=0;b.samples=[];b.calls=[];b.triangles=[];jump(b.index);status.textContent=`Survey ${b.index+1} / ${FLIGHT_VIEWS.length} · ${FLIGHT_VIEWS[b.index].name}`;}}}
     else{const boost=keys.has('ShiftLeft')||keys.has('ShiftRight')?4:1,f=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),s=Number(keys.has('KeyD'))-Number(keys.has('KeyA')),v=Number(keys.has('KeyE')||keys.has('Space'))-Number(keys.has('KeyQ')||keys.has('ControlLeft')),n=Math.max(1,Math.hypot(f,s,v)),amount=speed*boost*dt/n;position.x+=(Math.sin(yaw)*f*Math.cos(pitch)+Math.cos(yaw)*s)*amount;position.z+=(-Math.cos(yaw)*f*Math.cos(pitch)+Math.sin(yaw)*s)*amount;position.y+=(v+Math.sin(pitch)*f)*amount;position.y=T.MathUtils.clamp(position.y,-5,1600);position.x=T.MathUtils.clamp(position.x,-3000,3000);position.z=T.MathUtils.clamp(position.z,-2400,2400);}
     camera.position.copy(position);camera.rotation.set(pitch,-yaw,0,'YXZ');camera.fov=65;camera.updateProjectionMatrix();samples.push(raw*1000);if(samples.length>180)samples.shift();const current=Math.floor(performance.now()/300);if(current!==latest){latest=current;const m=summary();stats.textContent=`${m.fps.toFixed(0)} fps · p95 ${m.p95Ms.toFixed(1)} ms\n${m.drawCalls} draws · ${(m.triangles/1e6).toFixed(2)} M triangles\n${m.width} × ${m.height} · ${m.textures} textures\n${Math.round(position.x)}, ${Math.round(position.y)}, ${Math.round(position.z)} m · ${Math.round(speed)} m/s`;}}
 };
}
