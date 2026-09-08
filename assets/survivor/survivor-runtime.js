import {createSurvivor,animateSurvivor} from './player-survivor.js';
// Deliberately isolated from weapons, level state and networking. Existing player
// state drives both views; scene ownership survives the world's sector rebuilds.
export function updateSurvivors(renderer,run,now){
 let state=renderer._survivors;if(!state){state=renderer._survivors={local:createSurvivor({firstPerson:true}),peer:createSurvivor()};renderer.scene.add(state.local,state.peer);}
 const place=(body,p)=>{const yaw=-(p.angle||0)-Math.PI/2;body.position.set(p.x*4+(body.userData.firstPerson?Math.sin(yaw)*.08:0),(p.z||0)*4+Math.min(1,p.slide||0)*.17,p.y*4+(body.userData.firstPerson?Math.cos(yaw)*.08:0));body.rotation.y=yaw;animateSurvivor(body,p,now*.001);body.userData.head.rotation.y=0;};
 place(state.local,run);const crouch=Math.min(1,run.slide||0);state.local.scale.setScalar(1-crouch*.3);state.local.position.y=(run.z||0)*4+crouch*.125;state.local.translateZ(-crouch*.25);state.local.visible=run.mode!=='ready';
 // A pitched first-person camera must never see the inside of a chest or neck.
 // The local chest shell stays culled; garments remain on the full-body peer.
 state.peer.visible=!!run.peer;if(run.peer)place(state.peer,run.peer);if(renderer._peer?.root)renderer._peer.root.visible=false;
 // First-person arms are owned and posed by the weapon rig.
}
