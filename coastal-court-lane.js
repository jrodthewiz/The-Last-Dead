import {capeGroundHeight} from './coastal-terrain.js';
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
export const COURT_LANE_DOMAIN=Object.freeze({minX:240,maxX:360,minZ:260,maxZ:276});
const sites=[["coast-tree-108",249,263,9,0.3,"deciduous",94108],["coast-tree-109",270,273,11,0.34,"conifer",94109],["coast-tree-110",291,263,9.5,0.32,"deciduous",94110],["coast-tree-111",318,273,9,0.3,"deciduous",94111],["coast-tree-112",338,263,12,0.36,"conifer",94112],["coast-tree-113",353,273,9.5,0.32,"deciduous",94113],["cape-forest-court-lane-0",257,273,9,0.3,"deciduous",94200],["cape-forest-court-lane-1",278,263,10,0.33,"deciduous",94201],["cape-forest-court-lane-2",302,273,10,0.33,"deciduous",94202],["cape-forest-court-lane-3",321,263,11.5,0.35,"conifer",94203],["cape-forest-court-lane-4",340,273,9,0.3,"deciduous",94204],["cape-forest-court-lane-5",347,263,10,0.33,"deciduous",94205],["cape-forest-court-lane-6",355,263,9,0.3,"deciduous",94206],["cape-forest-court-lane-7",245,273,8,0.28,"deciduous",94207]];
const members=[['coast-tree-108','cape-forest-court-lane-0','cape-forest-court-lane-7'],['coast-tree-109','cape-forest-court-lane-1'],['coast-tree-110','cape-forest-court-lane-2'],['coast-tree-111','cape-forest-court-lane-3'],['coast-tree-112','coast-tree-113','cape-forest-court-lane-4','cape-forest-court-lane-5','cape-forest-court-lane-6']];
const rect=(id,minX,maxX,minZ,maxZ)=>({id,minX,maxX,minZ:Math.min(minZ,maxZ),maxZ:Math.max(minZ,maxZ)});
export const courtRectDistance=(x,z,r)=>Math.hypot(Math.max(r.minX-x,0,x-r.maxX),Math.max(r.minZ-z,0,z-r.maxZ));
export function makeCourtLanePlan(coastal){
 const access=[rect('main-lane',240,360,266,270),rect('crossing',360,384,266,270)];
 for(const p of coastal.blackwaterSlice.interiors)if(p.id.startsWith('coast-lot-4-1-')&&p.rearDoor)access.push(rect(p.id+'-rear-spur',p.rearDoor.x-2,p.rearDoor.x+2,p.rearDoor.z,268));
 for(const [i,a]of coastal.neighborhoods.alleys.filter(a=>a.zone==='coastal-park'&&a.width===4&&a.x>240&&a.x<360&&a.z>=240&&a.z<=296).entries())access.push(rect('side-passage-'+i,a.x-2,a.x+2,a.z-a.depth/2,a.z+a.depth/2));
 const buildings=coastal.buildings.map(b=>({...b.collision,id:b.id})).filter(b=>b.maxX>=240&&b.minX<=360&&b.maxZ>=260&&b.minZ<=276);
 const trees=sites.map(([id,x,z,height,collisionRadius,species,seed])=>({id,x,z,y:capeGroundHeight(x,z),height,collisionRadius,species,seed,habitat:'court-lane',community:'court-lane'}));
 const old=coastal.forestPlacements.find(t=>t.id==='cape-forest-court-3');if(!old)throw new Error('Court lane requires registered original court tree3');
 const relocation={...old,x:345,z:263,y:capeGroundHeight(345,263)};
 const overrides=new Map([...trees.filter(t=>t.id.startsWith('coast-tree-')),relocation].map(t=>[t.id,t]));
 const finalTrees=[...coastal.forestPlacements.map(t=>overrides.get(t.id)||t),...trees.filter(t=>t.id.startsWith('cape-forest-court-lane-'))];
 const trunks=finalTrees.filter(t=>t.x>=235&&t.x<=365&&t.z>=255&&t.z<=281).map(t=>({id:t.id,x:t.x,z:t.z,collisionRadius:t.collisionRadius}));
 return freeze({trunks,domain:{...COURT_LANE_DOMAIN},access,buildings,trees,relocation,communities:members.map((ids,i)=>({id:['court-west','court-inner-west','court-middle','court-inner-east','court-mouth'][i],treeIds:ids,trees:trees.filter(t=>ids.includes(t.id))})),benches:[{id:'coast-bench-114',x:250,z:273,baseY:-.05},{id:'coast-bench-117',x:350,z:273,baseY:-.05}],retiredBenchIds:['coast-bench-115','coast-bench-116']});
}
export function courtLaneAccessAt(plan,x,z,padding=0){return plan.access.some(r=>courtRectDistance(x,z,r)<=padding);}
export function courtLaneSoilAt(plan,x,z,radius=0){const d=plan.domain;return x-radius>=d.minX&&x+radius<=d.maxX&&z-radius>=d.minZ&&z+radius<=d.maxZ&&!courtLaneAccessAt(plan,x,z,radius)&&!plan.buildings.some(r=>courtRectDistance(x,z,r)<=radius)&&!plan.trunks.some(t=>Math.hypot(x-t.x,z-t.z)<radius+t.collisionRadius+.20);}
export function courtLaneCanopyAt(plan,x,z,communityId){let cover=0,pine=0,birch=0;for(const t of (communityId?plan.communities.find(c=>c.id===communityId)?.trees||[]:plan.trees)){const radius=t.height*(t.species==='conifer'?.25:.34),distance=Math.hypot(x-t.x,z-t.z);cover=Math.max(cover,Math.max(0,1-distance/radius));const dx=x-t.x+.65*Math.sin(z*.61),dz=z-t.z,drift=Math.max(0,1-Math.hypot(dx/(radius*.68+.8),dz/(radius*1.35+1)));if(t.species==='conifer')pine=Math.max(pine,drift);else birch=Math.max(birch,drift);}return {cover,pine,birch,duff:Math.max(pine,birch),shade:cover,height:capeGroundHeight(x,z)};}
// Exact rectangle subtraction: disjoint cells, not overlapping cap overlays.
export function courtSubtractRect(source,cut){if(source.maxX<=cut.minX||source.minX>=cut.maxX||source.maxZ<=cut.minZ||source.minZ>=cut.maxZ)return [source];const x0=Math.max(source.minX,cut.minX),x1=Math.min(source.maxX,cut.maxX),z0=Math.max(source.minZ,cut.minZ),z1=Math.min(source.maxZ,cut.maxZ);return [{...source,maxX:x0},{...source,minX:x1},{...source,minX:x0,maxX:x1,maxZ:z0},{...source,minX:x0,maxX:x1,minZ:z1}].filter(r=>r.maxX>r.minX&&r.maxZ>r.minZ);}
export function applyCourtLanePlan(coastal,plan){
 const replacements=new Map([...plan.trees.filter(t=>t.id.startsWith('coast-tree-')),plan.relocation].map(t=>[t.id,t]));
 coastal.forestPlacements=coastal.forestPlacements.map(t=>replacements.get(t.id)||t);coastal.forestPlacements.push(...plan.trees.filter(t=>t.id.startsWith('cape-forest-court-lane-')));
 coastal.neighborhoods.props=coastal.neighborhoods.props.filter(p=>!plan.retiredBenchIds.includes(p.id)).map(p=>{const tree=replacements.get(p.id),bench=plan.benches.find(b=>b.id===p.id);return tree?{...p,...tree,width:tree.collisionRadius*2,depth:tree.collisionRadius*2,naturalSoil:true}:bench?{...p,...bench}:p;});
 coastal.courtLane=plan;
}
