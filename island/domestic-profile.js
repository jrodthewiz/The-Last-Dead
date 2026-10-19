// The same household identity chooses its visual cues and unopened supplies.
// Saved, partly emptied containers retain their existing remaining inventory.
export function domesticProfile(b){
 if(b.district!=='village'||['arrival-house','lightkeeper'].includes(b.id))return null;
 const kind=b.id==='building-7'||b.id==='orchard-house'?'workshop':b.id==='building-8'?'remedies':['pantry','linen','remedies'][b.seed%3];
 const profiles={
  pantry:{kind,name:'Pantry provisions',container:'crate',colour:0x997b55,loot:{beer:2,cloth:1}},
  linen:{kind,name:'Household linen',container:'trunk',colour:0x849580,loot:{cloth:3,bandage:1}},
  remedies:{kind,name:'Family medical satchel',container:'bag',colour:0x8d6d5b,loot:{antiseptic:2,bandage:1}},
  workshop:{kind,name:b.id==='orchard-house'?'Orchard tool chest':'Boatwright’s tool chest',container:'chest',colour:0x687f76,loot:b.id==='orchard-house'?{'ammo-chainsaw':35,scrap:4}:{scrap:4,'ammo-carbine':8}},
 };
 return {...profiles[kind],x:b.x+3,z:b.z+b.d/2-1.1,y:b.baseY+.92};
}
