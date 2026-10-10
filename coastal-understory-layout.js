import {CAPE_RIDGE_HABITAT,capeRidgeHabitatFields} from './coastal-ridge-habitat.js';
import {capeGroundHeight,capePathMask,capeStreamWidth,capeStreamZ,capeGroveField,capeMeadowField,CAPE_RESIDENTIAL_MEADOW} from './coastal-terrain.js';
import {capeSurfaceFields,CAPE_HEATH_BEDS,capeResidentialCoastFields,capeBilberryBedField,makeCapeBilberryRootPrototype,capeBilberryRootPocketField,capeTrailCentreDistance,makeCapeRootShoulders,capeRootShoulderField,CAPE_WINDWARD_HEATH_BEDS,capeWindwardHeathFields} from './coastal-terrain-fields.js';
import {capeGroveCourtFields,CAPE_GROVE_COURT} from './coastal-terrain-fields.js';
import {SALTWOOD_COHORTS,saltwoodTransectFields} from './coastal-saltwood-transect.js';

const hash=(x,z,salt=0)=>{let h=Math.imul(Math.round(x*100)^salt,374761393)^Math.imul(Math.round(z*100),668265263);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;};

// A local overlay applied AFTER the historical population, using the same
// actual-tree soil/access authority as the court ground. No old random pass is
// rerun with the new trees. Rejected slots remain empty, never redistributed.
export const COURT_LANE_PLANT_CEILINGS=Object.freeze([
 Object.freeze({id:'court-west',grass:20,fern:16,shrub:12}),
 Object.freeze({id:'court-inner-west',grass:22,fern:8,shrub:14}),
 Object.freeze({id:'court-middle',grass:20,fern:20,shrub:12}),
 Object.freeze({id:'court-inner-east',grass:20,fern:10,shrub:12}),
 Object.freeze({id:'court-mouth',grass:44,fern:34,shrub:16}),
]);
export const COURT_LANE_REANCHOR_IDS=Object.freeze([
 'understory-1040','understory-1120','understory-1191',
 'grove-court-shrub-3','grove-court-shrub-9','grove-court-shrub-12','grove-court-shrub-15','grove-court-shrub-24','grove-court-shrub-27','grove-court-shrub-30','grove-court-shrub-33','grove-court-shrub-45','grove-court-shrub-48','grove-court-shrub-51','grove-court-shrub-54','grove-court-shrub-63','grove-court-shrub-66','grove-court-shrub-69','grove-court-shrub-75','grove-court-shrub-87','grove-court-shrub-90','grove-court-shrub-93','grove-court-shrub-96','grove-court-shrub-105','grove-court-shrub-111','grove-court-shrub-114','grove-court-shrub-117','grove-court-shrub-126',
 'grove-court-grass-3','grove-court-grass-9','grove-court-grass-12','grove-court-grass-24','grove-court-grass-27','grove-court-grass-30','grove-court-grass-45','grove-court-grass-48','grove-court-grass-51','grove-court-grass-54','grove-court-grass-63','grove-court-grass-66','grove-court-grass-75','grove-court-grass-96','grove-court-grass-114','grove-court-grass-126','grove-court-grass-129','grove-court-grass-132','grove-court-grass-144','grove-court-grass-147','grove-court-grass-150','grove-court-grass-153','grove-court-grass-168','grove-court-grass-171','grove-court-grass-177',
]);
export function courtLanePlantEnvelope(p){
 return p.kind==='fern'?1.45*p.scale+.045:p.kind==='shrub'?.50*p.scale+.045:.32*p.scale*(p.widthScale??1)+.05;
}
export function makeCourtLaneUnderstory(prior,{trees,communities,clearCircle,sampleCommunity,groundHeight}){
 const byId=new Map(prior.map(p=>[p.id,p])),reanchor=new Set(COURT_LANE_REANCHOR_IDS),updates=new Map();
 for(const id of [...reanchor,'understory-975','understory-1079'])if(!byId.has(id))throw new Error('Missing historical court plant '+id);
 const occupied=prior.filter(p=>!reanchor.has(p.id)),added=[];
 const census={before:prior.length,reanchored:[],retired:[],regrounded:['understory-975','understory-1079'],communities:[],candidateLimit:32};
 for(const id of census.regrounded){const p=byId.get(id);updates.set(id,{...p,y:groundHeight(p.x,p.z)});}
 const safe=(p,group)=>{
  if(!clearCircle(p.x,p.z,courtLanePlantEnvelope(p)))return false;
  const field=sampleCommunity(group.id,p.x,p.z),duff=Math.max(field.pine,field.birch);
  if(p.kind==='fern'?(duff<.14||field.cover<.10||field.birch<field.pine*.9):p.kind==='shrub'?(duff<.12||field.cover<.08):Math.max(duff,field.cover)<.06)return false;
  const gap=p.kind==='fern'?1:p.kind==='shrub'?.70:.35;
  return !occupied.some(q=>q.kind===p.kind&&Math.hypot(q.x-p.x,q.z-p.z)<gap);
 };
 const locate=(source,group,slot,salt)=>{
  const members=group.treeIds.map(id=>trees.find(t=>t.id===id));
  if(members.some(t=>!t))throw new Error('Missing court community tree '+group.id);
  for(let attempt=0;attempt<32;attempt++){
   const tree=members[(slot+attempt)%members.length],radius=tree.height*(tree.species==='conifer'?.25:.34);
   const angle=slot*2.399963+hash(slot,attempt,salt)*Math.PI*2,r=.15+Math.sqrt(hash(slot,attempt,salt+1))*.86;
   const z=tree.z+Math.sin(angle)*r*(radius*1.35+1),x=tree.x+Math.cos(angle)*r*(radius*.68+.8)-.65*Math.sin(z*.61);
   const p={...source,x,z,y:groundHeight(x,z)};
   if(safe(p,group))return p;
  }
  return null;
 };
 for(const [slot,p]of prior.filter(p=>reanchor.has(p.id)).entries()){
  const nearest=trees.reduce((a,b)=>Math.hypot(b.x-p.x,b.z-p.z)<Math.hypot(a.x-p.x,a.z-p.z)?b:a,trees[0]);
  const group=communities.find(g=>g.treeIds.includes(nearest.id)),next=locate(p,group,slot,17301);
  updates.set(p.id,next);if(next){occupied.push(next);census.reanchored.push(p.id);}else census.retired.push(p.id);
 }
 for(const [index,quota]of COURT_LANE_PLANT_CEILINGS.entries()){
  const group=communities.find(g=>g.id===quota.id);if(!group)throw new Error('Missing court plant community '+quota.id);
  const counts={id:group.id,grass:0,fern:0,shrub:0,rejected:0};
  for(const [kind,salt]of [['grass',18001],['fern',18101],['shrub',18201]])for(let slot=0;slot<quota[kind];slot++){
   const roll=hash(slot,index,salt),scale=kind==='grass'?.45+roll*.35:kind==='fern'?.65+roll*.25:.60+roll*.35;
   const source={id:`court-lane-${group.id}-${kind}-${slot}`,kind,scale,yaw:hash(slot,index,salt+2)*Math.PI*2,tint:.12+hash(slot,index,salt+3)*.28,zone:'forest-floor',habitat:'court-lane-root-community',community:group.id,softShoulder:true};
   const p=locate(source,group,slot,salt+index*1000);
   if(p){occupied.push(p);added.push(p);counts[kind]++;}else counts.rejected++;
  }
  census.communities.push(counts);
 }
 const plants=prior.flatMap(p=>updates.has(p.id)?updates.get(p.id)?[updates.get(p.id)]:[]:[p]).concat(added);
 census.added=added.length;census.after=plants.length;
 return {plants,census};
}
export function appendCoastalSaltwoodTransect(coastal){
 const trees=[],plants=[],existing=coastal.forestPlacements;
 const safe=(x,z,envelope)=>{
  if(!understoryClear(coastal,x,z,{softShoulder:true}))return false;
  if(coastal.roads.some(r=>Math.abs(x-r.x)<r.width/2+envelope+.8&&Math.abs(z-r.z)<r.depth/2+envelope+.8))return false;
  if([...coastal.neighborhoods.props,...coastal.blackwaterSlice.props].some(p=>Math.abs(x-p.x)<(p.width||.4)/2+envelope+.3&&Math.abs(z-p.z)<(p.depth||.4)/2+envelope+.3))return false;
  return [[-envelope,0],[envelope,0],[0,-envelope],[0,envelope]].every(([dx,dz])=>understoryClear(coastal,x+dx,z+dz,{softShoulder:true}));
 };
 for(const [group,anchor]of SALTWOOD_COHORTS.entries())for(let i=0;i<anchor.trees;i++)for(let attempt=0;attempt<400;attempt++){
  const a=i*2.399963+hash(i,attempt,10001+group)*Math.PI*2,r=Math.sqrt(hash(i,attempt,10012+group));
  const z=anchor.z+Math.sin(a)*r*anchor.rz,x=anchor.x+Math.cos(a)*r*anchor.rx-(z-anchor.z)*.18;
  const field=saltwoodTransectFields(x,z),height=10+field.canopy*5+hash(i,group,10031)*2;
  if(field.cohort!==group||field.canopy<.18||field.bedrock>.12||field.accessDistance<6.5||!safe(x,z,4.4))continue;
  if([...existing,...trees].some(t=>Math.hypot(t.x-x,t.z-z)<4.2))continue;
  const species=x>413||i%4!==0?'conifer':'deciduous';
  trees.push({id:`cape-forest-saltwood-${group}-${i}`,x,z,y:capeGroundHeight(x,z),height,yaw:.35+(hash(i,group,10041)-.5)*1.2,
   species,seed:83100+group*100+i,collisionRadius:.36+field.canopy*.12,habitat:'saltwood-canopy',community:`saltwood-${anchor.id}`,grove:4});break;
 }
 // Shrubs occupy sheltered root pockets; low grasses feather those pockets
 // toward the existing salt heath. They share the exact trace/mineral masks.
 for(const [kind,target]of [['shrub',72],['grass',128]])for(let i=0;i<target;i++)for(let attempt=0;attempt<240;attempt++){
  const group=i%2,anchor=SALTWOOD_COHORTS[group],a=i*2.399963+hash(i,attempt,10101)*2,r=Math.sqrt(hash(i,attempt,10112));
  const z=anchor.z+Math.sin(a)*r*anchor.rz*1.05,x=anchor.x+(kind==='grass'?7:1)+Math.cos(a)*r*anchor.rx-(z-anchor.z)*.18;
  const field=saltwoodTransectFields(x,z),scale=kind==='shrub'?.7+hash(i,group,10131)*.4:.55+hash(i,group,10132)*.6,envelope=scale*(kind==='shrub'?.47:.26)+.03;
  if(field.lowCover<.18||field.trace>.02||field.bedrock>.18||kind==='shrub'&&field.canopy<.15||!safe(x,z,envelope))continue;
  if([...existing,...trees].some(t=>Math.hypot(t.x-x,t.z-z)<t.collisionRadius+.22+envelope))continue;
  if(plants.some(p=>p.kind===kind&&Math.hypot(p.x-x,p.z-z)<(kind==='shrub'?.58:.3)))continue;
  plants.push({id:`saltwood-transect-${kind}-${i}`,x,z,y:capeGroundHeight(x,z),yaw:.4+(hash(i,group,10141)-.5)*.8,kind,scale,
   tint:.12+hash(i,group,10142)*.26,zone:'forest-floor',habitatExpansion:true,coastalExpansion:true,softShoulder:true,
   habitat:kind==='shrub'?'saltwood-root-pocket':'saltwood-heath-skirt',community:`saltwood-${anchor.id}`});break;
 }
 plants.push(...appendCapeRidgeHabitat(coastal,[...existing,...trees],plants));
 return {trees,plants};
}
export function appendCapeGroveCourt(coastal){
 const trees=[],plants=[],oldTrees=coastal.forestPlacements;
 const clear=(x,z,envelope,tree=false)=>{
  if(z>278||z<258||x<342||x>405||Math.abs(z-268)<1.5+envelope)return false;
  if(!understoryClear(coastal,x,z,{softShoulder:true}))return false;
  if(coastal.roads.some(r=>Math.abs(x-r.x)<r.width/2+envelope+1&&Math.abs(z-r.z)<r.depth/2+envelope+1))return false;
  if([...coastal.neighborhoods.props,...coastal.blackwaterSlice.props].some(p=>Math.abs(x-p.x)<(p.width||.4)/2+envelope+.35&&Math.abs(z-p.z)<(p.depth||.4)/2+envelope+.35))return false;
  if(tree&&coastal.buildings.some(b=>Math.abs(x-b.x)<b.width/2+4&&Math.abs(z-b.z)<b.depth/2+4))return false;
  if(tree&&coastal.understoryPlacements.some(p=>p.softShoulder&&Math.hypot(x-p.x,z-p.z)<.55))return false;
  if(Math.hypot(x-coastal.lighthouse.x,z-coastal.lighthouse.z)<10+envelope)return false;
  return [[-envelope,0],[envelope,0],[0,-envelope],[0,envelope]].every(([dx,dz])=>understoryClear(coastal,x+dx,z+dz,{softShoulder:true}));
 };
 // Unequal regeneration cohorts follow the sheltered court and older grove.
 for(let i=0;i<12;i++)for(let attempt=0;attempt<240;attempt++){
  const group=i<4?0:i<7?1:2,p=CAPE_GROVE_COURT.anchors[group];
  const a=i*2.399963+hash(i,attempt,9101)*2,r=Math.sqrt(hash(i,attempt,9102));
  const x=p.x+Math.cos(a)*r*p.rx*.95,z=p.z+Math.sin(a)*r*p.rz*.90;
  if(capeGroveCourtFields(x,z).cover<.20||!clear(x,z,.35,true)||[...oldTrees,...trees].some(t=>Math.hypot(x-t.x,z-t.z)<4.2))continue;
  trees.push({id:`cape-forest-court-${i}`,x,z,y:capeGroundHeight(x,z),species:i%4===0?'conifer':'deciduous',height:5.2+hash(i,0,9103)*3.5,yaw:hash(i,0,9104)*Math.PI*2,collisionRadius:.20+hash(i,0,9105)*.05,seed:73100+i,habitat:'young-edge',community:'grove-court-regeneration',grove:4});break;
 }
 for(const [kind,target]of [['shrub',128],['grass',180]])for(let i=0;i<target;i++)for(let attempt=0;attempt<160;attempt++){
  const group=i%3,p=CAPE_GROVE_COURT.anchors[group],a=i*2.399963+hash(i,attempt,9201)*1.7,r=Math.sqrt(hash(i,attempt,9202));
  const x=p.x+Math.cos(a)*r*p.rx,z=p.z+Math.sin(a)*r*p.rz;
  const scale=kind==='shrub'?.62+hash(i,group,9203)*.42:.32+hash(i,group,9204)*.40,envelope=scale*(kind==='shrub'?.47:.26)+.03;
  if(capeGroveCourtFields(x,z).cover<.22||!clear(x,z,envelope)||trees.some(t=>Math.hypot(x-t.x,z-t.z)<t.collisionRadius+.25)||plants.some(t=>t.kind===kind&&Math.hypot(x-t.x,z-t.z)<(kind==='shrub'?.48:.23)))continue;
  plants.push({id:`grove-court-${kind}-${i}`,x,z,y:capeGroundHeight(x,z),yaw:hash(x,z,9205)*Math.PI*2,kind,scale,tint:.13+hash(x,z,9206)*.25,zone:'forest-floor',habitatExpansion:true,courtExpansion:true,softShoulder:true,habitat:'grove-court-lee',community:`grove-court-${group}`});break;
 }
 return {trees,plants};
}
export function understoryClear(coastal,x,z,{softShoulder=false}={}) {
  if(x<130||x>445||z<3||z>413)return false;
  if(coastal.roads.some(r=>Math.abs(x-r.x)<r.width/2+.75&&Math.abs(z-r.z)<r.depth/2+.75))return false;
  // Low non-colliding shoulder plants may occupy the former 6.8m blanket
  // exclusion. Even their full crown/wind envelope leaves a 3m clear route.
  if(softShoulder?capeTrailCentreDistance(x,z)<2.05:capePathMask(x,z)>.025)return false;
  if(softShoulder){
    for(const bx of [222,340])if(Math.abs(x-bx)<3.5&&Math.abs(z-capeStreamZ(bx))<12)return false;
    if((coastal.forestPlacements||[]).some(tree=>Math.hypot(tree.x-x,tree.z-z)<(tree.collisionRadius||.2)+.20))return false;
  }
  if(z>325&&x<432&&Math.abs(z-capeStreamZ(x))<capeStreamWidth(x)+.85)return false;
  for(const b of coastal.blackwaterSlice.buildings){
    const dx=x-b.x,dz=z-b.z,c=Math.cos(b.yaw||0),s=Math.sin(b.yaw||0),lx=dx*c-dz*s,lz=dx*s+dz*c;
    if(Math.abs(lx)<b.width/2+.40&&Math.abs(lz)<b.depth/2+.40)return false;
    // Clear both 4 m portals and their outside approach shoulders.
    if(Math.abs(lx-(b.doorOffset||0))<3.05&&Math.abs(Math.abs(lz)-b.depth/2)<3.2)return false;
  }
  return true;
}

