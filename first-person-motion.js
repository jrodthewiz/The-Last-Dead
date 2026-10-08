import {BodycamMotion} from './bodycam-motion.js';

// Eye-level presence. Shared footstep/landing timing remains distance-driven,
// with restrained translation and roll; the camera never sits on the chest.
export class FirstPersonMotion extends BodycamMotion {
  update(run,delta,options={}){
    if(options.enabled!==false&&!options.reducedMotion&&(!(delta>0)||!Number.isFinite(delta)))return this.pose;
    const pose=super.update(run,delta,options);
    if(options.enabled===false||options.reducedMotion)return pose;
    pose.x*=.35;pose.y=(pose.y+.14)*.35;
    pose.pitch*=.30;pose.roll*=.18;
    return pose;
  }
}
