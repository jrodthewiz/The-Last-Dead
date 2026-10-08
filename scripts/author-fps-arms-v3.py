"""Build editable, weighted FPS arms and real bone Actions in Blender 2.93.

Run export-fps-rig-reference.mjs first. The protected v1/v2/interaction and body
assets are inputs only. --export-only exports saved artist edits without a rebuild.
"""
import bpy, math, json, sys, hashlib
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[1]
ARCHIVE=ROOT/'.art-source/viewmodel-arms-v3';ARCHIVE.mkdir(parents=True,exist_ok=True)
MASTER=ARCHIVE/'The_Last_Dead_Animated_FPS_Arms_v3.blend'
OUT=ROOT/'assets/survivor/fps-arms-v3.glb'
if '--output' in sys.argv:
 requested=Path(sys.argv[sys.argv.index('--output')+1]);OUT=requested if requested.is_absolute() else ROOT/requested
 OUT.parent.mkdir(parents=True,exist_ok=True)
FPS=60
protected=[ROOT/'assets/survivor/viewmodel-arms-v1.glb',ROOT/'assets/survivor/viewmodel-arms-v2.glb',ROOT/'assets/survivor/tld-survivor-v02.glb']
hashes={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest()for p in protected}
def B(p):return Vector((p[0],-p[2],p[1]))
def G(p):return Vector((p[0],p[2],-p[1]))
def matrix(v):return Matrix([v[i::4]for i in range(4)])
def catmull(points,t):
 i=min(len(points)-2,int(t));f=t-i;p0,p1,p2,p3=[Vector(points[max(0,min(len(points)-1,j))])for j in [i-1,i,i+1,i+2]]
 return .5*((2*p1)+(-p0+p2)*f+(2*p0-5*p1+4*p2-p3)*f*f+(-p0+3*p1-3*p2+p3)*f*f*f)

def phalange_curve(path,f):
 # MCP, PIP, DIP and tip are the actual rig joints. Keep the leather panels
 # straight between them, rounding only a short interval around each bend.
 points=[Vector(path[j])for j in [0,2,4,5]];spans=[]
 start=points[0]
 for j in [1,2]:
  before,corner,after=points[j-1:j+2]
  trim=min(.0035,(corner-before).length*.15,(after-corner).length*.15)
  entry=corner+(before-corner).normalized()*trim;exit=corner+(after-corner).normalized()*trim
  spans.append((start,entry,None,(entry-start).length))
  spans.append((entry,exit,corner,((corner-entry).length+(exit-corner).length)*.82));start=exit
 spans.append((start,points[-1],None,(points[-1]-start).length))
 distance=max(0,min(1,f))*sum(s[3]for s in spans)
 for a,b,corner,length in spans:
  if distance<=length:
   t=distance/max(length,1e-10)
   return a.lerp(b,t)if corner is None else a*(1-t)**2+corner*(2*t*(1-t))+b*t*t
  distance-=length
 return points[-1]
def mesh(name,verts,faces,material):
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
 obj=bpy.data.objects.new(name,data);bpy.context.scene.collection.objects.link(obj);data.materials.append(material)
 for p in data.polygons:p.use_smooth=True
 return obj
def material(name,roughness):
 m=bpy.data.materials.new(name);m.use_nodes=True;s=m.node_tree.nodes['Principled BSDF'];s.inputs['Base Color'].default_value=(1,1,1,1);s.inputs['Roughness'].default_value=roughness
 c=m.node_tree.nodes.new('ShaderNodeVertexColor');c.layer_name='AuthoredSurface';m.node_tree.links.new(c.outputs['Color'],s.inputs['Base Color']);return m
def colors(obj,values):
 layer=obj.data.vertex_colors.new(name='AuthoredSurface')
 for loop in obj.data.loops:layer.data[loop.index].color=(*values[loop.vertex_index],1)
