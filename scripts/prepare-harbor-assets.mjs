import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'assets/harbor');await fs.mkdir(output,{recursive:true});
const packs={'car-kit':['truck-flat','sedan'],industrial:['building-a','building-c','building-e','building-h','building-k','building-o','shipping-container-a','water-tower']};
// Kenney GLBs reference a same-named external palette. Embed each pack's correct
// palette so parallel vehicle/building loads cannot accidentally share colors.
for(const[pack,names]of Object.entries(packs)){
 const source=path.join(root,'.art-source/harbor',pack);
 await fs.copyFile(path.join(source,'License.txt'),path.join(output,`kenney-${pack}.LICENSE.txt`));
 for(const name of names){
  const dir=path.join(source,'Models/GLB format'),b=await fs.readFile(path.join(dir,`${name}.glb`));
  const jsonLen=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+jsonLen).toString());
  for(const image of j.images||[])if(image.uri&&!image.uri.startsWith('data:'))image.uri=`data:image/png;base64,${(await fs.readFile(path.join(dir,image.uri))).toString('base64')}`;
  let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const rest=b.subarray(20+jsonLen),header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(20+json.length+rest.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
  await fs.writeFile(path.join(output,`${name}.glb`),Buffer.concat([header,json,rest]));
 }
}
console.log('Prepared 10 self-contained CC0 harbor GLBs.');
