import bpy, math
from pathlib import Path
from mathutils import Vector
BASE=Path('C:/Users/wolfk/Desktop/thelastdead/art/survivor-rig')
assert Path(bpy.data.filepath).resolve()==(BASE/'The_Last_Dead_Survivor_Rig_v01.blend').resolve()
rig=bpy.data.objects['TLD_Survivor'];scene=bpy.context.scene
assert rig.get('framing_v2') and not rig.get('framing_final')
if bpy.context.screen.is_animation_playing:bpy.ops.screen.animation_cancel(restore_frame=False)
for action in bpy.data.actions:
    for s in ['L','R']:
        name='CTRL_hand.'+s
        extra=-.035 if action.name in ['Sprint_Forward','Crouch_Idle'] else 0
        delta=rig.data.bones[name].matrix_local.to_3x3().inverted()@Vector((.03 if s=='L' else -.08,(-.04 if s=='L' else 0)+extra,.04))
        for fc in action.fcurves:
            if fc.data_path=='pose.bones["%s"].location'%name:
                for k in fc.keyframe_points:k.co.y+=delta[fc.array_index];k.handle_left.y+=delta[fc.array_index];k.handle_right.y+=delta[fc.array_index]
ob=bpy.data.objects['VIEW_Look_Down'];ob.rotation_euler=(Vector((0,.69,0))-ob.location).to_track_quat('-Z','Y').to_euler()
rig['framing_final']=True
rig.animation_data.action=bpy.data.actions['Idle_Ready'];scene.frame_set(1)
exec(compile((BASE/'present-rig.py').read_text(encoding='utf-8-sig'),'present-rig.py','exec'))