def surface_tube(name,path,radius,sign,mat):
 vertices=[];faces=[];rows=65;segments=24;previous_tangent=None;previous_normal=None
 segmented=name!='Thumb'
 sample=lambda f:phalange_curve(path,f)if segmented else catmull(path,f*(len(path)-1))
 for j in range(rows):
  f=j/(rows-1);c=sample(f)
  tangent=(sample(min(1,f+.002))-sample(max(0,f-.002))).normalized()
  if previous_tangent is not None:normal=previous_tangent.rotation_difference(tangent)@previous_normal
  else:normal=Vector((sign,0,0))
  normal-=tangent*normal.dot(tangent)
  if normal.length<.001:normal=Vector((0,0,-1));normal-=tangent*normal.dot(tangent)
  normal.normalize();binormal=tangent.cross(normal).normalized()
  previous_tangent=tangent.copy();previous_normal=normal.copy()
  tip=1 if f<.92 else max(.025,math.sqrt(max(0,1-((f-.92)/.08)**2)))
  joint=.16*math.exp(-((f-.28)/.045)**2)+.12*math.exp(-((f-.64)/.035)**2)-.11*math.exp(-((f-.35)/.018)**2)-.08*math.exp(-((f-.70)/.015)**2)
  r=radius*(1-.34*f)*tip
  for k in range(segments):
   a=math.tau*k/segments;x=math.cos(a);z=math.sin(a)
   # Flat dorsal leather panels, soft underside pads and tapered phalanges.
   p=c+normal*(r*(.83+joint)*math.copysign(abs(x)**.58,x))+binormal*(r*1.05*math.copysign(abs(z)**.76,z))
   vertices.append(B(p))
   if j<rows-1:faces.append((j*segments+k,j*segments+(k+1)%segments,(j+1)*segments+(k+1)%segments,(j+1)*segments+k))
 faces.extend([tuple(reversed(range(segments))),tuple((rows-1)*segments+k for k in range(segments))])
 return mesh(name,vertices,faces,mat)
