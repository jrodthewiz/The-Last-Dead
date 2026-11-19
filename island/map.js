import {PLACES,TRAILS} from './places.js';
import {LANDMARKS,ROADS,terrainHeight} from './data.js';
export class FieldMap {
  constructor(canvas,data,onPin){this.canvas=canvas;this.data=data;this.onPin=onPin;this.base=document.createElement('canvas');this.base.width=1000;this.base.height=700;this.scale=.35;this.offset={x:440,y:355};this.drawBase();canvas.addEventListener('click',event=>{const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*1000,z=(event.clientY-rect.top)/rect.height*700;onPin({x:(x-this.offset.x)/this.scale,z:(z-this.offset.y)/this.scale,name:'Your waypoint'});});}
  point(x,z){return [x*this.scale+this.offset.x,z*this.scale+this.offset.y];}
  drawBase(){const c=this.base.getContext('2d');c.fillStyle='#829d98';c.fillRect(0,0,1000,700);const s=12;for(let z=-1000;z<1000;z+=s)for(let x=-1300;x<1500;x+=s){const h=terrainHeight(x,z);if(h<0)continue;const p=this.point(x,z);c.fillStyle=h<5?'#c6c3a0':h>60?'#718264':h>30?'#91a17b':'#b1bb8b';c.fillRect(p[0],p[1],s*this.scale+1,s*this.scale+1);}
    c.lineCap='round';
    for(const road of ROADS){
      c.beginPath();
      road.points.forEach((p,i)=>c[i?'lineTo':'moveTo'](...this.point(...p)));
      c.lineWidth=Math.max(2,road.width*this.scale)+2;
      c.strokeStyle='#6a7155';c.stroke();
      c.lineWidth-=2;
      c.strokeStyle='#eadbb3';c.stroke();
    }
    c.beginPath();c.moveTo(...this.point(70,0));c.lineTo(...this.point(370,0));
    c.lineWidth=8;c.strokeStyle='#3d5a53';c.stroke();
    c.lineWidth=4;c.strokeStyle='#eadbb3';c.stroke();
    c.strokeStyle='#8d7053';c.lineWidth=.8;for(const path of this.data.accessPaths||[]){c.beginPath();path.points.forEach((p,i)=>c[i?'lineTo':'moveTo'](...this.point(...p)));c.stroke();}c.lineWidth=1.4;c.setLineDash([3,4]);for(const trail of TRAILS){c.beginPath();trail.points.forEach((p,i)=>c[i?'lineTo':'moveTo'](...this.point(...p)));c.stroke();}c.setLineDash([]);
    c.fillStyle='#6d7d70';for(const b of this.data.buildings){const p=this.point(b.x-b.w/2,b.z-b.d/2);c.fillRect(p[0],p[1],b.w*this.scale,b.d*this.scale);}
    c.strokeStyle='#b2bca6';c.lineWidth=.6;for(let x=0;x<1000;x+=70){c.beginPath();c.moveTo(x,0);c.lineTo(x,700);c.stroke();}for(let y=0;y<700;y+=70){c.beginPath();c.moveTo(0,y);c.lineTo(1000,y);c.stroke();}
    c.fillStyle='#3e5a52';c.font='bold 23px Georgia';c.fillText('Blackwater Island',135,550);c.fillText('Saint Orin',690,570);c.font='bold 16px Georgia';c.fillStyle='#d8dfc9';c.fillText('The Orin Strait',460,195);c.font='bold 18px Georgia';c.fillText('N',36,38);c.beginPath();c.moveTo(42,49);c.lineTo(42,85);c.stroke();c.fillText('↑',35,64);
  }
  draw(state,pin,target){const {canvas}=this;canvas.width=1000;canvas.height=700;const c=canvas.getContext('2d');c.drawImage(this.base,0,0);
    c.textAlign='center';
    c.font='700 20px Trebuchet MS, Arial';
    c.lineJoin='round';
    const labels=[];
    for(const p of LANDMARKS){
      const [x,y]=this.point(p.x,p.z),relay=p.type==='relay';
      c.fillStyle=state.relays.includes(p.id)?'#f3e2a7':relay?'#874829':'#304f45';
      c.strokeStyle='#f5ebc7';c.lineWidth=2;
      c.beginPath();c.arc(x,y,relay?7:5,0,Math.PI*2);c.fill();c.stroke();
      if(p.name===target?.name)continue;
      c.lineWidth=5;c.strokeText(p.name,x,y-13);
      c.fillStyle='#233b33';c.fillText(p.name,x,y-13);
      labels.push([x-c.measureText(p.name).width/2-3,y-34,c.measureText(p.name).width+6,25]);
    }
    for(const place of PLACES){if(!state.discovered.includes(place.id))continue;const [x,y]=this.point(place.x,place.z);c.fillStyle=state.records.includes(place.id)?'#617047':'#a46540';c.fillRect(x-4,y-4,8,8);c.font='11px Trebuchet MS, Arial';c.textAlign='center';c.fillText(place.name,x,y+17);const w=c.measureText(place.name).width;labels.push([x-w/2-3,y+5,w+6,15]);}
    if(target){
      const [x,y]=this.point(target.x,target.z);
      c.beginPath();c.moveTo(x,y-10);c.lineTo(x+10,y);c.lineTo(x,y+10);c.lineTo(x-10,y);c.closePath();
      c.lineWidth=4;c.strokeStyle='#fff2ca';c.stroke();
      c.fillStyle=pin?'#803d2a':'#304f45';c.fill();
      if(!pin){
        c.beginPath();c.moveTo(x,y-4);c.lineTo(x+4,y);c.lineTo(x,y+4);c.lineTo(x-4,y);c.closePath();
        c.fillStyle='#fff2ca';c.fill();
      }
    }
    const p=this.point(state.x,state.z);c.save();c.translate(...p);c.rotate(state.yaw);c.fillStyle='#fff4ca';c.strokeStyle='#304f45';c.lineWidth=2;c.beginPath();c.moveTo(0,-13);c.lineTo(-8,9);c.lineTo(0,5);c.lineTo(8,9);c.closePath();c.fill();c.stroke();c.restore();
    if(target)this.drawTargetLabel(c,target,!!pin,[...labels,[p[0]-15,p[1]-15,30,30]]);
  }
  drawTargetLabel(c,target,waypoint,labels){
    const [x,y]=this.point(target.x,target.z);
    c.font='700 26px Trebuchet MS, Arial';
    const textWidth=Math.min(c.measureText(target.name).width,340);
    const w=textWidth+24,h=38,gap=27;
    const candidates=[
      [x+w/2+gap,y-h/2],[x-w/2-gap,y-h/2],
      [x,y-h-gap],[x,y+gap],
    ].map(([cx,top])=>[
      Math.max(8,Math.min(this.canvas.width-w-8,cx-w/2)),
      Math.max(8,Math.min(this.canvas.height-h-8,top)),
    ]);
    const [left,top]=candidates.find(([l,t])=>(
      (x<l-12||x>l+w+12||y<t-12||y>t+h+12) &&
      !labels.some(([lx,ly,lw,lh])=>l<lx+lw&&l+w>lx&&t<ly+lh&&t+h>ly)
    ))??candidates[0];
    const endX=Math.max(left,Math.min(left+w,x));
    const endY=Math.max(top,Math.min(top+h,y));
    const distance=Math.hypot(endX-x,endY-y);
    if(distance>10){
      c.beginPath();
      c.moveTo(x+(endX-x)*10/distance,y+(endY-y)*10/distance);
      c.lineTo(endX,endY);
      c.lineWidth=6;c.strokeStyle='#fff2ca';c.stroke();
      c.lineWidth=2.5;c.strokeStyle='#304f45';c.stroke();
    }
    c.fillStyle=waypoint?'#633626':'#20372e';
    c.fillRect(left,top,w,h);
    c.lineWidth=2;c.strokeStyle='#fff2ca';c.strokeRect(left,top,w,h);
    c.fillStyle='#fff2ca';c.textAlign='center';c.textBaseline='middle';
    c.fillText(target.name,left+w/2,top+h/2,textWidth);
  }
}
