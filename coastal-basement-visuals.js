// A service stair headhouse identifies the same portal used by gameplay.
// Surface geometry stays west of the approach; the original dungeon is loaded
// through the door, with its own enclosed geometry and collision authority.
export function buildCoastalBasementEntrance(world) {
 const p=world.course.basementPortal;if(!p)return;
 const x=p.x*4,z=p.y*4;
 const box=(dx,y,dz,w,h,d,mat,name)=>world.box(x-dx,y,z+dz,w,h,d,mat,name);
 box(2,.10,0,4.4,.20,3.2,'concrete','BasementStairFoundation');
 for(const side of [-1,1])box(2,1.35,side*1.4,4.4,2.7,.25,'coastStone','BasementStairSideWall');
 box(4.1,1.35,0,.25,2.7,3,'coastStone','BasementStairBackWall');
 box(2,2.83,0,4.7,.30,3.55,'rust','BasementStairWeatherRoof');
 // Raised sloped weather hood breaks the headhouse silhouette.
 box(2,3.03,0,4.4,.12,2.9,'dark','BasementStairRoofInset');
 box(.76,1.17,0,.14,2.34,2.35,'dark','BasementStairDarkDoor');
 for(const side of [-1,1])box(.60,1.28,side*1.20,.32,2.56,.18,'rust','BasementStairDoorJamb');
 box(.60,2.47,0,.32,.20,2.57,'rust','BasementStairDoorLintel');
 box(.52,.06,0,.55,.12,2.50,'coastWhite','BasementStairThreshold');
 box(.64,1.16,-.77,.10,.32,.08,'signal','BasementStairDoorHandle');
 // Paired safety stripes frame the ground-level interaction position.
 for(const side of [-1,1])for(let i=0;i<5;i++)box(-.50+i*.28,.025,side*1.10,.17,.02,.24,i%2?'dark':'signal','BasementStairSafetyMark');
 world.sign('CUSTOMS / BASEMENT STAIRS',x-.35,3.50,z,Math.PI/2,4.4);
 world.diagnostics.basement={portal:[x,z],destination:'existing authored dungeon',interaction:'E / service stair door'};
}
