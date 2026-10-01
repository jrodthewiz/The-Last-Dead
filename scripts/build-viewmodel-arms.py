"""Author metric first-person arms from the preserved Meshy survivor atlas.

Run with Blender 2.93 --background --python scripts/build-viewmodel-arms.py.
The original GLB is read only. Proofs and editable source stay in .art-source.
Use -- --preview-only to render isolated hands without exporting the live asset.
The optional --reuse-texture flag reuses the underlying source-color projection;
the final inspected candidate is exported with a fresh projection by default.
"""
import bpy, math, json, struct, hashlib, copy, array, sys
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/survivor/tld-survivor-v02.glb'
OUT = ROOT / 'assets/survivor/viewmodel-arms-v1.glb'
BASE_ARCHIVE = ROOT / '.art-source/viewmodel-arms-v1'
PREVIEW_ONLY = '--preview-only' in sys.argv
ARCHIVE = BASE_ARCHIVE / 'hand-refinement-preview' if PREVIEW_ONLY else BASE_ARCHIVE
ARCHIVE.mkdir(parents=True, exist_ok=True)
source_bytes = SOURCE.read_bytes()
json_length = struct.unpack_from('<I', source_bytes, 12)[0]
doc = json.loads(source_bytes[20:20 + json_length])
bin_offset = 28 + json_length

