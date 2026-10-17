import{build}from'../build.mjs';
import{mkdir,cp,readFile,writeFile,rm,stat}from'node:fs/promises';
import{resolve,dirname,relative}from'node:path';
import{fileURLToPath}from'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),site=resolve(root,'sites/blackwater'),staging=resolve(root,'dist/sites-stage'),publicDir=resolve(site,'public');
// Only this dedicated staging subfolder is rebuilt. The player's main dist
// files and local server remain intact while hosted content is prepared.
if(relative(root,staging).startsWith('..')||relative(site,publicDir).startsWith('..'))throw Error('Unsafe staging path');
await build({dist:staging});await rm(publicDir,{recursive:true,force:true});await mkdir(publicDir,{recursive:true});await cp(staging,publicDir,{recursive:true});
// The legacy renderer's optional 34 MB boss is not used by the island game and
// exceeds Cloudflare's per-static-file limit. The original stays in GitHub.
await rm(resolve(publicDir,'assets/models/bloodworks-warden.glb'),{force:true});await rm(resolve(publicDir,'legacy.html'),{force:true});
await mkdir(resolve(site,'lib'),{recursive:true});await writeFile(resolve(site,'lib/game-shell.ts'),'export default '+JSON.stringify(await readFile(resolve(root,'index.html'),'utf8'))+';\n');await cp(resolve(root,'coop/rooms.js'),resolve(site,'lib/blackwater-rooms.js'));
console.log(JSON.stringify({publicDir,entryBytes:(await stat(resolve(publicDir,'index.html'))).size}));
