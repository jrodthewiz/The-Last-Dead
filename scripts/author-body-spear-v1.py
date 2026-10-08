"""Author paired body-spear motion and an original wound kit in Blender 2.93.

Blender --background --python scripts/author-body-spear-v1.py
Edit CTRL_* in .art-source/body-spear-v1/Body_Spear_v1.blend, then use
-- --export-only to rebake the motion contract. Delivered character GLBs are
read-only. No reference footage, provider assets or credentials are copied.
"""
import bpy, hashlib, importlib.util, json, math, sys
from pathlib import Path
from mathutils import Vector, Quaternion

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'.art-source/body-spear-v1'
TEMP=ROOT/'.codex-temp/body-spear-v1'
DOC=ROOT/'docs/body-spear-v1'
BLEND=ART/'Body_Spear_v1.blend'
DATA=ROOT/'assets/animations/body-spear-v1.js'
GLB=ROOT/'assets/models/body-spear-anatomy-v1.glb'
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path)
    result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result
motion=module('spear_motion_helpers','scripts/author-zombie-motion-v07.py')
anatomy=module('spear_anatomy_helpers','scripts/build-brutal-anatomy.py')
helpers=motion.helpers
SOURCES={'ash-witness':'assets/models/afterlife-ash-witness-motion-v07.glb',
         **{key:'assets/models/zombie-variants/'+key+'.glb' for key in ['drowned-dockworker','fever-runner','crooked-crawler']}}
DURATION=1.5
TIMES=[0,.06,.14,.20,.24,.285,.38,.48,.58,.68,.80,.95,1.08,1.30,1.50]
# Seconds align with the authoritative pierce contact/extraction/release.
CURVES={
 'drive':[0,0,0,.20,1,1,1,1,.84,.28,0,0,0,0,0],
 'coil':[0,.5,1,.6,0,0,0,0,0,0,0,0,0,0,0],
 'strain':[0,.12,.35,.70,1,.96,.74,.62,.84,.60,.34,.12,0,0,0],
 'spine_pitch':[0,-.015,-.04,-.065,-.18,-.24,-.18,-.13,-.19,-.12,-.07,-.04,0,0,0],
 'head_pitch':[0,.02,.035,.07,.31,.40,.30,.22,.34,.24,.16,.09,0,0,0],
 'pelvis_back':[0,0,0,.004,.024,.038,.030,.020,.030,.018,.012,0,0,0,0],
 'brace':[0,.25,.75,1,1,1,1,1,1,.8,.5,.2,0,0,0],
 'jaw':[0,.05,.09,.12,.36,.42,.32,.24,.34,.25,.15,.08,0,0,0],
 'arm_react':[0,.10,.20,.25,.25,.28,.24,.22,.20,.18,.14,.08,0,0,0],
}
for directory in [ART,TEMP,DOC,DATA.parent]:directory.mkdir(parents=True,exist_ok=True)
if '--export-only' in sys.argv:
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version=0
    scene=bpy.context.scene;scene.render.fps=60;scene.frame_end=90
    for name,values in CURVES.items():
        control=bpy.data.objects.new('CTRL_'+name,None);scene.collection.objects.link(control)
        control.empty_display_type='ARROWS';control['value']=0.0
        for time,value in zip(TIMES,values):
            control['value']=value;control.keyframe_insert(data_path='["value"]',frame=time*60)
        for curve in control.animation_data.action.fcurves:
            for key in curve.keyframe_points:
                key.interpolation='BEZIER';key.handle_left_type=key.handle_right_type='AUTO_CLAMPED'
        control.animation_data.action.use_fake_user=True

def sample(name,time):
    obj=bpy.data.objects['CTRL_'+name]
    return float(obj.animation_data.action.fcurves[0].evaluate(time*60))

bone_names=['Hips','Spine02','Spine01','Spine','neck','Head','Jaw','LeftGrip','RightGrip']+[
    side+name for side in ['Left','Right'] for name in ['Shoulder','Arm','ForeArm','Hand','UpLeg','Leg','Foot']]
frames=[i/60 for i in range(91)]
contract={'version':1,'fps':60,'duration':DURATION,'timing':{'contactAt':.24,'extractionAt':.68,'releaseAt':.95},
          'frame':'victim metres; +Z outward from chest, +Y up; simulation owns contact',
          'controls':{name:[round(sample(name,t),6) for t in frames] for name in CURVES},'bodies':{}}
