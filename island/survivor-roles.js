// Human refuges are sparse, fixed stations. Their work never owns navigation
// or blocks the entry routes, and each supply can be claimed only once.
export const SURVIVORS=[
 {id:'mara',name:'Mara · boatwright',place:'ALDER VILLAGE · REPAIR YARD',x:-541,z:175.94,yaw:0,role:'boatwright',reward:'ammo',service:'Take the salvaged ammunition',palette:[0x829292,0xa28d6c,0x747f68,0x4b5148]},
 {id:'iven',name:'Iven · clinic attendant',place:'NORTHPOINT · CLINIC',x:952.48,z:-301,yaw:-Math.PI/2,role:'attendant',reward:'medical',service:'Take a clean field dressing',palette:[0xaeb8a7,0xc4ba9d,0x748c89,0x4b5550]},
];
export function survivorResponse(person,state){
 if(person.id==='mara')return state.relays.length?'I heard Elias on the receiver. There are still people out there. The seams will hold now; the tide is all we are waiting for. Stay on the churchyard path if the road fills up.':'The hull is sound. It is the seams that need patience. I found a dry ammunition tin under the old seats; take it. The churchyard path circles behind the village, away from the road. Elias is keeping the radio alive south of here.';
 return state.generatorReady?'The generator is holding. I can keep the dressings dry again. The hospital transmitter is the next thing to wake; after that, someone at the docks might finally hear us.':'I have cleaned this bed three times today. It is easier than looking at the empty ones. There is a generator in the courtyard east of here. Stay with it until it catches, then try the hospital transmitter. Take a dressing before you go.';
}
export function claimSurvivorSupply(state,person){const id='survivor-'+person.id;if(state.collected.includes(id))return false;state.collected.push(id);if(person.reward==='medical')state.medkits=Math.min(20,state.medkits+1);return true;}
