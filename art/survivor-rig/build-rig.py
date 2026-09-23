"""Run inside the explicitly identified The Last Dead Blender project."""
import bpy, json, math, traceback
from pathlib import Path
from mathutils import Vector, Matrix

BASE = Path('C:/Users/wolfk/Desktop/thelastdead/art/survivor-rig')
assert Path(bpy.data.filepath).resolve() == (BASE/'The_Last_Dead_Survivor_Rig_v01.blend').resolve()
assert bpy.context.scene.get('project') == 'The Last Dead'
assert 'TLD_Survivor' not in bpy.data.objects, 'Rig already exists; refusing to duplicate'
source = json.loads((BASE/'survivor-source.json').read_text())
scene = bpy.context.scene

def collection(name):
    c=bpy.data.collections.new(name);scene.collection.children.link(c);return c

body_collection=collection('01 | Survivor • skinned export meshes')
rig_collection=collection('02 | Animation rig • select in Pose Mode')
view_collection=collection('03 | Cameras and grip guides')
shape_collection=collection('04 | Control shapes (hidden)')
shape_collection.hide_render=True
def cv(p): return Vector((p[0],-p[2],p[1]))
land={k:cv(v) for k,v in source['landmarks'].items()}
materials=[]
for i,m in enumerate(source['materials']):
    mat=bpy.data.materials.new('TLD_%02d_%s'%(i,m['name']))
    mat.use_nodes=True;mat.diffuse_color=(*m['color'],1)
    bs=mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*m['color'],1)
    bs.inputs['Roughness'].default_value=m['roughness']
    bs.inputs['Metallic'].default_value=m['metalness']
    mat.use_backface_culling=not m['doubleSide']
    for key,socket in [('map','Base Color'),('rough','Roughness')]:
        if not m.get(key):continue
        im=bpy.data.images.load(str(BASE/m[key]),check_existing=True)
        if key!='map':im.colorspace_settings.name='Non-Color'
        im.pack()
        tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im
        mat.node_tree.links.new(tex.outputs['Color'],bs.inputs[socket])
    if m.get('bump'):
        # Convert the existing height texture to a tangent-space normal map.
        import numpy as np
        im=bpy.data.images.load(str(BASE/m['bump']),check_existing=True)
        im.colorspace_settings.name='Non-Color'
        w,h=im.size;raw=np.array(im.pixels[:],dtype=np.float32).reshape(h,w,4)[:,:,0]
        dx=(np.roll(raw,-1,axis=1)-np.roll(raw,1,axis=1))*.7
        dy=(np.roll(raw,-1,axis=0)-np.roll(raw,1,axis=0))*.7
        n=np.stack((-dx,-dy,np.ones_like(dx)),axis=2);n/=np.linalg.norm(n,axis=2,keepdims=True)
        rgba=np.ones((h,w,4),dtype=np.float32);rgba[:,:,:3]=n*.5+.5
        normal=bpy.data.images.new('TLD_Normal_%02d'%i,width=w,height=h)
        normal.colorspace_settings.name='Non-Color';normal.pixels.foreach_set(rgba.ravel())
        normal.filepath_raw=str(BASE/'textures'/('m%d-normal.png'%i));normal.file_format='PNG';normal.save();normal.pack()
        tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=normal
        nm=mat.node_tree.nodes.new('ShaderNodeNormalMap')
        mat.node_tree.links.new(tex.outputs['Color'],nm.inputs['Color']);mat.node_tree.links.new(nm.outputs['Normal'],bs.inputs['Normal'])
    materials.append(mat)

arm=bpy.data.armatures.new('TLD_Humanoid_Skeleton')
rig=bpy.data.objects.new('TLD_Survivor',arm);rig_collection.objects.link(rig)
rig.show_in_front=True;arm.display_type='OCTAHEDRAL'
for o in bpy.context.selected_objects:o.select_set(False)
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
def bone(name,head,tail,parent=None,deform=True,connect=False):
    b=arm.edit_bones.new(name);b.head=head;b.tail=tail;b.use_deform=deform
    if parent:b.parent=arm.edit_bones[parent];b.use_connect=connect
    b.layers=[i==(0 if name.startswith('CTRL') else 1) for i in range(32)]
    return b