def accessor(i):
    a = doc['accessors'][i]; v = doc['bufferViews'][a['bufferView']]
    width = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    fmt = {5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'}[a['componentType']]
    item = struct.calcsize(fmt) * width
    stride = v.get('byteStride', item)
    start = bin_offset + v.get('byteOffset',0) + a.get('byteOffset',0)
    return [struct.unpack_from('<'+fmt*width, source_bytes, start+j*stride) for j in range(a['count'])]

def source_surface(name):
    node = next(n for n in doc['nodes'] if n.get('name') == name)
    p = doc['meshes'][node['mesh']]['primitives'][0]
    points = accessor(p['attributes']['POSITION']); uv = accessor(p['attributes']['TEXCOORD_0'])
    indices = [x[0] for x in accessor(p['indices'])]
    triangles = [tuple(indices[i:i+3]) for i in range(0,len(indices),3)]
    return points,uv,triangles,BVHTree.FromPolygons([Vector(v) for v in points],triangles,all_triangles=True)

sources = {side: source_surface('TLD_ViewSleeve_'+side) for side in ['Left','Right']}
remote_surface = source_surface('TLD_Remote_Arms')

def nearest_uv(surface, point):
    positions, uvs, faces, bvh = surface
    location, normal, index, distance = bvh.find_nearest(Vector(point))
    if index is None: return (.5,.5)
    a,b,c = (Vector(positions[i]) for i in faces[index])
    e0,e1,q = b-a,c-a,location-a
    aa,ab,bb,aq,bq=e0.dot(e0),e0.dot(e1),e1.dot(e1),e0.dot(q),e1.dot(q)
    d = aa*bb-ab*ab
    if abs(d)<1e-14: return uvs[faces[index][0]]
    v=(bb*aq-ab*bq)/d;w=(aa*bq-ab*aq)/d;u=1-v-w
    return tuple(u*uvs[faces[index][0]][k]+v*uvs[faces[index][1]][k]+w*uvs[faces[index][2]][k] for k in range(2))

# Keep glTF Y-up coordinates throughout authoring helpers.
def blender_point(p): return (p[0],-p[2],p[1])
def runtime_point(p): return Vector((p[0],p[2],-p[1]))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
source_material = bpy.data.objects['TLD_ViewSleeve_Right'].data.materials[0]
atlas = next(n.image for n in source_material.node_tree.nodes if n.type=='TEX_IMAGE' and n.image)
atlas.scale(2048,2048)
atlas.name='TLD_Survivor_Atlas_2048'
atlas.pack()
atlas_pixels=list(atlas.pixels)
disk_atlas=bpy.data.images.new('Original_Atlas_Disk_2048',width=2048,height=2048,alpha=False)
disk_atlas.pixels.foreach_set(atlas_pixels)
disk_atlas.filepath_raw=str(ARCHIVE/'original-atlas-2048.png');disk_atlas.file_format='PNG';disk_atlas.save()
source_material.name='TLD_View_Original_Meshy_Atlas'
source_material.use_backface_culling=True
principled = next(n for n in source_material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
principled.inputs['Roughness'].default_value=.84
principled.inputs['Specular'].default_value=.23
for o in list(bpy.data.objects): bpy.data.objects.remove(o,do_unlink=True)
scene = bpy.context.scene
runtime_collection = bpy.data.collections.new('EXPORT | Metric First Person Arms')
scene.collection.children.link(runtime_collection)
packed_atlas=bpy.data.images.new('TLD_Authored_Arms_Albedo_2048',width=2048,height=2048,alpha=False)
packed_atlas.generated_color=(.15,.12,.09,1)
mesh_serial=0
surface_records=[]
def source_color(uv):
    # glTF UV origins are upper-left; Blender pixel origins are lower-left.
    u=max(0,min(2047,int(uv[0]*2047)));v=max(0,min(2047,int((1-uv[1])*2047)))
    at=(v*2048+u)*4
    # Image pixel values are encoded sRGB; emit bake operates in linear light.
    return tuple(max(0,min(1,atlas_pixels[at+k]))**2.2 for k in range(3))+(1,)

def mesh(name, vertices, faces, uv_fn, material=source_material, parent=None, uv_coords=None):
    global mesh_serial
    data=bpy.data.meshes.new(name)
    data.from_pydata([blender_point(v) for v in vertices],[],faces);data.update()
    obj=bpy.data.objects.new(name,data);runtime_collection.objects.link(obj)
    if parent: obj.parent=parent
    data.materials.append(material)
    uv=data.uv_layers.new(name='UV_Original_Survivor_Atlas')
    colors=data.vertex_colors.new(name='Sampled_Original_Atlas')
    tile=mesh_serial;mesh_serial+=1;tx=tile%4;ty=tile//4
    if uv_coords:surface_records.append((tile,name,vertices,uv_fn,len(set(v for u,v in uv_coords)),len(set(u for u,v in uv_coords))))
    for poly in data.polygons:
        poly.use_smooth=True
        for loop_index in poly.loop_indices:
            p=vertices[data.loops[loop_index].vertex_index]
            source_uv=uv_fn(p)
            if uv_coords:
                u,v=uv_coords[data.loops[loop_index].vertex_index]
                poly_us=[uv_coords[data.loops[li].vertex_index][0] for li in poly.loop_indices]
                if max(poly_us)-min(poly_us)>.5 and len(poly.loop_indices)==4 and u<.5:u=1
            else:u,v=.5,.5
            # Each authored mesh has a padded canonical tile. Source UV islands
            # are sampled into color before interpolation, so their seams do
            # not become long false lines over the new silhouette.
            uv.data[loop_index].uv=((tx+.016+u*.968)/4,(ty+.016+v*.968)/4)
            colors.data[loop_index].color=source_color(source_uv)
    obj['source']='Meshy survivor v02 atlas + authored metric Blender surfaces'
    obj['metric_scale']=1.0
    return obj

def group(name):
    o=bpy.data.objects.new(name,None);runtime_collection.objects.link(o);return o

def sleeve(side):
    return retained_source_sleeve(side,upper=False)

def retained_source_sleeve(side,upper=False):
    global mesh_serial
    import bmesh
    points,uvs,triangles,bvh=sources[side]
    low,high=(0,.270) if upper else (.150,.490)
    data=bpy.data.meshes.new(('Upper' if upper else 'Forearm')+'_Preserved_Meshy_UVs')
    data.from_pydata([blender_point(p) for p in points],[],triangles);data.update()
    name=('TLD_UpperSleeve_' if upper else 'TLD_ViewSleeve_')+side
    obj=bpy.data.objects.new(name,data);runtime_collection.objects.link(obj);data.materials.append(source_material)
    uv=data.uv_layers.new(name='UV_Preserved_Meshy')
    for poly in data.polygons:
        poly.use_smooth=True
        for li in poly.loop_indices:
            u,v=uvs[data.loops[li].vertex_index];uv.data[li].uv=(u,1-v)
    bm=bmesh.new();bm.from_mesh(data)
    bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-7,plane_co=(0,0,low),plane_no=(0,0,1),clear_inner=True,clear_outer=False)
    bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-7,plane_co=(0,0,high),plane_no=(0,0,1),clear_inner=False,clear_outer=True)
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
    def section(sy):
        near=[p for p in points if abs(p[1]-sy)<.009]
        xs=sorted(p[0] for p in near);zs=sorted(p[2] for p in near)
        lo=int(len(near)*.15);hi=min(len(near)-1,int(len(near)*.85))
        return Vector(((xs[lo]+xs[hi])*.5,-(zs[lo]+zs[hi])*.5,sy))
    wrist=section(high);elbow=section(low);length=.40 if upper else .34
    axis=elbow-wrist;rotation=axis.rotation_difference(Vector((0,0,-1)));scale=length/axis.length
    trimmed=0
    for v in bm.verts:
        v.co=rotation@(v.co-wrist)
        if upper:
            v.co.z*=scale
            radius=math.hypot(v.co.x,v.co.y)
            if radius>.087:v.co.x*=.087/radius;v.co.y*=.087/radius;trimmed+=1
        else:v.co*=scale
    if upper:
        layer=bm.loops.layers.uv.verify()
        caps=[]
        for end in [-length,0]:
            nearby=[math.hypot(v.co.x,v.co.y) for v in bm.verts if abs(v.co.z-end)<.018]
            nearby.sort();r=min(.087,nearby[int(.80*(len(nearby)-1))] if nearby else .078)
            caps.append({'name':('UpperShoulderCap_' if end<0 else 'UpperElbowCap_')+side,'center':[0,end,0],'radius':r,'storage':'triangles within upper sleeve mesh'})
            center=bm.verts.new((0,0,end));ring=[bm.verts.new((math.cos(k/48*math.pi*2)*r,math.sin(k/48*math.pi*2)*r,end))for k in range(48)]
            for k in range(48):
                points_cap=[center,ring[k],ring[(k+1)%48]]
                if end<0:points_cap.reverse()
                face=bm.faces.new(points_cap)
                for loop in face.loops:
                    q=Vector(loop.vert.co);q.z/=scale
                    original=rotation.inverted()@q+wrist
                    u,v=nearest_uv(sources[side],runtime_point(original));loop[layer].uv=(u,1-v)
    # Only rigid rotation, translation and one uniform scale are applied.
    # Original sculpt, source UVs and folds remain intact, with real bisected
    # edges instead of collapsing triangles or radially shearing the skin.
    bm.to_mesh(data);bm.free();data.update()
    obj['source']='Meshy v02 topology/UVs + Blender bisected metric forearm'
    obj['metric_scale']=1.0;obj['source_uv_preserved']=True;obj['radial_stretch']=False
    obj['source_longitudinal_fit_scale']=scale;obj['source_radial_fit_scale']=1.0 if upper else scale
    obj['radial_outliers_trimmed']=trimmed
    if upper:obj['elbow_position']=[0,0,0];obj['shoulder_position']=[0,-.40,0];obj['caps']=caps;obj['maximum_radial_envelope']=.087
    else:obj['wrist_position']=[0,0,0];obj['elbow_position']=[0,-.34,0]
    mesh_serial+=1
    return obj

def upper_sleeve(side):
    return retained_source_sleeve(side,upper=True)

def skin_uv(p,side,glove=False):
    # Sample the source forearm skin and textured fingerless cuff instead of
    # importing new palette colors that do not match the full body.
    sign=-1 if side=='Left' else 1
    x,y,z=p
    sy=(.517 if glove else .342)+y*.10
    return nearest_uv(sources[side],(x*.38,sy,z*.5))

