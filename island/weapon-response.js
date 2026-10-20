// Camera-local presentation only. The combat interval, camera ray and damage
// stay authoritative in game.js. Each gun has its own drive and settling mass.
export const FIRE_RESPONSE=Object.freeze({
 carbine:{rise:.012,end:.23,travel:.057,pitch:.062,roll:-.009,ads:.032},
 ossuary:{rise:.008,end:.18,travel:.044,pitch:.095,roll:-.020,ads:.040},
 breach:{rise:.012,end:.29,travel:.105,pitch:.105,roll:.018,ads:.052},
 arc:{rise:.018,end:.39,travel:.055,pitch:.040,roll:-.008,ads:.023},
 reliquary:{rise:.020,end:.42,travel:.110,pitch:.070,roll:.014,ads:.035},
 carrion:{rise:.006,end:.085,travel:.033,pitch:.035,roll:-.006,ads:.020},
 mourning:{rise:.014,end:.34,travel:.080,pitch:.080,roll:-.010,ads:.039},
});
export function weaponResponse(id,age,aim=0,motion=true,out={}){
 const p=FIRE_RESPONSE[id],t=Math.max(0,age);out.kick=out.pulse=out.z=out.pitch=out.roll=out.sight=0;
 if(!p||t>=p.end)return out;
 const drive=t<p.rise?1-(1-t/p.rise)**2:(1-(t-p.rise)/(p.end-p.rise))**3;
 const settle=Math.sin(Math.PI*Math.max(0,(t-p.rise)/(p.end-p.rise)))**2*.065;
 out.kick=drive-settle;out.pulse=(1-t/p.end)**3;
 out.z=out.kick*p.travel;out.pitch=out.kick*p.pitch;out.roll=motion?out.kick*p.roll*(1-aim*.85):0;out.sight=out.kick*p.ads/.045;return out;
}
export const reloadWeight=p=>Math.sin(Math.PI*Math.max(0,Math.min(1,p)))**2;

// All draws finish within the existing .28–.30 s ready gates. Hands stay on
// their sockets while each tool's mass describes a small lift and inward arc.
const DRAW_RESPONSE={
 carbine:[.28,.24,.10,-.14,.09,.035],ossuary:[.24,.21,.08,-.12,-.12,.025],
 breach:[.28,.27,.12,-.18,-.14,.045],arc:[.28,.25,.10,-.13,.08,.035],
 reliquary:[.28,.29,.12,-.16,.10,.025],carrion:[.26,.24,.09,-.13,-.10,.035],
 mourning:[.28,.26,.11,-.16,.08,.03],bat:[.26,.24,.07,-.10,.12,.04],
 chainsaw:[.28,.27,.10,-.10,-.08,.025],sword:[.25,.23,.07,-.08,.11,.04],
 hammer:[.28,.27,.09,-.13,.10,.035],pipe:[.24,.22,.06,-.09,-.09,.035],
};
export function weaponDraw(id,age,motion=true,out={}){
 const d=DRAW_RESPONSE[id]||DRAW_RESPONSE.carbine,p=Math.max(0,Math.min(1,age/d[0])),weight=1-p*p*(3-2*p);
 out.x=motion&&p<1?Math.sin(p*Math.PI)*d[5]:0;out.y=-weight*(motion?d[1]:.14);
 out.z=motion?weight*d[2]:0;out.pitch=motion?weight*d[3]:0;out.roll=motion?weight*d[4]:0;return out;
}