bone('root',(0,0,0),(0,0,.2))
bone('pelvis',land['hips'],(0,0,1.05),'root')
bone('spine',(0,0,1.05),(0,0,1.22),'pelvis',connect=True)
bone('chest',(0,0,1.22),(0,0,1.40),'spine',connect=True)
bone('neck',(0,0,1.40),(0,0,1.51),'chest',connect=True)
bone('head',(0,0,1.51),(0,0,1.715),'neck',connect=True)
finger_sources={}
for s in ['L','R']:
    side=-1 if s=='L' else 1
    bone('clavicle.'+s,(side*.04,0,1.36),land['shoulder.'+s],'chest')
    bone('upper_arm.'+s,land['shoulder.'+s],land['elbow.'+s],'clavicle.'+s,connect=True)
    bone('forearm.'+s,land['elbow.'+s],land['wrist.'+s],'upper_arm.'+s,connect=True)
    bone('hand.'+s,land['wrist.'+s],land['palm.'+s],'forearm.'+s,connect=True)
    # A slight rest bend establishes the forward knee plane for stable IK.
    knee=land['knee.'+s]+Vector((0,.022,0))
    bone('thigh.'+s,land['hip.'+s],knee,'pelvis')
    bone('shin.'+s,knee,land['ankle.'+s],'thigh.'+s,connect=True)
    bone('foot.'+s,land['ankle.'+s],land['toe.'+s],'shin.'+s,connect=True)
    bone('toe.'+s,land['toe.'+s],land['toe.'+s]+Vector((0,.055,0)),'foot.'+s,connect=True)
    fi=0
    for mi,mesh in enumerate(source['meshes']):
        if mesh['region']!='arm.'+s or mesh['name'] not in ['Finger','Thumb']:continue
        finger=['index','middle','ring','pinky'][fi] if mesh['name']=='Finger' else 'thumb'
        if mesh['name']=='Finger':fi+=1
        ma=Matrix([mesh['matrix'][j::4] for j in range(4)])
        # Source fingers are ellipsoids along local Y; their three joints share that axis.
        points=[cv(ma@Vector((0,t,0))) for t in [.86,.26,-.40,-.94]]
        chain=[]
        for n in range(3):
            name='%s_%02d.%s'%(finger,n+1,s)
            bone(name,points[n],points[n+1],'hand.'+s if n==0 else chain[-1],connect=n>0);chain.append(name)
        finger_sources[mi]=(chain,points)
    # Controls are independent of pelvis so planted feet survive crouching.
    hand=bone('CTRL_hand.'+s,land['wrist.'+s],land['palm.'+s],'root',False)
    foot=bone('CTRL_foot.'+s,land['ankle.'+s],land['toe.'+s],'root',False)
    elbow=land['elbow.'+s]+Vector((side*.28,-.30,.02))
    knee_pole=knee+Vector((0,.55,0))
    bone('CTRL_elbow.'+s,elbow,elbow+Vector((0,0,.08)),'root',False)
    bone('CTRL_knee.'+s,knee_pole,knee_pole+Vector((0,0,.10)),'root',False)
bone('weapon_socket',( .16,.50,1.27),(.16,.72,1.27),'hand.R')
bone('camera_socket',(0,.12,1.60),(0,.24,1.60),'root')
bpy.ops.object.mode_set(mode='OBJECT')
arm.layers=[i in [0,1] for i in range(32)]

def smooth(x): x=max(0,min(1,x));return x*x*(3-2*x)
def blend(a,b,t):return {a:1-t,b:t}
def project(p,a,b):return (p-a).dot(b-a)/(b-a).length_squared
def weights(mesh,mi,p):
    region=mesh['region'];name=mesh['name'];z=p.z
    if mi in finger_sources:
        chain,pts=finger_sources[mi];t=project(p,pts[0],pts[-1])*3
        if t<.65:return {chain[0]:1}
        if t<1.35:return blend(chain[0],chain[1],smooth((t-.65)/.7))
        if t<1.65:return {chain[1]:1}
        return blend(chain[1],chain[2],smooth((t-1.65)/.7))
    if region=='head':return blend('neck','head',smooth((z-1.46)/.08)) if name=='Neck' else {'head':1}
    if region=='torso':
        if name in ['CargoHip','LeatherBelt','BeltBuckle','BuckleInset','UtilityBeltPouch']:return {'pelvis':1}
        if z<1.12:return blend('pelvis','spine',smooth((z-.98)/.14))
        return blend('spine','chest',smooth((z-1.15)/.17))
    s=region[-1]
    if region.startswith('leg'):
        if name.startswith(('Boot','Sole')):return {'foot.'+s:1}
        if z<.26:return blend('foot.'+s,'shin.'+s,smooth((z-.16)/.10))
        if z<.58:return blend('shin.'+s,'thigh.'+s,smooth((z-.43)/.14))
        return blend('thigh.'+s,'pelvis',smooth((z-.84)/.09))
    if region.startswith('arm'):
        if name in ['FingerlessGlove','Knuckle']:return {'hand.'+s:1}
        t=project(p,land['elbow.'+s],land['wrist.'+s])
        if name=='JacketShoulder':return blend('clavicle.'+s,'upper_arm.'+s,.7)
        if t>.70:return blend('forearm.'+s,'hand.'+s,smooth((t-.78)/.28))
        if t<.25:return blend('upper_arm.'+s,'forearm.'+s,smooth((t+.15)/.4))
        return {'forearm.'+s:1}
    raise ValueError(region)

