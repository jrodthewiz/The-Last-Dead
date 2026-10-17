import * as T from '../vendor/three.module.js';
import {mergeGeometries} from '../vendor/utils/BufferGeometryUtils.js';
import {terrainHeight} from './data.js';
import {LANDING} from './settlement-plan.js';

function birdGeometry(){
 const pieces=[],dummy=new T.Object3D(),color=new T.Color();
 const add=(g,c,p,s,r=0)=>{g=g.toNonIndexed();dummy.position.fromArray(p);dummy.scale.fromArray(s);dummy.rotation.set(r,0,0);dummy.updateMatrix();g.applyMatrix4(dummy.matrix);color.setHex(c);g.setAttribute('color',new T.Float32BufferAttribute(Array.from({length:g.attributes.position.count},()=>color.toArray()).flat(),3));g.deleteAttribute('uv');pieces.push(g);};
 add(new T.IcosahedronGeometry(1,1),0xc4c8ad,[0,.22,0],[.13,.14,.25]);
 add(new T.IcosahedronGeometry(1,0),0xd9d9bf,[0,.37,-.2],[.1,.11,.12]);
 add(new T.ConeGeometry(1,1,4),0xae8e51,[0,.36,-.34],[.037,.16,.037],-Math.PI/2);
 add(new T.ConeGeometry(1,1,4),0x667972,[0,.24,.28],[.09,.27,.025],Math.PI/2);
 for(const x of [-.055,.055]){add(new T.BoxGeometry(1,1,1),0x796f4b,[x,.06,0],[.018,.12,.02]);add(new T.BoxGeometry(1,1,1),0x796f4b,[x,.008,-.027],[.07,.016,.08]);}
 const geometry=mergeGeometries(pieces);for(const g of pieces)g.dispose();return geometry;
}
function wingGeometry(){
 const p=[0,0,0,.31,.018,-.06,.27,0,.19,0,0,0,.27,0,.19,0,0,.23,.31,.018,-.06,.64,-.025,.18,.27,0,.19,.27,0,.19,.64,-.025,.18,.49,-.015,.28],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));const c=[];for(let i=0;i<12;i++)c.push(...new T.Color(i<6?0x83968f:0x3a504e).toArray());g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.computeVertexNormals();return g;
}

