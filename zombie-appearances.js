// Visual identity is independent of locomotion, wounds and host AI state.
// Once spawned, an injured runner keeps the same body while its gait changes.
export const ASH_WITNESS_APPEARANCE='ash-witness';
export const ASH_WITNESS_MODEL_URL='./assets/models/afterlife-ash-witness-motion-v07.glb';
const palette=values=>Object.freeze(values);
export const ZOMBIE_APPEARANCES=Object.freeze({
 [ASH_WITNESS_APPEARANCE]:Object.freeze({id:ASH_WITNESS_APPEARANCE,label:'Ash Witness',url:ASH_WITNESS_MODEL_URL}),
 'drowned-dockworker':Object.freeze({id:'drowned-dockworker',label:'Drowned Dockworker',url:'./assets/models/zombie-variants/drowned-dockworker.glb',palette:palette({skin:'#adbeb7',shirt:'#b4b28e',jacket:'#587076',trousers:'#3e535e',boots:'#263b43',oral:'#604047',teeth:'#c8c0a3'})}),
 'fever-runner':Object.freeze({id:'fever-runner',label:'Fever Runner',url:'./assets/models/zombie-variants/fever-runner.glb',palette:palette({skin:'#c5b6a7',shirt:'#bda477',jacket:'#8b514d',trousers:'#594749',boots:'#303237',oral:'#783a3c',teeth:'#cec2a0'})}),
 'crooked-crawler':Object.freeze({id:'crooked-crawler',label:'Crooked Crawler',url:'./assets/models/zombie-variants/crooked-crawler.glb',palette:palette({skin:'#b8bea5',shirt:'#b6bba5',jacket:'#596653',trousers:'#474f47',boots:'#2c3835',oral:'#664b49',teeth:'#cec5a7'})}),
});
export const GENERATED_ZOMBIE_APPEARANCES=Object.freeze(Object.values(ZOMBIE_APPEARANCES).filter(a=>a.id!==ASH_WITNESS_APPEARANCE));
const requiredClips=Object.freeze(['Idle','Shuffle','Chase','AttackLunge','HitRecoil','Collapse','Run','Crawl','CrawlIdle','Contort'].map(name=>'AshWitness_'+name));

export function zombieAppearance(id){return Object.hasOwn(ZOMBIE_APPEARANCES,id)?ZOMBIE_APPEARANCES[id]:ZOMBIE_APPEARANCES[ASH_WITNESS_APPEARANCE];}
export function coastalZombieAppearance(enemy,order=0,explicit=enemy?.appearance){
 if(explicit!==undefined&&explicit!==null&&explicit!=='')return explicit;
 if(enemy?.kind!==0||Math.abs(Math.trunc(order))%4===2)return ASH_WITNESS_APPEARANCE;
 return enemy.variant==='bloodhound'?'fever-runner':enemy.variant==='skitter'?'crooked-crawler':'drowned-dockworker';
}
export function zombieEnemyPoolKey(enemy){
 const base=`${enemy.kind}:${enemy.variant||''}`,appearance=enemy.appearance||ASH_WITNESS_APPEARANCE;
 return appearance===ASH_WITNESS_APPEARANCE?base:`${base}:${appearance}`;
}

// The renderer owns one immutable source per appearance. Cloned actors own
// their material instances; the source geometry and atlases stay borrowed.
export class ZombieAppearanceLibrary {
 constructor(load,release){
  this.release=release;this.disposed=false;this.released=new WeakSet();
  this.entries=new Map(GENERATED_ZOMBIE_APPEARANCES.map(descriptor=>[descriptor.id,{descriptor,status:'loading',asset:null,error:null}]));
  this.ready=Promise.all([...this.entries.values()].map(async entry=>{
   let asset;
   try{
    asset=await load(entry.descriptor.url);
    if(!asset?.template)throw new Error('Zombie appearance has no scene');
    const names=new Set(asset.clips?.map(clip=>clip.name)||[]),missing=requiredClips.filter(name=>!names.has(name));
    if(missing.length)throw new Error(`Zombie appearance is missing clips: ${missing.join(', ')}`);
    asset.appearance=entry.descriptor.id;asset.appearancePalette=entry.descriptor.palette;asset.preserveAtlasColors=true;
    asset.template.name=entry.descriptor.label+'Template';
    if(this.disposed){this._release(asset);entry.status='disposed';return;}
    entry.asset=asset;entry.status='ready';
   }catch(error){if(asset)this._release(asset);entry.error=String(error?.message||error);entry.status=this.disposed?'disposed':'error';}
  }));
 }
 get(id){return this.disposed?null:this.entries.get(id)?.asset||null;}
 _release(asset){if(!asset?.template||this.released.has(asset.template))return;this.released.add(asset.template);this.release(asset);}
 dispose(){if(this.disposed)return;this.disposed=true;for(const entry of this.entries.values()){this._release(entry.asset);entry.asset=null;entry.status='disposed';}}
 diagnostics(actors=[]){
  const roots=actors.map(actor=>actor.root||actor);
  return [...this.entries.values()].map(entry=>({id:entry.descriptor.id,url:entry.descriptor.url,status:entry.status,error:entry.error,loaded:!!entry.asset,clips:entry.asset?.clips.map(clip=>clip.name)||[],instances:roots.filter(root=>root.userData?.afterlife?.appearance===entry.descriptor.id).length}));
 }
}
