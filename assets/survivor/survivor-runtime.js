import {createSurvivor,animateSurvivor} from './player-survivor.js';
import {loadMeshySurvivors,animateMeshySurvivor,releaseMeshyAsset} from './meshy-survivor.js';
export function prepareSurvivors(renderer){
 let state=renderer._survivors;
 if(!state){state=renderer._survivors={local:createSurvivor({firstPerson:true}),peer:createSurvivor(),status:'fallback'};renderer.scene.add(state.local,state.peer);}
 if(!state.ready&&renderer.weaponGroups&&typeof document!=='undefined'){state.status='loading';state.ready=loadMeshySurvivors(renderer,state);}
 return state.ready||Promise.resolve();
}
export function disposeSurvivors(renderer){const state=renderer._survivors;if(!state)return;state.disposed=true;for(const body of [state.local,state.peer]){body.userData.mixer?.stopAllAction();body.removeFromParent();releaseMeshyAsset(body);}if(state.template)releaseMeshyAsset(state.template);}
export function updateSurvivors(renderer,run,now){
 if(!renderer._survivors)prepareSurvivors(renderer);const state=renderer._survivors;
 if(state.status==='ready'){
  animateMeshySurvivor(state.local,run,renderer._frameDt||.016,renderer.camera);state.local.visible=run.mode!=='ready';state.peer.visible=!!run.peer;
  if(run.peer)animateMeshySurvivor(state.peer,{...run.peer,mode:run.mode},renderer._frameDt||.016);if(renderer._peer?.root)renderer._peer.root.visible=false;return;
 }
 const place=(body,p)=>{const yaw=-(p.angle||0)-Math.PI/2,back=body.userData.firstPerson?(.38-.12*Math.min(1,p.slide||0)):0;body.position.set(p.x*4+Math.sin(yaw)*back,(p.z||0)*4+(body.userData.firstPerson?0:Math.min(1,p.slide||0)*.17),p.y*4+Math.cos(yaw)*back);body.rotation.y=yaw;body.scale.setScalar(1);animateSurvivor(body,p,now*.001);body.userData.head.rotation.y=0;};
 place(state.local,run);state.local.visible=run.mode!=='ready';state.peer.visible=!!run.peer;
 if(run.peer)place(state.peer,run.peer);if(renderer._peer?.root)renderer._peer.root.visible=false;
}