def hand(side):
    sign=-1 if side=='Left' else 1
    root=group('TLD_GripHand_'+side)
    root['grip_position']=[0,0,0];root['wrist_position']=[0,-.075,.015]
    root['digit_count']=5;root['metric_scale']=1.0
    # A flattened, asymmetrically profiled metacarpal glove follows the grip.
    # Its palm lies to the radial side of the grip rather than enclosing it
    # inside an oversized sphere. The curved digits form the contact surface.
    vertices=[];faces=[];segments=48;palmerings=53
    profile=[(-.087,.028,.024,0),(-.075,.028,.024,0),(-.061,.029,.026,.010),
             (-.036,.027,.029,.025),(-.008,.027,.031,.035),(.020,.026,.030,.035),
             (.043,.023,.029,.035),(.049,.014,.020,.030),(.051,.006,.012,.029),(.052,.002,.006,.028)]
    # Interpolate the glove's metacarpal arch, with a heel and thumb web;
    # discrete profile rings made the back read as a straight faceted rod.
    for j in range(palmerings):
        y,rx,rz,cx=catmull(profile,(len(profile)-1)*j/(palmerings-1))
        for k in range(segments):
            a=k/segments*2*math.pi
            c=math.cos(a);s=math.sin(a)
            px=math.copysign(abs(c)**.92,c)*rx
            pz=math.copysign(abs(s)**.93,s)*rz
            thenar=.0085*math.exp(-((y+.028)/.028)**2)*max(0,-s)**3
            hypothenar=.0040*math.exp(-((y+.041)/.020)**2)*max(0,s)**3
            web=.0045*math.exp(-((y-.001)/.026)**2)*max(0,-s)**4
            pz+=hypothenar-thenar+web
            # Subtle transverse metacarpal arch and the soft heel transition.
            px+=c*.0020*math.exp(-((y-.011)/.034)**2)*(1-.35*abs(s))
            zcenter=.015-.022*max(0,min(1,(y+.075)/.05))
            vertices.append((sign*(cx+px),y,pz+zcenter))
    for j in range(palmerings-1):
        for k in range(segments):faces.append((j*segments+k,(j+1)*segments+k,(j+1)*segments+(k+1)%segments,j*segments+(k+1)%segments))
    faces.append(tuple(range(segments)));faces.append(tuple(reversed([(palmerings-1)*segments+k for k in range(segments)])))
    coords=[(k/segments,j/(palmerings-1)) for j in range(palmerings) for k in range(segments)]
    palm=mesh('GripPalm_'+side,vertices,faces,lambda p:skin_uv(p,side,True),parent=root,uv_coords=coords)
    palm['grip_part']='palm';palm['gripFarSide']=False
    palm['anatomy_surface']='metacarpal arch, thenar/hypothenar pads, continuous heel and thumb web'
    # Continuous tapered digit surfaces. Each path has proximal, intermediate,
    # distal joints with authored flattening at the crease, no sphere piles.
    for digit,y,r,length in [('Index',.043,.0105,1.0),('Middle',.015,.0107,1.06),('Ring',-.013,.0099,1.0),('Little',-.039,.0084,.86)]:
        path=[(sign*.050,y,-.016),(sign*.052,y-.002,.007),(sign*.035,y-.004,.030),
              (sign*.010,y-.007,.036),(-sign*.015*length,y-.010,.027),(-sign*.025*length,y-.014,.007)]
        pivot=group(('RightTriggerFinger' if side=='Right' and digit=='Index' else side+digit+'Finger'))
        pivot.parent=root;pivot.location=blender_point(path[0]);pivot['digit']=digit;pivot['grip_part']='finger'
        local=[tuple(Vector(p)-Vector(path[0])) for p in path]
        digit_tube('Grip'+digit+'_'+side,local,r,side,pivot,lambda p,origin=tuple(path[0]):skin_uv(tuple(Vector(p)+Vector(origin)),side,False),digit,path[0])
        nail('Nail'+digit+'_'+side,local,r,pivot,digit,path[0])
    thumb=[(sign*.048,-.019,-.016),(sign*.059,.002,-.027),(sign*.044,.021,-.039),(sign*.026,.028,-.044),(sign*.009,.025,-.032)]
    pivot=group(side+'ThumbFinger');pivot.parent=root;pivot.location=blender_point(thumb[0]);pivot['digit']='Thumb';pivot['grip_part']='finger'
    local=[tuple(Vector(p)-Vector(thumb[0])) for p in thumb]
    digit_tube('GripThumb_'+side,local,.012,side,pivot,lambda p,origin=tuple(thumb[0]):skin_uv(tuple(Vector(p)+Vector(origin)),side,False),'Thumb',thumb[0])
    nail('NailThumb_'+side,local,.012,pivot,'Thumb',thumb[0])
    return root

def catmull(points,t):
    i=min(len(points)-2,int(t));f=t-i
    p0,p1,p2,p3=[Vector(points[max(0,min(len(points)-1,k))]) for k in [i-1,i,i+1,i+2]]
    return .5*((2*p1)+(-p0+p2)*f+(2*p0-5*p1+4*p2-p3)*f*f+(-p0+3*p1-3*p2+p3)*f*f*f)

DIGIT_PROFILES={
    'Index': {'girth':1.00,'tip':.60,'knuckle':.33,'joint1':.25,'joint2':.60,'pad':.10,'lean':-.035},
    'Middle':{'girth':1.025,'tip':.63,'knuckle':.37,'joint1':.27,'joint2':.62,'pad':.13,'lean':.025},
    'Ring':  {'girth':.98,'tip':.57,'knuckle':.32,'joint1':.29,'joint2':.64,'pad':.105,'lean':.05},
    'Little':{'girth':.96,'tip':.52,'knuckle':.28,'joint1':.30,'joint2':.63,'pad':.08,'lean':.055},
    'Thumb': {'girth':1.03,'tip':.68,'knuckle':.40,'joint1':.34,'joint2':.72,'pad':.16,'lean':-.035}}

def digit_frame(points,t,origin):
    center=catmull(points,t)
    ahead=catmull(points,min(len(points)-1,t+.018));behind=catmull(points,max(0,t-.018))
    tangent=(ahead-behind).normalized()
    # A curled finger's dorsal surface faces away from the grip in the XZ
    # plane. A world-Y basis wrongly put every nail on the finger's side.
    absolute=center+Vector(origin);normal=Vector((absolute.x,0,absolute.z))
    normal-=tangent*normal.dot(tangent)
    if normal.length<1e-7:normal=Vector((0,1,0))-tangent*tangent.y
    normal.normalize();binormal=tangent.cross(normal).normalized()
    return center,normal,binormal

