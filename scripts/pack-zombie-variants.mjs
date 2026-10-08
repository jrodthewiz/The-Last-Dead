// Offline delivery packing only. Mesh, skin weights, bind transforms and all
// animation tracks are retained; original Meshy/PBR sources stay archived.
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {VARIANTS} from './meshy-zombie-variants.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(process.env.GLTF_TRANSFORM_PATH||'C:/Users/wolfk/Desktop/dogfight/package.json');
const {NodeIO}=require('@gltf-transform/core');
const {ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const {prune,dedup,textureCompress}=require('@gltf-transform/functions');
const sharp=require('sharp');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const arrayHash=array=>hash(Buffer.from(array.buffer,array.byteOffset,array.byteLength));
async function json(file){return JSON.parse(await readFile(file,'utf8'));}
function info(doc){
 const root=doc.getRoot(),primitives=root.listMeshes().flatMap(mesh=>mesh.listPrimitives());
 return{triangles:primitives.reduce((sum,p)=>sum+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0),meshes:root.listMeshes().length,materials:root.listMaterials().length,textures:root.listTextures().length,skins:root.listSkins().length,joints:root.listSkins().map(s=>s.listJoints().map(n=>n.getName())),clips:root.listAnimations().map(a=>({name:a.getName(),channels:a.listChannels().length})),positions:primitives.map(p=>arrayHash(p.getAttribute('POSITION').getArray())),weights:primitives.map(p=>arrayHash(p.getAttribute('WEIGHTS_0').getArray()))};
}
const ids=process.argv.slice(2),selected=ids.length?VARIANTS.filter(v=>ids.includes(v.id)):VARIANTS;
if(ids.length!==selected.length&&ids.length)throw new Error('Unknown or duplicated zombie appearance');
for(const variant of selected){
 const archive=path.join(ROOT,'.art-source/zombie-variants-meshy',variant.id),target=path.join(ROOT,'assets/models/zombie-variants',variant.id+'.glb');
 const sourceBytes=await readFile(target),doc=await io.readBinary(sourceBytes),before=info(doc);
 if(before.clips.length!==10)throw new Error(variant.id+' is not fitted to ten canonical clips');
 await mkdir(archive,{recursive:true});await writeFile(path.join(archive,'animation-fitted.glb'),sourceBytes);
 await doc.transform(
  dedup(),prune({keepAttributes:true,keepLeaves:true,keepSolidTextures:true}),
  textureCompress({encoder:sharp,targetFormat:'webp',resize:[2048,2048],quality:92,effort:60,slots:/baseColorTexture|emissiveTexture/}),
  textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],lossless:true,effort:60,slots:/normalTexture|metallicRoughnessTexture|occlusionTexture/}),
 );
 const bytes=await io.writeBinary(doc),packed=await io.readBinary(bytes),after=info(packed);
 for(const key of ['triangles','positions','weights','joints','clips'])if(JSON.stringify(before[key])!==JSON.stringify(after[key]))throw new Error('Packing changed '+variant.id+' '+key);
 const textureDetails=await Promise.all(packed.getRoot().listTextures().map(async texture=>{
  const metadata=await sharp(texture.getImage()).metadata();return{name:texture.getName(),mime:texture.getMimeType(),width:metadata.width,height:metadata.height,bytes:texture.getImage().byteLength};
 }));
 const preview=await json(path.join(archive,'preview-journal.json')),refine=await json(path.join(archive,'refine-journal.json')),rig=await json(path.join(archive,'rig-journal.json'));
 let retexture=null;try{retexture=await json(path.join(archive,'retexture-journal.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
 const manifest={id:variant.id,label:variant.label,provider:'Meshy',model:'meshy-7.1',taskIds:{preview:preview.taskId,refine:refine.taskId,retexture:retexture?.taskId||null,rig:rig.taskId},credits:preview.estimatedCredits+refine.estimatedCredits+rig.estimatedCredits+(retexture?.estimatedCredits||0),sourceBytes:sourceBytes.byteLength,bytes:bytes.byteLength,sha256:hash(bytes),before,after,textures:textureDetails,packing:{baseColor:'2K WebP quality92',normalAndORM:'1K lossless WebP',geometrySimplification:false,animationResampling:false,controlsAndSocketsPreserved:true},motionSource:'Ten locally fitted Ash Witness v07 animations; exact0.375s combat contact time',rawArchive:'.art-source/zombie-variants-meshy/'+variant.id,runtimeNeedsProvider:false,runtimeNeedsBlender:false};
 await writeFile(target+'.tmp',bytes);await rename(target+'.tmp',target);
 await writeFile(path.join(ROOT,'assets/models/zombie-variants',variant.id+'-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 await mkdir(path.join(ROOT,'docs/zombie-variants'),{recursive:true});
 await writeFile(path.join(ROOT,'docs/zombie-variants',variant.id+'-delivery.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({id:variant.id,bytes:bytes.byteLength,sourceBytes:sourceBytes.byteLength,sha256:manifest.sha256,triangles:after.triangles,textures:textureDetails.map(t=>[t.mime,t.width,t.height])}));
}
