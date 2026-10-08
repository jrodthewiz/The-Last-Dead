// Compare lossless browser captures without an additional image dependency.
export async function compareCaptures(page,a,b){
 return page.evaluate(async urls=>{
  const images=await Promise.all(urls.map(url=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=url;})));
  const w=images[0].width,h=images[0].height;if(images.some(im=>im.width!==w||im.height!==h))throw new Error('Capture dimensions differ');
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const data=images.map(im=>{ctx.clearRect(0,0,w,h);ctx.drawImage(im,0,0);return ctx.getImageData(0,0,w,h).data;});
  let sum=0,changed=0;for(let i=0;i<data[0].length;i+=4){let d=0;for(let c=0;c<3;c++)d+=Math.abs(data[0][i+c]-data[1][i+c]);sum+=d;if(d/765>.12)changed++;}
  return {meanAbsoluteRGB:sum/(w*h*765),fractionAbove12Percent:changed/(w*h),width:w,height:h};
 },[a,b].map(buffer=>'data:image/png;base64,'+buffer.toString('base64')));
}
