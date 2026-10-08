"""Replace inherited sleeve/sphere union with a tailored weighted sleeve loft.

Edits saved FPS master only. Bone bind transforms, Actions and fitted gloves
remain unchanged. Start with Breach; --weapons all propagates the same cut.
"""
import argparse, bpy, hashlib, json, math, sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
ARCHIVE=ROOT/'.art-source/viewmodel-arms-v3'
MASTER=ARCHIVE/'The_Last_Dead_Animated_FPS_Arms_v3.blend'
p=argparse.ArgumentParser()
p.add_argument('--weapons',default='breach')
p.add_argument('--input',default=str(MASTER))
p.add_argument('--output',default=str(MASTER))
opt=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
source=Path(opt.input)
backup=ARCHIVE/'Before_Tailored_Sleeves_v4.blend'
if not backup.exists():backup.write_bytes(source.read_bytes())
bpy.ops.wm.open_mainfile(filepath=str(source))
visibility={c.name:c.hide_viewport for c in bpy.data.collections if c.name.startswith('FPS / ')}
for name in visibility:bpy.data.collections[name].hide_viewport=False

def invariant():
    data=[]
    for o in sorted(bpy.data.objects,key=lambda o:o.name):
        if o.type=='ARMATURE':data.append((o.name,[(b.name,tuple(b.head_local),tuple(b.tail_local),tuple(tuple(r) for r in b.matrix_local)) for b in o.data.bones if not b.name.endswith('ElbowCloth')]))
        if o.type=='MESH' and o.name.startswith('FPSGlove_'):data.append((o.name,[tuple(v.co) for v in o.data.vertices], [[(g.group,g.weight) for g in v.groups] for v in o.data.vertices]))
    data += [(a.name,[(c.data_path,c.array_index,[(tuple(k.co),tuple(k.handle_left),tuple(k.handle_right),k.interpolation) for k in c.keyframe_points]) for c in a.fcurves]) for a in bpy.data.actions]
    return hashlib.sha256(json.dumps(data).encode()).hexdigest()

before=invariant(); report={'inputSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sleeves':[]}
selected=opt.weapons.split(',')
view_panels=json.loads((ARCHIVE/'sleeve-view-panels.json').read_text())
def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
def gauss(x,w):return math.exp(-(x/w)**2)
def profile(t,knots):
    for (a,x),(b,y) in zip(knots,knots[1:]):
        if t<=b:return x+(y-x)*smooth((t-a)/(b-a))
    return knots[-1][1]