def hold_geometry(side,profile):
 sign=-1 if side=='left'else 1;paths={};contacts={}
 # Author each loaded phalanx on an outward tangent plane of the actual
 # Blender weapon cross-section. A chord through a circle cuts into the grip.
 angles={'fore-end':(0,50,90),'shaft':(0,55,110),'handle':(0,55,105)}.get(profile['kind'],(0,55,105))
 for digit,r,length in [('Index',.0105,1),('Middle',.0112,1.06),('Ring',.0102,1),('Little',.0088,.85)]:
  row=profile['rows'][digit];y=row['y'];points=[Vector((sign*p[0],p[1]))for p in row['points']]
  normals=[Vector((math.cos(math.radians(a)),math.sin(math.radians(a))))for a in angles]
  distances=[max(n.dot(p)for p in points)+r*f+.0007 for n,f in zip(normals,[.86,.65,.58])]
  def corner(i,j):
   a,b=normals[i],normals[j];d,e=distances[i],distances[j];det=a.x*b.y-a.y*b.x
   return Vector(((d*b.y-a.y*e)/det,(a.x*e-d*b.x)/det))
  cz=(min(p.y for p in points)+max(p.y for p in points))*.5
  rz=(max(p.y for p in points)-min(p.y for p in points))*.5
  pip=corner(0,1)
  middle_length={'Index':.025,'Middle':.028,'Ring':.025,'Little':.020}[digit]
  # Choose distal opposition around the measured surface while retaining
  # the same actor's intermediate phalanx length across all hold families.
  candidates=[]
  for angle in range(int(angles[1])+6,161):
   n=Vector((math.cos(math.radians(angle)),math.sin(math.radians(angle))))
   normals[2]=n;distances[2]=max(n.dot(p)for p in points)+r*.58+.0007;dip=corner(1,2)
   candidates.append((abs((dip-pip).length-middle_length),n.copy(),distances[2],dip.copy()))
  _,normals[2],distances[2],dip=min(candidates,key=lambda c:c[0])
  proximal={'Index':.038,'Middle':.042,'Ring':.039,'Little':.030}[digit]
  z=pip.y-proximal;root=Vector(((distances[0]-normals[0].y*z)/normals[0].x,z))
  tip=dip+Vector((-normals[2].y,normals[2].x))*(.023*length)
  p=[Vector((sign*v.x,y,v.y))for v in [root,pip,dip,tip]]
  paths[digit]=[tuple(p[0]),tuple(p[0].lerp(p[1],.5)),tuple(p[1]),tuple(p[1].lerp(p[2],.5)),tuple(p[2]),tuple(p[3])]
  contacts[digit]={'normals':[tuple(n)for n in normals],'distances':distances,'radius':r}
 middle=[(sign*p[0],p[1])for p in profile['rows']['Middle']['points']];loX,hiX=min(p[0]for p in middle),max(p[0]for p in middle);loZ,hiZ=min(p[1]for p in middle),max(p[1]for p in middle);rx=(hiX-loX)*.5;rz=(hiZ-loZ)*.5;cx=(hiX+loX)*.5;cz=(hiZ+loZ)*.5
 # The finger fan spans each fitted hand's Y axis. Its longitudinal palm
 # runs behind the measured roots along Z; the weapon-specific frame places
 # that wrist beside a fore-end, below a handle or behind a pistol grip.
 # A wrist beside the little finger produces a sideways paddle even when
 # contact and a self-defined wrist cone both pass.
 wrist=Vector((sign*(hiX+.020),-.004,paths['Middle'][0][2]-.090))
 # The trigger index travels around the near side of the wood into the guard.
 target=profile.get('triggerPoint')
 if side=='right'and target and profile['kind']=='pistol':
  root=Vector(paths['Index'][0]);t=Vector(target);side_z=min(p[1]for p in profile['rows']['Index']['points'])-.011
  pip=Vector((.012,max(root.y,t.y)+.005,side_z));dip=Vector((t.x+.020,t.y+.006,side_z*.65));tip=t+Vector((.008,0,0))
  paths['Index']=[tuple(root),tuple(root.lerp(pip,.5)),tuple(pip),tuple(pip.lerp(dip,.5)),tuple(dip),tuple(tip)]
 # Opposed thumb on the other side of the handle; its base grows out of the
 # metacarpal slab rather than intersecting the finger roots.
 base=Vector((wrist.x+sign*.004,wrist.y-.012,wrist.z+.045));pip=Vector((sign*(hiX+.007),.008,loZ-.012));dip=Vector((sign*(cx+.008),.027,loZ-.012));tip=Vector((sign*(cx-.006),.026,loZ-.010))
 paths['Thumb']=[tuple(base),tuple(base.lerp(pip,.5)),tuple(pip),tuple(pip.lerp(dip,.5)),tuple(dip),tuple(tip)]
 return wrist,paths,contacts

