import * as T from '../vendor/three.module.js';

// Crisp low-poly geometry with a restrained film finish. The scene stays HDR
// until this one output pass; the HUD is never blurred or colour-graded.
export function createPresentation(renderer){
 const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true,samples:Math.min(4,renderer.capabilities.maxSamples)});
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
 const bloomA=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:false});
 const bloomB=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:false});
 const paintTarget=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:false});
 const paintMat=new T.ShaderMaterial({uniforms:{tDiffuse:{value:null},uTexel:{value:new T.Vector2(1,1)},uAmount:{value:.90},uRadius:{value:4.0}},depthTest:false,depthWrite:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`uniform sampler2D tDiffuse;uniform vec2 uTexel;uniform float uAmount,uRadius;varying vec2 vUv;
   float hash(vec2 p){p=fract(p*vec2(443.897,441.423));p+=dot(p,p.yx+19.19);return fract((p.x+p.y)*p.x);}
   vec3 sane(vec3 c){return mix(min(c,vec3(64.)),vec3(0.),isnan(c));}
   vec3 soft(vec3 c){return c/(1.+max(max(c.r,c.g),c.b));}
   void main(){
    vec4 t0=texture2D(tDiffuse,vUv);vec3 c0=sane(t0.rgb);float peak=max(max(c0.r,c0.g),c0.b);
    float water=1.-smoothstep(.91,.955,t0.a);                                  // keep the water/very wet pixels crisp
    float amount=uAmount*(1.-water)*(1.-smoothstep(1.1,2.2,peak))*smoothstep(.40,.55,vUv.y);
    if(amount<.01){gl_FragColor=vec4(c0,1.);return;}
    const vec2 WEDGE[8]=vec2[8](vec2(1.,0.),vec2(.7071068,.7071068),vec2(0.,1.),vec2(-.7071068,.7071068),vec2(-1.,0.),vec2(-.7071068,-.7071068),vec2(0.,-1.),vec2(.7071068,-.7071068));
    float jitter=hash(vUv*917.)*.785;mat2 turn=mat2(cos(jitter),sin(jitter),-sin(jitter),cos(jitter));
    vec2 reach=uRadius*uTexel/3.;vec3 acc=vec3(0.);float wsum=0.;float elo=1e3,ehi=-1e3;
    vec3 s0=soft(c0);
    for(int k=0;k<8;k++){
     vec3 mean=c0*.5,ms=s0*.5,sq=s0*s0*.5;float n=.5;vec2 d=(turn*WEDGE[k])*reach;
     for(int r=1;r<=3;r++){vec3 c=sane(texture2D(tDiffuse,vUv+d*float(r)).rgb),l=soft(c);mean+=c;ms+=l;sq+=l*l;n+=1.;}
     mean/=n;ms/=n;sq/=n;float var=dot(max(sq-ms*ms,vec3(0.)),vec3(1.));float w=1./(1.+pow(var*2200.,4.));acc+=mean*w;wsum+=w;float lm=dot(mean,vec3(.2126,.7152,.0722));elo=min(elo,lm);ehi=max(ehi,lm);
    }
    acc+=c0*1e-3;wsum+=1e-3;amount*=1.-smoothstep(.055,.16,ehi-elo);
    vec3 c=mix(c0,acc/wsum,amount);
    vec2 pp=vUv*vec2(1.777,1.)*720.;
    float tooth=(hash(floor(pp*.75))-.5)*.7+(hash(floor(pp*.22))-.5)*.9;
    c+=tooth*.0045;
    gl_FragColor=vec4(c,1.);
   }`});
 const passScene=new T.Scene(),passCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
 const passQuad=new T.Mesh(new T.PlaneGeometry(2,2),null);passScene.add(passQuad);
 const brightMat=new T.ShaderMaterial({uniforms:{picture:{value:null},dir:{value:new T.Vector2()},threshold:{value:1.18},knee:{value:.30}},depthTest:false,depthWrite:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`uniform sampler2D picture;uniform float threshold;uniform float knee;varying vec2 vUv;void main(){vec3 c=texture2D(picture,vUv).rgb;if(any(isnan(c))||any(isinf(c)))c=vec3(0.);c=clamp(c,vec3(0.),vec3(48.));float l=dot(c,vec3(.2126,.7152,.0722));gl_FragColor=vec4(c*smoothstep(threshold-knee,threshold+knee,l),1.);}`});
 const blurMat=new T.ShaderMaterial({uniforms:{picture:{value:null},dir:{value:new T.Vector2()}},depthTest:false,depthWrite:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`uniform sampler2D picture;uniform vec2 dir;varying vec2 vUv;void main(){vec3 c=vec3(0.);float w=0.;for(int i=-6;i<=6;i++){float k=exp(-float(i*i)/14.);vec3 s=texture2D(picture,vUv+dir*float(i)).rgb;if(any(isnan(s))||any(isinf(s)))s=vec3(0.);c+=clamp(s,vec3(0.),vec3(32.))*k;w+=k;}gl_FragColor=vec4(c/max(w,.001),1.);}`});
 const uniforms={picture:{value:target.texture},texel:{value:new T.Vector2(1,1)},strength:{value:0},glow:{value:0},finish:{value:1},horizonY:{value:.5},reflEnable:{value:1},wetRefl:{value:1},bloomTex:{value:bloomA.texture},bloomStrength:{value:.22},raw:{value:0},sat:{value:1.07},contrast:{value:1.06},warm:{value:.12},lift:{value:1}};
 const material=new T.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`uniform sampler2D picture;uniform vec2 texel;uniform float strength;uniform float glow;uniform float finish;uniform float horizonY;uniform float reflEnable;uniform float wetRefl;uniform sampler2D bloomTex;uniform float bloomStrength;uniform float raw;uniform float sat;uniform float contrast;uniform float warm;uniform float lift;varying vec2 vUv;
   float bayer(vec2 p){vec2 q=mod(floor(p),4.);float a=mod(q.x,2.)*2.+mod(q.y,2.);float b=floor(q.x/2.)*2.+floor(q.y/2.);return (mod(a*3.,4.)*4.+mod(b*3.,4.)+.5)/16.;}
   void main(){
    vec4 srcSample=texture2D(picture,vUv);
    if(any(isnan(srcSample.rgb))||any(isinf(srcSample.rgb)))srcSample.rgb=vec3(0.);
    vec3 bloomSample=texture2D(bloomTex,vUv).rgb;
    if(any(isnan(bloomSample))||any(isinf(bloomSample)))bloomSample=vec3(0.);
    vec3 source=clamp(srcSample.rgb,vec3(0.),vec3(48.))+max(bloomSample,vec3(0.))*bloomStrength;
    if(raw>.5){gl_FragColor=vec4(srcSample.rgb,1.);return;}
    gl_FragColor=vec4(source,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    vec3 c=gl_FragColor.rgb;
    float l=dot(c,vec3(.2126,.7152,.0722));
    vec3 graded=mix(vec3(l),c,sat);
    graded+=(1.-smoothstep(.08,.52,l))*vec3(-.012,.016,.038)*lift;
    graded+=smoothstep(.54,.95,l)*vec3(.006,.008,.009)*(1.+warm*.45);
    graded+=smoothstep(.55,.95,l)*vec3(.010,.006,.001)*warm;
    graded=mix(graded,smoothstep(0.,1.,clamp(graded,0.,1.)),.10);
    graded=(graded-.5)*contrast+.5;
    graded+=.003;
    float edge=smoothstep(.24,.76,length(vUv-.5));
    graded*=1.-edge*.11;
    float grain=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453)-.5;
    graded+=grain*.0025;
    c=mix(c,graded,finish);
    vec3 quantized=floor(clamp(c,0.,1.)*63.+bayer(gl_FragCoord.xy))/63.;
    gl_FragColor=vec4(clamp(mix(c,quantized,strength*finish),0.,1.),1.);
   }`});
 scene.add(new T.Mesh(new T.PlaneGeometry(2,2),material));renderer.info.autoReset=false;
 return {enabled:true,target,uniforms,
  resize(quality='balanced'){const size=renderer.getDrawingBufferSize(new T.Vector2());target.setSize(size.x,size.y);paintTarget.setSize(size.x,size.y);paintMat.uniforms.uTexel.value.set(1/Math.max(1,size.x),1/Math.max(1,size.y));const bw=Math.max(1,Math.floor(size.x/4)),bh=Math.max(1,Math.floor(size.y/4));bloomA.setSize(bw,bh);bloomB.setSize(bw,bh);uniforms.texel.value.set(1/Math.max(1,size.x),1/Math.max(1,size.y));uniforms.strength.value=quality==='retro'?.05:0;},
  render(world,view){renderer.info.reset();if(!this.enabled){renderer.setRenderTarget(null);renderer.render(world,view);return;}
   renderer.setRenderTarget(target);renderer.render(world,view);
   const raw=uniforms.raw.value>.5;
   if(!raw){passQuad.material=paintMat;paintMat.uniforms.tDiffuse.value=target.texture;renderer.setRenderTarget(paintTarget);renderer.render(passScene,passCamera);}
   const pictureTexture=raw?target.texture:paintTarget.texture;uniforms.picture.value=pictureTexture;
   const bw=Math.max(1,bloomA.width),bh=Math.max(1,bloomA.height);passQuad.material=brightMat;brightMat.uniforms.picture.value=pictureTexture;renderer.setRenderTarget(bloomA);renderer.render(passScene,passCamera);passQuad.material=blurMat;for(let i=0;i<2;i++){blurMat.uniforms.picture.value=bloomA.texture;blurMat.uniforms.dir.value.set((1+i)/bw,0);renderer.setRenderTarget(bloomB);renderer.render(passScene,passCamera);blurMat.uniforms.picture.value=bloomB.texture;blurMat.uniforms.dir.value.set(0,(1+i)/bh);renderer.setRenderTarget(bloomA);renderer.render(passScene,passCamera);}renderer.setRenderTarget(null);renderer.render(scene,camera);
  }
 };
}
