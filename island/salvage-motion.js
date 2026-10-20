import * as T from '../vendor/three.module.js';
import {SALVAGE_RESPONSE,salvageMotionAge} from './salvage-response.js';

// Camera-local metres: +X right, +Y up, -Z forward. These paths move the
// actual edge/face/coupling through the aiming line. Combat owns when/what
// takes damage; this module only projects that committed action.
export const SALVAGE_CONTACTS=Object.freeze({
 sword:{point:[.031,.015,-.73],normal:[1,0,0]},
 hammer:{point:[.227,.015,-.86],normal:[1,0,0]},
 pipe:{point:[-.0675,.015,-.858],normal:[-1,0,0]},
});
const DESIGNS={
 sword:{ready:[.92,-.28,-.38],windup:[1.04,-.65,-.70],follow:[.08,.52,-1.35],recover:[.58,.12,-.70],load:.48,followTime:.105,recoverAt:.76,
  high:[.34,.34,-1.14],low:[-.30,-.30,-1.26],return:[-.06,-.16,-1.18]},
 hammer:{ready:[1.02,-.12,-.10],windup:[1.34,-.18,-.52],follow:[-.38,-.12,-1.57],recover:[.55,-.16,-.66],load:.64,followTime:.145,recoverAt:.80,
  high:[.04,.57,-1.26],low:[0,-.30,-1.30],return:[.10,-.08,-1.16]},
 pipe:{ready:[.78,-.18,-.16],windup:[.70,-.52,-.04],follow:[.68,.48,.13],recover:[.57,.02,-.06],load:.42,followTime:.075,recoverAt:.73,
  high:[.29,0,-1.30],low:[-.25,0,-1.30],return:[.05,-.14,-1.17]},
};
const euler=new T.Euler(),basis=new T.Matrix4(),axisX=new T.Vector3(),axisY=new T.Vector3(),axisZ=new T.Vector3(),direction=new T.Vector3(),normal=new T.Vector3(),inverse=new T.Quaternion(),point=new T.Vector3(),rotation=new T.Quaternion();
const relative=new T.Quaternion(),curveA=new T.Quaternion(),curveB=new T.Quaternion(),curveC=new T.Quaternion(),curveD=new T.Quaternion(),curveE=new T.Quaternion(),angular=new T.Vector3();
const smooth=t=>t*t*(3-2*t);
const GRASP=[0,.40,1,.90,.35,0],EMPTY_ARMS=[];
const setRotation=(q,r)=>q.setFromEuler(euler.set(...r));
function stateFor(root,id){
 let s=root.userData.salvageMotion;if(s)return s;
 const design=DESIGNS[id];if(!design)throw new RangeError('Unknown salvage motion: '+id);
 s={id,design,points:Array.from({length:6},()=>new T.Vector3()),velocities:Array.from({length:6},()=>new T.Vector3()),angular:Array.from({length:6},()=>new T.Vector3()),rotations:Array.from({length:6},()=>new T.Quaternion()),times:new Float64Array(6),phase:'ready',age:0};
 setRotation(s.rotations[0],design.ready);setRotation(s.rotations[1],design.windup);setRotation(s.rotations[3],design.follow);setRotation(s.rotations[4],design.recover);s.rotations[5].copy(s.rotations[0]);root.userData.salvageMotion=s;return s;
}
function contactRotation(id,inset,q){
 if(id==='sword'){direction.set(-.55*inset,.55*inset*inset,-.63);normal.set(-inset,-1,0);}
 else if(id==='hammer'){direction.set(-.30*inset,0,-1);normal.set(0,-1,0);}
 else{direction.set(-.035*inset,.55,-.83);normal.set(-1,0,0);}
 direction.normalize();axisZ.copy(direction).negate();axisX.copy(normal).addScaledVector(axisZ,-normal.dot(axisZ)).normalize();
 // The pipe's left coupling wall leads its short leftward swing.
 if(id==='pipe')axisX.negate();axisY.crossVectors(axisZ,axisX).normalize();basis.makeBasis(axisX,axisY,axisZ);q.setFromRotationMatrix(basis);
}
function hermite(out,a,b,va,vb,t,span){
 const t2=t*t,t3=t2*t;return out.copy(a).multiplyScalar(2*t3-3*t2+1).addScaledVector(b,-2*t3+3*t2).addScaledVector(va,(t3-2*t2+t)*span).addScaledVector(vb,(t3-t2)*span);
}
function rotationLog(out,from,to){
 relative.copy(from).invert().multiply(to);if(relative.w<0)relative.set(-relative.x,-relative.y,-relative.z,-relative.w);
 const length=Math.hypot(relative.x,relative.y,relative.z),factor=length>1e-8?Math.atan2(length,relative.w)/length:1;
 return out.set(relative.x*factor,relative.y*factor,relative.z*factor);
}
function rotationExp(out,v,scale){
 const angle=v.length()*scale,factor=Math.abs(angle)>1e-8?Math.sin(angle)/angle*scale:scale;
 return out.set(v.x*factor,v.y*factor,v.z*factor,Math.cos(angle));
}
function flowingRotation(out,q,velocities,segment,u,span){
 // Spherical cubic controls preserve angular velocity through follow/return
 // knots. Load, contact and final ready deliberately have zero angular speed.
 rotationExp(curveA,velocities[segment],span/3).premultiply(q[segment]);
 rotationExp(curveB,velocities[segment+1],-span/3).premultiply(q[segment+1]);
 curveC.slerpQuaternions(q[segment],curveA,u);curveD.slerpQuaternions(curveA,curveB,u);curveE.slerpQuaternions(curveB,q[segment+1],u);
 curveC.slerp(curveD,u);curveD.slerp(curveE,u);out.slerpQuaternions(curveC,curveD,u);
}
export function animateSalvageMelee(root,{id,age,contact,duration,active,group,aspect,hit='',impactFrame=false}){
 const s=stateFor(root,id),d=s.design,p=s.points,q=s.rotations,t=s.times,v=s.velocities,inset=Math.min(1,aspect/.9),scale=group.scale.x,end=duration-.045;
 contactRotation(id,inset,q[2]);
 point.fromArray(SALVAGE_CONTACTS[id].point);p[0].copy(point).applyQuaternion(q[0]).multiplyScalar(scale).add(group.position);p[5].copy(p[0]);
 p[1].fromArray(d.high);p[1].x*=inset;p[2].set(0,0,-1.30);p[3].fromArray(d.low);p[3].x*=inset;p[4].fromArray(d.return);p[4].x*=inset;
 t[0]=0;t[1]=contact*d.load;t[2]=contact;t[3]=contact+d.followTime;t[4]=duration*d.recoverAt;t[5]=end;
 setRotation(q[3],d.follow);
 if(hit){const response=SALVAGE_RESPONSE[id],wall=hit==='wall',hard=wall?1.15:1;p[3].multiplyScalar(wall?(response.wallFollow??response.follow):response.follow);p[3].z=-1.30+(wall?(response.wallRetreat||0):0);
  if(id==='hammer')p[3].y=response.rebound*hard;
  if(id==='pipe')p[3].x=response.rebound*inset*hard;
  q[3].slerp(q[2],id==='sword'?(wall?.80:.22):.62);
 }
 for(const velocity of v)velocity.set(0,0,0);
 if(!hit)v[2].copy(p[3]).sub(p[1]).multiplyScalar(1.20/(t[3]-t[1]));
 v[3].copy(p[4]).sub(p[2]).multiplyScalar(.65/(t[4]-t[2]));v[4].copy(p[5]).sub(p[3]).multiplyScalar(.60/(t[5]-t[3]));
 for(const velocity of s.angular)velocity.set(0,0,0);
 for(let i=3;i<5;i++){rotationLog(s.angular[i],q[i],q[i-1]).multiplyScalar(-.5/(t[i]-t[i-1]));rotationLog(angular,q[i],q[i+1]);s.angular[i].addScaledVector(angular,.5/(t[i+1]-t[i]));}
 // A short settled-ready tail absorbs one render/input frame at the earliest
 // legal repeat. Contact resistance is repaid before this tail, not added to it.
 const time=active?T.MathUtils.clamp(salvageMotionAge(id,age,contact,end,hit,impactFrame),0,end):0;let segment=0;while(segment<4&&time>t[segment+1])segment++;
 const u=T.MathUtils.clamp((time-t[segment])/(t[segment+1]-t[segment]),0,1);
 hermite(point,p[segment],p[segment+1],v[segment],v[segment+1],u,t[segment+1]-t[segment]);flowingRotation(rotation,q,s.angular,segment,u,t[segment+1]-t[segment]);
 inverse.copy(group.quaternion).invert();root.quaternion.copy(inverse).multiply(rotation);
 root.position.copy(point).sub(group.position).applyQuaternion(inverse).divideScalar(scale);
 point.fromArray(SALVAGE_CONTACTS[id].point).applyQuaternion(root.quaternion);root.position.sub(point);
 const turn=active?T.MathUtils.lerp(GRASP[segment],GRASP[segment+1],smooth(u)):0;
 for(const arm of group.userData.authoredFPS?.arms||EMPTY_ARMS)arm.grip.rotation.z=(arm.salvageRoll||0)*turn;
 s.age=time;s.rawAge=age;s.hit=hit;s.phase=!active?'ready':hit&&time===contact?'contact':time<t[1]?'load':time<contact?'drive':time<t[3]?'follow-through':'recover';
}

