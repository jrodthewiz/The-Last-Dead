import * as THREE from '../../vendor/three.module.js';

// A carried route booklet, in metres. The origin is the centre of its complete
// .24 x .032 x .20 envelope; the layout owns its supported world placement.
export const EVACUATION_FOLIO_SIZE = Object.freeze([.24, .032, .20]);

export function createEvacuationFolio() {
  const parts = [], slots = Array.from({length: 2}, () => ({position: [], normal: [], uv: []}));
  const a = new THREE.Vector3(), b = new THREE.Vector3(), n = new THREE.Vector3();
  const uvDensity = .20;
  function face(slot, points, outward, label, uvs) {
    const data = slots[slot];
    for (let i = 1; i < points.length - 1; i++) {
      let indices = [0, i, i + 1];
      a.fromArray(points[i]).sub(b.fromArray(points[0]));
      b.fromArray(points[i + 1]).sub(n.fromArray(points[0]));
      n.crossVectors(a, b).normalize();
      if (n.dot(new THREE.Vector3(...outward)) < 0) { indices = [0, i + 1, i]; n.negate(); }
      for (const index of indices) {
        data.position.push(...points[index]); data.normal.push(n.x, n.y, n.z);
        data.uv.push(...(uvs?.[index] ?? [points[index][0] / uvDensity, points[index][2] / uvDensity]));
      }
    }
    parts.push({label, slot, triangleCount: points.length - 2});
  }
  function prism(slot, boundary, bottom, top, label) {
    face(slot, boundary.map(([x,z]) => [x,top,z]), [0,1,0], `${label}:top`);
    face(slot, boundary.map(([x,z]) => [x,bottom,z]), [0,-1,0], `${label}:bottom`);
    for (let i = 0; i < boundary.length; i++) {
      const p = boundary[i], q = boundary[(i + 1) % boundary.length];
      const length = Math.hypot(q[0]-p[0],q[1]-p[1]);
      face(slot, [[p[0],bottom,p[1]],[q[0],bottom,q[1]],[q[0],top,q[1]],[p[0],top,p[1]]],
        [q[1]-p[1],0,p[0]-q[0]], `${label}:edge`, [[0,0],[length/uvDensity,0],[length/uvDensity,(top-bottom)/uvDensity],[0,(top-bottom)/uvDensity]]);
    }
  }
  const clippedRectangle = (x0,x1,z0,z1,c) => [[x0+c,z0],[x1-c,z0],[x1,z0+c],[x1,z1-c],[x1-c,z1],[x0+c,z1],[x0,z1-c],[x0,z0+c]];
  // The dark protective back and binding carry the silhouette. Exposed pages
  // have separate hard edges; a folded corner rises above the printed sheet.
  prism(1, clippedRectangle(-.12,.12,-.10,.10,.008), -.016, -.010, 'protective back');
  prism(0, clippedRectangle(-.111,.113,-.093,.093,.006), -.010, .009, 'compressed page block');
  prism(0, [[-.110,-.092],[.108,-.092],[.114,-.086],[.114,.048],[.072,.091],[-.110,.091]], .009, .011, 'route cover');
  prism(1, clippedRectangle(-.119,-.092,-.098,.098,.004), -.010, .013, 'stitched binding');
  const fold = [[.114,.011,.048],[.072,.011,.091],[.071,.016,.047]];
  face(0, fold, [0,1,0], 'turned corner');
  face(0, fold.map(([x,y,z]) => [x,y-.0015,z]), [0,-1,0], 'turned corner underside');
  for (let i=0;i<3;i++) {
    const p=fold[i],q=fold[(i+1)%3];
    face(0,[p,q,[q[0],q[1]-.0015,q[2]],[p[0],p[1]-.0015,p[2]]], [q[2]-p[2],0,p[0]-q[0]], 'fold edge');
  }
  // A bold bridge stamp and a direction arrow remain above the paper, with
  // actual separation. No emissive marker, coplanar decal or extra light.
  const bar = (label,x0,x1,z0,z1) => prism(1, [[x0,z0],[x1,z0],[x1,z1],[x0,z1]], .0112, .012, label);
  bar('bridge deck',-.072,.077,-.011,.001);
  bar('bridge left tower',-.058,-.047,-.034,.026);
  bar('bridge right tower',.045,.056,-.034,.026);
  bar('direction stem',-.008,.005,.021,.056);
  prism(1,[[-.026,.047],[.023,.047],[-.0015,.074]],.0112,.012,'direction arrow');
  bar('route heading',-.068,.078,-.070,-.056);
  bar('route underline',-.068,.042,-.047,-.041);
  const materials = [new THREE.MeshStandardMaterial({color:0xe8d3a0,roughness:.97,metalness:0}),
    new THREE.MeshStandardMaterial({color:0x254c49,roughness:.91,metalness:0})];
  materials.forEach((m,i) => {m.name=['evacuation-folio-paper','evacuation-folio-binding-ink'][i];m.userData.lookRole='paintedProp';});
  const geometries = slots.map(data => {
    const g=new THREE.BufferGeometry();
    for(const [name,itemSize] of [['position',3],['normal',3],['uv',2]]) g.setAttribute(name,new THREE.Float32BufferAttribute(data[name],itemSize));
    g.computeBoundingBox();g.computeBoundingSphere();return g;
  });
  const bounds=new THREE.Box3();geometries.forEach(g=>bounds.union(g.boundingBox));
  let disposed=false;
  return {geometries,materials,diagnostics:{size:[...EVACUATION_FOLIO_SIZE],parts,materialSlots:2,
    triangles:geometries.reduce((sum,g)=>sum+g.attributes.position.count/3,0),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    uvMetresPerTile:uvDensity,additionalLights:0,additionalColliders:0,origin:'complete envelope centre',
    ownership:'owns two geometry buffers and two matte materials'},dispose(){if(disposed)return;disposed=true;geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
