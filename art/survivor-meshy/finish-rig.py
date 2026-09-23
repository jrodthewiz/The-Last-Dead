"""Add editable Blender controls, first-person visibility and portable clips.
Run only in a separate background Blender process; never touches an open UI file.
"""
import bpy, bmesh, math, json
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
assert bpy.app.background
BASE=Path('C:/Users/wolfk/Desktop/thelastdead/art/survivor-meshy')
bpy.ops.wm.open_mainfile(filepath=str(BASE/'TLD_Survivor_Meshy_v02.blend'))
scene=bpy.context.scene;rig=bpy.data.objects['TLD_Meshy_Survivor'];root=bpy.data.objects['TLD_World_Root']
body=bpy.data.objects['TLD_Survivor_Mesh']
report={'clips':{},'limits':['Meshy supplied 24 body joints, with no articulated finger or facial bones.','Weapon-specific grip and reload animation require a hand topology/rig pass.']}

# Preserve provider clips exactly; same joint names and bind transforms.
clips=[]
for filename,name in [('walking','Walk_Forward'),('running','Run_Forward')]:
    old_objects=set(bpy.data.objects);old_actions=set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=str(BASE/'basic-animations'/(filename+'.glb')))
    new_rig=next(o for o in set(bpy.data.objects)-old_objects if o.type=='ARMATURE')
    assert set(b.name for b in new_rig.data.bones)==set(b.name for b in rig.data.bones)
    actions=list(set(bpy.data.actions)-old_actions);assert len(actions)==1
    action=actions[0];action.name=name;action.use_fake_user=True;clips.append(action)
    report['clips'][name]={'frames':list(action.frame_range),'source':'Meshy included basic animation'}
    for ob in list(set(bpy.data.objects)-old_objects):bpy.data.objects.remove(ob,do_unlink=True)

for pb in rig.pose.bones:pb.rotation_mode='QUATERNION';pb.matrix_basis.identity()
rig.animation_data_clear()

# Split only the head/upper neck so a local camera can hide it without losing torso/legs.
head=body.copy();head.data=body.data.copy();scene.collection.objects.link(head);head.name='TLD_Head_Hide_For_Local_Player'
body.name='TLD_Body_Arms_Torso_Legs'
head_vertices={v.index for v in body.data.vertices if (body.matrix_world@v.co).z>1.52 and sum(g.weight for g in v.groups if body.vertex_groups[g.group].name in ['Head','neck','head_end','headfront'])>.45}
for ob,keep_head in [(head,True),(body,False)]:
    bm=bmesh.new();bm.from_mesh(ob.data);bm.verts.ensure_lookup_table()
    delete=[f for f in bm.faces if (sum(v.index in head_vertices for v in f.verts)>=2)!=keep_head]
    bmesh.ops.delete(bm,geom=delete,context='FACES')
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
    bm.to_mesh(ob.data);bm.free();ob.data.update()
head['local_player_visibility']='Hide this mesh for the local first-person camera; retain for remote players and shadows.'

controls=bpy.data.collections.new('ANIMATOR_CONTROLS');scene.collection.children.link(controls)
def empty(name,position,shape='SPHERE',size=.045):
    ob=bpy.data.objects.new(name,None);controls.objects.link(ob);ob.empty_display_type=shape;ob.empty_display_size=size;ob.location=position
    world=Matrix.Translation(position);ob.parent=root;ob.matrix_world=world
    return ob
def world_bone(name):
    source=rig.matrix_world@rig.data.bones[name].matrix_local
    result=source.to_quaternion().to_matrix().to_4x4();result.translation=source.translation
    return result
handles={}
rig['Arm_IK']=0.0;rig['Leg_IK']=0.0
for prop in ['Arm_IK','Leg_IK']:
    rig.id_properties_ui(prop).update(min=0.0,max=1.0) if hasattr(rig,'id_properties_ui') else None
