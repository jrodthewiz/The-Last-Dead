import bpy, json, math, traceback
from pathlib import Path
from mathutils import Vector
BASE=Path('C:/Users/wolfk/Desktop/thelastdead/art/survivor-rig')
assert Path(bpy.data.filepath).resolve()==(BASE/'The_Last_Dead_Survivor_Rig_v01.blend').resolve()
scene=bpy.context.scene;rig=bpy.data.objects['TLD_Survivor']
names=['Idle_Ready','Walk_Forward','Sprint_Forward','Crouch_Idle','Jump','Slide','Recoil']
body=[o for o in rig.children if o.type=='MESH']
report={'clips':{},'skin':{},'errors':[]}
for obj in body:
    bad=[v.index for v in obj.data.vertices if abs(sum(g.weight for g in v.groups)-1)>1e-5 or len(v.groups)>4]
    report['skin'][obj.name]={'vertices':len(obj.data.vertices),'bad_weights':len(bad)}
    assert not bad

# Bake the evaluated IK result into a separate export skeleton with no constraints.
export_collection=bpy.data.collections.new('TEMP_EXPORT');scene.collection.children.link(export_collection)
export=rig.copy();export.data=rig.data.copy();export.name='TLD_Game_Skeleton';export_collection.objects.link(export)
export.animation_data_clear()
for pb in export.pose.bones:
    for c in list(pb.constraints):pb.constraints.remove(c)
    pb.rotation_mode='QUATERNION'
for obj in body:
    ob=obj.copy();ob.data=obj.data.copy();export_collection.objects.link(ob);ob.parent=export;ob.name=obj.name+'_Game'
    for m in ob.modifiers:
        if m.type=='ARMATURE':m.object=export
export.animation_data_create()
for name in names:
    original=bpy.data.actions[name];rig.animation_data.action=original
    start,end=[int(v) for v in original.frame_range]
    samples=[];pose_range=[]
    for f in range(start,end+1):
        scene.frame_set(f);bpy.context.view_layer.update()
        samples.append({pb.name:pb.matrix.copy() for pb in rig.pose.bones})
        # Verify IK endpoints stay near hand/foot controls even in crouch and slide.
        errors={}
        for s in ['L','R']:
            for limb,ctrl in [('forearm','hand'),('shin','foot')]:
                e=(rig.pose.bones[limb+'.'+s].tail-rig.pose.bones['CTRL_'+ctrl+'.'+s].head).length
                errors[ctrl+'.'+s]=e
        pose_range.append(errors)
    action=bpy.data.actions.new('BAKED_'+name);export.animation_data.action=action
    for f,matrices in enumerate(samples,start):
        for pb in export.pose.bones:
            rest=pb.bone.matrix_local
            if pb.parent:
                relative=matrices[pb.parent.name].inverted()@matrices[pb.name]
                rest_rel=pb.parent.bone.matrix_local.inverted()@rest
                pb.matrix_basis=rest_rel.inverted()@relative
            else:pb.matrix_basis=rest.inverted()@matrices[pb.name]
            pb.keyframe_insert('location',frame=f,group=pb.name)
            pb.keyframe_insert('rotation_quaternion',frame=f,group=pb.name)
            pb.keyframe_insert('scale',frame=f,group=pb.name)
    for fc in action.fcurves:
        for kp in fc.keyframe_points:kp.interpolation='LINEAR'
    track=export.animation_data.nla_tracks.new();track.name=name
    strip=track.strips.new(name,1,action);strip.name=name;track.mute=True
    report['clips'][name]={'frames':end-start+1,'max_ik_error':{k:max(r[k] for r in pose_range) for k in pose_range[0]}}
export.animation_data.action=None
rig.animation_data.action=None
for track in export.animation_data.nla_tracks:track.mute=False
for obj in bpy.context.selected_objects:obj.select_set(False)
export.select_set(True)
for obj in export.children:obj.select_set(True)
bpy.context.view_layer.objects.active=export
scene.frame_start=1;scene.frame_end=60;scene.frame_set(1)
(BASE/'exports').mkdir(exist_ok=True)
props={p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
kwargs={'filepath':str(BASE/'exports'/'tld-survivor-rig.glb'),'export_format':'GLB','use_selection':True,'export_animations':True,'export_force_sampling':True,'export_nla_strips':True,'export_def_bones':True,'export_extras':True,'export_yup':True,'export_cameras':False,'export_lights':False}
bpy.ops.export_scene.gltf(**{k:v for k,v in kwargs.items() if k in props})
export_collection.hide_render=True;export_collection.hide_viewport=True
import sys
if '--export-only' in sys.argv:
    report['glb_bytes']=(BASE/'exports'/'tld-survivor-rig.glb').stat().st_size
    (BASE/'validation.json').write_text(json.dumps(report,indent=2))
    print('TLD_EXPORT_COMPLETE '+json.dumps(report))
    sys.exit(0)

# Review images come from the authoring skeleton, not the baked copy.
rig.animation_data.action=bpy.data.actions['Idle_Ready'];scene.frame_set(1)
stage=bpy.data.collections.new('TEMP_RENDER');scene.collection.children.link(stage)
def area(name,pos,power,size,color):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
    ob=bpy.data.objects.new(name,data);stage.objects.link(ob);ob.location=pos;ob.rotation_euler=(Vector((0,0,.9))-ob.location).to_track_quat('-Z','Y').to_euler()
area('Key',(-2.2,3.4,3.7),400,3.0,(1,.88,.73))
area('Fill',(2.5,1.0,2.0),250,3,(.64,.78,1))
area('Rim',(0,-2.3,2.8),450,2,(.7,.83,1))
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.08,.1,.13,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
scene.render.engine='BLENDER_EEVEE';scene.eevee.use_gtao=True;scene.eevee.gtao_distance=.15;scene.eevee.taa_render_samples=32
scene.view_settings.view_transform='Standard';scene.view_settings.look='Medium High Contrast';scene.view_settings.exposure=0;scene.view_settings.gamma=1
scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
(BASE/'review').mkdir(exist_ok=True)
for name,action,frame,camera,head in [('ready','Idle_Ready',1,'VIEW_Rig_Overview',True),('walk','Walk_Forward',8,'VIEW_Rig_Overview',True),('crouch','Crouch_Idle',1,'VIEW_Rig_Overview',True),('slide','Slide',23,'VIEW_Rig_Overview',True),('first-person','Idle_Ready',1,'VIEW_First_Person',False),('look-down','Idle_Ready',1,'VIEW_Look_Down',False)]:
    rig.animation_data.action=bpy.data.actions[action];scene.frame_set(frame);bpy.data.objects['TLD_head'].hide_render=not head
    scene.camera=bpy.data.objects[camera]
    scene.render.resolution_x=1000;scene.render.resolution_y=850 if head else 625
    scene.render.filepath=str(BASE/'review'/(name+'.png'))
    bpy.ops.render.render(write_still=True)
report['glb_bytes']=(BASE/'exports'/'tld-survivor-rig.glb').stat().st_size
(BASE/'validation.json').write_text(json.dumps(report,indent=2))
print('TLD_EXPORT_REVIEW_COMPLETE '+json.dumps(report))
