import * as T from '../vendor/three.module.js';

// One fixed draw, forty footprints. Sample support only when a stain appears
// or spreads; fading never resamples terrain. Triangles crossing a curb are
// omitted rather than connecting two decks with a vertical red sheet.
export function createGroundBlood(scene,floorAt){
 const slots=40,sectors=14,rings=4,vertices=sectors*rings*6,positions=new Float32Array(slots*vertices*3),colors=new Float32Array(positions.length),fades=new Float32Array(slots*vertices);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('color',new T.BufferAttribute(colors,3));geometry.setAttribute('stainFade',new T.BufferAttribute(fades,1).setUsage(T.DynamicDrawUsage));
 const normals=new Float32Array(positions.length);for(let i=1;i<normals.length;i+=3)normals[i]=1;geometry.setAttribute('normal',new T.BufferAttribute(normals,3));
 const material=new T.MeshLambertMaterial({color:0x722d26,vertexColors:true,side:T.DoubleSide,depthWrite:false,transparent:true,polygonOffset:true,polygonOffsetFactor:-1});
 material.onBeforeCompile=s=>{s.vertexShader='attribute float stainFade;varying float vStainFade;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvStainFade=stainFade;');s.fragmentShader='varying float vStainFade;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vStainFade;');};material.customProgramCacheKey=()=> 'conforming-ground-blood-v1';
 const mesh=new T.Mesh(geometry,material);mesh.name='Ground blood puddles';mesh.frustumCulled=false;scene.add(mesh);
 const stains=Array.from({length:slots},()=>({life:0,x:0,z:0,y:0,size:0})),edge=[.91,.96,.83,1,.89,.76,.84,.98,.92,.77,.89,.95,.73,.87],points=Array.from({length:1+rings*sectors},()=>({x:0,y:0,z:0,t:0}));let next=0;
 function build(index,s){
  points[0].x=s.x;points[0].z=s.z;points[0].y=floorAt(s.x,s.z)+.003;points[0].t=0;
  const angle=index*2.4,ca=Math.cos(angle),sa=Math.sin(angle);
  for(let r=1;r<=rings;r++)for(let j=0;j<sectors;j++){const a=j/sectors*Math.PI*2,t=r/rings,x=Math.cos(a)*edge[j]*s.size*t,z=Math.sin(a)*edge[j]*s.size*.7*t,p=points[1+(r-1)*sectors+j];p.x=s.x+x*ca-z*sa;p.z=s.z+x*sa+z*ca;p.y=floorAt(p.x,p.z)+.003;p.t=t;}
  let cursor=index*vertices;
  const continuous=(a,b)=>Math.abs(a.y-b.y)<.035||Math.abs(floorAt((a.x+b.x)/2,(a.z+b.z)/2)+.003-(a.y+b.y)/2)<.012;
  function triangle(a,b,c){const valid=continuous(a,b)&&continuous(b,c)&&continuous(c,a);for(const p of[a,b,c]){const k=cursor++*3;positions[k]=valid?p.x:s.x;positions[k+1]=valid?p.y:s.y;positions[k+2]=valid?p.z:s.z;const value=.62+.38*p.t;colors[k]=value;colors[k+1]=value*(1-.05*p.t);colors[k+2]=value*(1-.10*p.t);}}
  for(let r=1;r<=rings;r++)for(let j=0;j<sectors;j++){const k=(j+1)%sectors,a=r===1?points[0]:points[1+(r-2)*sectors+j],b=r===1?points[0]:points[1+(r-2)*sectors+k],c=points[1+(r-1)*sectors+j],d=points[1+(r-1)*sectors+k];triangle(a,d,c);triangle(a,b,d);}
  geometry.attributes.position.needsUpdate=geometry.attributes.color.needsUpdate=true;
 }
 return {mark(point,size,limit=.22){const y=floorAt(point.x,point.z)+.003;let i=stains.findIndex(s=>s.life>0&&Math.abs(s.y-y)<.04&&(s.x-point.x)**2+(s.z-point.z)**2<.0256);if(i>=0){const s=stains[i];s.size=Math.min(Math.max(limit,s.size),Math.hypot(s.size,size));s.life=22;build(i,s);return;}i=next++%slots;const s=stains[i];Object.assign(s,{life:22,x:point.x,z:point.z,y,size});build(i,s);},
  update(dt){let changed=false;for(let i=0;i<slots;i++){const s=stains[i],before=s.life;s.life=Math.max(0,s.life-dt);if(before!==s.life||dt===0){fades.fill(Math.min(1,s.life/3),i*vertices,(i+1)*vertices);changed=true;}}if(changed)geometry.attributes.stainFade.needsUpdate=true;},
  clear(){for(const s of stains)s.life=0;fades.fill(0);geometry.attributes.stainFade.needsUpdate=true;},get active(){return stains.filter(s=>s.life>0).length;}
 };
}
