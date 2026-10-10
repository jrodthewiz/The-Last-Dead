import {CAPE_RESIDENTIAL_TRANSITION,CAPE_RESIDENTIAL_SCALAR_OPS,CAPE_WINDWARD_HEATH_BEDS,capeWindwardHeathFields,capeResidentialCoastFields} from './coastal-residential-fields.js';
import {capeResidentialNaturalFields} from './coastal-residential-fields.js';
import {saltwoodTransectFields} from './coastal-saltwood-transect.js';
import {residentialGroundHierarchy,outerBankGroundHierarchy} from './coastal-ground-hierarchy.js';
import {capeRootFootingFields} from './coastal-root-footing.js';
import {CAPE_GROVE_COURT,capeGroveCourtFields} from './coastal-grove-court-fields.js';
export {CAPE_GROVE_COURT,capeGroveCourtFields} from './coastal-grove-court-fields.js';
export {CAPE_RESIDENTIAL_TRANSITION,CAPE_RESIDENTIAL_SCALAR_OPS,CAPE_WINDWARD_HEATH_BEDS,capeWindwardHeathFields,capeResidentialCoastFields} from './coastal-residential-fields.js';
import {capeGroundHeight,capePathMask,capeStreamZ,capeStreamWidth,capeStreamLevel,capeGroveField,capeBedrockField,CAPE_TERRAIN} from './coastal-terrain.js';

