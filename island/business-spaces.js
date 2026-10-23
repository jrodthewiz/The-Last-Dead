export function businessRoomLayout(b,id){
 const back=-b.d/2,front=b.d/2,left=-Math.min(5.2,b.w/2-3.4),right=-left;
 if(id.id==='cafe')return {service:{x:left,z:front-10},prep:{x:left,z:front-13},banquettes:[{x:b.w/2-1.1,z:back+6.5},{x:b.w/2-1.1,z:front-7.8}],communal:{x:right,z:0},reading:{x:left,z:back+7}};
 if(id.id==='office')return {ticket:{x:left+.7,z:front-10.5,q:-1},staffOuter:left-3.35,staffEntry:{x:left-2.75,z:front-6.2},staffApproach:{x:left-2.75,z:front-10.5},staffWork:{x:left-.75,z:front-10.5,q:1},waiting:[{x:right+1,z:front-8,q:-1},{x:right+1,z:0,q:-1},{x:right+1,z:back+7,q:-1}]};
 return null;
}
