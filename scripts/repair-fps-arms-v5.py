"""Repair selected V5 shells in the saved Blender master; preserve Actions.

Run in headless Blender with -- --weapons breach or --weapons all.
Loads only reusable geometry function definitions from the scratch generator.
"""
import bpy, ast, argparse, hashlib, json, math, sys, shutil
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'.art-source/fps-arms-v5'
MASTER=SOURCE/'The_Last_Dead_FPS_Arms_v5.blend'
p=argparse.ArgumentParser();p.add_argument('--weapons',default='breach')
opt=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
for original,backup in [(MASTER,SOURCE/'Rejected_Pre_Continuity_Repair.blend'),(ROOT/'assets/survivor/fps-arms-v5.glb',SOURCE/'Rejected_Pre_Continuity_Repair.glb')]:
    if not backup.exists():shutil.copyfile(original,backup)
bpy.ops.wm.open_mainfile(filepath=str(MASTER))
scene=bpy.context.scene
for collection in bpy.data.collections:collection.hide_viewport=False
leather=bpy.data.materials['V5 charcoal leather / worn edges'];canvas=bpy.data.materials['V5 weathered blue work jacket']
tree=ast.parse((ROOT/'scripts/rebuild-fps-arms-v5.py').read_text())
definitions=ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef)],type_ignores=[])
exec(compile(definitions,str(ROOT/'scripts/rebuild-fps-arms-v5.py'),'exec'),globals())
reference=json.loads((ROOT/'.art-source/viewmodel-arms-v3/rig-reference.json').read_text())
report={'weapons':[],'preservedActions':{a.name:[[(tuple(k.co),tuple(k.handle_left),tuple(k.handle_right)) for k in c.keyframe_points] for c in a.fcurves] for a in bpy.data.actions}}
for weapon in reference['weapons']:
    if opt.weapons!='all' and weapon['name'] not in opt.weapons.split(','):continue
    name=weapon['name'];rig=bpy.data.objects['FPSBones_'+name]
    for track in rig.animation_data.nla_tracks:track.mute=True
    rig.animation_data.action=None
    for pb in rig.pose.bones:pb.rotation_euler=(0,0,0)
    scene.frame_set(1)
    for arm in weapon['arms']:
        side=arm['side'];prefix='FPS_'+name+'_'+side+'_'
        old=bpy.data.objects['FPSGlove_'+name+'_'+side];wrapper=old.parent
        print('REPAIR_SHELL',name,side,flush=True)
        glove,wrist_local,paths=build_glove(side,arm['profile'])
        hm=Matrix([arm['handMatrix'][i::4] for i in range(4)])
        points={digit:[B(hm@v) for v in path] for digit,path in paths.items()}
        bpy.ops.object.select_all(action='DESELECT');rig.hide_set(False);rig.select_set(True);bpy.context.view_layer.objects.active=rig
        bpy.ops.object.mode_set(mode='EDIT')
        for digit in ['Thumb','Index']:
            path=points[digit];bend=(path[1]-path[0]).cross(path[2]-path[1]).normalized()
            for j in range(3):
                b=rig.data.edit_bones[prefix+digit+str(j)];b.head=path[j];b.tail=path[j+1]
                y=(b.tail-b.head).normalized();x=(bend-y*bend.dot(y)).normalized();b.align_roll(x.cross(y))
        bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
        bpy.data.objects.remove(old,do_unlink=True)
        glove.name='FPSGlove_'+name+'_'+side;glove.parent=wrapper
        for v in glove.data.vertices:v.co=B(hm@G(v.co))
        influences=[]
        inverse_hand=hm.inverted()
        palm_center=sum([paths[d][0] for d in ['Index','Middle','Ring','Little']],Vector())/4
        for vertex in glove.data.vertices:
            options=[]
            for digit,path in points.items():
                for j in range(3):
                    d,t=segment_distance(vertex.co,path[j],path[j+1]);options.append((d,digit,j,t))
            distance,digit,j,t=min(options);path=points[digit]
            root_distance=(vertex.co-path[0]).length
            # Retain a broad rigid metacarpal web. Flex begins beyond the MCP,
            # so opening the draw never turns its blended junction into a slit.
            along=(vertex.co-path[0]).dot((path[1]-path[0]).normalized())
            amount=smooth((along+.003)/.022) if j==0 else 1
            amount*=smooth((.030*hm.to_scale().x-distance)/(.010*hm.to_scale().x))
            local=inverse_hand@G(vertex.co)
            palm_t=max(0,min(1,(local.z-wrist_local.z)/(palm_center.z-wrist_local.z)))
            palm_x=wrist_local.lerp(palm_center,palm_t).x
            palm_ownership=smooth((palm_center.z-.004-local.z)/.020)*smooth((.048-local.y)/.020)*smooth((.032-abs(local.x-palm_x))/.012)
            amount*=1-palm_ownership
            values=[(prefix+'Hand',1-amount)];blend=.20
            if t<blend and j>0:
                w=.5*(1-t/blend);values += [(prefix+digit+str(j-1),amount*w),(prefix+digit+str(j),amount*(1-w))]
            elif t>1-blend and j<2:
                w=.5*(t-(1-blend))/blend;values += [(prefix+digit+str(j),amount*(1-w)),(prefix+digit+str(j+1),amount*w)]
            else:values.append((prefix+digit+str(j),amount))
            influences.append(values)
        skin(glove,rig,influences)
        for loop in glove.data.uv_layers.active.data:loop.uv*=2
        glove['surface_weave_uv']=5;glove['continuity_repair_revision']=1
        old_sleeve=bpy.data.objects['FPSSleeve_'+name+'_'+side]
        bpy.data.objects.remove(old_sleeve,do_unlink=True)
        sleeve(name,side,prefix,rig.data.bones[prefix+'Upper'].head_local.copy(),rig.data.bones[prefix+'Lower'].head_local.copy(),rig.data.bones[prefix+'Hand'].head_local.copy(),rig,wrapper)
        garment=bpy.data.objects['FPSSleeve_'+name+'_'+side]
        for loop in garment.data.uv_layers.active.data:loop.uv.x*=5;loop.uv.y*=16
        garment['surface_weave_uv']=5;garment['continuity_repair_revision']=1
        report['weapons'].append({'weapon':name,'side':side,'shellComponents':glove['structural_shell_components'],'shellVertices':glove['structural_shell_vertex_count']})
