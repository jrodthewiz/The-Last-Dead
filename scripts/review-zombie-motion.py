"""Headless Blender 2.93 proof frames for the exact retargeted character."""
import bpy
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / '.codex-temp/enemy-motion/review'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 60
bpy.ops.import_scene.gltf(filepath=str(ROOT / '.codex-temp/enemy-motion/review.glb'))
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
actions = {a.name: a for a in bpy.data.actions}
rig.animation_data_clear()
rig.animation_data_create()
scene.world = bpy.data.worlds.new('ReviewWorld')
scene.world.color = (.04, .045, .055)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.004))
floor = bpy.context.object
mat = bpy.data.materials.new('Ground')
mat.diffuse_color = (.12,.13,.15,1)
floor.data.materials.append(mat)
def aim(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
data = bpy.data.cameras.new('Camera')
camera = bpy.data.objects.new('Camera', data)
scene.collection.objects.link(camera)
camera.location = (2.6,-5.0,2.0)
aim(camera,(0,0,.92))
data.type = 'ORTHO'
data.ortho_scale = 2.65
scene.camera = camera
for name, location, energy, size in [('Key',(-3,-4,5),550,4),('Fill',(3,-2,3),250,3),('Rim',(1,3,4),600,3)]:
    data = bpy.data.lights.new(name,'AREA')
    data.energy=energy
    data.size=size
    light=bpy.data.objects.new(name,data)
    scene.collection.objects.link(light)
    light.location=location
    aim(light,(0,0,1))
scene.render.engine='BLENDER_EEVEE'
scene.eevee.taa_render_samples=24
scene.eevee.use_gtao=True
scene.eevee.gtao_distance=3
scene.render.resolution_x=320
scene.render.resolution_y=360
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='Filmic'
scene.view_settings.look='Medium High Contrast'
samples=[('Shuffle',[0,.4,.8,1.2]),('Chase',[0,.2,.4,.6]),('AttackLunge',[0,.2,.375,.7]),('Collapse',[0,.7,1.4,2.1])]
report=[]
for label,times in samples:
    name='AshWitness_'+label
    action=actions.get(name) or next((a for k,a in actions.items() if k.startswith(name+'_')),None)
    if not action:
        raise RuntimeError('Missing action '+name+' in '+str(list(actions)))
    rig.animation_data.action=action
    for index,time in enumerate(times):
        scene.frame_set(int(time*60),subframe=time*60-int(time*60))
        target=OUT/(label+'-'+str(index)+'.png')
        scene.render.filepath=str(target)
        bpy.ops.render.render(write_still=True)
        report.append({'clip':name,'seconds':time,'file':target.name,'frameRange':list(action.frame_range)})
(OUT/'frames.json').write_text(json.dumps(report,indent=2))
print('MOTION_REVIEW_COMPLETE '+str(OUT))
