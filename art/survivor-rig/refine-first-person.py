import bpy, math
from mathutils import Vector
from pathlib import Path
BASE=Path('C:/Users/wolfk/Desktop/thelastdead/art/survivor-rig')
assert Path(bpy.data.filepath).resolve()==(BASE/'The_Last_Dead_Survivor_Rig_v01.blend').resolve()
rig=bpy.data.objects['TLD_Survivor'];scene=bpy.context.scene
assert not rig.get('framing_v2'), 'Already adjusted'
for action in bpy.data.actions:
    for s in ['L','R']:
        name='CTRL_hand.'+s
        delta=rig.data.bones[name].matrix_local.to_3x3().inverted()@Vector((0,.045 if s=='R' else 0,.26))
        for fc in action.fcurves:
            if fc.data_path=='pose.bones["%s"].location'%name:
                for k in fc.keyframe_points:k.co.y+=delta[fc.array_index];k.handle_left.y+=delta[fc.array_index];k.handle_right.y+=delta[fc.array_index]
            if fc.data_path=='pose.bones["%s"].rotation_euler'%name and fc.array_index==0:
                for k in fc.keyframe_points:k.co.y=math.radians(55);k.handle_left.y=k.co.y;k.handle_right.y=k.co.y
    if action.name=='Walk_Forward':
        for fc in action.fcurves:
            if fc.data_path=='pose.bones["pelvis"].location' and fc.array_index==1:
                for k in fc.keyframe_points:k.co.y-=.018;k.handle_left.y-=.018;k.handle_right.y-=.018
for name,target,lens in [('VIEW_First_Person',(0,2,1.54),18),('VIEW_Look_Down',(0,.05,0),18)]:
    ob=bpy.data.objects[name];ob.location=(0,.26,1.60);ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler();ob.data.lens=lens
rig['framing_v2']=True;rig['first_person_body_offset']=.26
rig.animation_data.action=bpy.data.actions['Idle_Ready'];scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
print('FRAMING_REFINED')
