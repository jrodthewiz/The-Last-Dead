import * as T from '../vendor/three.module.js';

export function fitRipperControl(root){
 if(root.userData.ripperControl)return;
 const meta=root.userData.melee,offset=new T.Vector3(0,-.10,.09);
 // Keep the actual handle, throttle/guard and hand target together. A short
 // cast lug seats this lower rear control below the motor, where it can be
 // read in first person instead of being hidden inside the casing silhouette.
 for(const name of ['chainsaw-rear-grip','chainsaw-trigger-guard'])meta.parts[name].position.add(offset);
 meta.sockets.grip.position.add(offset);
 const box=(name,p,size)=>{const mesh=new T.Mesh(new T.BoxGeometry(...size),meta.materials.iron);mesh.name=name;mesh.position.set(...p);root.add(mesh);return mesh;};
 box('Ripper cast rear throttle mounting lug',[0,-.115,.295],[.13,.11,.11]);
 box('Ripper lower control stay',[0,-.355,.265],[.10,.06,.12]);
 root.userData.ripperControl={offset:offset.toArray(),mount:'cast-lug-and-lower-stay'};
}
