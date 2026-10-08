import * as THREE from './vendor/three.module.js';

// Mission dressing sits on the existing Thai Kit tables, never in walk lanes.
export class LowTideVisuals {
  constructor(world){
    this.world=world;this.items=new Map();
    const metal=new THREE.MeshStandardMaterial({color:0x394b46,roughness:.65,metalness:.4});
    const rubber=new THREE.MeshStandardMaterial({color:0x131c1b,roughness:.85});
    const brass=new THREE.MeshStandardMaterial({color:0xb78d51,metalness:.65,roughness:.4});
    const paper=new THREE.MeshStandardMaterial({color:0xd5c9a4,roughness:.95});
    this.indicator=new THREE.MeshStandardMaterial({color:0x68432b,emissive:0x293b22,emissiveIntensity:0});
    const box=(g,w,h,d,x,y,z,m)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);g.add(mesh);return mesh;};
    const dial=(g,r,depth,x,y,z,m)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,depth,16),m);mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);g.add(mesh);return mesh;};
    const rounded=(g,w,h,d,x,y,z,m)=>{
      const shape=new THREE.Shape(),r=.035;
      shape.moveTo(-w/2+r,0);shape.lineTo(w/2-r,0);shape.quadraticCurveTo(w/2,0,w/2,r);shape.lineTo(w/2,h-r);shape.quadraticCurveTo(w/2,h,w/2-r,h);shape.lineTo(-w/2+r,h);shape.quadraticCurveTo(-w/2,h,-w/2,h-r);shape.lineTo(-w/2,r);shape.quadraticCurveTo(-w/2,0,-w/2+r,0);
      const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:2,steps:1,curveSegments:6}),m);mesh.position.set(x,y,z-d/2);g.add(mesh);return mesh;
    };
    const plaque=(g,title,sub,x,y,z,width=.95)=>{
      const canvas=document.createElement('canvas');canvas.width=768;canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='#192e2a';ctx.fillRect(0,0,768,256);ctx.strokeStyle='#b9a36e';ctx.lineWidth=10;ctx.strokeRect(8,8,752,240);
      ctx.textAlign='center';ctx.fillStyle='#e9dfbc';ctx.font='bold 42px sans-serif';ctx.fillText(title,384,103,710);ctx.font='30px sans-serif';ctx.fillText(sub,384,173,710);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width/3),new THREE.MeshStandardMaterial({map:texture,roughness:.85}));mesh.position.set(x,y,z);g.add(mesh);box(g,width+.035,width/3+.035,.018,x,y,z-.014,metal);return mesh;
    };
    const labels={shelter:['NETMAKERS / CHANNEL 06','SAFEHOUSE · RADIO · REST'],manifest:['EVACUATION / MANIFEST 06','MARA VENN · FERRY MECHANIC'],identified:['COLD STORAGE / BAY 02','IDENTIFICATION RECORD'],battery:['WORKSHOP / RESERVE','TESTED 12 V STARTER'],fuel:['DISPATCH / RESERVE','SEALED DIESEL · DOCK CIRCUIT'],powered:['DOCK CIRCUIT / CONTROL','WARNING: AUTOMATIC SHIFT BELL']};
    for(const station of world.course.lowTideStations){
      if(station.id==='stash')continue;
      const room=world.interiors.rooms.get(station.roomId),g=new THREE.Group();g.name=`LowTide:${station.id}`;g.userData.noBatch=true;g.position.set(station.propX,1.01,station.propZ);g.rotation.y=Math.PI/2;room.add(g);this.items.set(station.id,g);
      const [title,sub]=labels[station.id];plaque(g,title,sub,0,.64,-.48,1.65);box(g,.07,.5,.07,-.65,.27,-.5,metal);box(g,.07,.5,.07,.65,.27,-.5,metal);
      if(station.id==='shelter'){
        rounded(g,.8,.38,.35,0,0,0,metal);
        for(let i=0;i<9;i++)box(g,.025,.23,.012,-.31+i*.032,.2,.19,rubber);
        box(g,.22,.085,.018,.2,.28,.19,this.indicator);dial(g,.055,.05,.21,.12,.2,brass);
        const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.006,.01,.55,8),brass);antenna.position.set(.3,.64,-.1);antenna.rotation.z=-.15;g.add(antenna);
        box(g,.52,.025,.04,0,.44,0,rubber);for(const x of [-.26,.26])box(g,.025,.1,.04,x,.4,0,rubber);
      }else if(station.id==='manifest'){
        for(let i=0;i<5;i++){const page=box(g,.68,.008,.46,.08+i*.007,.02+i*.009,.08,paper);page.rotation.y=i*.02;}
        for(let i=0;i<8;i++)box(g,.43,.002,.008,.1,.061,-.08+i*.032,metal);
        box(g,.06,.02,.22,-.21,.078,.04,brass);
      }else if(station.id==='identified'){
        const remains=new THREE.Group();remains.rotation.y=-Math.PI/2;g.add(remains);
        const cloth=new THREE.MeshStandardMaterial({color:0x666f60,roughness:1,side:THREE.DoubleSide});
        const nx=48,nz=20,vertices=[],indices=[];
        const height=(x,v)=>.035+(1-v*v)*(.08+.12*Math.exp(-(((x+.15)/.48)**2))+.1*Math.exp(-(((x-.67)/.19)**2)))+.009*Math.sin(x*37+v*19)*Math.abs(v);
        // A creased, closed mortuary bag, with a flat perimeter and raised contents.
        for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){
          const x=-.94+i/nx*1.88,v=-1+j/nz*2,width=.31*(.7+.3*Math.sin(Math.PI*i/nx));
          vertices.push(x,height(x,v)*Math.min(1,i/2,(nx-i)/2),v*width);
        }
        for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const a=i*(nz+1)+j,b=a+nz+1;indices.push(a,a+1,b,b,a+1,b+1);}
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
        const body=new THREE.Mesh(geometry,cloth);body.name='MaraVennCoveredRemains';remains.add(body);
        const seam=[];for(let i=0;i<=32;i++){const x=-.83+i/32*1.66;seam.push(new THREE.Vector3(x,height(x,0)+.008,0));}
        remains.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seam),40,.008,5,false),rubber));
        for(const x of [-.62,0,.62])for(const z of [-.31,.31]){box(remains,.14,.016,.095,x,.035,z,rubber);box(remains,.11,.017,.038,x,.035,z+Math.sign(z)*.035,metal);}
        const tag=new THREE.Group();tag.position.set(.94,.14,0);tag.rotation.y=Math.PI/2;remains.add(tag);plaque(tag,'VENN, MARA','BAY 02 / VERIFIED',0,0,0,.32);
      }else if(station.id==='battery'){
        const item=new THREE.Group();g.add(item);g.userData.pickup=item;
        rounded(item,.56,.35,.3,0,0,0,rubber);box(item,.59,.06,.33,0,.37,0,metal);
        for(const x of [-.19,.19])box(item,.045,.07,.055,x,.43,0,x<0?brass:world.materials.rust);
        for(const x of [-.23,.23])box(item,.022,.34,.018,x,.18,.165,metal);
        plaque(item,'12 V','TESTED',0,.22,.17,.34);
      }else if(station.id==='fuel'){
        const item=new THREE.Group();g.add(item);g.userData.pickup=item;
        rounded(item,.38,.48,.22,0,0,0,world.materials.rust);
        box(item,.26,.035,.09,0,.61,0,metal);for(const x of [-.13,.13])box(item,.035,.13,.09,x,.55,0,metal);
        const cap=new THREE.Mesh(new THREE.CylinderGeometry(.043,.043,.045,12),brass);cap.position.set(.12,.5,.065);item.add(cap);
        for(const angle of [-.6,.6]){const rib=box(item,.027,.35,.023,0,.25,.135,metal);rib.rotation.z=angle;}
      }else if(station.id==='powered'){
        rounded(g,.66,.4,.32,0,0,0,metal);box(g,.17,.14,.025,-.18,.28,.18,this.indicator);
        box(g,.08,.2,.035,.17,.23,.2,rubber);box(g,.17,.055,.075,.17,.23,.24,brass);
      }
    }
    const bellGroup=new THREE.Group();bellGroup.name='DockShiftBell';bellGroup.position.set(64,3.7,68);world.root.add(bellGroup);this.bell=bellGroup;
    const profile=[[.06,.34],[.1,.3],[.15,.17],[.23,0],[.26,-.015]].map(([x,y])=>new THREE.Vector2(x,y));
    bellGroup.add(new THREE.Mesh(new THREE.LatheGeometry(profile,24),brass));
    box(bellGroup,.7,.065,.2,0,.39,0,metal);box(bellGroup,.07,3.7,.08,.33,-1.48,0,metal);
    plaque(bellGroup,'SHIFT / 06','DOCK CIRCUIT',0,-.5,.15,.8);
  }
  update(run){
    if(!run?.lowTide)return;const s=run.lowTide;
    this.indicator.emissiveIntensity=s.powered?1.8:0;
    this.indicator.color.setHex(s.powered?0x89ad77:0x68432b);
    for(const id of ['battery','fuel'])this.items.get(id).userData.pickup.visible=!s[id];
    // The bell is audible and moves only during its bounded outdoor sequence.
    this.bell.children[0].rotation.z=s.bellRemaining>0&&!run.course.activeInterior?Math.sin(run.time*5)*.15:0;
  }
}