for side,sign in [('Left',-1),('Right',1)]:
    for limb,end,mid,pole in [('Arm','Hand','ForeArm',(sign*.48,-.12,1.25)),('Leg','Foot','Leg',(sign*.16,.52,.50))]:
        matrix=world_bone(side+end);ctrl=empty('CTRL_'+side+end,matrix.translation,'CUBE');ctrl.matrix_world=matrix
        pv=empty('POLE_'+side+limb,pole,size=.035)
        handles[side+end]=ctrl
        ik=rig.pose.bones[side+mid].constraints.new('IK');ik.name=limb+' IK (blend property)';ik.target=ctrl;ik.pole_target=pv;ik.chain_count=2;ik.use_stretch=False
        # Choose the pole angle that minimally disturbs the bind pose.
        ik.influence=1;best=(1e9,0)
        for i in range(72):
            ik.pole_angle=-math.pi+i*math.tau/72;bpy.context.view_layer.update()
            error=(rig.pose.bones[side+mid].head-rig.data.bones[side+mid].head_local).length
            if error<best[0]:best=(error,ik.pole_angle)
        ik.pole_angle=best[1]
        fc=ik.driver_add('influence');d=fc.driver;d.type='AVERAGE';v=d.variables.new();v.name='blend';v.type='SINGLE_PROP';v.targets[0].id=rig;v.targets[0].data_path='["'+limb+'_IK"]'
        rot=rig.pose.bones[side+end].constraints.new('COPY_ROTATION');rot.name='IK hand/foot orientation';rot.target=ctrl;rot.target_space='WORLD';rot.owner_space='WORLD'
        fc=rot.driver_add('influence');d=fc.driver;d.type='AVERAGE';v=d.variables.new();v.name='blend';v.type='SINGLE_PROP';v.targets[0].id=rig;v.targets[0].data_path='["'+limb+'_IK"]'

# Stable eye reference is independent of head animation; the game can add controlled bob.
eye=empty('SOCKET_FirstPerson_Eye',(0,.075,1.66),'ARROWS',.10)
eye['forward']='Blender +Y; exported glTF -Z';eye['camera_height_m']=1.66
def camera(name,pitch):
    data=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob)
    ob.parent=eye;ob.location=(0,0,0);ob.rotation_euler=(math.radians(90-pitch),0,math.pi)
    # Explicit look vector removes Euler sign ambiguity.
    direction=Vector((0,math.cos(math.radians(pitch)),-math.sin(math.radians(pitch))))
    ob.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
    data.type='PERSP';data.lens=22;data.clip_start=.025;return ob
fp=camera('VIEW_FirstPerson',0);lookdown=camera('VIEW_FirstPerson_LookDown',85)
lookdown.location.y=.16
lookdown['camera_collision_offset_m']=.16
sockets=[]
for side in ['Left','Right']:
    ob=empty('SOCKET_'+side+'Hand',world_bone(side+'Hand').translation,'ARROWS',.08)
    world=world_bone(side+'Hand');ob.parent=rig;ob.parent_type='BONE';ob.parent_bone=side+'Hand';bpy.context.view_layer.update();ob.matrix_world=world;sockets.append(ob)
    ob['usage']='Weapon attachment origin; align each weapon grip locally. No weapon-specific offset is assumed.'

# Bake a relaxed body pose from IK, then release IK so imported FK clips remain intact.
rig['Arm_IK']=1.0;rig.update_tag()
for side,sign in [('Left',-1),('Right',1)]:
    ctrl=handles[side+'Hand'];matrix=ctrl.matrix_world.copy()
    old_direction=matrix.to_3x3()@Vector((0,1,0))
    q=old_direction.normalized().rotation_difference(Vector((sign*.12,.05,-1)).normalized())
    matrix=q.to_matrix().to_4x4()@matrix
    matrix.translation=Vector((sign*.235,.12,.94));ctrl.matrix_world=matrix