// Seven birds share two instanced draws. Each roost has a quiet residence,
// staggered departure, long absence and a visible approach back to its perch.
export function createCoastalRoosts(scene,data){
 const b=data.buildings.find(b=>b.id==='building-54'),repairY=Math.max(...[[-538,175],[-536,181],[-538,181],[-536,175]].map(p=>terrainHeight(...p)))+1;
 const sites=[
  {id:'tidal-landing',radius:7.5,escape:new T.Vector3(80,25,55),perches:[[1274,LANDING.deckY+2.675,226],[1278,LANDING.deckY+2.675,226],[1281,LANDING.deckY+1.16,227]]},
  {id:'island-boatyard',radius:6,escape:new T.Vector3(-70,30,65),perches:[[-537.74,repairY+.665,175],[-536.26,repairY+.665,175]]},
  {id:'alder-books',radius:7,escape:new T.Vector3(25,32,75),perches:[[-5,0],[-1,0]].map(([x])=>[b.x+x,b.baseY+b.height+.175,b.z+b.d/2+.15])}
 ];
 const count=sites.reduce((n,s)=>n+s.perches.length,0),material=new T.MeshLambertMaterial({vertexColors:true,flatShading:true,side:T.DoubleSide}),bodies=new T.InstancedMesh(birdGeometry(),material,count),wings=new T.InstancedMesh(wingGeometry(),material,count*2);
 bodies.name='Coastal roost birds';wings.name='Coastal roost wings';bodies.instanceMatrix.setUsage(T.DynamicDrawUsage);wings.instanceMatrix.setUsage(T.DynamicDrawUsage);bodies.frustumCulled=wings.frustumCulled=false;scene.add(bodies,wings);
 let index=0,previous=null;const wing=new T.Object3D(),matrix=new T.Matrix4(),hidden=new T.Matrix4().makeScale(0,0,0);
 for(const site of sites){site.birds=site.perches.map((p,i)=>{const root=new T.Object3D(),home=new T.Vector3(...p);root.position.copy(home);return {root,home,index:index++,phase:i*1.71+index*.39,state:'perched',age:0,quiet:0,cooldown:0,yaw:.45+i*.8};});}
 function place(b,flight,time){
  const root=b.root;root.updateMatrix();bodies.setMatrixAt(b.index,root.matrix);
  for(let j=0;j<2;j++){
   const side=j?1:-1;wing.position.set(side*.07,.27,.015);wing.scale.set(side,1,1);
   // Fold the tips aft while resting. Takeoff unfolds before the first stroke.
   wing.rotation.set(0,side*T.MathUtils.lerp(-1.19,0,flight),side*(flight*(Math.sin(time*13+b.phase)*.72+.12)));
   wing.updateMatrix();matrix.multiplyMatrices(root.matrix,wing.matrix);wings.setMatrixAt(b.index*2+j,matrix);
  }
 }
 return {sites,bodies,wings,update(time,camera){
  const dt=previous===null?0:T.MathUtils.clamp(time-previous,0,.1);previous=time;let visible=0;
  for(const site of sites)for(const b of site.birds){
   const distance=b.home.distanceTo(camera);b.age+=dt;b.cooldown=Math.max(0,b.cooldown-dt);
   if(b.state==='perched'&&distance<site.radius&&b.cooldown===0){b.state='alert';b.age=0;}
   if(b.state==='alert'&&b.age>.13+(b.index%3)*.19){b.state='departing';b.age=0;}
   if(b.state==='departing'&&b.age>4.8){b.state='away';b.age=0;b.quiet=0;}
   if(b.state==='away'){b.quiet=distance>22?b.quiet+dt:0;if(b.age>32+b.index*2&&b.quiet>8){b.state='returning';b.age=0;}}
   if(b.state==='returning'&&b.age>6){b.state='perched';b.age=0;b.cooldown=12;}
   let flight=0;b.root.position.copy(b.home);b.root.rotation.set(0,b.yaw,0);
   if(b.state==='departing'||b.state==='returning'){
    const departing=b.state==='departing',p=departing?T.MathUtils.clamp(b.age/4.8,0,1):1-T.MathUtils.smoothstep(b.age,0,6),travel=p*p;
    b.root.position.addScaledVector(site.escape,travel);b.root.position.y+=Math.sin(p*Math.PI)*5;
    const heading=Math.atan2(departing?-site.escape.x:site.escape.x,departing?-site.escape.z:site.escape.z);b.root.rotation.y=departing?heading:b.yaw+Math.atan2(Math.sin(heading-b.yaw),Math.cos(heading-b.yaw))*T.MathUtils.smoothstep(p,0,.12);b.root.rotation.z=Math.sin(p*Math.PI)*.12;
    flight=T.MathUtils.smoothstep(p,0,.08);b.root.rotation.x=(departing?-.13:.08)*flight;
   }else if(b.state==='alert'){b.root.position.y-=Math.sin(b.age*5)*.025;flight=Math.min(.3,b.age*.8);const heading=Math.atan2(-site.escape.x,-site.escape.z);b.root.rotation.y+=Math.atan2(Math.sin(heading-b.yaw),Math.cos(heading-b.yaw))*T.MathUtils.smoothstep(b.age,0,.13+(b.index%3)*.19);}
   else if(b.state==='perched'){b.root.rotation.y+=Math.sin(time*.65+b.phase)*.08;b.root.rotation.x=Math.max(0,Math.sin(time*.42+b.phase)-.92)*1.2;}
   if(distance>180||b.state==='away'){bodies.setMatrixAt(b.index,hidden);wings.setMatrixAt(b.index*2,hidden);wings.setMatrixAt(b.index*2+1,hidden);}else{place(b,flight,time);visible++;}
  }
  bodies.visible=wings.visible=visible>0;if(visible){bodies.instanceMatrix.needsUpdate=true;wings.instanceMatrix.needsUpdate=true;}
 }};
}
