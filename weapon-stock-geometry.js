import * as THREE from './vendor/three.module.js';

// A shoulder stock has a narrow wrist, a cheek line and a lowered butt. Loft
// those sections along the weapon axis instead of extruding one broad plate.
export function createShoulderStock(sections) {
  const positions=[],uvs=[],indices=[];
  const ring=[[-1,-.70],[-.70,-1],[.70,-1],[1,-.70],[1,.65],[.65,1],[-.65,1],[-1,.65]];
  for(let i=0;i<sections.length;i++){
    const [z,y,halfWidth,halfHeight]=sections[i];
    for(let j=0;j<=ring.length;j++){
      const [x,h]=ring[j%ring.length];positions.push(x*halfWidth,y+h*halfHeight,z);uvs.push(j/ring.length,i/(sections.length-1));
      if(i<sections.length-1&&j<ring.length){const a=i*(ring.length+1)+j,b=a+ring.length+1;indices.push(a,a+1,b,b,a+1,b+1);}
    }
  }
  // Separate cap vertices keep the butt edge and throat shoulder crisp.
  for(const end of [0,sections.length-1]){
    const [z,y,w,h]=sections[end],centre=positions.length/3;positions.push(0,y,z);uvs.push(.5,.5);
    for(const [x,v]of ring){positions.push(x*w,y+v*h,z);uvs.push(x*.5+.5,v*.5+.5);}
    for(let j=0;j<ring.length;j++){
      const a=centre+1+j,b=centre+1+(j+1)%ring.length;
      if(end===0)indices.push(centre,b,a);else indices.push(centre,a,b);
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}
