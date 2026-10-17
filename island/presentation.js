import * as T from '../vendor/three.module.js';

// The world is lit in linear space, then receives one exposure / tone-map pass.
// A restrained RGB555 ordered dither follows display conversion. HUD stays sharp.
export function createPresentation(renderer){
  const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthBuffer:true});
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
  const uniforms={picture:{value:target.texture},strength:{value:.72}};
  const material=new T.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform sampler2D picture;uniform float strength;varying vec2 vUv;
      float bayer(vec2 p){vec2 q=mod(floor(p),4.);float a=mod(q.x,2.)*2.+mod(q.y,2.);float b=floor(q.x/2.)*2.+floor(q.y/2.);return (mod(a*3.,4.)*4.+mod(b*3.,4.)+.5)/16.;}
      void main(){gl_FragColor=texture2D(picture,vUv);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      vec3 c=gl_FragColor.rgb;vec3 quantized=floor(clamp(c,0.,1.)*31.+bayer(gl_FragCoord.xy))/31.;
      gl_FragColor.rgb=mix(c,quantized,strength);
      }`});
  scene.add(new T.Mesh(new T.PlaneGeometry(2,2),material));
  renderer.info.autoReset=false;
  return {enabled:true,target,uniforms,
    resize(){const size=renderer.getDrawingBufferSize(new T.Vector2());target.setSize(size.x,size.y);},
    render(world,view){renderer.info.reset();if(!this.enabled){renderer.setRenderTarget(null);renderer.render(world,view);return;}
      renderer.setRenderTarget(target);renderer.render(world,view);renderer.setRenderTarget(null);renderer.render(scene,camera);
    }
  };
}