const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const hash=(x,z)=>((Math.imul(x,374761393)^Math.imul(z,668265263)^60941)>>>0)/4294967295;
// Build-time material roles only. All derivatives use the existing exact
// triangulated ground; no field here feeds physics or plant placement.
const hierarchyHeight=(x,z)=>capeGroundHeight(x,z,{bridges:false});
// Exact construction-only stencil values, including the one-metre halo.
// Float64 retains the original Number value; fractional callers stay uncached.
export function createCapeHierarchyHeightCache(query=hierarchyHeight){
 const regions=[[383,449,-1,120],[373,408,390,417]].map(([x0,x1,z0,z1])=>{
  const width=x1-x0+1,length=width*(z1-z0+1);
  return{x0,x1,z0,z1,width,values:new Float64Array(length),valid:new Uint8Array(length)};
 });
 let disposed=false;
 const diagnostics={requests:0,queries:0,hits:0,entries:0,bytes:regions.reduce((sum,r)=>sum+r.values.byteLength+r.valid.byteLength,0),retainedBytes:0};
 diagnostics.retainedBytes=diagnostics.bytes;
 return {diagnostics,sample(x,z){
  if(disposed)throw new Error('Cape hierarchy height cache disposed');
  diagnostics.requests++;
  const r=Number.isInteger(x)&&Number.isInteger(z)?regions.find(r=>x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1):null;
  if(!r){diagnostics.queries++;return query(x,z);}
  const i=(z-r.z0)*r.width+x-r.x0;
  if(r.valid[i]){diagnostics.hits++;return r.values[i];}
  const value=query(x,z);r.values[i]=value;r.valid[i]=1;
  diagnostics.queries++;diagnostics.entries++;return value;
 },dispose(){if(disposed)return;disposed=true;for(const r of regions){r.values=null;r.valid=null;}regions.length=0;diagnostics.retainedBytes=0;}};
}
export function capeGroundHierarchy(x,z,canopy={},sampleHeight=hierarchyHeight){
 const front=x>=384&&x<=448&&z>=0&&z<120;
 const outer=x>=374&&x<=407&&z>=391&&z<=416;
 if(!front&&!outer)return null;
 const h=sampleHeight(x,z);
 const left=sampleHeight(x-1,z),right=sampleHeight(x+1,z);
 const back=sampleHeight(x,z-1),ahead=sampleHeight(x,z+1);
 const gx=(right-left)/2,gz=(ahead-back)/2,slope=1-1/Math.sqrt(1+gx*gx+gz*gz),curvature=(left+right+back+ahead-4*h)/4;
 if(front)return {region:'front',...residentialGroundHierarchy({x,z,coast:capeResidentialCoastFields(x,z),natural:capeResidentialNaturalFields(x,z),saltwood:saltwoodTransectFields(x,z),canopy,slope,curvature})};
 return {region:'outer',...outerBankGroundHierarchy(x,z,{canopy,slope,curvature,gx,gz})};
}
// Temporary build-time storage of the exact rendered terrain attributes.
// Barycentric interpolation follows the physical/rendered one-metre diagonal.
export function createCapeSurfaceUnderlay(){
 const width=321,height=297,values=new Float32Array(width*height*7),valid=new Uint8Array(width*height);
 const frontValues=new Float32Array(65*120*7),frontValid=new Uint8Array(65*120);
 const index=(x,z)=>(z-120)*width+x-128;
 const storage=(x,z)=>z<120?{values:frontValues,valid:frontValid,n:z*65+x-384}: {values,valid,n:index(x,z)};
 return {bytes:values.byteLength+valid.byteLength+frontValues.byteLength+frontValid.byteLength,set(x,z,color,biome){const s=storage(x,z);s.valid[s.n]=1;s.values.set([...color,...biome],s.n*7);},sample(x,z){
  const ix=Math.floor(x),iz=Math.floor(z),u=x-ix,v=z-iz;
  const corners=u+v<=1?[[ix,iz,1-u-v],[ix+1,iz,u],[ix,iz+1,v]]:[[ix+1,iz+1,u+v-1],[ix,iz+1,1-u],[ix+1,iz,1-v]];
  const out=new Array(7).fill(0);
  for(const [cx,cz,w]of corners){if(w===0)continue;if(cx>448||cz<0||cz>416||cx<(cz<120?384:128))return null;const s=storage(cx,cz);if(!s.valid[s.n])return null;for(let i=0;i<7;i++)out[i]+=s.values[s.n*7+i]*w;}
  return {color:out.slice(0,3),biome:out.slice(3)};
 }};
}
function soilPatch(x,z){
  // A single twelve-metre soil domain; no sub-grid noise in the one-metre mesh.
  const u=x/12,v=z/12,i=Math.floor(u),j=Math.floor(v),a=smooth(0,1,u-i),b=smooth(0,1,v-j);
  return (hash(i,j)*(1-a)+hash(i+1,j)*a)*(1-b)+(hash(i,j+1)*(1-a)+hash(i+1,j+1)*a)*b;
}
export const CAPE_HEATH_BEDS=Object.freeze([[321,386],[328,382],[351,386],[354,393],[399,396],
  [407,391],[424,382],[418,374],[384,381],[401,406]].map(p=>Object.freeze(p)));
