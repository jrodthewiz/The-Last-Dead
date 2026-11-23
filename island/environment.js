import * as T from '../vendor/three.module.js';

// Procedural equirectangular coastal sky used as an IBL source. It is deliberately
// low-frequency: the visible sky remains the painted storm dome; this is the
// bounce/reflection term that makes metal, glass and wet asphalt belong to it.
export function createEnvironment(renderer,scene){
 const w=512,h=256,c=document.createElement('canvas');c.width=w;c.height=h;
 const x=c.getContext('2d');
 const g=x.createLinearGradient(0,0,0,h);
 g.addColorStop(0,'#2f4655');g.addColorStop(.34,'#6f8894');g.addColorStop(.49,'#b4c4c4');g.addColorStop(.51,'#485148');g.addColorStop(.72,'#2f3835');g.addColorStop(1,'#171d1b');
 x.fillStyle=g;x.fillRect(0,0,w,h);
 // Soft overcast bands; enough variation for roughness response, no hard edges.
 for(let i=0;i<26;i++){
  const yy=h*(.04+Math.random()*.38),ww=w*(.12+Math.random()*.38),hh=3+Math.random()*12;
  const grd=x.createLinearGradient(0,yy-hh,0,yy+hh);
  grd.addColorStop(0,'rgba(220,230,232,0)');grd.addColorStop(.5,`rgba(220,230,232,${.04+Math.random()*.08})`);grd.addColorStop(1,'rgba(220,230,232,0)');
  x.fillStyle=grd;x.fillRect(w*Math.random()-ww*.5,yy-hh,ww,hh*2);
 }
 // Low warm break, matching the key light.
 const sx=w*.32,sy=h*.30,rad=x.createRadialGradient(sx,sy,0,sx,sy,95);
 rad.addColorStop(0,'rgba(255,205,150,.55)');rad.addColorStop(.25,'rgba(255,185,115,.20)');rad.addColorStop(1,'rgba(255,185,115,0)');
 x.fillStyle=rad;x.fillRect(0,0,w,h);
 const tex=new T.CanvasTexture(c);tex.mapping=T.EquirectangularReflectionMapping;tex.colorSpace=T.SRGBColorSpace;tex.needsUpdate=true;
 const pmrem=new T.PMREMGenerator(renderer);pmrem.compileEquirectangularShader();
 const env=pmrem.fromEquirectangular(tex).texture;
 scene.environment=env;scene.environmentIntensity=.72;
 pmrem.dispose();tex.dispose();
 return env;
}
