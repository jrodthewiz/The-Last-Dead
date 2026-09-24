"""Author the Ash Witness Dread v02 animation clips in a fresh Blender scene.

This script is intentionally self-contained and headless-friendly. It imports one
Meshy rigged GLB, authors a compact zombie gait plus attack/recoil actions, pushes
them to NLA tracks for glTF export, and saves a dedicated .blend source plus an
uncompressed GLB export. The follow-up package script applies texture/geometry
compression.
"""

import argparse
import json
import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Quaternion, Vector


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--blend", required=True)
    parser.add_argument("--export", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(argv)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def armature_object():
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if not armatures:
        raise RuntimeError("Meshy GLB did not contain an armature")
    return armatures[0]


def bone_name_map(armature):
    return {bone.name.lower(): bone.name for bone in armature.data.bones}


def resolve_bone(names, mapping):
    for name in names:
        exact = mapping.get(name.lower())
        if exact:
            return exact
    return None


def pose_bone(armature, names, mapping):
    name = resolve_bone(names, mapping)
    return armature.pose.bones.get(name) if name else None


def action_for(armature, name, end_frame, loop=False):
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    action["clipStart"] = 1
    action["clipEnd"] = end_frame
    action["loop"] = bool(loop)
    return action


def quat_from_euler(values):
    return Quaternion(Euler(values, "XYZ"))


def fcurves_for(action, path, count):
    """Return one stable channel per component without creating duplicates."""
    channels = []
    for index in range(count):
        channel = action.fcurves.find(path, index=index)
        if channel is None:
            channel = action.fcurves.new(data_path=path, index=index)
        channels.append(channel)
    return channels


def key_rotation(action, armature, bone_name, frame_values):
    bone = armature.pose.bones.get(bone_name)
    if not bone:
        return False
    if bone.rotation_mode == "QUATERNION":
        path = 'pose.bones["%s"].rotation_quaternion' % bone_name
        channels = fcurves_for(action, path, 4)
        for frame, euler_values in frame_values:
            quaternion = quat_from_euler(euler_values)
            for index, value in enumerate(quaternion):
                channels[index].keyframe_points.insert(frame, value, options={"FAST"})
    else:
        path = 'pose.bones["%s"].rotation_euler' % bone_name
        channels = fcurves_for(action, path, 3)
        for frame, euler_values in frame_values:
            for index, value in enumerate(euler_values):
                channels[index].keyframe_points.insert(frame, value, options={"FAST"})
    return True


def key_location(action, armature, bone_name, frame_values):
    if not armature.pose.bones.get(bone_name):
        return False
    path = 'pose.bones["%s"].location' % bone_name
    channels = fcurves_for(action, path, 3)
    for frame, location in frame_values:
        for index, value in enumerate(location):
            channels[index].keyframe_points.insert(frame, value, options={"FAST"})
    return True


def key_relaxed_arms(action, armature, mapping, poses):
    """Keep the imported T-pose source readable as a dead human in every clip.

    Meshy's bind pose is an intentional T-pose, so every authored runtime clip
    must key the upper-arm and forearm rotations. The local X axis is the arm
    drop axis for this rig: about 65 degrees lowers the upper arm, while a
    small forearm bend keeps the wrist outside the torso.
    """
    left_arm = resolve_bone(["LeftArm", "LeftUpperArm"], mapping)
    right_arm = resolve_bone(["RightArm", "RightUpperArm"], mapping)
    left_forearm = resolve_bone(["LeftForeArm", "LeftLowerArm"], mapping)
    right_forearm = resolve_bone(["RightForeArm", "RightLowerArm"], mapping)
    if left_arm:
        key_rotation(action, armature, left_arm, [(frame, (left_upper, 0.0, 0.0)) for frame, left_upper, _right_upper, _left_elbow, _right_elbow in poses])
    if right_arm:
        key_rotation(action, armature, right_arm, [(frame, (right_upper, 0.0, 0.0)) for frame, _left_upper, right_upper, _left_elbow, _right_elbow in poses])
    if left_forearm:
        key_rotation(action, armature, left_forearm, [(frame, (left_elbow, 0.0, 0.0)) for frame, _left_upper, _right_upper, left_elbow, _right_elbow in poses])
    if right_forearm:
        key_rotation(action, armature, right_forearm, [(frame, (right_elbow, 0.0, 0.0)) for frame, _left_upper, _right_upper, _left_elbow, right_elbow in poses])


def linearize(action):
    for curve in action.fcurves:
        for point in curve.keyframe_points:
            point.interpolation = "BEZIER"


def make_idle(armature, mapping):
    action = action_for(armature, "AshWitness_Idle", 58, loop=True)
    spine = resolve_bone(["Spine02", "Spine01", "Spine"], mapping)
    neck = resolve_bone(["neck", "Neck"], mapping)
    head = resolve_bone(["Head", "head"], mapping)
    key_relaxed_arms(action, armature, mapping, [
        (1, 1.12, 1.12, 0.10, 0.10),
        (15, 1.16, 1.08, 0.12, 0.08),
        (29, 1.10, 1.14, 0.08, 0.12),
        (43, 1.15, 1.09, 0.11, 0.09),
        (58, 1.12, 1.12, 0.10, 0.10),
    ])
    if spine:
        key_rotation(action, armature, spine, [(1, (0.0, 0.0, -0.008)), (15, (0.025, 0.0, 0.0)), (29, (0.0, 0.0, 0.008)), (43, (-0.018, 0.0, 0.0)), (58, (0.0, 0.0, -0.008))])
    if neck:
        key_rotation(action, armature, neck, [(1, (0.0, 0.0, 0.045)), (29, (0.012, 0.0, -0.01)), (58, (0.0, 0.0, 0.045))])
    if head:
        key_rotation(action, armature, head, [(1, (0.0, 0.0, -0.05)), (19, (0.016, 0.012, -0.075)), (38, (-0.01, -0.01, -0.03)), (58, (0.0, 0.0, -0.05))])
    linearize(action)
    return action


def make_shuffle(armature, mapping):
    action = action_for(armature, "AshWitness_Shuffle", 36, loop=True)
    hips = resolve_bone(["Hips", "hips"], mapping)
    spine = resolve_bone(["Spine02", "Spine01", "Spine"], mapping)
    left_leg = resolve_bone(["LeftUpLeg", "LeftThigh"], mapping)
    right_leg = resolve_bone(["RightUpLeg", "RightThigh"], mapping)
    left_knee = resolve_bone(["LeftLeg", "LeftShin"], mapping)
    right_knee = resolve_bone(["RightLeg", "RightShin"], mapping)
    left_foot = resolve_bone(["LeftFoot"], mapping)
    right_foot = resolve_bone(["RightFoot"], mapping)
    left_shoulder = resolve_bone(["LeftShoulder"], mapping)
    right_shoulder = resolve_bone(["RightShoulder"], mapping)
    neck = resolve_bone(["neck", "Neck"], mapping)
    head = resolve_bone(["Head", "head"], mapping)
    # Six readable contact/passing poses: one foot reaches while the other
    # supports, the pelvis carries weight laterally, and the head follows late.
    # The first and last poses match so the clip loops without a pop.
    key_relaxed_arms(action, armature, mapping, [
        (1, 1.08, 1.22, 0.08, 0.18),
        (7, 1.17, 1.06, 0.15, 0.08),
        (13, 1.02, 1.18, 0.06, 0.16),
        (19, 1.15, 1.04, 0.14, 0.06),
        (25, 1.04, 1.20, 0.07, 0.17),
        (31, 1.16, 1.05, 0.14, 0.07),
        (36, 1.08, 1.22, 0.08, 0.18),
    ])
    if hips:
        key_location(action, armature, hips, [
            (1, (-0.035, 0.0, 0.0)), (7, (0.018, 0.0, 0.022)),
            (13, (0.042, 0.0, -0.012)), (19, (-0.018, 0.0, 0.022)),
            (25, (-0.044, 0.0, -0.012)), (31, (0.012, 0.0, 0.022)),
            (36, (-0.035, 0.0, 0.0)),
        ])
    if spine:
        key_rotation(action, armature, spine, [
            (1, (0.08, 0.0, -0.04)), (7, (0.13, 0.0, 0.02)),
            (13, (0.05, 0.0, 0.05)), (19, (0.14, 0.0, 0.01)),
            (25, (0.04, 0.0, -0.05)), (31, (0.12, 0.0, -0.01)),
            (36, (0.08, 0.0, -0.04)),
        ])
    if left_leg:
        key_rotation(action, armature, left_leg, [
            (1, (-0.28, 0.0, 0.0)), (7, (-0.10, 0.0, 0.0)),
            (13, (0.18, 0.0, 0.0)), (19, (0.28, 0.0, 0.0)),
            (25, (0.06, 0.0, 0.0)), (31, (-0.18, 0.0, 0.0)),
            (36, (-0.28, 0.0, 0.0)),
        ])
    if right_leg:
        key_rotation(action, armature, right_leg, [
            (1, (0.20, 0.0, 0.0)), (7, (0.05, 0.0, 0.0)),
            (13, (-0.20, 0.0, 0.0)), (19, (-0.28, 0.0, 0.0)),
            (25, (-0.02, 0.0, 0.0)), (31, (0.18, 0.0, 0.0)),
            (36, (0.20, 0.0, 0.0)),
        ])
    if left_knee:
        key_rotation(action, armature, left_knee, [
            (1, (0.16, 0.0, 0.0)), (7, (0.08, 0.0, 0.0)),
            (13, (0.04, 0.0, 0.0)), (19, (0.18, 0.0, 0.0)),
            (25, (0.10, 0.0, 0.0)), (31, (0.04, 0.0, 0.0)),
            (36, (0.16, 0.0, 0.0)),
        ])
    if right_knee:
        key_rotation(action, armature, right_knee, [
            (1, (0.06, 0.0, 0.0)), (7, (0.12, 0.0, 0.0)),
            (13, (0.20, 0.0, 0.0)), (19, (0.08, 0.0, 0.0)),
            (25, (0.14, 0.0, 0.0)), (31, (0.20, 0.0, 0.0)),
            (36, (0.06, 0.0, 0.0)),
        ])
    if left_foot:
        key_rotation(action, armature, left_foot, [(1, (-0.04, 0.0, 0.0)), (7, (-0.02, 0.0, 0.0)), (13, (0.02, 0.0, 0.0)), (19, (0.04, 0.0, 0.0)), (25, (0.0, 0.0, 0.0)), (31, (-0.02, 0.0, 0.0)), (36, (-0.04, 0.0, 0.0))])
    if right_foot:
        key_rotation(action, armature, right_foot, [(1, (0.02, 0.0, 0.0)), (7, (0.0, 0.0, 0.0)), (13, (-0.04, 0.0, 0.0)), (19, (-0.02, 0.0, 0.0)), (25, (0.02, 0.0, 0.0)), (31, (0.04, 0.0, 0.0)), (36, (0.02, 0.0, 0.0))])
    if left_shoulder:
        key_rotation(action, armature, left_shoulder, [(1, (0.0, 0.0, -0.10)), (7, (0.02, 0.0, -0.16)), (13, (0.0, 0.0, -0.06)), (19, (0.02, 0.0, -0.14)), (25, (0.0, 0.0, -0.05)), (31, (0.02, 0.0, -0.12)), (36, (0.0, 0.0, -0.10))])
    if right_shoulder:
        key_rotation(action, armature, right_shoulder, [(1, (0.0, 0.0, 0.08)), (7, (0.0, 0.0, 0.13)), (13, (0.02, 0.0, 0.05)), (19, (0.0, 0.0, 0.12)), (25, (0.02, 0.0, 0.04)), (31, (0.0, 0.0, 0.10)), (36, (0.0, 0.0, 0.08))])
    if neck:
        key_rotation(action, armature, neck, [(1, (0.06, 0.0, -0.05)), (7, (0.03, 0.0, -0.02)), (13, (0.10, 0.0, 0.03)), (19, (0.04, 0.0, 0.06)), (25, (0.11, 0.0, 0.02)), (31, (0.05, 0.0, -0.01)), (36, (0.06, 0.0, -0.05))])
    if head:
        # The head reaches each new weight shift one pose late.
        key_rotation(action, armature, head, [(1, (0.02, 0.0, -0.08)), (7, (0.01, 0.0, -0.05)), (13, (0.08, 0.02, 0.01)), (19, (0.02, 0.01, 0.08)), (25, (0.09, -0.01, 0.04)), (31, (0.03, 0.0, -0.02)), (36, (0.02, 0.0, -0.08))])
    linearize(action)
    return action


def make_attack_lunge(armature, mapping):
    """A short in-place melee lunge whose contact lands near the engine strike."""
    action = action_for(armature, "AshWitness_AttackLunge", 20, loop=False)
    hips = resolve_bone(["Hips", "hips"], mapping)
    spine = resolve_bone(["Spine02", "Spine01", "Spine"], mapping)
    neck = resolve_bone(["neck", "Neck"], mapping)
    head = resolve_bone(["Head", "head"], mapping)
    left_arm = resolve_bone(["LeftArm", "LeftUpperArm"], mapping)
    right_arm = resolve_bone(["RightArm", "RightUpperArm"], mapping)
    left_forearm = resolve_bone(["LeftForeArm", "LeftLowerArm"], mapping)
    right_forearm = resolve_bone(["RightForeArm", "RightLowerArm"], mapping)
    left_leg = resolve_bone(["LeftUpLeg", "LeftThigh"], mapping)
    right_leg = resolve_bone(["RightUpLeg", "RightThigh"], mapping)
    if hips:
        # The imported rig is scaled .01 in Blender. These small forward/up
        # translations therefore read as a restrained bodyweight transfer in
        # the normalized runtime model instead of a visible root teleport.
        key_location(action, armature, hips, [(1, (0.0, 0.0, 0.0)), (4, (0.0, -1.5, 0.45)), (8, (0.0, -4.0, 1.0)), (11, (0.0, -6.0, 1.35)), (15, (0.0, -2.0, 0.4)), (20, (0.0, 0.0, 0.0))])
    if spine:
        # Positive local X on Spine02 leans this rig's chest toward its -Y
        # facing direction. The head and neck intentionally lag this beat.
        key_rotation(action, armature, spine, [(1, (0.04, 0.0, 0.0)), (4, (-0.14, 0.0, -0.02)), (8, (0.38, 0.0, 0.04)), (11, (0.72, 0.0, 0.10)), (15, (0.34, 0.0, 0.05)), (20, (0.04, 0.0, 0.0))])
    if neck:
        key_rotation(action, armature, neck, [(1, (0.04, 0.0, 0.0)), (4, (0.02, 0.0, -0.03)), (8, (0.10, 0.0, 0.04)), (11, (0.25, 0.0, 0.08)), (15, (0.18, 0.0, 0.04)), (20, (0.04, 0.0, 0.0))])
    if head:
        # Delay the head turn until after the arm reaches, then settle to the
        # same restrained cant used by idle.
        key_rotation(action, armature, head, [(1, (0.02, 0.0, -0.06)), (4, (0.02, 0.0, -0.08)), (8, (0.04, 0.0, 0.02)), (11, (0.07, 0.0, 0.04)), (15, (0.22, 0.0, -0.12)), (20, (0.02, 0.0, -0.06))])
    if left_arm:
        # Rig probe evidence: Blender -Y is forward. A positive local-Z roll
        # plus a negative forearm-X bend puts the left wrist forward at chest
        # height; the previous negative-Z values only spread the arms.
        key_rotation(action, armature, left_arm, [(1, (1.10, 0.0, -0.10)), (4, (0.98, 0.0, 0.18)), (8, (0.66, 0.0, 0.82)), (11, (0.22, 0.0, 1.25)), (15, (0.52, 0.0, 0.88)), (20, (1.10, 0.0, -0.10))])
    if right_arm:
        # Counterbalance stays soft and low instead of opening into a second
        # sideways reach.
        key_rotation(action, armature, right_arm, [(1, (1.14, 0.0, 0.10)), (4, (1.08, 0.0, 0.12)), (8, (1.08, 0.0, 0.16)), (11, (1.10, 0.0, 0.12)), (15, (1.12, 0.0, 0.10)), (20, (1.14, 0.0, 0.10))])
    if left_forearm:
        key_rotation(action, armature, left_forearm, [(1, (0.10, 0.0, 0.0)), (4, (0.12, 0.0, 0.0)), (8, (-0.04, 0.0, 0.0)), (11, (-0.40, 0.0, 0.0)), (15, (-0.16, 0.0, 0.0)), (20, (0.10, 0.0, 0.0))])
    if right_forearm:
        key_rotation(action, armature, right_forearm, [(1, (0.10, 0.0, 0.0)), (4, (0.14, 0.0, 0.0)), (8, (0.16, 0.0, 0.0)), (11, (0.18, 0.0, 0.0)), (15, (0.14, 0.0, 0.0)), (20, (0.10, 0.0, 0.0))])
    if left_leg:
        key_rotation(action, armature, left_leg, [(1, (0.0, 0.0, 0.0)), (4, (-0.12, 0.0, 0.0)), (8, (-0.30, 0.0, 0.0)), (11, (-0.20, 0.0, 0.0)), (15, (-0.08, 0.0, 0.0)), (20, (0.0, 0.0, 0.0))])
    if right_leg:
        key_rotation(action, armature, right_leg, [(1, (0.0, 0.0, 0.0)), (4, (0.10, 0.0, 0.0)), (8, (0.24, 0.0, 0.0)), (11, (0.18, 0.0, 0.0)), (15, (0.06, 0.0, 0.0)), (20, (0.0, 0.0, 0.0))])
    linearize(action)
    return action


def make_hit_recoil(armature, mapping):
    """A compact readable hit response, leaving collision and flash timing to the engine."""
    action = action_for(armature, "AshWitness_HitRecoil", 14, loop=False)
    hips = resolve_bone(["Hips", "hips"], mapping)
    spine = resolve_bone(["Spine02", "Spine01", "Spine"], mapping)
    neck = resolve_bone(["neck", "Neck"], mapping)
    head = resolve_bone(["Head", "head"], mapping)
    left_arm = resolve_bone(["LeftArm", "LeftUpperArm"], mapping)
    right_arm = resolve_bone(["RightArm", "RightUpperArm"], mapping)
    left_forearm = resolve_bone(["LeftForeArm", "LeftLowerArm"], mapping)
    right_forearm = resolve_bone(["RightForeArm", "RightLowerArm"], mapping)
    if hips:
        key_location(action, armature, hips, [(1, (0.0, 0.0, 0.0)), (3, (0.0, -0.07, 0.02)), (6, (0.0, -0.11, 0.04)), (9, (0.0, -0.04, 0.01)), (14, (0.0, 0.0, 0.0))])
    if spine:
        key_rotation(action, armature, spine, [(1, (0.06, 0.0, 0.0)), (3, (-0.14, 0.0, -0.05)), (6, (-0.28, 0.0, -0.10)), (9, (-0.12, 0.0, -0.04)), (14, (0.06, 0.0, 0.0))])
    if neck:
        key_rotation(action, armature, neck, [(1, (0.04, 0.0, 0.0)), (3, (0.03, 0.0, -0.02)), (6, (-0.12, 0.0, -0.08)), (9, (-0.08, 0.0, -0.03)), (14, (0.04, 0.0, 0.0))])
    if head:
        key_rotation(action, armature, head, [(1, (0.02, 0.0, -0.05)), (3, (0.0, 0.0, -0.08)), (6, (-0.18, 0.0, -0.13)), (9, (-0.11, 0.0, -0.05)), (14, (0.02, 0.0, -0.05))])
    if left_arm:
        key_rotation(action, armature, left_arm, [(1, (1.10, 0.0, -0.10)), (3, (0.94, 0.0, -0.16)), (6, (0.78, 0.0, -0.22)), (9, (0.96, 0.0, -0.16)), (14, (1.10, 0.0, -0.10))])
    if right_arm:
        key_rotation(action, armature, right_arm, [(1, (1.14, 0.0, 0.10)), (3, (1.00, 0.0, 0.16)), (6, (0.88, 0.0, 0.22)), (9, (1.02, 0.0, 0.15)), (14, (1.14, 0.0, 0.10))])
    if left_forearm:
        key_rotation(action, armature, left_forearm, [(1, (0.10, 0.0, 0.0)), (3, (0.16, 0.0, 0.0)), (6, (0.24, 0.0, 0.0)), (9, (0.16, 0.0, 0.0)), (14, (0.10, 0.0, 0.0))])
    if right_forearm:
        key_rotation(action, armature, right_forearm, [(1, (0.10, 0.0, 0.0)), (3, (0.14, 0.0, 0.0)), (6, (0.22, 0.0, 0.0)), (9, (0.14, 0.0, 0.0)), (14, (0.10, 0.0, 0.0))])
    linearize(action)
    return action


def make_collapse(armature, mapping):
    action = action_for(armature, "AshWitness_Collapse", 44, loop=False)
    hips = resolve_bone(["Hips", "hips"], mapping)
    spine = resolve_bone(["Spine02", "Spine01", "Spine"], mapping)
    neck = resolve_bone(["neck", "Neck"], mapping)
    head = resolve_bone(["Head", "head"], mapping)
    left_leg = resolve_bone(["LeftUpLeg", "LeftThigh"], mapping)
    right_leg = resolve_bone(["RightUpLeg", "RightThigh"], mapping)
    key_relaxed_arms(action, armature, mapping, [
        (1, 1.12, 1.12, 0.10, 0.10),
        (12, 1.10, 1.14, 0.10, 0.11),
        (28, 1.04, 1.08, 0.18, 0.18),
        (44, 0.96, 1.02, 0.24, 0.24),
    ])
    if hips:
        key_location(action, armature, hips, [(1, (0.0, 0.0, 0.0)), (12, (0.0, -0.02, 0.0)), (28, (0.0, -0.22, 0.04)), (44, (0.0, -0.38, 0.11))])
    if spine:
        key_rotation(action, armature, spine, [(1, (0.0, 0.0, 0.0)), (12, (0.18, 0.0, 0.0)), (28, (0.72, 0.0, 0.04)), (44, (1.35, 0.0, 0.08))])
    if neck:
        key_rotation(action, armature, neck, [(1, (0.0, 0.0, 0.0)), (18, (0.18, 0.0, 0.0)), (44, (0.62, 0.0, -0.14))])
    if head:
        key_rotation(action, armature, head, [(1, (0.0, 0.0, 0.0)), (18, (0.26, 0.0, 0.05)), (44, (0.92, 0.0, -0.22))])
    if left_leg:
        key_rotation(action, armature, left_leg, [(1, (0.0, 0.0, 0.0)), (20, (-0.05, 0.0, 0.0)), (44, (-0.38, 0.0, 0.0))])
    if right_leg:
        key_rotation(action, armature, right_leg, [(1, (0.0, 0.0, 0.0)), (20, (0.08, 0.0, 0.0)), (44, (-0.26, 0.0, 0.0))])
    linearize(action)
    return action


def push_to_nla(armature, action):
    track = armature.animation_data.nla_tracks.new()
    track.name = action.name
    start = int(action.get("clipStart", 1))
    end = int(action.get("clipEnd", 1))
    strip = track.strips.new(action.name, start, action)
    strip.action_frame_start = start
    strip.action_frame_end = end
    strip.frame_start = start
    strip.frame_end = end
    strip.extrapolation = "NOTHING"
    strip.blend_type = "REPLACE"
    strip.use_auto_blend = False
    return track


def configure_materials():
    for material in bpy.data.materials:
        material.name = "Afterlife_" + material.name[:52]


def main():
    args = parse_args()
    input_path = Path(args.input).resolve()
    blend_path = Path(args.blend).resolve()
    export_path = Path(args.export).resolve()
    report_path = Path(args.report).resolve()
    blend_path.parent.mkdir(parents=True, exist_ok=True)
    export_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    if not input_path.is_file():
        raise FileNotFoundError(input_path)

    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(input_path))
    armature = armature_object()
    armature.name = "AshWitness_Rig"
    armature.data.name = "AshWitness_Skeleton"
    mapping = bone_name_map(armature)
    actions = [
        make_idle(armature, mapping),
        make_shuffle(armature, mapping),
        make_attack_lunge(armature, mapping),
        make_hit_recoil(armature, mapping),
        make_collapse(armature, mapping),
    ]
    armature.animation_data_clear()
    armature.animation_data_create()
    for action in actions:
        push_to_nla(armature, action)
    configure_materials()
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 58
    bpy.context.scene.render.engine = "BLENDER_EEVEE"
    bpy.context.scene.render.resolution_x = 640
    bpy.context.scene.render.resolution_y = 640
    bpy.context.scene.render.resolution_percentage = 50
    bpy.context.scene["afterlifeCharacter"] = "Ash Witness"
    bpy.context.scene["meshSource"] = "Meshy multi-image-to-3d + Meshy rigging"
    bpy.context.scene["animationSource"] = "Blender-authored Dread v02 gait, lunge, recoil, and collapse clips"
    bpy.context.scene["clipNames"] = [action.name for action in actions]
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    bpy.ops.export_scene.gltf(
        filepath=str(export_path),
        export_format="GLB",
        export_yup=True,
        export_apply=False,
        export_animations=True,
        export_nla_strips=True,
        export_frame_range=False,
        export_force_sampling=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
    )
    report = {
        "character": "Ash Witness",
        "input": str(input_path),
        "blend": str(blend_path),
        "export": str(export_path),
        "source": "Meshy multi-image-to-3d + Meshy rigging",
        "animationSource": "Blender-authored Dread v02 gait, lunge, recoil, and collapse clips",
        "bones": sorted(mapping.values()),
        "boneCount": len(mapping),
        "clips": [{"name": action.name, "frameStart": int(action.get("clipStart", 1)), "frameEnd": int(action.get("clipEnd", 1)), "loop": bool(action.get("loop", False))} for action in actions],
        "notes": [
            "Idle uses a 2.4 second breathing cycle with a restrained head cant.",
            "Shuffle uses six contact/transfer/passing poses with delayed head and asymmetrical arms.",
            "AttackLunge transfers the hips forward, reaches the left hand along the rig-probed -Y facing axis, delays the head, and recovers near the engine's 0.28 second melee strike.",
            "HitRecoil uses a short backstep response for enemy flash/stagger events.",
            "Collapse uses a 1.8 second forward fold with knees and arms softening.",
            "This export is intentionally pre-compression; the package step owns runtime size reduction.",
        ],
    }
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
