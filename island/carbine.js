import * as T from '../vendor/three.module.js';
import {weaponResponse,reloadWeight} from './weapon-response.js';
import {createLookSway} from './look-sway.js';
import {consoleMaterial} from './retro-materials.js';

// A small authored viewmodel: the wooden furniture has a continuous profile,
// the action has a separate moving bolt, and the support hand owns the magazine.
export function makeRifle(camera){
  const root=new T.Group(),gun=new T.Group();root.add(gun);camera.add(root);
  const material=(color)=>new T.MeshLambertMaterial({color,flatShading:true});
  const m={steel:material(0x4e5c55),edge:material(0x778379),wood:material(0x8e5d36),end:material(0x423e30),skin:material(0xc59a72),glove:material(0x57604a),cloth:material(0x7a8060),seam:material(0x464f3c)};
  // Small painted maps support the large forms at console resolution.
  for(const kind of ['wood','cloth','steel']){const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d');ctx.fillStyle=kind==='wood'?'#b3a18a':kind==='cloth'?'#a8aaa0':'#b6bcb9';ctx.fillRect(0,0,32,32);
    for(let i=0;i<18;i++){ctx.strokeStyle=kind==='wood'?'rgba(47,34,20,.22)':kind==='cloth'?'rgba(36,45,37,.10)':'rgba(244,243,221,.12)';ctx.beginPath();const y=(i*13)%32;ctx.moveTo(0,y);ctx.lineTo(16,y+Math.sin(i)*2);ctx.lineTo(32,y+Math.cos(i)*2);ctx.stroke();}
    const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;m[kind].map=map;consoleMaterial(m[kind],{textureSize:32});}
  m.wood.color.setHex(0x937352);m.cloth.color.setHex(0x697769);
  function mesh(parent,geo,mat,x=0,y=0,z=0){const o=new T.Mesh(geo,m[mat]);o.position.set(x,y,z);parent.add(o);return o;}
  function box(parent,x,y,z,w,h,d,mat){return mesh(parent,new T.BoxGeometry(w,h,d),mat,x,y,z);}
  function profile(parent,points,width,mat){
    const shape=new T.Shape();points.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));shape.closePath();
    const geo=new T.ExtrudeGeometry(shape,{depth:width,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.006,bevelThickness:.005});
    // Shape's X is barrel length; extrusion is weapon width.
    geo.rotateY(-Math.PI/2);geo.translate(width/2,0,0);return mesh(parent,geo,mat);
  }
  function rod(parent,a,b,r,mat,r2=r){const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start);const o=mesh(parent,new T.CylinderGeometry(r2,r,delta.length(),8),mat);o.position.copy(start.add(end).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o;}
  // Stock, slender wrist, fore-end and buttplate are distinct carved surfaces.
  function loft(parent,rings,mat){const positions=[],uv=[],corners=[[-.68,-1],[.68,-1],[1,-.65],[1,.65],[.68,1],[-.68,1],[-1,.65],[-1,-.65]];
    const point=(r,j)=>{const [z,y,w,h]=rings[r],[x,v]=corners[j%8];return [x*w/2,y+v*h/2,z];};
    const tri=(a,b,c)=>{positions.push(...a,...b,...c);for(const p of [a,b,c])uv.push(p[2]*3,p[1]*9);};
    for(let r=0;r<rings.length-1;r++)for(let j=0;j<8;j++){const a=point(r,j),b=point(r,j+1),c=point(r+1,j),d=point(r+1,j+1);tri(a,c,b);tri(b,c,d);}
    for(const r of [0,rings.length-1])for(let j=1;j<7;j++)r===0?tri(point(r,0),point(r,j),point(r,j+1)):tri(point(r,0),point(r,j+1),point(r,j));
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();return mesh(parent,g,mat);}
  loft(gun,[[.385,-.055,.087,.155],[.34,-.045,.086,.145],[.245,-.024,.075,.118],[.18,-.035,.051,.073],[.105,-.036,.045,.068],[.07,-.025,.058,.065]],'wood');
  loft(gun,[[.395,-.055,.090,.159],[.382,-.055,.090,.159]],'end');
  profile(gun,[[.12,-.012],[-.42,-.005],[-.45,.025],[-.43,.06],[-.20,.065],[-.13,.04],[.09,.037]],.072,'wood');
  profile(gun,[[.065,.03],[-.25,.03],[-.27,.065],[-.24,.075],[.025,.075],[.07,.06]],.060,'steel');
  rod(gun,[0,.075,.025],[0,.075,-.25],.027,'steel');
  rod(gun,[0,.069,-.25],[0,.069,-.77],.017,'steel',.014);
  rod(gun,[0,.069,-.77],[0,.069,-.782],.018,'edge');
  rod(gun,[0,.069,-.783],[0,.069,-.785],.009,'end');
  for(const z of [-.38,-.26]){box(gun,0,.025,z,.088,.07,.018,'steel');box(gun,.046,.025,z,.009,.026,.014,'edge');}
  // Recessed ejection port with an independent charging handle.
  box(gun,.038,.075,-.075,.004,.035,.11,'end');
  const bolt=new T.Group();gun.add(bolt);box(bolt,.041,.078,-.07,.011,.025,.075,'edge');rod(bolt,[.045,.073,-.04],[.087,.052,-.04],.009,'steel');mesh(bolt,new T.IcosahedronGeometry(.015,1),'end',.088,.052,-.04);
  for(const [z,w,y] of [[.16,.026,-.035],[-.32,.04,.01]])rod(gun,[-w,y,z],[w,y,z],.005,'edge');
  // A U-shaped guard leaves air around the trigger and the index finger.
  rod(gun,[-.018,-.025,.07],[-.018,-.073,.052],.006,'steel');rod(gun,[-.018,-.073,.052],[-.018,-.073,-.015],.006,'steel');rod(gun,[-.018,-.073,-.015],[-.018,-.025,-.035],.006,'steel');rod(gun,[0,-.026,.027],[0,-.055,.018],.004,'edge');
  const magazine=new T.Group();gun.add(magazine);
  profile(magazine,[[-.025,-.015],[-.12,-.015],[-.13,-.12],[-.115,-.14],[-.028,-.13]],.047,'steel');
  for(const x of [-.026,.026])for(const z of [-.095,-.055])box(magazine,x,-.075,z,.003,.085,.007,'edge');
  // Aperture and front blade share the barrel axis.
  for(const x of [-.018,.018])box(gun,x,.116,.015,.008,.027,.018,'steel');
  box(gun,0,.105,.015,.044,.010,.020,'steel');
  box(gun,0,.111,-.68,.009,.055,.013,'edge');
  for(const x of [-.018,.018])rod(gun,[x,.073,-.68],[x,.127,-.68],.0035,'steel');
  // Leather sling and rivets break up the hard mechanical silhouette.
  const curve=new T.CatmullRomCurve3([new T.Vector3(-.047,-.02,.27),new T.Vector3(-.068,-.15,.03),new T.Vector3(-.049,-.09,-.25),new T.Vector3(-.045,-.005,-.38)]);
  mesh(gun,new T.TubeGeometry(curve,12,.007,4,false),'end');
  function hand(parent,side){
    const g=new T.Group();parent.add(g);
    const palm=mesh(g,new T.SphereGeometry(1,8,5),'glove');palm.scale.set(.032,.038,.043);
    box(g,0,.028,.003,.049,.010,.057,'seam');
    // Four separate bent fingers wrap under the furniture, with exposed tips.
    for(let i=0;i<4;i++){
      if(side===1&&i===0)continue; // The trigger index has its own contact pose.
      const z=(i-1.5)*.018,a=[side*.023,-.003,z],b=[side*.035,-.028,z],c=[side*.012,-.043,z];
      rod(g,a,b,.009,'glove',.008);rod(g,b,c,.008,'skin',.0068);
      mesh(g,new T.IcosahedronGeometry(.009,1),'skin',...b);
    }
    rod(g,[-side*.025,.02,.015],[-side*.041,.003,-.014],.012,'skin',.009);
    rod(g,[-side*.041,.003,-.014],[-side*.020,-.01,-.030],.009,'skin',.007);
    return g;
  }
  const trigger=hand(gun,1);trigger.position.set(.028,-.06,.10);trigger.rotation.set(-.45,0,.27);
  rod(gun,[.05,-.05,.095],[.059,-.034,.060],.009,'glove',.008);
  rod(gun,[.059,-.034,.060],[.025,-.043,.030],.008,'skin',.007);
  rod(gun,[.025,-.043,.030],[.007,-.048,.024],.007,'skin',.006);
  const support=hand(gun,-1);support.position.set(-.037,-.012,-.29);support.rotation.z=-1.1;
  // Sleeves connect wrists to elbows, rather than floating rectangular cuffs.
  function arm(){const g=new T.Group();gun.add(g);const rings=[];for(const [t,w]of [[-.5,.116],[-.32,.124],[-.12,.108],[.10,.100],[.24,.096],[.33,.085],[.43,.077],[.5,.072]])rings.push([t,0,w,w*.88]);const sleeve=loft(g,rings,'cloth');sleeve.rotation.x=-Math.PI/2;
    const cuff=mesh(g,new T.LatheGeometry([new T.Vector2(.039,-.019),new T.Vector2(.042,-.012),new T.Vector2(.039,.006),new T.Vector2(.034,.013)],8),'seam');const wrist=mesh(g,new T.CapsuleGeometry(.027,.012,2,8),'skin');gun.add(wrist);return {g,sleeve,cuff,wrist};}
  const right=arm(),left=arm();
  const armStart=new T.Vector3(),armEnd=new T.Vector3(),armDelta=new T.Vector3(),wristStart=new T.Vector3(),palmSeat=new T.Vector3(),armUp=new T.Vector3(0,1,0);
  function setArm(arm,elbow,hand){hand.updateMatrix();palmSeat.set(0,-.012,.030).applyMatrix4(hand.matrix);armEnd.set(0,-.014,.058).applyMatrix4(hand.matrix);armStart.fromArray(elbow);armDelta.copy(armEnd).sub(armStart);const length=armDelta.length();arm.g.position.copy(armStart).add(armEnd).multiplyScalar(.5);arm.g.quaternion.setFromUnitVectors(armUp,armDelta.normalize());arm.sleeve.scale.z=length-.025;arm.cuff.position.y=length/2-.017;wristStart.copy(armEnd).addScaledVector(armDelta,-.018);arm.wrist.position.copy(wristStart).add(palmSeat).multiplyScalar(.5);armDelta.copy(palmSeat).sub(wristStart);arm.wrist.quaternion.setFromUnitVectors(armUp,armDelta.clone().normalize());arm.wrist.scale.set(1,Math.max(.65,armDelta.length()/.066),.9);}
  setArm(right,[.25,-.32,.36],trigger);
  const flash=new T.Mesh(new T.ConeGeometry(.065,.17,5),new T.MeshBasicMaterial({color:0xffd68c}));flash.rotation.x=-Math.PI/2;flash.position.set(0,.069,-.85);gun.add(flash);flash.visible=false;
  const smooth=(a,b,t)=>T.MathUtils.smoothstep(t,a,b);
  let wasVisible=false,equipAge=1,shotAge=9,lastShot=0;const firePose={};const sway=createLookSway({response:9,xGain:-.3/60,yGain:-.3/60,maxRate:4.8});
  const ejectionSocket=new T.Object3D();ejectionSocket.position.set(.055,.065,-.01);gun.add(ejectionSocket);
  const api={root,gun,flash,magazine,support,trigger,bolt,ejectionSocket,get shotAge(){return shotAge;},poseOverride:null,
    update(time,moving,aim,recoil,reloadPhase,visible,dt=1/60,motion=true,stride=null,shotSequence=null){
      const p=api.poseOverride??reloadPhase,reloading=p>=0,tilt=reloading?reloadWeight(p):0;
      root.visible=visible;root.scale.setScalar(.94);if(!visible){wasVisible=false;shotAge=9;lastShot=shotSequence;sway.reset();return;}
      if(shotSequence!==null){if(!wasVisible)lastShot=shotSequence;if(shotSequence!==lastShot)shotAge=0;else shotAge+=dt;lastShot=shotSequence;}
      if(visible&&!wasVisible)equipAge=0;wasVisible=visible;equipAge=Math.min(1,equipAge+dt*4.5);
      const {x:swayX,y:swayY}=sway.update(camera.rotation.y,camera.rotation.x,dt,motion);
      const bob=motion?(stride?Math.sin(stride.phase)*.007*stride.weight:moving?Math.sin(time*10.5)*.007:Math.sin(time*1.7)*.0015):0;
      weaponResponse('carbine',shotAge,aim,motion,firePose);const kick=shotSequence===null?T.MathUtils.smoothstep(recoil,0,1):firePose.kick;
      root.position.set(T.MathUtils.lerp(.20,0,aim),T.MathUtils.lerp(-.25,-.127,aim)+bob+tilt*.14,-.62+(shotSequence===null?kick*.065:firePose.z)-tilt*.045);
      root.rotation.set(kick*.062-tilt*.12,tilt*.12,-tilt*.30+firePose.roll);
      root.position.x+=swayX*(1-aim*.8);root.position.y+=swayY*(1-aim*.8)-(1-equipAge)**2*.18;root.rotation.z+=swayX*.6;
      // Release, withdraw, insert, charge. The hand and magazine share the
      // withdraw/insert displacement; return to the fore-end is a separate arc.
      const reach=reloading?smooth(0,.18,p):0;
      const drop=reloading?(smooth(.20,.39,p)-smooth(.48,.69,p))*.22:0;
      magazine.position.set(0,-drop,0);magazine.rotation.x=drop*.45;
      support.position.set(T.MathUtils.lerp(-.037,-.036,reach),T.MathUtils.lerp(-.012,-.09,reach)-drop,T.MathUtils.lerp(-.29,-.065,reach));
      support.rotation.z=T.MathUtils.lerp(-1.1,-.6,reach);
      const charge=reloading?(smooth(.79,.82,p)-smooth(.84,.87,p))*.055:0;
      if(reloading&&p>=.70){
        const contact=new T.Vector3(.112,.053,-.04+charge);
        if(p<.78){const t=smooth(.70,.78,p);support.position.lerp(contact,t);support.position.y+=Math.sin(t*Math.PI)*.13;support.rotation.z=T.MathUtils.lerp(-.6,.35,t);}
        else if(p<=.88){support.position.copy(contact);support.rotation.z=.35;}
        else{const t=smooth(.88,1,p);support.position.copy(contact).lerp(new T.Vector3(-.037,-.012,-.29),t);support.position.y+=Math.sin(t*Math.PI)*.13;support.rotation.z=T.MathUtils.lerp(.35,-1.1,t);}
      }
      setArm(left,[-.27,-.27,.21],support);
      bolt.position.z=reloading?charge:(shotSequence===null?recoil:firePose.pulse)*.04;
      flash.visible=shotSequence===null?recoil>.78:shotAge<.035;
    }
  };api.update(0,false,0,0,-1,true);return api;
}
