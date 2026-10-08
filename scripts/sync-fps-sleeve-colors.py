"""Transfer saved Blender sleeve COLOR_0 only to an identical draft export.

Asserts matching positions and byte-identical data outside color accessors.
Final delivery still uses the normal full exporter from the corrected master.
"""
import argparse,bpy,hashlib,json,struct,sys
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
ROOT=Path(__file__).resolve().parents[1]
master=ROOT/'.art-source/viewmodel-arms-v3/The_Last_Dead_Animated_FPS_Arms_v3.blend'
asset=ROOT/'assets/survivor/fps-arms-v3.glb'
p=argparse.ArgumentParser();p.add_argument('--previous')
opt=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
previous={}
if opt.previous:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/opt.previous))
    for obj in bpy.data.objects:
        if not obj.name.startswith('FPSSleeve_') or obj.get('tailored_sleeve_revision',0)<4:continue
        obj.data.calc_normals_split()
        previous[obj.name]={'points':[v.co.copy() for v in obj.data.vertices],
            'normals':[l.normal.copy() for l in obj.data.loops],
            'loops':[l.vertex_index for l in obj.data.loops],
            'weights':[[(obj.vertex_groups[g.group].name,g.weight) for g in v.groups] for v in obj.data.vertices]}
bpy.ops.wm.open_mainfile(filepath=str(master))
raw=bytearray(asset.read_bytes());original=bytes(raw);size=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+size]);base=28+size;changed=[];regions=[]
for obj in bpy.data.objects:
    if not obj.name.startswith('FPSSleeve_') or obj.get('tailored_sleeve_revision',0)<4:continue
    layer=obj.data.vertex_colors['AuthoredSurface'];colors=[None]*len(obj.data.vertices)
    for loop in obj.data.loops:colors[loop.vertex_index]=tuple(layer.data[loop.index].color)
    assert all(c is not None and max(c[:3])<.2 for c in colors),'Invalid source sleeve palette'
    node=next(n for n in doc['nodes'] if n.get('name')==obj.name)
    old=previous.get(obj.name)
    old_points=old['points'] if old else [v.co for v in obj.data.vertices]
    tree=KDTree(len(old_points))
    for i,point in enumerate(old_points):
        tree.insert(Vector((point.x,point.z,-point.y)),i)
    tree.balance()
    loop_indices={}
    if old:
        assert len(old_points)==len(obj.data.vertices) and old['loops']==[l.vertex_index for l in obj.data.loops],'Draft topology changed'
        assert old['weights']==[[(obj.vertex_groups[g.group].name,g.weight) for g in v.groups] for v in obj.data.vertices],'Draft weights changed'
        obj.data.calc_normals_split()
        for i,v in enumerate(old['loops']):loop_indices.setdefault(v,[]).append(i)
    for primitive in doc['meshes'][node['mesh']]['primitives']:
        pa=doc['accessors'][primitive['attributes']['POSITION']];pv=doc['bufferViews'][pa['bufferView']]
        ca=doc['accessors'][primitive['attributes']['COLOR_0']];cv=doc['bufferViews'][ca['bufferView']]
        assert pa['componentType']==5126 and ca['componentType']==5123 and ca['type']=='VEC4'
        po=base+pv.get('byteOffset',0)+pa.get('byteOffset',0);co=base+cv.get('byteOffset',0)+ca.get('byteOffset',0)
        if old:
            na=doc['accessors'][primitive['attributes']['NORMAL']];nv=doc['bufferViews'][na['bufferView']]
            no=base+nv.get('byteOffset',0)+na.get('byteOffset',0)
        for i in range(pa['count']):
            p=Vector(struct.unpack_from('<3f',raw,po+i*pv.get('byteStride',12)))
            _,index,distance=tree.find(p);assert distance<1e-6,'Source/draft geometry differs'
            if old:
                atn=no+i*nv.get('byteStride',12);normal=Vector(struct.unpack_from('<3f',raw,atn));normal=Vector((normal.x,-normal.z,normal.y))
                loop=max(loop_indices[index],key=lambda k:old['normals'][k].dot(normal))
                assert old['normals'][loop].dot(normal)>.99,'Draft/source split normal differs'
                new_p=obj.data.vertices[index].co;new_n=obj.data.loops[loop].normal
                atp=po+i*pv.get('byteStride',12)
                struct.pack_into('<3f',raw,atp,new_p.x,new_p.z,-new_p.y);regions.append((atp,atp+12))
                struct.pack_into('<3f',raw,atn,new_n.x,new_n.z,-new_n.y);regions.append((atn,atn+12))
            c=colors[index];linear=[x/12.92 if x<.04045 else ((x+.055)/1.055)**2.4 for x in c[:3]]
            at=co+i*cv.get('byteStride',8);struct.pack_into('<4H',raw,at,*[round(x*65535) for x in (*linear,c[3])]);regions.append((at,at+8))
    changed.append(obj.name)
# Explicitly verify that only the measured color byte ranges changed.
unchanged=bytearray(raw)
for lo,hi in regions:unchanged[lo:hi]=original[lo:hi]
assert bytes(unchanged)==original
asset.write_bytes(raw)
mp=ROOT/'assets/survivor/fps-arms-v3-manifest.json';manifest=json.loads(mp.read_text());manifest['sha256']=hashlib.sha256(raw).hexdigest();mp.write_text(json.dumps(manifest,indent=2))
print('DRAFT_SURFACE_TRANSFER_PASS' if old else 'DRAFT_COLOR_ONLY_PASS',changed,flush=True)