# One skinned object per visibility region; accessories share its skin and UVs.
buckets={}
for mi,mesh in enumerate(source['meshes']):
    bucket=buckets.setdefault(mesh['region'],{'verts':[],'faces':[],'uv':[],'mat':[],'weights':[]})
    offset=len(bucket['verts']);pos=mesh['position'];verts=[cv(pos[i:i+3]) for i in range(0,len(pos),3)]
    bucket['verts'].extend(verts);bucket['weights'].extend(weights(mesh,mi,p) for p in verts)
    bucket['uv'].extend([mesh['uv'][i:i+2] for i in range(0,len(mesh['uv']),2)])
    for i in range(0,len(mesh['indices']),3):
        bucket['faces'].append(tuple(v+offset for v in mesh['indices'][i:i+3]));bucket['mat'].append(mesh['material'])
meshes=[]
for region,bucket in buckets.items():
    data=bpy.data.meshes.new('TLD_'+region);data.from_pydata(bucket['verts'],[],bucket['faces']);data.update()
    obj=bpy.data.objects.new('TLD_'+region,data);body_collection.objects.link(obj)
    obj.parent=rig;obj['visibility_region']=region;obj['hide_in_first_person']=region=='head'
    for m in materials:data.materials.append(m)
    uv=data.uv_layers.new(name='UVMap')
    for p in data.polygons:
        p.material_index=bucket['mat'][p.index];p.use_smooth=True
        for li in p.loop_indices:uv.data[li].uv=bucket['uv'][data.loops[li].vertex_index]
    groups={name:obj.vertex_groups.new(name=name) for name in arm.bones.keys() if arm.bones[name].use_deform}
    for i,ww in enumerate(bucket['weights']):
        ww={k:v for k,v in ww.items() if v>1e-6};total=sum(ww.values())
        assert total>0
        for name,w in ww.items():groups[name].add([i],w/total,'REPLACE')
    mod=obj.modifiers.new('Skin • normalized deformation weights','ARMATURE');mod.object=rig
    # Merge only coincident vertices in a region, preserving material and UV seams.
    meshes.append(obj)

rig['arms_IK']=1.0;rig['legs_IK']=1.0
rig['instructions']='Pose Mode: move CTRL_hand / CTRL_foot; poles set elbow/knee direction. Rotate pelvis, spine, chest and finger bones. IK properties blend 0=FK, 1=IK.'
rig['coordinate_contract']='Blender Z-up, forward +Y, metres. glTF Y-up, forward -Z.'
for prop in ['arms_IK','legs_IK']:
    rig['_RNA_UI']={**rig.get('_RNA_UI',{}),prop:{'min':0.0,'max':1.0,'soft_min':0.0,'soft_max':1.0}}
