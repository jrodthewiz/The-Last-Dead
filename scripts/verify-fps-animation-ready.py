"""Headless Blender source validation and reversible animator setup.

--prepare saves bone groups and locked unused channels in the existing master.
Never rebuilds meshes, weights, bind transforms, or Actions. --render produces
clay closeups of the actual skinned hands at sampled attack poses.
"""
import argparse, hashlib, json, math, sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / '.art-source/viewmodel-arms-v3/The_Last_Dead_Animated_FPS_Arms_v3.blend'
p = argparse.ArgumentParser()
p.add_argument('--prepare', action='store_true')
p.add_argument('--render', action='store_true')
p.add_argument('--output', default=str(ROOT / 'output/fps-animation-readiness'))
opt = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
out = Path(opt.output); out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(MASTER))
scene = bpy.context.scene
report = {'blender': bpy.app.version_string, 'source': str(MASTER.relative_to(ROOT)),
          'sourceBeforeSha256': hashlib.sha256(MASTER.read_bytes()).hexdigest(),
          'rigs': [], 'errors': [], 'renders': []}

def require(condition, message):
    if not condition: report['errors'].append(message)

def geometry_signature():
    data = []
    for obj in sorted(bpy.data.objects, key=lambda o:o.name):
        if obj.type == 'MESH' and obj.name.startswith(('FPSGlove_', 'FPSSleeve_')):
            data.append((obj.name, [tuple(v.co) for v in obj.data.vertices],
                         [[(g.group,g.weight) for g in v.groups] for v in obj.data.vertices]))
        if obj.type == 'ARMATURE':
            data.append((obj.name, [(b.name,tuple(b.matrix_local[0]),tuple(b.matrix_local[1]),
                        tuple(b.matrix_local[2]),tuple(b.matrix_local[3]),b.parent.name if b.parent else None) for b in obj.data.bones]))
    data += [(a.name,[(c.data_path,c.array_index,[(tuple(k.co),tuple(k.handle_left),tuple(k.handle_right),k.interpolation) for k in c.keyframe_points]) for c in a.fcurves]) for a in bpy.data.actions]
    return hashlib.sha256(json.dumps(data).encode()).hexdigest()

before = geometry_signature()
rigs = sorted((o for o in bpy.data.objects if o.type == 'ARMATURE' and o.name.startswith('FPSBones_')), key=lambda o:o.name)
require(len(rigs)==8, 'Expected eight equipment armatures')
visibility = {c.name:(c.hide_viewport,c.hide_render) for c in bpy.data.collections if c.name.startswith('FPS / ')}
for name in visibility:
    bpy.data.collections[name].hide_viewport=False; bpy.data.collections[name].hide_render=False
saved = {}
for rig in rigs:
    name = rig.name.removeprefix('FPSBones_') if hasattr(str,'removeprefix') else rig.name[len('FPSBones_'):]
    anim = rig.animation_data
    saved[rig.name] = (anim.action, [(t,t.mute) for t in anim.nla_tracks])
    for t in anim.nla_tracks: t.mute=True
    meshes = [o for o in bpy.data.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)]
    sides = sorted({o.name.rsplit('_',1)[-1] for o in meshes})
    row = {'weapon':name, 'bones':len(rig.data.bones), 'sides':sides, 'meshes':[], 'actions':[]}
    for side in sides:
        prefix='FPS_'+name+'_'+side+'_'
        hierarchy=[('Lower','Upper'),('Hand','Lower')]
        for digit in ['Thumb','Index','Middle','Ring','Little']:
            hierarchy += [(digit+'0','Hand'),(digit+'1',digit+'0'),(digit+'2',digit+'1')]
        for child,parent in hierarchy:
            b=rig.data.bones.get(prefix+child)
            require(b is not None and b.parent is not None and b.parent.name==prefix+parent, name+'/'+side+': broken '+child+' hierarchy')
        if opt.prepare:
            for label,color in [('Arm','THEME03'),('Hand','THEME04'),('Fingers','THEME02')]:
                group=rig.pose.bone_groups.get(side+' / '+label) or rig.pose.bone_groups.new(name=side+' / '+label)
                group.color_set=color
                for b in rig.pose.bones:
                    if not b.name.startswith(prefix): continue
                    suffix=b.name[len(prefix):]
                    kind='Arm' if suffix in ['Upper','Lower'] else 'Hand' if suffix=='Hand' else 'Fingers'
                    if kind==label:
                        b.bone_group=group
                        # These Actions use joint rotation. Translation or scale
                        # breaks anatomical lengths and live grip correction.
                        b.lock_location=(True,True,True); b.lock_scale=(True,True,True)
            rig.show_in_front=True; rig.data.display_type='STICK'
            rig['animation_contract']='Rotate colored arm/hand/finger FK bones. Runtime seats hands to weapon sockets. Keep translations/scales locked; outer weapon anchor owns recoil/aim.'
    for obj in meshes:
        bad=0; max_influences=0
        for v in obj.data.vertices:
            weights=[g.weight for g in v.groups if obj.vertex_groups[g.group].name in rig.data.bones and g.weight>1e-7]
            max_influences=max(max_influences,len(weights))
            if not weights or any(not math.isfinite(w) or w<0 for w in weights) or abs(sum(weights)-1)>1e-4: bad+=1
            if not all(math.isfinite(x) for x in v.co): bad+=1
        require(bad==0, obj.name+': invalid/unweighted vertices '+str(bad))
        require(max_influences<=4,obj.name+': exceeds four skin influences')
        row['meshes'].append({'name':obj.name,'vertices':len(obj.data.vertices),'invalidVertices':bad,'maxInfluences':max_influences})
    phases=['idle','walk','draw','strike' if name in ['bat','chainsaw'] else 'fire']
    for phase in phases:
        actions=[a for a in bpy.data.actions if a.name.endswith(name+'/'+phase)]
        require(len(actions)==1,name+'/'+phase+': expected exactly one Action')
        if len(actions)!=1: continue
        action=actions[0]; anim.action=action
        lo,hi=action.frame_range
        require(hi>lo,name+'/'+phase+': zero duration')
        require(all(c.data_path.startswith('pose.bones[') for c in action.fcurves),action.name+': unexpected object transform track')
        baseline={}; motion=0; finite=True; endpoints=[]
        for step in range(17):
            frame=lo+(hi-lo)*step/16
            scene.frame_set(int(frame),subframe=frame-int(frame)); bpy.context.view_layer.update()
            deps=bpy.context.evaluated_depsgraph_get()
            sample=[]
            for obj in meshes:
                evaluated=obj.evaluated_get(deps); mesh=evaluated.to_mesh()
                coords=np.empty(len(mesh.vertices)*3,dtype=np.float32)
                mesh.vertices.foreach_get('co',coords); coords=coords.reshape((-1,3))
                finite=finite and bool(np.isfinite(coords).all())
                if step==0: baseline[obj.name]=coords
                elif len(coords)==len(baseline[obj.name]):
                    motion=max(motion,float(np.linalg.norm(coords-baseline[obj.name],axis=1).max()))
                sample.append(coords); evaluated.to_mesh_clear()
            if step in [0,16]: endpoints.append(np.concatenate(sample))
        loop_gap=float(np.linalg.norm(endpoints[0]-endpoints[1],axis=1).max())
        require(finite,action.name+': nonfinite deformation')
        require(motion>1e-5,action.name+': no actual skin deformation')
        if phase in ['idle','walk']: require(loop_gap<1e-5,action.name+': discontinuous loop')
        row['actions'].append({'phase':phase,'frames':[lo,hi],'sampledPoses':17,'maxSkinTravel':motion,'endpointGap':loop_gap,'finite':finite})
    anim.action=saved[rig.name][0]
    for track,mute in saved[rig.name][1]: track.mute=mute
    report['rigs'].append(row)
    print('Checked',name,len(row['actions']),'Actions',flush=True)

