import {courtLaneCanopyAt,courtRectDistance} from './coastal-court-lane.js';
import * as THREE from './vendor/three.module.js';
import {coastalMeadowTint} from './blackwater-render-looks.js';
import {MeshStandardNodeMaterial} from './vendor/three.webgpu.js';
import {Fn,If,struct,attribute,float,lights,positionWorld,texture,normalMap,vec2,vec3} from './vendor/three.tsl.js';
import {capeGroundHeight,capeStreamZ,capeStreamLevel,capePathMask,capeGroveField,CAPE_TERRAIN} from './coastal-terrain.js';
import {createCapeRiver} from './cape-river.js';
import {capeSurfaceFields,capeBiomeWeights,makeCapeBilberryRootPrototype,capeBilberryRootPocketField,makeCapeRootShoulders,capeRootShoulderField,createCapeSurfaceUnderlay,capeTrailPeatField,capeGroveCourtFields,capeGroundHierarchy,createCapeHierarchyHeightCache} from './coastal-terrain-fields.js';
import {buildCapeBankDetail} from './assets/forest-kit/bank-detail.js';
import {makeCapeWoodlandGround,buildCapeWoodlandGround} from './coastal-woodland-ground.js';
import {createCapeGroundAtlas} from './assets/forest-kit/ground-atlas.js';
import {capeResidentialCoastFields} from './coastal-residential-fields.js';
import {capeGroveCourtRelief} from './coastal-grove-court-fields.js';

