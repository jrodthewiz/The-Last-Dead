// Original Cape 75 lodger-room art. The finite structure remains collision authority.
// This serializable visual plan replaces only its existing upper-furniture boxes.
import {isAuthoredCottage, primitiveBounds} from './cottage-authored.js';

const PREFIX='cape75-upstairs-';
const lerp=(a,b,t)=>a+(b-a)*t;
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

export function createCape75UpstairsArtPlan(settings, structure){
  if(!isAuthoredCottage(settings)||!structure)return null;
  const upper=structure.floors.find(f=>f.id==='upper').top;
  const source=id=>{
    const solid=structure.solids.find(s=>s.id===`cape75-${id}`);
    if(!solid)throw new Error(`Cape75 upstairs art requires ${id}`);
    return solid;
  };
  const placements=[],supports=[],supportRelations=[],cavities=[];
  const push=(shape,slot,role,values,supportId)=>{
    const p={id:`${PREFIX}${placements.length}`,shape,slot,role:`${PREFIX}${role}`,...values};
    if(supportId){p.supportId=supportId;supportRelations.push({placementId:p.id,supportId});}
    placements.push(p);return p;
  };
  const box=(slot,position,size,role,rotation=[0,0,0],supportId)=>push('box',slot,role,{position,size,rotation},supportId);
  const soft=(slot,position,size,role,radius=.025,rotation=[0,0,0],supportId)=>push('bevelBox',slot,role,{position,size,radius,rotation},supportId);
  const cyl=(slot,a,b,radius,role,supportId)=>push('cylinder',slot,role,{a,b,radius},supportId);
  const tri=(slot,points,role)=>push('triangle',slot,role,{points});
  const quad=(slot,a,b,c,d,role)=>{tri(slot,[a,b,c],role);tri(slot,[a,c,d],role);};
  const support=(id,top,x,z,width,depth,sourceSolidId)=>{
    const record={id:`${PREFIX}${id}`,top,bounds:{x:[x-width/2,x+width/2],z:[z-depth/2,z+depth/2]},sourceSolidId};
    supports.push(record);return record.id;
  };
  const sheet=(slot,nx,nz,point,role,twoSided=false)=>{
    for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
      const a=point(x/nx,z/nz),b=point((x+1)/nx,z/nz),c=point(x/nx,(z+1)/nz),d=point((x+1)/nx,(z+1)/nz);
      tri(slot,[a,c,b],role);tri(slot,[b,c,d],role);
      if(twoSided){tri(slot,[a,b,c],role);tri(slot,[b,d,c],role);}
    }
  };
  // Closed tapered construction has independent caps and flat facet normals.
  const tapered=(slot,lower,upperCenter,lowerSize,upperSize,role)=>{
    const ring=(p,size)=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>[p[0]+x*size[0]/2,p[1],p[2]+z*size[1]/2]);
    const a=ring(lower,lowerSize),b=ring(upperCenter,upperSize);
    for(let i=0;i<4;i++){const j=(i+1)%4;quad(slot,a[i],b[i],b[j],a[j],role);}
    quad(slot,a[0],a[1],a[2],a[3],role);quad(slot,b[3],b[2],b[1],b[0],role);
  };
  // A narrow inset profile catches a broad highlight without another material.
  const panel=(slot,x,y,z,width,height,rail,depth,role)=>{
    const ring=(w,h,d)=>[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([a,b])=>[x+a,y+b,z+d]);
    const rings=[ring(width,height,0),ring(width-.018,height-.018,depth),ring(width-2*rail+.012,height-2*rail+.012,depth),ring(width-2*rail,height-2*rail,0)];
    for(let j=0;j<4;j++)for(let i=0;i<4;i++){const k=(i+1)%4;quad(slot,rings[j][i],rings[j][k],rings[(j+1)%4][k],rings[(j+1)%4][i],role);}
  };

  const mattress=source('upper-bed-mattress'),bedRail=source('upper-bed-rail'),headboard=source('upper-bed-headboard');
  const [bx,,bz]=mattress.position,[bw,mh,bd]=mattress.size,bedTop=mattress.position[1]+mh/2;
  for(const leg of structure.solids.filter(s=>s.kind==='upper-furniture'&&s.id.includes('upper-bed-leg-'))){
    const [x,,z]=leg.position;
    tapered('furnitureWood',[x,upper,z],[x,upper+.34,z],[.075,.075],[.11,.11],'bed-tapered-foot');
    box('pale',[x,upper+.295,z],[.115,.022,.115],'bed-foot-collar');
  }
  // Four timber rails leave the slatted underside genuinely open.
  for(const sign of [-1,1]){
    box('furnitureWood',[bx+sign*(bedRail.size[0]/2-.035),bedRail.position[1],bz],[.07,.16,bedRail.size[2]],'bed-side-timber');
    box('furnitureWood',[bx,bedRail.position[1],bz+sign*(bedRail.size[2]/2-.040)],[bedRail.size[0]-.10,.16,.08],'bed-end-timber');
  }
  for(let i=0;i<5;i++)box('furnitureWood',[bx,upper+.425,bz-.76+i*.38],[bw-.10,.028,.11],'bed-visible-support-slat');
  soft('pale',mattress.position,[bw,mh,bd],'bed-compressed-mattress',.032);
  // Shaped headboard: three quiet raised panels, a stepped crown and pegged stiles.
  const [hx,hy,hz]=headboard.position,[hw,hh]=headboard.size;
  for(const sign of [-1,1]){
    tapered('furnitureWood',[hx+sign*(hw/2-.055),upper+.20,hz],[hx+sign*(hw/2-.055),upper+1.32,hz],[.11,.10],[.085,.08],'bed-headboard-stile');
    box('pale',[hx+sign*(hw/2-.055),upper+1.29,hz+.01],[.13,.038,.11],'bed-headboard-peg-cap');
  }
  box('furnitureWood',[hx,hy,hz],[hw-.12,hh-.09,.070],'bed-headboard-recessed-field');
  for(const sign of [-1,1])box('furnitureWood',[hx,hy+sign*(hh/2-.055),hz+.028],[hw-.13,.070,.065],'bed-headboard-cross-rail');
  for(const x of [-.52,0,.52])panel('furnitureWood',hx+x,hy+.05,hz+.047,.43,.69,.045,.026,'bed-headboard-raised-panel');
  box('pale',[hx,upper+1.335,hz],[hw,.035,.115],'bed-headboard-shaped-crown');

  const detailVariant=Math.abs(settings.seed||0)%3;
  // Closed cushions own a broad crown, a compressed contact patch and pinched
  // corners. The shallow welt is part of the skin, never a rectangular wafer.
  const pillowForms=[];
  for(const pillow of structure.solids.filter(s=>s.kind==='upper-furniture'&&s.id.includes('upper-bed-pillow-'))){
    const [px,,pz]=pillow.position,[pw,,pd]=pillow.size;
    const skin=(u,v,top)=>{
      const x=2*u-1,z=2*v-1,corner=x**4*z**4;
      const inflation=Math.max(0,1-x*x)**.65*Math.max(0,1-z*z)**.65;
      const pressed=.023*Math.exp(-(((u-.54)/.21)**2+((v-.47)/.29)**2));
      const height=top?.042-.020*corner+.145*inflation-pressed:.014*Math.max(0,1-inflation/.52);
      return[px+(u-.5)*pw*(1-.13*z**4),bedTop+height,pz+(v-.5)*pd*(1-.13*x**4)];
    };
    sheet('pale',16,10,(u,v)=>skin(u,v,true),'bed-pressed-pillow');
    sheet('pale',16,10,(u,v)=>skin(1-u,v,false),'bed-pillow-contact-skin');
    const boundary=[];
    for(let i=0;i<16;i++)boundary.push([i/16,0]);
    for(let i=0;i<10;i++)boundary.push([1,i/10]);
    for(let i=0;i<16;i++)boundary.push([1-i/16,1]);
    for(let i=0;i<10;i++)boundary.push([0,1-i/10]);
    for(let i=0;i<boundary.length;i++){
      const [u,v]=boundary[i],[a,b]=boundary[(i+1)%boundary.length];
      quad('pale',skin(u,v,true),skin(a,b,true),skin(a,b,false),skin(u,v,false),'bed-pillow-tapered-welt');
    }
    pillowForms.push({sourceSolidId:pillow.id,center:[px,bedTop,pz],size:[pw,.187,pd],supportTop:bedTop,
      crown:skin(.5,.5,true),compression:skin(.54,.47,true),corner:skin(1,1,true),contact:skin(.5,.5,false)});
  }

  const blanketPoint=(u,v)=>{
    const turn=Math.max(0,1-u/.27)*Math.max(0,(v-.67)/.33);
    const crest=.008+.108*Math.sin(u*2.65*Math.PI+v*1.10+detailVariant*.12)**2+.012*Math.sin(v*2.15*Math.PI+u*.45)**2;
    return[bx+(u-.5)*(bw-.04),bedTop+.012+crest+.165*turn,bz-.37+v*(bd*.67)-.45*turn];
  };
  sheet('fabric',18,15,blanketPoint,'bed-broad-fold-duvet');
  // The rolled front-left corner exposes its pale lining; it doubles back in Z.
  sheet('pale',5,5,(u,v)=>{const p=blanketPoint(u*.15,.85+v*.15);return[p[0],p[1]-.008,p[2]];},'bed-turned-corner-lining',true);
  // The left drop rolls outside the timber before gravity pulls it down.
  // It stops before the folded corner; the foot drop starts beyond that corner.
  sheet('fabric',4,11,(u,v)=>{
    const p=blanketPoint(0,v*.68),roll=Math.sin(Math.min(1,u/.34)*Math.PI/2);
    return[p[0]-.076*roll,p[1]-u*(.37+.055*Math.sin(v*2.2*Math.PI)**2),p[2]];
  },'bed-gravity-side-drape',true);
  sheet('fabric',14,3,(u,v)=>{
    const p=blanketPoint(.29+u*.71,1),roll=Math.sin(Math.min(1,v/.36)*Math.PI/2);
    return[p[0],p[1]-v*(.35+.04*Math.sin(u*2*Math.PI)**2),p[2]+.045*roll];
  },'bed-gravity-foot-drape',true);
  // Three broad pale seam runs emphasize the fold direction at 320-pixel scale.
  for(const u of [.32,.62,.91])for(let j=0;j<3;j++){
    const a=blanketPoint(u,j*.23+.07),b=blanketPoint(u,(j+1)*.23+.07);
    cyl('pale',[a[0],a[1]+.004,a[2]],[b[0],b[1]+.004,b[2]],.0035,'bed-duvet-sewn-seam');
  }

  const desktop=source('upper-writing-desk-top'),[dx,dy,dz]=desktop.position,[dw,dh,dd]=desktop.size,deskTop=dy+dh/2;
  const deskSupport=support('desk-top',deskTop,dx,dz,dw,dd,desktop.id);
  for(const leg of structure.solids.filter(s=>s.kind==='upper-furniture'&&s.id.includes('upper-writing-desk-leg-'))){
    const [x,,z]=leg.position;
    tapered('furnitureWood',[x,upper,z],[x,upper+.79,z],[.067,.067],[.10,.10],'desk-tapered-leg');
    box('pale',[x,upper+.715,z],[.107,.045,.107],'desk-leg-join-collar');
  }
  soft('furnitureWood',desktop.position,desktop.size,'desk-rounded-writing-top',.017);
  for(const sign of [-1,1]){
    box('furnitureWood',[dx+sign*(dw/2-.09),upper+.72,dz],[.068,.19,dd-.08],'desk-side-apron');
  }
  box('furnitureWood',[dx,upper+.72,dz-dd/2+.06],[dw-.15,.19,.045],'desk-back-apron');
  // The left apron is split around an actual pulled drawer cavity.
  const drawer=source('upper-writing-desk-open-drawer'),[qx,qy,qz]=drawer.position,[qw,,qd]=drawer.size;
  for(const [a,b]of [[dx-dw/2+.08,qx-qw/2-.015],[qx+qw/2+.015,dx+dw/2-.08]])box('furnitureWood',[(a+b)/2,upper+.72,dz+dd/2-.033],[b-a,.19,.040],'desk-split-front-apron');
  box('dark',[qx,upper+.735,dz+.020],[qw-.06,.09,.035],'desk-drawer-recessed-back');
  const drawerFloor=qy-.040;
  box('furnitureWood',[qx,drawerFloor,qz],[qw-.02,.025,qd],'desk-open-drawer-floor');
  for(const sign of [-1,1]){
    box('furnitureWood',[qx+sign*(qw/2-.025),qy+.022,qz],[.050,.15,qd],'desk-open-drawer-side');
    box('metal',[qx+sign*(qw/2-.051),qy+.013,qz-.035],[.010,.020,qd-.11],'desk-drawer-runner');
  }
  box('furnitureWood',[qx,qy+.015,qz-qd/2+.020],[qw-.045,.135,.040],'desk-open-drawer-back');
  box('pale',[qx,qy+.010,qz+qd/2-.018],[qw+.005,.15,.040],'desk-pulled-drawer-front');
  panel('pale',qx,qy+.010,qz+qd/2+.005,qw-.035,.115,.016,.011,'desk-drawer-recessed-front');
  for(const sign of [-1,1])cyl('metal',[qx+sign*.11,qy+.018,qz+qd/2+.038],[qx+sign*.11,qy+.018,qz+qd/2+.073],.010,'desk-drawer-handle-standoff');
  cyl('metal',[qx-.11,qy+.018,qz+qd/2+.073],[qx+.11,qy+.018,qz+qd/2+.073],.012,'desk-drawer-grip');
  const drawerSupport=support('drawer-liner',drawerFloor+.0125,qx,qz,qw-.12,qd-.08,drawer.id);
  box('pale',[qx+.15,drawerFloor+.0245,qz-.03],[.25,.024,.31],'desk-stored-route-book',[0,0,0],drawerSupport);
  box('fabric',[qx-.18,drawerFloor+.0305,qz+.045],[.22,.036,.28],'desk-packed-folded-scarf',[0,0,0],drawerSupport);
  cavities.push({id:`${PREFIX}desk-open-drawer`,opening:{min:[qx-qw/2+.055,drawerFloor+.026,qz+qd/2-.08],max:[qx+qw/2-.055,upper+.806,qz+qd/2+.02]},probe:[qx,upper+.775,qz+.10],direction:[0,0,-1],far:.40});

  const seat=source('upper-writing-desk-chair-seat'),back=source('upper-writing-desk-chair-back'),[cx,cy,cz]=seat.position;
  for(const leg of structure.solids.filter(s=>s.kind==='upper-furniture'&&s.id.includes('upper-chair-leg-'))){
    const [x,,z]=leg.position;
    tapered('furnitureWood',[x,upper,z],[x,cy-.020,z],[.060,.060],[.082,.082],'chair-splayed-tapered-leg');
  }
  box('furnitureWood',seat.position,seat.size,'chair-seat-frame');
  sheet('rug',6,4,(u,v)=>[cx+(u-.5)*.61,cy+.047+.028*Math.sin(u*Math.PI)*Math.sin(v*Math.PI),cz+(v-.5)*.59],'chair-shaped-seat-pad');
  for(const sign of [-1,1]){
    cyl('furnitureWood',[cx+sign*.278,upper+.20,cz-.20],[cx+sign*.278,upper+.20,cz+.20],.019,'chair-side-stretcher');
    tapered('furnitureWood',[cx+sign*.285,cy-.02,back.position[2]],[cx+sign*.29,upper+1.095,back.position[2]+.025],[.064,.065],[.058,.058],'chair-back-stile');
  }
  // Open back, two curved slats; the silhouette no longer presents one pale box.
  for(const y of [upper+.77,upper+.96])for(let i=0;i<5;i++){
    const x0=-.26+i*.104,x1=x0+.104,z0=back.position[2]+.012+.045*(1-(x0/.29)**2),z1=back.position[2]+.012+.045*(1-(x1/.29)**2);
    quad('pale',[cx+x0,y-.041,z0],[cx+x1,y-.041,z1],[cx+x1,y+.041,z1],[cx+x0,y+.041,z0],'chair-bowed-back-slat');
    quad('furnitureWood',[cx+x1,y-.041,z1-.026],[cx+x0,y-.041,z0-.026],[cx+x0,y+.041,z0-.026],[cx+x1,y+.041,z1-.026],'chair-bowed-back-slat');
  }

  // ONE interrupted activity: a forest-footbridge route copied while listening.
  // The paper, headphone pads and travel-case contents all own rendered supports.
  const mapCenter=[dx+.09,deskTop+.028,dz+.10],mapBacking=box('pale',[mapCenter[0],deskTop+.005,mapCenter[2]],[1.01,.010,.53],'route-map-supported-paper',[0,0,0],deskSupport);
  const mapSupport=support('route-map-paper',deskTop+.010,mapCenter[0],mapCenter[2],1.01,.53,desktop.id);
  const paperColumns=10,paperHeights=Array.from({length:paperColumns+1},(_,i)=>{
    const u=i/paperColumns;return deskTop+.011+.018*Math.sin(u*Math.PI)**2+.011*Math.exp(-(((u-.36)/.04)**2));
  });
  // This is the actual rendered paper plane in each column, not a separate
  // smooth function whose ink could cut through or float above its triangles.
  const mapPoint=(u,v)=>{
    const t=Math.max(0,Math.min(1,u))*paperColumns,i=Math.min(paperColumns-1,Math.floor(t));
    return[mapCenter[0]+(u-.5)*1.01,lerp(paperHeights[i],paperHeights[i+1],t-i),mapCenter[2]+(v-.5)*.53];
  };
  // One inlaid paper surface owns every printed colour. Unlike overlapping
  // strips, no ink triangle has a second paper triangle or hull wedge below it.
  // Navy water also survives the warm task pool where fabric became pale mint.
  const coast=[[.30,.07],[.24,.24],[.36,.42],[.27,.59],[.34,.76],[.31,.93]];
  const river=[[.29,.40],[.44,.45],[.59,.553],[.76,.65],[.95,.75]];
  const route=[[.43,.81],[.49,.67],[.59,.553],[.69,.39],[.69,.25]];
  const bridge=route[2],endpoint=route.at(-1),start=route[0];
  const waterBoundary=[[.035,coast[0][1]],...coast,[.035,coast.at(-1)[1]]];
  const forestField=[[.78,.04],[.995,.04],[.995,.49],[.78,.49]];
  // A broad triangular evergreen and one stem replace the notched patch.
  // Its left edge is separated from the route diamond by visible paper.
  const forestCanopy=[[.89,.06],[.99,.35],[.92,.35],[.92,.44],[.86,.44],[.86,.35],[.79,.35]];
  const bridgeDirection=[.10*1.01,-.163*.53],bridgeLength=Math.hypot(...bridgeDirection),bridgeRouteAxis=bridgeDirection.map(v=>v/bridgeLength);
  const bridgeAxis=[-bridgeRouteAxis[1],bridgeRouteAxis[0]];
  const polygonArea=polygon=>polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2;
  const cleanPolygon=polygon=>{
    const points=polygon.filter((p,i)=>Math.hypot(p[0]-polygon[(i+polygon.length-1)%polygon.length][0],p[1]-polygon[(i+polygon.length-1)%polygon.length][1])>1e-11);
    for(let changed=true;changed&&points.length>=3;){
      changed=false;
      for(let i=0;i<points.length;i++){
        const a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length];
        if(Math.abs((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]))<1e-13){points.splice(i,1);changed=true;break;}
      }
    }
    return points.length>=3&&Math.abs(polygonArea(points))>1e-12?points:[];
  };
  const contours=[];
  const paint=(slot,polygon,role)=>{
    const points=cleanPolygon(polygon);if(polygonArea(points)<0)points.reverse();
    contours.push({slot,role,polygon:points});
  };
  const stroke=(slot,line,width,role)=>{
    const normals=[];
    for(let i=0;i<line.length-1;i++){
      const a=line[i],b=line[i+1],x=(b[0]-a[0])*1.01,z=(b[1]-a[1])*.53,length=Math.hypot(x,z),n=[-z/length*width/2/1.01,x/length*width/2/.53];
      normals.push(n);
    }
    // Shared miter endpoints make each bend one exact contour, without the
    // tiny paper wedges left between independent bevel-join triangles.
    const offsets=line.map((_,i)=>{
      if(i===0)return normals[0];if(i===line.length-1)return normals.at(-1);
      const a=normals[i-1],b=normals[i],dot=(a[0]*b[0]*1.01**2+a[1]*b[1]*.53**2)/(width/2)**2;
      return a.map((v,k)=>(v+b[k])/(1+dot));
    });
    for(let i=0;i<line.length-1;i++)paint(slot,[line[i].map((v,k)=>v-offsets[i][k]),line[i+1].map((v,k)=>v-offsets[i+1][k]),line[i+1].map((v,k)=>v+offsets[i+1][k]),line[i].map((v,k)=>v+offsets[i][k])],role);
  };
  for(let i=0;i<coast.length-1;i++)paint('dark',[[.035,coast[i][1]],coast[i],coast[i+1],[.035,coast[i+1][1]]],'route-map-painted-coast');
  stroke('dark',river,.085,'route-map-inland-river');
  paint('fabric',forestField,'route-map-forest-grove');
  paint('dark',[[.89,.06],[.99,.35],[.79,.35]],'route-map-forest-endpoint');
  paint('dark',[[.86,.35],[.92,.35],[.92,.44],[.86,.44]],'route-map-forest-endpoint');
  stroke('rust',route,.045,'route-map-footbridge-path');
  paint('dark',[[start[0]-.037,start[1]-.070],[start[0]+.037,start[1]-.070],[start[0]+.037,start[1]+.070],[start[0]-.037,start[1]+.070]],'route-map-cape-start');
  const arrivalContour=[[endpoint[0],endpoint[1]-.092],[endpoint[0]+.049,endpoint[1]],[endpoint[0],endpoint[1]+.092],[endpoint[0]-.049,endpoint[1]]];
  paint('rust',arrivalContour,'route-map-forest-arrival-diamond');
  const bridgeContour=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>[
    bridge[0]+(a*.105*bridgeAxis[0]-b*.040*bridgeAxis[1])/1.01,
    bridge[1]+(a*.105*bridgeAxis[1]+b*.040*bridgeAxis[0])/.53]);
  paint('metal',bridgeContour,'route-map-forest-footbridge-bar');
  // Exact convex clipping partitions the sheet instead of sampling a grid.
  // Outside pieces retain their paint; the brush intersection owns its colour.
  const halfPlane=(polygon,a,b)=>{
    const inside=[],outside=[],side=p=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
    for(let i=0;i<polygon.length;i++){
      const p=polygon[i],q=polygon[(i+1)%polygon.length],d=side(p),e=side(q);
      if(d>=-1e-13)inside.push(p);if(d<=1e-13)outside.push(p);
      if((d>1e-13&&e<-1e-13)||(d<-1e-13&&e>1e-13)){
        const t=d/(d-e),cross=[lerp(p[0],q[0],t),lerp(p[1],q[1],t)];inside.push(cross);outside.push(cross);
      }
    }
    return{inside:cleanPolygon(inside),outside:cleanPolygon(outside)};
  };
  const bounds=polygon=>({min:[Math.min(...polygon.map(p=>p[0])),Math.min(...polygon.map(p=>p[1]))],max:[Math.max(...polygon.map(p=>p[0])),Math.max(...polygon.map(p=>p[1]))]});
  let surfacePolygons=Array.from({length:paperColumns},(_,i)=>({column:i,slot:'pale',role:'route-map-paper-center-fold',polygon:[[i/paperColumns,0],[(i+1)/paperColumns,0],[(i+1)/paperColumns,1],[i/paperColumns,1]]}));
  for(const brush of contours){
    const brushBounds=bounds(brush.polygon),next=[];
    for(const piece of surfacePolygons){
      const pieceBounds=bounds(piece.polygon);
      if(piece.role===brush.role||pieceBounds.max.some((v,i)=>v<=brushBounds.min[i]+1e-13)||pieceBounds.min.some((v,i)=>v>=brushBounds.max[i]-1e-13)){next.push(piece);continue;}
      let intersection=piece.polygon;const outside=[];
      for(let i=0;i<brush.polygon.length&&intersection.length;i++){
        const split=halfPlane(intersection,brush.polygon[i],brush.polygon[(i+1)%brush.polygon.length]);
        if(split.outside.length)outside.push({...piece,polygon:split.outside});intersection=split.inside;
      }
      if(!intersection.length){next.push(piece);continue;}
      next.push(...outside,{column:piece.column,slot:brush.slot,role:brush.role,polygon:intersection});
    }
    surfacePolygons=next;
  }
  // Erase cuts hidden inside a single ink colour. A convex hull may replace
  // two exclusive pieces only when its area equals their union exactly, and
  // only within one physical paper plane. This removes clipping slivers
  // without bridging a fold or filling an intentional contour concavity.
  const convexHull=polygon=>{
    const sorted=polygon.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    const chain=points=>{const result=[];for(const p of points){while(result.length>1&&cross(result.at(-2),result.at(-1),p)<=1e-13)result.pop();result.push(p);}return result;};
    return cleanPolygon([...chain(sorted).slice(0,-1),...chain(sorted.slice().reverse()).slice(0,-1)]);
  };
  const groups=new Map();
  for(const piece of surfacePolygons){const key=`${piece.column}/${piece.slot}/${piece.role}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(piece);}
  for(const pieces of groups.values())for(let changed=true;changed;){
    changed=false;pieces.sort((a,b)=>polygonArea(a.polygon)-polygonArea(b.polygon));
    merge:for(let i=0;i<pieces.length;i++)for(let j=i+1;j<pieces.length;j++){
      const hull=convexHull([...pieces[i].polygon,...pieces[j].polygon]);
      if(Math.abs(polygonArea(hull)-polygonArea(pieces[i].polygon)-polygonArea(pieces[j].polygon))>1e-13)continue;
      pieces[i]={...pieces[i],polygon:hull};pieces.splice(j,1);changed=true;break merge;
    }
  }
  surfacePolygons=[...groups.values()].flat();
  let surfaceTriangleCount=0;
  for(const piece of surfacePolygons)for(let i=1;i<piece.polygon.length-1;i++){
    tri(piece.slot,[piece.polygon[0],piece.polygon[i+1],piece.polygon[i]].map(p=>mapPoint(...p)),piece.role);surfaceTriangleCount++;
  }
  const routeMap={destinationId:'forest',destinationName:'Cape Forest Footbridge',destinationWorldMetres:[222,340],
    coast,river,route,bridge,endpoint,waterBoundary,bridgeBar:{axis:bridgeAxis,length:.210,width:.080,slot:'metal',contour:bridgeContour},forestCanopy,forestField,arrivalContour,routeWidth:.045,inkBorderWidth:0,riverWidth:.085,paperSize:[1.01,.53],persistent:true,
    paperColumns,paperHeights,contours,surfacePolygons,surfaceTriangleCount,inkSurface:'one supported inlaid paper surface',inkSeparation:0,partition:'exact convex contour clipping'};
  const pencilA=mapPoint(.32,.934),pencilB=mapPoint(.72,.88);
  cyl('rust',[pencilA[0],pencilA[1]+.010,pencilA[2]],[pencilB[0],pencilB[1]+.010,pencilB[2]],.010,'desk-abandoned-route-pencil');
  const headphoneX=dx+.77,headphoneZ=dz-.015,headphoneBase=deskTop;
  for(const sign of [-1,1]){
    box('dark',[headphoneX+sign*.11,headphoneBase+.032,headphoneZ],[.105,.064,.205],'listening-headphone-supported-pad',[0,0,0],deskSupport);
    box('metal',[headphoneX+sign*.11,headphoneBase+.073,headphoneZ],[.115,.022,.15],'listening-headphone-cup-shell');
    cyl('metal',[headphoneX+sign*.12,headphoneBase+.080,headphoneZ],[headphoneX+sign*.17,headphoneBase+.133,headphoneZ],.017,'listening-headphone-articulated-yoke');
  }
  const headband=[];
  for(let i=0;i<=8;i++){const angle=Math.PI-i*Math.PI/8;headband.push([headphoneX+.17*Math.cos(angle),headphoneBase+.125+.205*Math.sin(angle),headphoneZ]);}
  for(let i=0;i<headband.length-1;i++)cyl(i%2?'dark':'metal',headband[i],headband[i+1],.020,'listening-headphone-large-arch');
  const cable=[[headphoneX-.11,headphoneBase+.036,headphoneZ-.06],[headphoneX-.17,headphoneBase+.008,headphoneZ-.20],[headphoneX-.37,headphoneBase+.008,headphoneZ-.21],[headphoneX-.45,headphoneBase+.008,headphoneZ-.16]];
  for(let i=0;i<cable.length-1;i++)cyl('dark',cable[i],cable[i+1],.008,'listening-headphone-abandoned-lead');
  // Reserved runtime pickup: this plan supplies a real surface/clear approach,
  // while the runtime owns its two material batches and collection visibility.
  const folioX=dx-.71,folioZ=dz+.20,folioSize=[.24,.032,.20];
  const routeFolio={id:'cape75-footbridge-route-folio',position:[folioX,deskTop+folioSize[1]/2,folioZ],
    interactionPoint:[folioX,deskTop+folioSize[1],folioZ],bottom:deskTop,top:deskTop+folioSize[1],size:folioSize,yaw:0,
    floorHeight:upper,supportId:deskSupport,sourceSolidId:desktop.id,approach:[dx-.61,-4.25],approach3D:[dx-.61,upper,-4.25],
    destinationId:'forest',destinationName:'Cape Forest Footbridge',destinationWorldMetres:[222,340],visualKind:'route-folio',requiresInteract:true,
    label:'Forest footbridge route folio',story:'A portable copy of the listening-room route across the real Cape Forest Footbridge. The large desk map remains here.'};

  const trunk=source('upper-packed-trunk-base'),lid=source('upper-packed-trunk-lid'),[tx,ty,tz]=trunk.position,[tw,th,td]=trunk.size;
  const caseBottom=ty-th/2,caseTop=ty+th/2;
  box('rug',[tx,caseBottom+.026,tz],[tw-.035,.052,td-.035],'travel-case-supporting-bottom');
  for(const sign of [-1,1]){
    box('rug',[tx+sign*(tw/2-.037),ty,tz],[.074,th-.02,td-.03],'travel-case-open-carcass-side');
    box('rug',[tx,ty,tz+sign*(td/2-.031)],[tw-.08,th-.02,.062],'travel-case-open-carcass-end');
    box('metal',[tx+sign*(tw/2-.015),caseBottom+.060,tz+td/2-.015],[.070,.080,.040],'travel-case-corner-guard');
  }
  const caseSupport=support('travel-case-liner',caseBottom+.052,tx,tz,tw-.17,td-.16,trunk.id);
  box('fabric',[tx-.19,caseBottom+.120,tz],[.46,.136,.39],'travel-case-supported-packed-coat',[0,0,0],caseSupport);
  box('pale',[tx+.23,caseBottom+.155,tz],[.29,.206,.36],'travel-case-supported-packed-shirt',[0,0,0],caseSupport);
  // Hinged lid rises inside the pre-existing case footprint. No floor obstacle is added.
  const hingeZ=tz-td/2+.018,lidDepth=lid.size[2]-.03,lidAngle=.87;
  const lidCenter=[tx,caseTop+Math.sin(lidAngle)*lidDepth/2,hingeZ+Math.cos(lidAngle)*lidDepth/2];
  box('furnitureWood',lidCenter,[lid.size[0]-.045,.045,lidDepth],'travel-case-raised-hinged-lid',[-lidAngle,0,0]);
  box('pale',[tx,lidCenter[1]+.018*Math.cos(lidAngle),lidCenter[2]-.018*Math.sin(lidAngle)],[lid.size[0]-.16,.009,lidDepth-.12],'travel-case-lid-lining',[-lidAngle,0,0]);
  for(const sign of [-1,1]){
    cyl('metal',[tx+sign*.34-.035,caseTop,hingeZ],[tx+sign*.34+.035,caseTop,hingeZ],.017,'travel-case-lid-hinge');
    box('dark',[tx+sign*.29,ty+.03,tz+td/2+.006],[.045,.23,.010],'travel-case-front-retention-strap');
    box('metal',[tx+sign*.29,caseTop-.064,tz+td/2+.018],[.073,.050,.030],'travel-case-retention-buckle');
  }
  cyl('dark',[tx-.13,ty+.035,tz+td/2+.040],[tx-.13,ty+.12,tz+td/2+.040],.014,'travel-case-carry-handle');
  cyl('dark',[tx+.13,ty+.035,tz+td/2+.040],[tx+.13,ty+.12,tz+td/2+.040],.014,'travel-case-carry-handle');
  cyl('dark',[tx-.13,ty+.12,tz+td/2+.040],[tx+.13,ty+.12,tz+td/2+.040],.014,'travel-case-carry-handle');
  cavities.push({id:`${PREFIX}travel-case`,opening:{min:[tx-tw/2+.09,caseTop-.03,tz-td/2+.085],max:[tx+tw/2-.09,caseTop+.08,tz+td/2-.085]},probe:[tx,caseTop+.04,tz+.12],direction:[0,-1,0],far:.65});

  const moduleBounds={},owners=new Map(),duplicateOwners=[];
  for(const p of placements){
    const b=primitiveBounds(p),current=moduleBounds[p.role]||{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
    for(let i=0;i<3;i++){current.min[i]=Math.min(current.min[i],b.min[i]);current.max[i]=Math.max(current.max[i],b.max[i]);}
    moduleBounds[p.role]=current;
    const key=JSON.stringify([p.shape,p.slot,p.position,p.size,p.rotation,p.a,p.b,p.radius,p.points]);
    if(owners.has(key))duplicateOwners.push([owners.get(key),p.id]);else owners.set(key,p.id);
  }
  const replacedSolidIds=structure.solids.filter(s=>s.kind==='upper-furniture').map(s=>s.id);
  return freeze({id:'cape75-upstairs-interrupted-listening-route',coordinateSystem:'local-three-metres',floor:upper,seed:settings.seed,detailVariant,
    story:'The upstairs lodger listened downstairs, then copied a route across the Cape Forest Footbridge into the forest. Headphones, a river-crossing map, portable route folio, pulled chair and half-packed travel case were abandoned together; a successful escape is not established.',
    placements,supports,supportRelations,cavities,replacedSolidIds,
    routeFolio,routeMap,
    workstation:{deskSupport,taskLightBase:{center:[dx-.61,deskTop,dz-.04],radius:.10},listeningSurfaceCenter:mapCenter,
      lightingTarget:[(folioX+mapCenter[0])/2,deskTop+.029,(folioZ+mapCenter[2])/2],mapBackingId:mapBacking.id,headphoneCenter:[headphoneX,headphoneBase+.17,headphoneZ]},
    cloth:{bedCenter:[bx,bedTop,bz],railBounds:{x:[bedRail.position[0]-bedRail.size[0]/2,bedRail.position[0]+bedRail.size[0]/2],top:bedRail.position[1]+bedRail.size[1]/2},turnedCorner:[...blanketPoint(0,1)],seamCount:3},
    pillowForms,
    reservedRoute:{x:[-.66,.66],z:[-5.00,-2.39]},inspectionPoints:[[-2.35,upper,-5.7],[1.75,upper,-4.5]],
    diagnostics:{primitiveCount:placements.length,moduleCount:Object.keys(moduleBounds).length,materialSlots:[...new Set(placements.map(p=>p.slot))],moduleBounds,duplicateOwners,
      replacedSolidCount:replacedSolidIds.length,addedCollisionSolids:0,triangleEstimate:placements.reduce((n,p)=>n+(p.shape==='triangle'?1:p.shape==='box'?12:p.shape==='cylinder'?32:428),0)},
  });
}

export function compileCape75UpstairsArt(writer, plan){
  if(!plan)return;
  for(const p of plan.placements){
    if(p.shape==='box')writer.box(p.slot,p.position,p.size,p.rotation,p.role);
    else if(p.shape==='bevelBox')writer.bevelBox(p.slot,p.position,p.size,p.radius,p.rotation,p.role);
    else if(p.shape==='cylinder')writer.cylinder(p.slot,p.a,p.b,p.radius,p.role);
    else writer.triangle(p.slot,p.points,p.role);
  }
}
