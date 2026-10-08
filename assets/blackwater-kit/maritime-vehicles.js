import * as THREE from '../../vendor/three.module.js';
import {mergeGeometries} from '../../vendor/utils/BufferGeometryUtils.js';
import {BlackwaterPaintedMaterial} from '../../blackwater-render-looks.js';
import {lights} from '../../vendor/three.tsl.js';

export const MARITIME_PALETTE={paint:'#668782',red:'#985d49',cream:'#c7c6b0',steel:'#829393',dark:'#293c40',glass:'#496c79',rubber:'#283633',wood:'#83735b',rope:'#b3aa8c'};
// All kit parts are local metres, +X forward. Caller merges static placements by
// material; no material or texture is allocated per prop.
export function makeMaritimeKit(kind){
 const parts=new Map(Object.keys(MARITIME_PALETTE).map(k=>[k,[]]));
 const put=(s,g)=>parts.get(s).push(g);
 const box=(s,p,size,a=0)=>{const g=new THREE.BoxGeometry(...size);g.rotateZ(a);g.translate(...p);put(s,g);};
 const rod=(s,a,b,r=.035,n=7)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av),g=new THREE.CylinderGeometry(r,r,d.length(),n);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(...av.add(bv).multiplyScalar(.5).toArray());put(s,g);};
 const ring=(s,p,r,t)=>{const g=new THREE.TorusGeometry(r,t,5,12);g.translate(...p);put(s,g);};
 const boat=['trawler','launch','skiff'].includes(kind);
 if(boat){
  const L=kind==='trawler'?12:kind==='launch'?8.4:5.8,B=kind==='trawler'?3.6:kind==='launch'?2.8:1.95,D=kind==='trawler'?1.8:kind==='launch'?1.25:.85;
  const sections=[[-.5,.68],[-.38,.95],[-.18,1],[.12,.98],[.35,.69],[.5,.025]],p=[],idx=[],N=10;
  for(const [s,w]of sections)for(let j=0;j<=N;j++){const t=j/N*Math.PI;p.push(s*L,.60+Math.max(0,s)*.5-Math.sin(t)*D,Math.cos(t)*B*w/2);}
  for(let i=0;i<sections.length-1;i++)for(let j=0;j<N;j++){const a=i*(N+1)+j,b=a+N+1;idx.push(a,a+1,b,a+1,b+1,b);}
  for(const [i,reverse] of [[0,true],[sections.length-1,false]]){const center=p.length/3,[s]=sections[i];p.push(s*L,.3+Math.max(0,s)*.5,0);for(let j=0;j<N;j++){const a=i*(N+1)+j;idx.push(center,reverse?a+1:a,reverse?a:a+1);}}
  const hull=new THREE.BufferGeometry();hull.setAttribute('position',new THREE.Float32BufferAttribute(p,3));hull.setIndex(idx);hull.computeVertexNormals();put(kind==='trawler'?'red':'paint',hull);
  // A shaped deck closes the sheer line instead of a rectangular floating slab.
  const dp=[],di=[];
  for(const [s,w]of sections)dp.push(s*L,.59+Math.max(0,s)*.5,-B*w/2,s*L,.59+Math.max(0,s)*.5,B*w/2);
  for(let i=0;i<sections.length-1;i++){const a=i*2;di.push(a,a+1,a+2,a+1,a+3,a+2);}
  const deck=new THREE.BufferGeometry();deck.setAttribute('position',new THREE.Float32BufferAttribute(dp,3));deck.setIndex(di);deck.computeVertexNormals();put('wood',deck);
  for(const side of [-1,1])for(let i=0;i<sections.length-1;i++){const [s,w]=sections[i],[ss,ww]=sections[i+1];rod('cream',[s*L,.66+Math.max(0,s)*.5,side*B*w/2],[ss*L,.66+Math.max(0,ss)*.5,side*B*ww/2],.07);}
  for(const side of [-1,1])for(const x of [-L*.31,0,L*.25]){const z=side*B*.48;rod('rope',[x,.7,z],[x,.14,z+.10*side],.026);const g=new THREE.CylinderGeometry(.13,.17,.42,8);g.translate(x,.08,z+.10*side);put('rubber',g);}
  for(const x of [-L*.35,L*.32])for(const side of [-1,1]){const z=side*B*.27;rod('steel',[x,.66,z],[x,.83,z],.04);rod('steel',[x-.14,.81,z],[x+.14,.81,z],.035);}
  if(kind!=='skiff'){
   const cx=kind==='trawler'?.9:.25,cw=kind==='trawler'?2.7:2.2;
   box('cream',[cx,1.07,0],[cw,.95,B*.7]);box('dark',[cx,1.82,0],[cw,.62,B*.68]);
   for(const side of [-1,1]){box('glass',[cx,1.82,side*B*.345],[cw*.82,.43,.025]);for(const x of [cx-cw*.44,cx+cw*.44,cx])box('cream',[x,1.84,side*B*.35],[.065,.62,.065]);}
   box('glass',[cx+cw*.505,1.82,0],[.025,.44,B*.60],.13);box('cream',[cx,2.18,0],[cw+ .3,.13,B*.83]);
   rod('steel',[cx-.5,2.22,0],[cx-.5,kind==='trawler'?5.3:3.5,0],.065);
   rod('steel',[cx-.5,kind==='trawler'?4.65:3.1,-B*.52],[cx-.5,kind==='trawler'?4.65:3.1,B*.52],.045);
   if(kind==='trawler'){for(const side of [-1,1]){rod('steel',[-3,.7,side*B*.42],[-3,3.3,side*B*.42],.07);rod('rope',[-3,3.3,side*B*.42],[cx-.5,4.65,0],.023);}rod('steel',[-3,3.3,-B*.42],[-3,3.3,B*.42],.07);box('wood',[-3.8,.82,0],[1.4,.4,1.1]);ring('red',[cx+cw*.51,1.10,0],.30,.08);}
   else box('paint',[-2.6,.87,0],[1.1,.45,1.6]);
  }else{for(const x of [-1.8,-.3,1])box('wood',[x,.57,0],[.27,.11,B*.75]);box('dark',[-L*.51,.55,0],[.28,.55,.4]);rod('wood',[-1,.82,-.4],[1.9,.82,.8],.045);}
 }else{
  const van=kind==='van',estate=kind==='estate',L=van?5.4:4.65,W=van?2.05:1.83;
  const paint=van?'cream':'paint',wx=[-L*.32,L*.31];
  box('dark',[0,.48,0],[L-.40,.17,W-.40]);
  // Open wheel arches are part of the side silhouette, not painted disks.
  const sideShape=new THREE.Shape();sideShape.moveTo(-L/2,.52);
  for(const x of wx){sideShape.lineTo(x-.49,.52);for(let i=0;i<=12;i++){const t=Math.PI-.18-i/12*(Math.PI-.36);sideShape.lineTo(x+Math.cos(t)*.5,.43+Math.sin(t)*.5);}}
  sideShape.lineTo(L/2,.52);sideShape.lineTo(L/2,1.06);sideShape.lineTo(1.08,1.28);sideShape.lineTo(-L/2+.12,1.28);sideShape.lineTo(-L/2,1.06);sideShape.closePath();
  const body=new THREE.ExtrudeGeometry(sideShape,{depth:W,bevelEnabled:false,steps:1,curveSegments:1});body.setIndex(Array.from({length:body.attributes.position.count},(_,i)=>i));body.translate(0,0,-W/2);put(paint,body);
  // Longitudinal sections form a genuinely raked windshield and narrower roof.
  const loft=(slot,sections)=>{const pos=[],ii=[];for(const [x,b,t,wb,wt]of sections)pos.push(x,b,-wb,x,b,wb,x,t,wt,x,t,-wt);for(let i=0;i<sections.length-1;i++)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4,c=a+4,d=b+4;ii.push(a,b,c,b,d,c);}ii.push(0,2,1,0,3,2);const end=(sections.length-1)*4;ii.push(end,end+1,end+2,end,end+2,end+3);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));for(let i=0;i<ii.length;i+=3){const t=ii[i+1];ii[i+1]=ii[i+2];ii[i+2]=t;}g.setIndex(ii);g.computeVertexNormals();put(slot,g);};
  const roofY=van?2.27:2.02,back=van?-2.40:-1.78,roofBack=van?-2.30:-1.52,roofFront=van?.58:.62,windBottom=van?1.29:1.36;
  loft('glass',[[back,1.29,1.56,W*.48,W*.45],[roofBack,1.29,roofY,W*.48,W*.405],[roofFront,1.29,roofY,W*.48,W*.405],[windBottom,1.29,1.34,W*.48,W*.475]]);
  loft(paint,[[windBottom,1.25,1.34,W*.49,W*.475],[L/2,1.02,1.09,W*.48,W*.46]]);
  box(paint,[(roofBack+roofFront)/2,roofY+.045,0],[roofFront-roofBack+.13,.10,W*.84]);
  for(const side of [-1,1]){
   const lowerZ=side*W*.487,upperZ=side*W*.411;
   rod(paint,[windBottom,1.30,lowerZ],[roofFront,roofY,upperZ],.045);
   rod(paint,[back,1.31,lowerZ],[roofBack,roofY,upperZ],.045);
   for(const x of [van?-.20:-.43,van?-1.4:-1.0])rod(paint,[x,1.30,lowerZ],[x,roofY,upperZ],.035);
   rod(paint,[back,1.32,lowerZ],[windBottom,1.32,lowerZ],.033);
   box('steel',[.05,1.20,side*(W/2+.02)],[.20,.045,.035]);box('dark',[1.14,1.50,side*(W/2+.09)],[.18,.14,.12]);
   // Rounded lips stand just outside the real body openings.
   for(const x of wx)for(let i=0;i<8;i++){const a=.18+i/8*(Math.PI-.36),b=.18+(i+1)/8*(Math.PI-.36);rod(paint,[x+Math.cos(a)*.51,.43+Math.sin(a)*.51,side*(W/2+.012)],[x+Math.cos(b)*.51,.43+Math.sin(b)*.51,side*(W/2+.012)],.024,5);}
  }
  if(van){for(const side of [-1,1]){box('cream',[-1.45,1.70,side*(W*.47)],[1.55,.73,.045]);box('red',[-1.45,1.62,side*(W*.475+.026)],[1.43,.13,.018]);}box('cream',[back-.015,1.70,0],[.04,.78,W*.86]);}
  for(const x of [-L/2,L/2]){box('steel',[x,.60,0],[.14,.16,W+.08]);box('dark',[x,.87,0],[.03,.16,.6]);for(const side of [-1,1])box(x>0?'cream':'red',[x,.99,side*W*.35],[.05,.16,.25]);}
  for(const x of wx)for(const side of [-1,1]){rod('rubber',[x,.43,side*(W/2-.14)],[x,.43,side*(W/2+.09)],.43,16);rod('steel',[x,.43,side*(W/2+.091)],[x,.43,side*(W/2+.105)],.23,12);}
  if(estate){for(const side of [-1,1])rod('steel',[-1.45,roofY+.16,side*.57],[.56,roofY+.16,side*.57],.035);box('wood',[-.6,roofY+.29,0],[1.2,.24,.9]);}
 }
 return parts;
}
export function createMaritimeMaterials(lightSources=[]){const illumination=lights(lightSources.filter(x=>x?.isLight));return new Map(Object.entries(MARITIME_PALETTE).map(([s,c])=>{const m=new BlackwaterPaintedMaterial({color:c});m.name=`Maritime:${s}`;m.lightsNode=illumination;return[s,m];}));}
export function mergeMaritimeParts(parts){return new Map([...parts].filter(([,list])=>list.length).map(([slot,list])=>{for(const p of list){p.deleteAttribute('uv');if(!p.hasAttribute('color'))p.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(p.attributes.position.count*3).fill(1),3));}const g=mergeGeometries(list);for(const p of list)p.dispose();return[slot,g];}));}
