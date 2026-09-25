"""Reauthor the shipped Bloodworks Warden rig with readable combat motion.

Run with Blender 2.93 in background mode. The existing GLB is the mesh/rig
source; this script writes a clean editable .blend, a replacement GLB, and
pose frames for an offline review sheet. Root travel stays simulation-owned.
"""
import argparse
import importlib.util
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('ash_helpers', ROOT / 'scripts/afterlife-character-blender.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


def arguments():
    values = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--blend', required=True)
    parser.add_argument('--export', required=True)
    parser.add_argument('--frames-dir', required=True)
    parser.add_argument('--report', required=True)
    return parser.parse_args(values)


def add_clip(rig, name, length, rotations, hips=None, loop=False):
    action = helper.action_for(rig, name, length, loop)
    for bone, keys in rotations.items():
        if bone not in rig.pose.bones:
            raise RuntimeError('Missing bone: ' + bone)
        helper.key_rotation(action, rig, bone, keys)
    if hips:
        helper.key_location(action, rig, 'Hips', hips)
    helper.linearize(action)
    return action


def vals(frames, values):
    return list(zip(frames, values))


def make_clips(rig):
    idle_frames = [1, 13, 27, 41, 55, 60]
    idle = add_clip(rig, 'TLD_Idle', 60, {
        'Hips': vals(idle_frames, [(0, 0, -.025), (0, .025, -.015), (0, -.01, .005),
                                   (0, -.025, .02), (0, .012, -.01), (0, 0, -.025)]),
        'Spine02': vals(idle_frames, [(.08, 0, -.035), (.11, 0, -.028), (.07, 0, -.01),
                                      (.05, 0, .012), (.09, 0, -.02), (.08, 0, -.035)]),
        'Spine01': vals(idle_frames, [(.10, 0, 0), (.12, 0, .01), (.09, 0, 0),
                                      (.07, 0, -.01), (.11, 0, 0), (.10, 0, 0)]),
        'neck': vals(idle_frames, [(-.05, 0, .035), (-.04, .02, .025), (-.06, -.03, 0),
                                   (-.04, .02, -.03), (-.05, 0, .02), (-.05, 0, .035)]),
        'Head': vals(idle_frames, [(.06, -.08, -.055), (.04, -.05, -.04), (.07, .03, -.03),
                                   (.02, .08, .01), (.05, -.03, -.035), (.06, -.08, -.055)]),
        'LeftArm': vals(idle_frames, [(1.22, 0, -.10), (1.18, 0, -.12), (1.25, 0, -.08),
                                      (1.21, 0, -.11), (1.19, 0, -.10), (1.22, 0, -.10)]),
        'RightArm': vals(idle_frames, [(1.16, 0, .13), (1.20, 0, .12), (1.14, 0, .14),
                                       (1.19, 0, .12), (1.18, 0, .13), (1.16, 0, .13)]),
        'LeftForeArm': vals(idle_frames, [(.28, 0, -.08), (.25, 0, -.08), (.29, 0, -.07),
                                          (.27, 0, -.08), (.26, 0, -.08), (.28, 0, -.08)]),
        'RightForeArm': vals(idle_frames, [(.24, 0, .08), (.27, 0, .08), (.23, 0, .07),
                                           (.26, 0, .08), (.25, 0, .08), (.24, 0, .08)]),
    }, [(1, (0, 0, 0)), (27, (0, 0, 1.1)), (60, (0, 0, 0))], True)

    gait = [1, 5, 9, 13, 17, 21, 25, 29, 33]
    walk = add_clip(rig, 'TLD_Walk', 33, {
        'Hips': vals(gait, [(0, 0, -.055), (0, .05, -.025), (0, .025, .005),
                            (0, -.02, .025), (0, 0, .055), (0, -.05, .025),
                            (0, -.025, -.005), (0, .02, -.025), (0, 0, -.055)]),
        'Spine02': vals(gait, [(.16, 0, -.09), (.19, 0, -.04), (.16, 0, .015),
                               (.13, 0, .055), (.16, 0, .09), (.19, 0, .04),
                               (.16, 0, -.015), (.13, 0, -.055), (.16, 0, -.09)]),
        'Spine01': vals(gait, [(.09, 0, -.025), (.12, 0, 0), (.10, 0, .025),
                               (.08, 0, 0), (.09, 0, -.025), (.12, 0, 0),
                               (.10, 0, .025), (.08, 0, 0), (.09, 0, -.025)]),
        'Head': vals(gait, [(.05, -.05, -.04), (.03, -.05, -.035), (.08, -.02, 0),
                            (.06, 0, .04), (.05, .05, .04), (.03, .05, .035),
                            (.08, .02, 0), (.06, 0, -.04), (.05, -.05, -.04)]),
        'LeftUpLeg': vals(gait, [(-.42, 0, 0), (-.20, 0, 0), (.12, 0, 0),
                                 (.31, 0, 0), (.42, 0, 0), (.20, 0, 0),
                                 (-.12, 0, 0), (-.31, 0, 0), (-.42, 0, 0)]),
        'RightUpLeg': vals(gait, [(.42, 0, 0), (.20, 0, 0), (-.12, 0, 0),
                                  (-.31, 0, 0), (-.42, 0, 0), (-.20, 0, 0),
                                  (.12, 0, 0), (.31, 0, 0), (.42, 0, 0)]),
        'LeftLeg': vals(gait, [(.10, 0, 0), (.08, 0, 0), (.16, 0, 0), (.34, 0, 0),
                               (.48, 0, 0), (.31, 0, 0), (.12, 0, 0), (.08, 0, 0), (.10, 0, 0)]),
        'RightLeg': vals(gait, [(.48, 0, 0), (.31, 0, 0), (.12, 0, 0), (.08, 0, 0),
                                (.10, 0, 0), (.08, 0, 0), (.16, 0, 0), (.34, 0, 0), (.48, 0, 0)]),
        'LeftFoot': vals(gait, [(-.09, 0, 0), (-.03, 0, 0), (.08, 0, 0), (.13, 0, 0),
                                (.04, 0, 0), (-.02, 0, 0), (-.08, 0, 0), (-.13, 0, 0), (-.09, 0, 0)]),
        'RightFoot': vals(gait, [(.04, 0, 0), (-.02, 0, 0), (-.08, 0, 0), (-.13, 0, 0),
                                 (-.09, 0, 0), (-.03, 0, 0), (.08, 0, 0), (.13, 0, 0), (.04, 0, 0)]),
        'LeftArm': vals(gait, [(1.08, 0, -.08), (1.18, 0, -.10), (1.27, 0, -.10),
                               (1.22, 0, -.09), (1.12, 0, -.08), (1.03, 0, -.07),
                               (.96, 0, -.06), (1.01, 0, -.07), (1.08, 0, -.08)]),
        'RightArm': vals(gait, [(1.02, 0, .11), (.94, 0, .10), (1.01, 0, .11),
                                (1.11, 0, .13), (1.19, 0, .13), (1.27, 0, .14),
                                (1.22, 0, .13), (1.12, 0, .12), (1.02, 0, .11)]),
        'LeftForeArm': vals(gait, [(.31, 0, -.07), (.29, 0, -.06), (.25, 0, -.07),
                                   (.28, 0, -.08), (.31, 0, -.07), (.34, 0, -.07),
                                   (.36, 0, -.07), (.34, 0, -.07), (.31, 0, -.07)]),
        'RightForeArm': vals(gait, [(.35, 0, .08), (.36, 0, .08), (.34, 0, .08),
                                    (.31, 0, .08), (.29, 0, .08), (.25, 0, .08),
                                    (.28, 0, .08), (.32, 0, .08), (.35, 0, .08)]),
    }, [(1, (0, 0, 0)), (5, (0, 0, 1.8)), (9, (0, 0, 0)),
        (13, (0, 0, 1.0)), (17, (0, 0, 0)), (21, (0, 0, 1.8)),
        (25, (0, 0, 0)), (29, (0, 0, 1.0)), (33, (0, 0, 0))], True)

    combat = [1, 5, 10, 16, 20]
    windup = add_clip(rig, 'TLD_Windup', 20, {
        'Hips': vals(combat, [(0, 0, 0), (0, 0, -.06), (0, 0, -.13), (0, 0, -.20), (0, 0, -.20)]),
        'Spine02': vals(combat, [(.08, 0, 0), (.02, -.10, -.07), (-.12, -.17, -.15),
                                 (-.25, -.20, -.24), (-.25, -.20, -.24)]),
        'Spine01': vals(combat, [(.10, 0, 0), (.04, -.05, 0), (-.10, -.08, .04),
                                 (-.18, -.12, .09), (-.18, -.12, .09)]),
        'Head': vals(combat, [(.06, -.08, -.05), (.04, -.10, -.07), (-.04, -.18, -.06),
                              (-.10, -.22, -.03), (-.10, -.22, -.03)]),
        'LeftArm': vals(combat, [(1.22, 0, -.10), (1.04, -.08, .04), (.86, -.18, .25),
                                 (.66, -.22, .36), (.66, -.22, .36)]),
        'RightArm': vals(combat, [(1.16, 0, .13), (1.07, .04, -.02), (.91, .10, -.23),
                                  (.72, .12, -.34), (.72, .12, -.34)]),
        'LeftForeArm': vals(combat, [(.28, 0, -.08), (.10, 0, -.10), (-.27, 0, -.14),
                                     (-.52, 0, -.15), (-.52, 0, -.15)]),
        'RightForeArm': vals(combat, [(.24, 0, .08), (.12, 0, .08), (-.18, 0, .12),
                                      (-.38, 0, .14), (-.38, 0, .14)]),
        'LeftUpLeg': vals(combat, [(0, 0, 0), (-.06, 0, 0), (-.15, 0, 0), (-.21, 0, 0), (-.21, 0, 0)]),
        'RightUpLeg': vals(combat, [(0, 0, 0), (.04, 0, 0), (.12, 0, 0), (.17, 0, 0), (.17, 0, 0)]),
    }, [(1, (0, 0, 0)), (10, (0, 0, -2.5)), (20, (0, 0, -4.0))])

    strike_frames = [1, 4, 7, 10, 14, 19]
    strike = add_clip(rig, 'TLD_Strike', 19, {
        'Spine02': vals(strike_frames, [(-.25, -.20, -.24), (.08, -.08, -.08),
                                        (.27, .04, .04), (.38, .06, .10), (.21, .03, .05), (.08, 0, 0)]),
        'Spine01': vals(strike_frames, [(-.18, -.12, .09), (.06, -.02, .04),
                                        (.28, .09, -.03), (.24, .12, -.08), (.12, .02, 0), (.10, 0, 0)]),
        'Head': vals(strike_frames, [(-.10, -.22, -.03), (-.10, -.22, -.03),
                                     (.02, -.06, .03), (.20, .08, .09), (.11, 0, -.03), (.06, -.08, -.05)]),
        'LeftArm': vals(strike_frames, [(.66, -.22, .36), (.34, -.10, .72),
                                        (.38, 0, 1.00), (.57, .05, 1.13), (1.02, .03, .35), (1.22, 0, -.10)]),
        'RightArm': vals(strike_frames, [(.72, .12, -.34), (.65, .04, -.38),
                                         (.70, 0, -.20), (.43, -.04, -.78), (1.03, 0, -.30), (1.16, 0, .13)]),
        'LeftForeArm': vals(strike_frames, [(-.52, 0, -.15), (-.65, 0, -.14),
                                            (-.65, 0, -.06), (-.48, 0, .03), (.14, 0, -.04), (.28, 0, -.08)]),
        'RightForeArm': vals(strike_frames, [(-.38, 0, .14), (-.42, 0, .13),
                                             (-.28, 0, .06), (-.40, 0, -.04), (.12, 0, .03), (.24, 0, .08)]),
        'LeftUpLeg': vals(strike_frames, [(-.21, 0, 0), (-.25, 0, 0), (-.22, 0, 0),
                                          (-.12, 0, 0), (-.04, 0, 0), (0, 0, 0)]),
        'RightUpLeg': vals(strike_frames, [(.17, 0, 0), (.20, 0, 0), (.14, 0, 0),
                                           (.05, 0, 0), (0, 0, 0), (0, 0, 0)]),
    }, [(1, (0, 0, -4.0)), (4, (0, -2, -2.0)), (7, (0, -5, 0)),
        (10, (0, -6, -.5)), (14, (0, -2, 0)), (19, (0, 0, 0))])

    hit_frames = [1, 3, 6, 10, 18]
    hit = add_clip(rig, 'TLD_Hit', 18, {
        'Spine02': vals(hit_frames, [(.08, 0, 0), (-.12, 0, -.08), (-.32, 0, -.17),
                                     (-.13, 0, -.07), (.08, 0, 0)]),
        'Head': vals(hit_frames, [(.06, -.08, -.05), (.04, -.08, -.05),
                                  (-.28, -.04, -.14), (-.12, -.06, -.09), (.06, -.08, -.05)]),
        'LeftArm': vals(hit_frames, [(1.22, 0, -.10), (1.05, 0, -.20), (.72, 0, -.32),
                                     (.98, 0, -.18), (1.22, 0, -.10)]),
        'RightArm': vals(hit_frames, [(1.16, 0, .13), (1.02, 0, .21), (.80, 0, .31),
                                      (1.00, 0, .19), (1.16, 0, .13)]),
        'LeftForeArm': vals(hit_frames, [(.28, 0, -.08), (.32, 0, -.09), (.42, 0, -.10),
                                         (.32, 0, -.08), (.28, 0, -.08)]),
        'RightForeArm': vals(hit_frames, [(.24, 0, .08), (.30, 0, .08), (.39, 0, .10),
                                          (.30, 0, .08), (.24, 0, .08)]),
    }, [(1, (0, 0, 0)), (6, (0, 1.2, -2.0)), (18, (0, 0, 0))])

    death_frames = [1, 5, 12, 22, 32, 44]
    collapse = add_clip(rig, 'TLD_Collapse', 44, {
        'Spine02': vals(death_frames, [(.08, 0, 0), (.02, 0, -.07), (.40, 0, -.10),
                                       (.92, 0, -.15), (1.38, 0, -.14), (1.47, 0, -.12)]),
        'Spine01': vals(death_frames, [(.10, 0, 0), (.04, 0, .02), (.16, 0, .05),
                                       (.39, 0, .08), (.60, 0, .08), (.67, 0, .08)]),
        'Head': vals(death_frames, [(.06, -.08, -.05), (-.12, -.05, -.09), (.25, 0, -.12),
                                    (.62, 0, -.13), (.85, 0, -.10), (.90, 0, -.10)]),
        'LeftArm': vals(death_frames, [(1.22, 0, -.10), (1.18, 0, -.13), (1.02, 0, .16),
                                      (.75, 0, .41), (.53, 0, .58), (.52, 0, .60)]),
        'RightArm': vals(death_frames, [(1.16, 0, .13), (1.11, 0, .18), (.96, 0, -.12),
                                       (.72, 0, -.33), (.49, 0, -.51), (.47, 0, -.53)]),
        'LeftForeArm': vals(death_frames, [(.28, 0, -.08), (.31, 0, -.08), (.47, 0, -.10),
                                          (.67, 0, -.10), (.79, 0, -.09), (.80, 0, -.09)]),
        'RightForeArm': vals(death_frames, [(.24, 0, .08), (.29, 0, .08), (.44, 0, .10),
                                           (.62, 0, .10), (.74, 0, .08), (.75, 0, .08)]),
        'LeftUpLeg': vals(death_frames, [(0, 0, 0), (-.06, 0, 0), (-.18, 0, 0),
                                        (-.34, 0, 0), (-.48, 0, 0), (-.50, 0, 0)]),
        'RightUpLeg': vals(death_frames, [(0, 0, 0), (.04, 0, 0), (-.10, 0, 0),
                                         (-.26, 0, 0), (-.38, 0, 0), (-.40, 0, 0)]),
        'LeftLeg': vals(death_frames, [(0, 0, 0), (.02, 0, 0), (.13, 0, 0),
                                      (.30, 0, 0), (.53, 0, 0), (.56, 0, 0)]),
        'RightLeg': vals(death_frames, [(0, 0, 0), (.02, 0, 0), (.16, 0, 0),
                                       (.33, 0, 0), (.55, 0, 0), (.58, 0, 0)]),
    }, [(1, (0, 0, 0)), (12, (0, 0, -7)), (22, (0, -4, -23)),
        (32, (0, -9, -47)), (44, (0, -12, -54))])
    return [idle, walk, windup, strike, hit, collapse]


def look_at(obj, target):
    obj.rotation_euler = (target - obj.location).to_track_quat('-Z', 'Y').to_euler()


def render_frames(rig, mesh, actions, directory):
    directory.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    points = [mesh.matrix_world @ Vector(corner) for corner in mesh.bound_box]
    low = Vector((min(v.x for v in points), min(v.y for v in points), min(v.z for v in points)))
    high = Vector((max(v.x for v in points), max(v.y for v in points), max(v.z for v in points)))
    center = (low + high) * .5
    center.z = low.z + (high.z - low.z) * .51
    world = bpy.data.worlds.new('WardenMotionWorld')
    world.color = (.055, .045, .045)
    scene.world = world
    camera_data = bpy.data.cameras.new('WardenMotionCamera')
    camera = bpy.data.objects.new('WardenMotionCamera', camera_data)
    scene.collection.objects.link(camera)
    camera.location = (center.x + 2.2, center.y - 4.4, center.z + .24)
    look_at(camera, center)
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = (high.z - low.z) * 1.32
    scene.camera = camera
    for name, offset, energy, color in [
        ('MotionKey', (-2.5, -2.5, 2.8), 720, (.8, .77, 1.0)),
        ('MotionRim', (2.2, 1.4, 2.3), 600, (1.0, .35, .27)),
    ]:
        light_data = bpy.data.lights.new(name, 'AREA')
        light_data.energy = energy
        light_data.color = color
        light_data.size = 3
        light = bpy.data.objects.new(name, light_data)
        scene.collection.objects.link(light)
        light.location = center + Vector(offset)
        look_at(light, center)
    scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.taa_render_samples = 16
    scene.render.resolution_x = 320
    scene.render.resolution_y = 400
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'Filmic'
    scene.view_settings.look = 'Medium High Contrast'
    scene.view_settings.exposure = -.3
    for track in rig.animation_data.nla_tracks:
        track.mute = True
    samples = [('TLD_Idle', 18), ('TLD_Walk', 1), ('TLD_Walk', 9), ('TLD_Walk', 17),
               ('TLD_Walk', 25), ('TLD_Windup', 10), ('TLD_Windup', 20),
               ('TLD_Strike', 7), ('TLD_Strike', 10), ('TLD_Hit', 6),
               ('TLD_Collapse', 22), ('TLD_Collapse', 44)]
    records = []
    for index, (name, frame) in enumerate(samples):
        rig.animation_data.action = actions[name]
        scene.frame_set(frame)
        filename = '%02d-%s-%02d.png' % (index + 1, name.lower(), frame)
        scene.render.filepath = str(directory / filename)
        bpy.ops.render.render(write_still=True)
        records.append({'clip': name, 'frame': frame, 'file': filename})
    rig.animation_data.action = None
    return records


def main():
    args = arguments()
    source, blend, export = [Path(value).resolve() for value in (args.input, args.blend, args.export)]
    frames, report = Path(args.frames_dir).resolve(), Path(args.report).resolve()
    for path in (blend.parent, export.parent, frames, report.parent):
        path.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    rig = helper.armature_object()
    mesh = next(obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and obj.find_armature() == rig)
    if len(rig.data.bones) != 24:
        raise RuntimeError('Expected the 24-joint Warden rig')
    # The old GLB carries mesh-source empties and a stage cube. Export only the
    # skinned character; recreate animation on its real armature.
    for obj in list(bpy.context.scene.objects):
        if obj not in (rig, mesh):
            bpy.data.objects.remove(obj, do_unlink=True)
    rig.animation_data_clear()
    rig.animation_data_create()
    for old in list(bpy.data.actions):
        bpy.data.actions.remove(old)
    clips = make_clips(rig)
    for action in clips:
        helper.push_to_nla(rig, action)
    bpy.context.scene.render.fps = 24
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 60
    bpy.context.scene['clipNames'] = [action.name for action in clips]
    bpy.context.scene['source'] = str(source)
    rig.animation_data.action = None
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=str(export), export_format='GLB',
                              use_selection=True, export_yup=True,
                              export_animations=True, export_nla_strips=True,
                              export_frame_range=False, export_force_sampling=True,
                              export_materials='EXPORT', export_image_format='AUTO')
    records = render_frames(rig, mesh, {action.name: action for action in clips}, frames)
    payload = {'source': str(source), 'blend': str(blend), 'export': str(export),
               'bones': len(rig.data.bones), 'fps': 24,
               'clips': [{'name': a.name, 'start': 1, 'end': int(a.get('clipEnd')),
                          'loop': bool(a.get('loop'))} for a in clips],
               'samples': records}
    report.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'clips': [a.name for a in clips], 'frames': len(records), 'exportBytes': export.stat().st_size}))


if __name__ == '__main__':
    main()
