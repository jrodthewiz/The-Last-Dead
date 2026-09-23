import bpy
from mathutils import Vector
from pathlib import Path
BASE=Path('C:/Users/wolfk/Desktop/thelastdead/art/survivor-rig')
assert Path(bpy.data.filepath).resolve()==(BASE/'The_Last_Dead_Survivor_Rig_v01.blend').resolve()
scene=bpy.context.scene;rig=bpy.data.objects['TLD_Survivor']
rig.animation_data.action=bpy.data.actions['Idle_Ready'];scene.frame_start=1;scene.frame_end=60;scene.frame_set(1)
for obj in bpy.data.collections['03 | Cameras and grip guides'].objects:obj.hide_set(True)
for obj in bpy.context.selected_objects:obj.select_set(False)
rig.select_set(True);bpy.context.view_layer.objects.active=rig
if bpy.context.object.mode!='POSE':bpy.ops.object.mode_set(mode='POSE')
for b in rig.data.bones:b.select=False
rig.data.bones.active=rig.data.bones['CTRL_hand.R'];rig.data.bones['CTRL_hand.R'].select=True
bpy.context.window.workspace=bpy.data.workspaces['Layout']
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        space=area.spaces.active;space.region_3d.view_location=(0,0,.9);space.region_3d.view_distance=2.65
        space.region_3d.view_rotation=Vector((1.5,4,1.0)).to_track_quat('Z','Y');space.region_3d.view_perspective='PERSP'
        space.shading.type='MATERIAL';space.overlay.show_floor=True
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
print('READY_FOR_ANIMATION')
