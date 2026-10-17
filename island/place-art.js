import {PLACES,TRAILS,CONTACT} from './places.js';
import {terrainHeight,roadAt} from './data.js';

// Deliberately constructed low-poly scene kits. Different room functions have
// different silhouettes; every entry and interaction lane remains unobstructed.
export function placeDetails(scene,k,data,sign){
 const y=(x,z)=>terrainHeight(x,z);
 for(const p of PLACES){sign(scene,p.name.toUpperCase(),p.x,y(p.x,p.z)+2.2,p.z-3,8,0);for(const dx of [-3.6,3.6])k.box(p.x+dx,y(p.x+dx,p.z-3)+1.1,p.z-3,.16,2.2,.16,0x665f46);}
 // Trail markers sit to the side of the walkable strip and follow terrain.
 for(const t of TRAILS)for(let i=0;i<t.points.length;i++){const [x,z]=t.points[i];k.box(x+2.5,y(x+2.5,z)+.65,z,.14,1.3,.14,0x6b6149);k.box(x+2.5,y(x+2.5,z)+1.17,z,.17,.22,.17,0x8ca9a1);if(i===0){sign(scene,t.name.toUpperCase(),x+5,y(x+5,z)+1.8,z,5,0);}}
 // A ranger's shaded observation shelter with uninterrupted sea sightlines.
 const p=PLACES[1];for(const dx of [-4,4])for(const dz of [-3,3])k.rod([p.x+dx,y(p.x+dx,p.z+dz),p.z+dz],[p.x+dx,y(p.x,p.z)+4,p.z+dz],.14,0x655d45);k.box(p.x,y(p.x,p.z)+4.1,p.z,10,.3,8,0x5c766c);
 // The abandoned cutting reads as a work site, with timber stacks and braces.
 const q=PLACES[2];for(let i=0;i<7;i++){const x=q.x-10+i*1.3,z=q.z-9;k.rod([x,y(x,z)+.4,z-5],[x,y(x,z)+.4,z+5],.4,0x7c7353);}for(const side of [-1,1]){const x=q.x+side*12,z=q.z+2;k.rod([x,y(x,z),z],[x,y(x,z)+5,z],.22,0x635b44);k.rod([x,y(x,z)+4.6,z],[x-side*3,y(x-side*3,z+3),z+3],.16,0x7d7252);}
 // A market that stopped mid-evacuation: two stalls leave a broad centre lane.
 const m=PLACES[4];for(const side of [-1,1]){const x=m.x+side*9,z=m.z;for(const dx of [-3,3])for(const dz of [-3,3])k.box(x+dx,15.5,z+dz,.14,3,.14,0x645e47);k.box(x,17.1,z,7,.15,7,side<0?0x9a795b:0x647e74);k.box(x,14.9,z,6,.16,1.5,0x7b694c);for(let j=0;j<5;j++)k.box(x-2+j,15.2,z,.65,.4,.6,j%2?0xacac7b:0x788b65);}
 // Operator's radio table and a pole-mounted shelter lamp, beside the fire.
 const n=CONTACT,ny=y(n.x,n.z);k.box(n.x-1.4,ny+.85,n.z-1.1,1.7,.16,1,0x78674b);for(const dx of [-2.05,-.75])k.box(n.x+dx,ny+.4,n.z-1.1,.1,.8,.8,0x4e6052);k.box(n.x-1.4,ny+1.1,n.z-1.1,.95,.36,.55,0x3e5752);k.rod([n.x-1.6,ny+1.25,n.z-1.1],[n.x-1.6,ny+2.2,n.z-1.1],.018,0xa1aa8b);k.box(n.x+2.3,ny+1.5,n.z,.12,3,.12,0x5f6046);
}
