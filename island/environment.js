import * as T from '../vendor/three.module.js';

// Procedural equirectangular coastal sky used as an IBL source. It is deliberately
// low-frequency: the visible sky remains the painted storm dome; this is the
// bounce/reflection term that makes metal, glass and wet asphalt belong to it.
export function createEnvironment(renderer,scene){
 const w=1024,h=512,c=document.createElement('canvas');c.width=w;c.height=h;
 const x=c.getContext('2d');
 const g=x.createLinearGradient(0,0,0,h);
 g.addColorStop(0,'#182733');g.addColorStop(.26,'#354b58');g.addColorStop(.45,'#6d7a78');g.addColorStop(.50,'#a48364');g.addColorStop(.52,'#343730');g.addColorStop(.72,'#1e2421');g.addColorStop(1,'#0e1211');
 x.fillStyle=g;x.fillRect(0,0,w,h);
 // Layered silver-slate storm cloud streaks for crisp specular/glass/puddle reflections.
 for(let i=0;i<48;i++){
  const yy=h*(.04+Math.random()*.42),ww=w*(.10+Math.random()*.40),hh=3+Math.random()*16;
  const grd=x.createLinearGradient(0,yy-hh,0,yy+hh);
  grd.addColorStop(0,'rgba(210,224,230,0)');grd.addColorStop(.5,`rgba(222,232,236,${.05+Math.random()*.12})`);grd.addColorStop(1,'rgba(210,224,230,0)');
  x.fillStyle=grd;x.fillRect(w*Math.random()-ww*.5,yy-hh,ww,hh*2);
 }
 // Soft silver-warm storm sky break aligned to sunDir = (-115, 135, 72).normalize().
 const sx=w*.34,sy=h*.34,rad=x.createRadialGradient(sx,sy,0,sx,sy,200);
 rad.addColorStop(0,'rgba(255,206,154,.76)');rad.addColorStop(.22,'rgba(240,188,142,.40)');rad.addColorStop(.55,'rgba(172,178,174,.12)');rad.addColorStop(1,'rgba(172,178,174,0)');
 x.fillStyle=rad;x.fillRect(0,0,w,h);
 const tex=new T.CanvasTexture(c);tex.mapping=T.EquirectangularReflectionMapping;tex.colorSpace=T.SRGBColorSpace;tex.needsUpdate=true;
 const pmrem=new T.PMREMGenerator(renderer);pmrem.compileEquirectangularShader();
 const env=pmrem.fromEquirectangular(tex).texture;
 scene.environment=env;scene.environmentIntensity=.76;
 pmrem.dispose();tex.dispose();
 return env;
}
