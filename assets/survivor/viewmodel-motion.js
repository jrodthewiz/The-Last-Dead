import {VIEWMODEL_CLIPS} from './viewmodel-motion-clips.js';

// Allocation-free playback of Blender's evaluated Bezier curves. End poses
// clamp exactly to rest, including a final sample shorter than one 120 Hz tick.
export function sampleViewmodelClip(name, seconds, out) {
  const clip=VIEWMODEL_CLIPS[name];
  if(!clip){out.fill(0);return out;}
  const t=Number.isFinite(seconds)?Math.max(0,Math.min(seconds,clip.duration)):clip.duration;
  const last=clip.samples.length-1;
  const i=Math.min(last,Math.floor(t*clip.fps+1e-9)),j=Math.min(last,i+1);
  const start=i/clip.fps,end=Math.min(j/clip.fps,clip.duration);
  const alpha=end>start?Math.max(0,Math.min(1,(t-start)/(end-start))):0;
  for(let axis=0;axis<6;axis++)out[axis]=clip.samples[i][axis]+(clip.samples[j][axis]-clip.samples[i][axis])*alpha;
  return out;
}
