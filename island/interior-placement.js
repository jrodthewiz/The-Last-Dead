// Right-angle room placement keeps visible parts and their solid writer on the
// same exact transform. Supported props, chair backs and signs move as a group.
export function interiorPlacement(k,{x=0,z=0,q=0}){
 const turn=((q%4)+4)%4,point=(a,c)=>turn===1?[x-c,z+a]:turn===2?[x-a,z-c]:turn===3?[x+c,z-a]:[x+a,z+c];
 const box=(role,a,y,c,w,h,d,color,solid=false)=>{const [xx,zz]=point(a,c);return k.box(role,xx,y,zz,turn%2?d:w,h,turn%2?w:d,color,solid);};
 const placed={...k,box,
  cylinder:(role,a,y,c,r,h,color,solid=false)=>{const [xx,zz]=point(a,c);return k.cylinder(role,xx,y,zz,r,h,color,solid);},
  cone:(role,a,y,c,w,h,d,color,rotation=0)=>{const [xx,zz]=point(a,c);return k.cone(role,xx,y,zz,w,h,d,color,rotation-q*Math.PI/2);},
  disc:(role,a,y,c,r,depth,color,rotation=0)=>{const [xx,zz]=point(a,c);return k.disc(role,xx,y,zz,r,depth,color,rotation-q*Math.PI/2);},
  label:(text,sub,a,y,c,w,h,rotation=0)=>{const [xx,zz]=point(a,c);return k.label(text,sub,xx,y,zz,w,h,rotation-q*Math.PI/2);},
  desk:(a,c,w,d,dressed=true)=>k.desk(a,c,w,d,dressed,box),
  chair:(a,c,back=1)=>k.chair(a,c,back,box)
 };
 return placed;
}
