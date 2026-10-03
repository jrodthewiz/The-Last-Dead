import {readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const source='.art-source/night-street/333f064778105640588a95d2c2d150780044e7bf';
const entry=`
import * as THREE from 'three';
import {emitBuilding} from './${source}/facade-adapted.ts';
import {Emit,frame} from './${source}/emit.ts';
export function createGeometry({seed=.43,width=12,floors=2}={}){
 const W=new Emit({aGrid:4,aWin:4,aBldg:4,aRole:1}),G=new Emit({aPane:4}),T=new Emit({aTrim:2}),M=new Emit({aMetal:2});
 const bays=Math.max(2,Math.round(width/3)),gh=3.6,fh=3.1;
 const b={frame:frame(-width/2,-6,1,0),L:width,base:0,gh,fh,nUp:floors,H:gh+fh*floors,par:.6,cornice:.23,band:true,d0:0,bays,bayW:(width-.5)/bays,winW:1.35,winH:1.65,sill:.65,reveal:.23,pier:.65,fascia:.55,plinth:.3,street:false,pal:0,seed,escape:1,pipes:3};
 emitBuilding(b,W,G,T,M);
 return {wall:W.geometry(),glass:G.geometry(),trim:T.geometry(),metal:M.geometry(),triangles:W.triangleCount+G.triangleCount+T.triangleCount+M.triangleCount};
}`;
await build({stdin:{contents:entry,resolveDir:process.cwd()},bundle:true,format:'esm',outfile:'assets/community/night-street-geometry.js',banner:{js:'// Adapted from StarKnightt/night-street. MIT; see NIGHT-STREET-LICENSE.txt.\n// Source: '+source},plugins:[{name:'local-three',setup(b){b.onResolve({filter:/^three$/},()=>({path:'../../vendor/three.module.js',external:true}));}}]});
await writeFile('assets/community/source.json',JSON.stringify({repository:'https://github.com/StarKnightt/night-street',commit:source.split('/').at(-1),license:'MIT',files:['facade.ts','emit.ts','noise.ts'],adaptation:'Single bounded building, four merged material groups; no upstream renderer or procedural shader baking.'},null,2));
