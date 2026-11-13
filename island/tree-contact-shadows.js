import {accessSurface} from './access-plan.js';

// Reuse the ground's triangle clipping, including diagonal folds. Build once;
// the merged decal uses the existing contact-shadow material and radial map.
export function treeContactShadowGeometry(trees,terrain,grid){
 const positions=[],uvs=[],entries=[],heights=new Map();
 const height=(x,z)=>{const key=x+','+z;let value=heights.get(key);if(value===undefined){value=terrain(x,z);heights.set(key,value);}return value;};
 for(const [tree,t]of trees.entries()){
  if(t.urban||![t.x,t.z,t.scale].every(Number.isFinite)||t.scale<=0)continue;
  const x=t.x+.35,z=t.z,sx=t.scale*5,sz=t.scale*4,start=positions.length/3;
  const vertices=accessSurface([{points:[[x,z-sz],[x,z+sz]],width:sx*2}],height,grid);
  for(let i=0;i<vertices.length;i+=3){const xx=vertices[i],zz=vertices[i+2];positions.push(xx,vertices[i+1],zz);uvs.push(Math.max(0,Math.min(1,(xx-x)/(2*sx)+.5)),Math.max(0,Math.min(1,.5-(zz-z)/(2*sz))));}
  entries.push({tree,start,count:positions.length/3-start});
 }
 return {positions,uvs,entries};
}