reports=[]
for index,(key,file) in enumerate(SOURCES.items()):
    asset=helpers.Glb(ROOT/file);original_hash=hashlib.sha256(asset.raw).hexdigest()
    rest=motion.Pose(asset);names=rest.names
    included=[name for name in bone_names if name in names]
    rotations={name:[] for name in included};positions=[];previous={}
    feet={side:rest.point(side+'Foot') for side in ['Left','Right']}
    hips=rest.point('Hips');chest=rest.point('Spine');height=rest.point('Head').y-feet['Left'].y
    for time in frames:
        p=motion.Pose(asset);strain=sample('strain',time)
        p.position('Hips',hips+Vector((0,0,-sample('pelvis_back',time))))
        for name,part in [('Spine02',.38),('Spine01',.34),('Spine',.28)]:p.turn(name,(1,0,0),sample('spine_pitch',time)*part)
        p.turn('neck',(1,0,0),sample('head_pitch',time)*.35)
        p.turn('Head',(1,0,0),sample('head_pitch',time)*.65)
        for side,sign in [('Left',-1),('Right',1)]:
            a=rest.point(side+'Arm');target=chest+Vector((sign*.19,height*.015,.18+.025*strain))
            p.limb(side+'Arm',side+'ForeArm',side+'Hand',target,(sign*.8,-.5,.20))
            p.limb(side+'UpLeg',side+'Leg',side+'Foot',feet[side],(sign*.1,.08,.8))
            p.world_rotation(side+'Foot',rest.matrix(side+'Foot').to_quaternion())
        if 'Jaw' in names:
            # The weighted support hinge is authored in its own local bind basis.
            i=names['Jaw'];q=p.local[i].to_quaternion()@Quaternion((1,0,0),sample('jaw',time))
            p.local[i]=p.local[i].to_3x3().to_4x4();p.local[i]=motion.Matrix.Translation(rest.local[i].translation)@q.to_matrix().to_4x4()
        for name in included:
            q=p.local[names[name]].to_quaternion().normalized()
            # The scanned coat shares some upper-arm support. Full inward
            # shoulder rotation stretches those sleeve/coat seams into strips.
            # Author a restrained resistance/drop in the source bind basis.
            if name.endswith(('Shoulder','Arm','ForeArm','Hand')):
                q=rest.local[names[name]].to_quaternion().slerp(q,sample('arm_react',time)).normalized()
            if name in previous and previous[name].dot(q)<0:q.negate()
            previous[name]=q.copy();rotations[name].extend(round(x,6) for x in [q.x,q.y,q.z,q.w])
        positions.extend(round(x,6) for x in p.local[names['Hips']].translation)
    contract['bodies'][key]={'sourceSha256':original_hash,'rotations':rotations,'hips':positions}
    # Add one review action to a texture-neutral preservation copy. The
    # packaged character geometry, texture payload and ten clips stay exact.
    channels=[];samplers=[];time_accessor=asset.add_accessor(frames,'SCALAR')
    for name,values in rotations.items():
        accessor=asset.add_accessor([values[i:i+4] for i in range(0,len(values),4)],'VEC4')
        channels.append({'sampler':len(samplers),'target':{'node':names[name],'path':'rotation'}})
        samplers.append({'input':time_accessor,'output':accessor,'interpolation':'LINEAR'})
    accessor=asset.add_accessor([positions[i:i+3] for i in range(0,len(positions),3)],'VEC3')
    channels.append({'sampler':len(samplers),'target':{'node':names['Hips'],'path':'translation'}})
    samplers.append({'input':time_accessor,'output':accessor,'interpolation':'LINEAR'})
    asset.doc['animations']=[{'name':key+'_BodySpearReaction','channels':channels,'samplers':samplers}]
    for section in ['images','textures','samplers']:asset.doc.pop(section,None)
    asset.doc.pop('extensionsRequired',None);asset.doc.pop('extensionsUsed',None)
    for material in asset.doc.get('materials',[]):
        material.clear();material['pbrMetallicRoughness']={'baseColorFactor':[.36,.40,.35,1],'roughnessFactor':.82}
    preview=TEMP/(key+'-reaction.glb');asset.save(preview)
    if '--export-only' not in sys.argv:
        before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(preview))
        imported=[o for o in bpy.data.objects if o not in before]
        top=[o for o in imported if o.parent not in imported]
        for obj in top:obj.location.x+=index*2.3
        for obj in imported:
            if obj.type=='ARMATURE':
                obj.name='VICTIM_'+key;obj['sourceSha256']=original_hash
                if obj.animation_data and obj.animation_data.action:obj.animation_data.action.use_fake_user=True
    assert hashlib.sha256((ROOT/file).read_bytes()).hexdigest()==original_hash
    reports.append({'body':key,'sourceSha256':original_hash,'boneTracks':len(rotations),'samples':91})

DATA.write_text('// Generated by headless Blender from editable CTRL_* curves. Do not hand edit.\n'+
               'export const BODY_SPEAR_MOTION = '+json.dumps(contract,separators=(',',':'))+';\n',encoding='utf8')