for name,(v,r) in visibility.items():
    bpy.data.collections[name].hide_viewport=v; bpy.data.collections[name].hide_render=r
scene.frame_set(1)
require(geometry_signature()==before,'Preparation altered geometry, weights, bind transforms or Actions')
report['preservedGeometryWeightsBindActionsSha256']=before
if opt.prepare and not report['errors']:
    scene['fps_animation_readiness']='Validated normalized four-influence skin, complete finger hierarchies and 17 deformed samples per Action. See output/fps-animation-readiness/report.json.'
    bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
report['sourceSha256']=hashlib.sha256(MASTER.read_bytes()).hexdigest()
report['status']='PASS' if not report['errors'] else 'FAIL'
(out/'report.json').write_text(json.dumps(report,indent=2))

if opt.render and not report['errors']:
    # Diagnostic closeups isolate each actual glove; no mesh reconstruction.
    scene.render.engine='BLENDER_EEVEE'; scene.eevee.taa_render_samples=32
    scene.render.resolution_x=640; scene.render.resolution_y=640; scene.render.resolution_percentage=100
    if scene.world is None: scene.world=bpy.data.worlds.new('Readiness diagnostic world')
    scene.world.use_nodes=True; scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.12,.12,1)
    clay=bpy.data.materials.new('Readiness diagnostic clay'); clay.diffuse_color=(.45,.48,.50,1)
    scene.view_layers[0].material_override=clay
    bpy.ops.object.camera_add(); camera=bpy.context.object; scene.camera=camera; camera.data.type='ORTHO'
    bpy.ops.object.light_add(type='AREA'); light=bpy.context.object; light.data.energy=90; light.data.size=.4
    for weapon in ['breach','bat','chainsaw']:
        rig=bpy.data.objects['FPSBones_'+weapon]
        for t in rig.animation_data.nla_tracks:t.mute=True
        action=next(a for a in bpy.data.actions if a.name.endswith(weapon+('/fire' if weapon=='breach' else '/strike')))
        rig.animation_data.action=action
        for side in ['right','left']:
            glove=bpy.data.objects.get('FPSGlove_'+weapon+'_'+side)
            if glove is None:continue
            for c in bpy.data.collections:c.hide_render=False
            for o in bpy.data.objects:
                if o.type=='MESH':o.hide_render=o!=glove
            for step in [0,2,8]:
                lo,hi=action.frame_range;frame=lo+(hi-lo)*step/16;scene.frame_set(int(frame),subframe=frame-int(frame))
                evaluated=glove.evaluated_get(bpy.context.evaluated_depsgraph_get()); mesh=evaluated.to_mesh()
                points=[glove.matrix_world@v.co for v in mesh.vertices];evaluated.to_mesh_clear()
                centre=sum(points,Vector())/len(points); span=max((a-centre).length for a in points)
                camera.location=centre+Vector((.3,-.45,.3)); camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=span*2.5
                light.location=centre+Vector((.15,-.25,.45));light.rotation_euler=(centre-light.location).to_track_quat('-Z','Y').to_euler()
                path=out/(weapon+'-'+side+'-'+str(step)+'.png');scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
                report['renders'].append(str(path.relative_to(ROOT)))

report['status']='PASS' if not report['errors'] else 'FAIL'
(out/'report.json').write_text(json.dumps(report,indent=2))
print('FPS_ANIMATION_READINESS',report['status'],len(report['rigs']),'rigs',len(report['errors']),'errors',flush=True)
if report['errors']:raise RuntimeError('\n'.join(report['errors']))
