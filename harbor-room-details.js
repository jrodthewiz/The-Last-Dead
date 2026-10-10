// Wall-side shelving fills customs/service interiors. Its records own both
// rendering and movement collision and leave the central aisle open.
export function makeHarborRoomDetails(room,index) {
 const parts=[],x=room.x+1.25,z=room.z-room.depth/2+.53,width=Math.min(2.4,room.width-3),depth=.72;
 const add=(role,material,dx,y,dz,w,h,d)=>parts.push({role,material,x:x+dx,y,z:z+dz,w,h,d});
 for(const side of [-1,1])for(const end of [-1,1])add('RackUpright','trim',side*(width/2-.035),1,end*(depth/2-.025),.055,1.80,.055);
 for(const y of [.30,.91,1.53]){add('Shelf','trim',0,y,0,width,.055,depth);add('ShelfLip','trim',0,y+.055,.34,width,.10,.035);}
 for(let shelf=0;shelf<3;shelf++)for(let item=0;item<3;item++){
  const dx=(item-1)*(width/3),y=.34+shelf*.61;
  if(index===0||index===5){
   add('ArchiveBox','paper',dx,y+.15,0,width/3-.14,.30,.49);
   add('ArchiveLabel','plaster',dx,y+.18,.25,.19,.075,.012);
   add('ArchiveLid','trim',dx,y+.31,0,width/3-.11,.035,.52);
  }else if(index===1||index===3){
   add('SupplyCrate','wood',dx,y+.15,0,width/3-.12,.29,.48);
   for(const side of [-1,1])add('CrateBand','trim',dx+side*.18,y+.15,.247,.035,.30,.025);
   add('WrappedSupplies','paper',dx,y+.33,0,.34,.055,.33);
  }else{
   add('PartsTray','trim',dx,y+.05,0,width/3-.10,.10,.48);
   for(let tool=0;tool<3;tool++)add('ServiceParts','wood',dx-.17+tool*.16,y+.18,0,.095,.19+tool*.035,.22);
  }
 }
 const pegX=room.x+room.width/2-.16,pegZ=room.z+room.depth/2-2.4;
 parts.push({role:'WallPegRail',material:'wood',x:pegX,y:2.22,z:pegZ,w:.08,h:.12,d:.72});
 for(const dz of [-.19,.19]){
  parts.push({role:'WallHook',material:'trim',x:pegX-.06,y:2.14,z:pegZ+dz,w:.15,h:.14,d:.045});
  parts.push({role:'HangingWorkCoat',material:'trim',x:pegX-.03,y:1.78,z:pegZ+dz,w:.08,h:.63,d:.28});
 }
 return {parts,obstacles:[{id:`${room.id}-supply-rack`,minX:(x-width/2)/4,maxX:(x+width/2)/4,minY:(z-depth/2)/4,maxY:(z+depth/2)/4}]};
}