export function makeCoastalUnderstory(coastal,{expandHabitat=true,expandCoast=expandHabitat}={}) {
  const placements=[];
  const add=(x,z,zone,seed)=>{
    if(!understoryClear(coastal,x,z))return;
    const field=capeSurfaceFields(x,z),roll=hash(x,z,seed),kind=roll>.76-field.bank*.18-field.leafLitter*.06?'fern':'grass';
    const terrain=capeGroundHeight(x,z),pavement=zone==='building-verge'?.135:terrain;
    placements.push({id:`understory-${placements.length}`,x,z,y:Math.max(terrain,pavement),
      yaw:hash(x,z,seed+9)*Math.PI*2,scale:kind==='fern'?.66+roll*.30:.55+roll*.48,kind,zone,
      tint:hash(x,z,seed+71)*(.9-field.wetness*.3)});
  };
  for(const [index,b] of coastal.blackwaterSlice.buildings.entries()){
    const c=Math.cos(b.yaw||0),s=Math.sin(b.yaw||0);
    for(const side of [-1,1])for(let t=-b.depth/2+.8;t<b.depth/2;t+=1.2){
      const lx=side*(b.width/2+.75+hash(index,t,91)*.55),lz=t+(hash(index,t,17)-.5)*.5;
      if(hash(index,t,side+212)>.70)continue;
      add(b.x+lx*c+lz*s,b.z-lx*s+lz*c,'building-verge',index+13);
    }
    for(let lx=-b.width/2+.8;lx<b.width/2;lx+=1.1){
      const lz=-b.depth/2-.9-hash(lx,index,55)*.4;
      add(b.x+lx*c+lz*s,b.z-lx*s+lz*c,'building-verge',index+61);
    }
  }
  // Authored density ribbons: forest edge, stream bank, eastern slope. Keep the
  // public walking paths clear and use the identical triangulated terrain height.
  for(let z=319;z<410;z+=3.8)for(let x=135;x<441;x+=4.1){
    const jx=x+(hash(x,z,211)-.5)*2.8,jz=z+(hash(x,z,899)-.5)*2.6;
    const bank=Math.abs(jz-capeStreamZ(jx));
    const density=bank<10?.90:jz<336?.82:.38;
    if(hash(x,z,161)>density)continue;
    add(jx,jz,bank<10?'river-bank':'forest-floor',127);
    if(bank<10)add(jx+.55,jz+.45,'river-bank',713);
  }
  for(let z=141;z<319;z+=5.0)for(let x=390;x<440;x+=4.2){
    if(hash(x,z,114)<.57)add(x+hash(x,z)*2,z+hash(z,x)*2,'eastern-slope',443);
  }
  const quotas={"building-verge":1300,"forest-floor":800,"river-bank":350,"eastern-slope":150};
  const selected=Object.entries(quotas).flatMap(([zone,limit])=>placements.filter(p=>p.zone===zone).sort((a,b)=>hash(a.x,a.z,919)-hash(b.x,b.z,919)).slice(0,limit));
  const woodland=(coastal.forestPlacements||[]).filter(t=>t.id.startsWith('cape-forest-')&&t.habitat!=='young-edge');
  const groves={
    'forest-floor':woodland.filter(t=>t.z>360),
    'eastern-slope':woodland.filter(t=>t.z<324&&t.x>385),
  };
  const groupIndex={'forest-floor':0,'eastern-slope':0};
  let meadowIndex=0,heathIndex=0,regenerationIndex=0,coastIndex=0,coastCityIndex=0,bilberryIndex=0,shoulderTuftIndex=0;
  const bilberrySites=[];
  const rootPrototype=makeCapeBilberryRootPrototype(coastal.forestPlacements||[]);
  // Relocate the existing bounded cohorts into root-centred plant communities:
  // four plants share a grove anchor, with breathing room between communities.
  // Clear paths and the existing river-bank population retain their authority.
  const original=selected.map((source,i)=>{
    let p={...source};const trees=groves[p.zone];
    // Reallocate a small city-verge cohort into sheltered heath pockets around
    // actual woodland landforms. These are uneven plant communities, not a
    // planted line along the path. The total budget stays exactly unchanged.
    if(p.zone==='building-verge'&&heathIndex<160){
      const index=heathIndex++,group=Math.floor(index/10);
      const [cx,cz]=[[334,379],[327,388],[349,388],[352,397],[404,383],[427,251],
        [333,393],[346,374],[397,395],[423,377],[172,385],[180,398],
        [215,383],[228,397],[418,243],[433,277]][group];
      for(let attempt=0;attempt<6;attempt++){
        const angle=hash(index,attempt,1771)*Math.PI*2,radius=.25+hash(index,attempt,1881)*1.85;
        const x=cx+Math.cos(angle)*radius,z=cz+Math.sin(angle)*radius;
        if(!understoryClear(coastal,x,z))continue;
        return {...p,id:`understory-${i}`,x,z,y:capeGroundHeight(x,z),zone:'forest-floor',kind:'fern',
          scale:1.4+hash(index,cz,1991)*.65,tint:.20+hash(index,cx,1981)*.32,habitat:'heath-pocket',community:`heath-pocket-${group}`};
      }
    }
    // Ten sheltered slope-break communities reuse the city-verge population.
    // Dense fern hearts follow nearby broadleaf roots; drier pine/heath margins
    // are grassier and lower. Clear gaps between these beds retain the glade.
    if(p.zone==='building-verge'&&regenerationIndex<400){
      const index=regenerationIndex++,group=Math.floor(index/40);
      const [cx,cz]=CAPE_HEATH_BEDS[group];
      const tree=woodland.reduce((a,b)=>Math.hypot(b.x-cx,b.z-cz)<Math.hypot(a.x-cx,a.z-cz)?b:a,woodland[0]);
      for(let attempt=0;attempt<16;attempt++){
        const angle=index*2.399963+hash(group,attempt,3011)*.8;
        const radius=.5+Math.sqrt(hash(index,attempt,3021))*4.2;
        const x=cx+Math.cos(angle)*radius,z=cz+Math.sin(angle)*radius*.65;
        if(!understoryClear(coastal,x,z))continue;
        const fern=radius<3.1||tree.species==='deciduous'&&hash(index,group,3031)<.8;
        return {...p,id:`understory-${i}`,x,z,y:capeGroundHeight(x,z),zone:'forest-floor',kind:fern?'fern':'grass',
          scale:fern?1.1+hash(index,group,3041)*.95:1.1+hash(index,group,3051)*1.25,
          tint:.08+hash(index,group,3061)*.35,habitat:tree.species==='conifer'?'pine-regeneration':'birch-regeneration',community:`slope-bed-${group}`};
      }
    }
    // Reuse 160 of the existing forest-floor plants for coastal salt meadow,
    // keeping total population, zone quota and both pooled plant resources.
    if(p.zone==='forest-floor'&&meadowIndex<160||p.zone==='building-verge'&&coastCityIndex<160){
      if(p.zone==='forest-floor')meadowIndex++;else coastCityIndex++;
      const index=coastIndex++,band=Math.floor(index/40),cz=[12,26,41,52,74,86,100,111][band];
      for(let attempt=0;attempt<40;attempt++){
        const angle=index*2.399963+hash(index,attempt,381)*.6,radius=.7+Math.sqrt(hash(index,attempt,412))*6.8;
        const z=cz+Math.sin(angle)*radius*.68,x=410+4*Math.sin(z*.045)+1.5*Math.sin(z*.11)+Math.cos(angle)*radius;
        const field=capeResidentialCoastFields(x,z);
        if(!understoryClear(coastal,x,z)||field.scrub<.16||field.trace>.04||field.bedrock>.2)continue;
        const fern=field.scrub>.65&&hash(x,z,781)>.60;
        return {...p,id:`understory-${i}`,x,z,y:capeGroundHeight(x,z),zone:'forest-floor',kind:fern?'fern':'grass',
          scale:fern?.85+hash(x,z,812)*.45:1.4+hash(x,z,813)*1.2,tint:.18+hash(x,z,918)*.35,
          community:`salt-meadow-${band}`,habitat:'coastal-meadow'};
      }
    }
    if(p.zone==='building-verge'&&bilberryIndex<160){
      const index=bilberryIndex++,group=Math.floor(index/16),[cx,cz]=group===0&&rootPrototype?[rootPrototype.x,rootPrototype.z]:CAPE_HEATH_BEDS[group];
      for(let attempt=0;attempt<192;attempt++){
        const angle=index*2.399963+hash(group,attempt,5011)*1.2,radius=1.4+Math.sqrt(hash(index,attempt,5021))*3.1;
        const x=group===0?cx+(hash(index,attempt,5011)-.5)*.95:cx+Math.cos(angle)*radius;
        const z=group===0?cz-4.8+Math.floor((index%16)/4)*2.5+(hash(index,attempt,5021)-.5)*1.5:cz+Math.sin(angle)*radius*.65;
        if(!understoryClear(coastal,x,z,{softShoulder:group===0})||(group===0?capeBilberryRootPocketField(x,z,rootPrototype):capeBilberryBedField(x,z))<.18||bilberrySites.some(p=>Math.hypot(p.x-x,p.z-z)<.44))continue;
        bilberrySites.push({x,z});
        return {...p,id:`understory-${i}`,x,z,y:capeGroundHeight(x,z),zone:'forest-floor',kind:'shrub',
          scale:.58+hash(index,group,5031)*.45,tint:.12+hash(index,group,5041)*.28,habitat:'bilberry-woodland',community:`bilberry-bed-${group}`,...(group===0?{softShoulder:true}:{})};
      }
    }
    if(p.zone==='building-verge'&&shoulderTuftIndex<24&&rootPrototype){
      const index=shoulderTuftIndex++;
      for(let attempt=0;attempt<64;attempt++){
        const x=rootPrototype.x+(hash(index,attempt,6011)-.5)*1.2,z=rootPrototype.z-5+index/23*10+(hash(index,attempt,6021)-.5)*1.1;
        if(!understoryClear(coastal,x,z,{softShoulder:true})||capeBilberryRootPocketField(x,z,rootPrototype)<.1)continue;
        return {...p,id:`understory-${i}`,x,z,y:capeGroundHeight(x,z),zone:'forest-floor',kind:'grass',scale:.25+hash(index,z,6031)*.25,
          tint:.16+hash(index,x,6041)*.20,habitat:'root-shoulder-tuft',community:'bilberry-bed-0',softShoulder:true};
      }
    }
    if(trees?.length){
      const index=groupIndex[p.zone]++,tree=trees[Math.floor(index/4)%trees.length];
      const angle=(index%4)*2.399+hash(tree.x,tree.z,901)*Math.PI*2;
      const radius=.95+hash(index,tree.z,811)*1.65;
      const x=tree.x+Math.cos(angle)*radius,z=tree.z+Math.sin(angle)*radius;
      if(understoryClear(coastal,x,z))p={...p,x,z,y:capeGroundHeight(x,z),community:tree.id};
      const shade=capeGroveField(p.x,p.z).strength;
      p.kind=hash(p.x,p.z,512)<(tree.species==='conifer'?.52:.85)*shade?'fern':'grass';
      p.scale=p.kind==='fern'?1.05+hash(p.x,p.z,610)*.8:.8+hash(p.x,p.z,630)*.85;
      p.tint=hash(p.x,p.z,670)*(.65-shade*.22);
      p.habitat=tree.species==='conifer'?'pine-hollow':'sheltered-birch';
    }
    return {...p,id:`understory-${i}`};
  });
  const expandedWoodland=expandHabitat?appendCapeHabitatUnderstory(coastal,original):original;
  return expandCoast?appendCapeWindwardHeath(coastal,expandedWoodland):expandedWoodland;
}

