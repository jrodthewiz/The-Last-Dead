// Grounded earth caught by the existing cape-forest-134 footing. World metres;
// pure height and material roles have no dependency on runtime terrain/scene.
export const CAPE_ROOT_FOOTING=Object.freeze({treeId:'cape-forest-134',x:335.97032237262505,z:387.3443513433454,upX:-.8100061155942428,upZ:.586421429263909,pathX:340});
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function capeRootFootingFields(x,z){
 const p=CAPE_ROOT_FOOTING,dx=x-p.x,dz=z-p.z;
 if(Math.abs(dx)>5||Math.abs(dz)>5)return {height:0,cover:0,litter:1,moss:0,mineral:0,shoulder:0,hollow:0};
 const along=dx*p.upX+dz*p.upZ,cross=-dx*p.upZ+dz*p.upX;
 // Unequal shoulders and an offset lee cut form a bearing, not a radial mound.
 const shoulder=1-smooth(.08,1,((along-.95)/2.1)**2+((cross+.15)/1.35)**2);
 const hollow=1-smooth(.10,1,((along+1.2)/1.25)**2+((cross-.4)/1.05)**2);
 const collar=1-smooth(.02,1,(along/.9)**2+(cross/.7)**2);
 // Padding includes the complete neighbouring 1m triangle support, so the
 // whole three-metre physical travel strip retains its original height.
 const path=smooth(2.5,3,Math.abs(x-p.pathX));
 const cover=(1-smooth(.30,1,((along+.05)/3.4)**2+(cross/2.2)**2))*path;
 const height=Math.max(-.25,Math.min(.55,.52*shoulder+.08*collar-.24*hollow))*path;
 // The camera-facing convex root flank exposes the mineral bearing. The old
 // crest was behind the stem; retain the earth form while revealing its face.
 const mineral=(1-smooth(.05,.95,((along-.10)/1.4)**2+((cross-.85)/.75)**2))*.66;
 // Moisture retained in the actual hollow spills into an unequal lower apron,
 // rather than ending as a tiny isolated spot. It never crosses the trail.
 const apron=1-smooth(.12,1,((along+1.4)/2.1)**2+((cross-.65)/1.6)**2);
 const moss=Math.max(hollow*.82,apron*.76)*(1-mineral),litter=1-moss-mineral;
 return {height,cover,litter,moss,mineral,shoulder,hollow};
}
