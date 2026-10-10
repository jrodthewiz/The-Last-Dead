// A carried splicing jig connects the two existing coils at East Works 52.
// Positions stay in the original repair community; no new collision record.
export function makeCoastalCableRepair(townPlan){
 const community=townPlan.communities.find(c=>c.buildingId==='coast-lot-2-1-0-2'&&c.kind==='repair');
 if(!community)return{parts:[],diagnostics:{parts:0,triangles:0}};
 if(Math.abs(community.x-293.8)>1e-6||Math.abs(community.z-119.2)>1e-6)throw new Error('Cable repair requires its actual original reel community');
 const parts=[],id=community.id;
 const add=(role,slot,position,size,geometry='box',roll=0,tilt=0)=>parts.push({communityId:id,role,slot,geometry,position,size,yaw:0,roll,tilt});
 const beam=(role,slot,a,b,width)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz);
  add(role,slot,a.map((v,i)=>(v+b[i])/2),[width,length,width],'box',Math.atan2(dz,dy),Math.asin(-dx/length));
 };
 // The original six pallet boards top out at .475m. These two feet bear on
 // their actual outer boards, behind the coils rather than on new sidewalk.
 for(const x of [292.7,294.9]){
  add('splice-jig-pallet-foot','metal',[x,.520,119.68],[.18,.09,.12]);
  add('splice-jig-bearing-upright','metal',[x,1.1075,119.68],[.08,1.085,.08]);
 }
 add('splice-jig-heading','metal',[293.8,1.65,119.68],[2.28,.10,.10]);
 beam('splice-jig-left-brace','metal',[292.7,1.27,119.68],[293.1,1.60,119.68],.055);
 beam('splice-jig-right-brace','metal',[294.9,1.27,119.68],[294.5,1.60,119.68],.055);
 add('splice-jig-forward-bearing','metal',[293.8,1.65,119.485],[.085,.085,.39]);
 add('splice-jig-clamp-hanger','metal',[293.8,1.595,119.35],[.09,.11,.10]);
 // The existing ten-sided cylinder is rotated along X. Cable leads terminate
 // at the sleeve mouths, rather than disappearing into a floating clamp.
 add('splice-jig-compression-sleeve','metal',[293.8,1.55,119.35],[.075,.20,.075],'cylinder',0,Math.PI/2);
 for(const x of [293.75,293.85])add('splice-jig-opposed-clamp-jaw','metal',[x,1.50,119.35],[.065,.07,.14]);
 add('splice-jig-locking-handle','metal',[293.86,1.72,119.35],[.035,.25,.035]);
 const feeds=[{from:[293.17,1.0674,119.182],to:[293.7,1.55,119.35]},{from:[294.43,1.0674,119.182],to:[293.9,1.55,119.35]}];
 for(const feed of feeds)beam('reel-to-splice-cable','dark',feed.from,feed.to,.032);
 return{parts,feeds,footContacts:[[292.7,.475,119.68],[294.9,.475,119.68]],sleeve:{center:[293.8,1.55,119.35],mouths:feeds.map(f=>f.to)},
  diagnostics:{parts:parts.length,triangles:(parts.length-1)*12+40,newColliders:0,borrowedPrimitives:['box','cylinder'],palletBearingY:.475,cableDiameter:.032}};
}
