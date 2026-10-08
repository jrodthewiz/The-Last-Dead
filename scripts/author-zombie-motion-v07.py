"""Headless Blender authoring on the preserved Ash Witness skeleton.

Run with Blender 2.93 --background --python this-file. Original skin, textures,
bind matrices and six combat/gait clips stay exact. New loops use world-space
two-bone IK and explicit planted/swing phases, baked to local glTF channels.
Editable Blender actions and rendered contact sheets live in .art-source/docs.
"""
import copy
import hashlib
import importlib.util
import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/zombie-horde-v07'
MASTER = ROOT / '.art-source/zombie-horde-v07'
TEMP = ROOT / '.codex-temp/zombie-horde-v07'
SOURCE = ROOT / 'assets/models/afterlife-ash-witness-motion-v06.glb'
TARGET = ROOT / 'assets/models/afterlife-ash-witness-motion-v07.glb'
spec = importlib.util.spec_from_file_location('rig_helpers', ROOT / 'scripts/rig-zombie-v05.py')
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)


def smooth(t):
    t = max(0, min(1, t))
    return t*t*(3-2*t)


class Pose:
    def __init__(self, asset):
        self.asset = asset
        self.names = {n.get('name', ''): i for i, n in enumerate(asset.doc['nodes'])}
        self.local = [asset.local_matrix(i) for i in range(len(asset.doc['nodes']))]
        self.rest = [m.copy() for m in self.local]
        self.world = {}

    def matrix(self, i):
        if isinstance(i, str):
            i = self.names[i]
        if i not in self.world:
            parent = self.asset.parents.get(i)
            self.world[i] = self.matrix(parent) @ self.local[i] if parent is not None else self.local[i]
        return self.world[i]

    def point(self, name):
        return self.matrix(name).translation.copy()

    def world_rotation(self, name, rotation):
        i = self.names[name]
        parent = self.asset.parents.get(i)
        local_rotation = self.matrix(parent).to_quaternion().inverted() @ rotation if parent is not None else rotation
        position, _, scale = self.local[i].decompose()
        self.local[i] = Matrix.Translation(position) @ local_rotation.to_matrix().to_4x4() @ Matrix.Diagonal((*scale, 1))
        self.world.clear()

    def turn(self, name, axis, radians):
        self.world_rotation(name, Quaternion(Vector(axis), radians) @ self.matrix(name).to_quaternion())

    def position(self, name, target):
        i = self.names[name]
        parent = self.asset.parents.get(i)
        local = self.matrix(parent).inverted() @ Vector(target) if parent is not None else Vector(target)
        self.local[i].translation = local
        self.world.clear()

    def limb(self, upper, lower, end, target, pole):
        a, b, c = self.point(upper), self.point(lower), self.point(end)
        target = Vector(target)
        l1, l2 = (b-a).length, (c-b).length
        d = max(abs(l1-l2)+.003, min((target-a).length, l1+l2-.003))
        direction = (target-a).normalized()
        perpendicular = Vector(pole)-direction*Vector(pole).dot(direction)
        perpendicular.normalize()
        along = (l1*l1-l2*l2+d*d)/(2*d)
        height = math.sqrt(max(0, l1*l1-along*along))
        elbow = a + direction*along + perpendicular*height
        self.world_rotation(upper, (b-a).rotation_difference(elbow-a) @ self.matrix(upper).to_quaternion())
        b, c = self.point(lower), self.point(end)
        reachable = a + direction*d
        self.world_rotation(lower, (c-b).rotation_difference(reachable-b) @ self.matrix(lower).to_quaternion())


def stance(phase, reach, back, floor, lift, duty=.62):
    phase %= 1
    if phase < duty:
        # Linear backward travel cancels the simulation's constant root speed.
        return reach + (back-reach)*phase/duty, floor
    swing = (phase-duty)/(1-duty)
    return back + (reach-back)*smooth(swing), floor + lift*math.sin(math.pi*swing)**1.4


