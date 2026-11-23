import * as T from '../vendor/three.module.js';

// Crisp low-poly geometry with a restrained film finish. The scene stays HDR
// until this one output pass; the HUD is never blurred or colour-graded.
export function createPresentation(renderer){
 const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true,samples:Math.min(4,renderer.capabilities.maxSamples)});
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
 const bloomA=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:false});
 const bloomB=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:false});
 const passScene=new T.Scene(),passCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
 const passQuad=new T.Mesh(new T.PlaneGeometry(2,2),null);passScene.add(passQuad);
 const brightMat=new T.ShaderMaterial({uniforms:{picture:{value:null},dir:{value:new T.Vector2()},threshold:{value:1.48},knee:{value:.30}},depthTest:false,depthWrite:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`uniform sampler2D picture;uniform float threshold;uniform float knee;varying vec2 vUv;void main(){vec3 c=max(texture2D(picture,vUv).rgb,vec3(0.));float l=dot(c,vec3(.2126,.7152,.0722));gl_FragColor=vec4(c*smoothstep(threshold-knee,threshold+knee,l),1.);}`});
 const blurMat=new T.ShaderMaterial({uniforms:{picture:{value:null},dir:{value:new T.Vector2()}},depthTest:false,depthWrite:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`uniform sampler2D picture;uniform vec2 dir;varying vec2 vUv;void main(){vec3 c=vec3(0.);float w=0.;for(int i=-4;i<=4;i++){float k=exp(-float(i*i)/10.);c+=texture2D(picture,vUv+dir*float(i)).rgb*k;w+=k;}gl_FragColor=vec4(c/max(w,.001),1.);}`});
 const dir=new T.Vector3();
 const uniforms={picture:{value:target.texture},texel:{value:new T.Vector2(1,1)},strength:{value:0},glow:{value:0},finish:{value:1},horizonY:{value:.5},reflEnable:{value:1},wetRefl:{value:1},bloomTex:{value:bloomA.texture},bloomStrength:{value:.13},raw:{value:0},sat:{value:1.05},contrast:{value:1.08},warm:{value:0},lift:{value:1}};
 const material=new T.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`uniform sampler2D picture;uniform vec2 texel;uniform float strength;uniform float glow;uniform float finish;uniform float horizonY;uniform float reflEnable;uniform float wetRefl;uniform sampler2D bloomTex;uniform float bloomStrength;uniform float raw;uniform float sat;uniform float contrast;uniform float warm;uniform float lift;varying vec2 vUv;
   float bayer(vec2 p){vec2 q=mod(floor(p),4.);float a=mod(q.x,2.)*2.+mod(q.y,2.);float b=floor(q.x/2.)*2.+floor(q.y/2.);return (mod(a*3.,4.)*4.+mod(b*3.,4.)+.5)/16.;}
   void main(){
    vec4 srcSample=texture2D(picture,vUv);
    vec3 source=srcSample.rgb+texture2D(bloomTex,vUv).rgb*bloomStrength;
    if(raw>.5){gl_FragColor=vec4(srcSample.rgb,1.);return;}
    float wetMask=clamp((.80-srcSample.a)/.40,0.,1.);
    if(reflEnable>.5&&finish>.5&&wetMask>.02&&srcSample.a<.855&&vUv.y<horizonY){
     float below=max(horizonY-vUv.y,.004);
     float waterMask=1.-smoothstep(.44,.54,srcSample.a);
     float ripStreet=(sin(vUv.x*115.+below*140.)*.55+sin(vUv.x*240.-below*210.)*.45)*smoothstep(.02,.15,below)*.0014;
     float ripWater=(sin(vUv.x*65.+below*280.)*.55+sin(vUv.x*170.-below*420.)*.45)*smoothstep(.008,.10,below)*.0055;
     float rip=mix(ripStreet,ripWater,waterMask);
     float probeX=clamp(vUv.x+rip*.35,texel.x,1.-texel.x);
     float maxSpan=max(.008,min(horizonY+.03,vUv.y+.26)-vUv.y);
     float loY=vUv.y,hiY=horizonY;
     bool hit=false;
     float y1=min(vUv.y+maxSpan*.14,.985);
     if(texture2D(picture,vec2(probeX,y1)).a>=.945){
      hit=true;hiY=y1;
     }else{
      float y2=min(vUv.y+maxSpan*.44,.985);
      if(texture2D(picture,vec2(probeX,y2)).a>=.945){
       hit=true;loY=y1;hiY=y2;
      }else{
       float y3=min(vUv.y+maxSpan,.985);
       if(texture2D(picture,vec2(probeX,y3)).a>=.945){hit=true;loY=y2;hiY=y3;}
      }
     }
     if(hit){
      float midY=.5*(loY+hiY);
      hiY=texture2D(picture,vec2(probeX,midY)).a>=.945?midY:hiY;
     }
     float contactDist=max(hiY-vUv.y,0.);
     float reflY=2.*hiY-vUv.y;
     float spread=mix(.005,.028,clamp(contactDist*3.5,0.,1.))+waterMask*.022;
     vec3 skyFall=vec3(.333,.442,.487)*.98;
     vec2 suv0=vec2(clamp(vUv.x+rip,texel.x,1.-texel.x),clamp(reflY,texel.y,1.-texel.y));
     vec2 suv1=vec2(clamp(vUv.x+rip*.7+.001,texel.x,1.-texel.x),clamp(reflY+spread,texel.y,1.-texel.y));
     vec2 suv2=vec2(clamp(vUv.x+rip*.35-.0016,texel.x,1.-texel.x),clamp(reflY+spread*1.7,texel.y,1.-texel.y));
     vec4 t0=texture2D(picture,suv0),t1=texture2D(picture,suv1),t2=texture2D(picture,suv2);
     vec3 c0=((t0.a<.855||t0.a>.945)&&reflY<.96)?t0.rgb:skyFall;
     vec3 c1=((t1.a<.855||t1.a>.945)&&reflY+spread<.96)?t1.rgb:skyFall;
     vec3 c2=((t2.a<.855||t2.a>.945)&&reflY+spread*1.7<.96)?t2.rgb:skyFall;
     float w0=.5*(1.+smoothstep(.60,1.5,dot(c0,vec3(.2126,.7152,.0722)))*2.0);
     float w1=.3*(1.+smoothstep(.60,1.5,dot(c1,vec3(.2126,.7152,.0722)))*2.0);
     float w2=.2*(1.+smoothstep(.60,1.5,dot(c2,vec3(.2126,.7152,.0722)))*2.0);
     vec3 reflCol=(c0*w0+c1*w1+c2*w2)/max(w0+w1+w2,.001);
     float edgeFade=1.-smoothstep(.82,.96,reflY);
     reflCol=mix(skyFall,reflCol,edgeFade);
     vec3 rawRefl=reflCol;
     float reflLum=dot(reflCol,vec3(.2126,.7152,.0722));
     reflCol=mix(skyFall*.88,reflCol,smoothstep(.02,.26,reflLum)*.86);
     reflCol*=vec3(.90,.95,1.00);
     float fresnel=pow(clamp(1.-below*2.0,0.,1.),1.50);
     float edgeAA=smoothstep(.855,.805,srcSample.a);
     float streetMask=clamp((wetMask-.18)/.82,0.,1.);
     float reflMix=streetMask*mix(.16,.58,fresnel)*edgeAA*wetRefl;
     float waterMix=waterMask*mix(.08,.28,fresnel)*max(wetRefl,.35);
     source=mix(source,mix(reflCol,rawRefl,waterMask*.65),max(reflMix,waterMix));
    }
    gl_FragColor=vec4(source,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    vec3 c=gl_FragColor.rgb;
    float l=dot(c,vec3(.2126,.7152,.0722));
    vec3 graded=mix(vec3(l),c,sat);
    graded+=(1.-smoothstep(.08,.52,l))*vec3(-.004,.005,.009)*lift;
    graded+=smoothstep(.54,.95,l)*vec3(.006,.008,.010)*(1.+warm*.45);
    graded+=smoothstep(.55,.95,l)*vec3(.010,.006,.001)*warm;
    graded=mix(graded,smoothstep(0.,1.,clamp(graded,0.,1.)),.10);
    graded=(graded-.5)*contrast+.5;
    graded+=.003;
    float edge=smoothstep(.25,.74,length(vUv-.5));
    graded*=1.-edge*.085;
    float grain=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453)-.5;
    graded+=grain*.0020;
    c=mix(c,graded,finish);
    vec3 quantized=floor(clamp(c,0.,1.)*63.+bayer(gl_FragCoord.xy))/63.;
    gl_FragColor=vec4(clamp(mix(c,quantized,strength*finish),0.,1.),1.);
   }`});
 scene.add(new T.Mesh(new T.PlaneGeometry(2,2),material));renderer.info.autoReset=false;
 return {enabled:true,target,uniforms,
  resize(quality='balanced'){const size=renderer.getDrawingBufferSize(new T.Vector2());target.setSize(size.x,size.y);const bw=Math.max(1,Math.floor(size.x/4)),bh=Math.max(1,Math.floor(size.y/4));bloomA.setSize(bw,bh);bloomB.setSize(bw,bh);uniforms.texel.value.set(1/Math.max(1,size.x),1/Math.max(1,size.y));uniforms.strength.value=quality==='retro'?.05:0;},
  render(world,view){renderer.info.reset();if(!this.enabled){renderer.setRenderTarget(null);renderer.render(world,view);return;}
   if(view&&view.isPerspectiveCamera&&view.far>=50){
    view.getWorldDirection(dir);
    const tanHalf=Math.tan(T.MathUtils.degToRad(view.fov*.5));
    const hLen=Math.hypot(dir.x,dir.z);
    const hy=hLen>.01?.5-.5*(dir.y/hLen)/Math.max(.05,tanHalf):(dir.y>=0?-1:2);
    uniforms.horizonY.value=T.MathUtils.clamp(hy,-.5,1.5);
    uniforms.reflEnable.value=1;
   }else{uniforms.reflEnable.value=0;uniforms.horizonY.value=.5;}
   renderer.setRenderTarget(target);renderer.render(world,view);const bw=Math.max(1,bloomA.width),bh=Math.max(1,bloomA.height);passQuad.material=brightMat;brightMat.uniforms.picture.value=target.texture;renderer.setRenderTarget(bloomA);renderer.render(passScene,passCamera);passQuad.material=blurMat;blurMat.uniforms.picture.value=bloomA.texture;blurMat.uniforms.dir.value.set(1/bw,0);renderer.setRenderTarget(bloomB);renderer.render(passScene,passCamera);blurMat.uniforms.picture.value=bloomB.texture;blurMat.uniforms.dir.value.set(0,1/bh);renderer.setRenderTarget(bloomA);renderer.render(passScene,passCamera);renderer.setRenderTarget(null);renderer.render(scene,camera);
  }
 };
}
