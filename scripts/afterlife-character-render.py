"""Render a small offline proof sheet for a packaged afterlife character GLB."""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def args():
    values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--action", default="AshWitness_Idle")
    parser.add_argument("--frame", type=int, default=22)
    return parser.parse_args(values)


def look_at(camera, target):
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()


def bounds():
    points = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        return Vector((-0.8, 0.0, -0.2)), Vector((0.8, 1.9, 0.2))
    low = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    high = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    return low, high


def main():
    config = args()
    output = Path(config.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(Path(config.input).resolve()))
    low, high = bounds()
    target = (low + high) * 0.5
    target.z = low.z + (high.z - low.z) * 0.48
    if not bpy.context.scene.world:
        bpy.context.scene.world = bpy.data.worlds.new("AfterlifeProofWorld")
    bpy.context.scene.world.color = (0.012, 0.016, 0.02)
    camera_data = bpy.data.cameras.new("AfterlifeProofCamera")
    camera = bpy.data.objects.new("AfterlifeProofCamera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (2.8, -4.4, target.z + 0.25)
    look_at(camera, target)
    camera_data.lens = 57
    bpy.context.scene.camera = camera
    key_data = bpy.data.lights.new("AfterlifeKey", type="AREA")
    key_data.energy = 720
    key_data.color = (0.54, 0.72, 0.92)
    key_data.shape = "DISK"
    key_data.size = 3.0
    key = bpy.data.objects.new("AfterlifeKey", key_data)
    bpy.context.collection.objects.link(key)
    key.location = (-2.4, target.y + 2.2, 2.8)
    look_at(key, target)
    fill_data = bpy.data.lights.new("AfterlifeFill", type="AREA")
    fill_data.energy = 260
    fill_data.color = (0.82, 0.66, 0.50)
    fill_data.size = 2.0
    fill = bpy.data.objects.new("AfterlifeFill", fill_data)
    bpy.context.collection.objects.link(fill)
    fill.location = (2.2, target.y + 1.5, 1.6)
    look_at(fill, target)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(output)
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = -0.45
    scene.view_settings.gamma = 1.0
    armatures = [obj for obj in scene.objects if obj.type == "ARMATURE"]
    actions = {action.name: action for action in bpy.data.actions}
    if armatures:
        armature = armatures[0]
        armature.animation_data_clear()
        armature.animation_data_create()
        action = actions.get(config.action) or next((candidate for name, candidate in actions.items() if name.startswith(config.action + "_")), None)
        if action:
            armature.animation_data.action = action
    scene.frame_set(config.frame)
    bpy.ops.render.render(write_still=True)
    print(json.dumps({"output": str(output), "bounds": {"low": list(low), "high": list(high)}, "actions": sorted(actions)}))


if __name__ == "__main__":
    main()
