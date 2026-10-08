"""Repair joined Blender seam colors and transfer only COLOR_0 to an export.

Geometry, skin, transforms and Actions stay byte-identical in the GLB. This
bounded color preview avoids baking all 32 clips again for a palette fix.
The full final export must use the corrected refine-fps-glove-seams-v3.py.
"""
import bpy,hashlib,json,math,struct
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
ROOT=Path(__file__).resolve().parents[1]
archive=ROOT/'.art-source/viewmodel-arms-v3'
master=archive/'The_Last_Dead_Animated_FPS_Arms_v3.blend'
asset=ROOT/'assets/survivor/fps-arms-v3.glb'
out=ROOT/'output/playwright/first-person-parity/iteration-07'
bpy.ops.wm.open_mainfile(filepath=str(master))
study=json.loads((out/'breach-seams-source.json').read_text())
raw=bytearray(asset.read_bytes());before=hashlib.sha256(raw).hexdigest()
json_size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+json_size]);bin_start=28+json_size
report={'inputGlbSha256':before,'hands':[]}
for row in study['hands']:
    name='FPSGlove_'+row['weapon']+'_'+row['side'];hand=bpy.data.objects[name]
    start=row['sourceVertices'];assert len(hand.data.vertices)==start+1792
    layer=hand.data.vertex_colors['AuthoredSurface'];seam_colors=[]
    for offset,rings in [(0,128),(1024,96)]:
        along=0;previous=None
        for k in range(rings):
            centre=sum((hand.data.vertices[start+offset+k*8+j].co for j in range(8)),Vector())/8
            if previous is not None: along+=(centre-previous).length
            previous=centre
            color=(.181,.122,.067)if along%.0045<.0025 else(.028,.018,.009)
            seam_colors.extend([color]*8)
    for loop in hand.data.loops:
        index=loop.vertex_index-start
        if index>=0: layer.data[loop.index].color=(*seam_colors[index],1)
    for other in list(hand.data.vertex_colors):
        if other.name!='AuthoredSurface':hand.data.vertex_colors.remove(other)
    hand.data.vertex_colors.active_index=0;hand['seam_source_vertices']=start
    colors=[None]*len(hand.data.vertices)
    for loop in hand.data.loops:colors[loop.vertex_index]=tuple(layer.data[loop.index].color)
    assert all(c is not None for c in colors)
    node=next(n for n in doc['nodes']if n.get('name')==name);primitives=doc['meshes'][node['mesh']]['primitives'];assert len(primitives)==1
    primitive=primitives[0]
    pos=doc['accessors'][primitive['attributes']['POSITION']];pv=doc['bufferViews'][pos['bufferView']]
    col=doc['accessors'][primitive['attributes']['COLOR_0']];cv=doc['bufferViews'][col['bufferView']]
    assert pos['componentType']==5126 and col['componentType']==5123 and col['type']=='VEC4'
    p_offset=bin_start+pv.get('byteOffset',0)+pos.get('byteOffset',0);p_stride=pv.get('byteStride',12)
    c_offset=bin_start+cv.get('byteOffset',0)+col.get('byteOffset',0);c_stride=cv.get('byteStride',8)
    trees=[]
    for axes in ['gltf-y-up','blender-z-up']:
        tree=KDTree(len(hand.data.vertices))
        for vertex in hand.data.vertices:
            p=vertex.co;tree.insert(Vector((p.x,p.z,-p.y))if axes=='gltf-y-up'else p,vertex.index)
        tree.balance();trees.append((axes,tree))
    checks=[Vector(struct.unpack_from('<3f',raw,p_offset+i*p_stride))for i in range(0,pos['count'],max(1,pos['count']//100))]
    axes,tree=min(trees,key=lambda item:sum(item[1].find(p)[2]for p in checks))
    maximum=0;changed=0;seam_vertices=0
    for i in range(pos['count']):
        p=Vector(struct.unpack_from('<3f',raw,p_offset+i*p_stride));_,index,distance=tree.find(p);maximum=max(maximum,distance)
        assert distance<1e-6,'Export/source vertex coordinates differ; full export required'
        # Blender 2.93 exposes stored byte colors in sRGB. Match its glTF
        # exporter conversion rather than feeding those bytes as linear light.
        source=colors[index]
        linear=tuple(c/12.92 if c<.04045 else ((c+.055)/1.055)**2.4 for c in source[:3])
        value=tuple(max(0,min(65535,round(c*65535)))for c in (*linear,source[3]))
        at=c_offset+i*c_stride
        if struct.unpack_from('<4H',raw,at)!=value:changed+=1
        if index>=start:seam_vertices+=1
        struct.pack_into('<4H',raw,at,*value)
    report['hands'].append({'name':name,'coordinateFrame':axes,'maximumMappingErrorM':maximum,'changedExportVertices':changed,'exportSeamVertices':seam_vertices,'colorLayers':[l.name for l in hand.data.vertex_colors],'colorTransfer':'Blender stored sRGB to glTF linear COLOR_0'})
assert len(raw)==asset.stat().st_size
bpy.ops.wm.save_as_mainfile(filepath=str(master))
asset.write_bytes(raw)
manifest_path=ROOT/'assets/survivor/fps-arms-v3-manifest.json';manifest=json.loads(manifest_path.read_text())
manifest['sha256']=hashlib.sha256(raw).hexdigest();manifest['blenderJoinedColorRepair']='Named authored layer reasserted after join; only COLOR_0 transferred from saved Blender vertices'
manifest_path.write_text(json.dumps(manifest,indent=2))
report['outputGlbSha256']=manifest['sha256'];report['masterSha256']=hashlib.sha256(master.read_bytes()).hexdigest();report['status']='PASS: color-only source/export correction; native artistic gate separate'
(out/'breach-seam-color-repair.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