export function fitSalvageHands(group,id){
 // A cylindrical haft accepts a weapon-specific grasp. Preserve the authored
 // palm-to-wrap offset and calibrate the attack's grip turn to the working
 // face. It eases back to the open ready grasp during recovery.
 const contact=new T.Quaternion();contactRotation(id,1,contact);contact.invert();
 for(const arm of group.userData.authoredFPS.arms){
  const offsetRotation=new T.Quaternion(),offsetScale=new T.Vector3(),offsetPosition=new T.Vector3();arm.offset.decompose(offsetPosition,offsetRotation,offsetScale);
  const wrist=arm.wristAxis.clone().applyQuaternion(offsetRotation),approach=new T.Vector3(...(arm.side==='right'?[.50,-.75,.42]:[-.60,-.65,.47])).normalize().applyQuaternion(contact);
  arm.salvageRoll=id==='pipe'?0:Math.atan2(approach.y,approach.x)-Math.atan2(wrist.y,wrist.x);
 }
}

// A deliberate inward/upward hold for narrow views. Firearm sight ownership
// stays unchanged; natural sleeve roots may leave the bottom of the frame.
export function salvageFraming(id,aspect,out){
 const narrow=1-T.MathUtils.smoothstep(aspect,.55,.95),saw=id==='chainsaw';
 out.x=T.MathUtils.lerp(saw?.26:id==='hammer'?.23:.28,saw?.015:.045,narrow);
 out.y=T.MathUtils.lerp(saw?-.26:id==='hammer'?-.24:-.28,saw?-.17:-.18,narrow);
 out.z=T.MathUtils.lerp(saw?-.97:-.85,saw?-1.11:-1.0,narrow);
 out.scale=T.MathUtils.lerp(saw?.56:.58,saw?.44:.48,narrow);return out;
}
