// Fit the bat's impact cap to the aiming line at the authoritative hit frame.
// Portrait viewmodels move inward, so a fixed swing angle cannot fit both.
export function batContactPose(x,y,scale){
 const roll=-.64,tx=-.015*Math.sin(roll),ty=.015*Math.cos(roll),tz=-.91;
 const clamp=v=>Math.max(-1,Math.min(1,v));
 const yaw=Math.atan2(tx,-tz)-Math.asin(clamp((-x/scale-.025)/Math.hypot(tx,tz)));
 const depth=-tx*Math.sin(yaw)+tz*Math.cos(yaw);
 const pitch=Math.asin(clamp((-y/scale-.30)/Math.hypot(ty,depth)))-Math.atan2(ty,-depth);
 return {contactYaw:yaw+.32,contactPitch:pitch-.92,preserveContact:true};
}
