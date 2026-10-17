import {PLACES,TRAILS,CONTACT} from './places.js';
import {TERRAIN,LANDMARKS,ROADS,terrainHeight,bridgeHeight} from './data.js';
export class FieldMap {
  constructor(canvas,data,onPin){this.canvas=canvas;this.data=data;this.onPin=onPin;this.base=document.createElement('canvas');this.base.width=1000;this.base.height=700;this.scale=.35;this.offset={x:440,y:355};this.drawBase();canvas.addEventListener('click',event=>{const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*1000,z=(event.clientY-rect.top)/rect.height*700;onPin({x:(x-this.offset.x)/this.scale,z:(z-this.offset.y)/this.scale});});}
  point(x,z){return [x*this.scale+this.offset.x,z*this.scale+this.offset.y];}
  drawBase(){const c=this.base.getContext('2d');c.fillStyle='#829d98';c.fillRect(0,0,1000,700);const s=12;for(let z=-1000;z<1000;z+=s)for(let x=-1300;x<1500;x+=s){const h=terrainHeight(x,z);if(h<0)continue;const p=this.point(x,z);c.fillStyle=h<5?'#c6c3a0':h>60?'#718264':h>30?'#91a17b':'#b1bb8b';c.fillRect(p[0],p[1],s*this.scale+1,s*this.scale+1);}
    c.strokeStyle='#dcd3ae';c.lineCap='round';for(const road of ROADS){c.lineWidth=road.width*this.scale;c.beginPath();road.points.forEach((p,i)=>c[i?'lineTo':'moveTo'](...this.point(p[0],p[1])));c.stroke();}c.lineWidth=6;c.beginPath();c.moveTo(...this.point(70,0));c.lineTo(...this.point(370,0));c.stroke();
    c.strokeStyle='#8d7053';c.lineWidth=.8;for(const path of this.data.accessPaths||[]){c.beginPath();path.points.forEach((p,i)=>c[i?'lineTo':'moveTo'](...this.point(...p)));c.stroke();}c.lineWidth=1.4;c.setLineDash([3,4]);for(const trail of TRAILS){c.beginPath();trail.points.forEach((p,i)=>c[i?'lineTo':'moveTo'](...this.point(...p)));c.stroke();}c.setLineDash([]);
    c.fillStyle='#6d7d70';for(const b of this.data.buildings){const p=this.point(b.x-b.w/2,b.z-b.d/2);c.fillRect(p[0],p[1],b.w*this.scale,b.d*this.scale);}
    c.strokeStyle='#b2bca6';c.lineWidth=.6;for(let x=0;x<1000;x+=70){c.beginPath();c.moveTo(x,0);c.lineTo(x,700);c.stroke();}for(let y=0;y<700;y+=70){c.beginPath();c.moveTo(0,y);c.lineTo(1000,y);c.stroke();}
    c.fillStyle='#3e5a52';c.font='bold 23px Georgia';c.fillText('Blackwater Island',135,550);c.fillText('Saint Orin',690,570);c.font='bold 16px Georgia';c.fillStyle='#d8dfc9';c.fillText('The Orin Strait',460,195);c.font='bold 18px Georgia';c.fillText('N',36,38);c.beginPath();c.moveTo(42,49);c.lineTo(42,85);c.stroke();c.fillText('↑',35,64);
  }
  draw(state,pin){const {canvas}=this;canvas.width=1000;canvas.height=700;const c=canvas.getContext('2d');c.drawImage(this.base,0,0);
    for(const p of LANDMARKS){const [x,y]=this.point(p.x,p.z);c.fillStyle=state.relays.includes(p.id)?'#e0d6a7':p.type==='relay'?'#a36243':'#3a574d';c.beginPath();c.arc(x,y,p.type==='relay'?6:4,0,Math.PI*2);c.fill();c.font='600 12px Trebuchet MS, Arial';c.fillStyle='#263e36';c.textAlign='center';c.fillText(p.name,x,y-11);}
    for(const place of PLACES){if(!state.discovered.includes(place.id))continue;const [x,y]=this.point(place.x,place.z);c.fillStyle=state.records.includes(place.id)?'#617047':'#a46540';c.fillRect(x-4,y-4,8,8);c.font='11px Trebuchet MS, Arial';c.textAlign='center';c.fillText(place.name,x,y+17);}
    if(pin){const p=this.point(pin.x,pin.z);c.strokeStyle='#a45f41';c.lineWidth=2;c.beginPath();c.arc(p[0],p[1],9,0,Math.PI*2);c.moveTo(p[0]-13,p[1]);c.lineTo(p[0]+13,p[1]);c.moveTo(p[0],p[1]-13);c.lineTo(p[0],p[1]+13);c.stroke();}
    const p=this.point(state.x,state.z);c.save();c.translate(...p);c.rotate(state.yaw);c.fillStyle='#fff4ca';c.strokeStyle='#304f45';c.lineWidth=2;c.beginPath();c.moveTo(0,-10);c.lineTo(-6,7);c.lineTo(0,4);c.lineTo(6,7);c.closePath();c.fill();c.stroke();c.restore();
  }
}
