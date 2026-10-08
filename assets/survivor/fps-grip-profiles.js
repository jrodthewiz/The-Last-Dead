// Explicit authored hold families. Index order matches FIRST_PERSON_HOLD_POSES.
// A new weapon selects a compatible family and still needs a Blender contact
// pose against its actual hardware; a socket at the axis is not a palm pose.
const cone={pistol:35,'fore-end':30,vertical:35,shaft:45,handle:40};
export const FPS_GRIP_PROFILES=Object.freeze([
 ['ossuary','pistol',null],['breach','pistol','fore-end'],
 ['arc','pistol','vertical'],['reliquary','pistol','vertical'],
 ['carrion','pistol','fore-end'],['mourning','pistol','vertical'],
 ['bat','shaft','shaft'],['chainsaw','pistol','handle'],
].map(([name,right,left])=>Object.freeze({name,right:Object.freeze({kind:right,wristConeDegrees:cone[right]}),left:left?Object.freeze({kind:left,wristConeDegrees:cone[left]}):null})));
