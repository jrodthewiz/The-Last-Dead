import {mkdir,cp,copyFile,access,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {RUNTIME_FILES,RUNTIME_DIRECTORIES,REQUIRED_RUNTIME_FILES} from '../build.mjs';

// A browser review must not read the shared dist directory while another
// local task is rebuilding it. Produce the ordinary explicit runtime build,
// directly into a private ignored snapshot inside this repo. Even staging
// under dist is unsafe: a concurrent ordinary build removes that parent.
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const suffix=String(process.pid);
const snapshot=path.join(repo,'.codex-temp',`harvest-production-${suffix}`);
await mkdir(snapshot,{recursive:true});
const copiedFiles=[],copiedDirectories=[];
for(const relative of RUNTIME_FILES){
  const source=path.resolve(repo,relative),destination=path.resolve(snapshot,relative);
  if(!source.startsWith(repo+path.sep)||!destination.startsWith(snapshot+path.sep))throw new Error('Runtime snapshot path escapes its root.');
  try{await access(source);}catch(error){if(REQUIRED_RUNTIME_FILES.includes(relative))throw error;continue;}
  await mkdir(path.dirname(destination),{recursive:true});await copyFile(source,destination);copiedFiles.push(relative);
}
for(const relative of RUNTIME_DIRECTORIES){
  const source=path.resolve(repo,relative),destination=path.resolve(snapshot,relative);
  if(!source.startsWith(repo+path.sep)||!destination.startsWith(snapshot+path.sep))throw new Error('Runtime snapshot path escapes its root.');
  try{await access(source);}catch{continue;}
  await cp(source,destination,{recursive:true,force:true,dereference:false});copiedDirectories.push(relative);
}
await writeFile(path.join(snapshot,'harvest-build-receipt.json'),JSON.stringify({createdAt:new Date().toISOString(),copiedFiles,copiedDirectories,snapshot},null,2));
console.log(snapshot);
