"""Original foreground mesh/rig/actions, authored in headless Blender 2.93.

Only weapon dimensions and grip frames are read from the metric reference.
No previous arm mesh, skin weights, rig or action is imported.
Run: blender --background --factory-startup --python scripts/rebuild-fps-arms-v5.py
"""
import bpy, json, math, hashlib
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '.art-source/fps-arms-v5'
SOURCE.mkdir(parents=True, exist_ok=True)
OUT = ROOT / 'assets/survivor/fps-arms-v5.glb'
MASTER = SOURCE / 'The_Last_Dead_FPS_Arms_v5.blend'
FPS = 60
protected = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
             for p in [ROOT/'assets/survivor/fps-arms-v3.glb',
                       ROOT/'assets/survivor/viewmodel-arms-v2.glb',
                       ROOT/'assets/survivor/tld-survivor-v02.glb']}
reference = json.loads((ROOT/'.art-source/viewmodel-arms-v3/rig-reference.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS

def B(v): return Vector((v[0], -v[2], v[1]))
def G(v): return Vector((v[0], v[2], -v[1]))
def smooth(t):
    t = max(0, min(1, t))
    return t*t*(3-2*t)
def gaussian(t, width): return math.exp(-(t/width)**2)

def material(name, roughness):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    node = mat.node_tree.nodes['Principled BSDF']
    node.inputs['Base Color'].default_value = (1, 1, 1, 1)
    node.inputs['Roughness'].default_value = roughness
    color = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    color.layer_name = 'AuthoredSurface'
    mat.node_tree.links.new(color.outputs['Color'], node.inputs['Base Color'])
    return mat

leather = material('V5 charcoal leather / worn edges', .72)
canvas = material('V5 weathered blue work jacket', .89)

def mesh(name, verts, faces, mat, palette=None, uv=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    data.materials.append(mat)
    for face in data.polygons: face.use_smooth = True
    if palette:
        layer = data.vertex_colors.new(name='AuthoredSurface')
        for loop in data.loops: layer.data[loop.index].color = (*palette[loop.vertex_index], 1)
    if uv:
        layer = data.uv_layers.new(name='SurfaceUV')
        for loop in data.loops: layer.data[loop.index].uv = uv[loop.vertex_index]
    return obj

def finish_surface(obj, palette):
    obj.data.vertex_colors.new(name='AuthoredSurface')
    obj.data.uv_layers.new(name='SurfaceUV')
    # Allocating another loop layer invalidates Blender 2.93 RNA references.
    layer = obj.data.vertex_colors['AuthoredSurface']
    uv = obj.data.uv_layers['SurfaceUV']
    for loop in obj.data.loops:
        p = G(obj.data.vertices[loop.vertex_index].co)
        layer.data[loop.index].color = (*palette(p), 1)
        uv.data[loop.index].uv = (p.y*7, p.z*7)
    for polygon in obj.data.polygons: polygon.use_smooth = True

def grip_paths(side, profile):
    """Three anatomical phalanges outside measured hardware tangent planes."""
    sign = -1 if side == 'left' else 1
    angles = (0, 50, 90) if profile['kind'] == 'fore-end' else (0, 55, 105)
    paths = {}
    radii = {'Index': .0105, 'Middle': .0112, 'Ring': .0102, 'Little': .0088, 'Thumb': .012}
    for digit, proximal, middle, distal in [('Index', .038, .025, .023),
                                          ('Middle', .042, .028, .0244),
                                          ('Ring', .039, .025, .023),
                                          ('Little', .030, .020, .0195)]:
        row = profile['rows'][digit]
        samples = [Vector((sign*p[0], p[1])) for p in row['points']]
        radius = radii[digit]
        n = [Vector((math.cos(math.radians(a)), math.sin(math.radians(a)))) for a in angles]
        d = [max(v.dot(p) for p in samples)+radius*f+.0006 for v, f in zip(n, [.86, .65, .58])]
        def corner(i, j):
            det = n[i].x*n[j].y - n[i].y*n[j].x
            return Vector(((d[i]*n[j].y-n[i].y*d[j])/det, (n[i].x*d[j]-d[i]*n[j].x)/det))
        pip = corner(0, 1)
        options = []
        for angle in range(angles[1]+6, 161):
            n[2] = Vector((math.cos(math.radians(angle)), math.sin(math.radians(angle))))
            d[2] = max(n[2].dot(p) for p in samples)+radius*.58+.0006
            dip = corner(1, 2)
            options.append((abs((dip-pip).length-middle), n[2].copy(), d[2], dip))
        _, n[2], d[2], dip = min(options, key=lambda item: item[0])
        root = pip - Vector((0, proximal))
        tip = dip + Vector((-n[2].y, n[2].x))*distal
        paths[digit] = [Vector((sign*p.x, row['y'], p.y)) for p in [root, pip, dip, tip]]
    wrist = Vector((sum(p[0].x for p in paths.values())/4+sign*.012, -.004, paths['Middle'][0].z-.090))
    bounds = [Vector((sign*p[0], p[1])) for p in profile['rows']['Middle']['points']]
    hi = max(p.x for p in bounds); low = min(p.y for p in bounds); cx = sum(p.x for p in bounds)/len(bounds)
    paths['Thumb'] = [wrist+Vector((-sign*.012, .028, .035)),
                      Vector((sign*(hi+.008), .043, low-.017)),
                      Vector((sign*(cx+.009), .027, low-.008)),
                      Vector((sign*(cx-.006), .026, low-.006))]
    if side == 'right' and profile.get('triggerPoint'):
        # The former shortcut traversed the grip's solid volume to reach a
        # trigger reference hidden behind its far face. Keep an anatomical
        # outside route over the upper edge instead of cutting through wood.
        paths['Index'][1].z+=.002
        paths['Index'][2].z+=.006
        paths['Index'][3].z+=.009
    return wrist, paths, radii

def tube(name, path, radius, sign, wrist):
    """Rounded joints, flat dorsal planes and soft pads, with tapered fingertips."""
    verts, faces = [], []
    sides = 24
    # Bury the closed proximal cap inside the metacarpal volume. Beginning a
    # flat cylinder exactly at the MCP creates a visible inserted-finger rim.
    surface_path=[p.copy() for p in path]
    surface_path[0]=path[0].lerp(wrist,.18 if name=='Thumb' else .20)
    centers = []
    for j in range(3):
        a, b = surface_path[j:j+2]
        for k in range(12): centers.append(a.lerp(b, k/12))
    centers.append(path[-1])
    # Smooth the centerline only at the two joints; leave shaft lengths intact.
    for j in [12,24]:
        a,corner,b=centers[j-3].copy(),centers[j].copy(),centers[j+3].copy()
        for k in range(-3,4):
            t=(k+3)/6;centers[j+k]=a*(1-t)**2+corner*(2*t*(1-t))+b*t*t
    normal = Vector((sign, 0, 0))
    for j, c in enumerate(centers):
        t = j/(len(centers)-1)
        tangent = (centers[min(j+1, len(centers)-1)]-centers[max(0, j-1)]).normalized()
        normal = (normal-tangent*normal.dot(tangent)).normalized()
        cross = tangent.cross(normal).normalized()
        cap = math.sqrt(max(.001, 1-((t-.90)/.10)**2)) if t>.90 else 1
        r = radius*(1-.32*t)*cap
        if name=='Thumb':r=radius*(1.0-.17*smooth(t/.36)-.18*smooth((t-.40)/.60))*cap
        joint = .09*gaussian(t-1/3, .045)+.065*gaussian(t-2/3, .04)
        crease = .0008*(gaussian(t-.35, .014)+gaussian(t-.69, .014))
        for k in range(sides):
            angle = math.tau*k/sides
            x, y = math.cos(angle), math.sin(angle)
            p = c+normal*((r*(.84+joint)-crease)*math.copysign(abs(x)**.72, x))+cross*(r*math.copysign(abs(y)**.82, y))
            verts.append(B(p))
            if j<len(centers)-1: faces.append((j*sides+k, j*sides+(k+1)%sides, (j+1)*sides+(k+1)%sides, (j+1)*sides+k))
    faces += [tuple(reversed(range(sides))), tuple((len(centers)-1)*sides+k for k in range(sides))]
    return mesh(name, verts, faces, leather)

def build_glove(side, profile):
    sign = -1 if side=='left' else 1
    wrist, paths, radii = grip_paths(side, profile)
    roots = [paths[d][0] for d in ['Index','Middle','Ring','Little']]
    center = sum(roots, Vector())/4
    verts, faces = [], []
    rows, sides = 33, 48
    # The terminal section follows EACH MCP center, rather than an ellipse
    # whose outer tips collapse away from the index/little finger roots.
    # A cupped palmar patch and arched dorsal patch share a closed perimeter.
    for j in range(rows):
        t = j/(rows-1)
        c = wrist.lerp(center, t)
        width = .026+.027*math.sin(t*math.pi/2)
        for k in range(sides):
            a = math.tau*k/sides
            y = c.y+width*math.sin(a)
            weights = [gaussian(y-p.y, .040) for p in roots]
            rz = sum(p.z*w for p,w in zip(roots, weights))/sum(weights)
            rx = sum(p.x*w for p,w in zip(roots, weights))/sum(weights)
            relief = max(gaussian(y-p.y,.013) for p in roots)
            dorsal=max(0,math.cos(a));palmar=max(0,-math.cos(a))
            ridge=0
            heel=.006*gaussian(t-.25,.19)*palmar**2
            hollow=.008*gaussian(t-.60,.24)*gaussian(y+.006,.027)*palmar**2
            depth=.017+.003*math.sin(math.pi*t)-.009*smooth((t-.82)/.18)
            xcenter=c.x+smooth((t-.58)/.42)*(rx-center.x)+sign*.004*math.sin(math.pi*t)**2
            x=xcenter+sign*(depth*math.cos(a)+ridge-heel+hollow)
            terminal=rz-.002+.002*relief
            z=wrist.z-.010+(center.z-wrist.z+.010)*t+smooth((t-.55)/.45)*(terminal-center.z)
            # Four metacarpal arches, recessed interdigital webs, no broad
            # straight cap. Every MCP enters a real overlapping skin volume.
            verts.append(B((x,y,z)))
            if j<rows-1: faces.append((j*sides+k,j*sides+(k+1)%sides,(j+1)*sides+(k+1)%sides,(j+1)*sides+k))
    faces.append(tuple(reversed(range(sides))))
    # The distal contour is nonplanar. Pair palmar/dorsal samples instead of
    # asking a single concave n-gon to tessellate across four knuckles.
    base=(rows-1)*sides
    for k in range(12,36):
        opposite=lambda i:(24-i)%sides
        face=tuple(dict.fromkeys([base+k,base+(k+1)%sides,base+opposite(k+1),base+opposite(k)]))
        if len(face)>2:faces.append(face)
    parts = [mesh('NewPalm',verts,faces,leather)]
    for digit in paths: parts.append(tube(digit, paths[digit], radii[digit], sign,wrist))
    # The broad palm itself owns thenar volume; the extended thumb cap enters
    # that volume without an added external lobe.
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.object.join()
    glove=parts[0]
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
    glove.data.remesh_voxel_size=.0010
    bpy.ops.object.voxel_remesh()
    mod=glove.modifiers.new('Sculpt web relaxation','SMOOTH');mod.factor=.5;mod.iterations=12
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=glove.modifiers.new('Foreground surface budget','DECIMATE');mod.ratio=.18
    bpy.ops.object.modifier_apply(modifier=mod.name)
    # A successful voxel operation is not proof that disjoint inputs joined.
    # Reject the build unless the entire structural glove is one component.
    parents=list(range(len(glove.data.vertices)))
    def find(i):
        while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]
        return i
    for edge in glove.data.edges:
        a,b=map(find,edge.vertices);parents[b]=a
    components=len(set(find(i) for i in range(len(parents))))
    assert components==1, 'Detached glove shell: '+side+' '+profile['kind']+' components='+str(components)
    glove['structural_shell_components']=components
    glove['structural_shell_vertex_count']=len(glove.data.vertices)
    # Two sewn dorsal panel edges, projected onto the actual sculpted surface.
    # These are part of the glove skin, not loose decorations above the palm.
    tree=BVHTree.FromPolygons([v.co for v in glove.data.vertices],[tuple(p.vertices) for p in glove.data.polygons])
    stitch_verts,stitch_faces=[],[]
    def surface_point(y,z):
        origin=B((sign*.22,y,z));direction=B((-sign,0,0))
        point,normal,_,_=tree.ray_cast(origin,direction,.4)
        return point+normal*.00025 if point is not None else None
    for y in [-.025,.031]:
        for j in range(22):
            z=wrist.z+.012+j*.0028
            a=surface_point(y,z);b=surface_point(y,z+.0015)
            if a is None or b is None:continue
            axis=(b-a).normalized();n=B((0,1,0));n=(n-axis*n.dot(axis)).normalized();cross=axis.cross(n)
            offset=len(stitch_verts)
            for c in [a,b]:
                for k in range(6):stitch_verts.append(c+(n*math.cos(math.tau*k/6)+cross*math.sin(math.tau*k/6))*.00032)
            for k in range(6):stitch_faces.append((offset+k,offset+(k+1)%6,offset+6+(k+1)%6,offset+6+k))
    if stitch_verts:
        sewn=mesh('Inset dorsal topstitches',stitch_verts,stitch_faces,leather)
        bpy.ops.object.select_all(action='DESELECT');glove.select_set(True);sewn.select_set(True);bpy.context.view_layer.objects.active=glove;bpy.ops.object.join()
    def palette(p):
        dorsal=max(0,min(1,(sign*(p.x-wrist.x)+.012)/.026))
        knuckle=max(gaussian(p.y-r.y,.010) for r in roots)*gaussian(p.z-center.z,.028)*dorsal
        cuff=gaussian(p.z-wrist.z+.005,.003)
        grain=.002*math.sin(p.y*1371+p.z*843)*math.sin(p.x*1103)
        panel_edge=max(gaussian(p.y+.025,.0011),gaussian(p.y-.031,.0011))*smooth((p.z-wrist.z-.009)/.008)*(1-smooth((p.z-wrist.z-.069)/.012))*dorsal
        wear=.016*knuckle+.012*cuff+grain+.026*panel_edge
        return (.115+wear,.119+wear,.098+wear*.85)
    finish_surface(glove,palette)
    glove['continuous_thumb_web']=True
    glove['original_mesh_revision']=5
    return glove,wrist,paths

def bone(data,name,head,tail,parent=None,axis=None):
    b=data.edit_bones.new(name);b.head=head;b.tail=tail
    if parent: b.parent=data.edit_bones[parent]
    if axis:
        y=(tail-head).normalized()
        x=(axis-y*axis.dot(y)).normalized()
        b.align_roll(x.cross(y))
    return b

def segment_distance(p,a,b):
    t=max(0,min(1,(p-a).dot(b-a)/(b-a).length_squared))
    return (p-a.lerp(b,t)).length,t

def skin(obj,rig,influences):
    groups={name:obj.vertex_groups.new(name=name) for name in set(n for values in influences for n,w in values)}
    for i, values in enumerate(influences):
        total=sum(w for n,w in values)
        for name,weight in values:
            if weight>0: groups[name].add([i],weight/total,'REPLACE')
    mod=obj.modifiers.new('Original V5 weighted skin','ARMATURE');mod.object=rig

def sleeve(name,side,prefix,shoulder,elbow,wrist,rig,wrapper):
    """Quad panel garment with a volume-preserving elbow helper and sewn cuff."""
    upper=(shoulder-elbow).normalized();lower=(wrist-elbow).normalized()
    far=shoulder+upper*.85
    entry=elbow+upper*.075;exit=elbow+lower*.075
    lengths=[(entry-far).length,.1275,(wrist-exit).length]
    total=sum(lengths)
    def center(s):
        d=s*total
        if d<lengths[0]: return far.lerp(entry,d/lengths[0])
        if d<sum(lengths[:2]):
            t=(d-lengths[0])/lengths[1]
            return entry*(1-t)**2+elbow*(2*t*(1-t))+exit*t*t
        return exit.lerp(wrist,(d-sum(lengths[:2]))/lengths[2])
    verts,faces,uv,palette,weights=[],[],[],[],[]
    rows,sides=97,40
    normal=Vector((1,0,0));last=None
    for j in range(rows):
        s=j/(rows-1);c=center(s);d=s*total
        tangent=(center(min(1,s+.001))-center(max(0,s-.001))).normalized()
        if last: normal=last.rotation_difference(tangent)@normal
        normal=(normal-tangent*normal.dot(tangent)).normalized();cross=tangent.cross(normal).normalized();last=tangent
        fore=(d-sum(lengths[:2]))/lengths[2]
        radius=(.101+.033*gaussian((c-elbow).dot(upper)-.34,.28)) if fore<0 else (.104+.012*gaussian(fore-.24,.18)-.043*smooth(fore))
        joint=d-(lengths[0]+lengths[1]*.5)
        cloth=1-smooth((abs(joint)-.041)/.12)
        influence=[(prefix+'ElbowCloth',cloth),(prefix+('Upper' if joint<0 else 'Lower'),1-cloth)]
        for k in range(sides):
            a=math.tau*k/sides
            inner=max(0,math.cos(a-1.2))**4
            fold=inner*(.008*gaussian(joint-.065+.013*math.sin(a),.024)-.004*gaussian(joint-.10,.018))
            fold+=.004*gaussian(fore-.69+.10*math.sin(a),.05) if fore>0 else 0
            if fore>0:
                fold+=.009*gaussian(fore-.43-.11*math.sin(a),.065)*max(0,math.cos(a+.5))**3
                fold-=.004*gaussian(fore-.51-.11*math.sin(a),.035)*max(0,math.cos(a+.5))**3
                # Broad fabric buckling follows the inside elbow and cuff.
                # Alternate raised folds and valleys; do not ring the entire arm.
                panel=max(0,math.cos(a-.7))**2
                for at,amplitude in [(.16,.009),(.32,.012),(.61,.008),(.77,.006)]:
                    shift=fore-at-.075*math.sin(a+at*3)
                    fold+=amplitude*(gaussian(shift,.047)-.48*gaussian(shift-.065,.033))*panel
            seam=.003*gaussian(math.atan2(math.sin(a-.4),math.cos(a-.4)),.045)
            cuff=.003*gaussian(fore-.90,.016) if fore>0 else 0
            radial=radius+fold+seam+cuff
            verts.append(c+normal*(radial*math.cos(a))+cross*(radial*.88*math.sin(a)))
            uv.append((k/sides,s));weights.append(influence)
            seam_angle=math.atan2(math.sin(a-.4),math.cos(a-.4))
            panel_shade=.83 if -.85<seam_angle<0 else 1
            shade=(1+.08*math.cos(a*2+s*3)+.025*math.sin(d*74+a*3))*panel_shade
            base=(.190,.220,.210) if fore<.86 else (.063,.076,.071)
            palette.append(tuple(v*shade for v in base))
            if j<rows-1: faces.append((j*sides+k,j*sides+(k+1)%sides,(j+1)*sides+(k+1)%sides,(j+1)*sides+k))
    faces += [tuple(reversed(range(sides))),tuple((rows-1)*sides+k for k in range(sides))]
    obj=mesh('FPSSleeve_'+name+'_'+side,verts,faces,canvas,palette,uv);obj.parent=wrapper
    skin(obj,rig,weights)
    obj['construction']='Continuous quad panels, oblique elbow compression, inset cuff; no inherited mesh'

def action(rig,name,duration,frames):
    act=bpy.data.actions.new(name);act.use_fake_user=True
    act['index_contact_revision']=2
    if name.endswith('/draw'):act['thumb_release_revision']=2
    rig.animation_data_create();rig.animation_data.action=act
    for time,values in frames:
        for pb in rig.pose.bones:
            pb.rotation_mode='XYZ';pb.rotation_euler=values.get(pb.name,(0,0,0))
            if pb.name in values: pb.keyframe_insert('rotation_euler',frame=1+time*FPS)
    for curve in act.fcurves:
        for key in curve.keyframe_points:
            key.interpolation='BEZIER';key.handle_left_type=key.handle_right_type='AUTO_CLAMPED'
    track=rig.animation_data.nla_tracks.new();track.name=name
    strip=track.strips.new(name,1,act);strip.name=name;track.mute=True
    rig.animation_data.action=None
    for pb in rig.pose.bones: pb.rotation_euler=(0,0,0)

stats=[]
for weapon in reference['weapons']:
    name,index=weapon['name'],weapon['index']
    print('REBUILD_V5',name,flush=True)
    root=bpy.data.objects.new('FPSRig_'+name,None);scene.collection.objects.link(root);root['fps_rig_revision']=5
    data=bpy.data.armatures.new('FPSBones_'+name)
    rig=bpy.data.objects.new('FPSBones_'+name,data);scene.collection.objects.link(rig);rig.parent=root;rig.show_in_front=True
    assemblies=[]
    for arm in weapon['arms']:
        side=arm['side'];prefix='FPS_'+name+'_'+side+'_'
        glove,wrist_local,paths=build_glove(side,arm['profile'])
        hm=Matrix([arm['handMatrix'][i::4] for i in range(4)])
        wrist=hm@wrist_local
        old_w,old_e,old_s=[Vector(arm[k]) for k in ['wrist','elbow','shoulder']]
        axis=(wrist-hm@paths['Middle'][0]).normalized()
        old_axis=(old_e-old_w).normalized();angle=old_axis.angle(axis);limit=math.radians(arm['profile']['wristConeDegrees'])
        if angle>limit: old_axis=axis.rotation_difference(old_axis).slerp(Matrix.Identity(3).to_quaternion(),1-limit/angle)@axis
        elbow=wrist+old_axis*(old_e-old_w).length
        shoulder=elbow+(old_s-old_e).normalized()*(old_s-old_e).length
        shoulder,elbow,wrist=map(B,[shoulder,elbow,wrist])
        points={digit:[B(hm@p) for p in path] for digit,path in paths.items()}
        bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
        bpy.ops.object.mode_set(mode='EDIT')
        bone(data,prefix+'Upper',shoulder,elbow)
        bone(data,prefix+'Lower',elbow,wrist,prefix+'Upper')
        bone(data,prefix+'Hand',wrist,points['Middle'][0],prefix+'Lower')
        bone(data,prefix+'ElbowCloth',elbow,elbow+((wrist-elbow).normalized()-(shoulder-elbow).normalized()).normalized()*.07,prefix+'Upper')
        for digit,path in points.items():
            bend=(path[1]-path[0]).cross(path[2]-path[1])
            if bend.length<1e-5: bend=B(hm.to_3x3()@Vector((0,1,0)))
            bend.normalize()
            for j in range(3): bone(data,prefix+digit+str(j),path[j],path[j+1],prefix+'Hand' if j==0 else prefix+digit+str(j-1),bend)
        bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
        wrapper=bpy.data.objects.new('FPS_'+name+'_'+side,None);scene.collection.objects.link(wrapper);wrapper.parent=root
        glove.name='FPSGlove_'+name+'_'+side;glove.parent=wrapper
        for v in glove.data.vertices: v.co=B(hm@G(v.co))
        influences=[]
        inverse_hand=hm.inverted()
        palm_center=sum([paths[d][0] for d in ['Index','Middle','Ring','Little']],Vector())/4
        for vertex in glove.data.vertices:
            options=[]
            for digit,path in points.items():
                for j in range(3):
                    d,t=segment_distance(vertex.co,path[j],path[j+1]);options.append((d,digit,j,t))
            distance,digit,j,t=min(options)
            path=points[digit]
            along=(vertex.co-path[0]).dot((path[1]-path[0]).normalized())
            amount=smooth((along+.003)/.022) if j==0 else 1
            amount*=smooth((.030*hm.to_scale().x-distance)/(.010*hm.to_scale().x))
            local=inverse_hand@G(vertex.co)
            palm_t=max(0,min(1,(local.z-wrist_local.z)/(palm_center.z-wrist_local.z)))
            palm_x=wrist_local.lerp(palm_center,palm_t).x
            palm_ownership=smooth((palm_center.z-.004-local.z)/.020)*smooth((.048-local.y)/.020)*smooth((.032-abs(local.x-palm_x))/.012)
            amount*=1-palm_ownership
            values=[(prefix+'Hand',1-amount)]
            # Joint neighborhoods blend adjacent phalanges; rigid middle shafts
            # retain pad volume, unlike distance-only nearest-bone assignment.
            blend=.20
            if t<blend and j>0:
                w=.5*(1-t/blend);values += [(prefix+digit+str(j-1),amount*w),(prefix+digit+str(j),amount*(1-w))]
            elif t>1-blend and j<2:
                w=.5*(t-(1-blend))/blend;values += [(prefix+digit+str(j),amount*(1-w)),(prefix+digit+str(j+1),amount*w)]
            else: values.append((prefix+digit+str(j),amount))
            influences.append(values)
        skin(glove,rig,influences)
        sleeve(name,side,prefix,shoulder,elbow,wrist,rig,wrapper)
        assemblies.append((side,prefix))
    def performance(phase,t):
        values={}
        for side,p in assemblies:
            sign=-1 if side=='left' else 1
            # Each hand has its own timing and amplitude, rather than mirrored
            # fingers twitching equally on every weapon action.
            if phase=='idle':
                wave=math.sin(t*math.tau/2.8)
                upper=(wave*.008,sign*wave*.011,0);lower=(wave*.010,0,0)
                flex={'Index':wave*.002,'Middle':wave*.003,'Ring':wave*.004,'Little':wave*.005,'Thumb':wave*.003}
            elif phase=='walk':
                wave=math.sin(t*math.tau)
                upper=(wave*.022,sign*wave*.038,wave*.008);lower=(wave*.045,0,0)
                flex={d:wave*a for d,a in [('Index',.004),('Middle',.006),('Ring',.008),('Little',.010),('Thumb',.006)]}
            elif phase=='draw':
                release=1-smooth(t)
                upper=(-release*.08,sign*release*.09,0);lower=(-release*.065,0,0)
                flex={d:-release*a for d,a in [('Index',.01),('Middle',.12),('Ring',.16),('Little',.20),('Thumb',-.055)]}
            elif phase=='fire':
                impact=gaussian(t-.075,.060);settle=gaussian(t-.19,.095)
                upper=(-impact*.038+settle*.013,sign*impact*.035,0);lower=(impact*.055-settle*.014,0,0)
                flex={'Index':(.12*impact if side=='right' else .006*impact),'Middle':.003*impact,'Ring':.003*impact,'Little':.004*impact,'Thumb':.012*impact}
            else:
                load=smooth(t/.20)*(1-smooth((t-.65)/.35));hit=gaussian(t-.46,.12)
                upper=(-load*.07,sign*load*.065,hit*.025);lower=(load*.085-hit*.026,0,0)
                flex={'Index':.060*load,'Middle':.008*load,'Ring':.010*load,'Little':.016*load,'Thumb':.030*load}
            values[p+'Upper']=upper;values[p+'Lower']=lower
            for digit,amount in flex.items():
                # Fire starts/ends at bind exactly; gait and breathing loops
                # have matching endpoints. Opening the draw uses real joints.
                if phase=='fire' and (t==0 or t>=.5): amount=0
                values[p+digit+'0']=(amount,0,0)
                values[p+digit+'1']=(amount*.65,0,0)
                values[p+digit+'2']=(amount*.30,0,0)
                if phase=='fire' and digit=='Index' and side=='right':
                    values[p+digit+'0']=(amount*.125,0,0)
                    values[p+digit+'1']=(amount*.20,0,0)
                    values[p+digit+'2']=(amount*.45,0,0)
        if phase=='fire' and (t==0 or t>=.5): values={k:(0,0,0) for k in values}
        return values
    for phase,duration,times in [('idle',2.8,[0,.7,1.4,2.1,2.8]),('walk',1,[0,.125,.25,.375,.5,.625,.75,.875,1]),
                                 ('draw',[.36,.49,.45,.55,.40,.47,.41,.52][index],[0,.20,.45,.70,1]),
                                 ('fire' if index<6 else 'strike',.5 if index<6 else 1,[0,.03,.075,.12,.20,.32,.5] if index<6 else [0,.12,.25,.38,.46,.60,.78,1])]:
        frames=[(t*duration if phase=='draw' else t,performance(phase,t)) for t in times]
        action(rig,name+'/'+phase,duration,frames)
    stats.append({'weapon':name,'arms':len(assemblies),'bones':len(data.bones)})

scene['README']='Original V5 mesh and rig. X is anatomical finger flexion. NLA contains named weapon actions; game owns assembly motion and grip-frame seating. No arm geometry imported.'
scene.frame_start=1;scene.frame_end=169;scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_texcoords=True,export_normals=True,export_colors=True,export_materials='EXPORT',export_extras=True,export_animations=True,export_nla_strips=True,export_frame_range=False,export_force_sampling=True)
for path,digest in protected.items(): assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==digest
manifest={'version':5,'asset':str(OUT.relative_to(ROOT)),'authoring':str(MASTER.relative_to(ROOT)),
          'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'bytes':OUT.stat().st_size,
          'blender':bpy.app.version_string,'protected_source_hashes':protected,'rigs':stats,
          'construction':'Original palm/digits/thumb web, quad sleeve panels, anatomical finger axes, blended joint weights, elbow cloth helper',
          'actions':[a.name for a in bpy.data.actions], 'acceptance':'Pending rendered validation; user visual approval remains separate'}
OUT.with_name(OUT.stem+'-manifest.json').write_text(json.dumps(manifest,indent=2))
print('V5_EXPORT',OUT.stat().st_size,flush=True)
