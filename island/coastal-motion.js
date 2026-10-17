import * as T from '../vendor/three.module.js';
import {terrainHeight} from './data.js';

// A restored lighthouse becomes a visible landmark. Two quiet, faceted shafts
// reuse one geometry; their lengths stop at the sampled surrounding hillside.
export function createCoastalMotion(scene){
 const origin=new T.Vector3(-820,terrainHeight(-820,-260)+29,-260);
 const rotor=new T.Group();rotor.name='Westlight rotating optic';rotor.position.copy(origin);scene.add(rotor);
 const lens=new T.Mesh(new T.IcosahedronGeometry(1.3,1),new T.MeshBasicMaterial({color:0xffd18a}));rotor.add(lens);
 const rim=new T.Mesh(new T.TorusGeometry(2.5,.09,4,16),new T.MeshLambertMaterial({color:0x786c48}));rim.rotation.x=Math.PI/2;rotor.add(rim);
 const geometry=new T.ConeGeometry(13,210,16,1,true);geometry.rotateZ(Math.PI/2);geometry.translate(105,0,0);
 const material=new T.MeshBasicMaterial({color:0xffdba2,transparent:true,opacity:.055,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending});
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 beamPoint,beamNormal,beamView;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbeamPoint=position;beamNormal=normalMatrix*normal;beamView=-(modelViewMatrix*vec4(position,1.)).xyz;');
  shader.fragmentShader='varying vec3 beamPoint,beamNormal,beamView;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float along=clamp(beamPoint.x/210.,0.,1.);
   float edge=abs(dot(normalize(beamNormal),normalize(beamView)));
   diffuseColor.a*=pow(1.-along,1.35)*smoothstep(0.,.035,along)*pow(edge,1.3);
  `);
 };
 const beams=[0,Math.PI].map(angle=>{const mesh=new T.Mesh(geometry,material);mesh.rotation.y=angle;mesh.name='Westlight sweep';mesh.renderOrder=2;rotor.add(mesh);return mesh;});
 let stamp=-1;
 return {rotor,lens,beams,update(time,relays){
  const powered=relays.includes('lighthouse');lens.visible=powered;for(const b of beams)b.visible=powered;
  rotor.rotation.y=time*.14;
  const tick=Math.floor(time*5);if(powered&&tick!==stamp){stamp=tick;
   for(let i=0;i<beams.length;i++){const a=rotor.rotation.y+i*Math.PI;let length=210;
    for(let d=12;d<=210;d+=12){if(terrainHeight(origin.x+Math.cos(a)*d,origin.z-Math.sin(a)*d)>origin.y-d*.065){length=Math.max(10,d-12);break;}}
    beams[i].scale.setScalar(length/210);
   }
  }
 }};
}