export function appendCapeHabitatUnderstory(coastal,original){
 const result=[...original],shoulders=makeCapeRootShoulders(coastal.forestPlacements||[]);
 const communities=[...shoulders.map(p=>({x:p.pathX+p.side*2.7,z:p.treeZ,root:true})),...CAPE_HEATH_BEDS.map(([x,z])=>({x,z,root:false}))];
 const newSites=[];
 for(const [kind,target]of [['shrub',120],['grass',600]])for(let index=0;index<target;index++){
  const group=index%communities.length,anchor=communities[group],local=Math.floor(index/communities.length);
  for(let attempt=0;attempt<160;attempt++){
   // Unequal lee lobes hold compact leafy hearts, with lower tuft skirts.
   // Root shoulders and wider sheltered heath beds share their material cause.
   const lobe=local%3,heading=hash(group,lobe,7101)*Math.PI*2,reach=anchor.root?.48:1.25+lobe*.35;
   const angle=local*2.399963+hash(index,attempt,7111)*1.4,radius=Math.sqrt(hash(index,attempt,7121))*(anchor.root?(kind==='shrub'?2.2:3.5):(kind==='shrub'?1.2:2.15));
   const x=anchor.x+Math.cos(heading)*reach+Math.cos(angle)*radius*(anchor.root?.45:1),z=anchor.z+Math.sin(heading)*reach+Math.sin(angle)*radius*(anchor.root?1.85:.70);
   const field=capeSurfaceFields(x,z),root=capeRootShoulderField(x,z,shoulders),bed=capeBilberryBedField(x,z),scale=kind==='shrub'?.64+hash(index,group,7131)*.36:.26+hash(index,group,7141)*.38;
   if(!understoryClear(coastal,x,z,{softShoulder:true})||field.slope>.28||Math.max(root.cover,bed)<.22)continue;
   const envelope=kind==='shrub'?.47*scale+.02:.26*scale+.01;
   if(capeTrailCentreDistance(x,z)-envelope<1.5)continue;
   if(newSites.some(p=>p.kind===kind&&Math.hypot(p.x-x,p.z-z)<(kind==='shrub'?.48:.20)))continue;
   const plant={id:`habitat-growth-${kind}-${index}`,x,z,y:capeGroundHeight(x,z),yaw:hash(x,z,7151)*Math.PI*2,kind,scale,
    tint:.10+hash(x,z,7161)*.30,zone:'forest-floor',habitatExpansion:true,softShoulder:true,
    habitat:anchor.root?'rooted-shoulder-community':'sheltered-low-heath',community:`habitat-growth-${group}`};
   result.push(plant);newSites.push(plant);break;
  }
 }
 return result;
}

