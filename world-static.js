// Compile the remaining static scene graph after material batching. Animated
// subtrees retain their original objects and normal Three.js transform updates.
export function finalizeStaticWorld(root, dynamicRoots = []) {
 const dynamic=new Set(dynamicRoots.filter(Boolean));let frozen=0,pruned=0;
 root.updateWorldMatrix(true,true);
 function visit(node){
  if(dynamic.has(node)||node.userData?.noBatch)return;
  for(const child of [...node.children])visit(child);
  if(node!==root&&node.isGroup&&!node.children.length){node.removeFromParent();pruned++;return;}
  node.updateMatrix();node.matrixAutoUpdate=false;frozen++;
 }
 visit(root);return{frozen,pruned};
}