bpy.context.view_layer.update()
rest_matrices={pb.name:pb.matrix.copy() for pb in rig.pose.bones}
rig['Arm_IK']=0.0;rig.update_tag();bpy.context.view_layer.update()
def apply_matrices(matrices):
    for pb in rig.pose.bones:
        rest=pb.bone.matrix_local
        if pb.parent:pb.matrix_basis=(pb.parent.bone.matrix_local.inverted()@rest).inverted()@(matrices[pb.parent.name].inverted()@matrices[pb.name])
        else:pb.matrix_basis=rest.inverted()@matrices[pb.name]
rig.animation_data_create();idle=bpy.data.actions.new('Idle_Relaxed');idle.use_fake_user=True;rig.animation_data.action=idle
for f in range(1,92):
    apply_matrices(rest_matrices)
    phase=(f-1)/90*math.tau
    rig.pose.bones['Spine01'].rotation_quaternion @= Quaternion((1,0,0),math.sin(phase)*.009)
    for pb in rig.pose.bones:
        pb.keyframe_insert('location',frame=f,group=pb.name);pb.keyframe_insert('rotation_quaternion',frame=f,group=pb.name);pb.keyframe_insert('scale',frame=f,group=pb.name)
clips.insert(0,idle);report['clips']['Idle_Relaxed']={'frames':[1,91],'source':'Blender IK pose and subtle breathing'}
for action in clips:
    for fc in action.fcurves:
        for k in fc.keyframe_points:k.interpolation='LINEAR'

# Render body and locomotion reviews, including the actual head-hidden look-down view.
scene.render.resolution_x=1100;scene.render.resolution_y=1000
for name,action,frame,cam,hide in [('ready',idle,1,bpy.data.objects['VIEW_Overview'],False),('walk',clips[1],12,bpy.data.objects['VIEW_Overview'],False),('run',clips[2],8,bpy.data.objects['VIEW_Overview'],False),('look-down',idle,1,lookdown,True)]:
    rig.animation_data.action=action;scene.frame_set(frame);head.hide_render=hide;scene.camera=cam
    scene.render.filepath=str(BASE/'review'/(name+'.png'));bpy.ops.render.render(write_still=True)
head.hide_render=False

# Export source skeleton with FK clips; controls and studio are excluded.
rig.animation_data.action=None
for action in clips:
    track=rig.animation_data.nla_tracks.new();track.name=action.name
    strip=track.strips.new(action.name,1,action);strip.name=action.name
for ob in bpy.context.selected_objects:ob.select_set(False)
for ob in [rig,root,body,head,eye]+sockets:ob.select_set(True)
bpy.context.view_layer.objects.active=rig;scene.frame_set(1)
(BASE/'exports').mkdir(exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(BASE/'exports'/'tld-survivor-v02.glb'),export_format='GLB',use_selection=True,export_animations=True,export_force_sampling=True,export_nla_strips=True,export_def_bones=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
for track in rig.animation_data.nla_tracks:track.mute=True
rig.animation_data.action=idle;scene.frame_start=1;scene.frame_end=91;scene.frame_set(1)
scene.camera=bpy.data.objects['VIEW_Overview']
controls.hide_render=True
for ob in bpy.context.selected_objects:ob.select_set(False)
rig.select_set(True);bpy.context.view_layer.objects.active=rig
rig.data.display_type='STICK';rig.show_in_front=False
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            s=area.spaces.active;s.overlay.show_extras=False;s.region_3d.view_distance=2.6;s.region_3d.view_location=(0,0,.93)
scene['README']='See art/survivor-meshy/README.md. Body FK clips + optional Arm_IK / Leg_IK controls; hide head for local player.'
used_materials=set(body.data.materials)|set(head.data.materials)
for mat in used_materials:
    for node in mat.node_tree.nodes:
        if node.type=='TEX_IMAGE' and node.image and not node.image.packed_file:node.image.pack()
report['export_bytes']=(BASE/'exports'/'tld-survivor-v02.glb').stat().st_size
report['bones']=len(rig.data.bones);report['meshes']={ob.name:len(ob.data.polygons) for ob in [body,head]}
(BASE/'rig-validation.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(BASE/'TLD_Survivor_Meshy_v02_GameRig.blend'))
print('TLD_GAME_RIG_COMPLETE '+json.dumps(report))