def digit_section(radius,fraction,a,profile):
    # Explicit phalangeal proportions, dorsal knuckles and soft palmar pads.
    # Contact centre lines and digit pivot positions are unchanged.
    c,s=math.cos(a),math.sin(a)
    taper=(1-(1-profile['tip'])*fraction)*profile['girth']
    root=(.90+.10*min(1,fraction/.065)) if profile is DIGIT_PROFILES['Thumb'] else (.58+.42*min(1,fraction/.055))
    cap=1 if fraction<.925 else math.sqrt(max(.008,1-((fraction-.925)/.077)**2))
    joint=sum(math.exp(-((fraction-v)/.065)**2) for v in [profile['joint1'],profile['joint2']])
    pad=sum(math.exp(-((fraction-v)/.080)**2) for v in [profile['joint1']-.095,profile['joint2']-.11,.825])
    flex=sum(math.exp(-((fraction-v)/.014)**2) for v in [profile['joint1']+.043,profile['joint2']+.038])
    dorsal=max(0,c);palmar=max(0,-c)
    depth=.88+profile['knuckle']*joint*dorsal+profile['pad']*pad*palmar-.10*flex*palmar
    width=(1+.19*joint+.075*pad)*(1-.075*max(0,fraction-.76)/.24)
    # Broad flattened pad below, curved tendon/knuckle surface above.
    cc=math.copysign(abs(c)**(.83 if c<0 else 1.08),c)
    ss=math.copysign(abs(s)**.88,s)
    offset=profile['lean']*math.sin(math.pi*fraction)*radius*s*s
    return radius*taper*root*cap*cc*depth,radius*taper*root*cap*ss*width+offset

def digit_tube(name,points,radius,side,parent,uv_fn,digit,origin):
    vertices=[];faces=[];segments=32;rings=57;profile=DIGIT_PROFILES[digit]
    for j in range(rings):
        t=(len(points)-1)*j/(rings-1);center=catmull(points,t)
        center,normal,binormal=digit_frame(points,t,origin)
        end=j/(rings-1)
        for k in range(segments):
            a=k/segments*math.pi*2
            depth,width=digit_section(radius,end,a,profile)
            p=center+normal*depth+binormal*width
            vertices.append(tuple(p))
    for j in range(rings-1):
        for k in range(segments):faces.append((j*segments+k,j*segments+(k+1)%segments,(j+1)*segments+(k+1)%segments,(j+1)*segments+k))
    faces.append(tuple(reversed(range(segments))));faces.append(tuple((rings-1)*segments+k for k in range(segments)))
    coords=[(k/segments,j/(rings-1)) for j in range(rings) for k in range(segments)]
    o=mesh(name,vertices,faces,uv_fn,parent=parent,uv_coords=coords)
    o['grip_part']='digit';o['gripFarSide']=True
    o['anatomy_profile']=profile;o['contact_centerline_preserved']=True
    o['surface_detail']='dorsal knuckles, flattened flexion pads, tapered distal phalanx, radial dorsal frame'
    return o

def nail(name,points,radius,parent,digit,origin):
    vertices=[];faces=[];rows=11;columns=15
    for j in range(rows):
        v=j/(rows-1);fraction=.800+v*.108;t=(len(points)-1)*fraction
        center,normal,binormal=digit_frame(points,t,origin)
        for k in range(columns):
            # Rounded cuticle and free-edge corners are visibly curved in
            # silhouette. The plate follows the same asymmetric digit skin.
            edge=.38+.62*math.sin(math.pi*v)**.33
            a=(-.64+1.28*k/(columns-1))*edge
            depth,width=digit_section(radius,fraction,a,DIGIT_PROFILES[digit])
            # Thin attached keratin plate, rather than a dark raised blob.
            p=center+normal*(depth+.00022)+binormal*width
            vertices.append(blender_point(p))
    for j in range(rows-1):
        for k in range(columns-1):faces.append((j*columns+k,j*columns+k+1,(j+1)*columns+k+1,(j+1)*columns+k))
    data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);runtime_collection.objects.link(obj);obj.parent=parent
    if 'TLD_Natural_Nail' not in bpy.data.materials:
        mat=bpy.data.materials.new('TLD_Natural_Nail');mat.use_nodes=True
        node=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');node.inputs['Base Color'].default_value=(.31,.20,.15,1);node.inputs['Roughness'].default_value=.48;node.inputs['Specular'].default_value=.3
    data.materials.append(bpy.data.materials['TLD_Natural_Nail'])
    for p in data.polygons:p.use_smooth=True
    obj['grip_part']='nail';obj['gripFarSide']=True


for side in ['Left','Right']:
    sleeve(side);upper_sleeve(side);hand(side)

# Sample every target texel from the original source surface. Interpolating
# projected UV coordinates across source islands is invalid, and vertex-only
# color sampling discards the cloth weave and skin detail between vertices.
pixels=array.array('f',[.15,.12,.09,1])*(2048*2048)
texture_key=hashlib.sha256(source_bytes).hexdigest()
texture_key=hashlib.sha256((texture_key+json.dumps([(name,vertices,[uv_fn(v) for v in vertices]) for tile,name,vertices,uv_fn,rings,segments in surface_records])).encode()).hexdigest()
cache_key=ARCHIVE/'texture-bake-key.json'
cache_image=ARCHIVE/'authored-arms-source-albedo.png'
if PREVIEW_ONLY and '--reuse-texture' in sys.argv and not cache_image.exists():cache_image=BASE_ARCHIVE/'authored-arms-albedo.png'
cached=cache_key.exists() and cache_image.exists() and json.loads(cache_key.read_text()).get('key')==texture_key
cached=cached or ('--reuse-texture' in sys.argv and cache_image.exists())
for tile,name,vertices,uv_fn,rings,segments in surface_records:
    if cached:break
    tx,ty=tile%4,tile//4
    print('TEXEL_SOURCE_BAKE',name,flush=True)
    for py in range(512):
        v=max(0,min(1,(py/512-.016)/.968));row=v*(rings-1)
        j=min(rings-2,int(row));fy=row-j
        for px in range(512):
            u=max(0,min(.999999,(px/512-.016)/.968));column=u*segments
            k=int(column);fx=column-k;n=(k+1)%segments
            a,b,c,d=vertices[j*segments+k],vertices[j*segments+n],vertices[(j+1)*segments+k],vertices[(j+1)*segments+n]
            p=tuple((a[i]*(1-fx)+b[i]*fx)*(1-fy)+(c[i]*(1-fx)+d[i]*fx)*fy for i in range(3))
            uv=uv_fn(p)
            sx=max(0,min(2047,int(uv[0]*2047)));sy=max(0,min(2047,int((1-uv[1])*2047)))
            src=(sy*2048+sx)*4;dst=((ty*512+py)*2048+tx*512+px)*4
            pixels[dst:dst+4]=array.array('f',atlas_pixels[src:src+4])
