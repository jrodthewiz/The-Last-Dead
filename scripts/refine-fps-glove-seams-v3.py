"""Fit glove construction to the accepted saved Blender skin.

Run after polish-fps-gloves-v3.py, before the export-only FPS export. Seams are
joined to the existing weighted mesh and share its vertex-color material.
No extra runtime object, material, texture, controller or draw call is added.
"""
import argparse, bpy, hashlib, json, math, sys
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
ARCHIVE=ROOT/'.art-source/viewmodel-arms-v3'
parser=argparse.ArgumentParser()
parser.add_argument('--input',default=str(ARCHIVE/'The_Last_Dead_Animated_FPS_Arms_v3.blend'))
parser.add_argument('--output',default=str(ARCHIVE/'The_Last_Dead_Animated_FPS_Arms_v3.blend'))
parser.add_argument('--weapons',default='breach')
parser.add_argument('--resume',action='store_true')
parser.add_argument('--checkpoint',action='store_true')
parser.add_argument('--report',default=str(ARCHIVE/'glove-seam-report.json'))
opt=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.open_mainfile(filepath=opt.input)
reference=json.loads((ARCHIVE/'rig-reference.json').read_text())
selected=set(opt.weapons.split(','))
def B(p): return Vector((p[0],-p[2],p[1]))
def G(p): return Vector((p[0],p[2],-p[1]))
def sat(v): return max(0,min(1,v))
def mix(a,b,t): return tuple(x*(1-t)+y*t for x,y in zip(a,b))
def gauss(v,w): return math.exp(-(v/w)**2)
def invariant():
    rows={
      'bones':[(o.name,[(b.name,tuple(b.head_local),tuple(b.tail_local),b.parent.name if b.parent else None)for b in o.data.bones])for o in bpy.data.objects if o.type=='ARMATURE'],
      'actions':[(a.name,[(c.data_path,c.array_index,[(tuple(k.co),tuple(k.handle_left),tuple(k.handle_right),k.interpolation)for k in c.keyframe_points])for c in a.fcurves])for a in bpy.data.actions],
      'sleeves':[(o.name,[tuple(v.co)for v in o.data.vertices])for o in bpy.data.objects if o.name.startswith('FPSSleeve_')]}
    return {k:hashlib.sha256(json.dumps(v,sort_keys=True).encode()).hexdigest()for k,v in rows.items()}
before=invariant()
visibility={c.name:(c.hide_viewport,c.hide_render)for c in bpy.data.collections if c.name.startswith('FPS / ')}
for name in visibility:
    bpy.data.collections[name].hide_viewport=False;bpy.data.collections[name].hide_render=False
report={'input':opt.input,'inputSha256':hashlib.sha256(Path(opt.input).read_bytes()).hexdigest(),'hands':[],'invariantsBefore':before}

