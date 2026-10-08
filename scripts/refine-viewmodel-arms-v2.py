"""Refine the preserved editable Blender hand master for clean first person.

Blender 2.93 --background --factory-startup --python scripts/refine-viewmodel-arms-v2.py
Use -- --export-only after editing and saving the v2 .blend to preserve those edits.
No render/GPU work. Original v1 and survivor bytes are read-only. The exported
ordinary hand pivots retain the weapon contract; the interaction skin is grafted
byte-for-byte from the accepted v1 GLB after Blender exports ordinary surfaces.
"""
import bpy, bmesh, math, json, struct, copy, hashlib, sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / '.art-source/viewmodel-arms-v2'
ARCHIVE.mkdir(parents=True, exist_ok=True)
SOURCE_BLEND = ROOT / '.art-source/viewmodel-arms-v1/Viewmodel_Arms_v1.blend'
SOURCE_GLB = ROOT / 'assets/survivor/viewmodel-arms-v1.glb'
OUT = ROOT / 'assets/survivor/viewmodel-arms-v2.glb'

def glb_read(path):
    raw = path.read_bytes(); size = struct.unpack_from('<I', raw, 12)[0]
    return json.loads(raw[20:20+size]), raw[28+size:]

def glb_write(path, doc, payload):
    while len(payload) % 4: payload += b'\x00'
    doc['buffers'][0]['byteLength'] = len(payload)
    encoded = json.dumps(doc, separators=(',', ':')).encode()
    while len(encoded) % 4: encoded += b' '
    path.write_bytes(struct.pack('<III', 0x46546c67, 2, 28+len(encoded)+len(payload)) +
                     struct.pack('<II', len(encoded), 0x4e4f534a) + encoded +
                     struct.pack('<II', len(payload), 0x004e4942) + payload)

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
source_hashes = {str(p.relative_to(ROOT)): sha(p) for p in [SOURCE_BLEND, SOURCE_GLB, ROOT/'assets/survivor/tld-survivor-v02.glb']}
EXPORT_ONLY = '--export-only' in sys.argv
MASTER = ARCHIVE/'The_Last_Dead_Clean_First_Person_Arms_v2.blend'
bpy.ops.wm.open_mainfile(filepath=str(MASTER if EXPORT_ONLY else SOURCE_BLEND))
if not EXPORT_ONLY:
    source_inspection = [{'name': o.name, 'type': o.type,
        'vertices': len(o.data.vertices) if o.type == 'MESH' else None,
        'materials': [m.name for m in o.data.materials] if o.type == 'MESH' else [],
        'local_location': list(o.location), 'local_rotation': list(o.rotation_euler)} for o in bpy.data.objects]
    (ARCHIVE/'source-inspection.json').write_text(json.dumps(source_inspection, indent=2))

    def color_material(name, color, roughness):
        mat = bpy.data.materials.new(name); mat.use_nodes = True; mat.use_backface_culling = True
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = (*color, 1)
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Specular'].default_value = .20
        return mat

    cloth = color_material('TLD_Graphic_Canvas_v2', (.060, .098, .104), .88)
    vertex_color = cloth.node_tree.nodes.new('ShaderNodeVertexColor'); vertex_color.layer_name = 'AuthoredFabricZones'
    cloth.node_tree.links.new(vertex_color.outputs['Color'], cloth.node_tree.nodes['Principled BSDF'].inputs['Base Color'])

    def catmull(points,t):
        i=min(len(points)-2,int(t));f=t-i
        p0,p1,p2,p3=[Vector(points[max(0,min(len(points)-1,k))]) for k in [i-1,i,i+1,i+2]]
        return .5*((2*p1)+(-p0+p2)*f+(2*p0-5*p1+4*p2-p3)*f*f+(-p0+3*p1-3*p2+p3)*f*f*f)

    def digit_frame(points,fraction,origin):
        t=(len(points)-1)*fraction;center=catmull(points,t)
        tangent=(catmull(points,min(len(points)-1,t+.018))-catmull(points,max(0,t-.018))).normalized()
        absolute=center+Vector(origin);normal=Vector((absolute.x,0,absolute.z));normal-=tangent*normal.dot(tangent)
        if normal.length<1e-7:normal=Vector((0,1,0))-tangent*tangent.y
        normal.normalize();return center,normal,tangent.cross(normal).normalized()

    def authored_trigger_reach():
        # Root sockets remain fixed. Seat the index MCP inside the glove and
        # extend a naturally bent adult digit onto the existing trigger rather
        # than curling all four fingers around the handle. Other digits stay put.
        old=[(.050,.043,-.016),(.052,.041,.007),(.035,.039,.030),(.010,.036,.036),(-.015,.033,.027),(-.025,.029,.007)]
        new=[(.032,.043,-.016),(.016,.048,-.003),(-.007,.055,.008),(-.029,.061,.014),(-.048,.063,.008),(-.065,.059,-.002)]
        oldorigin=old[0];neworigin=new[0]
        oldlocal=[tuple(Vector(p)-Vector(oldorigin))for p in old]
        newlocal=[tuple(Vector(p)-Vector(neworigin))for p in new]
        for name in ['GripIndex_Right','NailIndex_Right']:
            obj=bpy.data.objects[name]
            for vertex in obj.data.vertices:
                if name.startswith('Grip'):
                    fraction=min(56,vertex.index//32)/56
                else:fraction=.800+(vertex.index//15)/10*.108
                oldcenter,oldnormal,oldbinormal=digit_frame(oldlocal,fraction,oldorigin)
                newcenter,newnormal,newbinormal=digit_frame(newlocal,fraction,neworigin)
                point=Vector((vertex.co.x,vertex.co.z,-vertex.co.y));radial=point-oldcenter
                point=newcenter+newnormal*radial.dot(oldnormal)+newbinormal*radial.dot(oldbinormal)
                vertex.co=(point.x,-point.z,point.y)
            obj.data.update();obj['contact_centerline_preserved']=False
            obj['surface_revision']=3;obj['edit']='Blender authored bent index reach to the actual trigger'
        pivot=bpy.data.objects['RightTriggerFinger'];pivot.location=(neworigin[0],-neworigin[2],neworigin[1])
        pivot['pose']='Trigger reach; native adult digit, MCP seated in glove'

    authored_trigger_reach()

    def garment(side, upper=False):
        old = bpy.data.objects[('TLD_UpperSleeve_' if upper else 'TLD_ViewSleeve_')+side]
        collections = list(old.users_collection); name = old.name
        bpy.data.objects.remove(old, do_unlink=True)
        # Profile in the existing metric joint frame. The wrist starts at y=0,
        # forearm ends -.34 m; upper sleeve spans 0 .. -.40 m. Cuff folds belong
        # to the mesh surface, not stacked cylinder/sphere accessories.
        if upper:
            keys=[(0,.053,.052),(.025,.057,.053),(.070,.066,.061),(.15,.072,.064),(.25,.069,.064),(.34,.066,.063),(.40,.063,.060)]
            rows, length = 33, .40
        else:
            keys=[(0,.028,.027),(.018,.030,.028),(.034,.032,.030),(.043,.038,.034),(.053,.040,.036),(.07,.038,.034),(.10,.039,.035),(.16,.045,.040),(.23,.049,.043),(.29,.052,.046),(.34,.053,.052)]
            rows, length = 41, .34
        segments = 40; positions=[]; colors=[]; faces=[]
        sign = -1 if side == 'Left' else 1
        for row in range(rows):
            t=row/(rows-1); y=length*t
            k=next((j for j in range(len(keys)-1) if y<=keys[j+1][0]),len(keys)-2)
            a,b=keys[k:k+2]; f=(y-a[0])/max(1e-9,b[0]-a[0]); f=f*f*(3-2*f)
            rx=a[1]+(b[1]-a[1])*f; rz=a[2]+(b[2]-a[2])*f
            for col in range(segments):
                angle=col/segments*math.tau; c,s=math.cos(angle),math.sin(angle)
                # Draped folds: elbow compression, lengthwise seam and softer cuff.
                folds=(.025*math.sin(angle*5+y*54)+.018*math.sin(angle*8-y*38))*math.sin(math.pi*t)**.5
                elbow=.035*math.exp(-((y-(.065 if upper else .29))/.045)**2)*math.sin(angle*3-y*85)
                cuff=.055*math.exp(-((y-.052)/.018)**2)*math.sin(y*210) if not upper else 0
                seam=.017*math.exp(-((math.atan2(math.sin(angle-1.9),math.cos(angle-1.9)))/.16)**2)
                factor=1+folds+elbow+cuff+seam
                cx=sign*.005*math.sin(math.pi*t); cz=.005*math.sin(math.pi*t)
                # Blender coordinates retain the GLTF Y-up joint convention.
                positions.append((cx+c*rx*factor,-(cz+s*rz*factor),-y))
                if not upper and y<.036:
                    # Warm wrist occupies only the short real wrist transition.
                    colr=(.31,.19,.13)
                elif not upper and y<.061: colr=(.037,.053,.052)
                else:
                    wear=1+.08*max(0,c)+.035*math.sin(angle*11+y*91)
                    colr=tuple(v*wear for v in (.060,.098,.104))
                colors.append((*colr,1))
        for row in range(rows-1):
            for col in range(segments):
                a=row*segments+col; b=row*segments+(col+1)%segments
                faces.append((a,b,b+segments,a+segments))
        faces += [tuple(reversed(range(segments))), tuple((rows-1)*segments+k for k in range(segments))]
        data=bpy.data.meshes.new(name+'_AuthoredCanvas'); data.from_pydata(positions,[],faces); data.update()
        bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
        obj=bpy.data.objects.new(name,data)
        for collection in collections: collection.objects.link(obj)
        data.materials.append(cloth)
        uv=data.uv_layers.new(name='CanvasMetricUV'); vc=data.vertex_colors.new(name='AuthoredFabricZones')
        for face in data.polygons:
            face.use_smooth=len(face.vertices)==4
            for li in face.loop_indices:
                vi=data.loops[li].vertex_index; uv.data[li].uv=(vi%segments/segments,vi//segments/(rows-1));vc.data[li].color=colors[vi]
        obj['source']='Original survivor hand contract; new authored Blender fitted canvas garment'
        obj['metric_scale']=1;obj['surface_revision']=2
        if upper:
            obj['elbow_position']=[0,0,0];obj['shoulder_position']=[0,-.40,0];obj['maximum_radial_envelope']=.080
            obj['caps']=[{'name':'UpperShoulderCap_'+side,'center':[0,-.40,0],'radius':.064,'storage':'closed upper mesh'}, {'name':'UpperElbowCap_'+side,'center':[0,0,0],'radius':.055,'storage':'closed upper mesh'}]
        else: obj['wrist_position']=[0,0,0];obj['elbow_position']=[0,-.34,0];obj['bare_wrist_length']=.036
        return obj

    ordinary=[]
    for side in ['Left','Right']:
        ordinary += [garment(side),garment(side,True),bpy.data.objects['TLD_GripHand_'+side]]
        # The glove follows the metacarpal arch; preserve all anatomical digit
        # pivots and contact centerlines. Soften the dorsal glove ridges only.
        palm=bpy.data.objects['GripPalm_'+side]
        for v in palm.data.vertices:
            y=v.co.z
            if -.045<y<.045:
                weight=math.sin((y+.045)/.09*math.pi)
                v.co.y*=1-.045*weight
        palm['surface_revision']=3; palm['edit']='softened glove dorsum; preserved heel, grip centre and digit roots'
        # Existing hands are heavily oversampled for the number of on-screen
        # pixels. Reduce interior rows while retaining their curved silhouettes.
        for child in [o for o in bpy.data.objects if o.type=='MESH' and (o.name.startswith('Grip') or o.name.startswith('Nail')) and o.name.endswith('_'+side)]:
            # The old master retained source-projection bake colors. v1 did not
            # export them: multiplying those colors with its live atlas again
            # gives orange skin. Only the new garment owns runtime vertex colors.
            for layer in list(child.data.vertex_colors):child.data.vertex_colors.remove(layer)
            modifier=child.modifiers.new('CloseCameraTopologyBudget','DECIMATE');modifier.ratio=.58 if child.name.startswith('Grip') else .72
            bpy.context.view_layer.objects.active=child
            bpy.ops.object.modifier_apply(modifier=modifier.name)

    # Keep authored source texels, downsample the three ordinary hand maps for
    # their small coverage. Interaction image bytes are copied separately below.
    for image in bpy.data.images:
        if image.name.startswith(('TLD_Authored_Arms_Albedo','TLD_Digit_')):
            image.scale(1024,1024);image.pack()

    scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
    scene['viewmodel_revision']=2; scene['coordinate_contract']='glTF Y-up metres, wrist/grip origins unchanged'
    bpy.ops.wm.save_as_mainfile(filepath=str(ARCHIVE/'The_Last_Dead_Clean_First_Person_Arms_v2.blend'))
ordinary=[bpy.data.objects[prefix+side] for side in ['Left','Right'] for prefix in ['TLD_ViewSleeve_','TLD_UpperSleeve_','TLD_GripHand_']]
selected=set()
def descendants(o):
    selected.add(o)
    for child in o.children: descendants(child)
for root in ordinary: descendants(root)
for obj in bpy.data.objects: obj.select_set(obj in selected)
bpy.context.view_layer.objects.active=ordinary[0]
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_texcoords=True,
    export_normals=True,export_colors=True,export_materials='EXPORT',export_extras=True,export_animations=False)

def preserve_interaction():
    target,payload=glb_read(OUT);old,binary=glb_read(SOURCE_GLB);payload=bytearray(payload)
    maps={k:{} for k in ['bufferViews','accessors','images','textures','materials']}
    def copy_index(kind,index):
        if index in maps[kind]: return maps[kind][index]
        value=copy.deepcopy(old[kind][index])
        if kind=='bufferViews':
            while len(payload)%4: payload.append(0)
            offset=len(payload); start=value.get('byteOffset',0);payload.extend(binary[start:start+value['byteLength']]);value['buffer']=0;value['byteOffset']=offset
        elif kind=='accessors':value['bufferView']=copy_index('bufferViews',value['bufferView'])
        elif kind=='images':value['bufferView']=copy_index('bufferViews',value['bufferView'])
        elif kind=='textures':
            value['source']=copy_index('images',value['source']);value.pop('sampler',None)
        elif kind=='materials':
            for key in ['baseColorTexture','metallicRoughnessTexture']:
                if key in value.get('pbrMetallicRoughness',{}):value['pbrMetallicRoughness'][key]['index']=copy_index('textures',value['pbrMetallicRoughness'][key]['index'])
            for key in ['normalTexture','occlusionTexture','emissiveTexture']:
                if key in value:value[key]['index']=copy_index('textures',value[key]['index'])
        target.setdefault(kind,[]); result=len(target[kind]);target[kind].append(value);maps[kind][index]=result;return result
    remote=next(i for i,n in enumerate(old['nodes']) if n.get('name')=='TLD_Remote_Arms')
    oldnode=old['nodes'][remote]; skin=copy.deepcopy(old['skins'][oldnode['skin']])
    mesh=copy.deepcopy(old['meshes'][oldnode['mesh']])
    for primitive in mesh['primitives']:
        primitive['attributes']={key:copy_index('accessors',value) for key,value in primitive['attributes'].items()}
        primitive['indices']=copy_index('accessors',primitive['indices']);primitive['material']=copy_index('materials',primitive['material'])
    mesh_index=len(target['meshes']);target['meshes'].append(mesh)
    parents={child:i for i,node in enumerate(old['nodes']) for child in node.get('children',[])}
    chosen=set(skin['joints'])|{remote}
    for index in list(chosen):
        while index in parents: index=parents[index];chosen.add(index)
    for index in list(chosen):
        # Retain bone end nodes and extras, without copying ordinary hands.
        todo=list(old['nodes'][index].get('children',[]))
        while todo:
            child=todo.pop()
            if 'mesh' not in old['nodes'][child]:
                chosen.add(child);todo.extend(old['nodes'][child].get('children',[]))
    chosen=sorted(chosen);mapping={oldi:len(target['nodes'])+j for j,oldi in enumerate(chosen)}
    skin['joints']=[mapping[i] for i in skin['joints']];skin['inverseBindMatrices']=copy_index('accessors',skin['inverseBindMatrices'])
    if 'skeleton' in skin:skin['skeleton']=mapping[skin['skeleton']]
    skin_index=len(target.setdefault('skins',[]));target['skins'].append(skin)
    for index in chosen:
        node=copy.deepcopy(old['nodes'][index]);node['children']=[mapping[i] for i in node.get('children',[]) if i in mapping]
        if not node['children']:node.pop('children')
        if index==remote:node['mesh']=mesh_index;node['skin']=skin_index
        target['nodes'].append(node)
    target['scenes'][target.get('scene',0)]['nodes'] += [mapping[i] for i in chosen if i not in parents or parents[i] not in mapping]
    # Blender cannot export the original atlas multiply node chain as PBR
    # factors. Retain the accepted authored skin and leather multiplication.
    for mat in target['materials']:
        if mat.get('name')=='TLD_View_Hybrid_Atlas':mat['pbrMetallicRoughness']['baseColorFactor']=[.62,.43,.33,1]
        if mat.get('name')=='TLD_Worn_Leather_Glove':mat['pbrMetallicRoughness']['baseColorFactor']=[.38,.33,.28,1]
        if mat.get('name')=='TLD_Graphic_Canvas_v2':mat['pbrMetallicRoughness']['baseColorFactor']=[1,1,1,1]
    unique=[];texture_remap={}
    for index,texture in enumerate(target['textures']):
        if texture not in unique:unique.append(texture)
        texture_remap[index]=unique.index(texture)
    target['textures']=unique
    for material in target['materials']:
        for key in ['baseColorTexture','metallicRoughnessTexture']:
            ref=material.get('pbrMetallicRoughness',{}).get(key)
            if ref:ref['index']=texture_remap[ref['index']]
        for key in ['normalTexture','occlusionTexture','emissiveTexture']:
            ref=material.get(key)
            if ref:ref['index']=texture_remap[ref['index']]
    glb_write(OUT,target,payload)
    return target

doc=preserve_interaction()
full_gloves=any(m.get('name')=='TLD_Full_Worn_Leather_Gloves_v2' for m in doc['materials'])
manifest={'version':2,'asset':str(OUT.relative_to(ROOT)),'sha256':sha(OUT),'bytes':OUT.stat().st_size,
    'source_hashes':source_hashes,'authoring':str((ARCHIVE/'The_Last_Dead_Clean_First_Person_Arms_v2.blend').relative_to(ROOT)),
    'source_blend_inspected':str(SOURCE_BLEND.relative_to(ROOT)),
    'source_blend_opened':str((MASTER if EXPORT_ONLY else SOURCE_BLEND).relative_to(ROOT)),
    'export_mode':'saved-master-only' if EXPORT_ONLY else 'rebuild-baseline',
    'sourcing':'Existing Meshy interaction atlas + Blender authored garment, hands and shared leather gloves; no provider generation' if full_gloves else 'Existing Meshy survivor hand atlas + Blender authored garment and glove revision; no provider generation',
    'coordinate_system':'glTF Y-up, metres; forward -Z','textures':len(doc.get('textures',[])),
    'materials':len(doc['materials']),'meshes':len(doc['meshes']),
    'triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives']),
    'contract':{'forearm_length':.34,'upper_length':.40,'hand_wrist':[0,-.075,.015],'grip':[0,0,0],
                'trigger_pivot':'RightTriggerFinger','fingers_per_hand':5,'ordinary_hand_texture_resolution':[1024,1024]},
    'interaction_skin':'Every interaction POSITION/NORMAL/UV/JOINTS/WEIGHTS/index/bind accessor, bone transform and source image copied from v1 without re-export',
    'changes':['Draped slate canvas garment, short warm wrist, integral cuff and elbow folds',
               'Softened glove dorsal surface; retained thumb and grip digits, authored bent right index trigger reach',
               'Reduced oversampled ordinary hand topology and 1024 maps']+(['Full dark leather gloves across palms, fingers, thumbs and reinforcement plates; shared normal/roughness, integrated dorsal pads and seam/wear zones'] if full_gloves else []),
    'full_leather_gloves':json.loads((ARCHIVE/'glove-authoring.json').read_text()) if full_gloves else None,
    'right_index_trigger_reach':{'mcp':[.032,.043,-.016],'tip':[-.065,.059,-.002],
        'pivot_name':'RightTriggerFinger','glove_and_other_four_digit_pivots_retained':True},
    'limitations':['Held hands remain rigid authored surfaces with explicit finger pivots, not a newly anatomically skinned hand rig.',
                   'Actual game camera, aim and cadence are controlled by runtime; Blender defines surfaces and joint contracts.',
                   'Surface/contract tests cannot certify professional art quality or real VR support.']}
for name,expected in source_hashes.items():assert sha(ROOT/name)==expected, 'Protected source changed: '+name
(ROOT/'assets/survivor/viewmodel-arms-v2-manifest.json').write_text(json.dumps(manifest,indent=2))
(ARCHIVE/'README.md').write_text('# Clean first-person arm source v2\n\nOpen the saved .blend to edit the ordinary hand surfaces and garment. Export saved edits with scripts/refine-viewmodel-arms-v2.py -- --export-only in Blender background mode. Original v1 masters remain unchanged. Rebuild baseline with scripts/refine-viewmodel-arms-v2.py, author gloves with scripts/author-viewmodel-gloves-v2.py, then export-only. The glove script rebuilds from Accepted_Bare_Fingertip_v2.blend checkpoint; do not use it to export manual glove edits. Runtime uses the GLB only. Interaction skin remains byte-preserved from v1; it is not exported through this .blend.\n')
print('VIEWMODEL_ARMS_V2',json.dumps(manifest),flush=True)
