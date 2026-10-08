import * as THREE from './vendor/three.module.js';
import {capeStreamZ,capeStreamWidth,capeStreamLevel,capeGroundHeight} from './coastal-terrain.js';

export function riverRipple(x,z,time){return .012*Math.sin(x*2.1+z*.7-time*2.8)+.005*Math.sin(x*.8-z*3.2-time*3.9);}
export function createCapeRiver(){
  const positions=[],depths=[],uvs=[],indices=[];
  const columns=304,rows=8;
  for(let i=0;i<=columns;i++){
    const x=128+i,center=capeStreamZ(x),width=capeStreamWidth(x),level=capeStreamLevel(x);
    for(let j=0;j<=rows;j++){
      const v=j/rows,z=center+(v*2-1)*width;
      positions.push(x,level,z);depths.push(Math.max(.01,level-capeGroundHeight(x,z,{bridges:false})));
      uvs.push(x*.2,v);
      if(i<columns&&j<rows){const a=i*(rows+1)+j,b=a+rows+1;indices.push(a,b,a+1,b,b+1,a+1);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('riverDepth',new THREE.Float32BufferAttribute(depths,1));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const field=`float riverWave(vec2 p,float t){return .012*sin(p.x*2.1+p.y*.7-t*2.8)+.005*sin(p.x*.8-p.y*3.2-t*3.9);}`;
  const material=new THREE.ShaderMaterial({name:'CapeRiverOptics',side:THREE.DoubleSide,uniforms:{time:{value:0}},
    vertexShader:`uniform float time;attribute float riverDepth;varying vec3 vRiver;varying float vDepth;varying float vBank;${field}void main(){vec3 p=position;p.y+=riverWave(p.xz,time)*sin(uv.y*3.14159265);vRiver=(modelMatrix*vec4(p,1.)).xyz;vDepth=riverDepth;vBank=sin(uv.y*3.14159265);gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
    fragmentShader:`uniform float time;varying vec3 vRiver;varying float vDepth;varying float vBank;
    void main(){
      float footprint=max(length(dFdx(vRiver.xz)),length(dFdy(vRiver.xz)));
      float aa=1.-smoothstep(.05,.8,footprint);
      vec2 g=(vec2(2.1,.7)*.012*cos(vRiver.x*2.1+vRiver.z*.7-time*2.8)+vec2(.8,-3.2)*.005*cos(vRiver.x*.8-vRiver.z*3.2-time*3.9))*vBank*aa;
      vec3 n=normalize(vec3(-g.x,1.,-g.y));vec3 v=normalize(cameraPosition-vRiver);
      float f=.0204+.9796*pow(1.-abs(dot(n,v)),5.);vec3 r=reflect(-v,n);
      vec3 sky=mix(vec3(.38,.48,.42),vec3(.055,.23,.41),sqrt(clamp(r.y,0.,1.)));
      float path=max(.02,vDepth)/max(.2,abs(v.y));vec3 transmission=exp(-vec3(1.4,.65,.37)*path);
      float bed=.5+.5*sin(vRiver.x*5.4+sin(vRiver.z*3.1))*sin(vRiver.z*6.3);
      vec3 scatter=vec3(.018,.115,.108);vec3 bottom=vec3(.23,.28,.15)*( .65+bed*.35);
      vec3 body=scatter*(vec3(1.)-transmission)+bottom*transmission;
      float highlight=max(dot(r,normalize(vec3(-.5,.4,-.6))),0.);
      float glint=smoothstep(.94,.98,highlight)*.16;
      vec3 color=mix(body,sky,f)+vec3(.8,.76,.63)*glint;
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  const root=new THREE.Mesh(geometry,material);root.name='CapeWindingStream';root.userData.noBatch=true;
  return{root,diagnostics:{length:304,width:'4.5–6.3m',triangles:indices.length/3,depth:'shared triangulated river bed; estimated optical path',reflection:'analytic sky; no scene reflection/refraction',waves:'two1.2cm/0.5cm displacement bands with matching slope; banks fixed',materials:1},update(time){material.uniforms.time.value=time;},dispose(){root.removeFromParent();geometry.dispose();material.dispose();}};
}
