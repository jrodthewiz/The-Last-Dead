import {PLACES} from './places.js';
import {domesticProfile} from './domestic-profile.js';

// Every container has stable contents and identity. Searching reveals that
// inventory once; taking only what fits leaves the rest in the world.
export function createLootPlan(data,grid,floorAt){
 const result=[];
 const themes=[['Linen trunk','trunk',{cloth:3,bandage:1}],['Pantry crate','crate',{beer:2,cloth:1}],['Tool chest','chest',{scrap:4,'ammo-carbine':8}],['Medical satchel','bag',{antiseptic:2,bandage:1}],['Evacuation bag','bag',{beer:1,scrap:3,'ammo-ossuary':6}],['Transit equipment','chest',{'ammo-arc':2,'ammo-reliquary':1,antiseptic:1,scrap:2}]];
 const rare={lookout:'mourning',quarry:'chainsaw',memorial:'ossuary',market:'carrion'};
 const add=(id,x,z,theme)=>{const [name,kind,loot]=theme;result.push({id:'stash-'+id,name,kind,x,z,y:floorAt(x,z),loot:{...loot,...(rare[id]?{['weapon-'+rare[id]]:1}:{})}});};
 for(const [i,b]of data.buildings.filter(b=>b.enterable).entries()){
  const household=domesticProfile(b);
  if(household){result.push({id:'stash-'+b.id,name:household.name,kind:household.container,x:household.x,z:household.z,y:household.y,household:household.kind,loot:{...household.loot}});continue;}
  const candidates=[[b.x+3,b.z+b.d/2-2],[b.x-3,b.z+b.d/2-2],[b.x+b.w/2-2,b.z+1],[b.x-b.w/2+2,b.z+1]];
  const p=candidates.find(([x,z])=>!grid.blocked(x,z,b.baseY+.2,.7)&&Math.abs(floorAt(x,z)-(b.baseY+.2))<.12);if(!p)continue;
  const theme=b.id==='clinic'?['Ward supply chest','chest',{bandage:3,antiseptic:2,cloth:2}]:b.id==='lightkeeper'?['Keeper’s ammunition','chest',{'ammo-mourning':10,scrap:3}]:b.id==='orchard-house'?['Orchard tool chest','chest',{'ammo-chainsaw':35,scrap:4}]:themes[i%themes.length];add(b.id,...p,theme);
 }
 for(const [i,p]of PLACES.entries()){
  for(const [dx,dz]of [[3,2],[-3,2],[2,-3],[-2,-3]]){const x=p.x+dx,z=p.z+dz,y=floorAt(x,z);if(!grid.blocked(x,z,y,.8)){add(p.id,x,z,i%2?['Trail ammunition','chest',{'ammo-breach':6,'ammo-carbine':12,scrap:3}]:['Forgotten provisions','bag',{bandage:2,beer:2,cloth:2}]);break;}}
 }
 for(const [i,c]of data.parkedCars.entries())if(i%3===0){for(const side of [-1,1]){const x=c.x+side*3.4,z=c.z,y=floorAt(x,z);if(y>1&&!grid.blocked(x,z,y,.8)){add('road-'+i,x,z,i%2?['Roadside fuel tin','chest',{'ammo-chainsaw':25,'ammo-carrion':20,scrap:2}]:['Abandoned luggage','bag',{beer:1,bandage:1,cloth:2}]);break;}}}
 return result;
}