export function capeHeathBedField(x,z){
  let bed=0;
  for(const [cx,cz]of CAPE_HEATH_BEDS){
    const u=x-cx+.65*Math.sin(z*.8),v=z-cz+(x-cx)*.25;
    const q=Math.hypot(u/5.5,v/3.8);
    bed=Math.max(bed,1-smooth(.25,1.15,q));
  }
  return bed*(1-capeTrailSurfaceMask(x,z));
}
export function capeBilberryBedField(x,z){
 // Acid woodland margins favour woody ground cover around the existing fern
 // hearts. The same shelter/bed causes own placement and moss/duff shoulders.
 return capeHeathBedField(x,z)*capeGroveField(x,z).strength;
}
export function makeCapeBilberryRootPrototype(forest){
 const [cx,cz]=CAPE_HEATH_BEDS[0];let selected=null,best=Infinity;
 for(const tree of forest){
  const distance=Math.hypot(tree.x-cx,tree.z-cz);if(!tree.id.startsWith('cape-forest-')||tree.habitat==='young-edge'||distance>17)continue;
  const field=capeSurfaceFields(tree.x,tree.z),shoulder=Math.min(Math.abs(tree.x-222),Math.abs(tree.x-340));
  // Root-bed authoring is pinned to the original terrain. A local footing
  // sculpt may re-ground records, but must not select a different tree and
  // silently relocate the existing seeded plant communities.
  const dx=capeGroundHeight(tree.x+.5,tree.z,{bridges:false,rootFooting:false})-capeGroundHeight(tree.x-.5,tree.z,{bridges:false,rootFooting:false});
  const dz=capeGroundHeight(tree.x,tree.z+.5,{bridges:false,rootFooting:false})-capeGroundHeight(tree.x,tree.z-.5,{bridges:false,rootFooting:false});
  const authoredSlope=1-1/Math.sqrt(1+dx*dx+dz*dz);
  const score=distance*.2+authoredSlope*8+shoulder*.20;
  if(score<best){best=score;selected=tree;}
 }
 if(!selected)return null;
 const pathX=Math.abs(selected.x-222)<Math.abs(selected.x-340)?222:340;
 return {treeId:selected.id,pathX,x:pathX+Math.sign(selected.x-pathX)*2.7,z:selected.z-.8};
}
export function capeBilberryRootPocketField(x,z,pocket){
 if(!pocket)return 0;
 const u=x-pocket.x+.25*Math.sin(z*.9),v=z-pocket.z+(x-pocket.x)*.2;
 return (1-smooth(.15,1.1,Math.hypot(u/.95,v/7.2)))*(1-capeTrailSurfaceMask(x,z));
}

// Rooted shoulders are accumulations, not a parallel planted edging row.
// Their taper follows a real footing toward the unused trail margin; lobed
// lee pockets break the outer edge while the central travel surface stays bare.
export function makeCapeRootShoulders(forest){
 const prototype=makeCapeBilberryRootPrototype(forest),first=forest.find(t=>t.id===prototype?.treeId),selected=[];
 const candidates=[...(first?[first]:[]),...forest.filter(t=>t!==first&&t.id.startsWith('cape-forest-')&&t.habitat!=='young-edge')];
 for(const tree of candidates){
  const pathX=Math.abs(tree.x-222)<Math.abs(tree.x-340)?222:340,distance=Math.abs(tree.x-pathX);
  if(tree.z<334||tree.z>399||distance<2.8||distance>7.2||tree.height<8||capeSurfaceFields(tree.x,tree.z).bankDistance<9)continue;
  if(selected.some(p=>Math.hypot(tree.x-p.treeX,tree.z-p.treeZ)<11))continue;
  const h=capeGroundHeight(tree.x,tree.z,{bridges:false});
  const gx=(capeGroundHeight(tree.x+1,tree.z,{bridges:false})-capeGroundHeight(tree.x-1,tree.z,{bridges:false}))/2;
  const gz=(capeGroundHeight(tree.x,tree.z+1,{bridges:false})-capeGroundHeight(tree.x,tree.z-1,{bridges:false}))/2;
  const gradient=Math.hypot(gx,gz),upX=gradient>.015?gx/gradient:Math.sign(tree.x-pathX),upZ=gradient>.015?gz/gradient:0;
  const hollow=capeGroundHeight(tree.x+2,tree.z,{bridges:false})+capeGroundHeight(tree.x-2,tree.z,{bridges:false})+capeGroundHeight(tree.x,tree.z+2,{bridges:false})+capeGroundHeight(tree.x,tree.z-2,{bridges:false})-4*h;
  selected.push({treeId:tree.id,treeX:tree.x,treeZ:tree.z,pathX,side:Math.sign(tree.x-pathX),species:tree.species,upX,upZ,gradient,retention:smooth(-.5,1.3,hollow)});
  if(selected.length===6)break;
 }
 return selected;
}
export function capeRootShoulderField(x,z,shoulders){
 let cover=0,surfaceCover=0,moss=0,mineral=0,litter=1;
 for(const p of shoulders){
  const inward=p.side*(x-p.pathX),v=z-p.treeZ;
  const rootDistance=Math.abs(p.treeX-p.pathX);
  const spine=2.55+(rootDistance-2.55)*Math.exp(-v*v/13)+.32*Math.sin(v*.8);
  const u=inward-spine;
  const width=1.05+.55*Math.exp(-v*v/8)+.25*Math.sin(v*.72+1.3);
  const q=Math.hypot(u/width,v/6.8);
  const lobe=1-smooth(.35,1.08,q);
  const root=1-smooth(.45,2.05,Math.hypot(x-p.treeX,z-p.treeZ));
  const middle=(rootDistance+2.55)*.5,reach=(rootDistance-2.55)*.5+.8;
  const link=1-smooth(.4,1.05,Math.hypot((inward-middle)/reach,v/1.7));
  const mask=Math.max(lobe,root,link)*(smooth(1.5,1.9,capeTrailCentreDistance(x,z)));
  cover=Math.max(cover,mask);
  // The physical footing owns this catchment. Positive along is uphill:
  // raised roots trap litter there; lower sheltered soil retains moss.
  // Cover above remains the original placement authority, unchanged.
  const dx=x-p.treeX,dz=z-p.treeZ,along=dx*p.upX+dz*p.upZ,cross=-dx*p.upZ+dz*p.upX;
  const catchment=(1-smooth(.35,1.12,Math.hypot((along+.65)/4.5,cross/3.1)))*smooth(1.5,1.9,capeTrailCentreDistance(x,z));
  const strength=Math.max(mask,catchment);
  if(strength>surfaceCover){
   surfaceCover=strength;
   moss=(.16+.62*(1-smooth(-2,.6,along)))*(.78+.22*p.retention);
   let crossing=0;
   for(let arm=0;arm<3;arm++){
    const angle=(p.side===-1?0:Math.PI)+(arm-1)*1.35;
    const run=dx*Math.cos(angle)+dz*Math.sin(angle),away=-dx*Math.sin(angle)+dz*Math.cos(angle);
    crossing=Math.max(crossing,(1-smooth(.20,.55,Math.abs(away)))*smooth(.3,.7,run)*(1-smooth(1.45,2.2,run)));
   }
   mineral=crossing*.52*(.6+.4*smooth(-.3,1.1,along));
   moss*=1-mineral;litter=1-moss-mineral;
  }
 }
 const footing=capeRootFootingFields(x,z),mix=footing.cover;
 surfaceCover=Math.max(surfaceCover,mix);
 moss=moss*(1-mix)+footing.moss*mix;mineral=mineral*(1-mix)+footing.mineral*mix;litter=1-moss-mineral;
 return {cover,surfaceCover,moss,mineral,litter};
}

