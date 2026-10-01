import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';

// Consume the original response body completely before parsing. This avoids a
// second progress stream keeping large local GLB responses alive after load.
export async function loadGlb(url) {
  const response=await fetch(url);
  if(!response.ok)throw new Error(`GLB request failed (${response.status}): ${url}`);
  const data=await response.arrayBuffer(),header=new DataView(data);
  if(data.byteLength<12||header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2||header.getUint32(8,true)!==data.byteLength)
    throw new Error(`Invalid or incomplete GLB: ${url}`);
  const base=new URL('.',new URL(url,globalThis.document?.baseURI||import.meta.url)).href;
  return new GLTFLoader().parseAsync(data,base);
}
