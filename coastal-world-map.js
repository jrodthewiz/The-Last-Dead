import {capeStreamZ,capeStreamWidth} from './coastal-terrain.js';
export function coastalTarget(run){
 const coast=run.course.coastal;if(!coast)return null;
 const landmark=coast.landmarks.find(p=>p.id===run.coastalDestination);if(landmark)return landmark;
 const station=coast.workbenches?.find(p=>`bench-${p.id}`===run.coastalDestination);
 return station?{id:run.coastalDestination,name:`${station.name} / repair bench`,...station.approach}:null;
}
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function coastalMapSvg(run,nav){
 const c=run.course,w=c.coastal;
 const land=w.land.map(p=>`<rect x="${p.x-p.width/2}" y="${p.z-p.depth/2}" width="${p.width}" height="${p.depth}"/>`).join('');
 const roads=w.roads.map(p=>`<rect x="${p.x-p.width/2}" y="${p.z-p.depth/2}" width="${p.width}" height="${p.depth}"/>`).join('');
 const buildings=c.buildings.map((p,i)=>`<rect x="${p.x*4}" y="${p.y*4}" width="${p.w*4}" height="${p.h*4}"/><text x="${(p.x+p.w/2)*4}" y="${(p.y+p.h/2)*4+2}" fill="#dce0c1" stroke="none" font-size="7" text-anchor="middle">${i+1}</text>`).join('')+w.buildings.map(p=>`<rect x="${p.collision.minX}" y="${p.collision.minZ}" width="${p.collision.maxX-p.collision.minX}" height="${p.collision.maxZ-p.collision.minZ}"/>`).join('');
 const route=nav?`<polyline points="${[run,...nav.points].map(p=>`${p.x*4},${p.y*4}`).join(' ')}" fill="none" stroke="#f2c176" stroke-width="1.5" stroke-dasharray="3 2"/>`:'';
 const river=w.terrain?`<path d="${Array.from({length:39},(_,i)=>`${i?'L':'M'}${128+i*8},${capeStreamZ(128+i*8)}`).join(' ')}" fill="none" stroke="#6e9fa2" stroke-width="${capeStreamWidth(280)*2}"/><text x="292" y="337" font-size="6" fill="#d0d2b7">CAPE FOREST</text>`:'';
 const pins=w.landmarks.map((p,i)=>`<g transform="translate(${p.x*4} ${p.y*4})"><circle r="5.5" fill="${run.coastalDestination===p.id?'#f2c176':'#233e3d'}" stroke="#f2c176"/><text text-anchor="middle" y="2" font-size="6" fill="${run.coastalDestination===p.id?'#172523':'#f2c176'}">${String.fromCharCode(65+i)}</text><title>${safe(p.name)}</title></g>`).join('');
 const weapons=c.weaponPickups.filter(p=>!run.backpack.weaponPickups?.includes(p.id)).map(p=>`<circle cx="${p.x*4}" cy="${p.y*4}" r="1.7" fill="#f2c176"/>`).join('');
 const supplies=(c.scavengerPickups||[]).filter(p=>p.visualKind==='supply-case'&&!run.backpack.collected?.includes(p.id)).map(p=>`<path d="M-1.7,-.7H-.7V-1.7H.7V-.7H1.7V.7H.7V1.7H-.7V1.7H-.7V.7H-1.7Z" fill="#b4d3ba" transform="translate(${p.x*4} ${p.y*4})"><title>${safe(p.label)}</title></path>`).join('');
 const selected=coastalTarget(run);
 const repairPin=selected&&!w.landmarks.some(p=>p.id===selected.id)?`<circle cx="${selected.x*4}" cy="${selected.y*4}" r="3" fill="#f2c176"><title>${safe(selected.name)}</title></circle>`:'';
 const doors=c.harborRooms.map(p=>`<rect x="${p.door.x*4-1}" y="${p.door.y*4-1}" width="2" height="2" fill="#a8d9b7"/>`).join('');
 const labels=[['BLACKWATER',64,7],['SALTWIND',250,7],['EAST WORKS',280,125],['LIGHTHOUSE CAPE',250,243]].map(([name,x,y])=>`<text x="${x}" y="${y}" font-size="6" text-anchor="middle" fill="#d0d2b7">${name}</text>`).join('');
 return `<svg class="harbor-field-map coastal-field-map" viewBox="-12 -14 ${w.width+24} ${w.depth+36}" role="img" aria-label="Blackwater open coast map: harbor, Saltwind, East Works, lighthouse, weapons, truck and walking route"><rect x="-12" y="-14" width="${w.width+24}" height="${w.depth+36}" rx="3" fill="#183d47"/><g fill="#3e5045" stroke="#a1aaa0" stroke-width="1">${land}</g><g fill="#718077">${roads}</g><g fill="#1c3029" stroke="#86957a" stroke-width=".4">${buildings}</g>${river}${route}${doors}${weapons}${supplies}${repairPin}${pins}${labels}<text x="52" y="190" fill="#8db4bc" font-size="8" text-anchor="middle">BLACKWATER</text><text x="52" y="202" fill="#8db4bc" font-size="8" text-anchor="middle">INLET</text><rect x="${run.vehicle.x*4-2}" y="${run.vehicle.y*4-1}" width="4" height="2" fill="#c8e5ed"/><path d="M4,0 -3,-3 -1,0 -3,3Z" fill="#fff4c9" stroke="#101a17" stroke-width=".8" transform="translate(${run.x*4} ${run.y*4}) rotate(${run.angle*180/Math.PI})"/><path d="M${c.exit.x*4},${c.exit.y*4}v-7h5l-2,2 2,2h-5" fill="#a8d9b7" stroke="#a8d9b7"/><path d="M12,330h50m-50,-2v4m50,-4v4" stroke="#bed1c8"/><text x="37" y="338" text-anchor="middle" fill="#bed1c8" font-size="5">50 METRES</text><text x="${w.width-26}" y="${w.depth+14}" fill="#bed1c8" font-size="7">N ↑</text></svg>`;
}