for weapon in reference['weapons']:
    if 'all' not in selected and weapon['name'] not in selected: continue
    for arm in weapon['arms']:
        name,side=weapon['name'],arm['side']
        hand=bpy.data.objects['FPSGlove_'+name+'_'+side]
        assert hand.get('glove_finish_revision')==7,'Finish the fitted hand first'
        if hand.get('fitted_construction_seams'):
            if opt.resume: continue
            raise RuntimeError('Seams already fitted; use a saved unseamed study')
        hm=Matrix([arm['handMatrix'][i::4]for i in range(4)]);inverse=hm.inverted()
        scale=hm.to_scale().x;sign=-1 if side=='left' else 1
        rig=bpy.data.objects['FPSBones_'+name];prefix='FPS_'+name+'_'+side+'_'
        wrist=inverse@G(rig.data.bones[prefix+'Hand'].head_local)
        roots=[inverse@G(rig.data.bones[prefix+d+'0'].head_local)for d in ['Index','Middle','Ring','Little']]
        end=sum(roots,Vector())/4;length=end.z-wrist.z
        positions=[v.co.copy()for v in hand.data.vertices]
        faces=[tuple(p.vertices)for p in hand.data.polygons]
        bvh=BVHTree.FromPolygons(positions,faces)
        # A broad reinforcement value has no narrow painted sawtooth edge.
        layer=hand.data.vertex_colors['AuthoredSurface']
        if hand.data.uv_layers.active is None:
            uv=hand.data.uv_layers.new(name='UVMap')
            for loop in hand.data.loops:
                p=G(positions[loop.vertex_index]);uv.data[loop.index].uv=(p.x*4,p.y*4)
        for loop in hand.data.loops:
            p=inverse@G(positions[loop.vertex_index]);t=(p.z-wrist.z)/length
            centre=wrist.lerp(end,t);u=(p.y-centre.y)/(.032+.011*sat(t))
            dorsal=sat((sign*(p.x-centre.x)-.006)/.014)
            palm=sat((.97-t)/.13)*sat((t+.34)/.12)
            distance=math.sqrt(((t-.43)/.35)**2+(u/.80)**2)
            panel=sat((1.10-distance)/.30)*dorsal*palm
            border=gauss(distance-.97,.16)*dorsal*palm
            cuff=sat((.055-t)/.12)*sat((t+.30)/.10)
            color=mix((.086,.060,.035),(.152,.104,.059),panel*.87)
            color=mix(color,(.040,.025,.013),border*.32)
            color=mix(color,(.045,.029,.016),cuff*.84)
            keep_digit=sat((t-.74)/.14)
            layer.data[loop.index].color=(*mix(color,layer.data[loop.index].color[:3],keep_digit),1)

        def fitted(local_origin,local_direction):
            origin=B(hm@local_origin)
            direction=B(hm.to_3x3()@local_direction).normalized()
            hit,normal,index,distance=bvh.ray_cast(origin,direction,.24*scale)
            if hit is None: raise RuntimeError('Construction seam missed skin: '+name+'/'+side)
            return hit,normal,index

        contours=[]
        panel=[]
        for k in range(128):
            angle=k*math.tau/128;t=.43+.35*.95*math.cos(angle)
            centre=wrist.lerp(end,t);u=.80*.95*math.sin(angle)
            p=Vector((centre.x+sign*.12,centre.y+u*(.032+.011*sat(t)),wrist.z+length*t))
            panel.append(fitted(p,Vector((-sign,0,0))))
        contours.append(('panel',panel))
        cuff=[]
        for k in range(96):
            angle=k*math.tau/96;direction=Vector((math.cos(angle),math.sin(angle),0))
            centre=wrist.lerp(end,-.075)
            cuff.append(fitted(centre+direction*.12,-direction))
        contours.append(('cuff',cuff))

        vertices=[];seam_faces=[];colors=[];weights=[];uvs=[]
        for label,contour in contours:
            start=len(vertices);along=0
            for k,(hit,normal,face_index)in enumerate(contour):
                centre=hit+normal*(.00027*scale)
                tangent=(contour[(k+1)%len(contour)][0]-contour[(k-1)%len(contour)][0]).normalized()
                lateral=tangent.cross(normal).normalized();up=lateral.cross(tangent).normalized()
                if k: along+=(hit-contour[k-1][0]).length/scale
                # Barycentric skin weights of the actual fitted source facet.
                indices=faces[face_index];a,b,c=[positions[i]for i in indices[:3]]
                e1,e2,h=b-a,c-a,hit-a;aa,ab,bb=e1.dot(e1),e1.dot(e2),e2.dot(e2)
                det=max(1e-20,aa*bb-ab*ab)
                wb=sat((h.dot(e1)*bb-h.dot(e2)*ab)/det)
                wc=sat((h.dot(e2)*aa-h.dot(e1)*ab)/det);wa=max(0,1-wb-wc)
                total=wa+wb+wc;combined={}
                for vertex_index,factor in zip(indices[:3],[wa/total,wb/total,wc/total]):
                    for g in hand.data.vertices[vertex_index].groups:
                        combined[g.group]=combined.get(g.group,0)+g.weight*factor
                influence=sorted(combined.items(),key=lambda q:-q[1])[:4]
                total=sum(w for _,w in influence);assert total>.001
                influence=[(group,w/total)for group,w in influence]
                thread=(.181,.122,.067)if along%.0045<.0025 else(.028,.018,.009)
                radius=.00048*scale if label=='cuff' else .00042*scale
                for j in range(8):
                    angle=j*math.tau/8
                    vertices.append(centre+(up*math.cos(angle)+lateral*math.sin(angle))*radius)
                    colors.append(thread);weights.append(influence);uvs.append((along,j/8))
            for k in range(len(contour)):
                for j in range(8):
                    a=start+k*8+j;b=start+k*8+(j+1)%8
                    c=start+((k+1)%len(contour))*8+(j+1)%8;d=start+((k+1)%len(contour))*8+j
                    seam_faces.append((a,b,c,d))
        data=bpy.data.meshes.new('Fitted glove construction');data.from_pydata(vertices,[],seam_faces);data.update()
        seam=bpy.data.objects.new('Fitted glove construction',data);bpy.context.scene.collection.objects.link(seam)
        seam.matrix_world=hand.matrix_world.copy();data.materials.append(hand.data.materials[0])
        color_layer=data.vertex_colors.new(name='AuthoredSurface');uv_layer=data.uv_layers.new(name=hand.data.uv_layers.active.name)
        for loop in data.loops:
            color_layer.data[loop.index].color=(*colors[loop.vertex_index],1);uv_layer.data[loop.index].uv=uvs[loop.vertex_index]
        for group in hand.vertex_groups: seam.vertex_groups.new(name=group.name)
        for index,influence in enumerate(weights):
            for group,weight in influence: seam.vertex_groups[group].add([index],weight,'REPLACE')
        for polygon in data.polygons: polygon.use_smooth=True
        bpy.ops.object.select_all(action='DESELECT');hand.select_set(True);seam.select_set(True)
        bpy.context.view_layer.objects.active=hand;bpy.ops.object.join()
        # Blender 2.93 join can leave new loops white when merging color
        # layer layouts. Author the joined loops explicitly, then expose only
        # the material's named color layer to glTF's COLOR_0 export.
        joined_colors=hand.data.vertex_colors['AuthoredSurface']
        for loop in hand.data.loops:
            index=loop.vertex_index-len(positions)
            if index>=0: joined_colors.data[loop.index].color=(*colors[index],1)
        for color_layer in list(hand.data.vertex_colors):
            if color_layer.name!='AuthoredSurface': hand.data.vertex_colors.remove(color_layer)
        hand.data.vertex_colors.active_index=0
        assert len(hand.data.materials)==1,'Construction must remain one glove draw'
        hand['fitted_construction_seams']='Surface-fitted cuff and dorsal reinforcement; barycentric source skin weights'
        hand['seam_source_vertices']=len(positions)
        report['hands'].append({'weapon':name,'side':side,'sourceVertices':len(positions),'addedVertices':len(vertices),'addedTriangles':len(seam_faces)*2,'materialSlots':len(hand.data.materials),'sourceSkinRetained':True,'seamWeightSource':'barycentric actual source facet, normalized top four'})
        print('FITTED_GLOVE_SEAMS',name,side,flush=True)
        if opt.checkpoint:
            for collection,(viewport,render)in visibility.items():
                bpy.data.collections[collection].hide_viewport=viewport;bpy.data.collections[collection].hide_render=render
            bpy.ops.wm.save_as_mainfile(filepath=opt.output)
            for collection in visibility:
                bpy.data.collections[collection].hide_viewport=False;bpy.data.collections[collection].hide_render=False

after=invariant();assert after==before,'Rig, animation or sleeves changed'
for name,(viewport,render)in visibility.items():
    bpy.data.collections[name].hide_viewport=viewport;bpy.data.collections[name].hide_render=render
report['invariantsAfter']=after;report['status']='PASS: seam construction fitted; runtime and artistic gates separate'
bpy.ops.wm.save_as_mainfile(filepath=opt.output)
report['outputSha256']=hashlib.sha256(Path(opt.output).read_bytes()).hexdigest()
Path(opt.report).write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