for pb in rig.pose.bones:pb.rotation_mode='XYZ'
for s in ['L','R']:
    for limb,control,pole,prop in [('forearm','hand','elbow','arms_IK'),('shin','foot','knee','legs_IK')]:
        pb=rig.pose.bones[limb+'.'+s];ik=pb.constraints.new('IK');ik.name='Two-bone %s IK'%control
        ik.target=rig;ik.subtarget='CTRL_'+control+'.'+s;ik.pole_target=rig;ik.pole_subtarget='CTRL_'+pole+'.'+s
        ik.chain_count=2;ik.use_stretch=False
        # Calibrate pole angle to minimize the deviation from the authored rest joint.
        target=arm.bones[limb+'.'+s].head_local.copy();best=(1e9,0)
        for n in range(72):
            angle=-math.pi+n*math.tau/72;ik.pole_angle=angle;bpy.context.view_layer.update()
            dist=(pb.head-target).length_squared
            if dist<best[0]:best=(dist,angle)
        ik.pole_angle=best[1]
        drv=ik.driver_add('influence').driver;drv.type='SCRIPTED';v=drv.variables.new();v.name='blend';v.targets[0].id=rig;v.targets[0].data_path='["%s"]'%prop;drv.expression='blend'
        rot=rig.pose.bones[control+'.'+s].constraints.new('COPY_ROTATION');rot.target=rig;rot.subtarget='CTRL_'+control+'.'+s
        drv=rot.driver_add('influence').driver;v=drv.variables.new();v.name='blend';v.targets[0].id=rig;v.targets[0].data_path='["%s"]'%prop;drv.expression='blend'

def shape(name,points,edges):
    me=bpy.data.meshes.new(name);me.from_pydata(points,edges,[])
    ob=bpy.data.objects.new(name,me);shape_collection.objects.link(ob);ob.hide_render=True;ob.hide_set(True);return ob
ring=shape('WGT_Ring',[(math.cos(i*math.tau/32),0,math.sin(i*math.tau/32)) for i in range(32)],[(i,(i+1)%32) for i in range(32)])
diamond=shape('WGT_Pole',[(1,0,0),(0,0,1),(-1,0,0),(0,0,-1)],[(0,1),(1,2),(2,3),(3,0)])
for pb in rig.pose.bones:
    if pb.name.startswith('CTRL'):
        pb.custom_shape=diamond if any(k in pb.name for k in ['elbow','knee']) else ring
        pb.use_custom_shape_bone_size=False;pb.custom_shape_scale=.065 if 'hand' in pb.name else .09
    color='THEME04' if pb.name.endswith('.L') else 'THEME03' if pb.name.endswith('.R') else 'THEME09'
    group=rig.pose.bone_groups.get(color) or rig.pose.bone_groups.new(name=color);group.color_set=color;pb.bone_group=group

def camera(name,position,target):
    data=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,data);view_collection.objects.link(ob)
    ob.location=position;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler();data.lens=24;data.clip_start=.02
    return ob
cam=camera('VIEW_First_Person',(0,.12,1.60),(0,2.0,1.51));cam.data.lens=20
look=camera('VIEW_Look_Down',(0,.12,1.60),(0,.26,.1));look.data.lens=18
overview=camera('VIEW_Rig_Overview',(2.2,3.4,1.9),(0,0,.90));overview.data.lens=48
scene.camera=overview
rig['first_person_camera_height']=1.6
rig['first_person_body_offset']=.38

# Editable control actions. glTF export separately bakes evaluated deform transforms.
scene.render.fps=30
def control_position(name,position):
    pb=rig.pose.bones[name];rest=arm.bones[name].matrix_local
    pb.location=rest.to_3x3().inverted()@(Vector(position)-rest.translation)
def neutral():
    for pb in rig.pose.bones:pb.location=(0,0,0);pb.rotation_euler=(0,0,0);pb.scale=(1,1,1)
def ready():
    control_position('CTRL_hand.R',(.20,.40,1.20))
    control_position('CTRL_hand.L',(-.15,.48,1.19))
    for s in ['L','R']:
        # Hand points down the weapon's grip; a moderate wrist bend avoids a locked wrist.
        rig.pose.bones['CTRL_hand.'+s].rotation_euler.x=-math.radians(35)
        for f in ['index','middle','ring','pinky','thumb']:
            for n in range(1,4):rig.pose.bones['%s_%02d.%s'%(f,n,s)].rotation_euler.x=math.radians(20 if f=='index' else 32)

