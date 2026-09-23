"""Create a compact game asset and textured view sleeves; preserve the art master."""
import bpy,bmesh,json,math
from pathlib import Path
from mathutils import Vector
assert bpy.app.background
BASE=Path('C:/Users/wolfk/Desktop/thelastdead')
bpy.ops.wm.open_mainfile(filepath=str(BASE/'art/survivor-meshy/TLD_Survivor_Meshy_v02_GameRig.blend'))
rig=bpy.data.objects['TLD_Meshy_Survivor'];body=bpy.data.objects['TLD_Body_Arms_Torso_Legs'];head=bpy.data.objects['TLD_Head_Hide_For_Local_Player'];root=bpy.data.objects['TLD_World_Root']
rig.animation_data.action=None
for track in rig.animation_data.nla_tracks:track.mute=True
for pb in rig.pose.bones:pb.matrix_basis.identity()
rig['Arm_IK']=0;rig['Leg_IK']=0;rig.update_tag();bpy.context.view_layer.update()
def keep_faces(ob,predicate):
    bm=bmesh.new();bm.from_mesh(ob.data);bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm,geom=[f for f in bm.faces if not predicate(f)],context='FACES')
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bm.to_mesh(ob.data);bm.free();ob.data.update()
def duplicate(name):
    ob=body.copy();ob.data=body.data.copy();bpy.context.scene.collection.objects.link(ob);ob.name=name;return ob
# One exact seam shared by body and arms; first person renders only body.
arm_indices=set()
for v in body.data.vertices:
    p=body.matrix_world@v.co
    weight=sum(g.weight for g in v.groups if body.vertex_groups[g.group].name in ['LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand'])
    if abs(p.x)>.185 and weight>.52:arm_indices.add(v.index)
arms=duplicate('TLD_Remote_Arms')
keep_faces(arms,lambda f:sum(v.index in arm_indices for v in f.verts)>=2)
views=[]
for side,sign in [('Left',-1),('Right',1)]:
    shoulder=rig.matrix_world@rig.data.bones[side+'Arm'].head_local
    wrist=rig.matrix_world@rig.data.bones[side+'Hand'].head_local
    axis=(wrist-shoulder).normalized();length=(wrist-shoulder).length
    view=duplicate('TLD_ViewSleeve_'+side)
    keep_faces(view,lambda f:sum(v.index in arm_indices and (body.matrix_world@v.co).x*sign>0 and (body.matrix_world@v.co-wrist).dot(axis)<.004 for v in f.verts)>=2)
    world=view.matrix_world.copy()
    back=Vector((0,-1,0));right=axis.cross(back).normalized();back=right.cross(axis).normalized()
    target_length=Vector((.02,.40,-.34)).length
    # Blender X,Y,Z maps to glTF X,Z,-Y. Authored view arm grows along glTF +Y.
    for v in view.data.vertices:
        p=world@v.co-shoulder
        v.co=Vector((p.dot(right),-p.dot(back),p.dot(axis)))*(target_length/length)
    view.parent=None;view.matrix_world.identity()
    for mod in list(view.modifiers):view.modifiers.remove(mod)
    view.vertex_groups.clear();views.append(view)
keep_faces(body,lambda f:sum(v.index in arm_indices for v in f.verts)<2)
body.name='TLD_Local_Torso_Legs'
materials=set(body.data.materials)|set(head.data.materials)
for mat in materials:
    principled=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    # Provider output includes emissive albedo. Clothing must respond to game lighting.
    for link in list(principled.inputs['Emission'].links):mat.node_tree.links.remove(link)
    principled.inputs['Emission'].default_value=(0,0,0,1)
    principled.inputs['Roughness'].default_value=.82;principled.inputs['Metallic'].default_value=0
    mat.use_backface_culling=True
    for n in mat.node_tree.nodes:
        if n.type=='TEX_IMAGE' and n.image and n.image.size[0]>2048:
            img=n.image;img.scale(2048,2048)
            img.filepath_raw=str(BASE/'art/survivor-meshy/runtime-albedo.jpg');img.file_format='JPEG';img.save()
            # Blender 2.93 copies packed images using the old packed dimensions.
            n.image=bpy.data.images.load(img.filepath_raw,check_existing=False)
for ob in bpy.context.selected_objects:ob.select_set(False)
for ob in [rig,body,head,arms,root]+views:ob.select_set(True)
bpy.context.view_layer.objects.active=rig
for track in rig.animation_data.nla_tracks:track.mute=False
out=BASE/'assets/survivor/tld-survivor-v02.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=True,export_force_sampling=True,export_nla_strips=True,export_def_bones=True,export_yup=True,export_cameras=False,export_lights=False,export_image_format='JPEG')
print('RUNTIME_EXPORT '+json.dumps({'bytes':out.stat().st_size,'meshes':{o.name:len(o.data.polygons) for o in [body,head,arms]+views}}))