export function buildCapeTerrain(world){
  const root=new THREE.Group();root.name='CapeWalkableTerrain';root.userData.noBatch=true;world.root.add(root);
  const material=new MeshStandardNodeMaterial({color:'#ffffff',vertexColors:true,roughness:.92});material.name='CapeMossSoilStone';
  const atlas=createCapeGroundAtlas(),weights=attribute('capeBiome','vec4');
  const surfaceUV=vec2(positionWorld.x,positionWorld.z).div(2);
  const rawLod=surfaceUV.fwidth().length().mul(448).max(1).log2(),lod=rawLod.clamp(0,5),detailFade=float(1).sub(rawLod.smoothstep(6,8));
  const SurfaceOutput=struct({tint:'vec3',normal:'vec3',roughness:'float'});
  const surface=Fn(()=>{
    // Evaluate derivatives before divergent biome control flow; atlas samples
    // use explicit LOD. Zero-biome bank/log faces need none of the eight fetches.
    const lodValue=lod.toVar(),fade=detailFade.toVar(),sum=float(0).toVar();
    for(let role=0;role<4;role++)sum.addAssign(weights.element(role));
    const tint=vec3(1).toVar(),encodedNormal=vec3(.5,.5,1).toVar(),roughness=float(.92).toVar();
    If(sum.greaterThan(0).and(fade.greaterThan(0)),()=>{
      const t=vec3(0).toVar(),n=vec3(0).toVar(),r=float(0).toVar();
      for(let role=0;role<4;role++){
        const coordinate=surfaceUV.fract().mul(448/1024).add(vec2((role%2)*.5+32/1024,(role>>1)*.5+32/1024));
        const a=texture(atlas.albedo,coordinate).level(lodValue),packed=texture(atlas.normal,coordinate).level(lodValue),w=weights.element(role);
        t.addAssign(a.rgb.mul(w));n.addAssign(packed.rgb.mul(w));r.addAssign(packed.a.mul(w));
      }
      const neutral=float(1).sub(sum.mul(fade));
      tint.assign(t.mul(1.65).mul(fade).add(vec3(1).mul(neutral)));
      encodedNormal.assign(n.mul(fade).add(vec3(.5,.5,1).mul(neutral)));
      roughness.assign(r.mul(fade).add(float(.92).mul(neutral)));
    });
    return SurfaceOutput(tint,encodedNormal,roughness);
  })().toVar();
  material.colorNode=coastalMeadowTint({organicCover:weights.x.add(weights.y).add(weights.z)}).mul(surface.get('tint'));
  material.roughnessNode=surface.get('roughness').clamp(.72,1);
  material.normalNode=normalMap(surface.get('normal'));
  material.userData={lookRole:'forest-ground',nativeTerrainPBR:true,atlas:atlas.diagnostics,roughnessRange:[.72,1],derivativeFiltered:true,sharedRoleChannels:true};
  const moss=new THREE.Color('#526957'),stone=new THREE.Color('#89918d'),soil=new THREE.Color('#8c8270'),wet=new THREE.Color('#36494c'),litter=new THREE.Color('#606456'),pineDuff=new THREE.Color('#443e30'),birchDuff=new THREE.Color('#867453'),rootMoss=new THREE.Color('#355342'),trailPeat=new THREE.Color('#655e4f'),trailColor=new THREE.Color(),color=new THREE.Color();
  // Root communities give the soil a shaded interior and lighter path edge.
  // This is vertex albedo, sampled from actual trees; physical ground is shared.
  const rootedColor=new THREE.Color(),canopyBins=new Map();
  for(const tree of world.course.coastal.forestPlacements){
    const key=`${Math.floor(tree.x/12)}/${Math.floor(tree.z/12)}`;
    if(!canopyBins.has(key))canopyBins.set(key,[]);canopyBins.get(key).push(tree);
  }
  const canopyAt=(x,z)=>{
    let cover=0,pine=0,birch=0;const bx=Math.floor(x/12),bz=Math.floor(z/12);
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)for(const tree of canopyBins.get(`${bx+dx}/${bz+dz}`)||[]){
      const radius=tree.height*(tree.species==='conifer'?.25:.34),distance=Math.hypot(x-tree.x,z-tree.z);
      cover=Math.max(cover,Math.max(0,1-distance/radius));
      // Wind-stretched root/duff drifts, with broken moss shoulders, follow
      // actual trees. Broad overlapping shapes avoid isolated circular stamps.
      const dx=x-tree.x+.65*Math.sin(z*.61),dz=z-tree.z;
      const drift=Math.max(0,1-Math.hypot(dx/(radius*.68+.8),dz/(radius*1.35+1)));
      if(tree.species==='conifer')pine=Math.max(pine,drift);else birch=Math.max(birch,drift);
    }
    return {cover,pine,birch};
  };
  const frontGroundColor=new THREE.Color(),townTurf=new THREE.Color('#435740');
  const geometries=[],fieldRanges={};let triangles=0,highestMetres=0;
  const rootPrototype=makeCapeBilberryRootPrototype(world.course.coastal.forestPlacements);
  const rootShoulders=makeCapeRootShoulders(world.course.coastal.forestPlacements);
  const underlay=createCapeSurfaceUnderlay();
  const hierarchyHeights=createCapeHierarchyHeightCache();
  try {
  // Exactly disjoint from the original flat town slabs. One-metre samples and
  // the same diagonal interpolation are used by movement/ray authority.
  const courtLane=world.course.coastal.courtLane;
  for(const [left,right,top,bottom] of [[128,448,314,416],[384,448,120,314],[384,448,0,120],[374,384,248,280],...(courtLane?[[240,360,260,276]]:[])])for(let x=left;x<right;x+=32)for(let z=top;z<bottom;z+=32){
    const width=Math.min(32,right-x),depth=Math.min(32,bottom-z),vertices=[],colors=[],indices=[],uv=[],biome=[];
    const isCourt=left===240&&top===260;
    const cuts=isCourt?[...courtLane.access,...courtLane.buildings]:[];
    const axis=(base,length,lo,hi)=>[...new Set([...Array.from({length:length+1},(_,i)=>base+i),...cuts.flatMap(r=>[r[lo],r[hi]]).filter(v=>v>base&&v<base+length)])].sort((a,b)=>a-b);
    const xs=axis(x,width,'minX','maxX'),zs=axis(z,depth,'minZ','maxZ'),stride=xs.length;
    for(let j=0;j<zs.length;j++)for(let i=0;i<xs.length;i++){
      const px=xs[i],pz=zs[j],f=capeSurfaceFields(px,pz),y=f.height;
      f.bilberryBed=Math.max(f.bilberryBed,capeBilberryRootPocketField(px,pz,rootPrototype));
      highestMetres=Math.max(highestMetres,y);
      vertices.push(px,y,pz);uv.push(px/12,pz/12);
      const band=Math.floor(f.patch*4)/3;
      const community=capeGroveField(px,pz),grove=community.strength,fringe=Math.max(0,Math.min(1,grove*1.35));
      const canopy=canopyAt(px,pz),offPath=1-f.trail;
      const peat=capeTrailPeatField(px,pz);trailColor.copy(soil).lerp(trailPeat,Math.min(1,.35+peat*1.3+canopy.cover*.25)).lerp(wet,f.wetness*.38);
      const shoulder=capeRootShoulderField(px,pz,rootShoulders);
      canopy.bilberry=f.bilberryBed;
      const baseBiome=capeBiomeWeights(px,pz,canopy),bedWeight=shoulder.surfaceCover*.85;
      const rootedRoles=[shoulder.litter,shoulder.moss,0,shoulder.mineral];
      biome.push(...baseBiome.map((w,i)=>w*(1-bedWeight)+rootedRoles[i]*bedWeight));
      color.copy(moss).lerp(litter,f.leafLitter*.58).lerp(community.grove===0?birchDuff:pineDuff,fringe*.74)
        .lerp(rootMoss,Math.min(1,canopy.cover*.72+f.heathBed*.65+f.bilberryBed*.15)*offPath).lerp(pineDuff,canopy.pine*.9*offPath).lerp(birchDuff,canopy.birch*.76*offPath)
        .lerp(soil,f.bank*.56).lerp(stone,f.exposedStone).lerp(wet,f.wetness*.9).lerp(trailColor,f.trail*.95);
      rootedColor.setRGB(pineDuff.r*shoulder.litter+rootMoss.r*shoulder.moss+stone.r*shoulder.mineral,pineDuff.g*shoulder.litter+rootMoss.g*shoulder.moss+stone.g*shoulder.mineral,pineDuff.b*shoulder.litter+rootMoss.b*shoulder.moss+stone.b*shoulder.mineral);
      color.lerp(rootedColor,shoulder.surfaceCover*.85);
      if(px>340&&px<410&&pz>250&&pz<282){
        const court=capeGroveCourtFields(px,pz),weight=court.cover*.65;
        const organic=[.72-court.shelter*.5,.28+court.shelter*.5,0,0];
        for(let i=0;i<4;i++)biome[biome.length-4+i]=biome[biome.length-4+i]*(1-weight)+organic[i]*weight;
        color.lerp(rootMoss,weight*court.shelter*.60).lerp(pineDuff,weight*(1-court.shelter)*.40);
      }
      if(px>=374&&px<=400&&pz>=248&&pz<=280){
        const court=capeGroveCourtRelief(px,pz),weight=court.cover*.90;
        const target=[court.litter,court.moss,0,court.mineral];
        if(px<384){for(let i=0;i<4;i++)biome[biome.length-4+i]=target[i]*weight;color.copy(townTurf);}
        else for(let i=0;i<4;i++)biome[biome.length-4+i]=biome[biome.length-4+i]*(1-weight)+target[i]*weight;
        rootedColor.setRGB(pineDuff.r*court.litter+rootMoss.r*court.moss+stone.r*court.mineral,pineDuff.g*court.litter+rootMoss.g*court.moss+stone.g*court.mineral,pineDuff.b*court.litter+rootMoss.b*court.moss+stone.b*court.mineral);
        color.lerp(rootedColor,weight);
      }
      let townBlend=0;
      if(pz<120){
        const coast=capeResidentialCoastFields(px,pz),hierarchy=capeGroundHierarchy(px,pz,canopy,hierarchyHeights.sample);
        const frontBiome=hierarchy.weights;
        // Material communities end along an uneven lee edge, independently of
        // rectangular mesh ownership. The old inland material returns at z120;
        // the town-side edge has neutral atlas weights and continuous turf.
        const edge=399+3*Math.sin(pz*.081)+2*Math.sin(pz*.19),surfaceBlend=THREE.MathUtils.smoothstep(px,edge-6,edge+9)*THREE.MathUtils.smoothstep(pz,0,8)*(1-THREE.MathUtils.smoothstep(pz,108,120));
        townBlend=(1-THREE.MathUtils.smoothstep(pz,112,120))*(1-surfaceBlend);
        for(let i=0;i<4;i++)biome[biome.length-4+i]=biome[biome.length-4+i]*(1-surfaceBlend-townBlend)+frontBiome[i]*surfaceBlend;
        // Canopy bodies, lee peat and source slate own the surface in that
        // order. The front no longer overwrites real duff with uniform coast.
        rootedColor.copy(soil).lerp(canopy.birch>canopy.pine?birchDuff:pineDuff,hierarchy.shelter).lerp(trailPeat,coast.trace*.75);
        frontGroundColor.setRGB(rootedColor.r*frontBiome[0]+rootMoss.r*frontBiome[1]+litter.r*frontBiome[2]+stone.r*frontBiome[3],
          rootedColor.g*frontBiome[0]+rootMoss.g*frontBiome[1]+litter.g*frontBiome[2]+stone.g*frontBiome[3],
          rootedColor.b*frontBiome[0]+rootMoss.b*frontBiome[1]+litter.b*frontBiome[2]+stone.b*frontBiome[3]);
        color.lerp(frontGroundColor,surfaceBlend);
      }
      if(px>=374&&px<=407&&pz>=391&&pz<=416){
        const hierarchy=capeGroundHierarchy(px,pz,canopy,hierarchyHeights.sample),weight=hierarchy.cover*(1-f.path);
        for(let i=0;i<4;i++)biome[biome.length-4+i]=biome[biome.length-4+i]*(1-weight)+hierarchy.weights[i]*weight;
        const w=hierarchy.weights;
        rootedColor.setRGB(pineDuff.r*w[0]+rootMoss.r*w[1]+stone.r*w[3],pineDuff.g*w[0]+rootMoss.g*w[1]+stone.g*w[3],pineDuff.b*w[0]+rootMoss.b*w[1]+stone.b*w[3]);
        color.lerp(rootedColor,weight);
      }
      color.multiplyScalar((.82+band*.15)*(1-canopy.cover*.12*offPath));
      if(px<384&&px>=374&&pz>=248&&pz<=280)color.lerp(townTurf,1-capeGroveCourtRelief(px,pz).cover);
      if(townBlend>0)color.lerp(townTurf,townBlend);
      if(isCourt){const local=courtLaneCanopyAt(courtLane,px,pz),cover=Math.min(1,local.duff*1.05),pine=local.pine>=local.birch;const weights=[cover*(pine?.72:.43),cover*(pine?.28:.57),0,0];for(let k=0;k<4;k++)biome[biome.length-4+k]=weights[k];color.copy(townTurf).lerp(pine?pineDuff:birchDuff,cover*.8).lerp(rootMoss,cover*local.cover*.25);}
      colors.push(color.r,color.g,color.b);
      underlay.set(px,pz,[color.r,color.g,color.b],biome.slice(-4));
      for(const [name,value]of Object.entries(f)){const range=fieldRanges[name]||(fieldRanges[name]=[Infinity,-Infinity]);range[0]=Math.min(range[0],value);range[1]=Math.max(range[1],value);}
      if(i<xs.length-1&&j<zs.length-1){const mx=(px+xs[i+1])/2,mz=(pz+zs[j+1])/2;if(!isCourt||!cuts.some(r=>courtRectDistance(mx,mz,r)===0)){const a=j*stride+i,b=a+stride;indices.push(a,b,a+1,b,b+1,a+1);}}
    }
    const indexed=new THREE.BufferGeometry();indexed.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));indexed.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));indexed.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));indexed.setIndex(indices);
    indexed.setAttribute('capeBiome',new THREE.Float32BufferAttribute(biome,4));
    // Separate face vertices give native WebGPU toon materials real faceted
    // normals without changing the movement field or its triangle diagonals.
    const g=indexed.toNonIndexed();indexed.dispose();g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
    const mesh=new THREE.Mesh(g,material);mesh.name=`CapeTerrain:${x}:${z}`;mesh.userData.courtLaneGround=isCourt;mesh.receiveShadow=true;root.add(mesh);geometries.push(g);triangles+=indices.length/3;
  }
  } finally {hierarchyHeights.dispose();}
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
  const detail=buildCapeBankDetail({forest,material,underlayAt:(x,z)=>underlay.sample(x,z)});root.add(detail.root);
  const windfall=buildCapeWoodlandGround({placements:world.course.coastal.woodlandGround||makeCapeWoodlandGround(world.course.coastal),material});root.add(windfall.root);
  world.diagnostics.terrain={extent:CAPE_TERRAIN,front:{extent:[384,448,0,120],chunks:8,triangles:15360,temporaryUnderlayBytes:underlay.bytes,sharedMaterial:true,sharedTextures:true},chunks:geometries.length,triangles,highestMetres,sharedAuthority:'1m triangulated ground + bridge ramps + physical windfall obstacles',river:river.diagnostics,trees:forest.length,bankDetail:detail.diagnostics,windfall:windfall.diagnostics,surfaceAtlas:atlas.diagnostics,hierarchyHeightCache:{...hierarchyHeights.diagnostics},fields:{domain:'world XZ metres',seed:60941,soilScaleMetres:12,ranges:fieldRanges}};
  const laneMeshes=root.children.filter(m=>m.userData.courtLaneGround);
  const laneTriangles=laneMeshes.reduce((n,m)=>n+m.geometry.attributes.position.count/3,0),laneBytes=laneMeshes.reduce((n,m)=>n+Object.values(m.geometry.attributes).reduce((b,a)=>b+a.array.byteLength,0),0);
  world.diagnostics.terrain.courtLane={extent:[240,360,260,276],chunks:laneMeshes.length,triangles:laneTriangles,geometryBytes:laneBytes,sharedMaterial:true,sharedTextures:true,heightAuthority:'unchanged level authoritative ground',baseChunks:geometries.length-laneMeshes.length,baseTriangles:triangles-laneTriangles};
  world.diagnostics.terrain.court={extent:[374,384,248,280],chunks:1,triangles:640,sharedMaterial:true,sharedTextures:true,protectedRoute:[268,1.5],heightAuthority:'same one-metre ground triangles; level town slab removed over hollow'};
  let disposed=false;
  return{root,river,detail,windfall,atlas,setLighting(sources){material.lightsNode=lights(sources);},update(time,camera){if(disposed)return;river.update(time);detail.update(camera);windfall.update(camera);},dispose(){if(disposed)return;disposed=true;windfall.dispose();detail.dispose();river.dispose();for(const g of geometries)g.dispose();material.dispose();atlas.dispose();root.removeFromParent();}};
}