def make_pose(asset, style, phase):
    p = Pose(asset)
    wave = math.sin(phase*math.tau)
    delayed = math.sin(phase*math.tau-.55)
    crawl = style != 'Run'
    idle = style in ('CrawlIdle', 'Contort')
    if not crawl:
        p.position('Hips', (.018*wave, .85+.05*(1+math.cos(phase*math.tau*2)), -.045))
        p.turn('Hips', (1,0,0), .29)
        p.turn('Spine02', (1,0,0), .13)
        p.turn('Spine', (0,1,0), .07*wave)
        p.turn('neck', (1,0,0), -.31)
        p.turn('Head', (0,0,1), -.08+.025*delayed)
        for side, sign in [('Left',1),('Right',-1)]:
            local_phase = (phase+(0 if sign==1 else .5))%1
            # Less than half a cycle on each support foot creates a real
            # flight interval; this must not become an accelerated walk.
            z, y = stance(local_phase, .378, -.378, .12, .24, .42)
            p.limb(side+'UpLeg', side+'Leg', side+'Foot', (sign*.17,y,z), (sign*.12,.1,1))
            rest = Pose(asset).matrix(side+'Foot').to_quaternion()
            p.world_rotation(side+'Foot', Quaternion((1,0,0), .12*math.sin(local_phase*math.tau)) @ rest)
            shoulder = p.point(side+'Arm')
            target = shoulder+Vector((sign*.035,-.24,.06-.25*math.sin(local_phase*math.tau)))
            p.limb(side+'Arm',side+'ForeArm',side+'Hand',target,(sign*.8,0,-1))
        return p
    # Asymmetric quadrupedal support: pelvis low, chest horizontal, neck peering
    # ahead, hands leading the opposite knee. No whole-model rigid tip-over.
    breath = .012*math.sin(phase*math.tau)
    p.position('Hips', (.020*wave if not idle else .009*wave,.56+breath,-.19))
    p.turn('Hips', (1,0,0), 1.42)
    p.turn('Spine02',(1,0,0),.12)
    p.turn('Spine01',(0,0,1), .035*delayed)
    p.turn('Spine',(0,1,0), .045*wave)
    p.turn('neck',(1,0,0),-.92)
    p.turn('Head',(1,0,0),-.35)
    p.turn('Head',(0,0,1),-.17+.045*delayed)
    if style == 'Contort':
        # Authored sustained crooked listening, one elbow gathering under the
        # ribs, and a delayed neck roll. It never spins the head through 360°.
        p.turn('Spine',(0,1,0), .22+.12*wave)
        p.turn('neck',(0,0,1), .32+.15*delayed)
        p.turn('Head',(0,0,1), .46+.08*wave)
    for side, sign in [('Left',1),('Right',-1)]:
        limb_phase = (phase+(0 if sign==1 else .5))%1
        z, y = (.65,.095) if idle else stance(limb_phase,.86,.3632,.095,.105,.69)
        if style == 'Contort' and sign == -1:
            z -= .08*smooth((1+wave)*.5)
            y += .055*smooth((1+delayed)*.5)
        p.limb(side+'Arm',side+'ForeArm',side+'Hand',(sign*.29,y,z),(sign,0,-.5))
        # Palm orientation is anchored in world space instead of inheriting the
        # shoulder roll, avoiding wrists that flip around the support phase.
        rest = Pose(asset).matrix(side+'Hand').to_quaternion()
        palm = Quaternion((0,0,1),sign*math.pi/2) @ Quaternion((0,1,0),-sign*math.pi/2)
        p.world_rotation(side+'Hand', palm @ rest)
        leg_phase = (limb_phase+.5)%1
        z, y = (-.42,.16) if idle else stance(leg_phase,-.28,-.7552,.16,.095,.66)
        p.limb(side+'UpLeg',side+'Leg',side+'Foot',(sign*.25,y,z),(sign*.7,-1,.3))
        p.world_rotation(side+'Foot',Quaternion((1,0,0),.18) @ Pose(asset).matrix(side+'Foot').to_quaternion())
    return p


def bake(asset, style, duration, stride):
    count = round(duration*60)
    times = [duration*i/count for i in range(count+1)]
    poses = [make_pose(asset,style,i/count if i<count else 0) for i in range(count+1)]
    time_accessor = asset.add_accessor(times,'SCALAR')
    asset.doc['accessors'][time_accessor].update(min=[0],max=[duration])
    clip = {'name':'AshWitness_'+style,'channels':[],'samplers':[],
            'extras':{'zombieMotionVersion':7,'loop':True,'strideMeters':stride,
                      'authoring':'Blender 2.93 world-space two-bone IK / explicit support phases'}}
    # Match original full-body track ownership, including neutral translation
    # and scale, so blends never silently fall back to the T-pose.
    original = asset.doc['animations'][0]
    for old in original['channels']:
        node, path = old['target']['node'],old['target']['path']
        values = []
        previous = None
        for pose in poses:
            position, rotation, scale = pose.local[node].decompose()
            if path == 'rotation':
                rotation.normalize()
                if previous is not None and previous.dot(rotation)<0:
                    rotation.negate()
                previous = rotation
                value = (rotation.x,rotation.y,rotation.z,rotation.w)
            else:
                value = tuple(position if path=='translation' else scale)
            values.append(value)
        accessor = asset.add_accessor(values,'VEC4' if path=='rotation' else 'VEC3')
        clip['channels'].append({'sampler':len(clip['samplers']),'target':copy.deepcopy(old['target'])})
        clip['samplers'].append({'input':time_accessor,'output':accessor,'interpolation':'LINEAR'})
    asset.doc['animations'].append(clip)
    return {'name':clip['name'],'duration':duration,'strideMeters':stride,'samples':count+1,'tracks':len(clip['channels'])}


