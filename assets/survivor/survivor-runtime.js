import {createSurvivor,animateSurvivor} from './player-survivor.js';
export function updateSurvivors(renderer,run,now){
 let state=renderer._survivors;
 if(!state){state=renderer._survivors={local:createSurvivor({firstPerson:true}),peer:createSurvivor()};renderer.scene.add(state.local,state.peer);}
 const place=(body,p)=>{const yaw=-(p.angle||0)-Math.PI/2,back=body.userData.firstPerson?(.38-.12*Math.min(1,p.slide||0)):0;body.position.set(p.x*4+Math.sin(yaw)*back,(p.z||0)*4+(body.userData.firstPerson?0:Math.min(1,p.slide||0)*.17),p.y*4+Math.cos(yaw)*back);body.rotation.y=yaw;body.scale.setScalar(1);animateSurvivor(body,p,now*.001);body.userData.head.rotation.y=0;};
 place(state.local,run);state.local.visible=run.mode!=='ready';state.peer.visible=!!run.peer;
 if(run.peer)place(state.peer,run.peer);if(renderer._peer?.root)renderer._peer.root.visible=false;
}
