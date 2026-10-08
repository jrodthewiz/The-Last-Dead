import {capeGroundHeight,capePathMask,capeStreamWidth,capeStreamZ,capeGroveField,capeMeadowField,CAPE_RESIDENTIAL_MEADOW} from './coastal-terrain.js';
import {capeSurfaceFields} from './coastal-terrain-fields.js';

const hash=(x,z,salt=0)=>{let h=Math.imul(Math.round(x*100)^salt,374761393)^Math.imul(Math.round(z*100),668265263);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;};
export function understoryClear(coastal,x,z) {
  if(x<130||x>445||z<3||z>413)return false;
  if(coastal.roads.some(r=>Math.abs(x-r.x)<r.width/2+.75&&Math.abs(z-r.z)<r.depth/2+.75))return false;
  if(capePathMask(x,z)>.025)return false;
  if(z>325&&x<432&&Math.abs(z-capeStreamZ(x))<capeStreamWidth(x)+.85)return false;
  for(const b of coastal.blackwaterSlice.buildings){
    const dx=x-b.x,dz=z-b.z,c=Math.cos(b.yaw||0),s=Math.sin(b.yaw||0),lx=dx*c-dz*s,lz=dx*s+dz*c;
    if(Math.abs(lx)<b.width/2+.40&&Math.abs(lz)<b.depth/2+.40)return false;
    // Clear both 4 m portals and their outside approach shoulders.
    if(Math.abs(lx-(b.doorOffset||0))<3.05&&Math.abs(Math.abs(lz)-b.depth/2)<3.2)return false;
  }
  return true;
}

export function makeCoastalUnderstory(coastal) {
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
  let meadowIndex=0;
  // Relocate the existing bounded cohorts into root-centred plant communities:
  // four plants share a grove anchor, with breathing room between communities.
  // Clear paths and the existing river-bank population retain their authority.
  return selected.map((source,i)=>{
    let p={...source};const trees=groves[p.zone];
    // Reuse 160 of the existing forest-floor plants for coastal salt meadow,
    // keeping total population, zone quota and both pooled plant resources.
    if(p.zone==='forest-floor'&&meadowIndex<160){
      const index=meadowIndex++,band=Math.floor(index/40),center=CAPE_RESIDENTIAL_MEADOW[band],cx=center.x,cz=center.z;
      for(let attempt=0;attempt<4;attempt++){
        const angle=hash(index,attempt,381)*Math.PI*2,radius=.4+hash(index,attempt,412)*8.8;
        const x=cx+Math.cos(angle)*radius,z=cz+Math.sin(angle)*radius*.85;
        if(!understoryClear(coastal,x,z)||capeMeadowField(x,z)<.12)continue;
        const scrub=hash(x,z,781)>.78;
        p={...p,x,z,y:capeGroundHeight(x,z),kind:scrub?'fern':'grass',scale:scrub?1.15+hash(x,z,812)*.6:1.25+hash(x,z,813)*1.35,
          tint:.18+hash(x,z,918)*.35,community:`salt-meadow-${band}`,habitat:'coastal-meadow'};
        break;
      }
      if(p.habitat==='coastal-meadow')return {...p,id:`understory-${i}`};
    }
    if(trees?.length){
      const index=groupIndex[p.zone]++,tree=trees[Math.floor(index/4)%trees.length];
      const angle=(index%4)*2.399+hash(tree.x,tree.z,901)*Math.PI*2;
      const radius=.95+hash(index,tree.z,811)*1.65;
      const x=tree.x+Math.cos(angle)*radius,z=tree.z+Math.sin(angle)*radius;
      if(understoryClear(coastal,x,z))p={...p,x,z,y:capeGroundHeight(x,z),community:tree.id};
      const shade=capeGroveField(p.x,p.z).strength;
      p.kind=hash(p.x,p.z,512)<.66*shade?'fern':'grass';
      p.scale=p.kind==='fern'?1.05+hash(p.x,p.z,610)*.8:.8+hash(p.x,p.z,630)*.85;
      p.tint=hash(p.x,p.z,670)*(.65-shade*.22);
    }
    return {...p,id:`understory-${i}`};
  });
}
