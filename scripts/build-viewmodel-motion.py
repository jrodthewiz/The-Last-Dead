"""Blender 2.93+: --background --python scripts/build-viewmodel-motion.py.
Run export-viewmodel-animation-reference.mjs first. Edit saved actions and
use -- --export-only to rebake without rebuilding authored keys.
"""
import bpy, json, math, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ARCHIVE=ROOT/'.art-source/viewmodel-motion'
BLEND=ARCHIVE/'The_Last_Dead_First_Person_Motion.blend'
OUT=ROOT/'assets/survivor/viewmodel-motion-clips.js'
FPS=120

def key_action(obj,name,duration,poses):
    action=bpy.data.actions.new(name);action.use_fake_user=True
    action['duration']=duration;obj.animation_data_create();obj.animation_data.action=action
    for t,p,r in poses:
        obj.location=p;obj.rotation_euler=r
        obj.keyframe_insert('location',frame=1+t*FPS)
        obj.keyframe_insert('rotation_euler',frame=1+t*FPS)
    for curve in action.fcurves:
        for key in curve.keyframe_points:
            key.interpolation='BEZIER';key.handle_left_type='AUTO_CLAMPED';key.handle_right_type='AUTO_CLAMPED'
    return action

if '--export-only' in sys.argv:
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
else:
    reference=json.loads((ARCHIVE/'reference.json').read_text())
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene;scene.render.fps=FPS
    # Local animation channels use the game's X-right/Y-up/-Z-forward frame.
    basis=bpy.data.objects.new('Game_to_Blender_Y_up',None);scene.collection.objects.link(basis)
    basis.rotation_euler=(math.pi/2,0,0)
    for wi,weapon in enumerate(reference['weapons']):
        p=weapon['profile'];name=p['name']
        root=bpy.data.objects.new('CTRL_'+name,None);scene.collection.objects.link(root);root.parent=basis
        root.empty_display_type='ARROWS';root.rotation_mode='ZYX'
        root['weapon_index']=wi;root['runtime_frame']='X right, Y up, -Z forward; metres/radians'
        for source in weapon['meshes']:
            vertices=list(zip(*[iter(source['positions'])]*3));faces=list(zip(*[iter(source['indices'])]*3))
            mesh=bpy.data.meshes.new(source['name']);mesh.from_pydata(vertices,[],faces);mesh.update()
            obj=bpy.data.objects.new(source['name'],mesh);scene.collection.objects.link(obj);obj.parent=root
            material=bpy.data.materials.new(source['name']);material.diffuse_color=(*source['color'],1);mesh.materials.append(material)
            for poly in mesh.polygons:poly.use_smooth=True
        d=p['equip'];cant=p['cant']
        draw=key_action(root,name+'/draw',d,[
            (0,(.025,-.23,.06),(.48,-cant*.18,cant)),
            (d*.38,(.01,-.095,.025),(.19,-cant*.1,cant*.46)),
            (d*.76,(0,.008,-.004),(-.028,0,-cant*.06)),
            (d,(0,0,0),(0,0,0))])
        if wi<6:
            k=p['kick'];pitch=p['pitch'];roll=p['roll'];d=.34+p['mass']*.11
            key_action(root,name+'/fire',d,[
                (0,(0,0,k),(pitch,roll*.3,roll)),
                (.035,(0,.006,k*.77),(pitch*.92,roll*.25,roll*.8)),
                (d*.43,(0,-.002,-k*.10),(-pitch*.10,0,-roll*.12)),
                (d*.72,(0,0,k*.025),(pitch*.018,0,0)),
                (d,(0,0,0),(0,0,0))])
        key_action(root,name+'/land',.42,[
            (0,(0,0,0),(0,0,0)),(.065,(0,-.038*p['mass'],.006),(-.043*p['mass'],0,cant*.025)),
            (.19,(0,.006,0),(.008,0,0)),(.42,(0,0,0),(0,0,0))])
        key_action(root,name+'/idle',4,[
            (0,(0,0,0),(0,0,0)),(1,(0,.002,0),(0,0,0)),
            (2,(0,0,0),(0,0,0)),(3,(0,-.002,0),(0,0,0)),(4,(0,0,0),(0,0,0))])
        key_action(root,name+'/walk',1,[
            (0,(0,.0042,0),(0,0,0)),(.25,(.012,-.0042,0),(0,0,.0072)),
            (.5,(0,.0042,0),(0,0,0)),(.75,(-.012,-.0042,0),(0,0,-.0072)),(1,(0,.0042,0),(0,0,0))])
        root.animation_data.action=draw
        # Separate NLA libraries keep every clip discoverable in Blender.
        for action in [a for a in bpy.data.actions if a.name.startswith(name+'/')]:
            track=root.animation_data.nla_tracks.new();track.name=action.name;track.mute=True
            track.strips.new(action.name,1,action)
        root.hide_render=wi!=1;root.hide_viewport=wi!=1
        for child in root.children:child.hide_render=wi!=1;child.hide_viewport=wi!=1
    camera_data=bpy.data.cameras.new('First person 110 degrees');camera=bpy.data.objects.new('First person camera',camera_data)
    scene.collection.objects.link(camera);camera.parent=basis;camera_data.angle=math.radians(110);camera_data.clip_start=.025;scene.camera=camera
    scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100
    scene.frame_end=481;scene.frame_set(50)
    scene['README']='Select CTRL_weapon and an Action. Unhide its child meshes. NLA library tracks are muted. Geometry is fitted runtime reference; game solves articulated sleeves against grips each frame. Export-only rebakes edited actions.'
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))

clips={}
for action in bpy.data.actions:
    if 'duration' not in action:continue
    duration=float(action['duration']);count=math.ceil(duration*FPS)
    curves={(c.data_path,c.array_index):c for c in action.fcurves}
    samples=[]
    for i in range(count+1):
        frame=1+min(i/FPS,duration)*FPS
        samples.append([round(curves[(path,axis)].evaluate(frame),7) for path in ['location','rotation_euler'] for axis in range(3)])
    clips[action.name]={'duration':duration,'fps':FPS,'samples':samples}
OUT.write_text('// Generated by Blender. Edit the .blend actions, then run --export-only.\nexport const VIEWMODEL_CLIPS = '+json.dumps(clips,separators=(',',':'))+';\n')
(ARCHIVE/'manifest.json').write_text(json.dumps({'blender':bpy.app.version_string,'clips':list(clips),'sampleRate':FPS,'source':str(BLEND),'runtime':str(OUT)},indent=2))
print('Baked',len(clips),'first-person actions to',OUT)
