import * as THREE from '../../vendor/three.module.js';

const SIZE=1024,SLOT=512,GUTTER=32,TILE=SLOT-GUTTER*2;
const address=(role,x,y)=>((y+GUTTER+(role>>1)*SLOT)*SIZE+x+GUTTER+(role%2)*SLOT);
const hash=(x,y,s=0)=>{let h=Math.imul(x^s,374761393)^Math.imul(y,668265263);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;};
// Authored procedural surface construction, not an image-generation service.
// One two-metre repeat contains actual layered needle/leaf/peat/mineral forms.
export function createCapeGroundAtlas(){
  const colour=new Uint8Array(SIZE*SIZE*4),heights=new Float32Array(SIZE*SIZE),roughness=new Float32Array(SIZE*SIZE);
  const bases=[[.37,.32,.24],[.45,.58,.37],[.62,.55,.41],[.49,.52,.49]];
  const pixel=(role,x,y,rgb,height,rough,opacity=1)=>{
    x=(Math.floor(x)%TILE+TILE)%TILE;y=(Math.floor(y)%TILE+TILE)%TILE;
    const index=address(role,x,y),off=index*4;
    for(let k=0;k<3;k++)colour[off+k]=Math.round(colour[off+k]*(1-opacity)+Math.max(0,Math.min(1,rgb[k]))*255*opacity);
    colour[off+3]=255;heights[index]=Math.max(heights[index],height);roughness[index]=roughness[index]*(1-opacity)+rough*opacity;
  };
  for(let role=0;role<4;role++)for(let y=0;y<TILE;y++)for(let x=0;x<TILE;x++){
    const grain=hash(x,y,60941),u=x/TILE*Math.PI*2,v=y/TILE*Math.PI*2,patch=Math.sin(u*3+Math.sin(v*2)*2)*Math.sin(v*2+Math.sin(u));
    const tint=.82+grain*.24+patch*.13;
    pixel(role,x,y,bases[role].map(v=>v*tint),grain*.0008,role===3?.90:.95);
  }
  const stroke=(role,x,y,angle,length,width,rgb,height,rough)=>{
    const c=Math.cos(angle),s=Math.sin(angle),extent=Math.ceil(length+width+2);
    for(let dy=-extent;dy<=extent;dy++)for(let dx=-extent;dx<=extent;dx++){
      const u=dx*c+dy*s,v=-dx*s+dy*c;
      if(Math.abs(u)>length/2||Math.abs(v)>width)continue;
      const taper=1-Math.abs(u)/(length*.55),alpha=Math.min(1,(width-Math.abs(v))*1.3)*Math.max(0,taper);
      pixel(role,x+dx,y+dy,rgb,height*alpha,rough,alpha);
    }
  };
  // Fine pine tissue settles in packed, irregular beds. The old 8–29cm
  // broad gold strokes looked like a hay mat, especially on the clear trail.
  for(let i=0;i<4800;i++){
    const x=hash(i,1,13)*TILE,y=hash(i,2,14)*TILE,a=.42+(hash(i,3,15)-.5)*1.6;
    const length=7+hash(i,4,16)*20,bed=.5+.5*Math.sin(x/TILE*Math.PI*4+Math.sin(y/TILE*Math.PI*2));
    if(hash(i,5,17)>.40+bed*.58)continue;
    stroke(0,x+.35,y+.5,a,length,.70,[.18,.16,.12],.0003,.97);
    stroke(0,x,y,a,length,.28,[.51,.43,.28],.0018,.96);
  }
  for(let i=0;i<190;i++){
    const x=hash(i,8,18)*TILE,y=hash(i,9,19)*TILE,a=hash(i,10,20)*6.283;
    stroke(0,x,y,a,9+hash(i,11)*18,.65,[.29,.25,.19],.004,.96);
  }
  for(let i=0;i<620;i++){
    const x=hash(i,20,22)*TILE,y=hash(i,21,23)*TILE,r=5+hash(i,22,24)*19;
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
      const d=(dx*dx+dy*dy)/(r*r);if(d>1)continue;
      const moss=hash(Math.round(x+dx),Math.round(y+dy),25),edge=Math.max(0,1-d);
      pixel(1,x+dx,y+dy,[.28+moss*.16,.47+moss*.28,.22+moss*.15],.009*edge,.94,edge*.9);
    }
  }
  for(let i=0;i<280;i++){
    const x=hash(i,30,32)*TILE,y=hash(i,31,33)*TILE,a=hash(i,32,34)*6.283,L=12+hash(i,33,35)*17,W=5+hash(i,34,36)*6;
    const c=Math.cos(a),s=Math.sin(a),extent=Math.ceil(L);
    for(let dy=-extent;dy<=extent;dy++)for(let dx=-extent;dx<=extent;dx++){
      const u=(dx*c+dy*s)/L,v=(-dx*s+dy*c)/W,d=u*u+v*v;
      if(d>1)continue;const crease=Math.abs(v)<.05?.38:1;
      pixel(2,x+dx,y+dy,[.82*crease,.69*crease,.36*crease],.005*(1-d),.92,Math.min(1,(1-d)*5));
    }
    stroke(2,x,y,a,L*1.8,.6,[.39,.33,.19],.005,.93);
  }
  for(let i=0;i<120;i++){
    const x=hash(i,40,42)*TILE,y=hash(i,41,43)*TILE,a=hash(i,42,44)*6.283;
    stroke(3,x,y,a,17+hash(i,43)*70,.85,[.32,.36,.34],.001,.81);
  }
  // Mineral aggregates also serve the compacted trail: washed grit, small
  // rounded stones and darker contact rims, rather than a blurred bare tint.
  for(let i=0;i<6200;i++){
    const x=hash(i,60,63)*TILE,y=hash(i,61,64)*TILE,r=.23+hash(i,62,65)*.67,tone=.31+hash(i,63,66)*.28;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      const d=(dx*dx+dy*dy*1.2)/(r*r);if(d>1)continue;
      pixel(3,x+dx,y+dy,[tone,tone*1.03,tone*.94],.0012*(1-d),.94,Math.min(1,(1-d)*2));
    }
  }
  for(let i=0;i<160;i++){
    const x=hash(i,51,53)*TILE,y=hash(i,52,54)*TILE,r=1.7+hash(i,53,55)*4.4,tone=.42+hash(i,54,56)*.4;
    for(let dy=-r-1;dy<=r+1;dy++)for(let dx=-r-1;dx<=r+1;dx++){
      const d=(dx*dx+dy*dy*1.3)/(r*r);if(d>1.3)continue;
      const rim=d>.88,fade=Math.min(1,(1.3-d)*3);
      pixel(3,x+dx,y+dy,rim?[.25,.28,.25]:[tone,tone*1.04,tone*.93],rim?.0006:.005*Math.max(0,1-d),rim?.96:.88,fade);
    }
  }
  const normalRough=new Uint8Array(SIZE*SIZE*4);
  for(let role=0;role<4;role++)for(let y=0;y<TILE;y++)for(let x=0;x<TILE;x++){
    const index=address(role,x,y),off=index*4;
    const at=(px,py)=>heights[address(role,(px+TILE)%TILE,(py+TILE)%TILE)];
    const gx=(at(x+1,y)-at(x-1,y))/(4/TILE),gy=(at(x,y+1)-at(x,y-1))/(4/TILE),n=new THREE.Vector3(-gx,-gy,1).normalize();
    normalRough[off]=Math.round((n.x*.5+.5)*255);normalRough[off+1]=Math.round((n.y*.5+.5)*255);normalRough[off+2]=Math.round((n.z*.5+.5)*255);normalRough[off+3]=Math.round(roughness[index]*255);
    for(let k=0;k<3;k++){
      const linear=colour[off+k]/255;
      colour[off+k]=Math.round((linear<=.0031308?linear*12.92:1.055*Math.pow(linear,1/2.4)-.055)*255);
    }
    colour[off+3]=Math.round(Math.min(1,heights[index]/.015)*255);
  }
  // Wrapped gutters contain the opposite edge of the SAME periodic role.
  // A 32px border remains valid through mip level five; sampling never crosses
  // into a different ecological role, including at integer world-UV repeats.
  for(let role=0;role<4;role++)for(let y=-GUTTER;y<TILE+GUTTER;y++)for(let x=-GUTTER;x<TILE+GUTTER;x++){
    if(x>=0&&x<TILE&&y>=0&&y<TILE)continue;
    const source=address(role,(x+TILE)%TILE,(y+TILE)%TILE)*4,target=address(role,x,y)*4;
    for(let channel=0;channel<4;channel++){colour[target+channel]=colour[source+channel];normalRough[target+channel]=normalRough[source+channel];}
  }
  const make=(pixels,name,srgb)=>{const map=new THREE.DataTexture(pixels,SIZE,SIZE);map.name=name;map.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;map.generateMipmaps=true;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;map.anisotropy=4;map.needsUpdate=true;return map;};
  const albedo=make(colour,'CapeForestSurfaceColour',true),normal=make(normalRough,'CapeForestSurfaceNormalRoughness',false);
  let disposed=false;
  return{albedo,normal,diagnostics:{textures:2,size:SIZE,interiorPixels:TILE,gutterPixels:GUTTER,tileMetres:2,roles:['pine-needle-peat','moss-peat','birch-leaf-duff','mineral-fissure'],needleLengthMetres:[7/TILE*2,27/TILE*2],needleWidthMetres:.56/TILE*2,gritDiameterMetres:[.46/TILE*2,1.8/TILE*2],largeAggregateCount:160,bytesWithMipmaps:Math.ceil(SIZE*SIZE*4*2*4/3),externalAssets:false},dispose(){if(disposed)return;disposed=true;albedo.dispose();normal.dispose();}};
}