def make_hand(side,profile,mat):
 sign=-1 if side=='left'else 1
 wrist,paths,contacts=hold_geometry(side,profile)
 # One central palm, spreading across the four measured metacarpal roots.
 # Contact paths are fitted per weapon, rather than scaling a generic grasp.
 vertices=[];faces=[];segments=48
 roots=[Vector(paths[d][0])for d in ['Index','Middle','Ring','Little']]
 end=Vector((sum(p.x for p in roots)/4+sign*.001,0,sum(p.z for p in roots)/4))
 for j,t in enumerate([-.38,-.25,-.10,0,.16,.32,.48,.64,.78,.90,1]):
  centre=wrist.lerp(end,t);spread=.031 if t<0 else .031+.018*math.sin(t*math.pi*.5)
  thickness=.027 if t<0 else .024-.008*t
  for k in range(segments):
   angle=k/segments*math.tau;c,s=math.cos(angle),math.sin(angle)
   y=centre.y+spread*math.copysign(abs(s)**.78,s)
   weights=[math.exp(-((y-p.y)/.019)**2)for p in roots];total=max(1e-9,sum(weights))
   root_z=sum(p.z*w for p,w in zip(roots,weights))/total
   # Low metacarpal ridges converge toward four separate dorsal MCP pads;
   # their relief is sculpted into the skin, not painted onto a smooth slab.
   knuckles=max(math.exp(-((y-p.y)/.011)**2)for p in roots)
   ridge=(.003*math.exp(-((t-.68)/.25)**2)+.004*math.exp(-((t-.94)/.09)**2))*knuckles*max(0,c)**3
   cuff=-.0014*math.exp(-((t+.20)/.030)**2)
   x=centre.x+sign*((thickness+cuff)*math.copysign(abs(c)**.62,c)+ridge)
   z=centre.z+max(0,t)**2*(root_z-end.z)
   # The distal palm resolves into four MCP lobes and recessed webs. Its
   # terminal skin follows each finger root instead of capping one thick
   # full-width plate across the knuckles.
   distal=max(0,min(1,(t-.72)/.28));distal=distal*distal*(3-2*distal)
   which=min(range(4),key=lambda i:abs(y-roots[i].y));root=roots[which];radius=[.0105,.0112,.0102,.0088][which]
   lobe=math.sqrt(max(0,1-((y-root.y)/(radius*1.08))**2))
   terminal_x=root.x+sign*(.004+.0068*lobe)*math.copysign(abs(c)**.62,c)
   terminal_z=root.z+.004*lobe-.010*(1-lobe)
   x=x*(1-distal)+terminal_x*distal;z=z*(1-distal)+terminal_z*distal
   vertices.append(B((x,y,z)))
   if j<10:faces.append((j*segments+k,j*segments+(k+1)%segments,(j+1)*segments+(k+1)%segments,(j+1)*segments+k))
 faces.extend([tuple(reversed(range(segments))),tuple(10*segments+k for k in range(segments))])
 parts=[mesh('HandTemplate',vertices,faces,mat)]
 base=Vector(paths['Thumb'][0]);verts=[];polygons=[];rings=13;sides=24
 centre=base+Vector((sign*.001,-.003,-.011))
 for j in range(rings):
  latitude=-math.pi*.5+j/(rings-1)*math.pi
  for k in range(sides):
   a=k/sides*math.tau;p=centre+Vector((sign*.017*math.cos(latitude)*math.cos(a),.021*math.cos(latitude)*math.sin(a),.030*math.sin(latitude)))
   verts.append(B(p))
   if j<rings-1:polygons.append((j*sides+k,j*sides+(k+1)%sides,(j+1)*sides+(k+1)%sides,(j+1)*sides+k))
 parts.append(mesh('ThenarTransition',verts,polygons,mat))
 for digit,y,r,length in [('Index',.041,.0105,1),('Middle',.013,.0112,1.06),('Ring',-.015,.0102,1),('Little',-.040,.0088,.85),('Thumb',0,.012,1)]:
  parts.append(surface_tube(digit,paths[digit],r,sign,mat))
 bpy.ops.object.select_all(action='DESELECT')
 for obj in parts:obj.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();hand=parts[0]
 # Voxel union gives actual continuous finger roots and thumb web. Saved mesh
 # remains editable; no geometry generator is needed by the game.
 hand.data.remesh_voxel_size=.0016;hand.data.remesh_voxel_adaptivity=0
 bpy.ops.object.voxel_remesh()
 smooth=hand.modifiers.new('Sculpted web transitions','SMOOTH');smooth.factor=.25;smooth.iterations=2;bpy.ops.object.modifier_apply(modifier=smooth.name)
 dec=hand.modifiers.new('Foreground topology budget','DECIMATE');dec.ratio=.165;bpy.ops.object.modifier_apply(modifier=dec.name)
 for p in hand.data.polygons:p.use_smooth=True
 hand['continuous_thumb_web']=True;hand['sculpt_revision']=5;hand['hold_family']=profile['kind'];hand['longitudinal_palm']=True
 return hand,paths,wrist,contacts
def add_bone(data,name,head,tail,parent=None):
 bone=data.edit_bones.new(name);bone.head=head;bone.tail=tail
 if parent:bone.parent=data.edit_bones[parent]
 return bone
