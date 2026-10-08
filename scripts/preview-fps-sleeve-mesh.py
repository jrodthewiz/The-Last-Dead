"""Draft mesh replacement from saved Blender; retain existing animation bytes.

Used only for the representative visual gate. Final delivery uses the normal
Blender glTF exporter. Existing rigs, skin bind matrices, Actions and other
meshes are checked for exact JSON preservation; original binary is retained.
"""
import bpy,hashlib,json,math,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
master=ROOT/'.art-source/viewmodel-arms-v3/The_Last_Dead_Animated_FPS_Arms_v3.blend'
asset=ROOT/'assets/survivor/fps-arms-v3.glb'
bpy.ops.wm.open_mainfile(filepath=str(master))
raw=asset.read_bytes();size=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+size]);binary=bytearray(raw[28+size:]);original=bytes(binary)
protected=json.dumps([doc['nodes'],doc['skins'],doc['animations']],sort_keys=True)
changed=[]
def accessor(values,fmt,kind,component,normalized=False,bounds=False):
    while len(binary)%4:binary.append(0)
    start=len(binary);n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[kind]
    binary.extend(struct.pack('<'+fmt*len(values),*values))
    view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':len(binary)-start})
    a={'bufferView':view,'componentType':component,'count':len(values)//n,'type':kind}
    if normalized:a['normalized']=True
    if bounds:
        a['min']=[min(values[k::n]) for k in range(n)];a['max']=[max(values[k::n]) for k in range(n)]
    index=len(doc['accessors']);doc['accessors'].append(a);return index
for obj in bpy.data.objects:
    if not obj.name.startswith('FPSSleeve_') or obj.get('tailored_sleeve_revision',0)<8:continue
    node=next(n for n in doc['nodes'] if n.get('name')==obj.name)
    joints=[doc['nodes'][j]['name'] for j in doc['skins'][node['skin']]['joints']]
    data=obj.data;data.calc_normals_split();data.calc_loop_triangles()
    colors=data.vertex_colors['AuthoredSurface'];uv=data.uv_layers.active
    positions=[];normals=[];tex=[];palette=[];indices=[];skin=[];weights=[]
    for loop in data.loops:
        vertex=data.vertices[loop.vertex_index];p=vertex.co;n=loop.normal
        positions.extend((p.x,p.z,-p.y));normals.extend((n.x,n.z,-n.y));tex.extend((uv.data[loop.index].uv.x,1-uv.data[loop.index].uv.y))
        color=colors.data[loop.index].color
        assert max(color[:3])<.25,'Draft palette missing'
        linear=[c/12.92 if c<.04045 else ((c+.055)/1.055)**2.4 for c in color[:3]]
        palette.extend(round(c*65535) for c in (*linear,color[3]))
        influences=[(joints.index(obj.vertex_groups[g.group].name),g.weight) for g in vertex.groups if g.weight>1e-7]
        assert 0<len(influences)<=4 and abs(sum(w for _,w in influences)-1)<1e-4
        influences += [(0,0)]*(4-len(influences))
        skin.extend(j for j,w in influences);weights.extend(w for j,w in influences)
    for triangle in data.loop_triangles:indices.extend(triangle.loops)
    old=doc['meshes'][node['mesh']]['primitives'];assert len(old)==1
    attributes={'POSITION':accessor(positions,'f','VEC3',5126,bounds=True),
      'NORMAL':accessor(normals,'f','VEC3',5126),'TEXCOORD_0':accessor(tex,'f','VEC2',5126),
      'COLOR_0':accessor(palette,'H','VEC4',5123,normalized=True),
      'JOINTS_0':accessor(skin,'H','VEC4',5123),'WEIGHTS_0':accessor(weights,'f','VEC4',5126)}
    doc['meshes'][node['mesh']]['primitives']=[{'attributes':attributes,'indices':accessor(indices,'I','SCALAR',5125),'material':old[0]['material']}]
    changed.append(obj.name)
assert protected==json.dumps([doc['nodes'],doc['skins'],doc['animations']],sort_keys=True)
assert bytes(binary[:len(original)])==original
while len(binary)%4:binary.append(0)
doc['buffers'][0]['byteLength']=len(binary)
encoded=json.dumps(doc,separators=(',',':')).encode()
while len(encoded)%4:encoded+=b' '
result=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
asset.write_bytes(result)
mp=ROOT/'assets/survivor/fps-arms-v3-manifest.json';manifest=json.loads(mp.read_text());manifest.update({'sha256':hashlib.sha256(result).hexdigest(),'bytes':len(result),'acceptance':'Draft representative garment gate; full Blender export and user approval pending'})
mp.write_text(json.dumps(manifest,indent=2))
print('DRAFT_MESH_PASS',changed,flush=True)