after={a.name:[[(tuple(k.co),tuple(k.handle_left),tuple(k.handle_right)) for k in c.keyframe_points] for c in a.fcurves] for a in bpy.data.actions}
assert after==report.pop('preservedActions'),'Repair changed authored Actions'
report['thumbReleaseActions']=[]
for act in bpy.data.actions:
    name=act.name.split('/')[0]
    if not act.name.endswith('/draw') or (opt.weapons!='all' and name not in opt.weapons.split(',')):continue
    if act.get('thumb_release_revision')!=2:
        for curve in act.fcurves:
            if 'Thumb' in curve.data_path and curve.array_index==0:
                for key in curve.keyframe_points:
                    key.co.y*=-.5;key.handle_left.y*=-.5;key.handle_right.y*=-.5
        act['thumb_release_revision']=2
    report['thumbReleaseActions'].append(act.name)
report['indexContactActions']=[]
for act in bpy.data.actions:
    name=act.name.split('/')[0]
    if opt.weapons!='all' and name not in opt.weapons.split(','):continue
    if act.get('index_contact_revision')==2:continue
    for curve in act.fcurves:
        if 'Index' not in curve.data_path or curve.array_index!=0:continue
        scale=1
        if act.name.endswith('/draw'):scale=.01/.14
        elif act.name.endswith('/fire') and '_right_' in curve.data_path:
            scale=.125 if 'Index0' in curve.data_path else .20/.65 if 'Index1' in curve.data_path else .45/.30
        if scale!=1:
            for key in curve.keyframe_points:key.co.y*=scale;key.handle_left.y*=scale;key.handle_right.y*=scale
    act['index_contact_revision']=2;report['indexContactActions'].append(act.name)
for collection in bpy.data.collections:
    if collection.name.startswith('FPS V5 / '):collection.hide_viewport=collection.name!='FPS V5 / breach'
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
(SOURCE/'continuity-repair-report.json').write_text(json.dumps(report,indent=2))
print('REPAIR_COMPLETE',json.dumps(report),flush=True)
