import bpy
from pathlib import Path
from mathutils import Vector
BASE=Path('C:/Users/wolfk/Desktop/thelastdead/art/survivor-rig')
assert Path(bpy.data.filepath).resolve()==(BASE/'The_Last_Dead_Survivor_Rig_v01.blend').resolve()
rig=bpy.data.objects['TLD_Survivor'];bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
b=rig.data.edit_bones['weapon_socket'];b.head=rig.data.edit_bones['hand.R'].tail.copy();b.tail=b.head+Vector((0,.10,0))
b=rig.data.edit_bones['camera_socket'];b.head=(0,.26,1.60);b.tail=(0,.38,1.60)
bpy.ops.object.mode_set(mode='POSE')
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            space=area.spaces.active;space.region_3d.view_location=(0,0,.90);space.region_3d.view_distance=2.65
            space.region_3d.view_rotation=Vector((1.5,4,1.0)).to_track_quat('Z','Y');space.region_3d.view_perspective='PERSP';space.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
print('SOCKETS_AND_VIEW_FIXED')
