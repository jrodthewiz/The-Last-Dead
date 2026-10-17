import * as T from '../vendor/three.module.js';
import {FRONTAGES} from './settlement-plan.js';
import {createCoastalRoosts} from './coastal-roosts.js';

// Small authored movements share one clock and keep streets/doorways clear.
export function createSettlementLife(scene,data){
 const roosts=createCoastalRoosts(scene,data),clock={value:0},flags=[],signs=[],buoys=[],metal=new T.MeshLambertMaterial({color:0x495b50,flatShading:true}),wood=new T.MeshLambertMaterial({color:0x92784f,flatShading:true});
 const box=(parent,w,h,d,material,x=0,y=0,z=0)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
 const cloth=new T.MeshLambertMaterial({color:0xa6ae89,side:T.DoubleSide,flatShading:true});cloth.onBeforeCompile=shader=>{shader.uniforms.uWind=clock;shader.vertexShader='uniform float uWind;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
  float freeEdge=position.x/2.4;
  transformed.z+=freeEdge*(sin(position.x*2.8-uWind*2.3)*.15+sin(position.y*3.+uWind*1.2)*.04);
  transformed.y-=freeEdge*.16;
 `);};
 const clothGeometry=new T.PlaneGeometry(2.4,1.25,6,3);clothGeometry.translate(1.2,0,0);
 for(const id of ['arrival-house','lightkeeper','clinic']){const b=data.buildings.find(b=>b.id===id);if(!b)continue;const root=new T.Group();root.name='Coastal signal cloth';root.position.set(b.x-b.w*.35,b.baseY+b.height+3,b.z);root.rotation.y=id==='clinic'?-.6:.8;scene.add(root);box(root,.07,3.1,.07,metal,0,0,0);const flag=new T.Mesh(clothGeometry,cloth);flag.position.y=1;root.add(flag);flags.push(root);}
 for(const b of data.buildings.filter(b=>b.district==='oldtown'&&b.enterable&&!FRONTAGES[b.id]).slice(0,8)){const root=new T.Group();root.position.set(b.x-b.w*.33,b.baseY+3.1,b.z+b.d/2+.6);root.name='Suspended shop sign';scene.add(root);box(root,.07,.07,1.05,metal,0,.3,0);const hinge=new T.Group();hinge.position.set(0,.22,.5);root.add(hinge);box(hinge,.95,.6,.1,wood,0,-.4,0);for(const x of [-.3,.3])box(hinge,.025,.22,.025,metal,x,-.1,0);box(hinge,.64,.06,.015,metal,0,-.35,.058);box(hinge,.42,.04,.015,metal,0,-.5,.058);signs.push({root,hinge,phase:b.seed%10});}
 const red=new T.MeshLambertMaterial({color:0x986249,flatShading:true}),pale=new T.MeshLambertMaterial({color:0xb1b69a,flatShading:true});
 for(let i=0;i<6;i++){const root=new T.Group();root.position.set(1320+(i%2)*17,.45,85+i*68);root.name='Moored channel buoy';scene.add(root);const body=new T.Mesh(new T.CylinderGeometry(.55,1.05,1.3,8),i%2?red:pale);root.add(body);box(root,.1,2.8,.1,metal,0,1,0);const cap=new T.Mesh(new T.ConeGeometry(.5,.65,5),i%2?red:pale);cap.position.y=2.4;root.add(cap);buoys.push(root);}
 return {flags,signs,buoys,clock,roosts,update(time,camera){clock.value=time;roosts.update(time,camera);for(const f of flags)f.visible=f.position.distanceToSquared(camera)<500**2;for(const s of signs){s.root.visible=s.root.position.distanceToSquared(camera)<150**2;s.hinge.rotation.x=Math.sin(time*1.3+s.phase)*.045+Math.sin(time*.7)*.018;}for(let i=0;i<buoys.length;i++){const b=buoys[i];b.visible=b.position.distanceToSquared(camera)<650**2;b.position.y=.45+Math.sin(time*.75+i*1.7)*.22;b.rotation.z=Math.sin(time*.8+i)*.065;}}};
}
