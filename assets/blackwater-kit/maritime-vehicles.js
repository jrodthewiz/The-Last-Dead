import * as THREE from '../../vendor/three.module.js';
import {mergeGeometries} from '../../vendor/utils/BufferGeometryUtils.js';
import {BlackwaterPaintedMaterial} from '../../blackwater-render-looks.js';
import {MeshStandardNodeMaterial} from '../../vendor/three.webgpu.js';
import {lights,color,float,positionWorld,positionGeometry,normalGeometry,normalWorld,cameraPosition,mix,mx_noise_float,vec3,vec4,attribute,uniformArray} from '../../vendor/three.tsl.js';

export const MARITIME_PALETTE={paint:'#668782',red:'#985d49',cream:'#c7c6b0',steel:'#829393',dark:'#293c40',glass:'#496c79',rubber:'#283633',wood:'#83735b',rope:'#b3aa8c'};
// All kit parts are local metres, +X forward. Caller merges static placements by
// material; no material or texture is allocated per prop.
export function makeMaritimeKit(kind){
 const parts=new Map(Object.keys(MARITIME_PALETTE).map(k=>[k,[]]));
 const put=(s,g)=>parts.get(s).push(g);
 const box=(s,p,size,a=0)=>{const g=new THREE.BoxGeometry(...size);g.rotateZ(a);g.translate(...p);put(s,g);};
 const rod=(s,a,b,r=.035,n=7)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av),g=new THREE.CylinderGeometry(r,r,d.length(),n);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(...av.add(bv).multiplyScalar(.5).toArray());put(s,g);};
 const ring=(s,p,r,t)=>{const g=new THREE.TorusGeometry(r,t,5,12);g.translate(...p);put(s,g);};
 const pane=(corners,tag)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(corners.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();g.userData.part=tag;put('glass',g);};
 const chamferVolume=(slot,cx,width,beam,bottom,top,inset=.08,rake=0,tag='')=>{
  const contour=(y,shrink,shift)=>{const a=cx-width/2+shrink+shift,b=cx+width/2-shrink+shift,z=beam/2-shrink,c=.17;return[[a+c,y,-z],[b-c,y,-z],[b,y,-z+c],[b,y,z-c],[b-c,y,z],[a+c,y,z],[a,y,z-c],[a,y,-z+c]];};
  const lo=contour(bottom,0,0),hi=contour(top,inset,rake),positions=[...lo,...hi].flat(),indices=[];
  for(let j=0;j<8;j++){const k=(j+1)%8;indices.push(j,j+8,k,k,j+8,k+8);}for(let j=1;j<7;j++){indices.push(0,j,j+1,8,8+j+1,8+j);}
  const indexed=new THREE.BufferGeometry();indexed.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));indexed.setIndex(indices);const g=indexed.toNonIndexed();indexed.dispose();g.computeVertexNormals();g.userData.part=tag;g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));put(slot,g);
 };
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
  // Working decks have an actual shaped plank rhythm, recessed hatches and
  // raised rub strakes. Detail follows hull stations instead of floating boxes.
  const beamAt=x=>{const q=x/L;let i=sections.findIndex((p,j)=>j<sections.length-1&&q>=p[0]&&q<=sections[j+1][0]);i=Math.max(0,i);const a=sections[i],b=sections[i+1],t=(q-a[0])/(b[0]-a[0]);return (a[1]+(b[1]-a[1])*t)*B/2;};
  for(let x=-L*.46;x<L*.45;x+=.32){const w=beamAt(x)*.93;box('dark',[x,.602+Math.max(0,x/L)*.5,0],[.013,.011,w*2]);}
  for(const side of [-1,1])for(let i=0;i<sections.length-1;i++){
   const [a,w]=sections[i],[b,ww]=sections[i+1];
   rod('dark',[a*L,.32+Math.max(0,a)*.5,side*B*w/2],[b*L,.32+Math.max(0,b)*.5,side*B*ww/2],.05);
   if(kind!=='skiff'){
    const height=.47;
    rod('steel',[a*L,.68+Math.max(0,a)*.5,side*B*w/2],[a*L,.68+height+Math.max(0,a)*.5,side*B*w/2],.025,6);
    rod('steel',[a*L,.68+height+Math.max(0,a)*.5,side*B*w/2],[b*L,.68+height+Math.max(0,b)*.5,side*B*ww/2],.028,6);
   }
  }
  for(const side of [-1,1])for(let i=0;i<sections.length-1;i++){const [s,w]=sections[i],[ss,ww]=sections[i+1];rod('cream',[s*L,.66+Math.max(0,s)*.5,side*B*w/2],[ss*L,.66+Math.max(0,ss)*.5,side*B*ww/2],.07);}
  for(const side of [-1,1])for(const x of [-L*.31,0,L*.25]){const z=side*B*.48;rod('rope',[x,.7,z],[x,.14,z+.10*side],.026);const g=new THREE.CylinderGeometry(.13,.17,.42,8);g.translate(x,.08,z+.10*side);put('rubber',g);}
  for(const x of [-L*.35,L*.32])for(const side of [-1,1]){const z=side*B*.27;rod('steel',[x,.66,z],[x,.83,z],.04);rod('steel',[x-.14,.81,z],[x+.14,.81,z],.035);}
  if(kind!=='skiff'){
   const cx=kind==='trawler'?.9:.25,cw=kind==='trawler'?2.7:2.2;
   chamferVolume('cream',cx,cw,B*.70,.61,1.54,.04,-.04,'WheelhouseLower');
   chamferVolume('dark',cx-.04,cw-.08,B*.62,1.53,2.08,.06,-.13,'WheelhouseWindowRecess');
   chamferVolume('cream',cx-.12,cw+.25,B*.81,2.10,2.22,.035,0,'WheelhouseRoof');
   const frontLow=cx+cw/2-.05,frontHigh=frontLow-.16;
   for(const side of [-1,1]){
    const lowerZ=side*(B*.31+.012),upperZ=side*(B*.31-.05),edge=cw*.39;
    for(let bay=0;bay<3;bay++){const a=cx-edge+bay*(2*edge/3)+.035,b=cx-edge+(bay+1)*(2*edge/3)-.035;
     const q=[[a,1.62,lowerZ],[b,1.62,lowerZ],[b-.12,2.00,upperZ],[a-.12,2.00,upperZ]];pane(side>0?q:q.reverse(),'WheelhouseSidePane');}
    for(const x of [cx-edge,cx-edge/3,cx+edge/3,cx+edge])rod('cream',[x,1.55,side*B*.323],[x-.12,2.07,side*(B*.31-.035)],.035,6);
   }
   for(const side of [-1,1]){const a=side<0?-B*.265:.035,b=side<0?-.035:B*.265;pane([[frontLow,1.62,a],[frontHigh,2.00,a],[frontHigh,2.00,b],[frontLow,1.62,b]],'WheelhouseFrontPane');}
   for(const z of [-B*.28,0,B*.28])rod('cream',[frontLow+.028,1.54,z],[frontHigh+.028,2.08,z],.035,6);
   // Window mullions, deep roof eaves, a working door and rear windows make
   // the wheelhouse a constructed volume from both land and water approaches.
   chamferVolume('dark',cx-.12,cw+.24,B*.80,2.06,2.105,.02,0,'WheelhouseRoofDrip');
   box('dark',[cx-cw*.51,1.17,-B*.19],[.025,.94,.65]);
   box('wood',[cx-cw*.525,1.18,-B*.19],[.028,.82,.54]);
   box('glass',[cx-cw*.54,1.75,B*.17],[.022,.35,B*.26]);
   rod('steel',[cx-cw*.54,.81,-B*.41],[cx-cw*.54,.81,B*.41],.026,6);
   for(const z of [-.22,.22])rod('steel',[cx-cw*.54,.70,z],[cx-cw*.54,1.0,z],.02,6);
   // Roof radar, lantern and funnel have distinct silhouettes and bases.
   const radarX=cx+.65;
   rod('steel',[radarX,2.24,0],[radarX,2.65,0],.04,8);
   box('cream',[radarX,2.66,0],[.24,.12,.84]);
   rod('dark',[cx-.70,2.22,B*.17],[cx-.70,2.65,B*.17],.10,8);
   ring('steel',[cx+.24,2.30,-B*.18],.12,.025);
   box('glass',[cx,2.30,-B*.34],[.11,.16,.10]);
   // Cargo hatch rims define a recessed aft work area; a winch and ropes give
   // the deck functional scale without hiding it beneath arbitrary scatter.
   const hx=kind==='trawler'?-3.0:-2.5;
   box('dark',[hx,.62,0],[1.62,.065,1.02]);box('wood',[hx,.67,0],[1.46,.055,.86]);
   for(const z of [-.47,.47])rod('steel',[hx-.74,.72,z],[hx+.74,.72,z],.022,6);
   for(const x of [hx-.58,hx+.58])box('steel',[x,.713,0],[.085,.035,.77]);
   rod('steel',[hx+.93,.69,0],[hx+.93,.98,0],.045,8);
   rod('dark',[hx+.93,.97,-.22],[hx+.93,.97,.22],.16,10);
   rod('rope',[hx+.93,.97,-.12],[hx+.93,.97,.12],.18,10);
   for(let loop=0;loop<3;loop++){const g=new THREE.TorusGeometry(.24-loop*.045,.023,4,14);g.rotateX(Math.PI/2);g.translate(hx-.55,.75,kind==='trawler'?-.85:-.75);put('rope',g);}
   // Bow anchor and windlass form one mounted working assembly, leaving the
   // surrounding deck clear rather than scattering unrelated cargo boxes.
   const ax=L*.34,ay=.59+.34*.5;
   box('dark',[ax,ay+.035,0],[.80,.07,.60]);rod('steel',[ax,ay+.23,-.30],[ax,ay+.23,.30],.09,10);
   for(const side of [-1,1]){const drum=new THREE.CylinderGeometry(.16,.16,.10,10);drum.rotateX(Math.PI/2);drum.translate(ax,ay+.23,side*.22);drum.userData.part='BoatWindlass';put('steel',drum);}
   rod('steel',[ax+.30,ay+.10,0],[ax+.90,ay+.10,0],.035,8);rod('steel',[ax+.88,ay+.10,0],[ax+.55,ay+.10,-.25],.035,8);rod('steel',[ax+.88,ay+.10,0],[ax+.55,ay+.10,.25],.035,8);
   for(let j=0;j<4;j++)ring('dark',[ax+.1+j*.11,ay+.12,0],.06,.013);
   if(kind==='trawler')for(const [px,py,pz]of [[-4.25,.91,.48],[-4.25,1.40,.48]]){
    box('wood',[px,py-.25,pz],[.83,.055,.71]);
    for(const side of [-1,1]){for(const y of [py-.24,py+.21])rod('steel',[px-.40,y,pz+side*.34],[px+.40,y,pz+side*.34],.016,5);for(const xx of [-.40,0,.40])rod('steel',[px+xx,py-.24,pz+side*.34],[px+xx,py+.21,pz+side*.34],.013,5);}
    for(const xx of [-.40,.40])for(const y of [py-.24,py+.21])rod('steel',[px+xx,y,pz-.34],[px+xx,y,pz+.34],.016,5);
    for(const xx of [-.24,0,.24])rod('rope',[px+xx,py+.21,pz-.34],[px+xx,py+.21,pz+.34],.014,5);
   }

   rod('steel',[cx-.5,2.22,0],[cx-.5,kind==='trawler'?5.3:3.5,0],.065);
   rod('steel',[cx-.5,kind==='trawler'?4.65:3.1,-B*.52],[cx-.5,kind==='trawler'?4.65:3.1,B*.52],.045);
   if(kind==='trawler'){for(const side of [-1,1]){rod('steel',[-3,.7,side*B*.42],[-3,3.3,side*B*.42],.07);rod('rope',[-3,3.3,side*B*.42],[cx-.5,4.65,0],.023);}rod('steel',[-3,3.3,-B*.42],[-3,3.3,B*.42],.07);box('wood',[-4.5,.82,0],[.65,.35,.8]);
    // Net hauling boom, lamp and suspended block over the stern deck.
    rod('steel',[-3,3.3,0],[-4.9,3.1,0],.045);rod('rope',[-4.9,3.1,0],[-4.9,1.1,0],.017,6);ring('dark',[-4.9,2.92,0],.11,.03);
    for(const side of [-1,1]){rod('rope',[-2.3,.76,side*B*.37],[-4.65,.85,side*B*.28],.10,8);rod('rope',[-2.3,.85,side*B*.37],[-4.4,1.04,side*B*.28],.08,7);}
    ring('red',[cx+cw*.51,1.10,0],.30,.08);}
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
  const body=new THREE.ExtrudeGeometry(sideShape,{depth:W-.06,bevelEnabled:true,bevelSize:.03,bevelThickness:.03,bevelSegments:1,steps:1,curveSegments:1});body.setIndex(Array.from({length:body.attributes.position.count},(_,i)=>i));body.translate(0,0,-W/2+.03);
  const bp=body.attributes.position;for(let i=0;i<bp.count;i++){const x=bp.getX(i),y=bp.getY(i),nose=Math.max(0,(x-(L/2-.62))/.62),tail=Math.max(0,(-x-(L/2-.46))/.46),shoulder=Math.max(0,(y-1.05)/.28);bp.setZ(i,bp.getZ(i)*(1-.15*nose-.10*tail-.025*shoulder));}body.computeVertexNormals();body.userData.part='VehicleTaperedBody';put(paint,body);
  // Longitudinal sections form a genuinely raked windshield and narrower roof.
  const loft=(slot,sections)=>{const pos=[],ii=[];for(const [x,b,t,wb,wt]of sections)pos.push(x,b,-wb,x,b,wb,x,t,wt,x,t,-wt);for(let i=0;i<sections.length-1;i++)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4,c=a+4,d=b+4;ii.push(a,b,c,b,d,c);}ii.push(0,2,1,0,3,2);const end=(sections.length-1)*4;ii.push(end,end+1,end+2,end,end+2,end+3);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));for(let i=0;i<ii.length;i+=3){const t=ii[i+1];ii[i+1]=ii[i+2];ii[i+2]=t;}g.setIndex(ii);g.computeVertexNormals();put(slot,g);};
  const roofY=van?2.27:2.02,back=van?-2.40:-1.78,roofBack=van?-2.30:-1.52,roofFront=van?.58:.62,windBottom=van?1.29:1.36;
  // Backing is recessed behind the entire pane, including its high edge.
  // The former high roof/front plane intersected the upper windshield.
  loft('dark',[[back+.06,1.29,1.51,W*.44,W*.40],[roofBack+.06,1.29,roofY-.11,W*.44,W*.375],[roofFront-.06,1.29,roofY-.11,W*.44,W*.375],[windBottom-.07,1.29,1.31,W*.44,W*.435]]);
  for(const side of [-1,1])for(let bay=0;bay<3;bay++){
   const ta=bay/3+.014,tb=(bay+1)/3-.014,lower=t=>back+.06+(windBottom-back-.12)*t,upper=t=>roofBack+.06+(roofFront-roofBack-.12)*t;
   const q=[[lower(ta),1.34,side*W*.48],[lower(tb),1.34,side*W*.48],[upper(tb),roofY-.08,side*W*.405],[upper(ta),roofY-.08,side*W*.405]];pane(side>0?q:q.reverse(),'VehicleSidePane');
  }
  // A continuous crown has shared analytic normals across strip boundaries.
  const wp=[],wn=[],wi=[],du=new THREE.Vector3(),dv=new THREE.Vector3(),nn=new THREE.Vector3(),dy=roofY-.07-1.34;
  for(let row=0;row<2;row++)for(let column=0;column<=5;column++){
   const u=-1+column*2/5,v=row;wp.push(windBottom+(roofFront-windBottom)*v+.045*(1-u*u),1.34+dy*v,u*W*(.475-.07*v));
   du.set(-.09*u,0,W*(.475-.07*v));dv.set(roofFront-windBottom,dy,-.07*W*u);nn.crossVectors(dv,du).normalize();wn.push(...nn.toArray());
  }
  for(let column=0;column<5;column++)wi.push(column,column+6,column+7,column,column+7,column+1);
  const windshield=new THREE.BufferGeometry();windshield.setAttribute('position',new THREE.Float32BufferAttribute(wp,3));windshield.setAttribute('normal',new THREE.Float32BufferAttribute(wn,3));windshield.setIndex(wi);windshield.userData.part='VehicleWindshield';put('glass',windshield);
  loft(paint,[[windBottom,1.23,1.35,W*.47,W*.47],[L/2,1.02,1.09,W*.405,W*.405]]);
  // The bonnet crown sits above tapered wings and falls into a narrower nose.
  for(let strip=0;strip<4;strip++){const a=-1+strip*.5,b=a+.5,p=[];for(const [x,y,width]of [[windBottom,1.35,W*.47],[L/2,1.09,W*.405]])for(const t of [a,b])p.push([x,y+.055*(1-t*t),t*width]);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p.flat(),3));g.setIndex([0,1,2,1,3,2]);g.computeVertexNormals();g.userData.part='VehicleBonnetCrown';put(paint,g);}
  box(paint,[(roofBack+roofFront)/2,roofY+.045,0],[roofFront-roofBack+.13,.10,W*.84]);
  for(const side of [-1,1]){
   const lowerZ=side*W*.487,upperZ=side*W*.411;
   rod(paint,[windBottom,1.30,lowerZ],[roofFront,roofY,upperZ],.045);
   rod(paint,[back,1.31,lowerZ],[roofBack,roofY,upperZ],.045);
   for(const x of [van?-.20:-.43,van?-1.4:-1.0])rod(paint,[x,1.30,lowerZ],[x,roofY,upperZ],.035);
   rod(paint,[back,1.32,lowerZ],[windBottom,1.32,lowerZ],.033);
   rod('dark',[roofBack+.045,roofY-.04,side*W*.410],[roofFront-.025,roofY-.04,side*W*.410],.035,6);
   box('steel',[.05,1.20,side*(W/2+.02)],[.20,.045,.035]);box('dark',[1.14,1.50,side*(W/2+.09)],[.18,.14,.12]);
   // Door shuts follow the pressed lower body and the wheel opening instead
   // of reading as one uninterrupted slab. A sill and rub strip join both.
   const seamZ=side*(W/2+.006),door=[[.0,.61],[.70,.61],[1.03,.98],[1.05,1.27],[.0,1.27]];
   for(let i=0;i<door.length;i++){const a=door[i],b=door[(i+1)%door.length];rod('dark',[a[0],a[1],seamZ],[b[0],b[1],seamZ],.009,4);}
   rod('steel',[-.90,.58,seamZ],[.80,.58,seamZ],.018,5);
   rod('dark',[-L*.43,1.08,seamZ],[L*.42,1.08,seamZ],.016,5);
   // Rounded lips stand just outside the real body openings.
   for(const x of wx)for(let i=0;i<8;i++){const a=.18+i/8*(Math.PI-.36),b=.18+(i+1)/8*(Math.PI-.36);rod(paint,[x+Math.cos(a)*.51,.43+Math.sin(a)*.51,side*(W/2+.012)],[x+Math.cos(b)*.51,.43+Math.sin(b)*.51,side*(W/2+.012)],.024,5);}
  }
  rod(paint,[roofFront,roofY-.04,-W*.411],[roofFront,roofY-.04,W*.411],.035,6);
  if(van){for(const side of [-1,1]){box('cream',[-1.45,1.70,side*(W*.47)],[1.55,.73,.045]);box('red',[-1.45,1.62,side*(W*.475+.026)],[1.43,.13,.018]);}box('cream',[back-.015,1.70,0],[.04,.78,W*.86]);}
  for(const x of [-L/2,L/2]){box('steel',[x,.60,0],[.14,.16,W*.84]);for(const side of [-1,1])rod('steel',[x,.60,side*W*.42],[x-Math.sign(x)*.22,.60,side*W*.49],.075,6);box('dark',[x+Math.sign(x)*.06,.87,0],[.03,.16,.6]);for(const side of [-1,1])box(x>0?'cream':'red',[x+Math.sign(x)*.08,.99,side*W*.35],[.05,.16,.25]);}
  // Recessed radiator slats, framed lamps, plates and wipers establish front
  // scale. They reuse existing slots and remain inside the collider padding.
  for(let i=-2;i<=2;i++)box('steel',[L/2+.090,.82+i*.027,0],[.018,.009,.51]);
  box('cream',[L/2+.075,.61,0],[.018,.095,.32]);box('cream',[-L/2-.075,.69,0],[.018,.095,.32]);
  for(const side of [-1,1]){
   box('dark',[L/2+.070,.99,side*W*.35],[.025,.20,.30]);
   box('cream',[L/2+.095,.99,side*W*.35],[.025,.13,.22]);
   rod('dark',[windBottom+.03,1.34,side*W*.17],[roofFront+.29,roofY-.24,side*W*.24],.012,4);
  }
  for(const x of wx)for(const side of [-1,1]){
   rod('rubber',[x,.43,side*(W/2-.14)],[x,.43,side*(W/2+.09)],.43,16);
   const z=side*(W/2+.105),rim=new THREE.TorusGeometry(.255,.025,4,12);
   rim.translate(x,.43,z);put('steel',rim);
   rod('dark',[x,.43,z-side*.035],[x,.43,z-side*.008],.235,12);
   rod('steel',[x,.43,z],[x,.43,z+side*.016],.095,8);
   for(let spoke=0;spoke<6;spoke++){
    const a=spoke/6*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
    rod('steel',[x+c*.08,.43+s*.08,z],[x+c*.25,.43+s*.25,z],.021,3);
   }
  }
  if(estate){for(const side of [-1,1])rod('steel',[-1.45,roofY+.16,side*.57],[.56,roofY+.16,side*.57],.035);box('wood',[-.6,roofY+.29,0],[1.2,.24,.9]);}
 }
 return parts;
}
export function createMaritimeMaterials(lightSources=[],waterLevel=-1.15,{restFrames,finishSpecs}={}){
 const illumination=lights(lightSources.filter(x=>x?.isLight));
 const body=attribute('maritimeBody','float').toUint();
 const frames=restFrames?uniformArray(restFrames,'mat4'):null,specs=finishSpecs?uniformArray(finishSpecs,'vec4'):null;
 const rest=frames?frames.element(body).mul(vec4(positionGeometry,1)).xyz:positionGeometry;
 const restNormal=frames?frames.element(body).mul(vec4(normalGeometry,0)).xyz:normalGeometry;
 const spec=specs?specs.element(body):vec4(1,1,0,0),boat=specs?spec.z.smoothstep(0,.2):attribute('maritimeBody','float').smoothstep(0,.5),hasCabin=spec.w.smoothstep(0,.2).mul(boat);
 // Plating seams are at the kit's real longitudinal sections. Window-jamb
 // runoff begins below its glazing and tapers toward the cabin's lower sill.
 const longitudinal=rest.x.div(spec.x.max(1));
 const panelDistance=longitudinal.add(.38).abs().min(longitudinal.add(.18).abs()).min(longitudinal.sub(.12).abs()).min(longitudinal.sub(.35).abs());
 const hullSeam=float(1).sub(panelDistance.smoothstep(.003,.012)).mul(float(1).sub(rest.y.smoothstep(.35,.62))).mul(boat);
 const jambDistance=rest.x.sub(spec.z.sub(spec.w.mul(.44))).abs().min(rest.x.sub(spec.z.add(spec.w.mul(.44))).abs()).min(rest.x.sub(spec.z).abs());
 const sideDrain=float(1).sub(jambDistance.smoothstep(.025,.12)).mul(restNormal.z.abs().smoothstep(.45,.85));
 const frontDistance=rest.z.abs().sub(spec.y.mul(.30)).abs(),frontPlane=rest.x.sub(spec.z.add(spec.w.mul(.5))).abs();
 const frontDrain=float(1).sub(frontDistance.smoothstep(.025,.12)).mul(float(1).sub(frontPlane.smoothstep(.04,.16))).mul(restNormal.x.abs().smoothstep(.45,.85));
 const drain=sideDrain.max(frontDrain).mul(rest.y.smoothstep(.62,.95)).mul(float(1).sub(rest.y.smoothstep(1.52,1.65))).mul(hasCabin);
 return new Map(Object.entries(MARITIME_PALETTE).map(([s,c])=>{
  const painted=['paint','red','cream'].includes(s);
  const m=['steel','glass','rubber'].includes(s)||painted?new MeshStandardNodeMaterial({color:c,roughness:s==='glass'?.28:s==='steel'?.38:painted?.54:.87,metalness:s==='steel'?.6:0}):new BlackwaterPaintedMaterial({color:c});m.name=`Maritime:${s}`;m.lightsNode=illumination;
  // Shared, scale-aware maritime wear: broad washed paint, grain and salt
  // streaks. Painted metal retains broad native light response on body curves.
  const grain=mx_noise_float(rest.mul(vec3(2.3,9.0,2.3)),.5,0);
  const wash=mx_noise_float(rest.mul(vec3(.6,1.1,.6)),.5,0);
  const tint=s==='paint'?'#ffffff':c;
  if(painted){
   const saltFilm=wash.smoothstep(.08,.38);
   const wetHeight=mix(positionGeometry.y.sub(waterLevel),rest.y,boat),wetBase=float(1).sub(wetHeight.smoothstep(-.15,.18));
   m.roughnessNode=float(s==='cream'?.58:.45).add(saltFilm.mul(.19)).sub(wetBase.mul(.20));
   m.userData.paintResponse='native rest-frame salt film, plating joints, jamb drainage and wet hull foot; shared slot material';
  }
  if(['paint','red','cream','wood','steel'].includes(s)){
   const streak=mx_noise_float(rest.mul(vec3(5.3,.23,5.3)),.5,0).smoothstep(.10,.38).mul(float(1).sub(restNormal.y.abs()));
   const age=s==='wood'?.16:s==='steel'?.06:.08;
   m.colorNode=color(tint).mul(float(.97).add(grain.mul(age)).add(wash.mul(.08))).mul(float(1).sub(streak.mul(s==='wood'?.10:.065)));
   if(['paint','red'].includes(s)){
    const chips=mx_noise_float(rest.mul(vec3(3.1,5.7,3.1)),.5,0).smoothstep(.16,.32);
    const contact=float(1).sub(mix(positionGeometry.y,rest.y,boat).smoothstep(s==='red'?.08:.7,s==='red'?.85:1.55));
    m.colorNode=mix(m.colorNode,color('#6d4636'),chips.mul(contact.mul(.35).add(streak.mul(.10))).add(hullSeam.mul(.22)));
   }
   if(s==='cream')m.colorNode=mix(m.colorNode,color('#766d56'),drain.mul(.31).mul(float(.7).add(wash.mul(.3))));
  }
  if(s==='glass'){
   const view=cameraPosition.sub(positionWorld).normalize(),reflected=view.negate().reflect(normalWorld);
   const sky=mix(color('#697f87'),color('#b9c8ce'),float(1).sub(reflected.y.abs().smoothstep(.05,.75)));
   const environment=mix(color('#263d39'),sky,reflected.y.smoothstep(-.08,.12));
   const fresnel=float(1).sub(normalWorld.dot(view).abs()).pow(5);
   // The reflected sky enters once through emissive radiance, rather than
   // also being multiplied by sun/hemisphere as a bright diffuse white panel.
   m.colorNode=color('#10252b');
   m.emissiveNode=environment.mul(float(.06).add(fresnel.mul(.20)));
   m.userData.reflectionScope='analytic coastal sky/ground hemisphere and Fresnel; matte salt film; no scene reflection';
  }
  m.userData.finishCoordinates='rest geometry; vessel construction frame; view reflection remains world space';
  return[s,m];
 }));
}
export function mergeMaritimeParts(parts){return new Map([...parts].filter(([,list])=>list.length).map(([slot,list])=>{for(const p of list){p.deleteAttribute('uv');if(!p.hasAttribute('color'))p.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(p.attributes.position.count*3).fill(1),3));for(const name of ['maritimeBody','maritimeWeight'])if(!p.hasAttribute(name))p.setAttribute(name,new THREE.Float32BufferAttribute(new Float32Array(p.attributes.position.count),1));if(!p.hasAttribute('maritimeGradient'))p.setAttribute('maritimeGradient',new THREE.Float32BufferAttribute(new Float32Array(p.attributes.position.count*3),3));}const g=mergeGeometries(list);for(const p of list)p.dispose();return[slot,g];}));}



