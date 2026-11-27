import {terrainHeight,groundHeight,SIGNAL_STAIRS,HOSPITAL_GENERATOR,random,roadAt} from './data.js';
import * as T from '../vendor/three.module.js';
import {FRONTAGES} from './settlement-plan.js';
import {accessReserved} from './access-plan.js';

export function authoredDetails(scene,kit,data,sign){
  // The crossing has a refuge, an abandoned queue, an exposed span, and a
  // mainland checkpoint. All debris sits outside the shared drivable corridor.
  let y=terrainHeight(36,16);
  kit.box(36,y+1.7,16,8,3.4,10,0xb7b39a);kit.box(36,y+3.6,16,9,.5,11,0x586b61);
  kit.box(31.94,y+2,16,.1,1.1,7,0x445f5c);kit.box(36,y+1.8,10.93,5,1.3,.12,0x526c65);
  sign(scene,'LAST CROSSING · KEEP LEFT',20,groundHeight(20,0)+4.7,0,10,Math.PI/2);
  for(const x of [-85,-60,-35,-10,30,385])for(const z of [-8.4,8.4]){
    const gy=groundHeight(x,z);kit.box(x,gy+.4,z,3.8,.8,.7,0x9da38b);
    for(let i=0;i<4;i++)kit.box(x-1.3+i*.8,gy+.5,z-.36,.30,.4,.025,0x6a7060);
  }
  for(const x of [93,163,234,303]){
    const gy=groundHeight(x,0);kit.box(x,gy+.021,0,.17,.02,16,0x414e47);
    // Salt stains are directional and tied to the base of bridge rail posts.
    for(const z of [-9.2,9.2])kit.box(x,gy+.12,z,2,.028,.9,0x817c5d);
  }
  for(const w of data.wrecks){const gy=groundHeight(w.x,w.z);kit.box(w.x+1,gy+.025,w.z,5.5,.025,2.8,0x536250);for(let i=0;i<3;i++)kit.box(w.x-2+i*.6,gy+.18,w.z+1.5,.45,.36,.36,0xa18e65);}
  // Low dry-stone field walls define yards instead of scattering random props.
  for(const b of data.buildings.filter(b=>b.district==='village')){
    for(const side of [-1,1])for(let j=0;j<5;j++){
      const x=b.x+side*(b.w/2+3),z=b.z-b.d/2+j*b.d/4;
      if(roadAt(x,z).distance<7||accessReserved(data.accessPaths,x,z,1))continue;
      kit.add('rock',x,terrainHeight(x,z)+.35,z,.75,.65,1.8,0x959c7a,j*.3);
    }
    const z=b.z+b.d/2+2.5;
    for(const side of [-1,1]){const x=b.x+side*3.5,gy=terrainHeight(x,z);kit.box(x,gy-.05,z,1.4,.96,1.2,0x544b36);kit.add('sphere',x,gy+.72,z,1,.65,.8,0x7e8e49);}
  }
  // Survey platform: thirty physical treads, posts and rails, with the same
  // heights used by movement. It gives the signal a visible journey of its own.
  const s=SIGNAL_STAIRS,top=s.base+s.rise;
  for(let i=0;i<30;i++){
    const x=s.x+(i+.5)*.8,h=s.base+(i+1)*.2;
    kit.box(x,h-.10,s.z,.8,.20,3,0xa89b76);
    if(i%5===0)for(const z of [s.z-1.65,s.z+1.65]){const gy=terrainHeight(x,z);kit.box(x,(h+gy)/2,z,.16,h-gy,.16,0x5c6a59);kit.box(x,h+.55,z,.12,1.1,.12,0x586a5c);}
  }
  for(const z of [s.z-1.65,s.z+1.65])kit.rod([s.x,s.base+1.1,z],[s.x+24,top+1.1,z],.065,0x576858);
  kit.box(-404,top-.15,-286,8,.30,8,0x9a9478);
  for(const x of [-407,-401])for(const z of [-289,-283]){const gy=terrainHeight(x,z);kit.box(x,(top+gy)/2,z,.35,top-gy,.35,0x586958);}
  for(const z of [-290,-282]){kit.rod([-408,top+1,z],[-400,top+1,z],.06,0x586958);for(const x of [-408,-404,-400])kit.box(x,top+.5,z,.12,1,.12,0x586958);}
  kit.rod([-400,top+1,-290],[-400,top+1,-282],.06,0x586958);
  // Keep the full board outside the three-metre stair corridor, including
  // its rotated half-width. The old edge passed through descending players.
  sign(scene,'SIGNAL HILL · SURVEY ACCESS',-432,s.base+2.2,-291.6,7,Math.PI/2);
  for(const z of [-294.8,-288.4]){const bottom=terrainHeight(-432,z),height=s.base+2.75-bottom;kit.box(-432,bottom+height/2,z,.14,height,.14,0x586958);}
  // A working-looking generator and sheltered service route at Northpoint.
  const g=HOSPITAL_GENERATOR;
  kit.box(g.x,14.45,g.z,2.8,.6,1.7,0x425448);kit.box(g.x,15,g.z,2.4,.7,1.35,0xa89b65);
  for(let i=0;i<7;i++)kit.box(g.x-.85+i*.27,15.05,g.z+.69,.10,.45,.04,0x414f44);
  kit.add('cylinder',g.x+.8,15.8,g.z-.4,.08,1.3,.08,0x47564d);
  kit.box(g.x-1.7,14.52,g.z+.4,.65,.78,.65,0x6e5d40,0,3);kit.box(g.x-1.75,15.16,g.z+.3,.42,.48,.42,0x8b4a36,0,0);
  kit.add('cylinder',g.x+1.95,14.52,g.z+.7,.28,.75,.28,0x3c524b,0,null,0);
  for(const x of [997,1004])kit.box(x,16,-305,.16,4,.16,0x637363);
  kit.box(1000.5,18,-305,9,.2,7,0x657d70);kit.box(1000.5,17.86,g.z-3.6,.7,.16,.4,0xead5a2,0,6);
  sign(scene,'EMERGENCY POWER',1000,17,-301.3,7);
  sign(scene,'KEEPER’S STORE',-795,data.buildings.find(b=>b.id==='lightkeeper').baseY+4.25,-273.0,7);

// The seaward face is a working pier, not a floating black slab: driven piles,
// cross-bracing and a wet rock toe carry the keeper's house into the water.
{
  const keeper=data.buildings.find(b=>b.id==='lightkeeper');
  if(keeper){
    const zf=keeper.z-keeper.d/2-.55,y1=keeper.baseY-.15;
    for(const x of [keeper.x-4.4,keeper.x-2.2,keeper.x,keeper.x+2.2,keeper.x+4.4])kit.add('cylinder',x,(.45+y1)/2,zf,.17,y1-.45,.17,0x3f3a2c,0,null,0);
    // R45 waterline: tide-stained dark bands at the pile feet plus a lighter
    // wet-sheen collar just above the water — piles no longer read as clean
    // toothpicks spearing the water.
    for(const x of [keeper.x-4.4,keeper.x-2.2,keeper.x,keeper.x+2.2,keeper.x+4.4]){
      kit.add('cylinder',x,1.05,zf,.185,1.3,.185,0x24271e,0,null,0);
      kit.add('cylinder',x,1.95,zf,.178,.7,.178,0x4a4a38,0,null,0);
    }
    kit.rod([keeper.x-4.4,.95,zf],[keeper.x+4.4,y1-.75,zf],.10,0x4f4736);
    kit.rod([keeper.x-4.4,y1-.75,zf],[keeper.x+4.4,.95,zf],.10,0x4f4736);
    for(const x of [keeper.x-3.3,keeper.x+3.3])kit.add('rock',x,.10,zf-.6,2.4,1.8,2.2,0x66705e,.4,null,3);
  }
}
  // An interrupted evacuation route forces a readable choice: pedestrians can
  // take the shop-side pavement; trucks must use the neighbouring boulevard.
  for(const z of [-3.3,0,3.3]){kit.box(620,14.55,z,1.4,1.1,3.1,0xb6ad8a);for(let i=0;i<3;i++)kit.box(619.27,14.7,z-1+i,.03,.3,.4,0x5f6856);}
  for(const z of [-4.6,4.6]){kit.box(619.4,15.18,z,.24,.18,.24,0x3a423e,0,0);kit.box(619.4,15.32,z,.22,.22,.22,0xffad42,0,6);}
  for(const [bx,bz] of [[605.5,4.2],[615.2,-4.4],[614.2,5.6]]){kit.box(bx,14.32,bz,1.1,.52,.85,0x6e5f44,0,3);kit.box(bx+.2,14.72,bz,.7,.32,.6,0x4d6055,0,0);}
  for(const gz of [-7.35,7.35])for(const gx of [594,606,618]){kit.box(gx,14.057,gz,.90,.014,.46,0x465250,0,0);for(let s=-1.5;s<=1.5;s+=1)kit.box(gx+s*.19,14.065,gz,.05,.006,.38,0x62706d,0,0);}
  sign(scene,'EVACUATION · USE NORTH ROAD',619,17.3,0,11,-Math.PI/2,false,true);
  kit.box(608,15.3,-6,10,2.1,2.7,0xa6ad91);kit.box(608,14.5,-6,10,.45,2.75,0x496c61);kit.box(608,16.45,-6,10.2,.25,2.85,0x48665c);
  for(let i=0;i<7;i++)for(const z of [-7.38,-4.62])kit.box(604.4+i*1.2,15.9,z,.95,.8,.07,0x3c5753);
  for(const x of [604.5,611.5])for(const z of [-7.3,-4.7]){kit.rod([x,14.55,z-.12],[x,14.55,z+.12],.58,0x3d453b);}
  kit.box(602.94,15.85,-6,.10,.9,2.1,0x456962);for(const z of [-6.9,-5.1])kit.box(602.88,14.9,z,.14,.25,.35,0xd9c99a);
  for(let i=0;i<8;i++){kit.box(603+i*1.2,14.16,-10.2,.65,.3,.45,i%3?0x827254:0x627565);}
  // Waterfront loading wharf: a horizontal silhouette, dock edge dressing and sheltered alleys.
  for(const z of [170,360]){
    kit.box(1190,14.35,z,28,.7,45,0xa4a58a);
    for(const x of [1180,1200]){
      for(const side of [-1,1]){kit.box(x,14.7,z+side*5,2,1.4,2.5,0x6b7564);kit.rod([x,15,z+side*5],[x,30,z+side*2],.38,0x7c8569);kit.rod([x,16,z+side*5],[x,27,z-side*2],.14,0x596f5d);}
      kit.box(x,31,z+3,1.3,1.7,24,0x889073);kit.box(x,32.3,z+3,1.5,.25,24,0xa19e7c);
      for(let i=-7;i<14;i+=3)kit.rod([x,30.2,z+i],[x,32.1,z+i+3],.10,0x536f5f);
      kit.box(x,29.4,z-6,3,3.2,4,0x6f806b);kit.box(x,30,z-3.95,2.1,1.3,.1,0x385e5b);
      kit.rod([x,32,z+12],[x,18,z+12],.075,0x465c51);kit.add('rock',x,17.7,z+12,.45,.7,.45,0x485c4e);
    }
    kit.box(1190,29,z-2,21,.8,.8,0x7e8a6c);kit.box(1190,29,z+2,21,.8,.8,0x7e8a6c);
    for(let j=0;j<6;j++){const x=1179+(j%3)*4,zz=z-12+Math.floor(j/3)*7;kit.box(x,15.4,zz,3,2.8,5,0x827658);kit.box(x,15.4,zz,.2,2.9,5.1,0x4f6254);}
  }
  // Apron quay bollards, painted hazard edge curbing, cargo stacks and wharf lamps.
  for(let z=160;z<=244;z+=14){
    kit.add('cylinder',1206,14.22,z,.32,.34,.32,0x364240,0,null,0);
    kit.add('cylinder',1206,14.52,z,.17,.56,.17,0x3a4846,0,null,0);
    kit.add('cylinder',1206,14.84,z,.23,.12,.23,0x485854,0,null,0);
  }
  for(let z=152,idx=0;z<=252;z+=4,idx++){
    kit.box(1208,14.11,z,.55,.12,3.92,idx%2===0?0x9e8442:0x343d3b,0,8);
  }
  for(const [cx,cz] of [[1168,212],[1199,216]]){
    kit.box(cx,14.70,cz,2.2,1.3,3.2,0x7d6c4d,0,3);
    kit.box(cx+.15,15.80,cz-.3,1.5,.9,1.8,0x5a6e64,0,0);
    kit.add('cylinder',cx-1.35,14.55,cz+.9,.38,.9,.38,0x8b4c39,0,null,0);
    kit.add('cylinder',cx-1.35,14.55,cz-.8,.38,.9,.38,0x3e5954,0,null,0);
  }
  for(const [cx,cz] of [[1170,198],[1201,199]]){
    kit.box(cx,14.32,cz,1.8,.55,3.8,0x746244,0,3);
    kit.add('cylinder',cx,14.95,cz+1.1,.45,.75,.45,0x475952,0,null,0);
    kit.add('dial',cx+1.2,14.72,cz-.7,.65,.65,.55,0x66563b,Math.PI/2,null,3);
  }
  for(const z of [222,196,172]){
    kit.add('cylinder',1171,16.95,z,.11,5.8,.11,0x3b4946,0,null,0);
    kit.box(1171.45,19.75,z,1.1,.14,.16,0x3b4946,0,0);
    kit.box(1171.95,19.55,z,.55,.22,.42,0xead5a2,0,6);
  }
  // Harbor shipping containers, steel crane rails, drums and timber pallets across the quay apron.
  for(const rx of [1180,1200]){kit.box(rx,14.07,205,.18,.04,108,0x3b4346,0,0);}
  for(const [cx,cz,cw,cd,ch,col,rot] of [
    [1160,192,2.5,6.1,2.6,0x2e585a,0],[1160,192,2.5,6.1,2.6,0x7d4537,0],
    [1163.2,193,2.5,6.1,2.6,0x967e46,.08],[1195,222,2.5,6.1,2.6,0x3b5b5c,-.06],
    [1198.2,223,2.5,6.1,2.6,0x7d4537,.04],[1201,188,2.5,6.1,2.6,0x49615a,0],
    [1164,218,2.5,6.1,2.6,0x334e50,.10],
  ]){
    const stackY=cx===1160&&col===0x7d4537?16.65:15.35;
    kit.box(cx,stackY,cz,cw,ch,cd,col,rot,0);
    kit.box(cx,stackY+ch*.47,cz,cw+.08,.12,cd+.08,0x222c2b,rot,0);
    kit.box(cx,stackY-ch*.47,cz,cw+.08,.12,cd+.08,0x222c2b,rot,0);
    for(let k=-2;k<=2;k++)kit.box(cx,stackY,cz+k*1.02,cw+.08,ch-.24,.13,0x263230,rot,0);
  }
  for(const [px,pz] of [[1175,214],[1184,219],[1191,206],[1173,182]]){
    kit.box(px,14.20,pz,1.5,.28,1.5,0x766143,0,3);
    kit.box(px-.2,14.62,pz,.75,.56,.75,0x8f7954,.2,3);
    kit.add('cylinder',px+.55,14.78,pz+.35,.26,.88,.26,0x7d4537,0,null,0);
    kit.add('cylinder',px+.55,14.78,pz-.35,.26,.88,.26,0x2e585a,0,null,0);
  }
  sign(scene,'EAST DOCKS · BERTH 4',1175.5,17.2,196,6.5,Math.PI/2,false,true);
  // Long horizontal harbour sheds, stepped towers, colonnades and crooked
  // shopfronts give each district a different street-level rhythm.
  const rng=random(901);
  for(const b of data.buildings){
    if(b.district==='village')continue;
    const y=b.baseY,front=b.z+b.d/2;
    if(b.district==='oldtown'){
      for(let j=0;j<(FRONTAGES[b.id]?0:3);j++){
        const x=b.x+(j-1)*(b.w/3.4),width=b.w/3.5,panels=b.enterable?8:1;
        const tilt=new T.Quaternion().setFromEuler(new T.Euler(.18,0,0));
        for(let p=0;p<panels;p++){
          const xx=x-width/2+(p+.5)*width/panels,c=panels>1&&p%2===0?0xc6b78e:b.accent;
          kit.add('box',xx,y+3.24,front+.94,width/panels,.10,1.9,c,0,tilt);
          kit.box(xx,y+2.95,front+1.87,width/panels,.3,.08,c);
        }
        for(const side of [-1,1])kit.rod([x+side*width*.45,y+2.8,front+.15],[x+side*width*.45,y+3.06,front+1.85],.045,0x506055);
      }
      for(let f=1;f<b.floors;f++)kit.box(b.x,y+f*3.4+.1,front+.15,b.w,.18,.45,0xc8bb98);
      if(!FRONTAGES[b.id]&&b.seed%4===0){kit.box(b.x+b.w/2-2,y+1.2,front+.15,2.5,2.2,.15,0x67624c);for(const tilt of [-.7,.7]){const o={x:b.x+b.w/2-2,y:y+1.2,z:front+.26};kit.rod([o.x-1,o.y+tilt,o.z],[o.x+1,o.y-tilt,o.z],.10,0x8a7754);}}
      if(!FRONTAGES[b.id]&&b.seed%3===0){kit.box(b.x-4,y+.45,front+2.1,3,.8,1.1,0x7c6a48);for(let j=0;j<5;j++)kit.add('rock',b.x-5+j*.5,y+1,front+2.1,.22,.2,.22,0xa09751);}
    }else if(b.district==='civic'){
      if(b.id==='clinic')continue;
      kit.box(b.x,y+4.4,front+1.9,b.w+1,.6,4.1,0xd3c9a7);
      for(let x=-b.w/2+2;x<b.w/2;x+=4.3){kit.add('cylinder',b.x+x,y+2.1,front+3.2,.3,4.2,.3,0xc0bea5);kit.box(b.x+x,y+.25,front+3.2,.8,.5,.8,0xa5ab96);}
      kit.box(b.x,y+.12,front+2, b.w+1,.24,4.4,0xa2aa97);
    }else if(b.district==='industrial'){
      for(const x of [b.x-b.w*.26,b.x+b.w*.26]){kit.box(x,y+1.9,front+.07,7,3.8,.15,0x647970);for(let j=0;j<9;j++)kit.box(x,y+.3+j*.4,front+.17,7,.045,.03,0x3f5c53);}
      for(let i=0;i<3;i++){const x=b.x-b.w/2+2+i*1.5;kit.box(x,y+.6,front+2,1.1,1.2,1.1,0x8b7551);kit.box(x,y+.65,front+2,.13,1.2,1.14,0x485e51);}
      if(b.seed%3===0)sign(scene,'ORIN FISH & FREIGHT',b.x,y+b.height-.5,front+.2,b.w-2);
    }else{
      // Art deco piers visually carry each tier into its setback without poking into upper floors.
      for(const tier of b.tiers){
        const ty=y+tier.y,tf=b.z+tier.d/2+.2;
        for(const dx of [-tier.w*.36,tier.w*.36])kit.box(b.x+dx,ty+tier.h/2,tf,.62,tier.h,.50,0xbabca6,0,1);
      }
      kit.box(b.x,y+4,front+1.4,b.w*.6,.5,3,0x4d6c63);
    }
    if(rng()>.7)for(let j=0;j<4;j++)kit.add('rock',b.x+b.w/2-1,y+.1,front+1+j*.4,.7,.16,.5,0x647b48);
  }
}