clips=[('Idle_Ready',60),('Walk_Forward',30),('Sprint_Forward',24),('Crouch_Idle',60),('Jump',36),('Slide',45),('Recoil',12)]
for name,end in clips:
    action=bpy.data.actions.new(name);action.use_fake_user=True;rig.animation_data_create();rig.animation_data.action=action
    for f in range(1,end+1):
        t=(f-1)/(end-1);phase=t*math.tau;neutral();ready()
        if name in ['Idle_Ready','Crouch_Idle']:
            rig.pose.bones['chest'].rotation_euler.x=.009*math.sin(phase)
        if name=='Crouch_Idle':
            rig.pose.bones['pelvis'].location.y=-.27;rig.pose.bones['spine'].rotation_euler.x=.12
            for s,x in [('R',.20),('L',-.15)]:control_position('CTRL_hand.'+s,(x,.40 if s=='R' else .48,.95))
        if name in ['Walk_Forward','Sprint_Forward']:
            sprint=name=='Sprint_Forward';stride=.25 if sprint else .16;lift=.12 if sprint else .065
            rig.pose.bones['pelvis'].location.y=.012*math.sin(phase*2)-(.05 if sprint else .012)
            for i,s in enumerate(['L','R']):
                a=phase+i*math.pi;p=land['ankle.'+s].copy();p.y+=stride*math.cos(a);p.z+=lift*max(0,math.sin(a));control_position('CTRL_foot.'+s,p)
            rig.pose.bones['spine'].rotation_euler.x=.10 if sprint else .035
            rig.pose.bones['chest'].rotation_euler.z=.025*math.sin(phase)
        if name=='Jump':
            amount=math.sin(math.pi*t);rig.pose.bones['pelvis'].location.y=-.08*amount
            for s in ['L','R']:
                p=land['ankle.'+s].copy();p.z+=.18*amount;p.y-=.14*amount;control_position('CTRL_foot.'+s,p)
        if name=='Slide':
            a=smooth(min(t/.2,(1-t)/.2));rig.pose.bones['pelvis'].location.y=-.43*a
            rig.pose.bones['pelvis'].rotation_euler.x=-.30*a
            for s in ['L','R']:
                p=land['ankle.'+s].copy();p.y+=.47*a;p.x*=1+.30*a;control_position('CTRL_foot.'+s,p)
            for s,x in [('R',.20),('L',-.15)]:control_position('CTRL_hand.'+s,(x,.40 if s=='R' else .48,1.20-.43*a))
        if name=='Recoil':
            kick=math.sin(min(1,t/.2)*math.pi/2)*math.exp(-t*6)
            for s,x in [('R',.20),('L',-.15)]:control_position('CTRL_hand.'+s,(x,(.40 if s=='R' else .48)-.045*kick,1.20+.022*kick))
        for pb in rig.pose.bones:
            pb.keyframe_insert('location',frame=f,group=pb.name);pb.keyframe_insert('rotation_euler',frame=f,group=pb.name)
    for fc in action.fcurves:
        for kp in fc.keyframe_points:kp.interpolation='LINEAR'

rig.animation_data.action=bpy.data.actions['Idle_Ready'];scene.frame_start=1;scene.frame_end=60;scene.frame_set(1)
for action in bpy.data.actions:
    if action.name in [x[0] for x in clips]:action['purpose']='Editable authoring controls; export script bakes the final skeleton'
text=bpy.data.texts.new('START HERE — The Last Dead Rig')
text.write('THE LAST DEAD — FIRST PERSON SURVIVOR RIG\n\nSelect TLD_Survivor and enter Pose Mode.\nMove CTRL_hand.L/R and CTRL_foot.L/R. Pole controls direct elbows/knees.\nRotate pelvis, spine, chest, neck, head and the three joints of each finger.\nObject custom properties arms_IK and legs_IK blend between IK and FK.\nActions: Idle_Ready, Walk_Forward, Sprint_Forward, Crouch_Idle, Jump, Slide, Recoil.\n\nBody is divided into torso, two legs, two arms and head for runtime visibility.\nHide TLD_head in first person. Cameras are stable guides, not head-bob drivers.\nMetres; Blender Z-up/+Y forward; glTF Y-up/-Z forward.\n\nSource art is the existing procedural survivor, not a newly sculpted character.\nThe first-person game adapter still needs animation blending and weapon-specific grips.\n')
scene.render.engine='BLENDER_EEVEE';scene.world.color=(.18,.18,.18)
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_location=(0,0,.9);area.spaces.active.region_3d.view_distance=2.8
        area.spaces.active.region_3d.view_rotation=(Vector((2,3,1.2))).to_track_quat('Z','Y')
        area.spaces.active.shading.type='MATERIAL'
scene['rig_build']='v01 • skinned survivor / editable IK / finger chains'
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
report={'file':bpy.data.filepath,'bones':len(arm.bones),'deform_bones':sum(b.use_deform for b in arm.bones),'meshes':len(meshes),'vertices':sum(len(o.data.vertices) for o in meshes),'triangles':sum(len(o.data.polygons) for o in meshes),'clips':clips,'weights_normalized':True}
(BASE/'build-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))

