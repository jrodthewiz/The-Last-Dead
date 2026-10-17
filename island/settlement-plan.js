// Small authored places: the same footprints drive scenery reservations,
// visible construction, movement support and collision.
export const FRONTAGES={'building-54':'arcade','building-55':'residence','building-78':'workshop'};
export const YARDS=[{id:'boat-repair',house:'building-7',x:-537,z:178,w:12,d:18},{id:'kitchen-garden',house:'building-8',x:-502,z:181,w:14,d:18}];
export const LANDING={start:1210,end:1266,z:220,width:4.8,deckX:1274,deckZ:220,deckW:16,deckD:14,deckY:1.15,boatX:1288,boatZ:221};
export function settlementReserved(x,z,margin=0){return YARDS.some(p=>Math.abs(x-p.x)<p.w/2+margin&&Math.abs(z-p.z)<p.d/2+margin)||(x>1208-margin&&x<1283+margin&&Math.abs(z-220)<9+margin);}
export function stairTop(x,terrain){const i=Math.max(0,Math.min(55,Math.floor(x-LANDING.start)));return Math.max(LANDING.deckY,terrain(LANDING.start+i,LANDING.z),terrain(LANDING.start+i+1,LANDING.z))+.16;}
export function settlementSupport(x,z,terrain){const p=LANDING;if(x>=p.start&&x<=p.end&&Math.abs(z-p.z)<=p.width/2)return stairTop(x,terrain);if(Math.abs(x-p.deckX)<=p.deckW/2&&Math.abs(z-p.deckZ)<=p.deckD/2)return p.deckY;return -Infinity;}
export function gardenBed(z,terrain){const heights=[-504.65,-499.35].flatMap(x=>[z-1.4,z+1.4].map(zz=>terrain(x,zz)));return {top:Math.max(...heights)+.16,bottom:Math.min(...heights)-.15};}
export function settlementColliders(data,terrain){
 const boxes=[],add=(id,x,z,w,d,y,h)=>boxes.push({id,x,z,w,d,y,h});
 add('repair-dinghy',-537,178,2.3,6.3,terrain(-537,178),2.1);add('repair-bench',-541,175,2.7,1.1,terrain(-541,175),1.1);
 add('garden-fuel',-497,185,2.8,1.2,terrain(-497,185),1.2);
 for(const z of [180,185]){const b=gardenBed(z,terrain);add('terraced-garden-bed',-502,z,5.4,2.9,b.bottom,b.top-b.bottom+.16);}
 for(const x of [-506,-499])add('drying-post',x,174,.15,.15,terrain(x,174),3.4);
 for(const b of data.buildings){if(FRONTAGES[b.id]!=='arcade')continue;for(const dx of [-9.6,-3.2,3.2,9.6])add('arcade-pier',b.x+dx,b.z+b.d/2+2.5,.44,.52,b.baseY,3.1);}
 const p=LANDING;for(let x=p.start;x<p.end;x+=4)for(const side of [-1,1])add('landing-stair-rail',x+2,p.z+side*(p.width/2+.13),4,.18,stairTop(x+2,terrain),1.1);
 for(const z of [213,227])add('landing-edge',1274,z,16,.18,p.deckY,1.05);
 add('moored-fishing-boat',p.boatX,p.boatZ,3.4,10.1,-.8,4.3);
 add('net-rack',1276,226,4.4,.6,p.deckY,2.6);add('fish-baskets',1270,225,2.6,1.4,p.deckY,.9);
 return boxes;
}
