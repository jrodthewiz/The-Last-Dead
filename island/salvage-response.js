// Presentation seconds, not combat delays. Every response settles by the
// existing weapon interval so a legal next swing never cuts off its return.
export const SALVAGE_RESPONSE=Object.freeze({
 bat:Object.freeze({hold:.040,follow:1,rebound:0,swingLead:.12,swingRate:.92,cue:'bat-contact',wallCue:'bat-contact',gain:.26,rate:.88}),
 sword:Object.freeze({hold:.022,follow:.80,rebound:0,wallFollow:.30,wallRetreat:.32,swingLead:.085,swingRate:1.20,cue:'blade-contact',wallCue:'pipe-contact',gain:.18,rate:1.10}),
 hammer:Object.freeze({hold:.056,follow:.55,rebound:.085,swingLead:.110,swingRate:.78,cue:'hammer-contact',wallCue:'hammer-contact',gain:.32,rate:.78}),
 pipe:Object.freeze({hold:.030,follow:.60,rebound:.095,swingLead:.085,swingRate:1.10,cue:'pipe-contact',wallCue:'pipe-contact',gain:.16,rate:.94}),
});

export function salvageMotionAge(id,age,contact,duration,hit='',impactFrame=false){
 const response=SALVAGE_RESPONSE[id];
 if(!response||!hit)return age;
 if(impactFrame)return contact;
 if(age<contact)return age;
 const hold=response.hold*(hit==='wall'?1.25:1),span=duration-contact;
 const p=Math.max(0,Math.min(1,(age-contact-hold)/(span-hold)));
 // Ease out of resistance, then repay that time inside the original action.
 // Endpoints remain exact; neither the simulation nor the camera is paused.
 return contact+span*p*p*(2-p);
}
