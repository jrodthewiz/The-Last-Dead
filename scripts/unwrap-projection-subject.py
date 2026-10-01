"""Blender 2.93 CPU-only UV preparation. Does not render or change source geometry."""
import bpy,sys,json,os,math
args=sys.argv[sys.argv.index('--')+1:]
folder=os.path.abspath(args[0]);source=json.load(open(os.path.join(folder,'source.json')))
bpy.ops.wm.read_factory_settings(use_empty=True)
verts=[];faces=[];normals=[];roles=[];materials=[]
for part in source['parts']:
    offset=len(verts)
    verts.extend(tuple(part['positions'][i:i+3]) for i in range(0,len(part['positions']),3))
    normals.extend(tuple(part['normals'][i:i+3]) for i in range(0,len(part['normals']),3))
    faces.extend(tuple(offset+x for x in part['indices'][i:i+3]) for i in range(0,len(part['indices']),3))
    roles.extend([len(materials)]*(len(part['indices'])//3))
    materials.append({k:part[k] for k in ['name','color','roughness','metalness','role']})
mesh=bpy.data.meshes.new(source['kind']);mesh.from_pydata(verts,[],faces);mesh.update()
obj=bpy.data.objects.new(source['kind'],mesh);bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active=obj;obj.select_set(True)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.018)
bpy.ops.object.mode_set(mode='OBJECT')
uv=mesh.uv_layers.active.data
triangles=[]
for face in mesh.polygons:
    triangles.append({'vertices':list(face.vertices),'uv':[list(uv[i].uv) for i in face.loop_indices],'material':roles[face.index]})
result={'version':1,'kind':source['kind'],'positions':verts,'normals':normals,'triangles':triangles,'materials':materials,'dimensions':source['dimensions'],'source':source['source'],'sourceVertices':source['sourceVertices']}
json.dump(result,open(os.path.join(folder,'unwrapped.json'),'w'),separators=(',',':'))
# Editable authoring archive; no Blender requirement in the game.
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(folder,'authoring.blend'))
print('UNWRAPPED',source['kind'],len(triangles),'triangles; UV loops',len(mesh.loops))
