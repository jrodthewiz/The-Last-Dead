import {terrainHeight,roadAt} from './data.js';
import {reservedPlace} from './places.js';
import {accessReserved} from './access-plan.js';
import {settlementReserved} from './settlement-plan.js';
import {orchardReserved} from './land-use.js';

// Four authored pauses on existing routes. These bounds include their loose
// pieces; the same reservation check gates rendering and physical markers.
const LANDING={id:'landing-waymark',x:-806,z:291,r:1.8,rotation:1.8};
const KEEPER={id:'keeper-boundary',x:-897,z:124,r:3.7,rotation:1.35};
const NURSE={id:'canopy-nurse-log',x:-887.6,z:73.5,r:3.1};
const TOOLS={id:'briar-tool-rest',x:-303,z:-158,r:1.8};
const WOOD=0x74694e,DARK=0x4b4e3b,CUT=0xa3976d,BLUE=0x617f76;

function clear(data,p){
 const road=roadAt(p.x,p.z);
 return terrainHeight(p.x,p.z)>4&&road.distance>road.width/2+p.r+.6&&
  !reservedPlace(p.x,p.z,p.r)&&!settlementReserved(p.x,p.z,p.r)&&
  !orchardReserved(p.x,p.z,p.r)&&!accessReserved(data.accessPaths||[],p.x,p.z,p.r+.5)&&
  !(data.landmarks||[]).some(b=>Math.hypot(p.x-b.x,p.z-b.z)<20+p.r)&&
  !data.buildings.some(b=>Math.abs(p.x-b.x)<b.w/2+p.r+3&&Math.abs(p.z-b.z)<b.d/2+p.r+3);
}

function face(kit,p,y,w,h,text){
 const a=p.rotation;
 for(const side of [-1,1])kit.label({x:p.x+Math.sin(a)*.12*side,y,z:p.z+Math.cos(a)*.12*side,w,h,text:side<0?text.replace('→','←'):text,rotation:a+(side<0?Math.PI:0),colour:0x50685b});
}

function stone(kit,x,z,s=.3){
 kit.add('rock',x,terrainHeight(x,z)+s*.24,z,s,s*.48,s*.8,0x858b6b,.7,null,0);
}

function landingMarker(kit){
 const p=LANDING,y=terrainHeight(p.x,p.z),a=p.rotation;
 kit.box(p.x,y+.91,p.z,.22,1.82,.20,DARK,a);
 kit.box(p.x,y+1.50,p.z,2.78,.38,.12,WOOD,a);
 kit.box(p.x,y+1.10,p.z,2.48,.32,.12,0x7d7255,a);
 face(kit,p,y+1.50,2.57,.28,'WESTERN TRAIL');
 face(kit,p,y+1.10,2.28,.23,'CORMORANT  →');
 // Exposed pale grain and uneven end battens weather the outside edge.
 for(const [u,h,length] of [[-1.24,1.66,.22],[.94,1.34,.35],[-1.08,.96,.25]]){
  const x=p.x+Math.cos(a)*u+Math.sin(a)*.078,z=p.z-Math.sin(a)*u+Math.cos(a)*.078;
  kit.box(x,y+h,z,length,.025,.016,CUT,a);
 }
 kit.box(p.x,y+.48,p.z,.235,.12,.215,BLUE,a);
 stone(kit,p.x-.45,p.z+.22,.31);stone(kit,p.x+.24,p.z-.26,.23);
}

function keeperMarker(kit){
 const p=KEEPER,y=terrainHeight(p.x,p.z),a=p.rotation;
 kit.box(p.x,y+.43,p.z,.23,.86,.22,0x655e45,a);
 kit.rod([p.x-.06,y+.80,p.z],[p.x-.065,y+.96,p.z+.025],.045,CUT);
 kit.box(p.x,y+.69,p.z,1.40,.27,.10,WOOD,a);
 face(kit,p,y+.69,1.23,.19,'KEEPER’S WAY');
 kit.box(p.x,y+.44,p.z,.245,.11,.235,BLUE,a);
 // A short collapsed boundary runs away from the open walking shoulder.
 for(const [x,z,s] of [[-898.25,123.85,.37],[-899.12,123.24,.31],[-900,122.62,.34]])stone(kit,x,z,s);
 const x=-898.05,z=124.75;
 kit.rod([x-.48,terrainHeight(x-.48,z-.15)+.08,z-.15],[x+.48,terrainHeight(x+.48,z+.15)+.08,z+.15],.075,WOOD);
}

