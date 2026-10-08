// Lossless export cleanup: remove only tracks that equal the node's bind value,
// then repack live views. Animated samples, geometry and skin weights are intact.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const path=process.argv[2]||'assets/survivor/fps-arms-v3.glb',raw=readFileSync(path),jsonLength=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jsonLength)),binary=raw.subarray(28+jsonLength);
const sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};let removed=0;
for(const clip of doc.animations){
 clip.channels=clip.channels.filter(channel=>{
  const sampler=clip.samplers[channel.sampler],a=doc.accessors[sampler.output],view=doc.bufferViews[a.bufferView],node=doc.nodes[channel.target.node],kind=channel.target.path;
  const bind=node[kind]||(kind==='rotation'?[0,0,0,1]:kind==='scale'?[1,1,1]:[0,0,0]);
  if(a.componentType!==5126||!(kind in {translation:1,rotation:1,scale:1}))return true;
  const n=sizes[a.type],offset=(view.byteOffset||0)+(a.byteOffset||0),stride=view.byteStride||n*4;
  for(let i=0;i<a.count;i++)for(let j=0;j<n;j++)if(Math.abs(binary.readFloatLE(offset+i*stride+j*4)-bind[j])>1e-6)return true;
  removed++;return false;
 });
 const keep=[...new Set(clip.channels.map(c=>c.sampler))],map=new Map(keep.map((v,i)=>[v,i]));clip.samplers=keep.map(i=>clip.samplers[i]);clip.channels.forEach(c=>c.sampler=map.get(c.sampler));
}
const live=new Set();for(const m of doc.meshes)for(const p of m.primitives){Object.values(p.attributes).forEach(i=>live.add(i));if(p.indices!==undefined)live.add(p.indices);for(const t of p.targets||[])Object.values(t).forEach(i=>live.add(i));}
for(const skin of doc.skins)live.add(skin.inverseBindMatrices);for(const clip of doc.animations)for(const s of clip.samplers){live.add(s.input);live.add(s.output);}
const accessorIndices=[...live].sort((a,b)=>a-b),accessorMap=new Map(accessorIndices.map((v,i)=>[v,i])),viewIndices=[...new Set(accessorIndices.map(i=>doc.accessors[i].bufferView))].sort((a,b)=>a-b),viewMap=new Map(viewIndices.map((v,i)=>[v,i]));
const chunks=[];let length=0;doc.bufferViews=viewIndices.map(i=>{const v=doc.bufferViews[i],b=binary.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);if(length%4){const pad=Buffer.alloc(4-length%4);chunks.push(pad);length+=pad.length;}const result={...v,byteOffset:length,buffer:0};chunks.push(b);length+=b.length;return result;});
doc.accessors=accessorIndices.map(i=>({...doc.accessors[i],bufferView:viewMap.get(doc.accessors[i].bufferView)}));
for(const m of doc.meshes)for(const p of m.primitives){for(const k of Object.keys(p.attributes))p.attributes[k]=accessorMap.get(p.attributes[k]);if(p.indices!==undefined)p.indices=accessorMap.get(p.indices);for(const t of p.targets||[])for(const k of Object.keys(t))t[k]=accessorMap.get(t[k]);}
for(const skin of doc.skins)skin.inverseBindMatrices=accessorMap.get(skin.inverseBindMatrices);for(const clip of doc.animations)for(const s of clip.samplers){s.input=accessorMap.get(s.input);s.output=accessorMap.get(s.output);}
if(length%4){chunks.push(Buffer.alloc(4-length%4));length+=4-length%4;}doc.buffers=[{byteLength:length}];let encoded=Buffer.from(JSON.stringify(doc));if(encoded.length%4)encoded=Buffer.concat([encoded,Buffer.alloc(4-encoded.length%4,32)]);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+encoded.length+length,8);header.writeUInt32LE(encoded.length,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(length);bh.writeUInt32LE(0x004e4942,4);const packed=Buffer.concat([header,encoded,bh,...chunks]);writeFileSync(path,packed);
const manifestPath=path.replace('.glb','-manifest.json'),manifest=JSON.parse(readFileSync(manifestPath));manifest.sha256=createHash('sha256').update(packed).digest('hex');manifest.bytes=packed.length;manifest.losslessExportCleanup={removedBindConstantTracks:removed,animatedChannels:doc.animations.map(c=>({name:c.name,channels:c.channels.length})),beforeBytes:raw.length,afterBytes:packed.length};manifest.triangles=doc.meshes.reduce((n,m)=>n+m.primitives.reduce((n,p)=>n+doc.accessors[p.indices].count/3,0),0);writeFileSync(manifestPath,JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest.losslessExportCleanup));