for obj in list(bpy.data.objects):
    if not obj.name.startswith('FPSSleeve_'):continue
    name,side=obj.name[len('FPSSleeve_'):].rsplit('_',1)
    if 'all' not in selected and name not in selected:continue
    if obj.get('tailored_sleeve_revision')==8:continue
    rig=bpy.data.objects['FPSBones_'+name];prefix='FPS_'+name+'_'+side+'_'
    seam_position=view_panels[name][side]['seamAngle']
    shoulder=rig.data.bones[prefix+'Upper'].head_local.copy()
    elbow=rig.data.bones[prefix+'Lower'].head_local.copy()
    wrist=rig.data.bones[prefix+'Hand'].head_local.copy()
    upper=(shoulder-elbow).normalized();lower=(wrist-elbow).normalized();span=(wrist-elbow).length
    # An elbow cloth pivot retains the ring volume when the live grip solver
    # changes the bend. Averaging Upper/Lower skin matrices collapses this
    # ring, even though both arm segment lengths remain correct.
    bpy.ops.object.select_all(action='DESELECT');rig.hide_set(False);rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.object.mode_set(mode='EDIT')
    helper=rig.data.edit_bones.get(prefix+'ElbowCloth') or rig.data.edit_bones.new(prefix+'ElbowCloth')
    helper.head=elbow;helper.tail=elbow+(lower-upper).normalized()*.07
    helper.parent=rig.data.edit_bones[prefix+'Upper'];helper.use_deform=True
    bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
    cloth=rig.pose.bones[prefix+'ElbowCloth'];cloth.lock_location=(True,True,True);cloth.lock_scale=(True,True,True)
    cloth['control']='Runtime bend averaging; rotate original Upper/Lower for authored arm motion.'
    # Preserve the original concealed garment reach used by the runtime.
    transform=rig.matrix_world.inverted()@obj.matrix_world
    reach=max((transform@v.co-elbow).dot(upper) for v in obj.data.vertices)
    far=elbow+upper*reach;trim=.080
    entry=elbow+upper*trim;exit=elbow+lower*trim
    length1=(entry-far).length;length2=trim*1.7;length3=(wrist-exit).length
    total=length1+length2+length3
    def centre(s):
        d=s*total
        if d<length1:return far.lerp(entry,d/length1)
        if d<length1+length2:
            t=(d-length1)/length2
            return entry*(1-t)**2+elbow*(2*t*(1-t))+exit*t*t
        return exit.lerp(wrist,(d-length1-length2)/length3)
    verts=[];faces=[];weights=[];colors=[];uvs=[];rows=129;segments=48
    normal=None;last_tangent=None
    for j in range(rows):
        s=j/(rows-1);c=centre(s)
        tangent=(centre(min(1,s+.001))-centre(max(0,s-.001))).normalized()
        if normal is None:
            normal=rig.data.bones[prefix+'Hand'].matrix_local.to_3x3()@Vector((1,0,0))
            normal=(normal-tangent*normal.dot(tangent)).normalized()
        else:normal=last_tangent.rotation_difference(tangent)@normal
        normal=(normal-tangent*normal.dot(tangent)).normalized();cross=tangent.cross(normal).normalized();last_tangent=tangent.copy()
        d=s*total;fore=(d-length1-length2)/length3
        bend=(d-length1)/length2
        if d<length1:
            along=(c-elbow).dot(upper)
            # Upper arm has a real biceps volume, narrowing into the elbow.
            radius=profile(along,[(0,.108),(.08,.108),(.24,.133),(.43,.148),(.67,.139),(reach,.120)])
        elif d<length1+length2:radius=.108+.003*math.sin(math.pi*bend)**2
        else:
            # Forearm peaks below the elbow then tapers into a fitted cuff.
            radius=profile(fore,[(0,.108),(.22,.119),(.50,.104),(.78,.083),(1,.074)])
        cuff=smooth((fore-.84)/.045) if fore>0 else 0
        for k in range(segments):
            angle=math.tau*k/segments
            # The inside bend compresses; the outside stretches. Keep folds
            # local and oblique rather than making a stack of uniform rings.
            turn=(lower+upper)
            turn=turn-tangent*turn.dot(tangent)
            inside_angle=math.atan2(turn.dot(cross),turn.dot(normal)) if turn.length>1e-5 else 0
            inside=max(0,math.cos(angle-inside_angle))**4
            fold=0
            for at,amplitude in [(.16,.009),(.34,.006)]:
                location=length1+length2*.45+length3*at
                shifted=d-location+.015*math.sin(angle)
                fold += amplitude*(gauss(shifted,.028)-.55*gauss(shifted-.031,.017))*inside
            cuff_hem=.003*gauss(fore-.88,.016) if fore>0 else 0
            seam_angle=math.atan2(math.sin(angle-seam_position),math.cos(angle-seam_position))
            # A lapped longitudinal seam separates the broad fabric panels.
            # Cloth planes and broad oblique tension folds carry the form at
            # gameplay scale; fine grain is not a substitute for silhouette.
            lap=smooth((seam_angle+.36)/.10)*(1-smooth((seam_angle+.02)/.045))
            lap *= 1-smooth((fore-.83)/.06) if fore>0 else 1
            seam=.0065*lap-.0015*gauss(seam_angle-.04,.035)
            upper_distance=max(0,(c-elbow).dot(upper))
            upper_mask=gauss(upper_distance-.43,.32) if d<length1 else 0
            tension=.011*upper_mask*(gauss(math.atan2(math.sin(angle-.45-upper_distance*.8),math.cos(angle-.45-upper_distance*.8)),.28)-.7*gauss(math.atan2(math.sin(angle-.78-upper_distance*.8),math.cos(angle-.78-upper_distance*.8)),.16))
            fore_mask=smooth(fore/.18)*(1-smooth((fore-.74)/.18)) if fore>0 else 0
            tension += .007*fore_mask*math.sin(angle*2+fore*2.0)*max(0,math.cos(angle+.4))
            radial=radius+fold+cuff_hem+seam+tension
            cloth_planes=.78+.20*(1-upper_mask)*(1-fore_mask)
            ca,sa=math.cos(angle),math.sin(angle)
            point=c+normal*(radial*math.copysign(abs(ca)**cloth_planes,ca))+cross*(radial*.89*math.copysign(abs(sa)**cloth_planes,sa))
            verts.append(tuple(transform.inverted()@point))
            uvs.append((k/segments,j/(rows-1)))
            joint_distance=d-(length1+length2*.5)
            cloth_weight=1-smooth((abs(joint_distance)-.04)/.13)
            upper_weight=(1-cloth_weight) if joint_distance<0 else 0
            lower_weight=(1-cloth_weight) if joint_distance>=0 else 0
            weights.append((upper_weight,lower_weight,cloth_weight))
            # Worn canvas and a narrow, denser wrist facing, not a painted
            # distance-to-wrist gradient that erases the cuff construction.
            panel=.74 if seam_angle<0 and seam_angle>-.95 else 1
            seam_highlight=1+.22*gauss(seam_angle,.10)-.20*gauss(seam_angle-.12,.06)
            base=(.091,.137,.149) if cuff<.5 else (.039,.051,.054)
            wear=1+.025*math.sin(d*47)*math.cos(angle*3)
            colors.append(tuple(v*panel*wear*seam_highlight for v in base))
            if j<rows-1:faces.append((j*segments+k,j*segments+(k+1)%segments,(j+1)*segments+(k+1)%segments,(j+1)*segments+k))
    faces += [tuple(reversed(range(segments))),tuple((rows-1)*segments+k for k in range(segments))]
    # Two subdued rows of actual topstitches on the lap. They share the
    # garment draw and interpolated skin weights, including the elbow pivot.
    # This gives a sewn panel relationship rather than a decorative groove.
    def surface(row,angle):
        k=(angle%math.tau)/math.tau*segments;a=int(k);f=k-a
        return Vector(verts[row*segments+a]).lerp(Vector(verts[row*segments+(a+1)%segments]),f)
    for row in range(2,rows-3,2):
        fore=(row/(rows-1)*total-length1-length2)/length3
        if fore>.84:continue
        for angle in [seam_position-.11,seam_position-.20]:
            start=surface(row,angle);end=surface(row+1,angle)
            tangent=(end-start).normalized();across=(surface(row,angle+.03)-surface(row,angle-.03)).normalized()
            outward=tangent.cross(across).normalized()
            # Orient away from the sleeve axis, not through the cloth.
            radial=transform.inverted()@centre(row/(rows-1))
            if outward.dot(start-radial)<0:outward.negate()
            start+=outward*.001;end+=outward*.001
            offset=len(verts)
            for j,point in enumerate([start,end]):
                for k in range(8):
                    phi=math.tau*k/8
                    verts.append(tuple(point+across*(.0009*math.cos(phi))+outward*(.0009*math.sin(phi))))
                    weights.append(weights[(row+j)*segments])
                    colors.append((.181,.155,.106));uvs.append(((angle%math.tau)/math.tau,(row+j)/(rows-1)))
            for k in range(8):faces.append((offset+k,offset+(k+1)%8,offset+8+(k+1)%8,offset+8+k))
            faces += [tuple(offset+k for k in reversed(range(8))),tuple(offset+8+k for k in range(8))]
    mesh=bpy.data.meshes.new(obj.name+'_Tailored_v4');mesh.from_pydata(verts,[],faces);mesh.update()
    for mat in obj.data.materials:mesh.materials.append(mat)
    old_vertices=len(obj.data.vertices);obj.data=mesh
    obj.vertex_groups.clear();groups=[obj.vertex_groups.new(name=prefix+n) for n in ['Upper','Lower','ElbowCloth']]
    for i,influences in enumerate(weights):
        for group,w in zip(groups,influences):
            if w>0:group.add([i],w,'REPLACE')
    layer=mesh.vertex_colors.new(name='AuthoredSurface')
    uv=mesh.uv_layers.new(name='Sleeve pattern')
    # Adding UV CustomData can invalidate the previous color-layer RNA view
    # in Blender 2.93. Reacquire it before assigning the stored palette.
    layer=mesh.vertex_colors['AuthoredSurface'];uv=mesh.uv_layers['Sleeve pattern']
    for loop in mesh.loops:
        i=loop.vertex_index;layer.data[loop.index].color=(*colors[i],1)
        uv.data[loop.index].uv=uvs[i]
    for face in mesh.polygons:face.use_smooth=len(face.vertices)==4
    obj['tailored_sleeve_revision']=8
    obj['garment_construction']='Articulated canvas planes, bend-aligned compression, lapped longitudinal seam and fitted wrist facing. Existing Upper/Lower plus volume-preserving ElbowCloth; original concealed reach.'
    report['sleeves'].append({'name':obj.name,'oldVertices':old_vertices,'vertices':len(verts),'hiddenReach':reach})
    print('TAILORED_SLEEVE',obj.name,flush=True)

assert invariant()==before,'Gloves, weights, bind bones or Actions changed'
report['protectedGlovesBindActionsSha256']=before
for name,hidden in visibility.items():bpy.data.collections[name].hide_viewport=hidden
bpy.ops.wm.save_as_mainfile(filepath=opt.output)
report['outputSha256']=hashlib.sha256(Path(opt.output).read_bytes()).hexdigest()
(ROOT/'output/fps-sleeve-v4').mkdir(parents=True,exist_ok=True)
(ROOT/'output/fps-sleeve-v4/source-report.json').write_text(json.dumps(report,indent=2))
print('TAILORED_SLEEVE_PASS',len(report['sleeves']),flush=True)