export function capeTrailCentreDistance(x,z){
 const north=z>=309&&z<407?Math.min(Math.abs(x-222),Math.abs(x-340)):100;
 const east=x>374?Math.abs(z-(322+(x-374)*.33))/Math.sqrt(1+.33*.33):100;
 return Math.min(north,east);
}

export function capeTrailSurfaceMask(x,z){
  const north=z>=309&&z<407?Math.min(Math.abs(x-222),Math.abs(x-340)):100;
  const east=x>374?Math.abs(z-(322+(x-374)*.33)):100;
  // Footfall owns a clear two-metre centre. Litter gathers asymmetrically on
  // the unused physical shoulders; no added plants or collision narrow travel.
  const shoulder=1.8+.32*Math.sin(z*.63)+.18*Math.sin(x*.37+z*.21);
  return 1-smooth(1,shoulder,Math.min(north,east));
}

// World XZ metres own every channel. These fields describe the existing physical
// terrain; they never displace it or substitute a second ground authority.
export function capeSurfaceFields(x,z){
  const height=capeGroundHeight(x,z,{bridges:false}),path=capePathMask(x,z),trail=capeTrailSurfaceMask(x,z);
  const dx=(capeGroundHeight(x+.5,z,{bridges:false})-capeGroundHeight(x-.5,z,{bridges:false}));
  const dz=(capeGroundHeight(x,z+.5,{bridges:false})-capeGroundHeight(x,z-.5,{bridges:false}));
  const slope=1-1/Math.sqrt(1+dx*dx+dz*dz);
  const riverReach=x>=CAPE_TERRAIN.minX&&x<=432&&z>325;
  const bankDistance=riverReach?Math.abs(z-capeStreamZ(x))-capeStreamWidth(x):1000;
  const bank=riverReach?(1-smooth(3,8,bankDistance))*smooth(-.4,.7,bankDistance):0;
  const wetness=riverReach?(1-smooth(.08,.85,height-capeStreamLevel(x)))*(1-smooth(2,6,bankDistance)):0;
  const woodland=Math.max(smooth(314,334,z),smooth(380,402,x));
  const patch=soilPatch(x,z);
  // A steep wooded hill is loam, not automatically exposed pale bedrock.
  // Mineral faces belong to authored rock lenses, wet banks and salt-scoured
  // shore margins; slope only strengthens those existing causes.
  const salt=1-smooth(1,7,Math.min(x-128,448-x,416-z));
  let exposedStone=clamp(capeBedrockField(x,z).stone*.93+bank*smooth(.28,.7,patch)*.62+salt*smooth(.035,.17,slope)*.55)*(1-path);
  const grove=capeGroveField(x,z).strength;
  const leafLitter=woodland*Math.max(smooth(.28,.74,patch),grove*.67)*(1-trail)*(1-wetness);
  const front=x>=384&&z<120?capeResidentialNaturalFields(x,z):null;
  if(front)exposedStone=front.stone;
  return {height,path,trail,slope,bankDistance,bank,wetness:front?front.wetness*.7:wetness,woodland,patch,exposedStone,leafLitter,heathBed:capeHeathBedField(x,z),bilberryBed:capeBilberryBedField(x,z)};
}
export function capeBiomeWeights(x,z,roots={}){
  const f=capeSurfaceFields(x,z),grove=capeGroveField(x,z);
  const stone=f.exposedStone,birch=(grove.grove===0?grove.strength*.68:0)*(1-f.trail)*(1-stone);
  const moss=(.18+f.wetness*.48+(1-f.patch)*.40+f.heathBed*.4+(roots.bilberry||0)*.35)*(1-f.trail*.75)*(1-stone)*(1-birch);
  const trail=f.trail;
  const total=Math.max(1,stone+birch+moss);
  const peat=capeTrailPeatField(x,z);
  const weights=[Math.max(0,1-(stone+birch+moss)/total)*(1-trail)+trail*peat,moss/total*(1-trail),birch/total*(1-trail),stone/total*(1-trail)+trail*(1-peat)];
  const rootCover=Math.min(.85,Math.max(roots.pine||0,roots.birch||0))*(1-trail)*(1-stone);
  return weights.map((w,i)=>w*(1-rootCover)+(i===(roots.birch>roots.pine?2:0)?rootCover:0));
}

export function capeTrailPeatField(x,z){
 // Pressed organic soil persists in sheltered woodland; exposed coast and
 // washed approaches retain more mineral aggregate. No visual or solid path
 // width changes: this only partitions existing material roles.
 const shelter=capeGroveField(x,z).strength;
 const bank=Math.max(0,1-Math.abs(z-capeStreamZ(x))/(capeStreamWidth(x)+12));
 // Trampled core holds pressed residue rather than a loose needle blanket.
 return .13+shelter*.12+bank*.06;
}

export function capeDetailClear(x,z,radius=0){
  if(x<130+radius||x>446-radius||z<120+radius||z>414-radius)return false;
  if(z<316+radius&&x<386+radius)return false;
  for(const [dx,dz]of [[0,0],[-radius,0],[radius,0],[0,-radius],[0,radius]]){
    const f=capeSurfaceFields(x+dx,z+dz);
    if(f.path>.015||f.bankDistance<.65)return false;
    for(const bx of CAPE_TERRAIN.bridges)if(Math.abs(x+dx-bx)<3.1&&Math.abs(z+dz-capeStreamZ(bx))<12)return false;
  }
  return true;
}
