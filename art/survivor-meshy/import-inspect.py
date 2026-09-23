"""Import the approved Meshy output in a separate background Blender process."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
assert bpy.app.background, 'Run this importer in a separate background process only'
BASE=Path('C:/Users/wolfk/Desktop/thelastdead/art/survivor-meshy')
SOURCE=BASE/'tld-survivor-v02'/'rigged.glb'
assert SOURCE.is_file()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
scene=bpy.context.scene;scene.name='THE LAST DEAD | Meshy Survivor v02'
scene['project']='The Last Dead';scene['source']='Meshy generated survivor v02'
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene.render.fps=30
imported=list(scene.objects)
root=bpy.data.objects.new('TLD_World_Root',None);scene.collection.objects.link(root)
for ob in imported:
    if ob.parent is None:
        world=ob.matrix_world.copy();ob.parent=root;ob.matrix_world=world
root.rotation_euler.z=math.pi
bpy.context.view_layer.update()
meshes=[o for o in imported if o.type=='MESH'];rigs=[o for o in imported if o.type=='ARMATURE']
assert len(rigs)==1, 'Expected one Meshy humanoid skeleton'
rig=rigs[0];rig.name='TLD_Meshy_Survivor';rig.show_in_front=True
points=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box]
low=min(p.z for p in points);high=max(p.z for p in points)
root.scale=(1.78/(high-low),)*3;root.location.z=-low*root.scale.z
bpy.context.view_layer.update()
for o in meshes:
    o.name='TLD_Survivor_Mesh' if len(meshes)==1 else 'TLD_'+o.name
    for p in o.data.polygons:p.use_smooth=True
for image in bpy.data.images:
    if image.has_data:image.pack()
for pb in rig.pose.bones:pb.rotation_mode='XYZ'
rig.animation_data_clear()
for pb in rig.pose.bones:pb.matrix_basis.identity()
bpy.context.view_layer.update()
report={'height':1.78,'source':str(SOURCE),'rig':rig.name,'root_scale':list(root.scale),'rig_matrix':[list(r) for r in rig.matrix_world],
 'bones':{b.name:{'parent':b.parent.name if b.parent else None,'head':list(b.head_local),'tail':list(b.tail_local),'world_head':list(rig.matrix_world@b.head_local),'world_tail':list(rig.matrix_world@b.tail_local)} for b in rig.data.bones},
 'meshes':[],'actions':[a.name for a in bpy.data.actions]}
for ob in meshes:
    bad=0;max_influences=0
    for v in ob.data.vertices:
        total=sum(g.weight for g in v.groups);bad+=abs(total-1)>1e-4;max_influences=max(max_influences,len(v.groups))
    ob.data.calc_loop_triangles()
    report['meshes'].append({'name':ob.name,'vertices':len(ob.data.vertices),'triangles':len(ob.data.loop_triangles),'materials':len(ob.data.materials),'bad_weight_sums':bad,'max_influences':max_influences})

def cam(name,pos,target,lens=50):
    data=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob)
    ob.location=pos;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler();data.lens=lens;data.clip_start=.01;return ob
camera=cam('VIEW_Overview',(2.6,4.5,2.0),(0,0,.95),48)
front=cam('VIEW_Front',(0,4.8,1.0),(0,0,.92),48)
face=cam('VIEW_Face',(.35,1.05,1.73),(0,0,1.63),65)
back=cam('VIEW_Back',(-2,-4,1.8),(0,0,.95),48)
def light(name,pos,energy,size,color):
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size;data.color=color
    ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=pos;ob.rotation_euler=(Vector((0,0,.9))-ob.location).to_track_quat('-Z','Y').to_euler()
light('Key',(-3,4,4),420,4,(1,.89,.77));light('Fill',(3,2,2),250,3,(.70,.83,1));light('Rim',(0,-3,3),500,3,(.75,.85,1))
scene.world=bpy.data.worlds.new('TLD_Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.08,.10,.13,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
scene.render.engine='BLENDER_EEVEE';scene.eevee.use_gtao=True;scene.eevee.gtao_distance=.12;scene.eevee.taa_render_samples=32
scene.view_settings.view_transform='Standard';scene.view_settings.look='Medium High Contrast'
scene.render.resolution_x=1100;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
for ob in bpy.context.selected_objects:ob.select_set(False)
rig.select_set(True);bpy.context.view_layer.objects.active=rig
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            s=area.spaces.active;s.region_3d.view_location=(0,0,.94);s.region_3d.view_distance=3.2;s.region_3d.view_rotation=Vector((1,4,.8)).to_track_quat('Z','Y');s.shading.type='MATERIAL'
scene.camera=camera
(BASE/'review').mkdir(exist_ok=True)
(BASE/'inspection.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(BASE/'TLD_Survivor_Meshy_v02.blend'))
for name,camera in [('front',front),('overview',camera),('face',face),('back',back)]:
    scene.camera=camera;scene.render.filepath=str(BASE/'review'/(name+'.png'));bpy.ops.render.render(write_still=True)
print('MESHY_IMPORT_COMPLETE '+json.dumps({'bones':len(rig.data.bones),'meshes':report['meshes']}))
