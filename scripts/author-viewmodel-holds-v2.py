"""Author clean first-person holds in a preserved copy of the motion master.

Run export-viewmodel-animation-reference.mjs --v2 first, then Blender 2.93
--background --python scripts/author-viewmodel-holds-v2.py. Use -- --export-only
after manually editing POSE_* controls in the saved new Blender master.
The 38 existing action curves stay unchanged. This exports static display poses,
not aim/cadence/muzzle changes. Runtime still fits adult arms to live sockets.
"""
import bpy, json, math, sys, hashlib
from pathlib import Path
from mathutils import Matrix, Euler, Vector

ROOT=Path(__file__).resolve().parents[1]
ARCHIVE=ROOT/'.art-source/viewmodel-motion-v2'
SOURCE=ROOT/'.art-source/viewmodel-motion/The_Last_Dead_First_Person_Motion.blend'
BLEND=ARCHIVE/'The_Last_Dead_Clean_First_Person_Holds_v2.blend'
OUT=ROOT/'assets/survivor/viewmodel-hold-poses.js'
names=['ossuary','breach','arc','reliquary','carrion','mourning','bat','chainsaw']
positions=[(.30,-.365,-1.03),(.36,-.30,-1.04),(.32,-.335,-1.07),(.34,-.355,-1.13),(.31,-.325,-1.06),(.31,-.335,-1.10),(.32,-.34,-.85),(.31,-.38,-.97)]
rotations=[(.010,.10,-.025),(.025,.30,-.030),(.025,.16,-.030),(.020,.14,-.035),(.020,.12,-.035),(.025,.14,-.040),(0,0,0),(0,0,0)]
scales=[.56,.56,.56,.56,.56,.56,.58,.56]
ARCHIVE.mkdir(parents=True,exist_ok=True)
source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
if '--export-only' in sys.argv:
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
else:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    reference=json.loads((ARCHIVE/'reference.json').read_text())
    scene=bpy.context.scene
    for index,weapon in enumerate(reference['weapons']):
        name=names[index];control=bpy.data.objects['CTRL_'+name]
        # Keep the original animation control above the hold pose: its channels
        # remain camera-local, matching weaponRig -> weaponGroup at runtime.
        for child in list(control.children):bpy.data.objects.remove(child,do_unlink=True)
        pose=bpy.data.objects.new('POSE_'+name,None);scene.collection.objects.link(pose);pose.parent=control
        # Blender ZYX evaluation matches Three.js intrinsic XYZ composition,
        # as in the preserved motion master. Channel values stay x/y/z.
        pose.empty_display_type='ARROWS';pose.rotation_mode='ZYX'
        pose.location=positions[index];pose.rotation_euler=rotations[index];pose.scale=(scales[index],)*3
        pose['weapon_index']=index;pose['runtime_frame']='X right, Y up, -Z forward; absolute weapon group transform'
        pose['review_lead']=name in ['ossuary','carrion']
        base=weapon['groupTransform']
        source_matrix=Matrix.Translation(Vector(base['position'])) @ Euler(base['rotation'],'ZYX').to_matrix().to_4x4() @ Matrix.Diagonal((base['scale'],)*3+(1,))
        inverse=source_matrix.inverted()
        for surface in weapon['meshes']:
            points=list(zip(*[iter(surface['positions'])]*3))
            vertices=[inverse@Vector(p) for p in points]
            faces=list(zip(*[iter(surface['indices'])]*3))
            mesh=bpy.data.meshes.new(name+'/'+surface['name']);mesh.from_pydata(vertices,[],faces);mesh.update()
            obj=bpy.data.objects.new(name+'/'+surface['name'],mesh);scene.collection.objects.link(obj);obj.parent=pose
            material=bpy.data.materials.new(name+'/'+surface['name']);material.diffuse_color=(*surface['color'],1);mesh.materials.append(material)
            if surface.get('vertexColors'):
                colors=surface['vertexColors'];layer=mesh.vertex_colors.new(name='RuntimeFabricZones')
                for loop in mesh.loops:
                    i=loop.vertex_index*4;layer.data[loop.index].color=colors[i:i+4]
                material.use_nodes=True;color_node=material.node_tree.nodes.new('ShaderNodeVertexColor');color_node.layer_name='RuntimeFabricZones'
                material.node_tree.links.new(color_node.outputs['Color'],material.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
            for poly in mesh.polygons:poly.use_smooth=True
            obj['reference_only']=True
        control.animation_data.action=bpy.data.actions[name+'/draw']
        control.hide_viewport=control.hide_render=index!=0
        pose.hide_viewport=pose.hide_render=index!=0
        for child in pose.children:child.hide_viewport=child.hide_render=index!=0
    camera=scene.camera;camera.data.sensor_fit='VERTICAL'
    camera.data.lens=camera.data.sensor_height/(2*math.tan(math.radians(75)/2))
    camera.data.name='Clean first person 75 degrees vertical'
    scene.frame_set(121);scene.render.resolution_x=1280;scene.render.resolution_y=800
    scene['README']='Edit POSE_weapon for static hold; CTRL_weapon keeps all 38 original animation Actions. Run author-viewmodel-holds-v2.py --export-only to export the saved pose contract. Geometry is a posed reference; runtime live wrist/elbow fitting preserves adult metres independently of weapon display scale. Texture and shader proof requires actual game captures.'
    scene['normal_vertical_fov_degrees']=75
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))

poses=[]
for index,name in enumerate(names):
    control=bpy.data.objects['POSE_'+name]
    scale=list(control.scale)
    assert max(scale)-min(scale)<1e-7,'Display scale must be uniform'
    poses.append({'name':name,'position':[round(x,7)for x in control.location],
                  'rotation':[round(x,7)for x in control.rotation_euler],'scale':round(scale[0],7)})
OUT.write_text('// Generated from editable Blender POSE_* controls. Display only; gameplay aim/cadence are authoritative.\n'+
    'export const FIRST_PERSON_HOLD_POSES = Object.freeze('+json.dumps(poses,separators=(',',':'))+'.map(p=>Object.freeze({...p,position:Object.freeze(p.position),rotation:Object.freeze(p.rotation)})));\n')
actions=[a.name for a in bpy.data.actions if 'duration' in a]
assert len(actions)==38
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash
manifest={'source':str(SOURCE.relative_to(ROOT)),'source_sha256':source_hash,'authoring':str(BLEND.relative_to(ROOT)),
          'runtime':str(OUT.relative_to(ROOT)),'poses':poses,'animation_actions_preserved':actions,
          'normal_vertical_fov_degrees':75,'blender':bpy.app.version_string,
          'limitations':['Reference meshes are rigidly posed; runtime solves sleeve/hand articulation from live weapon sockets.',
                         'Pose review leads are Ossuary and Carrion. Other display defaults require game visual confirmation.',
                         'This does not establish headset VR support or alter gameplay aim/cadence.']}
(ARCHIVE/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('BLENDER_FIRST_PERSON_HOLDS',json.dumps({'poses':poses,'actions':len(actions),'authoring':str(BLEND),'runtime':str(OUT)}),flush=True)