def distance_segment(p,a,b):
 t=max(0,min(1,(p-a).dot(b-a)/max(1e-12,(b-a).length_squared)));return(p-a-(b-a)*t).length,t
def action(rig,name,duration,pose_frames):
 act=bpy.data.actions.new(rig.name+'_'+name);act.use_fake_user=True;act['duration']=duration
 rig.animation_data_create();rig.animation_data.action=act
 for t,values in pose_frames:
  for bone in rig.pose.bones:bone.rotation_mode='XYZ';bone.rotation_euler=(0,0,0)
  for key,value in values.items():rig.pose.bones[key].rotation_euler=value
  for bone in rig.pose.bones:bone.keyframe_insert('rotation_euler',frame=1+t*FPS)
 for curve in act.fcurves:
  for key in curve.keyframe_points:key.interpolation='BEZIER';key.handle_left_type=key.handle_right_type='AUTO_CLAMPED'
 track=rig.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,1,act);strip.name=name;track.mute=True
 rig.animation_data.action=None
 return act

def prepare_master():
 # Keep one editable assembly visible when opening the artist file, with a
 # working timeline. Export temporarily unmutes no tracks and reveals all.
 scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=121
 for root in [o for o in bpy.data.objects if o.name.startswith('FPSRig_')]:
  name=root.name[len('FPSRig_'):];collection=bpy.data.collections.get('FPS / '+name)
  if collection is None:collection=bpy.data.collections.new('FPS / '+name);scene.collection.children.link(collection)
  def move(obj):
   if obj.name not in collection.objects:collection.objects.link(obj)
   for old in list(obj.users_collection):
    if old!=collection:old.objects.unlink(obj)
   for child in obj.children:move(child)
  move(root);collection.hide_viewport=name!='breach'
  rig=bpy.data.objects.get('FPSBones_'+name)
  for track in rig.animation_data.nla_tracks:track.mute=not(name=='breach'and track.name=='breach/idle')
 bpy.ops.object.select_all(action='DESELECT');rig=bpy.data.objects.get('FPSBones_breach');rig.select_set(True);bpy.context.view_layer.objects.active=rig
 scene.frame_set(1)
