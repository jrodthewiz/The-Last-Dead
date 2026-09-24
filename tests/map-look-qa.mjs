import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const base=process.env.DEAD_ARRIVAL_URL||'http://127.0.0.1:5200/';
const output=process.env.MAP_LOOK_OUTPUT||'docs/map-iteration-03/after';
const floors=process.env.MAP_LOOK_FLOORS
 ?process.env.MAP_LOOK_FLOORS.split(',').map(value=>Number(value)).filter(value=>Number.isInteger(value)&&value>=0&&value<5)
 :[0,1,2,3,4];
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const report={url:base,errors:[],httpErrors:[],floors:[]};
page.on('pageerror',error=>report.errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
page.on('response',response=>{if(response.status()>=400)report.httpErrors.push({url:response.url(),status:response.status()});});
try{
 await page.goto(`${base}?debug=1&dungeon=1`,{waitUntil:'networkidle'});
 report.preClick=await page.evaluate(()=>({href:location.href,debug:!!window.__DEAD_ARRIVAL__,startButtons:document.querySelectorAll('[data-action="start"]').length,body:document.body?.innerText?.slice(0,160)}));
 await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__);
 await page.evaluate(()=>window.__DEAD_ARRIVAL__.begin(false));
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==='play',null,{timeout:120000});
 try {
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared,null,{timeout:60000});
 } catch (error) {
  report.startup=await page.evaluate(()=>({
   href:location.href,title:document.title,readyState:document.readyState,
   debug:!!window.__DEAD_ARRIVAL__,renderer:!!window.__DEAD_ARRIVAL__?.renderer,
   prepared:window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared,
   body:document.body?.innerText?.slice(0,500),
  }));
  await page.screenshot({path:`${output}/startup-failed.png`});
  throw error;
 }
 for(const index of floors){
  const data=await page.evaluate(async floor=>{
   const app=window.__DEAD_ARRIVAL__;
   const [{newRun,canStand},{makeDungeonCourse}]=await Promise.all([import('./engine.js'),import('./playground/map/dungeon-course.js')]);
   const course=makeDungeonCourse(floor);
   Object.assign(app.run,newRun(course),{mode:'ready',health:1000});
   app.renderer._firstCameraFrame=true;
   app.renderer.render(app.run,performance.now());
   await app.renderer._warmupPromise;
   app.renderer.render(app.run,performance.now()+16);
   const spawn={x:app.run.x,y:app.run.y,angle:app.run.angle};
   const room=course.rooms.find(item=>/arena|vault|hub|court/.test(item.kind))||course.rooms[1];
   const cells=[];
   const bounds=room.bounds;
   for(let z=bounds.minZ;z<bounds.maxZ;z++)for(let x=bounds.minX;x<bounds.maxX;x++){
    if(room.footprint?.[z-bounds.minZ]?.[x-bounds.minX]!=='1')continue;
    if(canStand(course,x+.5,z+.5,.1))cells.push({x:x+.5,y:z+.5});
   }
   const chosen=cells[Math.floor(cells.length/2)]||spawn;
   const heroRoom=course.rooms.find(item=>item.hero);
   const heroOpening=course.openings.find(item=>item.roomId===heroRoom?.id&&item.side==='s'&&item.kind!=='vent')
    ||course.openings.find(item=>item.roomId===heroRoom?.id&&item.kind!=='vent');
   const outer=heroOpening?.outerCells?.[Math.floor(heroOpening.outerCells.length/2)];
   const heroCenter=heroRoom?.center;
   const heroSpot=outer?{x:outer.x+.5,y:outer.y+.5}:spawn;
   const away=heroOpening?.side==='s'?{x:0,y:1}:heroOpening?.side==='n'?{x:0,y:-1}:
    heroOpening?.side==='e'?{x:1,y:0}:{x:-1,y:0};
   for(let step=1;step<=3;step++){
    const candidate={x:outer.x+.5+away.x*step,y:outer.y+.5+away.y*step};
    if(canStand(course,candidate.x,candidate.y,.1))Object.assign(heroSpot,candidate);
    else break;
   }
   return {id:course.id,spawn,room:room.id,roomSpot:chosen,
    heroRoom:heroRoom?.id,heroOpening:heroOpening?.id,heroSpot,heroCenter,
    initial:app.renderer._collectDiagnostics(app.run)};
  },index);
  await page.screenshot({path:`${output}/floor-${index+1}-entry.png`});
  const focal=await page.evaluate(({roomSpot,spawn})=>{
   const app=window.__DEAD_ARRIVAL__;
   const dx=roomSpot.x-spawn.x,dy=roomSpot.y-spawn.y;
   app.run.x=roomSpot.x;app.run.y=roomSpot.y;
   app.run.angle=Math.atan2(dy,dx);app.run.pitch=-.08;
   app.renderer._firstCameraFrame=true;
   app.renderer.render(app.run,performance.now()+48);
   return app.renderer._collectDiagnostics(app.run);
  },data);
  await page.screenshot({path:`${output}/floor-${index+1}-focal.png`});
  const hero=await page.evaluate(async ({heroSpot,heroCenter,heroOpening})=>{
   const app=window.__DEAD_ARRIVAL__;
   const {setDungeonOpeningOpen}=await import('./playground/map/dungeon-course.js');
   setDungeonOpeningOpen(app.run.course,heroOpening,true);
   app.run.x=heroSpot.x;app.run.y=heroSpot.y;
   app.run.angle=Math.atan2(heroCenter.y-heroSpot.y,heroCenter.x-heroSpot.x);
   app.run.pitch=0;
   app.renderer._firstCameraFrame=true;
   app.renderer.render(app.run,performance.now()+64);
   return app.renderer._collectDiagnostics(app.run);
  },data);
  await page.screenshot({path:`${output}/floor-${index+1}-hero.png`});
  report.floors.push({...data,focal,hero});
 }
 assert.deepEqual(report.errors,[]);
 assert.deepEqual(report.httpErrors,[]);
 console.log(JSON.stringify({ok:true,floors:report.floors.map(f=>({id:f.id,room:f.room,calls:f.focal.calls,triangles:f.focal.gpuTriangles})),errors:report.errors,httpErrors:report.httpErrors}));
}finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();}
