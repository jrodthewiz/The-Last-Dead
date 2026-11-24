import * as T from '../vendor/three.module.js';

// Procedural equirectangular coastal sky used as an IBL source. It is deliberately
// low-frequency: the visible sky remains the painted storm dome; this is the
// bounce/reflection term that makes metal, glass and wet asphalt belong to it.
export function createEnvironment(renderer,scene){
 const w=1024,h=512,c=document.createElement('canvas');c.width=w;c.height=h;
 const x=c.getContext('2d');
 const g=x.createLinearGradient(0,0,0,h);
 g.addColorStop(0,'#172433');g.addColorStop(.26,'#2d4352');g.addColorStop(.45,'#536268');g.addColorStop(.50,'#a47e5e');g.addColorStop(.52,'#303733');g.addColorStop(.72,'#1c2422');g.addColorStop(1,'#0e1211');
 x.fillStyle=g;x.fillRect(0,0,w,h);
 // Layered storm-break cloud streaks for crisp specular/glass reflections.
 for(let i=0;i<44;i++){
  const yy=h*(.04+Math.random()*.42),ww=w*(.10+Math.random()*.40),hh=3+Math.random()*16;
  const grd=x.createLinearGradient(0,yy-hh,0,yy+hh);
  grd.addColorStop(0,'rgba(214,190,162,0)');grd.addColorStop(.5,`rgba(228,236,238,${.05+Math.random()*.11})`);grd.addColorStop(1,'rgba(214,190,162,0)');
  x.fillStyle=grd;x.fillRect(w*Math.random()-ww*.5,yy-hh,ww,hh*2);
 }
 // Sunward sky break matching sunDir = (-110, 160, 65).normalize().
 const sx=w*.36,sy=h*.62,rad=x.createRadialGradient(sx,sy,0,sx,sy,210);
 rad.addColorStop(0,'rgba(255,177,112,.72)');rad.addColorStop(.20,'rgba(255,156,94,.40)');rad.addColorStop(.55,'rgba(156,138,124,.10)');rad.addColorStop(1,'rgba(156,138,124,0)');
 x.fillStyle=rad;x.fillRect(0,0,w,h);
 const tex=new T.CanvasTexture(c);tex.mapping=T.EquirectangularReflectionMapping;tex.colorSpace=T.SRGBColorSpace;tex.needsUpdate=true;
 const pmrem=new T.PMREMGenerator(renderer);pmrem.compileEquirectangularShader();
 const env=pmrem.fromEquirectangular(tex).texture;
 scene.environment=env;scene.environmentIntensity=.68;
 pmrem.dispose();tex.dispose();
 return env;
}