if '--export-only'in sys.argv:bpy.ops.wm.open_mainfile(filepath=str(MASTER))
else:
 reference=json.loads((ARCHIVE/'rig-reference.json').read_text());bpy.ops.wm.read_factory_settings(use_empty=True)
 scene=bpy.context.scene;scene.render.fps=FPS
 leather=material('TLD_Full_Worn_Leather_Gloves_v3',.78);canvas=material('TLD_Graphic_Canvas_v3',.92)
 templates={}
 for weapon in reference['weapons']:
  for arm in weapon['arms']:
   print('SCULPT_HAND',weapon['name'],arm['side'],flush=True);templates[(weapon['name'],arm['side'])]=make_hand(arm['side'],arm['profile'],leather)
 for weapon in reference['weapons']:
  print('AUTHOR_RIG',weapon['name'],flush=True)
  name=weapon['name'];index=weapon['index'];root=bpy.data.objects.new('FPSRig_'+name,None);scene.collection.objects.link(root);root['weapon_index']=index;root['fps_rig_revision']=3
  # Editable real weapon references make contact inspectable in the master.
  # They never enter the runtime arms export.
  reference_root=bpy.data.objects.new('WeaponReference_'+name,None);scene.collection.objects.link(reference_root);reference_root.parent=root;reference_root['fps_reference_only']=True
  for surface in weapon['weaponReferences']:
   m=bpy.data.materials.get('Reference_'+str(surface['color']))
   if m is None:
    m=bpy.data.materials.new('Reference_'+str(surface['color']));m.diffuse_color=(*surface['color'],1);m.use_nodes=True;s=m.node_tree.nodes['Principled BSDF'];s.inputs['Base Color'].default_value=(*surface['color'],1);s.inputs['Metallic'].default_value=surface['metalness'];s.inputs['Roughness'].default_value=.65
   obj=mesh('Reference_'+surface['name'],[B(p)for p in zip(*[iter(surface['positions'])]*3)],list(zip(*[iter(surface['indices'])]*3)),m);obj.parent=reference_root;obj['fps_reference_only']=True
  data=bpy.data.armatures.new('FPSBones_'+name);rig=bpy.data.objects.new('FPSBones_'+name,data);scene.collection.objects.link(rig);rig.parent=root;rig.show_in_front=True
  bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
  bone_info={};finger_info={};arm_frames={}
  for arm in weapon['arms']:
   side=arm['side'];prefix='FPS_'+name+'_'+side+'_';hm=matrix(arm['handMatrix']);source,paths,wrist_local,contacts=templates[(name,side)]
   oldS,oldE,oldW=[Vector(arm[k])for k in ['shoulder','elbow','wrist']];newW=hm@wrist_local
   desired=(newW-hm@Vector(paths['Middle'][0])).normalized();old_axis=(oldE-oldW).normalized();angle=old_axis.angle(desired)
   limit=math.radians(arm['profile']['wristConeDegrees']);axis=old_axis if angle<=limit else desired.rotation_difference(old_axis).slerp(Matrix.Identity(3).to_quaternion(),1-limit/angle)@desired
   newE=newW+axis*(oldE-oldW).length;newS=newE+(oldS-oldE).normalized()*(oldS-oldE).length
   shoulder,elbow,wrist=[B(p)for p in [newS,newE,newW]]
   arm_frames[side]=(hm,arm,(oldS,oldE,oldW),(newS,newE,newW))
   add_bone(data,prefix+'Upper',shoulder,elbow);add_bone(data,prefix+'Lower',elbow,wrist,prefix+'Upper')
   palm_tip=B(hm@Vector(paths['Middle'][0]));add_bone(data,prefix+'Hand',wrist,palm_tip,prefix+'Lower')
   bone_info[side]=(prefix,shoulder,elbow,wrist)
   for digit,path in paths.items():
    points=[B(hm@Vector(path[j]))for j in [0,2,4,5]];parent=prefix+'Hand';segments=[]
    for j in range(3):
     bn=prefix+digit+str(j);add_bone(data,bn,points[j],points[j+1],parent);segments.append((bn,points[j],points[j+1]));parent=bn
    finger_info[(side,digit)]=segments
  bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
  for side,(hm,arm,old_points,new_points)in arm_frames.items():
   prefix,shoulder,elbow,wrist=bone_info[side];wrapper=bpy.data.objects.new('FPS_'+name+'_'+side,None);scene.collection.objects.link(wrapper);wrapper.parent=root;wrapper['side']=side
   source,paths,wrist_local,contacts=templates[(name,side)];hand=source.copy();hand.data=source.data.copy();scene.collection.objects.link(hand);hand.name='FPSGlove_'+name+'_'+side;hand.parent=wrapper
   hand['wrist_contact_revision']=5;hand['hold_family']=arm['profile']['kind']
   for v in hand.data.vertices:v.co=B(hm@G(v.co))
   groups={bone.name:hand.vertex_groups.new(name=bone.name)for bone in rig.data.bones if bone.name.startswith(prefix)}
   for v in hand.data.vertices:
    p=v.co;best=(1e6,None,0,0)
    for digit in paths:
     for j,(bn,a,b)in enumerate(finger_info[(side,digit)]):
      d,t=distance_segment(p,a,b)
      if d<best[0]:best=(d,bn,j,t)
    d,bn,j,t=best
    # Finger roots blend into the hand; distal pads follow their joint chain.
    root_distance=(p-finger_info[(side,bn[len(prefix):-1])][0][1]).length
    digit_weight=min(1,max(0,(root_distance-.009)/.025)) if j==0 else 1
    if d>.024*hm.to_scale().x:digit_weight=0
    if digit_weight:groups[bn].add([v.index],digit_weight,'REPLACE')
    if digit_weight<1:groups[prefix+'Hand'].add([v.index],1-digit_weight,'REPLACE')
   cols=[]
   inverse=hm.inverted()
   for v in hand.data.vertices:
    p=inverse@G(v.co);back=max(0,min(1,(abs(p.x)-.035)/.025));seam=math.exp(-((p.z-wrist_local.z+.018)/.0025)**2)
    panel=back*max(0,1-abs(p.y+.005)/.066);knuckle=max(math.exp(-((p.y-y)/.008)**2)for y in [.041,.014,-.015,-.040])*back
    wear=.026*panel+.018*seam+.012*knuckle;cols.append((.057+wear,.065+wear*.95,.055+wear*.78))
   colors(hand,cols);mod=hand.modifiers.new('FPS skin','ARMATURE');mod.object=rig
   sleeve_parts=[]
   for surface in arm['surfaces']:
    oldS,oldE,oldW=old_points;newS,newE,newW=new_points
    pivot,target,rotation=(oldW,newW,(oldE-oldW).rotation_difference(newE-newW))if surface['region']=='forearm'else(oldS,newS,(oldE-oldS).rotation_difference(newE-newS))
    verts=[B(target+rotation@(Vector(p)-pivot))for p in zip(*[iter(surface['positions'])]*3)];faces=list(zip(*[iter(surface['indices'])]*3))
    # Extend the hidden shoulder termination; recoil must not reveal a disk.
    if surface['region']=='upper':
     axis=(shoulder-elbow).normalized();span=(shoulder-elbow).length
     # Recoil can put the elbow farther above the lower frustum plane than
     # one fixed upper segment can reach. Extend only the hidden garment,
     # with its shoulder weights; anatomical bone lengths remain unchanged.
     verts=[p+axis*(.85*max(0,min(1,((p-elbow).dot(axis)/span-.80)/.20)))for p in verts]
    sleeve_parts.append(mesh('SleevePart',verts,faces,canvas))
   bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=.102,location=elbow)
   bridge=bpy.context.object;bridge.data.materials.append(canvas);sleeve_parts.append(bridge)
   bpy.ops.object.select_all(action='DESELECT')
   for obj in sleeve_parts:obj.select_set(True)
   bpy.context.view_layer.objects.active=sleeve_parts[0];bpy.ops.object.join();obj=sleeve_parts[0]
   # One joined garment, with smoothly blended weights across the elbow.
   obj.data.remesh_voxel_size=.005;obj.data.remesh_voxel_adaptivity=0;bpy.ops.object.voxel_remesh()
   smooth=obj.modifiers.new('Tailored elbow transition','SMOOTH');smooth.factor=.35;smooth.iterations=2;bpy.ops.object.modifier_apply(modifier=smooth.name)
   dec=obj.modifiers.new('Garment topology budget','DECIMATE');dec.ratio=.0675;bpy.ops.object.modifier_apply(modifier=dec.name)
   obj.name='FPSSleeve_'+name+'_'+side;obj.parent=wrapper
   gu=obj.vertex_groups.new(name=prefix+'Upper');gl=obj.vertex_groups.new(name=prefix+'Lower')
   axis=((elbow-shoulder).normalized()+(wrist-elbow).normalized()).normalized();cols=[]
   for v in obj.data.vertices:
    t=max(0,min(1,.5+(v.co-elbow).dot(axis)/.18));t=t*t*(3-2*t)
    if t<1:gu.add([v.index],1-t,'REPLACE')
    if t>0:gl.add([v.index],t,'REPLACE')
    cuff=max(0,1-(v.co-wrist).length/.11);value=1+.05*math.sin(v.co.x*73+v.co.z*37)
    cols.append(tuple((a*(1-cuff)+b*cuff)*value for a,b in zip((.060,.098,.104),(.043,.059,.061))))
   for p in obj.data.polygons:p.use_smooth=True
   colors(obj,cols);mod=obj.modifiers.new('FPS skin','ARMATURE');mod.object=rig
  # These are independent bone performances. Assembly recoil/camera lag is
  # kept on the outer weapon anchor at runtime, so it is never counted twice.
  def pose(amount,phase):
   result={}
   for side in arm_frames:
    p=bone_info[side][0];s=-1 if side=='left'else 1
    if phase=='fire':
     result[p+'Index0']=(amount*.085,0,0);result[p+'Index1']=(amount*.05,0,0)
     result[p+'Thumb0']=(0,0,s*amount*.022)
    elif phase=='draw':
     result[p+'Hand']=(0,s*amount*.028,0)
     for d in ['Middle','Ring','Little']:result[p+d+'0']=(amount*.045,0,0)
    else:
     result[p+'Thumb0']=(0,0,s*amount*.008);result[p+'Middle1']=(amount*.007,0,0)
    # Hand is held by the weapon anchor. Tiny authored shoulder/elbow flex is
    # corrected to the end effector after playback, retaining the authored pole.
    result[p+'Upper']=(0,s*amount*.012,0);result[p+'Lower']=(amount*.018,0,0)
   return result
  action(rig,name+'/idle',2,[(0,pose(0,'idle')),(1,pose(1,'idle')),(2,pose(0,'idle'))])
  action(rig,name+'/walk',1,[(0,pose(0,'walk')),(.25,pose(1,'walk')),(.5,pose(0,'walk')),(.75,pose(-1,'walk')),(1,pose(0,'walk'))])
  duration=[.36,.49,.45,.55,.40,.47,.41,.52][index]
  action(rig,name+'/draw',duration,[(0,pose(1,'draw')),(duration*.55,pose(.35,'draw')),(duration,pose(0,'draw'))])
  phase='fire'if index<6 else'strike';duration=.5 if index<6 else 1
  action(rig,name+'/'+phase,duration,[(0,pose(0,'fire')),(duration*.12,pose(1,'fire')),(duration*.35,pose(.65,'fire')),(duration,pose(0,'fire'))])
  root.hide_render=index!=1
 for obj,*_ in templates.values():bpy.data.objects.remove(obj,do_unlink=True)
 scene['fps_rig_revision']=3;scene['README']='Eight dedicated weighted FPS rigs. Edit finger/shoulder/elbow/hand bone Actions in NLA. Outer game weapon anchor owns recoil and aim; runtime grip-frame IK preserves contact. Separate local body remains visible when looking down.'
 prepare_master();bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
