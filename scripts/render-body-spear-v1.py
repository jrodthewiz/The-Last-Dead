"""Headless authoring review of the runtime's actual posed skin and arms.

BODY_SPEAR_EVIDENCE=1 node --test tests/body-spear-parity.test.mjs writes
the metre-space contact study. This is an offline Blender art review, not a
gameplay screenshot or evidence of browser rendering.
"""
import bpy,json,math,gzip
from pathlib import Path
from mathutils import Vector,Quaternion

ROOT=Path(__file__).resolve().parents[1]
samples=json.loads(gzip.decompress((ROOT/'.codex-temp/body-spear-v1/runtime-contact.json.gz').read_bytes()))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE'
scene.eevee.use_gtao=True;scene.eevee.gtao_distance=.10;scene.eevee.gtao_factor=1.20
scene.eevee.taa_render_samples=64;scene.eevee.use_soft_shadows=True
scene.render.resolution_x=1800;scene.render.resolution_y=1800;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Neutral authoring world');scene.world.color=(.025,.027,.028)
scene.view_settings.view_transform='Filmic';scene.view_settings.look='Medium High Contrast'
def material(name,color,roughness):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=roughness;return m
victim=material('Neutral source shape - texture not represented',(.29,.34,.30),.73)
arms=material('Arm and glove silhouette',(.19,.23,.24),.72)
floor=material('Authoring ground',(.095,.11,.115),.86)
def convert(p):return Vector((p[0],-p[2],p[1]))
kit=[]
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/body-spear-anatomy-v1.glb'))
for obj in list(bpy.data.objects):
 if obj.type=='MESH':kit.append(obj);obj.hide_render=True
source={o.name:o for o in kit}
offsets=[]
for sample in samples:
 row=['ash-witness','drowned-dockworker','fever-runner','crooked-crawler'].index(sample['body']);col=[.14,.24,.68].index(sample['time'])
 offset=Vector((col*2.3,row*2.6,0));offsets.append(offset)
 for part in sample['meshes']:
  data=bpy.data.meshes.new(sample['body']+'_'+part['name']+'_'+str(sample['time']));p=part['positions'];ids=part['indices'];data.from_pydata([convert(p[i:i+3]) for i in range(0,len(p),3)],[],[ids[i:i+3] for i in range(0,len(ids),3)]);data.update()
  obj=bpy.data.objects.new(data.name,data);scene.collection.objects.link(obj);obj.location=offset;data.materials.append(victim if part['name']=='victim' else arms)
  for polygon in data.polygons:polygon.use_smooth=True
 if sample['time']>=.24:
  frame=sample['frame'];entry=convert(frame['entry'])+offset;qx,qy,qz,qw=frame['rotation'];q=Quaternion((qw,qx,qy,qz));basis=Quaternion((1,0,0),math.pi/2);q=basis@q@basis.inverted()
  for name in ['BodySpear_Entry','BodySpear_Exit','BodySpear_Tunnel']:
   obj=source[name].copy();obj.data=source[name].data;scene.collection.objects.link(obj);obj.parent=None;obj.hide_render=False;obj.location=entry;obj.rotation_mode='QUATERNION';obj.rotation_quaternion=q;obj.scale=Vector((1,1,1))
   if name=='BodySpear_Exit':obj.location+=q@Vector((0,frame['depth']+.002,0));obj.rotation_quaternion=q@Quaternion((0,0,1),math.pi)
   if name=='BodySpear_Tunnel':obj.location+=q@Vector((0,.005,0));obj.scale.y=(frame['depth']-.006)/.20
  # Label only source/time; this does not resemble an in-game HUD.
 text=bpy.data.curves.new('Contact study label','FONT');text.body=sample['body']+' / '+str(sample['time'])+' s';text.size=.13;text.align_x='CENTER';obj=bpy.data.objects.new(text.body,text);scene.collection.objects.link(obj);obj.location=offset+Vector((.4,.74,.055));obj.rotation_euler=(math.pi/2,0,0)
bpy.ops.mesh.primitive_plane_add(size=200,location=(2,3,-.005));bpy.context.object.data.materials.append(floor)
def light(name,loc,power,size):
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.size=size;obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=loc;obj.rotation_euler=(Vector((2,4,1))-obj.location).to_track_quat('-Z','Y').to_euler()
light('Broad neutral key',(1,-3,10),1500,7);light('Rim',(8,10,9),1800,6);light('Fill',(-4,6,5),800,5)
data=bpy.data.cameras.new('Authoring study');camera=bpy.data.objects.new('Authoring study',data);scene.collection.objects.link(camera);scene.camera=camera
camera.location=(12,-9,15);target=Vector((2.7,3.8,.85));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=12.6
scene.render.filepath=str(ROOT/'docs/body-spear-v1/contact-study.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'.art-source/body-spear-v1/Runtime_Contact_Study.blend'),compress=True)
print('BODY_SPEAR_CONTACT_STUDY_RENDERED',scene.render.filepath,flush=True)
