import * as THREE from './vendor/three.module.js';
import {BlackwaterPaintedMaterial} from './blackwater-render-looks.js';
import {lights} from './vendor/three.tsl.js';
import {capeGroundHeight,capeStreamZ,capeStreamLevel,capePathMask,CAPE_TERRAIN} from './coastal-terrain.js';
import {createCapeRiver} from './cape-river.js';
import {capeSurfaceFields} from './coastal-terrain-fields.js';
import {buildCapeBankDetail} from './assets/forest-kit/bank-detail.js';

export function buildCapeTerrain(world){
  const root=new THREE.Group();root.name='CapeWalkableTerrain';root.userData.noBatch=true;world.root.add(root);
  const material=new BlackwaterPaintedMaterial({color:'#ffffff',vertexColors:true});material.name='CapeMossSoilStone';
  const moss=new THREE.Color('#85954b'),stone=new THREE.Color('#aaa78d'),soil=new THREE.Color('#c6a063'),wet=new THREE.Color('#66543f'),litter=new THREE.Color('#927348'),color=new THREE.Color();
  const geometries=[],fieldRanges={};let triangles=0;
  // Exactly disjoint from the original flat town slabs. One-metre samples and
  // the same diagonal interpolation are used by movement/ray authority.
  for(const [left,right,top,bottom] of [[128,448,314,416],[384,448,120,314]])for(let x=left;x<right;x+=32)for(let z=top;z<bottom;z+=32){
    const width=Math.min(32,right-x),depth=Math.min(32,bottom-z),vertices=[],colors=[],indices=[],uv=[];
    for(let j=0;j<=depth;j++)for(let i=0;i<=width;i++){
      const px=x+i,pz=z+j,f=capeSurfaceFields(px,pz),y=f.height;
      vertices.push(px,y,pz);uv.push(px/12,pz/12);
      const band=Math.floor(f.patch*4)/3;
      color.copy(moss).lerp(litter,f.leafLitter*.64).lerp(soil,f.bank*.56).lerp(stone,f.exposedStone).lerp(wet,f.wetness*.9).lerp(soil,f.path*.95);
      color.multiplyScalar(.84+band*.17);colors.push(color.r,color.g,color.b);
      for(const [name,value]of Object.entries(f)){const range=fieldRanges[name]||(fieldRanges[name]=[Infinity,-Infinity]);range[0]=Math.min(range[0],value);range[1]=Math.max(range[1],value);}
      if(i<width&&j<depth){const a=j*(width+1)+i,b=a+width+1;indices.push(a,b,a+1,b,b+1,a+1);}
    }
    const indexed=new THREE.BufferGeometry();indexed.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));indexed.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));indexed.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));indexed.setIndex(indices);
    // Separate face vertices give native WebGPU toon materials real faceted
    // normals without changing the movement field or its triangle diagonals.
    const g=indexed.toNonIndexed();indexed.dispose();g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
    const mesh=new THREE.Mesh(g,material);mesh.name=`CapeTerrain:${x}:${z}`;mesh.receiveShadow=true;root.add(mesh);geometries.push(g);triangles+=indices.length/3;
  }
  const river=createCapeRiver();root.add(river.root);
  world.materials.capeBridgeWood=new THREE.MeshStandardMaterial({color:'#787468',roughness:.93});
  world.materials.capeBridgeRail=new THREE.MeshStandardMaterial({color:'#4b5551',roughness:.73,metalness:.14});
  for(const bx of CAPE_TERRAIN.bridges){
    const center=capeStreamZ(bx),deck=capeStreamLevel(bx)+.65;
    for(let z=-5.2;z<=5.2;z+=.4)world.box(bx,deck-.08,center+z,4.3,.16,.38,'capeBridgeWood','CoastalBridgeBoards');
    for(const side of [-1,1]){
      world.box(bx+side*1.65,deck-.23,center,.20,.3,10.9,'capeBridgeRail','CoastalBridgeBeam');
      for(let z=-5;z<=5;z+=2.5){world.box(bx+side*2.05,deck+.55,center+z,.14,1.2,.14,'capeBridgeRail','CoastalBridgePost');world.box(bx+side*1.65,deck-.45,center+z,.28,.65,.28,'capeBridgeWood','CoastalBridgeSupport');}
      for(const y of [.45,1.06])world.box(bx+side*2.05,deck+y,center,.12,.08,10.6,'capeBridgeRail','CoastalBridgeHandrail');
    }
    for(const end of [-1,1])for(let step=0;step<12;step++){
      const z=center+end*(5.45+step*.46),h=capeGroundHeight(bx,z);
      world.box(bx,h-.055,z,4.3,.11,.44,'capeBridgeWood','CoastalBridgeRamp');
    }
  }
  const forest=world.course.coastal.forestPlacements;
  const detail=buildCapeBankDetail({forest,material});root.add(detail.root);
  world.diagnostics.terrain={extent:CAPE_TERRAIN,chunks:geometries.length,triangles,highestMetres:5.7,sharedAuthority:'1m triangulated ground + bridge ramps',river:river.diagnostics,trees:forest.length,bankDetail:detail.diagnostics,fields:{domain:'world XZ metres',seed:60941,soilScaleMetres:12,ranges:fieldRanges}};
  let disposed=false;
  return{root,river,detail,setLighting(sources){material.lightsNode=lights(sources);},update(time,camera){if(disposed)return;river.update(time);detail.update(camera);},dispose(){if(disposed)return;disposed=true;detail.dispose();river.dispose();for(const g of geometries)g.dispose();material.dispose();root.removeFromParent();}};
}
