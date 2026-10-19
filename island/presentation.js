import * as T from '../vendor/three.module.js';

// Crisp low-poly geometry with a restrained film finish. The scene stays HDR
// until this one output pass; the HUD is never blurred or colour-graded.
export function createPresentation(renderer){
 const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true,samples:Math.min(2,renderer.capabilities.maxSamples)});
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
 const uniforms={picture:{value:target.texture},texel:{value:new T.Vector2(1,1)},strength:{value:.10},glow:{value:.12},finish:{value:1}};
 const material=new T.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`uniform sampler2D picture;uniform vec2 texel;uniform float strength;uniform float glow;uniform float finish;varying vec2 vUv;
   float bayer(vec2 p){vec2 q=mod(floor(p),4.);float a=mod(q.x,2.)*2.+mod(q.y,2.);float b=floor(q.x/2.)*2.+floor(q.y/2.);return (mod(a*3.,4.)*4.+mod(b*3.,4.)+.5)/16.;}
   vec3 highlight(vec2 offset){vec3 c=texture2D(picture,clamp(vUv+offset,texel*.5,1.-texel*.5)).rgb;float l=dot(c,vec3(.2126,.7152,.0722));return c*smoothstep(.9,2.1,l);}
   void main(){
    vec3 source=texture2D(picture,vUv).rgb;
    // Broad, low-gain halation comes only from bright light. Dark silhouettes,
    // signs and weapon details keep their sharp source sample.
    vec2 r=texel*2.;
    vec3 halo=(highlight(vec2(r.x,0.))+highlight(vec2(-r.x,0.))+highlight(vec2(0.,r.y))+highlight(vec2(0.,-r.y)))*.1875;
    r=texel*4.;
    halo+=(highlight(r)+highlight(-r)+highlight(vec2(r.x,-r.y))+highlight(vec2(-r.x,r.y)))*.0625;
    gl_FragColor=vec4(source+halo*glow*finish,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    vec3 c=gl_FragColor.rgb;
    float l=dot(c,vec3(.2126,.7152,.0722));
    vec3 graded=mix(vec3(l),c,1.035);
    graded+=(1.-smoothstep(.08,.52,l))*vec3(-.007,.003,.010);
    graded+=smoothstep(.42,.9,l)*vec3(.020,.009,-.008);
    graded=(graded-.5)*1.055+.5;
    float edge=smoothstep(.25,.72,length(vUv-.5));
    graded*=1.-edge*.065;
    // Fine, stationary grain: no crawling noise or thick scanline overlay.
    float grain=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453)-.5;
    graded+=grain*.0022;
    c=mix(c,graded,finish);
    vec3 quantized=floor(clamp(c,0.,1.)*63.+bayer(gl_FragCoord.xy))/63.;
    gl_FragColor.rgb=clamp(mix(c,quantized,strength*finish),0.,1.);
   }`});
 scene.add(new T.Mesh(new T.PlaneGeometry(2,2),material));renderer.info.autoReset=false;
 return {enabled:true,target,uniforms,
  resize(quality='balanced'){const size=renderer.getDrawingBufferSize(new T.Vector2());target.setSize(size.x,size.y);uniforms.texel.value.set(1/Math.max(1,size.x),1/Math.max(1,size.y));uniforms.strength.value=quality==='retro'?.16:quality==='native'?.06:.10;},
  render(world,view){renderer.info.reset();if(!this.enabled){renderer.setRenderTarget(null);renderer.render(world,view);return;}
   renderer.setRenderTarget(target);renderer.render(world,view);renderer.setRenderTarget(null);renderer.render(scene,camera);
  }
 };
}
