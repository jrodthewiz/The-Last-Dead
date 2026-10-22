import * as T from '../vendor/three.module.js';
// Shared low-resolution sign atlas. One texture and spatially merged quads,
// rather than a canvas, material and draw call for each address or room.
export function compileWorldLabels(scene,labels){
 const entries=new Map();for(const p of labels){const key=JSON.stringify([p.text,p.subline||'',p.colour||0x516b5c]);if(!entries.has(key))entries.set(key,{...p,index:entries.size});p.atlasKey=key;}
 const cellW=512,cellH=96,cols=2,rows=2**Math.ceil(Math.log2(Math.max(1,Math.ceil(entries.size/cols)))),canvas=document.createElement('canvas');canvas.width=cellW*cols;canvas.height=cellH*rows;const c=canvas.getContext('2d');
 for(const p of entries.values()){
  const x=p.index%cols*cellW,y=Math.floor(p.index/cols)*cellH;
  c.fillStyle='#'+new T.Color(p.colour||0x516b5c).getHexString();c.fillRect(x,y,cellW,cellH);
  c.strokeStyle='#c6c6a3';c.lineWidth=3;c.strokeRect(x+7,y+7,cellW-14,cellH-14);c.fillStyle='#f0e5bb';c.textAlign='center';c.textBaseline='middle';c.font='900 28px Trebuchet MS, Arial';c.fillText(p.text,x+cellW/2,y+(p.subline?35:49),cellW-34);
  if(p.subline){c.fillStyle='#d5d9b8';c.font='700 15px Trebuchet MS, Arial';c.fillText(p.subline,x+cellW/2,y+66,cellW-34);}
 }
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.magFilter=T.NearestFilter;texture.minFilter=T.LinearMipmapLinearFilter;
 const material=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}),groups=new Map(),meshes=[];
 for(const p of labels){const key=Math.floor(p.x/180)+','+Math.floor(p.z/180);if(!groups.has(key))groups.set(key,{vertices:[],uvs:[]});const g=groups.get(key),cell=entries.get(p.atlasKey).index,col=cell%cols,row=Math.floor(cell/cols),u0=(col*cellW+1)/canvas.width,u1=((col+1)*cellW-1)/canvas.width,v1=1-(row*cellH+1)/canvas.height,v0=1-((row+1)*cellH-1)/canvas.height;
  const a=p.rotation||0,cs=Math.cos(a),sn=Math.sin(a),at=(x,y)=>[p.x+x*cs,p.y+y,p.z-x*sn],l=-p.w/2,r=p.w/2,b=-p.h/2,t=p.h/2;
  g.vertices.push(...at(l,b),...at(r,b),...at(l,t),...at(l,t),...at(r,b),...at(r,t));g.uvs.push(u0,v0,u1,v0,u0,v1,u0,v1,u1,v0,u1,v1);
 }
 for(const {vertices,uvs}of groups.values()){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,material);scene.add(mesh);meshes.push(mesh);}
 return {labels:labels.length,atlasEntries:entries.size,batches:meshes.length,update(camera){for(const mesh of meshes){const b=mesh.geometry.boundingSphere;mesh.visible=camera.distanceToSquared(b.center)<(150+b.radius)**2;}}};
}