if '--export-only' not in sys.argv:
    # Reuse the project's original packed tissue atlas; build new open geometry.
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/brutal-anatomy-v1.glb'))
    anatomy.MATERIAL=next(o.active_material for o in bpy.context.selected_objects if o.type=='MESH' and o.active_material)
    root=bpy.data.objects.new('BodySpearAnatomy_v1',None);bpy.context.collection.objects.link(root)
    pieces=[]
    for name,rx,ry,depth in [('BodySpear_Entry',.073,.092,.038),('BodySpear_Exit',.087,.106,.045),('BodySpear_Tunnel',.061,.079,.20)]:
        writer=anatomy.Writer();rings=[];count=72
        factors=[1.19,1.08,.89,.83] if name!='BodySpear_Tunnel' else [1,1.05,1.12,1.18]
        zs=[.006,.013,-depth*.40,-depth] if name!='BodySpear_Tunnel' else [0,-depth*.28,-depth*.68,-depth]
        for row,(factor,z) in enumerate(zip(factors,zs)):
            ring=[]
            for j in range(count):
                a=j*math.tau/count;ragged=1+.044*math.sin(a*7+.8)+.026*math.cos(a*13)
                ring.append(writer.vertex((rx*factor*ragged*math.cos(a),ry*factor*ragged*math.sin(a),z+.003*math.sin(a*9+row)),(.70,.48,.42,1)))
            rings.append(ring)
        for row in range(3):
            for j in range(count):
                k=(j+1)%count;writer.face((rings[row][j],rings[row][k],rings[row+1][k],rings[row+1][j]),'muscle' if row<2 else 'cavity',[(j/count,row/3),(k/count,row/3),(k/count,(row+1)/3),(j/count,(row+1)/3)])
        if name!='BodySpear_Tunnel':
            for j,a in enumerate([.22,1.05,2.25,3.05,4.2,5.35]):
                points=[Vector((rx*.99*math.cos(a),ry*.99*math.sin(a),-.010)),Vector((rx*.87*math.cos(a+.06),ry*.92*math.sin(a+.06),-.022)),Vector((rx*.76*math.cos(a+.10),ry*.90*math.sin(a+.10),-.033))]
                anatomy.sweep(writer,points,[.0045,.0032,.0009],'fascia' if j%2 else 'blood',sides=8,compression=.6)
            # Four fractured rib ends sit outside the arm's clear tunnel.
            # Open sweeps never add a plate behind the through-body cavity.
            for sign in [-1,1]:
                for height in [-.024,.028]:
                    points=[Vector((sign*rx*.98,height,-.014)),Vector((sign*rx*.91,height+.006,-.021)),Vector((sign*rx*.83,height+.012,-.027))]
                    anatomy.sweep(writer,points,[.0055,.004,.0015],'bone',sides=8,compression=.62,color=(.75,.67,.51,1))
        obj=writer.object(name,root);obj['openThroughCavity']=True;pieces.append(obj)
        if name!='BodySpear_Tunnel':
            obj.shape_key_add(name='Basis')
            for shape,spread,depth_shift in [('TissueTension',1.038,.006),('GripCompress',.94,-.004)]:
                corrective=obj.shape_key_add(name=shape)
                for vertex in corrective.data:
                    vertex.co.x*=spread;vertex.co.z*=spread;vertex.co.y+=depth_shift
    # Exact metre geometry exported independently of the authoring lineup.
    bpy.ops.object.select_all(action='DESELECT')
    for obj in pieces:obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',use_selection=True,export_animations=False,export_extras=True)
    bpy.context.scene['README']='Original paired body spear. CTRL_* curves are editable. Victim source shapes/bind/ten runtime clips are read-only. V/R3 invokes the existing host-authoritative pierce sequence. Entry/exit are fitted to actual posed skin at runtime. Reference footage is not embedded.'
    bpy.context.scene.frame_set(14)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
manifest={'version':1,'blender':bpy.app.version_string,'authoring':str(BLEND.relative_to(ROOT)),
          'motion':str(DATA.relative_to(ROOT)),'motionBytes':DATA.stat().st_size,'anatomy':str(GLB.relative_to(ROOT)),
          'anatomyBytes':GLB.stat().st_size,'bodies':reports,'contactSeconds':.24,'extractionSeconds':.68,'releaseSeconds':.95,
          'reference':'https://www.youtube.com/watch?v=DqAagh50JaI','sourceCharactersUnchanged':True,'runtimeNeedsBlender':False}
(DOC/'authoring.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
print('BODY_SPEAR_AUTHORED',json.dumps(manifest),flush=True)