export function appendCapeWindwardHeath(coastal,original){
 const result=[...original],sites=[];
 for(const [kind,target]of [['shrub',144],['grass',720]])for(let index=0;index<target;index++){
  const group=index%4,bed=CAPE_WINDWARD_HEATH_BEDS[group],local=Math.floor(index/4);
  for(let attempt=0;attempt<180;attempt++){
   const lobe=local%3,heading=.65+lobe*2.12,skirt=kind==='grass';
   const angle=local*2.399963+hash(index,attempt,8011)*.9,radius=Math.sqrt(hash(index,attempt,8021))*(skirt?3.8:2.9);
   const x=bed.x+Math.cos(heading)*bed.rx*.27+Math.cos(angle)*radius,z=bed.z+Math.sin(heading)*bed.rz*.29+Math.sin(angle)*radius;
   const field=capeWindwardHeathFields(x,z),coast=capeResidentialCoastFields(x,z),surface=capeSurfaceFields(x,z);
   if(!understoryClear(coastal,x,z,{softShoulder:true})||field.cover<.24||coast.trace>.025||coast.bedrock>.35||surface.slope>.18)continue;
   const scale=skirt?.52+hash(index,group,8031)*.37:.72+hash(index,group,8041)*.42;
   const envelope=skirt?.26*scale+.012:.47*scale+.02;
   if([[-envelope,0],[envelope,0],[0,-envelope],[0,envelope]].some(([dx,dz])=>!understoryClear(coastal,x+dx,z+dz,{softShoulder:true})||capeResidentialCoastFields(x+dx,z+dz).trace>.045))continue;
   if(sites.some(p=>p.kind===kind&&Math.hypot(p.x-x,p.z-z)<(skirt?.24:.56)))continue;
   const plant={id:`windward-heath-${kind}-${index}`,x,z,y:capeGroundHeight(x,z),yaw:.45+(hash(x,z,8051)-.5)*.65,kind,scale,
    tint:.08+hash(x,z,8061)*.24,zone:'forest-floor',habitatExpansion:true,coastalExpansion:true,softShoulder:true,
    habitat:skirt?'saltwind-tuft-skirt':'windward-low-scrub',community:`windward-heath-${group}`};
   result.push(plant);sites.push(plant);break;
  }
 }
 return result;
}

