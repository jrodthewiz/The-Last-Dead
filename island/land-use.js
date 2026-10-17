export const ORCHARD={minX:-807,maxX:-717,minZ:99,maxZ:149};
export function orchardReserved(x,z,margin=0){const p=ORCHARD;return x>p.minX-margin&&x<p.maxX+margin&&z>p.minZ-margin&&z<p.maxZ+margin;}
export function orchardTrees(buildings,paths,terrain,reserved){const trees=[];for(let row=0;row<4;row++)for(let col=0;col<5;col++){const x=-796+col*17,z=106+row*12,y=terrain(x,z);if(reserved(paths,x,z,3)||buildings.some(b=>Math.abs(x-b.x)<b.w/2+5&&Math.abs(z-b.z)<b.d/2+5))continue;trees.push({x,z,y,scale:.57+(col+row)%3*.04,kind:'orchard',rotation:(col*1.7+row*.8)%6.28});}return trees;}
