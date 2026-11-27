import * as T from '../vendor/three.module.js';

let texture=null,geometry=null,material=null;
function blobTexture(){
 if(texture)return texture;
 if(typeof document==='undefined')return null;
 const c=document.createElement('canvas');c.width=c.height=64;
 const x=c.getContext('2d'),g=x.createRadialGradient(32,32,2,32,32,32);
 g.addColorStop(0,'rgba(8,12,10,.88)');g.addColorStop(.45,'rgba(8,12,10,.46)');g.addColorStop(1,'rgba(8,12,10,0)');
 x.fillStyle=g;x.fillRect(0,0,64,64);
 texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;
 return texture;
}
function blobGeometry(){if(!geometry){geometry=new T.PlaneGeometry(1,1);geometry.rotateX(-Math.PI/2);}return geometry;}
function blobMaterial(){if(!material)material=new T.MeshBasicMaterial({map:blobTexture(),transparent:true,opacity:.92,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});return material;}
export function contactShadow(width,depth){
 const mesh=new T.Mesh(blobGeometry(),blobMaterial());mesh.scale.set(width,1,depth);mesh.position.y=.008;mesh.renderOrder=1;
 return mesh;
}