if cached:
    loaded_cache=bpy.data.images.load(str(cache_image),check_existing=False)
    # Materialise the lazy disk image before changing its destination path.
    packed_atlas.pixels.foreach_set(loaded_cache.pixels[:])
    print('TEXEL_SOURCE_BAKE_CACHE_HIT',texture_key,flush=True)
else:
    packed_atlas.pixels.foreach_set(pixels)
cache_key.write_text(json.dumps({'key':texture_key,'source_sha256':hashlib.sha256(source_bytes).hexdigest()}))
packed_atlas.filepath_raw=str(ARCHIVE/'authored-arms-source-albedo.png');packed_atlas.file_format='PNG';packed_atlas.save();packed_atlas.pack()

def hand_surface_maps():
    # Physical crease/pore scale is measured against the digit circumference
    # and longitudinal path. Texture changes stay confined to exposed skin.
    albedo=array.array('f',packed_atlas.pixels[:]);normal_pixels=array.array('f',[.5,.5,1,1])*(2048*2048)
    orm_pixels=array.array('f',[1,.76,0,1])*(2048*2048)
    for tile,name,vertices,uv_fn,rings,segments in surface_records:
        if name.startswith('GripPalm'):continue
        digit=name.split('_')[0][4:];profile=DIGIT_PROFILES[digit]
        tx,ty=tile%4,tile//4;heights=array.array('f',[0])*(512*512)
        print('DIGIT_SURFACE_DETAIL',name,flush=True)
        for py in range(512):
            v=max(0,min(1,(py/512-.016)/.968))
            for px in range(512):
                u=max(0,min(1,(px/512-.016)/.968));a=u*2*math.pi
                dorsal=max(0,math.cos(a));palmar=max(0,-math.cos(a))
                pore=(math.sin(u*743+math.sin(v*117)*1.7)*math.sin(v*919+math.sin(u*137)*1.9)+.43*math.sin(u*1313+v*1511))/1.43
                broad=math.sin(u*27.3+v*44.7)*math.sin(v*37.8-u*13.2)
                crease=0
                for joint in [profile['joint1'],profile['joint2']]:
                    bow=.009*math.cos(a*2.4)+.003*math.sin(a*6+joint*70)
                    crease+=palmar**2*(math.exp(-((v-joint-.042-bow)/.009)**2)+.45*math.exp(-((v-joint-.018-bow)/.006)**2))
                    crease+=dorsal**3*.45*(math.exp(-((v-joint+.020-bow*.3)/.005)**2)+.5*math.exp(-((v-joint+.038-bow*.4)/.005)**2))
                heights[py*512+px]=.000014*pore-.000095*crease
                dst=((ty*512+py)*2048+tx*512+px)*4
                warm=.986+.017*broad+.012*pore
                albedo[dst]*=max(.78,warm-.14*crease)
                albedo[dst+1]*=max(.75,warm-.17*crease)
                albedo[dst+2]*=max(.72,warm-.18*crease)
                orm_pixels[dst+1]=max(.5,min(.9,.66+.045*broad+.035*pore+.075*crease))
        for py in range(512):
            for px in range(512):
                # Approximately 60mm circumference and 110mm bent digit;
                # prevent singular normal magnification at the rounded tip.
                dx=(heights[py*512+min(511,px+1)]-heights[py*512+max(0,px-1)])/(.060/512*2)
                dy=(heights[min(511,py+1)*512+px]-heights[max(0,py-1)*512+px])/(.110/512*2)
                inv=1/math.sqrt(1+dx*dx+dy*dy);dst=((ty*512+py)*2048+tx*512+px)*4
                normal_pixels[dst:dst+4]=array.array('f',[(1-dx*inv)*.5,(1-dy*inv)*.5,(1+inv)*.5,1])
    packed_atlas.pixels.foreach_set(albedo);packed_atlas.filepath_raw=str(ARCHIVE/'authored-arms-albedo.png');packed_atlas.save();packed_atlas.pack()
    result=[]
    for name,pixels,filename in [('TLD_Digit_Tangent_Normal_2048',normal_pixels,'digit-normal.png'),('TLD_Digit_Packed_ORM_2048',orm_pixels,'digit-orm.png')]:
        im=bpy.data.images.new(name,width=2048,height=2048,alpha=False);im.colorspace_settings.name='Non-Color';im.pixels.foreach_set(pixels)
        im.filepath_raw=str(ARCHIVE/filename);im.file_format='PNG';im.save();im.pack();result.append(im)
    return result