// Appended after the historical saltwood records; every old record is intact.
export function appendCapeRidgeHabitat(coastal,trees=coastal.forestPlacements,prior=[]){
 const result=[];
 for(const [kind,target]of [['grass',1200],['shrub',160]])for(let i=0;i<target;i++){
  const group=i%2,p=CAPE_RIDGE_HABITAT[group];
  for(let attempt=0;attempt<320;attempt++){
   const a=i*2.399963+hash(i,attempt,11201)*2,r=Math.sqrt(hash(i,attempt,11202));
   const z=p.z+Math.sin(a)*r*p.rz,x=p.x+Math.cos(a)*r*p.rx-(z-p.z)*.16;
   const f=capeRidgeHabitatFields(x,z),grass=kind==='grass';
   if(f.group!==group||f.cover<.22||(grass?f.tussock<.70:f.rootToe<.3))continue;
   const scale=grass?.80+hash(i,group,11203)*.24:.82+hash(i,group,11204)*.3;
   const widthScale=grass?1.6+hash(i,group,11205)*.4:1,heightScale=grass?.65+hash(i,group,11206)*.25:1;
   const envelope=scale*(grass?.26*widthScale:.47)+.045;
   if(f.accessDistance-envelope<3||!understoryClear(coastal,x,z,{softShoulder:true}))continue;
   if([[-envelope,0],[envelope,0],[0,-envelope],[0,envelope]].some(([dx,dz])=>!understoryClear(coastal,x+dx,z+dz,{softShoulder:true})))continue;
   if(trees.some(t=>Math.hypot(t.x-x,t.z-z)<t.collisionRadius+envelope+.20))continue;
   const crowded=q=>q.kind===kind&&Math.hypot(q.x-x,q.z-z)<(grass?.38:.68);
   if(prior.some(crowded)||result.some(crowded))continue;
   result.push({id:`ridge-habitat-${kind}-${i}`,kind,x,z,y:capeGroundHeight(x,z),yaw:.45+(hash(i,group,11207)-.5)*.8,
    scale,widthScale,heightScale,tint:.08+hash(i,group,11208)*.22,zone:'forest-floor',softShoulder:true,habitatExpansion:true,
    habitat:grass?'ridge-connected-tussock':'ridge-sheltered-root-toe',community:`ridge-habitat-${group}`});break;
  }
 }
 return result;
}
