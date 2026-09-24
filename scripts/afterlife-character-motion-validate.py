"""Sample authored Ash Witness clips in Blender and report motion gates.

This is a small asset QA pass rather than a renderer test. It evaluates each
NLA-authored action directly, measures actual foot-bone paths in armature world
space, and reports pose deltas for the attack and hit one-shots.
"""

import argparse
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args():
    argv = __import__("sys").argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--blend", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(argv)


def distance(a, b):
    return (a - b).length


def midpoint(bone):
    return (bone.head + bone.tail) * .5


def main():
    args = parse_args()
    blend_path = Path(args.blend).resolve()
    report_path = Path(args.report).resolve()
    bpy.ops.wm.open_mainfile(filepath=str(blend_path))
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if not armatures:
        raise RuntimeError("no armature in blend")
    armature = armatures[0]
    mapping = {bone.name.lower(): bone.name for bone in armature.data.bones}

    def find(*names):
        for name in names:
            if name.lower() in mapping:
                return mapping[name.lower()]
        return None

    left_foot = find("LeftFoot")
    right_foot = find("RightFoot")
    hips = find("Hips", "hips")
    spine = find("Spine02", "Spine01", "Spine")
    head = find("Head", "head")
    required = {"leftFoot": left_foot, "rightFoot": right_foot, "hips": hips, "spine": spine, "head": head}
    if not all(required.values()):
        raise RuntimeError("missing expected bones: %s" % required)

    fps = bpy.context.scene.render.fps / max(.001, bpy.context.scene.render.fps_base)
    actions = {action.name: action for action in bpy.data.actions if action.name.startswith("AshWitness_")}
    expected = [
        "AshWitness_Idle", "AshWitness_Shuffle", "AshWitness_AttackLunge",
        "AshWitness_HitRecoil", "AshWitness_Collapse",
    ]
    missing = [name for name in expected if name not in actions]
    if missing:
        raise RuntimeError("missing clips: %s" % missing)

    # Disable NLA evaluation while sampling each source action directly. The
    # loaded file is disposable, so this does not alter the authored source.
    if armature.animation_data:
        for track in armature.animation_data.nla_tracks:
            track.mute = True
    if not armature.animation_data:
        armature.animation_data_create()

    def point(name):
        pose = armature.pose.bones[name]
        return armature.matrix_world @ midpoint(pose)

    def sample(action, seconds):
        armature.animation_data.action = action
        frame = action.get("clipStart", 1) + seconds * fps
        bpy.context.scene.frame_set(int(round(frame)))
        bpy.context.view_layer.update()
        return {
            "leftFoot": list(point(left_foot)),
            "rightFoot": list(point(right_foot)),
            "hips": list(point(hips)),
            "spineRotation": armature.pose.bones[spine].rotation_quaternion.angle if armature.pose.bones[spine].rotation_mode == "QUATERNION" else armature.pose.bones[spine].rotation_euler.length,
            "head": list(point(head)),
        }

    def vec(values):
        return Vector(values)

    def path_length(samples, key):
        points = [vec(sample[key]) for sample in samples]
        return sum(distance(a, b) for a, b in zip(points, points[1:]))

    def max_range(samples, key):
        points = [vec(sample[key]) for sample in samples]
        return max((distance(a, b) for a in points for b in points), default=0.0)

    def scalar_range(samples, key):
        values = [float(sample[key]) for sample in samples]
        return max(values, default=0.0) - min(values, default=0.0)

    clip_report = {}
    for name in expected:
        action = actions[name]
        start = float(action.get("clipStart", 1))
        end = float(action.get("clipEnd", start))
        sample_duration = max(.001, (end - start) / fps)
        # glTF's exported clip duration includes the final keyed frame, so its
        # runtime duration is end/fps (1.5s for the 1..36 gait action).
        duration = max(.001, end / fps)
        count = 13 if name == "AshWitness_Shuffle" else 9
        times = [sample_duration * index / (count - 1) for index in range(count)]
        samples = [sample(action, seconds) for seconds in times]
        clip_report[name] = {
            "durationSeconds": round(duration, 6),
            "sampleSpanSeconds": round(sample_duration, 6),
            "sampleSeconds": [round(seconds, 6) for seconds in times],
            "footPathMeters": {
                "left": round(path_length(samples, "leftFoot"), 6),
                "right": round(path_length(samples, "rightFoot"), 6),
            },
            "footRangeMeters": {
                "left": round(max_range(samples, "leftFoot"), 6),
                "right": round(max_range(samples, "rightFoot"), 6),
            },
            "hipsRangeMeters": round(max_range(samples, "hips"), 6),
            "spineRotationRangeRadians": round(scalar_range(samples, "spineRotation"), 6),
            "headRangeMeters": round(max_range(samples, "head"), 6),
        }

    shuffle = clip_report["AshWitness_Shuffle"]
    attack = clip_report["AshWitness_AttackLunge"]
    hit = clip_report["AshWitness_HitRecoil"]
    report = {
        "ok": (
            shuffle["footPathMeters"]["left"] > .001
            and shuffle["footPathMeters"]["right"] > .001
            and attack["spineRotationRangeRadians"] > .1
            and attack["headRangeMeters"] > .02
            and hit["headRangeMeters"] > .02
        ),
        "blend": str(blend_path),
        "fps": fps,
        "bones": required,
        "clips": clip_report,
        "gates": {
            "shuffleHasFootTransfer": shuffle["footPathMeters"]["left"] > .001 and shuffle["footPathMeters"]["right"] > .001,
            "attackHasBodyweightMotion": attack["spineRotationRangeRadians"] > .1,
            "attackHasDelayedHeadCue": attack["headRangeMeters"] > .02,
            "hitHasRecoil": hit["headRangeMeters"] > .02,
        },
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
    print(json.dumps(report, indent=2))
    if not report["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