normal_atlas,orm_atlas=hand_surface_maps()
final_mat=bpy.data.materials.new('TLD_View_Hybrid_Atlas');final_mat.use_nodes=True
principled=next(n for n in final_mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
principled.inputs['Roughness'].default_value=.68;principled.inputs['Specular'].default_value=.25
image_node=final_mat.node_tree.nodes.new('ShaderNodeTexImage');image_node.image=packed_atlas
skin_multiply=final_mat.node_tree.nodes.new('ShaderNodeMixRGB');skin_multiply.blend_type='MULTIPLY';skin_multiply.inputs[0].default_value=1;skin_multiply.inputs[2].default_value=(.62,.43,.33,1)
final_mat.node_tree.links.new(image_node.outputs['Color'],skin_multiply.inputs[1]);final_mat.node_tree.links.new(skin_multiply.outputs[0],principled.inputs['Base Color'])
normal_image=final_mat.node_tree.nodes.new('ShaderNodeTexImage');normal_image.image=normal_atlas
normal_node=final_mat.node_tree.nodes.new('ShaderNodeNormalMap');normal_node.inputs['Strength'].default_value=.65
final_mat.node_tree.links.new(normal_image.outputs['Color'],normal_node.inputs['Color']);final_mat.node_tree.links.new(normal_node.outputs['Normal'],principled.inputs['Normal'])
orm_image=final_mat.node_tree.nodes.new('ShaderNodeTexImage');orm_image.image=orm_atlas
separate=final_mat.node_tree.nodes.new('ShaderNodeSeparateRGB');final_mat.node_tree.links.new(orm_image.outputs['Color'],separate.inputs['Image']);final_mat.node_tree.links.new(separate.outputs['G'],principled.inputs['Roughness'])
for tile,name,vertices,uv_fn,rings,segments in surface_records:
    o=bpy.data.objects[name];o.data.materials.clear();o.data.materials.append(final_mat)
glove_mat=final_mat.copy();glove_mat.name='TLD_Worn_Leather_Glove'
glove_principled=next(n for n in glove_mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
glove_image=next(n for n in glove_mat.node_tree.nodes if n.type=='TEX_IMAGE')
for socket in [glove_principled.inputs['Normal'],glove_principled.inputs['Roughness']]:
    for link in list(socket.links):glove_mat.node_tree.links.remove(link)
multiply=glove_mat.node_tree.nodes.new('ShaderNodeMixRGB');multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1; multiply.inputs[2].default_value=(.38,.33,.28,1)
glove_mat.node_tree.links.new(glove_image.outputs['Color'],multiply.inputs[1]);glove_mat.node_tree.links.new(multiply.outputs[0],glove_principled.inputs['Base Color']);glove_principled.inputs['Roughness'].default_value=.76
for side in ['Left','Right']:
    o=bpy.data.objects['GripPalm_'+side];o.data.materials.clear();o.data.materials.append(glove_mat)

if PREVIEW_ONLY:
    # The inspection pass cannot touch the frozen live asset or its receipts.
    # Preserve the native pose before showing isolated anatomy under soft light.
    scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
    bpy.ops.wm.save_as_mainfile(filepath=str(ARCHIVE/'Hand_Surface_Refinement_Preview.blend'))
    for o in runtime_collection.objects:
        o.hide_render=o.name.startswith('TLD_ViewSleeve') or o.name.startswith('TLD_UpperSleeve') or o.name.endswith('_Left') or o.name.startswith('Left')
    scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32
    scene.render.resolution_x=1400;scene.render.resolution_y=1050;scene.render.resolution_percentage=100
    scene.world=bpy.data.worlds.new('Hand_Neutral_Proof_World');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.12,.12,1)
    scene.view_settings.view_transform='Filmic';scene.view_settings.look='Medium High Contrast';scene.view_settings.exposure=0
    target=Vector((.008,-.005,-.004))
    for name,loc,power,size in [('key',(.8,-.7,.8),42,1.2),('fill',(-.7,-.3,.4),25,1.3),('rim',(0,.8,.8),38,.8)]:
        d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    d=bpy.data.cameras.new('Hand_Neutral_Proof_Camera');cam=bpy.data.objects.new('Hand_Neutral_Proof_Camera',d);scene.collection.objects.link(cam);d.type='ORTHO';d.ortho_scale=.20;scene.camera=cam
    proofs=[]
    for name,loc in [('dorsal',(.5,-.8,.35)),('palmar',(-.55,-.65,.22)),('thumb',(.55,.6,.22))]:
        cam.location=loc;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(ARCHIVE/('hand-'+name+'.png'));bpy.ops.render.render(write_still=True);proofs.append(scene.render.filepath)
    print('HAND_SURFACE_PREVIEW_ONLY',json.dumps({'proofs':proofs,'live_asset_sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'preview_only':True}),flush=True)
    sys.exit(0)

# Save the unposed, editable authored surfaces before proof staging.
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
bpy.ops.wm.save_as_mainfile(filepath=str(ARCHIVE/'Viewmodel_Arms_v1.blend'))
for o in bpy.context.selected_objects:o.select_set(False)
for o in runtime_collection.objects:o.select_set(True)
bpy.context.view_layer.objects.active=next(o for o in runtime_collection.objects if o.type=='MESH')
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_texcoords=True,export_normals=True,export_colors=False,export_materials='EXPORT',export_extras=True,export_animations=False)

def append_source_interaction_skin():
    # Append the source bone graph and skin accessor bytes directly. Blender
    # can re-express bone orientation on import/export; exact copying keeps
    # the existing centimetre rig, IK and additive grip controls compatible.
    b=OUT.read_bytes();length=struct.unpack_from('<I',b,12)[0]
    target=json.loads(b[20:20+length]);payload=bytearray(b[28+length:])
    # Explicit glTF factors mirror the proof shader's leather multiplication.
    skin_material=next(m for m in target['materials'] if m.get('name')=='TLD_View_Hybrid_Atlas')
    skin_material['pbrMetallicRoughness']['baseColorFactor']=[.62,.43,.33,1]
    for m in target['materials']:
        if m.get('name')=='TLD_Worn_Leather_Glove':
            m['pbrMetallicRoughness']['baseColorTexture']=copy.deepcopy(skin_material['pbrMetallicRoughness']['baseColorTexture'])
            m['pbrMetallicRoughness']['baseColorFactor']=[.38,.33,.28,1]
    unique=[];remap={}
    for i,t in enumerate(target['textures']):
        if t not in unique:unique.append(t)
        remap[i]=unique.index(t)
    target['textures']=unique
    for m in target['materials']:
        for key in ['baseColorTexture','metallicRoughnessTexture']:
            ref=m.get('pbrMetallicRoughness',{}).get(key)
            if ref:ref['index']=remap[ref['index']]
        for key in ['normalTexture','occlusionTexture','emissiveTexture']:
            ref=m.get(key)
            if ref:ref['index']=remap[ref['index']]
    accessor_map={};view_map={}
    remote_index=next(i for i,n in enumerate(doc['nodes']) if n.get('name')=='TLD_Remote_Arms')
    remote_node=doc['nodes'][remote_index];primitive=doc['meshes'][remote_node['mesh']]['primitives'][0]
    skin=doc['skins'][remote_node['skin']]
    source_positions=accessor(primitive['attributes']['POSITION'])
    source_normals=accessor(primitive['attributes']['NORMAL'])
    joints=accessor(primitive['attributes']['JOINTS_0']);weights=accessor(primitive['attributes']['WEIGHTS_0'])
    inverse=accessor(skin['inverseBindMatrices'])
    rest={}
    for i,node_index in enumerate(skin['joints']):
        matrix=Matrix([inverse[i][r*4:r*4+4] for r in range(4)]).transposed().inverted()
        rest[doc['nodes'][node_index]['name']]=matrix.translation
    changed=[];positions=[]
    joint_names=[doc['nodes'][j]['name'] for j in skin['joints']]
    for i,p in enumerate(source_positions):
        point=Vector(p);slot=max(range(4),key=lambda k:weights[i][k]);name=joint_names[joints[i][slot]]
        # Preserve palms, fingers, hand skinning and all vertices within the
        # authored cloth envelope. Only long radial sleeve spikes are capped.
        if name.endswith('ForeArm') or name.endswith('Arm'):
            end=name.replace('ForeArm','Hand') if name.endswith('ForeArm') else name.replace('Arm','ForeArm')
            a,c=rest[name],rest[end];delta=c-a
            t=(point-a).dot(delta)/max(1e-8,delta.length_squared);axis=a+delta*t;radial=point-axis
            limit=.060 if name.endswith('ForeArm') else .086
            if radial.length>limit:
                point=axis+radial.normalized()*limit;changed.append(i)
        positions.append(tuple(point))
    indices=[v[0] for v in accessor(primitive['indices'])]
    normals=[Vector((0,0,0)) for p in positions]
    for j in range(0,len(indices),3):
        a,c,d=indices[j:j+3];normal=(Vector(positions[c])-Vector(positions[a])).cross(Vector(positions[d])-Vector(positions[a]))
        for k in (a,c,d):normals[k]+=normal
    normals=[tuple(n.normalized()) if n.length_squared>1e-14 else source_normals[i] for i,n in enumerate(normals)]
    def append_bytes(data,view=None):
        while len(payload)%4:payload.append(0)
        offset=len(payload);payload.extend(data)
        v=copy.deepcopy(view or {});v.update(buffer=0,byteOffset=offset,byteLength=len(data))
        index=len(target['bufferViews']);target['bufferViews'].append(v);return index
    def copied_accessor(index):
        if index in accessor_map:return accessor_map[index]
        a=copy.deepcopy(doc['accessors'][index]);v=doc['bufferViews'][a['bufferView']]
        if a['bufferView'] not in view_map:
            data=source_bytes[bin_offset+v.get('byteOffset',0):bin_offset+v.get('byteOffset',0)+v['byteLength']]
            view_map[a['bufferView']]=append_bytes(data,v)
        a['bufferView']=view_map[a['bufferView']]
        out=len(target['accessors']);target['accessors'].append(a);accessor_map[index]=out;return out
    def float_accessor(values,kind):
        width={'VEC3':3}[kind];data=b''.join(struct.pack('<'+width*'f',*v) for v in values)
        view=append_bytes(data,{'target':34962});index=len(target['accessors'])
        target['accessors'].append({'bufferView':view,'componentType':5126,'count':len(values),'type':kind,
                                   'min':[min(v[k] for v in values) for k in range(width)],'max':[max(v[k] for v in values) for k in range(width)]})
        return index
    source_primitive=copy.deepcopy(primitive)
    source_primitive['attributes']={name:copied_accessor(index) for name,index in primitive['attributes'].items() if name not in ('POSITION','NORMAL')}
    source_primitive['attributes']['POSITION']=float_accessor(positions,'VEC3')
    source_primitive['attributes']['NORMAL']=float_accessor(normals,'VEC3')
    source_primitive['indices']=copied_accessor(primitive['indices'])
    existing_material=next((i for i,m in enumerate(target['materials']) if m.get('name')=='TLD_View_Original_Meshy_Atlas'),None)
    if existing_material is not None:source_primitive['material']=existing_material
    else:
        image_index=len(target.setdefault('images',[]));image_view=append_bytes((ARCHIVE/'original-atlas-2048.png').read_bytes())
        target['images'].append({'name':'TLD_Preserved_Interaction_Atlas','bufferView':image_view,'mimeType':'image/png'})
        texture_index=len(target.setdefault('textures',[]));target['textures'].append({'source':image_index})
        material=copy.deepcopy(doc['materials'][primitive['material']]);material['name']='TLD_Interaction_Preserved_Meshy_Atlas'
        material['pbrMetallicRoughness']['baseColorTexture']['index']=texture_index
        source_primitive['material']=len(target['materials']);target['materials'].append(material)
    mesh_index=len(target['meshes']);target['meshes'].append({'name':'TLD_Cleaned_Interaction_Arms','primitives':[source_primitive]})
    chosen=[i for i,n in enumerate(doc['nodes']) if 'mesh' not in n or i==remote_index]
    mapping={old:len(target['nodes'])+i for i,old in enumerate(chosen)}
    target_skin=copy.deepcopy(skin);target_skin['joints']=[mapping[j] for j in skin['joints']]
    target_skin['inverseBindMatrices']=copied_accessor(skin['inverseBindMatrices'])
    if 'skeleton' in target_skin:target_skin['skeleton']=mapping[target_skin['skeleton']]
    skin_index=len(target.setdefault('skins',[]));target['skins'].append(target_skin)
    for old in chosen:
        node=copy.deepcopy(doc['nodes'][old])
        if 'children' in node:node['children']=[mapping[c] for c in node['children'] if c in mapping]
        if old==remote_index:node['mesh']=mesh_index;node['skin']=skin_index
        target['nodes'].append(node)
    target['scenes'][target.get('scene',0)]['nodes'].extend(mapping[n] for n in doc['scenes'][doc.get('scene',0)]['nodes'] if n in mapping)
    while len(payload)%4:payload.append(0)
    target['buffers'][0]['byteLength']=len(payload)
    encoded=json.dumps(target,separators=(',',':')).encode()
    while len(encoded)%4:encoded+=b' '
    size=12+8+len(encoded)+8+len(payload)
    OUT.write_bytes(struct.pack('<III',0x46546c67,2,size)+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(payload),0x004e4942)+payload)
    return {'node':'TLD_Remote_Arms','source_vertices':len(positions),'source_triangles':len(indices)//3,
            'radial_spikes_corrected':len(changed),'source_skin_joints':joint_names,
            'bind_matrices_byte_preserved':True,'skin_indices_and_weights_byte_preserved':True,'bone_transforms_preserved':True,
            'clips':0,'head_and_torso_meshes_exported':False,'radial_limits':{'upper_arm':.086,'forearm':.060}}

interaction=append_source_interaction_skin()

meshes=[o for o in runtime_collection.objects if o.type=='MESH']
exported_bytes=OUT.read_bytes();exported_json_length=struct.unpack_from('<I',exported_bytes,12)[0]
exported_doc=json.loads(exported_bytes[20:20+exported_json_length])
manifest={'version':1,'source':str(SOURCE.relative_to(ROOT)),'source_sha256':hashlib.sha256(source_bytes).hexdigest(),
          'sourcing':'hybrid: original Meshy survivor UV atlas + authored Blender metric surfaces',
          'source_preserved':SOURCE.read_bytes()==source_bytes,'coordinate_system':'glTF Y-up, metres; forward -Z',
          'asset':str(OUT.relative_to(ROOT)),'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'bytes':OUT.stat().st_size,
          'textures':len(exported_doc['textures']),'texture_resolution':[2048,2048],'materials':len(exported_doc['materials']),'meshes':len(exported_doc['meshes']),
          'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)+interaction['source_triangles'],
          'interaction':interaction,
          'hand_surface_revision':2,
          'hand_surface':{'profiles':DIGIT_PROFILES,'contact_centrelines_and_pivots_preserved':True,
                          'palm':'smoothed metacarpal arch, thenar/hypothenar pads, rounded heel/thumb web, tapered distal glove cap',
                          'digits':'asymmetric dorsal knuckles/palmar pads, distinct distal taper/girth, radial dorsal nail frame',
                          'material':'source atlas color + physical flexion/knuckle creases, fine pore tangent normals, packed variable roughness',
                          'skin_factor':[.62,.43,.33],'normal_strength':.65,'normal_detail_height_metres':.000014,'maximum_crease_height_metres':.000095},
          'hand_preview_archive':str((BASE_ARCHIVE/'hand-refinement-preview').relative_to(ROOT)),
          'contract':{'sleeve_nodes':['TLD_ViewSleeve_Left','TLD_ViewSleeve_Right'],'sleeve_wrist':[0,0,0],'sleeve_elbow':[0,-.34,0],
                      'upper_sleeve_nodes':['TLD_UpperSleeve_Left','TLD_UpperSleeve_Right'],'upper_elbow':[0,0,0],'upper_shoulder':[0,-.40,0],
                      'upper_max_radial_envelope':.087,'upper_caps':{o.name:[{'name':c['name'],'center':list(c['center']),'radius':c['radius'],'storage':c['storage']} for c in o['caps']] for o in meshes if o.name.startswith('TLD_UpperSleeve_')},
                      'hand_nodes':['TLD_GripHand_Left','TLD_GripHand_Right'],'grip_socket':[0,0,0],'hand_wrist':[0,-.075,.015],
                      'trigger_pivot':'RightTriggerFinger','fingers_per_hand':5,'scale_policy':'Native metric scale only; rotate/translate sleeves to wrist/elbow.'},
          'limitations':['New ordinary weapon grip geometry is rigid except explicit digit pivots.',
                         'Interaction hand topology remains the original fused Meshy hand; source sleeves only receive radial spike cleanup.',
                         'This derivative corrects silhouette and scale; it is not a photogrammetric hand scan or AAA certification.'],
          'authoring':str((ARCHIVE/'Viewmodel_Arms_v1.blend').relative_to(ROOT)),
          'proofs':[]}

# Three neutral orthographic proofs establish contour and UV quality without
# darkness, bodycam distortion, a weapon or particle effects hiding geometry.
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.render.resolution_x=1400;scene.render.resolution_y=1050;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Proof_World');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.10,.10,.10,1)
scene.view_settings.view_transform='Filmic';scene.view_settings.look='Medium High Contrast';scene.view_settings.exposure=0
proof_collection=bpy.data.collections.new('PROOF | lights camera');scene.collection.children.link(proof_collection)
for name,loc,power,size in [('key',(.8,-.7,.8),110,1.2),('fill',(-.7,-.3,.4),70,1.3),('rim',(0,.8,.8),150,.8)]:
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=size;o=bpy.data.objects.new(name,d);proof_collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,-.15))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Proof_Camera');cam=bpy.data.objects.new('Proof_Camera',d);proof_collection.objects.link(cam);d.type='ORTHO';d.ortho_scale=.68;scene.camera=cam
# Stage one hand and sleeve with the documented wrist overlap.
for o in runtime_collection.objects:
    if o.name.endswith('_Left') or o.name.startswith('Left'):o.hide_render=True
