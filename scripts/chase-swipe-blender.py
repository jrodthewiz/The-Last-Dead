"""Author a chase and cross-body swipe on the preserved Ash Witness rig.

Blender 2.93, background-safe. Reuses the v02 mesh and its idle/hit/death clips;
exports a separate source so another task's original Blender file stays intact.
"""
import bpy
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("ash_author", ROOT / "scripts/afterlife-character-blender.py")
author = importlib.util.module_from_spec(spec)
spec.loader.exec_module(author)
bpy.ops.wm.open_mainfile(filepath=str(ROOT / ".art-source/afterlife-iteration/Ash_Witness_Dread_v02.blend"))
rig = author.armature_object()
mapping = author.bone_name_map(rig)

def replace_rotation(action, bone, values):
    for curve in list(action.fcurves):
        if ('["%s"]' % bone) in curve.data_path and "rotation" in curve.data_path:
            action.fcurves.remove(curve)
    author.key_rotation(action, rig, bone, values)

chase = bpy.data.actions["AshWitness_Shuffle"].copy()
chase.name = "AshWitness_Chase"
# Larger alternating strides, bent support knees and an uneven upper-body chase.
for curve in chase.fcurves:
    if "location" in curve.data_path:
        for point in curve.keyframe_points:
            point.co.y *= 1.35
frames = [1, 7, 13, 19, 25, 31, 36]
replace_rotation(chase, "LeftUpLeg", list(zip(frames, [(v, 0, 0) for v in [-.56, -.14, .37, .54, .12, -.38, -.56]])))
replace_rotation(chase, "RightUpLeg", list(zip(frames, [(v, 0, 0) for v in [.48, .12, -.46, -.55, -.05, .38, .48]])))
replace_rotation(chase, "LeftLeg", list(zip(frames, [(v, 0, 0) for v in [.30, .10, .17, .65, .42, .13, .30]])))
replace_rotation(chase, "RightLeg", list(zip(frames, [(v, 0, 0) for v in [.57, .35, .14, .25, .10, .18, .57]])))
replace_rotation(chase, "Spine02", list(zip(frames, [(v, 0, z) for v, z in [(.20,-.07),(.25,.02),(.19,.08),(.24,.02),(.18,-.08),(.24,-.03),(.20,-.07)]])))
replace_rotation(chase, "LeftArm", list(zip(frames, [(v, 0, .32) for v in [.86,.65,.82,1.05,.88,.70,.86]])))
replace_rotation(chase, "RightArm", list(zip(frames, [(v, 0, -.24) for v in [.75,.96,.82,.68,.88,.96,.75]])))
author.linearize(chase)
author.push_to_nla(rig, chase)

attack = bpy.data.actions["AshWitness_AttackLunge"]
# The arm coils outside the shoulder, cuts across the chest plane at frame 9,
# follows through to the opposite side at frame 12, then regains its balance.
frames = [1, 4, 7, 9, 12, 16, 20]
replace_rotation(attack, "Spine02", list(zip(frames, [(.04,0,0),(-.10,0,-.22),(.08,0,-.28),(.30,0,.03),(.47,0,.27),(.19,0,.12),(.04,0,0)])))
replace_rotation(attack, "LeftArm", list(zip(frames, [(1.10,0,-.10),(.48,-.20,.20),(.16,-.28,.57),(.06,.05,1.48),(.48,.23,1.82),(.92,.08,.48),(1.10,0,-.10)])))
replace_rotation(attack, "LeftForeArm", list(zip(frames, [(.10,0,0),(-.68,0,-.12),(-.78,0,-.10),(-.23,0,.02),(-.44,0,.15),(-.12,0,.08),(.10,0,0)])))
replace_rotation(attack, "RightArm", list(zip(frames, [(1.14,0,.10),(1.25,0,-.15),(1.22,0,-.22),(1.08,0,-.18),(.89,0,-.04),(1.08,0,.08),(1.14,0,.10)])))
replace_rotation(attack, "Head", list(zip(frames, [(.02,0,-.06),(.02,-.06,-.08),(.03,-.08,-.06),(.08,0,.02),(.18,.08,.05),(.10,.04,-.10),(.02,0,-.06)])))
author.linearize(attack)
rig.animation_data.action = None
bpy.context.scene.render.fps = 24
bpy.context.scene.frame_set(1)
blend = ROOT / ".art-source/afterlife-iteration/Ash_Witness_Chase_v03.blend"
export = ROOT / ".codex-temp/chase-impact/ash-witness-v03-raw.glb"
export.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
bpy.ops.export_scene.gltf(filepath=str(export), export_format="GLB", export_yup=True,
    export_apply=False, export_animations=True, export_nla_strips=True,
    export_frame_range=False, export_force_sampling=True, export_materials="EXPORT",
    export_image_format="AUTO")
print(json.dumps({"blend": str(blend), "export": str(export), "contactFrame": 9,
    "contactSeconds": 9 / 24, "followThroughSeconds": 12 / 24,
    "clips": [track.name for track in rig.animation_data.nla_tracks]}))
