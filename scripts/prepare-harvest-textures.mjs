// Offline format/size conversion only. Native ImageGen creates both albedo
// and aligned relief; neither this script nor Python paints the art assets.
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require(process.env.SHARP_PATH||'C:/Users/wolfk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const [kind,input]=process.argv.slice(2);
if(!['atlas','height'].includes(kind)||!input)throw new Error('Usage: node scripts/prepare-harvest-textures.mjs atlas|height source.png');
const root=path.resolve(import.meta.dirname,'..'),archive=path.join(root,'.art-source','harvest-realism'),runtime=path.join(root,'assets','textures');
await mkdir(archive,{recursive:true});await mkdir(runtime,{recursive:true});
await copyFile(input,path.join(archive,`harvest-tissue-${kind}-original-v1.png`));
const out=path.join(runtime,`harvest-tissue-${kind}-v1.webp`);
await sharp(input).resize(1024,1024,{fit:'fill'}).webp({quality:93,effort:6,lossless:kind==='height'}).toFile(out);
const metadata=await sharp(out).metadata();
await writeFile(path.join(archive,`${kind}-conversion.json`),JSON.stringify({provider:'built-in imagegen',input:path.resolve(input),output:out,operation:'format/size conversion; no painting or content edits',dimensions:[metadata.width,metadata.height],promptFile:'docs/harvest-realism-imagegen.md'},null,2));
console.log(JSON.stringify({out,width:metadata.width,height:metadata.height}));