right_hand=bpy.data.objects['TLD_GripHand_Right'];right_hand.location=blender_point((0,.075,-.015))
bpy.data.objects['TLD_UpperSleeve_Right'].hide_render=True
for name,loc,target in [('front',(.6,-.8,.3),(0,0,-.11)),('side',(.8,.4,.3),(0,0,-.11)),('palm',(-.5,-.8,.25),(0,0,-.11))]:
    cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(ARCHIVE/('proof-'+name+'.png'));bpy.ops.render.render(write_still=True)
    manifest['proofs'].append(str(Path(scene.render.filepath).relative_to(ROOT)))
(ROOT/'assets/survivor/viewmodel-arms-v1-manifest.json').write_text(json.dumps(manifest,indent=2))
print('VIEWMODEL_ARMS_BUILD',json.dumps(manifest))

# Preserve the integrated exported skin as a second editable Blender master.
# The source binding graph is appended byte-for-byte above, then imported here
# for authoring review; this import never becomes the runtime GLB exporter.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUT))
scene=bpy.context.scene
for obj in bpy.data.objects:
    if obj.type=='MESH':obj.hide_render=obj.name!='TLD_Remote_Arms'
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=1400;scene.render.resolution_y=540;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Interaction_Proof_World');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.12,.12,1)
for name,loc,power,size in [('key',(0,-2,3),350,3),('fill',(-2,-1,1),170,3),('rim',(0,2,2),250,2)]:
    light=bpy.data.lights.new(name,'AREA');light.energy=power;light.size=size
    obj=bpy.data.objects.new(name,light);scene.collection.objects.link(obj);obj.location=loc
    obj.rotation_euler=(Vector((0,0,1.4))-obj.location).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.cameras.new('Interaction_Proof_Camera');obj=bpy.data.objects.new('Interaction_Proof_Camera',camera);scene.collection.objects.link(obj)
obj.location=(0,-3,1.75);obj.rotation_euler=(Vector((0,0,1.4))-obj.location).to_track_quat('-Z','Y').to_euler()
camera.type='ORTHO';camera.ortho_scale=2.15;scene.camera=obj
scene.render.filepath=str(ARCHIVE/'proof-interaction.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ARCHIVE/'Viewmodel_Arms_Integrated_v1.blend'))
manifest['integrated_authoring']=str((ARCHIVE/'Viewmodel_Arms_Integrated_v1.blend').relative_to(ROOT))
manifest['proofs'].append(str((ARCHIVE/'proof-interaction.png').relative_to(ROOT)))
(ROOT/'assets/survivor/viewmodel-arms-v1-manifest.json').write_text(json.dumps(manifest,indent=2))
