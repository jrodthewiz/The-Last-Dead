"""Render a neutral motion reel from the editable v07 Blender master.

Frames are preservation/QA output, not runtime content. Encode with FFmpeg at
24 fps. Actions evaluate at the original master scene's 60 fps.
"""
import math
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[1]
FRAMES=ROOT/'.art-source/zombie-horde-v07/reel-frames'
FRAMES.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'.art-source/zombie-horde-v07/zombie-motion-v07.blend'))
scene=bpy.context.scene
rig=next(o for o in scene.objects if o.type=='ARMATURE')
for track in rig.animation_data.nla_tracks:
    track.mute=True
scene.render.resolution_x=640
scene.render.resolution_y=640
scene.eevee.taa_render_samples=12
scene.render.image_settings.file_format='PNG'
font=bpy.data.curves.new('MotionLabel','FONT')
font.size=.072
label=bpy.data.objects.new('MotionLabel',font)
scene.collection.objects.link(label)
label.parent=scene.camera
label.location=(-.97,.91,-3)
material=bpy.data.materials.new('MotionLabelInk')
material.use_nodes=True
tree=material.node_tree
tree.nodes.clear()
emission=tree.nodes.new('ShaderNodeEmission')
emission.inputs[0].default_value=(.85,.87,.88,1)
output=tree.nodes.new('ShaderNodeOutputMaterial')
tree.links.new(emission.outputs[0],output.inputs[0])
font.materials.append(material)
frame_index=0
for name in ['Run','Crawl','Contort']:
    action=next(a for a in bpy.data.actions if a.name.startswith('AshWitness_'+name))
    rig.animation_data.action=action
    start,end=action.frame_range
    duration=(end-start)/scene.render.fps
    font.body={'Run':'RUNNER / 0.9 SECOND LOOP','Crawl':'CRAWLER / ARTICULATED SUPPORT','Contort':'CRAWLER / CROOKED LISTENING'}[name]
    count=math.ceil(duration*2*24)
    for sample in range(count):
        frame=start+((sample/24)%duration)*scene.render.fps
        scene.frame_set(int(frame),subframe=frame%1)
        scene.render.filepath=str(FRAMES/('frame-%04d.png'%frame_index))
        bpy.ops.render.render(write_still=True)
        frame_index+=1
print('MOTION_REEL_FRAMES=%d'%frame_index,flush=True)
