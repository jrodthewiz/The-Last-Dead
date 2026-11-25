import * as T from '../vendor/three.module.js';
// Painterly weathering for painted boards: paint erosion flecks, grime
// streaks, speckle and an edge vignette, all at canvas time so signage reads
// worn into the world rather than freshly printed. Deterministic per seed.
export function weatherBoard(c,x,y,w,h,seed,base){
 let a=seed>>>0;const rnd=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
 c.fillStyle=base;
 for(let i=0;i<150;i++){
  // Flecks concentrate in the lettering band where painted strokes wear first.
  const px=x+rnd()*w,py=y+h*(.14+rnd()*.72),r=.7+rnd()*3.4;
  c.globalAlpha=.12+rnd()*.26;
  c.beginPath();c.arc(px,py,r,0,Math.PI*2);c.fill();
 }
 for(let i=0;i<4;i++){
  const sx=x+rnd()*w,sw=3+rnd()*9,sh=h*(.3+rnd()*.7);
  const g=c.createLinearGradient(0,y,0,y+sh);
  g.addColorStop(0,'rgba(30,32,24,.20)');g.addColorStop(1,'rgba(30,32,24,0)');
  c.globalAlpha=1;c.fillStyle=g;c.fillRect(sx,y,sw,sh);
 }
 for(let i=0;i<70;i++){
  const px=x+rnd()*w,py=y+rnd()*h;
  c.globalAlpha=.05+rnd()*.08;
  c.fillStyle=rnd()>.5?'#1c1e16':'#efe8c8';
  c.fillRect(px,py,1+rnd()*1.6,1+rnd()*1.6);
 }
 c.globalAlpha=1;
 const vg=c.createRadialGradient(x+w/2,y+h/2,h*.3,x+w/2,y+h/2,w*.62);
 vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(20,22,16,.18)');
 c.fillStyle=vg;c.fillRect(x,y,w,h);
 c.globalAlpha=1;
}
// Freestanding boards have painted backs, never reversed lettering. Keep the
// original texture and draw call; explicit two-faced waymarks own both fronts.
export function worldBoardMaterial(texture,backColour=0x3d5550){
 const material=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide});
 material.onBeforeCompile=shader=>{
  shader.uniforms.uBoardBack={value:new T.Color(backColour)};
  shader.fragmentShader='uniform vec3 uBoardBack;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nif(!gl_FrontFacing)diffuseColor.rgb=uBoardBack;');
 };
 material.customProgramCacheKey=()=> 'world-board-facing-v1';
 return material;
}
// Shared low-resolution sign atlas. One texture and spatially merged quads,
// rather than a canvas, material and draw call for each address or room.
export function compileWorldLabels(scene,labels,roomBounds=new Map()){
 const entries=new Map();for(const p of labels){const key=JSON.stringify([p.text,p.subline||'',p.colour||0x516b5c,!!p.large]);if(!entries.has(key))entries.set(key,{...p,index:entries.size});p.atlasKey=key;}
 const cellW=512,cellH=96,cols=2,rows=2**Math.ceil(Math.log2(Math.max(1,Math.ceil(entries.size/cols)))),canvas=document.createElement('canvas');canvas.width=cellW*cols;canvas.height=cellH*rows;const c=canvas.getContext('2d');
 for(const p of entries.values()){
  const x=p.index%cols*cellW,y=Math.floor(p.index/cols)*cellH;
  c.fillStyle='#'+new T.Color(p.colour||0x516b5c).getHexString();c.fillRect(x,y,cellW,cellH);
  c.strokeStyle='#c6c6a3';c.lineWidth=3;c.strokeRect(x+7,y+7,cellW-14,cellH-14);c.fillStyle='#f0e5bb';c.textAlign='center';c.textBaseline='middle';c.font=p.large?'900 49px Trebuchet MS, Arial':'900 28px Trebuchet MS, Arial';c.fillText(p.text,x+cellW/2,y+(p.subline?35:49),cellW-34);
  if(p.subline){c.fillStyle='#d5d9b8';c.font='700 15px Trebuchet MS, Arial';c.fillText(p.subline,x+cellW/2,y+66,cellW-34);}
  weatherBoard(c,x,y,cellW,cellH,(p.index+1)*7919,'#'+new T.Color(p.colour||0x516b5c).getHexString());
 }
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.magFilter=T.NearestFilter;texture.minFilter=T.LinearMipmapLinearFilter;
 const material=worldBoardMaterial(texture),groups=new Map(),meshes=[];
 for(const p of labels){const key=p.roomTile?'room:'+p.roomTile:Math.floor(p.x/180)+','+Math.floor(p.z/180);if(!groups.has(key))groups.set(key,{vertices:[],uvs:[],roomTile:p.roomTile});const g=groups.get(key),cell=entries.get(p.atlasKey).index,col=cell%cols,row=Math.floor(cell/cols),u0=(col*cellW+1)/canvas.width,u1=((col+1)*cellW-1)/canvas.width,v1=1-(row*cellH+1)/canvas.height,v0=1-((row+1)*cellH-1)/canvas.height;
  const a=p.rotation||0,cs=Math.cos(a),sn=Math.sin(a),at=(x,y)=>[p.x+x*cs,p.y+y,p.z-x*sn],l=-p.w/2,r=p.w/2,b=-p.h/2,t=p.h/2;
  g.vertices.push(...at(l,b),...at(r,b),...at(l,t),...at(l,t),...at(r,b),...at(r,t));g.uvs.push(u0,v0,u1,v0,u0,v1,u0,v1,u1,v0,u1,v1);
 }
 for(const {vertices,uvs,roomTile}of groups.values()){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,material);scene.add(mesh);meshes.push({mesh,room:!!roomTile,bounds:roomBounds.get(roomTile)||geometry.boundingSphere});}
 return {labels:labels.length,atlasEntries:entries.size,batches:meshes.length,update(camera,roomScale=1){for(const {mesh,room,bounds:b}of meshes)mesh.visible=camera.distanceToSquared(b.center)<((room?96*roomScale:150)+b.radius)**2;}};
}
