import {hasAmmoSpace,supplyAmmo} from './armory-state.js';
// Authored destinations and connecting walking loops. The terrain, ecology,
// map and discovery system all read this single plan.
export const CONTACT={id:'elias',name:'Elias · coast radio operator',x:-762,z:291};
export const PLACES=[
 {id:'churchyard',name:'Saint Brigid’s churchyard',x:-590,z:-70,radius:25,note:'The unlisted names',text:'The caretaker stopped carving dates. On the last page of the burial register, someone has written: “They answer the bells. Leave the road quiet.” A dry medical tin remains beneath the desk.',reward:'medical'},
 {id:'lookout',name:'Cormorant lookout',x:-935,z:-45,radius:19,note:'The western way',text:'A ranger’s map marks the Western Trail in faded blue. It circles the island and rejoins Cape Road below Westlight. The bridge is visible from the eastern headland; there is always another way around the dead.',reward:'ammo'},
 {id:'quarry',name:'Briar cutting',x:-245,z:-185,radius:24,note:'The last work shift',text:'The foreman ordered everyone downhill before the broadcast failed. The workers left their tools, timber braces and a sealed supply box. This old cutting reconnects Signal Hill to the bridge road.',reward:'ammo'},
 {id:'memorial',name:'The quiet garden',x:734,z:-45,radius:14,note:'A place held open',text:'The city left these benches for the families arriving from the island. The flowers are dry. A note on the medical box says: “Leave something for the next person.” Elias will have heard you once a station is restored.',reward:'medical'},
 {id:'market',name:'Evacuation exchange',x:1122,z:278,radius:19,note:'One boat left',text:'An evacuation manifest lists blankets, water and fuel. Beside the crossed-out departures: “The last ferry stays until all three stations answer.” The dock workers left ammunition for whoever made the crossing.',reward:'ammo'},
];
export const TRAILS=[
 {name:'Churchyard loop',width:2.6,points:[[-470,-35],[-525,-45],[-565,-82],[-590,-70],[-635,-45],[-710,60]]},
 {name:'Cormorant loop',width:2.4,points:[[-910,40],[-936,0],[-935,-45],[-890,-85],[-860,-100]]},
 {name:'Briar cutting',width:2.8,points:[[-370,-120],[-315,-145],[-245,-185],[-190,-130],[-165,0]]},
];
export function trailDistance(x,z){let nearest=Infinity;for(const trail of TRAILS)for(let i=1;i<trail.points.length;i++){const a=trail.points[i-1],b=trail.points[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));nearest=Math.min(nearest,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)-trail.width/2);}return nearest;}
export function reservedPlace(x,z,margin=0){return PLACES.some(p=>Math.hypot(p.x-x,p.z-z)<p.radius+margin)||Math.hypot(x-CONTACT.x,z-CONTACT.z)<5+margin||trailDistance(x,z)<1.4+margin;}
export function discoverPlaces(state){const found=[];for(const p of PLACES)if(!state.discovered.includes(p.id)&&Math.hypot(state.x-p.x,state.z-p.z)<p.radius){state.discovered.push(p.id);found.push(p);}return found;}
export function contactResponse(state){const n=state.relays.length;return [
 'I kept the receiver running. Nothing but static. The keeper left a spare fuse in his workshop; the hill station can reach the mainland. Take what you need from my box. Quiet steps carry farther than you think.',
 'I heard your signal. One voice through all that static. I have lit the shelter lamp and put aside another supply ration. Keep going; the city must still have power somewhere.',
 'Two stations answering. I heard someone at the docks. They are waiting for the hospital broadcast before bringing the ferry in. Your next ration is ready.',
 'All three stations. The captain answered by name. You brought this coast back within reach of someone. Take the last ration and follow the waterfront to the ferry.',
 ][Math.min(3,n)];}
export function claimContactSupply(state){const stage=state.relays.length;if(state.contactStage>=stage||state.medkits>=20&&!hasAmmoSpace(state))return false;state.contactStage=stage;state.medkits=Math.min(20,state.medkits+1);return true;}

// Copying a note and collecting its supply are separate decisions. Pending
// markers preserve unclaimed tins in existing saves; old copied notes stay claimed.
export function claimNoteSupply(state,record){
 const medical=record.reward==='medical',marker='pending-'+record.reward+'-'+record.id,pending=state.collected.includes(marker);
 if(state.records.includes(record.id)&&!pending)return {status:'claimed',items:[]};
 const fits=medical?state.medkits<20:hasAmmoSpace(state);
 if(!fits){if(!pending)state.collected.push(marker);return {status:'full',items:[]};}
 const items=medical?(state.medkits++,[{id:'dressing',count:1}]):supplyAmmo(state);
 if(pending)state.collected.splice(state.collected.indexOf(marker),1);return {status:'recovered',items};
}
export const claimMedicalNote=(state,record)=>claimNoteSupply(state,record).status;
