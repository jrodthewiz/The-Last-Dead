import {readFileSync,writeFileSync} from 'node:fs';
import {makeDungeonCourse} from '../../../playground/map/dungeon-course.js';
import {canStand} from '../../../engine.js';
const file='promotion/descent-film/.tesseract-work/shots.json';
const shots=JSON.parse(readFileSync(file,'utf8'));
const fixes=[];
for(const s of shots){
 const c=makeDungeonCourse(s.floor);
 const valid=(dx,dy)=>Array.from({length:41},(_,i)=>i/40).every(u=>canStand(c,s.from[0]+(s.to[0]-s.from[0])*u+dx,s.from[1]+(s.to[1]-s.from[1])*u+dy,.10));
 if(!valid(0,0)){
  const choices=[];for(let x=-12;x<=12;x++)for(let y=-12;y<=12;y++){const dx=x*.15,dy=y*.15;if(valid(dx,dy))choices.push({dx,dy,d:dx*dx+dy*dy});}
  choices.sort((a,b)=>a.d-b.d);if(!choices.length)throw new Error('No clear camera path: '+s.name);
  const {dx,dy}=choices[0];fixes.push({shot:s.name,offset:[dx,dy]});s.from[0]+=dx;s.to[0]+=dx;s.from[1]+=dy;s.to[1]+=dy;
 }
}
writeFileSync(file,JSON.stringify(shots,null,2));
writeFileSync('promotion/descent-film/.tesseract-work/camera-path-check.json',JSON.stringify({samplesPerShot:41,radiusCells:.1,allPathsClear:true,fixes},null,2));
console.log(JSON.stringify(fixes));
