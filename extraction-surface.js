import * as THREE from './vendor/three.module.js';

const clamp=THREE.MathUtils.clamp;
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
const TORSO=/^(Hips|Spine\d*)$/i;

// Split the actor's private source triangles at the incision. These remain
// the same skinned meshes, with the original UVs, materials and bone weights.
// No substitute skin surface or fragment-discard hole is used for harvesting.
export class HarvestSurface {
  constructor(actor,frame){
    this.entries=[];this.frame=frame;this.maxDisplacement=0;this.sourceTriangles=0;this.splitTriangles=0;
    frame.updateWorldMatrix(true,false);
    const frameInverse=frame.matrixWorld.clone().invert();
    for(const entry of actor.meshes)this.split(entry,frameInverse);
    this.edgeGeometry=new THREE.BufferGeometry();
    const count=this.entries.reduce((n,e)=>n+e.seam.length,0);
    // Three bands expose dermis, uneven subcutaneous fat, then deep fascia.
    // Their vertices follow the cut source edge, rather than an oval insert.
    this.edgeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(count*54),3));
    this.edgeGeometry.setAttribute('normal',new THREE.Float32BufferAttribute(new Float32Array(count*54),3));
    this.edgeGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(count*36),2));
    this.edgeGeometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(count*54).fill(1),3));
    this.edgeGeometry.setAttribute('tissueRegion',new THREE.Float32BufferAttribute(new Float32Array(count*18),1));
    this.edgeMaterial=new THREE.MeshStandardMaterial({color:0x5e1721,roughness:.46,side:THREE.DoubleSide});
    this.edge=new THREE.Mesh(this.edgeGeometry,this.edgeMaterial);this.edge.name='ActualModelIncisionThickness';this.edge.frustumCulled=false;this.edge.visible=false;
    frame.add(this.edge);
    this.point=new THREE.Vector3();this.world=new THREE.Vector3();this.delta=new THREE.Vector3();this.local=new THREE.Vector3();
    this.skin=new THREE.Matrix4();this.bone=new THREE.Matrix4();this.inverse=new THREE.Matrix4();
    this.modelInverse=new THREE.Matrix4();this.normalA=new THREE.Vector3();this.normalB=new THREE.Vector3();this.normalC=new THREE.Vector3();
    this.edgePoints=Array.from({length:4},()=>new THREE.Vector3());
    this.right=new THREE.Vector3();this.front=new THREE.Vector3();this.frameInverse=new THREE.Matrix4();
  }
  split(entry,frameInverse){
    const {mesh,geometry:g}=entry,attrs=g.attributes,index=g.index;
    mesh.updateWorldMatrix(true,false);mesh.skeleton.update();
    const used=new Set(index?index.array:Array.from({length:attrs.position.count},(_,i)=>i));
    const local=new Map(),torso=new Map();
    for(const id of used){
      local.set(id,mesh.getVertexPosition(id,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(frameInverse));
      let weight=0;for(let j=0;j<4;j++)if(TORSO.test(mesh.skeleton.bones[attrs.skinIndex.getComponent(id,j)]?.name||''))weight+=attrs.skinWeight.getComponent(id,j);
      torso.set(id,weight);
    }
    const candidate=id=>{const p=local.get(id);return torso.get(id)>.6&&Math.abs(p.x)<.27&&Math.abs(p.y)<.285&&p.z>-.085&&p.z<.10;};
    const data=Object.fromEntries(Object.entries(attrs).map(([key,attr])=>[key,Array.from({length:attr.count*attr.itemSize},(_,i)=>attr.getComponent(Math.floor(i/attr.itemSize),i%attr.itemSize))]));
    const sides=Array(attrs.position.count).fill(0),locals=Array(attrs.position.count*3).fill(0),affected=new Set(),seam=[],output=[];
    for(const id of used)if(candidate(id)){sides[id]=local.get(id).x<0?-1:1;local.get(id).toArray(locals,id*3);affected.add(id);}
    const edgeCache=new Map();
    const vertex=(a,b,t,side)=>{
      const key=`${Math.min(a,b)}:${Math.max(a,b)}:${side}`;
      if(edgeCache.has(key))return edgeCache.get(key);
      const id=sides.length;
      for(const [name,attr]of Object.entries(attrs)){
        if(name==='skinIndex'||name==='skinWeight')continue;
        for(let j=0;j<attr.itemSize;j++)data[name].push(attr.getComponent(a,j)*(1-t)+attr.getComponent(b,j)*t);
      }
      // Interpolating indices would bind the seam to arbitrary bones. Merge
      // influences, retain the four strongest, then normalize their weights.
      const weights=new Map();for(const [v,f]of [[a,1-t],[b,t]])for(let j=0;j<4;j++){const bone=attrs.skinIndex.getComponent(v,j);weights.set(bone,(weights.get(bone)||0)+attrs.skinWeight.getComponent(v,j)*f);}
      const influences=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4),total=influences.reduce((s,v)=>s+v[1],0)||1;
      for(let j=0;j<4;j++){data.skinIndex.push(influences[j]?.[0]||0);data.skinWeight.push((influences[j]?.[1]||0)/total);}
      const p=local.get(a).clone().lerp(local.get(b),t);p.x=0;p.toArray(locals,id*3);sides.push(side);affected.add(id);edgeCache.set(key,id);return id;
    };
    const triangles=(index?.count||attrs.position.count)/3;this.sourceTriangles+=triangles;
    for(let i=0;i<triangles;i++){
      const ids=[0,1,2].map(j=>index?index.getX(i*3+j):i*3+j),xs=ids.map(id=>local.get(id).x);
      const crosses=Math.min(...xs)<-1e-7&&Math.max(...xs)>1e-7,existingSeam=xs.some(x=>Math.abs(x)<1e-7);
      if(!ids.every(candidate)||(!crosses&&!existingSeam)){output.push(...ids);continue;}
      for(const side of [-1,1]){
        const polygon=[],cut=[];
        for(let j=0;j<3;j++){
          const a=ids[j],b=ids[(j+1)%3],x=local.get(a).x,next=local.get(b).x,inside=side*x>=0;
          if(inside){const id=Math.abs(x)<1e-7?vertex(a,a,0,side):a;polygon.push(id);if(Math.abs(x)<1e-7)cut.push(id);}
          if(x*next<0){const id=vertex(a,b,x/(x-next),side);polygon.push(id);cut.push(id);}
        }
        for(let j=1;j+1<polygon.length;j++)output.push(polygon[0],polygon[j],polygon[j+1]);
        if(cut.length===2&&polygon.length>=3)seam.push(cut);
      }
    }
    this.splitTriangles+=output.length/3;
    if(!affected.size)return;
    const saved={attributes:{...attrs},index:g.index,groups:g.groups.map(v=>({...v})),regions:entry.regions};
    for(const [name,attr]of Object.entries(attrs)){
      const attribute=new THREE.BufferAttribute(new attr.array.constructor(data[name].length),attr.itemSize,attr.normalized);
      for(let i=0;i<data[name].length;i++)attribute.setComponent(Math.floor(i/attr.itemSize),i%attr.itemSize,data[name][i]);
      g.setAttribute(name,attribute);
    }
    g.setAttribute('harvestSide',new THREE.Float32BufferAttribute(sides,1));g.setAttribute('harvestLocal',new THREE.Float32BufferAttribute(locals,3));g.setIndex(output);
    // Imported GLTF primitives have one material each. Preserve material groups
    // when a mesh uses a single complete-primitive group.
    if(g.groups.length===1){g.clearGroups();g.addGroup(0,output.length,saved.groups[0].materialIndex);}
    entry.regions=new Float32Array(sides.length);entry.regions.set(saved.regions);
    const normalTriangles=[];for(let i=0;i<output.length;i+=3)if(output.slice(i,i+3).some(id=>affected.has(id)))normalTriangles.push(...output.slice(i,i+3));
    g.computeBoundingBox();g.computeBoundingSphere();
    // The imported actor disables frustum culling. Keep conservative bounds
    // once instead of rescanning its entire 43k-vertex primitive each frame.
    const padding=g.boundingBox.getSize(new THREE.Vector3()).length()*.2;
    g.boundingBox.expandByScalar(padding);g.boundingSphere.radius+=padding;
    this.entries.push({entry,mesh,geometry:g,saved,basePositions:g.attributes.position.array.slice(),baseNormals:g.attributes.normal?.array.slice(),affected:[...affected],seam,normalTriangles,posed:new Map([...affected].map(id=>[id,new THREE.Vector3()])),normalSums:new Map([...new Set(normalTriangles)].map(id=>[id,new THREE.Vector3()])),lastPose:null,lastAmount:NaN});
  }
  skinMatrix(mesh,id){
    this.skin.elements.fill(0);const {skinIndex,skinWeight}=mesh.geometry.attributes;
    for(let j=0;j<4;j++){const w=skinWeight.getComponent(id,j);if(!w)continue;this.bone.fromArray(mesh.skeleton.boneMatrices,skinIndex.getComponent(id,j)*16);for(let k=0;k<16;k++)this.skin.elements[k]+=this.bone.elements[k]*w;}
    return this.skin.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);
  }
  update(amount){
    const started=performance.now();amount=clamp(amount,0,1);this.maxDisplacement=0;
    this.frame.updateWorldMatrix(true,false);this.frameInverse.copy(this.frame.matrixWorld).invert();
    this.right.setFromMatrixColumn(this.frame.matrixWorld,0).normalize();this.front.setFromMatrixColumn(this.frame.matrixWorld,2).normalize();
    const scale=this.frame.getWorldScale(this.local).x,edgePositions=this.edgeGeometry.attributes.position;let edgeOffset=0,edgeChanged=false;
    for(const e of this.entries){
      const {mesh,geometry:g,basePositions,affected}=e;mesh.skeleton.update();
      const bones=mesh.skeleton.boneMatrices,model=mesh.matrixWorld.elements,frame=this.frame.matrixWorld.elements;
      const size=bones.length+32;
      let changed=amount!==e.lastAmount||!e.lastPose;
      if(!e.lastPose)e.lastPose=new Float64Array(size);
      for(let i=0;i<size;i++){
        const value=i<bones.length?bones[i]:i<bones.length+16?model[i-bones.length]:frame[i-bones.length-16];
        if(Math.abs(value-e.lastPose[i])>1e-7)changed=true;

      }
      if(changed){
        e.lastAmount=amount;edgeChanged=true;
        // Compare against the last deformation, not the last sampled frame,
        // so sub-tolerance motion accumulates until it requires an update.
        e.lastPose.set(bones);e.lastPose.set(model,bones.length);e.lastPose.set(frame,bones.length+16);
        const position=g.attributes.position,side=g.attributes.harvestSide,coords=g.attributes.harvestLocal;
        const modelInverse=this.modelInverse.copy(mesh.matrixWorld).invert();
        for(const id of affected){
          this.point.fromArray(basePositions,id*3);this.skinMatrix(mesh,id);this.world.copy(this.point).applyMatrix4(this.skin).applyMatrix4(mesh.matrixWorld);
          const x=coords.getX(id),y=coords.getY(id),profile=Math.sqrt(Math.max(0,1-(y/.245)**2));
          const travel=(.235-y)/.47,cut=smooth(travel,travel+.12,amount),retract=smooth(.015,.78,amount)*cut;
          const influence=Math.max(0,1-Math.abs(x)/.235)**1.6;
          const tear=1+.022*Math.sin(y*127+coords.getZ(id)*53);
          const gap=.145*profile*retract*influence*tear,peel=(.035+.002*Math.sin(y*83))*profile*retract*influence;
          this.delta.copy(this.right).multiplyScalar(side.getX(id)*gap*scale).addScaledVector(this.front,peel*scale);
          this.world.add(this.delta);this.maxDisplacement=Math.max(this.maxDisplacement,this.delta.length());
          e.posed.get(id).copy(this.world).applyMatrix4(this.frameInverse);
          if(gap===0&&peel===0)this.point.fromArray(basePositions,id*3);
          else{this.inverse.copy(this.skin).invert();this.point.copy(this.world).applyMatrix4(modelInverse).applyMatrix4(this.inverse);}
          position.setXYZ(id,this.point.x,this.point.y,this.point.z);
        }
        e.maxDisplacement=this.maxDisplacement;position.needsUpdate=true;
        if(amount===0&&e.baseNormals){g.attributes.normal.array.set(e.baseNormals);g.attributes.normal.needsUpdate=true;}
        else this.updateNormals(e);
      }else this.maxDisplacement=Math.max(this.maxDisplacement,e.maxDisplacement||0);
      if(!changed){edgeOffset+=e.seam.length*18;continue;}
      const edgeUV=this.edgeGeometry.attributes.uv,edgeColor=this.edgeGeometry.attributes.color,edgeRegion=this.edgeGeometry.attributes.tissueRegion;
      for(const [a,b]of e.seam){
        const pa=e.posed.get(a),pb=e.posed.get(b),ya=g.attributes.harvestLocal.getY(a),yb=g.attributes.harvestLocal.getY(b);
        const cut=amount>(.235-Math.max(ya,yb))/.47+.01&&Math.max(Math.abs(pa.x),Math.abs(pb.x))>.004;
        const side=g.attributes.harvestSide.getX(a),levels=[0,.004,.011,.024],inward=[0,.001,.006,.011];
        const point=(p,level,y,q)=>{q.copy(p);if(cut){const ripple=Math.sin(y*137+p.z*63)*.0018,width=.65+.35*Math.abs(Math.sin(y*51+side*1.7));q.x-=side*(inward[level]*width+(level===2?ripple:0));q.z-=levels[level]*width+(level===2?Math.abs(ripple)*1.5:0);}return q;};
        for(let band=0;band<3;band++){
          const aa=point(pa,band,ya,this.edgePoints[0]),bb=point(pb,band,yb,this.edgePoints[1]),ac=point(pa,band+1,ya,this.edgePoints[2]),bc=point(pb,band+1,yb,this.edgePoints[3]);
          const baseTint=band===1?[.64,.37,.16]:band===0?[.52,.20,.19]:[.32,.08,.11];
          for(const [p,v]of [[aa,0],[bb,0],[ac,1],[bb,0],[bc,1],[ac,1]]){
            edgePositions.setXYZ(edgeOffset,p.x,p.y,p.z);edgeUV.setXY(edgeOffset,(p.y+.245)*11.5,v*.30+band*.17);
            const tint=.62+.38*Math.abs(Math.sin(p.y*93+side*2.3));
            edgeColor.setXYZ(edgeOffset,baseTint[0]*tint,baseTint[1]*tint,baseTint[2]*tint);edgeRegion.setX(edgeOffset,band===1?1:0);edgeOffset++;
          }
        }
      }
    }
    if(edgeChanged){
      for(const name of ['position','uv','color','tissueRegion'])this.edgeGeometry.attributes[name].needsUpdate=true;
      this.edgeGeometry.computeVertexNormals();
    }this.edge.visible=amount>.01;
    this.updateMs=performance.now()-started;
  }
  updateNormals(e){
    const g=e.geometry,p=g.attributes.position,n=g.attributes.normal;if(!n)return;
    const sums=e.normalSums,a=this.normalA,b=this.normalB,c=this.normalC;
    for(const sum of sums.values())sum.set(0,0,0);
    for(let i=0;i<e.normalTriangles.length;i+=3){
      const ia=e.normalTriangles[i],ib=e.normalTriangles[i+1],ic=e.normalTriangles[i+2];
      a.fromBufferAttribute(p,ia);b.fromBufferAttribute(p,ib);c.fromBufferAttribute(p,ic);
      b.sub(a).cross(c.sub(a));sums.get(ia).add(b);sums.get(ib).add(b);sums.get(ic).add(b);
    }
    for(const id of e.affected){const normal=sums.get(id);if(normal?.lengthSq()>1e-20){normal.normalize();n.setXYZ(id,normal.x,normal.y,normal.z);}else if(e.baseNormals)n.setXYZ(id,e.baseNormals[id*3],e.baseNormals[id*3+1],e.baseNormals[id*3+2]);}
    n.needsUpdate=true;
  }
  diagnostics(){return{sourceTriangles:this.sourceTriangles,splitTriangles:this.splitTriangles,seamVertices:this.entries.reduce((n,e)=>n+e.seam.length*2,0),affectedVertices:this.entries.reduce((n,e)=>n+e.affected.length,0),maxDisplacement:this.maxDisplacement,updateMs:this.updateMs||0};}
  dispose(){
    for(const e of this.entries){const g=e.geometry;if(e.mesh.geometry!==g)continue;g.dispose();for(const name of Object.keys(g.attributes))g.deleteAttribute(name);for(const [name,attr]of Object.entries(e.saved.attributes))g.setAttribute(name,attr);g.setIndex(e.saved.index);g.groups=e.saved.groups;e.entry.regions=e.saved.regions;g.computeBoundingBox();g.computeBoundingSphere();}
    this.edge.removeFromParent();this.edgeGeometry.dispose();this.edgeMaterial.dispose();this.entries=[];
  }
}