def proof(asset):
    preview = copy.deepcopy(asset)
    preview.doc.pop('extensionsUsed',None)
    preview.doc.pop('extensionsRequired',None)
    for key in ('images','textures','samplers'):
        preview.doc.pop(key,None)
    for material in preview.doc.get('materials',[]):
        material.clear()
        material['pbrMetallicRoughness']={'baseColorFactor':[.42,.36,.30,1],'roughnessFactor':.85}
    path = TEMP/'motion-proof.glb'
    preview.save(path)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 60
    bpy.ops.import_scene.gltf(filepath=str(path))
    scene=bpy.context.scene
    rig=next(o for o in scene.objects if o.type=='ARMATURE')
    actions=list(bpy.data.actions)
    rig.animation_data_clear()
    rig.animation_data_create()
    for action in actions:
        action.use_fake_user=True
        track=rig.animation_data.nla_tracks.new()
        track.name=action.name
        track.strips.new(action.name,0,action)
        track.mute=True
    data=bpy.data.cameras.new('ReviewCamera')
    camera=bpy.data.objects.new('ReviewCamera',data)
    scene.collection.objects.link(camera)
    camera.location=(2.3,-3.8,1.6)
    target=Vector((0,-.05,.8))
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    data.type='ORTHO'
    data.ortho_scale=2.15
    scene.camera=camera
    scene.world=bpy.data.worlds.new('ReviewWorld')
    scene.world.color=(.045,.045,.045)
    for name,location,energy in [('Key',(-2,-3,4),650),('Fill',(2,-1,3),350),('Rim',(0,3,2),500)]:
        data=bpy.data.lights.new(name,'AREA')
        data.energy,data.size=energy,3
        light=bpy.data.objects.new(name,data)
        scene.collection.objects.link(light)
        light.location=location
        light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=8)
    floor=bpy.context.object
    material=bpy.data.materials.new('ReviewGround')
    material.diffuse_color=(.07,.08,.085,1)
    floor.data.materials.append(material)
    scene.render.engine='BLENDER_EEVEE'
    scene.eevee.taa_render_samples=16
    scene.render.resolution_x,scene.render.resolution_y=480,480
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.view_settings.view_transform='Standard'
    renders=[]
    for name in ['Run','Crawl','CrawlIdle','Contort']:
        action=next(a for a in actions if a.name.startswith('AshWitness_'+name))
        rig.animation_data.action=action
        start,end=action.frame_range
        for phase in [0,.25,.5,.75]:
            frame=start+(end-start)*phase
            scene.frame_set(int(frame),subframe=frame%1)
            filename=name+'-'+str(int(phase*100))+'.png'
            scene.render.filepath=str(OUT/filename)
            bpy.ops.render.render(write_still=True)
            renders.append(filename)
    rig.animation_data.action=next(a for a in actions if a.name.startswith('AshWitness_CrawlIdle'))
    scene.frame_set(1)
    bpy.context.preferences.filepaths.save_version=0
    master=MASTER/'zombie-motion-v07.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(master))
    return str(master.relative_to(ROOT)),renders


def main():
    for directory in (OUT,MASTER,TEMP):
        directory.mkdir(parents=True,exist_ok=True)
    asset=helpers.Glb(SOURCE)
    clips=[bake(asset,*config) for config in [('Run',.9,1.8),('Crawl',1.4,.72),('CrawlIdle',2.4,.72),('Contort',1.8,.72)]]
    asset.doc['asset'].setdefault('extras',{})['zombieMotionVersion']=7
    asset.save(TARGET)
    delivered=helpers.Glb(TARGET)
    original=helpers.Glb(SOURCE)
    assert delivered.doc['nodes']==original.doc['nodes']
    assert delivered.doc['skins']==original.doc['skins']
    assert delivered.doc['meshes']==original.doc['meshes']
    assert delivered.doc['materials']==original.doc['materials']
    assert delivered.doc['animations'][:6]==original.doc['animations']
    assert delivered.binary[:len(original.binary)]==original.binary
    report={'source':str(SOURCE.relative_to(ROOT)),'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
            'output':str(TARGET.relative_to(ROOT)),'outputSha256':hashlib.sha256(TARGET.read_bytes()).hexdigest(),
            'bytes':TARGET.stat().st_size,'addedBytes':TARGET.stat().st_size-SOURCE.stat().st_size,
            'originalSixClipsSkinTexturesAndBindExact':True,'clips':clips,'blender':bpy.app.version_string}
    (OUT/'validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print(json.dumps(report),flush=True)
    report['blend'],report['renders']=proof(delivered)
    (OUT/'validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    manifest={**report,'runtimeNeedsBlender':False,
              'geometrySource':'Existing Meshy Ash Witness / preserved v05 weighted jaw-grip rig',
              'motionSource':'Locally authored analytical two-bone IK, baked in Blender; no third-party motion redistributed',
              'freeSourcesReviewed':['https://quaternius.com/packs/universalanimationlibrary.html',
                                     'https://quaternius.com/packs/animatedzombie.html',
                                     'https://www.rokoko.com/resources/rokoko-mocap-12-free-zombie-animations']}
    (TARGET.with_name('afterlife-ash-witness-motion-v07-manifest.json')).write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')


if __name__=='__main__':
    main()
