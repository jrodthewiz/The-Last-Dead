import * as THREE from './vendor/three.module.js';
import {createExtractionAnatomy} from './extraction-anatomy.js';
import {HarvestSurface} from './extraction-surface.js';
import {applyHarvestTissueMaterials,disposeHarvestTissueTextures,harvestTissueTexturesReady} from './extraction-tissue-materials.js';
import {createAfterlifeModel,disposeAfterlifeModel} from './npc-afterlife-model.js';

const clamp=THREE.MathUtils.clamp;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const FRONT=new THREE.Vector3(0,0,1);
export const HARVEST_LIMITS=Object.freeze({corpses:4,chains:2,particles:32});

// All geometry is in metres. Imported sockets have centimetre-scale parents:
// copy their final world frame, never parent a metre-size organ to the bone.
export class HarvestCutaways {
  constructor(renderer) {
    this.renderer=renderer;this.states=new Map();this.current=null;
    this.root=new THREE.Group();this.root.name='PersistentHarvestAnatomy';renderer.scene.add(this.root);
    this.point=new THREE.Vector3();this.axis=new THREE.Vector3();this.rotation=new THREE.Quaternion();
    this.torsoUp=new THREE.Vector3();this.torsoFront=new THREE.Vector3();this.torsoRight=new THREE.Vector3();this.torsoBasis=new THREE.Matrix4();
    this.run=null;this.course=null;
    // Decode shared tissue images during loading, before the first G hold.
    this.ready=harvestTissueTexturesReady();
  }
  get physics(){return this.renderer.brutalCombatVisuals?.physics;}
  get combat(){return this.renderer.brutalCombatVisuals;}
  async prepareWarmup(){
    if(this.disposed)return ()=>{};
    if(!this._warmup){
      const anatomy=createExtractionAnatomy(25),materials=applyHarvestTissueMaterials(anatomy);
      anatomy.setOpening(1);anatomy.useSourceSkin();
      // The incision uses its own tissue response and vertex-color layout.
      // Retain a tiny representative alongside the organ geometry so that
      // releasing the loading pose cannot dispose the compiled variants.
      const geometry=new THREE.PlaneGeometry(.1,.1),n=geometry.attributes.position.count;
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(n*3).fill(1),3));
      geometry.setAttribute('tissueRegion',new THREE.Float32BufferAttribute(new Float32Array(n),1));
      const edge=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x5e1721,roughness:.46,side:THREE.DoubleSide}));
      anatomy.root.add(edge);materials.addMesh(edge,{tintStrength:.9,diffuseGain:.62,occlusion:.7,regionalGain:false});
      anatomy.root.name='HarvestPreparationSample';anatomy.root.visible=false;this.root.add(anatomy.root);
      this._warmup={anatomy,materials,edge,geometry};
    }
    const sample=this._warmup;
    if(!sample.actor&&this.renderer._ashWitnessAsset&&this.combat){
      // First incision also switches the SOURCE skinned material to the wound
      // hook. Static organs cannot warm that skinning/attribute combination.
      // A private owner avoids occupying or evicting any live wounded actor.
      const actor=createAfterlifeModel(this.renderer._ashWitnessAsset,0,25);
      const combat=Object.create(Object.getPrototypeOf(this.combat));
      Object.assign(combat,{root:new THREE.Group(),actors:new Map()});
      actor.updateMatrixWorld(true);combat.bindActor(actor);
      const borrowed=new Set();(this.renderer._ashWitnessAsset.template||this.renderer._ashWitnessAsset).traverse(node=>{if(node.geometry)borrowed.add(node.geometry);});
      actor.name='HarvestSkinnedPreparationSample';actor.visible=false;
      sample.anatomy.root.add(actor,combat.root);Object.assign(sample,{actor,combat,borrowed});
    }
    await sample.materials.ready;
    if(this.disposed)return ()=>{};
    const saved=[];sample.anatomy.root.traverse(object=>{saved.push([object,object.visible,object.frustumCulled]);object.visible=true;object.frustumCulled=false;});
    const visible=this.root.visible;this.root.visible=true;
    let restored=false;
    return ()=>{if(restored)return;restored=true;this.root.visible=visible;for(const [object,wasVisible,wasCulled]of saved){object.visible=wasVisible;object.frustumCulled=wasCulled;}};
  }
  create(enemy,body,seed) {
    while(this.states.size>=HARVEST_LIMITS.corpses)this.remove(this.states.keys().next().value);
    const anatomy=createExtractionAnatomy(seed),frame=anatomy.root;
    const tissueMaterials=applyHarvestTissueMaterials(anatomy);
    this.root.add(frame);
    const anchorFrame=new THREE.Group();anchorFrame.name='ActualHarvestSkinFrame';this.root.add(anchorFrame);
    const state={id:enemy.id,body,anatomy,frame,anchorFrame,tissueMaterials,opening:0,rip:0,chain:null,chainPoints:null,supportPoints:null,heartBase:anatomy.heart.position.clone(),heartDrop:null,released:false};
    this.place(state);
    state.surface=new HarvestSurface(this.combat.bindActor(body),anchorFrame);
    tissueMaterials.addMesh(state.surface.edge,{tintStrength:.9,diffuseGain:.62,occlusion:.7,regionalGain:false});
    // Anatomy is seated inside the imported coat, whose measured front is
    // near the socket plane. The source skin itself supplies the wound lips.
    anatomy.useSourceSkin();
    this.states.set(enemy.id,state);return state;
  }
  place(state) {
    const {body,anchorFrame:frame}=state,chest=body.getObjectByName('Socket_Chest'),abdomen=body.getObjectByName('Socket_Abdomen');
    if(!chest)return false;
    chest.getWorldPosition(frame.position);chest.getWorldQuaternion(frame.quaternion);
    if(abdomen){
      abdomen.getWorldPosition(this.point);
      // Exported spine bone axes are not anatomical axes. Derive headward Y
      // from the actual chest/abdomen locations, retaining the socket's front.
      this.torsoUp.copy(frame.position).sub(this.point).normalize();
      this.torsoFront.copy(FRONT).applyQuaternion(frame.quaternion);
      this.torsoFront.addScaledVector(this.torsoUp,-this.torsoFront.dot(this.torsoUp)).normalize();
      this.torsoRight.crossVectors(this.torsoUp,this.torsoFront).normalize();
      this.torsoFront.crossVectors(this.torsoRight,this.torsoUp).normalize();
      this.torsoBasis.makeBasis(this.torsoRight,this.torsoUp,this.torsoFront);frame.quaternion.setFromRotationMatrix(this.torsoBasis);
      frame.position.lerp(this.point,.42);
    }
    frame.scale.setScalar(body.userData.afterlife?.normalization||1);
    frame.updateWorldMatrix(true,true);
    state.frame.position.copy(frame.position).addScaledVector(this.torsoFront,-.075*frame.scale.x);
    state.frame.quaternion.copy(frame.quaternion);state.frame.scale.copy(frame.scale);state.frame.updateWorldMatrix(true,true);return true;
  }
  update(run,values,target,{gore=true,reducedMotion=false}={}) {
    if(this.run!==run||this.course!==run.course){this.reset();this.run=run;this.course=run.course;}
    this.root.visible=gore;this.current=null;
    for(const [id,state]of this.states){
      const enemy=run.course.enemies.find(e=>e.id===id),body=this.renderer._enemyVisuals.get(id)?.root;
      if(!enemy||body!==state.body){this.remove(id);continue;}
      this.place(state);
    }
    if(target&&values){
      const body=this.renderer._enemyVisuals.get(target.id)?.root;
      if(body?.userData.afterlifeModel&&body.getObjectByName('Socket_Chest')){
        const state=this.states.get(target.id)||this.create(target,body,Number(target.extractionSeed||run.extraction?.seed||target.id));
        this.current=state;this.place(state);
        // Cancellation retains the actual partial cut, while rewards continue
        // to be owned exclusively by the existing authoritative simulation.
        state.opening=Math.max(state.opening,clamp(values.incise*.92+values.rip*.08,0,1));
        state.rip=Math.max(state.rip,values.rip);
      }
    }
    for(const state of this.states.values()){
      const {anatomy,frame}=state,enemy=run.course.enemies.find(e=>e.id===state.id);
      if(state.surface.entries.some(e=>e.mesh.geometry!==e.geometry)){
        state.tissueMaterials.removeMesh(state.surface.edge);state.surface.dispose();state.surface=new HarvestSurface(this.combat.bindActor(state.body),state.anchorFrame);state.tissueMaterials.addMesh(state.surface.edge,{tintStrength:.9,diffuseGain:.62,occlusion:.7,regionalGain:false});
      }
      frame.visible=gore&&state.body.visible&&state.opening>.002;
      anatomy.setOpening(state.opening);
      this.combat?.setHarvestCut(state.body,state.anchorFrame,gore?state.opening:0);
      state.surface.update(gore?state.opening:0);
      if(!state.released){
        const pull=smooth(state.rip),pulse=reducedMotion?1:1+.018*Math.sin((run.time||0)*8.4+state.id);
        anatomy.heart.position.copy(state.heartBase).add(this.point.set(.04*pull,.04*pull,.31*pull));
        anatomy.heart.scale.setScalar(pulse*(1-.12*pull));
        if(enemy?.extracted&&this.physics){
          frame.updateWorldMatrix(true,true);this.root.attach(anatomy.heart);
          anatomy.heart.visible=gore;state.released=true;
          this.axis.copy(FRONT).applyQuaternion(frame.quaternion).multiplyScalar(.32);this.axis.y+=.08;
          state.heartDrop=this.physics.addDrop(anatomy.heart,{radius:.06,mass:.3,velocity:this.axis,angularVelocity:new THREE.Vector3(1.3,-.7,.5),lifetime:16});
        }
      }else anatomy.heart.visible=gore&&!!state.heartDrop&&!state.heartDrop.removed;
      if(state.rip>.04&&!state.chain&&this.physics&&!state.chainEnded){
        frame.updateWorldMatrix(true,true);
        const points=anatomy.coilPoints.map(p=>frame.localToWorld(p.clone()));
        state.supportPoints=points.map(p=>p.clone());
        state.chain=this.physics.addTissueChain(points,{radius:.013,mass:.03,supportPoints:state.supportPoints});
      }
      if(state.chain&&!state.chain.removed){
        this.point.copy(anatomy.coilPoints[0]);frame.localToWorld(this.point);
        let pull=null;
        if(this.current===state&&values?.phase==='rip'&&!enemy.extracted&&state.rip<.58){
          // A short lateral spill releases into gravity before the heart is
          // lifted. Bowel is not dragged upward along the forceps' trajectory.
          pull=anatomy.coilPoints.at(-1).clone();const spill=smooth(state.rip/.58);
          pull.x+=.075*spill;pull.y-=.03*spill;pull.z+=.055*Math.sin(spill*Math.PI);frame.localToWorld(pull);
        }
        for(let i=0;i<state.supportPoints.length;i++)frame.localToWorld(state.supportPoints[i].copy(anatomy.coilPoints[i]));
        this.physics.setTissueChain(state.chain,{anchor:this.point,pull,pullCompliance:true,supportPoints:state.supportPoints,extractionProgress:Math.min(.82,state.rip)});
        state.chainPoints=this.physics.tissueChainPoints(state.chain,state.chainPoints);
        // Keep rendering topology stable as the constrained particles move.
        for(const point of state.chainPoints)frame.worldToLocal(point);
        anatomy.updateIntestines(state.chainPoints);
      }else if(state.chain?.removed){state.chainEnded=true;state.chain=null;}
    }
    if(this.current&&values&&this.renderer.camera){
      const camera=this.renderer.camera,weight=clamp(this.renderer._extractionLean??1,0,1)*.78;
      camera.updateWorldMatrix(true,false);this.point.copy(this.current.frame.position);camera.worldToLocal(this.point);
      camera.rotation.y+=clamp(Math.atan2(-this.point.x,-this.point.z),-.65,.65)*weight;
      camera.rotation.x+=clamp(Math.atan2(this.point.y,Math.hypot(this.point.x,this.point.z)),-.55,.55)*weight;
      camera.updateWorldMatrix(true,false);
    }
    return this.current;
  }
  cutPoint(state,progress,target=new THREE.Vector3()) {
    target.set(0,THREE.MathUtils.lerp(.235,-.235,progress),.004);
    return state.anchorFrame.localToWorld(target);
  }
  remove(id) {
    const state=this.states.get(id);if(!state)return;
    if(state.chain)this.physics?.removeTissueChain(state.chain);
    if(state.heartDrop)this.physics?.removeDrop(state.heartDrop);
    this.combat?.setHarvestCut(state.body,null,0);
    state.surface.dispose();state.anchorFrame.removeFromParent();
    state.tissueMaterials.dispose();
    state.anatomy.heart.removeFromParent();state.frame.removeFromParent();state.anatomy.dispose();this.states.delete(id);
  }
  reset(){for(const id of [...this.states.keys()])this.remove(id);this.current=null;}
  diagnostics(){return{corpses:this.states.size,visible:[...this.states.values()].filter(s=>s.frame.visible&&this.root.visible).length,current:this.current?.id??null,opening:this.current?.opening??0,organs:this.current?.anatomy.diagnostics()??null,surface:this.current?.surface.diagnostics()??null,materials:this.current?.tissueMaterials.diagnostics()??null,chains:[...this.states.values()].filter(s=>s.chain&&!s.chain.removed).length,heartsDropped:[...this.states.values()].filter(s=>s.released).length,limits:HARVEST_LIMITS};}
  dispose(){this.disposed=true;this.reset();if(this._warmup){const s=this._warmup;if(s.actor){s.combat.releaseActor(s.actor);disposeAfterlifeModel(s.actor);const materials=new Set(),geometries=new Set(),skeletons=new Set();s.actor.traverse(node=>{if(node.geometry&&!s.borrowed.has(node.geometry))geometries.add(node.geometry);if(node.skeleton)skeletons.add(node.skeleton);for(const m of Array.isArray(node.material)?node.material:node.material?[node.material]:[])materials.add(m);});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const skeleton of skeletons)skeleton.dispose();}s.materials.dispose();s.geometry.dispose();s.edge.material.dispose();s.anatomy.dispose();this._warmup=null;}this.root.removeFromParent();disposeHarvestTissueTextures();}
}