for collection in bpy.data.collections:
 if collection.name.startswith('FPS / '):collection.hide_viewport=False
for obj in bpy.data.objects:
 if obj.type=='ARMATURE'and obj.animation_data:
  for track in obj.animation_data.nla_tracks:track.mute=True
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
 if obj.type in ['MESH','ARMATURE','EMPTY']and not obj.get('fps_reference_only'):obj.hide_set(False);obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_texcoords=True,export_normals=True,export_colors=True,export_materials='EXPORT',export_extras=True,export_animations=True,export_nla_strips=True,export_frame_range=False,export_force_sampling=True)
for p in protected:assert hashlib.sha256(p.read_bytes()).hexdigest()==hashes[str(p.relative_to(ROOT))]
manifest={'version':3,'asset':str(OUT.relative_to(ROOT)),'authoring':str(MASTER.relative_to(ROOT)),'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'bytes':OUT.stat().st_size,'protected_source_hashes':hashes,'blender':bpy.app.version_string,'actions':[a.name for a in bpy.data.actions],'runtime_contract':'Dedicated skinned FPS arms; bone clip playback with grip-frame correction; body/interaction assets separate','acceptance':'Pending native gameplay, continuous animation and adversarial visual review'}
manifest_path=ROOT/'assets/survivor/fps-arms-v3-manifest.json' if OUT==ROOT/'assets/survivor/fps-arms-v3.glb' else OUT.with_name(OUT.stem+'-manifest.json')
manifest_path.write_text(json.dumps(manifest,indent=2));print('BLENDER_FPS_V3',json.dumps(manifest),flush=True)
