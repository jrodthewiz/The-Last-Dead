"""Give new Meshy humanoids a small, inspectable motion library in Blender.

The original high-resolution Meshy rig is preserved in .art-source. This script
creates a new .blend, exports named skinned GLB clips, and renders representative
frames for an offline motion sheet. It never writes to Dogfight.
"""

import argparse
import importlib.util
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


spec = importlib.util.spec_from_file_location(
    "ash_motion_helpers", str(Path(__file__).with_name("afterlife-character-blender.py"))
)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)


def parse_args():
    values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--character", required=True,
                        choices=("ward-attendant", "choir-penitent", "lantern-husk"))
    parser.add_argument("--blend", required=True)
    parser.add_argument("--export", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--frames-dir", required=True)
    return parser.parse_args(values)


def bone(mapping, *names):
    return base.resolve_bone(names, mapping)


def signature_action(armature, mapping, character, prefix):
    spec = {
        "ward-attendant": ("Raise", 28),
        "choir-penitent": ("Invocation", 36),
        "lantern-husk": ("Search", 32),
    }
    suffix, duration = spec[character]
    action = base.action_for(armature, prefix + "_" + suffix, duration)
    spine = bone(mapping, "Spine02", "Spine01", "Spine")
    head = bone(mapping, "Head")
    neck = bone(mapping, "neck", "Neck")
    left = bone(mapping, "LeftArm")
    right = bone(mapping, "RightArm")
    if character == "ward-attendant":
        poses = [(1, 1.10, 1.14, .10, .10), (9, .76, 1.04, .10, .14),
                 (19, .18, .84, -.12, .16), (28, 1.10, 1.14, .10, .10)]
        spine_keys = [(1, (.02, 0, 0)), (9, (-.16, 0, 0)),
                      (19, (-.28, 0, .04)), (28, (.02, 0, 0))]
        head_keys = [(1, (.02, 0, -.04)), (12, (-.08, 0, -.09)),
                     (22, (.19, 0, -.04)), (28, (.02, 0, -.04))]
    elif character == "choir-penitent":
        poses = [(1, 1.08, 1.08, .12, .12), (10, .82, .82, .16, .16),
                 (24, .30, .30, .25, .25), (36, 1.08, 1.08, .12, .12)]
        spine_keys = [(1, (0, 0, 0)), (12, (-.08, 0, 0)),
                      (25, (-.21, 0, 0)), (36, (0, 0, 0))]
        head_keys = [(1, (0, 0, 0)), (15, (-.14, 0, .08)),
                     (27, (-.28, 0, -.08)), (36, (0, 0, 0))]
    else:
        poses = [(1, 1.06, 1.12, .12, .12), (9, .96, 1.00, .16, .10),
                 (21, .62, .92, .18, .10), (32, 1.06, 1.12, .12, .12)]
        spine_keys = [(1, (0, -.10, 0)), (9, (.08, .15, 0)),
                      (21, (.14, -.15, 0)), (32, (0, -.10, 0))]
        head_keys = [(1, (.02, -.34, 0)), (9, (.05, .42, .08)),
                     (21, (.10, -.36, -.07)), (32, (.02, -.34, 0))]
    base.key_relaxed_arms(action, armature, mapping, poses)
    if spine:
        base.key_rotation(action, armature, spine, spine_keys)
    if head:
        base.key_rotation(action, armature, head, head_keys)
    if neck:
        base.key_rotation(action, armature, neck,
                          [(1, (0, 0, 0)), (duration // 2, (.04, 0, 0)),
                           (duration, (0, 0, 0))])
    if left and character == "ward-attendant":
        base.key_rotation(action, armature, left,
                          [(1, (1.10, 0, -.10)), (9, (.76, 0, .24)),
                           (19, (.18, 0, .72)), (28, (1.10, 0, -.10))])
    if right and character == "choir-penitent":
        base.key_rotation(action, armature, right,
                          [(1, (1.08, 0, .10)), (10, (.82, 0, .05)),
                           (24, (.30, 0, .12)), (36, (1.08, 0, .10))])
    base.linearize(action)
    return action


def make_actions(armature, mapping, character, prefix):
    builders = (
        ("Idle", base.make_idle),
        ("Approach", base.make_shuffle),
        ("Strike", base.make_attack_lunge),
        ("Hit", base.make_hit_recoil),
        ("Collapse", base.make_collapse),
    )
    actions = {}
    for suffix, builder in builders:
        action = builder(armature, mapping)
        action.name = prefix + "_" + suffix
        actions[suffix] = action
    actions["Signature"] = signature_action(armature, mapping, character, prefix)
    # A secondary spine track gives each common gait a different body rhythm
    # while the source's six contact/transfer foot poses remain intact.
    lower_spine = bone(mapping, "Spine", "Spine01")
    if lower_spine:
        amplitude = {"ward-attendant": .10, "choir-penitent": .025,
                     "lantern-husk": .065}[character]
        base.key_rotation(actions["Approach"], armature, lower_spine,
                          [(1, (0, 0, -amplitude)), (10, (.025, 0, amplitude)),
                           (19, (0, 0, -amplitude)), (28, (.025, 0, amplitude)),
                           (36, (0, 0, -amplitude))])
    return actions


def bounds():
    points = [obj.matrix_world @ Vector(corner)
              for obj in bpy.context.scene.objects if obj.type == "MESH"
              for corner in obj.bound_box]
    return (Vector((min(v.x for v in points), min(v.y for v in points), min(v.z for v in points))),
            Vector((max(v.x for v in points), max(v.y for v in points), max(v.z for v in points))))


def point_at(obj, target):
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def render_frames(armature, actions, frames_dir):
    frames_dir.mkdir(parents=True, exist_ok=True)
    low, high = bounds()
    center = (low + high) * .5
    world = bpy.context.scene.world or bpy.data.worlds.new("MotionSheetWorld")
    bpy.context.scene.world = world
    world.color = (.055, .065, .075)
    camera_data = bpy.data.cameras.new("MotionSheetCamera")
    camera = bpy.data.objects.new("MotionSheetCamera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (center.x + 2.6, center.y - 4.2, center.z + .25)
    point_at(camera, center)
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = max((high.z - low.z) * 1.27, (high.x - low.x) * 1.06)
    bpy.context.scene.camera = camera
    for name, location, energy, color in (
        ("MotionKey", (center.x - 2.6, center.y - 3, center.z + 2.4), 760, (.74, .82, 1.0)),
        ("MotionFill", (center.x + 2, center.y + 1, center.z + .8), 390, (1.0, .67, .51)),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.color = color
        data.size = 3.0
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.location = location
        point_at(obj, center)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 16
    scene.render.resolution_x = 320
    scene.render.resolution_y = 400
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = -.35
    for track in armature.animation_data.nla_tracks:
        track.mute = True
    samples = [("Idle", 18), ("Approach", 4), ("Approach", 10),
               ("Approach", 16), ("Signature", 12), ("Signature", 24),
               ("Strike", 8), ("Strike", 11), ("Hit", 6),
               ("Collapse", 28)]
    records = []
    for index, (kind, frame) in enumerate(samples):
        armature.animation_data.action = actions[kind]
        scene.frame_set(frame)
        filename = "%02d-%s-%02d.png" % (index + 1, kind.lower(), frame)
        scene.render.filepath = str(frames_dir / filename)
        bpy.ops.render.render(write_still=True)
        records.append({"kind": kind, "frame": frame, "file": filename})
    armature.animation_data.action = None
    for track in armature.animation_data.nla_tracks:
        track.mute = False
    return records


def main():
    args = parse_args()
    source = Path(args.input).resolve()
    blend = Path(args.blend).resolve()
    export = Path(args.export).resolve()
    report = Path(args.report).resolve()
    frames_dir = Path(args.frames_dir).resolve()
    for parent in (blend.parent, export.parent, report.parent, frames_dir):
        parent.mkdir(parents=True, exist_ok=True)
    base.clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(source))
    armature = base.armature_object()
    mapping = base.bone_name_map(armature)
    required = ("Hips", "Spine", "Head", "LeftArm", "RightArm",
                "LeftUpLeg", "RightUpLeg")
    missing = [name for name in required if not bone(mapping, name)]
    if missing:
        raise RuntimeError("Rig is missing essential bones: " + ", ".join(missing))
    prefix = "".join(word.title() for word in args.character.split("-"))
    armature.name = prefix + "_Rig"
    actions = make_actions(armature, mapping, args.character, prefix)
    armature.animation_data_clear()
    armature.animation_data_create()
    for action in actions.values():
        base.push_to_nla(armature, action)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 58
    bpy.context.scene["afterlifeCharacter"] = prefix
    bpy.context.scene["source"] = "Dogfight Meshy source + rig; Blender motion"
    bpy.context.scene["clipNames"] = [action.name for action in actions.values()]
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    bpy.ops.export_scene.gltf(
        filepath=str(export), export_format="GLB", export_yup=True,
        export_apply=False, export_animations=True, export_nla_strips=True,
        export_frame_range=False, export_force_sampling=True,
        export_materials="EXPORT", export_image_format="AUTO",
    )
    samples = render_frames(armature, actions, frames_dir)
    payload = {
        "character": args.character, "source": str(source),
        "blend": str(blend), "export": str(export), "bones": sorted(mapping.values()),
        "clips": [{"kind": kind, "name": action.name,
                   "start": int(action.get("clipStart", 1)),
                   "end": int(action.get("clipEnd", 1)),
                   "loop": bool(action.get("loop", False))}
                  for kind, action in actions.items()],
        "samples": samples,
    }
    report.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf8")
    print(json.dumps({"character": args.character, "boneCount": len(mapping),
                      "clips": [action.name for action in actions.values()],
                      "samples": len(samples)}))


if __name__ == "__main__":
    main()