function nurseLog(kit){
 // A low, rotting trunk below the existing pine canopy. Short sections follow
 // the triangulated slope; even its cut ends remain below step height.
 const points=[[-889.1,72.8],[-888.1,73.27],[-887.1,73.73],[-886.1,74.2]];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  kit.rod([a[0],terrainHeight(...a)+.155,a[1]],[b[0],terrainHeight(...b)+.155,b[1]],.15,i===2?0x55543b:0x625d42);
 }
 for(const [a,b] of [[points[0],points[1]],[points[3],points[2]]]){
  const x=a[0]+(b[0]-a[0])*.035,z=a[1]+(b[1]-a[1])*.035;
  kit.rod([a[0],terrainHeight(...a)+.155,a[1]],[x,terrainHeight(x,z)+.155,z],.152,CUT);
 }
 for(const [x,z,s] of [[-888.75,73.7,.85],[-888.05,74.05,1.10],[-887.25,74.55,1.18],[-886.45,75,.90],[-888.55,75.1,1],[-887.55,75.65,.82],[-885.9,74.1,.75]]){
  kit.add('fern',x,terrainHeight(x,z)-.02,z,s,s,s,s>1?0x6f8247:0x586e43,x*.17,null,4);
 }
 for(const [x,z] of [[-888.8,72.65],[-887.5,73.45],[-886.3,74.02]])
  kit.add('rock',x,terrainHeight(x,z)+.25,z,.32,.09,.24,0x70794a,.5,null,4);
}

function toolRest(kit){
 // A closed canvas roll and flat survey tools anticipate Briar's abandoned
 // work site. Nothing here has a supply-box silhouette or interaction role.
 const lay=(a,b,r,c,lift=.09)=>kit.rod([a[0],terrainHeight(...a)+lift,a[1]],[b[0],terrainHeight(...b)+lift,b[1]],r,c);
 lay([-304.05,-158.85],[-302.35,-157.96],.035,0x897650,.11);
 lay([-302.57,-157.60],[-302.17,-158.32],.055,0x626b5c,.12);
 lay([-303.7,-157.90],[-303.05,-159.01],.105,0x777459,.11);
 for(const t of [.25,.77]){
  const x=-303.7+.65*t,z=-157.90-1.11*t;
  lay([x-.015,z+.026],[x+.015,z-.026],.111,0x4f5945,.11);
 }
 // The survey staff is packed beside the roll, its faded bands still visible.
 const a=[-304.25,-158.63],b=[-302.70,-157.78];
 for(let i=0;i<6;i++){
  const at=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  lay(at(i/6),at((i+1)/6),.024,i%2?0x9c9670:0x6c7355,.065);
 }
}

// Call after coastalBotany has registered the shared fern geometry.
export function routeCraft(kit,data){
 let clusters=0;
 for(const [p,draw] of [[LANDING,landingMarker],[KEEPER,keeperMarker],[NURSE,nurseLog],[TOOLS,toolRest]])
  if(clear(data,p)){draw(kit);clusters++;}
 return {clusters};
}

export function routeCraftSolids(data){
 const solids=[];
 const box=(p,suffix,w,h,d,lift)=>{
  const c=Math.abs(Math.cos(p.rotation)),s=Math.abs(Math.sin(p.rotation));
  solids.push({id:p.id+'-'+suffix,x:p.x,z:p.z,w:w*c+d*s,d:w*s+d*c,y:terrainHeight(p.x,p.z)+lift-h/2,h});
 };
 if(clear(data,LANDING)){
  box(LANDING,'post',.22,1.82,.20,.91);
  box(LANDING,'trail-board',2.78,.38,.12,1.50);
  box(LANDING,'lookout-board',2.48,.32,.12,1.10);
 }
 if(clear(data,KEEPER)){
  box(KEEPER,'post',.25,.96,.25,.48);
  box(KEEPER,'board',1.40,.27,.10,.69);
 }
 return solids;
}
