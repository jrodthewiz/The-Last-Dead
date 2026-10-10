"""Export saved artist edits; --prepare adds reference hardware and rig groups.

Never rebuilds meshes or overwrites artist Actions. Run after the scratch
generator, or directly to export an edited V5 master. Blender 2.93 headless.
"""
import bpy, json, math, hashlib, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
MASTER=ROOT/'.art-source/fps-arms-v5/The_Last_Dead_FPS_Arms_v5.blend'
OUT=ROOT/'assets/survivor/fps-arms-v5.glb'
bpy.ops.wm.open_mainfile(filepath=str(MASTER))
def B(p):return Vector((p[0],-p[2],p[1]))
if '--prepare' in sys.argv:
    # Offline PBR detail authored in Blender. Embedded normal/roughness maps
    # make leather grain and cloth weave respond to light, rather than only
    # painting random colors onto a smooth surface.
    for mat in [m for m in bpy.data.materials if m.name.startswith('V5 ')]:
        if mat.get('pbr_surface_revision')==5:continue
        cloth='jacket' in mat.name;size=256
        normals=[];roughness=[]
        for y in range(size):
            v=y/size
            for x in range(size):
                u=x/size
                if cloth:
                    nx=.18*math.sin(math.tau*u*64)*(1+.25*math.cos(math.tau*v*64))
                    ny=.18*math.sin(math.tau*v*64)*(1+.25*math.cos(math.tau*u*64))
                    r=.86+.045*math.sin(math.tau*u*64)*math.sin(math.tau*v*64)
                else:
                    phase=math.tau*(u*37+v*29)
                    nx=.13*math.sin(phase+1.1*math.sin(math.tau*v*13))+.07*math.sin(math.tau*(u*61-v*47))
                    ny=.13*math.cos(phase+1.1*math.sin(math.tau*u*17))+.07*math.cos(math.tau*(u*43+v*59))
                    r=.72+.07*math.sin(phase)*math.cos(math.tau*(u*19-v*23))
                nz=math.sqrt(max(0,1-nx*nx-ny*ny))
                normals.extend((nx*.5+.5,ny*.5+.5,nz*.5+.5,1));roughness.extend((r,r,r,1))
        images=[]
        for label,pixels in [('normal',normals),('roughness',roughness)]:
            image=bpy.data.images.new(('cloth' if cloth else 'leather')+'-'+label+'-v5',width=size,height=size,alpha=False)
            image.colorspace_settings.name='Non-Color';image.pixels[:]=pixels;image.pack();images.append(image)
        nodes=mat.node_tree.nodes;links=mat.node_tree.links;shader=nodes['Principled BSDF']
        normal_tex=nodes.new('ShaderNodeTexImage');normal_tex.image=images[0]
        normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.55 if cloth else .7
        links.new(normal_tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],shader.inputs['Normal'])
        rough_tex=nodes.new('ShaderNodeTexImage');rough_tex.image=images[1]
        channels=nodes.new('ShaderNodeSeparateRGB');links.new(rough_tex.outputs['Color'],channels.inputs['Image']);links.new(channels.outputs['G'],shader.inputs['Roughness'])
        mat['pbr_surface_revision']=5
    for obj in bpy.data.objects:
        if obj.type!='MESH' or obj.get('surface_weave_uv')==5:continue
        if obj.name.startswith('FPSSleeve_'):
            for loop in obj.data.uv_layers.active.data:loop.uv.x*=5;loop.uv.y*=16
        elif obj.name.startswith('FPSGlove_'):
            for loop in obj.data.uv_layers.active.data:loop.uv*=2
        else:continue
        obj['surface_weave_uv']=5
    ref=json.loads((ROOT/'.art-source/viewmodel-arms-v3/rig-reference.json').read_text())
    for weapon in ref['weapons']:
        name=weapon['name'];root=bpy.data.objects['FPSRig_'+name]
        collection=bpy.data.collections.get('FPS V5 / '+name)
        if collection is None:
            collection=bpy.data.collections.new('FPS V5 / '+name);bpy.context.scene.collection.children.link(collection)
        def move(obj):
            if obj.name not in collection.objects:collection.objects.link(obj)
            for old in list(obj.users_collection):
                if old!=collection:old.objects.unlink(obj)
            for child in list(obj.children):move(child)
        if not bpy.data.objects.get('HardwareReference_'+name):
            hardware=bpy.data.objects.new('HardwareReference_'+name,None);bpy.context.scene.collection.objects.link(hardware);hardware.parent=root;hardware['fps_reference_only']=True
            for i,surface in enumerate(weapon['weaponReferences']):
                data=bpy.data.meshes.new('HardwareReferenceMesh');data.from_pydata([B(p) for p in zip(*[iter(surface['positions'])]*3)],[],list(zip(*[iter(surface['indices'])]*3)));data.update()
                obj=bpy.data.objects.new('HardwareReference_'+name+'_'+str(i),data);bpy.context.scene.collection.objects.link(obj);obj.parent=hardware;obj['fps_reference_only']=True
                mat=bpy.data.materials.new('HardwareReferenceMaterial');mat.diffuse_color=(*surface['color'],1);data.materials.append(mat)
        move(root);collection.hide_viewport=name!='breach';collection.hide_render=name!='breach'
        rig=bpy.data.objects['FPSBones_'+name]
        for label,color in [('Arm / contact','THEME04'),('Fingers / flex X','THEME03'),('Cloth / runtime','THEME05')]:
            group=rig.pose.bone_groups.get(label) or rig.pose.bone_groups.new(name=label);group.color_set=color
        for pb in rig.pose.bones:
            pb.lock_location=(True,True,True);pb.lock_scale=(True,True,True)
            digit=any(d in pb.name for d in ['Index','Middle','Ring','Little','Thumb'])
            pb.bone_group=rig.pose.bone_groups['Fingers / flex X' if digit else 'Cloth / runtime' if pb.name.endswith('Cloth') else 'Arm / contact']
            if digit:pb['control']='Local X flexion. Joint neighbors share skin weights; palm remains rigid.'
        for track in rig.animation_data.nla_tracks:track.mute=not(name=='breach' and track.name=='breach/idle')
    bpy.ops.object.select_all(action='DESELECT');rig=bpy.data.objects['FPSBones_breach'];rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
for collection in bpy.data.collections:collection.hide_viewport=False;collection.hide_render=False
for obj in bpy.data.objects:
    if obj.type=='ARMATURE' and obj.animation_data:
        for track in obj.animation_data.nla_tracks:track.mute=True
bpy.context.scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.type in ['MESH','ARMATURE','EMPTY'] and not obj.get('fps_reference_only'):obj.hide_set(False);obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_texcoords=True,export_normals=True,export_colors=True,export_materials='EXPORT',export_extras=True,export_animations=True,export_nla_strips=True,export_frame_range=False,export_force_sampling=True)
path=OUT.with_name(OUT.stem+'-manifest.json');manifest=json.loads(path.read_text())
manifest.update({'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'bytes':OUT.stat().st_size,'sourceSha256':hashlib.sha256(MASTER.read_bytes()).hexdigest()})
for p,digest in manifest['protected_source_hashes'].items():assert hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==digest
path.write_text(json.dumps(manifest,indent=2));print('ARTIST_EXPORT_V5',OUT.stat().st_size,flush=True)
