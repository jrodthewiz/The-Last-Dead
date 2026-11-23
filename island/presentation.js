import * as T from '../vendor/three.module.js';

// Crisp low-poly geometry with a restrained film finish. The scene stays HDR
// until this one output pass; the HUD is never blurred or colour-graded.
export function createPresentation(renderer){
 const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true,samples:Math.min(2,renderer.capabilities.maxSamples)});
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
 const dir=new T.Vector3();
 const uniforms={picture:{value:target.texture},texel:{value:new T.Vector2(1,1)},strength:{value:.10},glow:{value:.16},finish:{value:1},horizonY:{value:.5},reflEnable:{value:1},wetRefl:{value:1}};
 const material=new T.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`uniform sampler2D picture;uniform vec2 texel;uniform float strength;uniform float glow;uniform float finish;uniform float horizonY;uniform float reflEnable;uniform float wetRefl;varying vec2 vUv;
   float bayer(vec2 p){vec2 q=mod(floor(p),4.);float a=mod(q.x,2.)*2.+mod(q.y,2.);float b=floor(q.x/2.)*2.+floor(q.y/2.);return (mod(a*3.,4.)*4.+mod(b*3.,4.)+.5)/16.;}
   vec3 highlight(vec2 offset){vec3 c=texture2D(picture,clamp(vUv+offset,texel*.5,1.-texel*.5)).rgb;float l=dot(c,vec3(.2126,.7152,.0722));return c*smoothstep(.82,1.9,l);}
   void main(){
    vec4 srcSample=texture2D(picture,vUv);
    vec3 source=srcSample.rgb;
    float wetMask=clamp((.80-srcSample.a)/.40,0.,1.);
    if(reflEnable>.5&&finish>.5&&wetMask>.02&&srcSample.a<.855&&vUv.y<horizonY){
     float below=max(horizonY-vUv.y,.004);
     float rip=(sin(vUv.x*115.+below*140.)*.55+sin(vUv.x*240.-below*210.)*.45)*smoothstep(.02,.15,below)*.0011;
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
     float spread=mix(.009,.045,clamp(contactDist*3.5,0.,1.));
     vec3 skyFall=vec3(.333,.442,.487)*.98;
     vec2 suv0=vec2(clamp(vUv.x+rip,texel.x,1.-texel.x),clamp(reflY,texel.y,1.-texel.y));
     vec2 suv1=vec2(clamp(vUv.x+rip*.7+.001,texel.x,1.-texel.x),clamp(reflY+spread,texel.y,1.-texel.y));
     vec2 suv2=vec2(clamp(vUv.x+rip*.35-.0016,texel.x,1.-texel.x),clamp(reflY+spread*1.7,texel.y,1.-texel.y));
     vec4 t0=texture2D(picture,suv0),t1=texture2D(picture,suv1),t2=texture2D(picture,suv2);
     vec3 c0=((t0.a<.855||t0.a>.945)&&reflY<.96)?t0.rgb:skyFall;
     vec3 c1=((t1.a<.855||t1.a>.945)&&reflY+spread<.96)?t1.rgb:skyFall;
     vec3 c2=((t2.a<.855||t2.a>.945)&&reflY+spread*1.7<.96)?t2.rgb:skyFall;
     float w0=.5*(1.+smoothstep(.65,1.6,dot(c0,vec3(.2126,.7152,.0722)))*1.8);
     float w1=.3*(1.+smoothstep(.65,1.6,dot(c1,vec3(.2126,.7152,.0722)))*1.8);
     float w2=.2*(1.+smoothstep(.65,1.6,dot(c2,vec3(.2126,.7152,.0722)))*1.8);
     vec3 reflCol=(c0*w0+c1*w1+c2*w2)/max(w0+w1+w2,.001);
     float edgeFade=1.-smoothstep(.82,.96,reflY);
     reflCol=mix(skyFall,reflCol,edgeFade);
     // Keep dark building/tree silhouettes out of the street; wet asphalt mostly
     // catches sky and warm window light, not a perfect inverted world.
     float reflLum=dot(reflCol,vec3(.2126,.7152,.0722));
     reflCol=mix(skyFall,reflCol,smoothstep(.015,.34,reflLum)*.82);
     reflCol*=vec3(.88,.93,.98);
     float fresnel=pow(clamp(1.-below*2.1,0.,1.),1.55);
     float edgeAA=smoothstep(.855,.805,srcSample.a);
     float reflMix=wetMask*mix(.01,.10,fresnel)*edgeAA*wetRefl;
     source=mix(source,reflCol,reflMix);
    }
    // Broad, low-gain halation comes only from bright light. Dark silhouettes,
    // signs and weapon details keep their sharp source sample.
    vec2 r=texel*2.5;
    vec3 halo=(highlight(r)+highlight(-r)+highlight(vec2(r.x,-r.y))+highlight(vec2(-r.x,r.y)))*.25;
    gl_FragColor=vec4(source+halo*glow*finish,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    vec3 c=gl_FragColor.rgb;
    float l=dot(c,vec3(.2126,.7152,.0722));
    vec3 graded=mix(vec3(l),c,1.04);
    // Overcast Atlantic & Wet Steel grade: cool slate shadows, crisp neutral-cool
    // clouds and fog, preserving fiery amber window glow from HDR emission.
    graded+=(1.-smoothstep(.08,.52,l))*vec3(-.004,.005,.009);
    graded+=smoothstep(.54,.95,l)*vec3(.006,.008,.010);
    graded=mix(graded,smoothstep(0.,1.,clamp(graded,0.,1.)),.10);
    graded=(graded-.5)*1.09+.5;
    graded+=.003;
    float edge=smoothstep(.25,.74,length(vUv-.5));
    graded*=1.-edge*.085;
    // Fine, stationary grain: no crawling noise or thick scanline overlay.
    float grain=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453)-.5;
    graded+=grain*.0026;
    c=mix(c,graded,finish);
    vec3 quantized=floor(clamp(c,0.,1.)*63.+bayer(gl_FragCoord.xy))/63.;
    gl_FragColor=vec4(clamp(mix(c,quantized,strength*finish),0.,1.),1.);
   }`});
 scene.add(new T.Mesh(new T.PlaneGeometry(2,2),material));renderer.info.autoReset=false;
 return {enabled:true,target,uniforms,
  resize(quality='balanced'){const size=renderer.getDrawingBufferSize(new T.Vector2());target.setSize(size.x,size.y);uniforms.texel.value.set(1/Math.max(1,size.x),1/Math.max(1,size.y));uniforms.strength.value=quality==='retro'?.16:quality==='native'?.06:.10;},
  render(world,view){renderer.info.reset();if(!this.enabled){renderer.setRenderTarget(null);renderer.render(world,view);return;}
   if(view&&view.isPerspectiveCamera&&view.far>=50){
    view.getWorldDirection(dir);
    const tanHalf=Math.tan(T.MathUtils.degToRad(view.fov*.5));
    const hLen=Math.hypot(dir.x,dir.z);
    const hy=hLen>.01?.5-.5*(dir.y/hLen)/Math.max(.05,tanHalf):(dir.y>=0?-1:2);
    uniforms.horizonY.value=T.MathUtils.clamp(hy,-.5,1.5);
    uniforms.reflEnable.value=1;
   }else{uniforms.reflEnable.value=0;uniforms.horizonY.value=.5;}
   renderer.setRenderTarget(target);renderer.render(world,view);renderer.setRenderTarget(null);renderer.render(scene,camera);
  }
 };
}
