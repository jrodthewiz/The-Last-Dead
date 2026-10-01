"""Offline abdominal wound and intestinal-bundle proof; never rewrites a live model.

Run with Blender's Python. All generated artifacts live in the gore-proof folders.
"""
import argparse
import json
import math
import hashlib
import struct
import sys
from collections import Counter
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
CENTER = Vector((-0.010, -0.103, 1.045))
ART = ROOT / "art/gore-proof"
MASTER = ROOT / ".art-source/gore-proof"
FRAMES = ROOT / "output/playwright/gore-proof"
MATERIALS = []
REFERENCE_LEDGER = [
    "threejs-aaa-graphics-builder/SKILL.md",
    "threejs-aaa-graphics-builder/references/model-recipes.md",
    "threejs-aaa-graphics-builder/references/render-recipes.md",
    "threejs-aaa-graphics-builder/references/checklists/procedural-model-quality.md",
    "threejs-procedural-geometry/SKILL.md",
    "threejs-procedural-geometry/references/profile-sweeps-and-mesh-writers.md",
]


def arguments():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--inspect", action="store_true")
    parser.add_argument("--atlas", default=str(MASTER / "tissue-atlas-imagegen-v1.png"))
    parser.add_argument("--input", default=str(ROOT / "assets/models/afterlife-ash-witness-motion-v04.glb"))
    return parser.parse_args(args)


def inspect_source(source):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if source.suffix.lower() == ".blend":
        bpy.ops.wm.open_mainfile(filepath=str(source))
    else:
        bpy.ops.import_scene.gltf(filepath=str(source))
    report = {"file": str(source), "meshes": [], "armatures": [], "actions": []}
    for obj in bpy.context.scene.objects:
        if obj.type == "ARMATURE":
            obj.animation_data_clear()
            obj.data.pose_position = "REST"
            report["armatures"].append({"name": obj.name, "matrix": [list(row) for row in obj.matrix_world], "bones": [{"name": b.name, "head": list(obj.matrix_world @ b.head_local), "tail": list(obj.matrix_world @ b.tail_local)} for b in obj.data.bones]})
    bpy.context.view_layer.update()
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        points = [obj.matrix_world @ v.co for v in obj.data.vertices]
        lo = [min(p[i] for p in points) for i in range(3)]
        hi = [max(p[i] for p in points) for i in range(3)]
        slices = []
        for z in (0.75, 0.85, 0.95, 1.05, 1.15, 1.25):
            section = [p for p in points if abs(p.z - z) < 0.015 and abs(p.x) < 0.3]
            slices.append({"z": z, "count": len(section), "bounds": {"low": [min(p[i] for p in section) for i in range(3)], "high": [max(p[i] for p in section) for i in range(3)]} if section else None})
        report["meshes"].append({"name": obj.name, "vertices": len(points), "bounds": {"low": lo, "high": hi}, "materials": [m.name for m in obj.data.materials], "slices": slices})
    report["actions"] = [a.name for a in bpy.data.actions]
    return report


def geometry_only_reference(source):
    """Copy immutable mesh/rig into a Blender-2.93-readable, material-free file.

    Blender 2.93 does not import EXT_texture_webp. No accessor, mesh, bone or
    animation data is changed. The copy is an offline fit reference only.
    """
    raw = source.read_bytes()
    json_length = struct.unpack_from("<I", raw, 12)[0]
    document = json.loads(raw[20:20 + json_length])
    document.pop("extensionsRequired", None)
    document.pop("extensionsUsed", None)
    document.pop("images", None)
    document.pop("textures", None)
    document.pop("samplers", None)
    document["materials"] = [{"name": "FIT_REFERENCE_ONLY", "pbrMetallicRoughness": {"baseColorFactor": [0.32, 0.35, 0.37, 1], "metallicFactor": 0, "roughnessFactor": 0.75}}]
    for mesh in document["meshes"]:
        for primitive in mesh["primitives"]:
            primitive["material"] = 0
    encoded = json.dumps(document, separators=(",", ":")).encode("utf-8")
    encoded += b" " * ((-len(encoded)) % 4)
    tail = raw[20 + json_length:]
    result = struct.pack("<III", 0x46546C67, 2, 20 + len(encoded) + len(tail)) + struct.pack("<II", len(encoded), 0x4E4F534A) + encoded + tail
    path = MASTER / "ash-witness-fit-geometry-only.glb"
    path.write_bytes(result)
    return path


def atlas_uv(quadrant, u, v):
    """Full-atlas UVs with 20px inset at 1024, inside every quadrant."""
    inset = 20.0 / 1024.0
    x = 0.5 if quadrant in (1, 3) else 0.0
    y = 0.5 if quadrant in (0, 1) else 0.0
    return (x + inset + max(0.0, min(1.0, u)) * (0.5 - 2 * inset), y + inset + max(0.0, min(1.0, v)) * (0.5 - 2 * inset))


class MeshWriter:
    def __init__(self):
        self.vertices = []
        self.spill = []
        self.faces = []
        self.uvs = []
        self.slots = []

    def vertex(self, point, spilled=None):
        self.vertices.append(tuple(Vector(point) - CENTER))
        self.spill.append(tuple(Vector(spilled if spilled is not None else point) - CENTER))
        return len(self.vertices) - 1

    def face(self, indices, uv, material):
        self.faces.append(tuple(indices))
        self.uvs.append(tuple(uv))
        self.slots.append(material)

    def object(self, name, root, morph=False):
        mesh = bpy.data.meshes.new(name + "_Geometry")
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.update()
        mesh.validate(verbose=False)
        for material in MATERIALS:
            mesh.materials.append(material)
        uv = mesh.uv_layers.new(name="Tissue_Atlas_20px_Gutter")
        for polygon, coords, slot in zip(mesh.polygons, self.uvs, self.slots):
            polygon.material_index = slot
            polygon.use_smooth = True
            for loop_index, point in zip(polygon.loop_indices, coords):
                uv.data[loop_index].uv = point
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        obj.parent = root
        obj["units"] = "meters"
        obj["authoring"] = "gore-anatomy-proof.py / semantic closed surface compiler"
        if morph:
            obj.shape_key_add(name="Basis")
            spilled = obj.shape_key_add(name="Floor_Spill_Reference")
            for vertex, coordinate in zip(spilled.data, self.spill):
                vertex.co = coordinate
            spilled.value = 0
        return obj


def materials(atlas_source):
    atlas = bpy.data.images.load(str(atlas_source), check_existing=True)
    atlas.scale(1024, 1024)
    atlas.filepath_raw = str(ART / "tissue-atlas-v1-1024.png")
    atlas.file_format = "PNG"
    atlas.save()
    atlas.pack()
    result = []
    for name, roughness in (("Exposed_Muscle_And_Clot", 0.53), ("Visceral_Serosa", 0.43), ("Fascia_And_Mesentery", 0.49)):
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        shader = material.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Metallic"].default_value = 0
        shader.inputs["Specular"].default_value = 0.30
        texture = material.node_tree.nodes.new("ShaderNodeTexImage")
        texture.name = "Generated_Tissue_Atlas_Not_A_Scan"
        texture.image = atlas
        texture.interpolation = "Linear"
        texture.extension = "EXTEND"
        material.node_tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
        result.append(material)
    return result


def wound_shell(root):
    writer = MeshWriter()
    rings = []
    count = 56
    # An oblique tear, broad at the right shoulder and pinched at the lower tip.
    # Radius, anterior depth, material role and atlas quadrant are independent.
    tiers = [(1.0, -0.002, 0, 3), (0.95, -0.010, 0, 0), (0.86, -0.016, 0, 0), (0.77, -0.010, 2, 1), (0.68, 0.002, 0, 0), (0.53, 0.045, 0, 3), (0.25, 0.073, 0, 3)]
    for row, (scale, depth, _slot, _quad) in enumerate(tiers):
        ring = []
        for index in range(count):
            angle = index * 2 * math.pi / count
            radial = 1 + 0.09 * math.sin(3 * angle + 0.3) + 0.04 * math.sin(7 * angle - 1.2) + 0.012 * math.sin(13 * angle)
            radial += 0.038 * math.sin(9 * angle + row * 0.85) * math.sin(row * math.pi / 6)
            x = 0.124 * scale * radial * math.cos(angle) + 0.017 * scale * math.sin(angle)
            z = 0.147 * scale * radial * math.sin(angle)
            y = depth + 0.010 * math.sin(5 * angle + row * 0.65) * scale + 0.002 * math.sin(11 * angle)
            ring.append(writer.vertex(CENTER + Vector((x, y, z))))
        rings.append(ring)
    for row in range(len(rings) - 1):
        _scale, _depth, tier_slot, tier_quad = tiers[row]
        for index in range(count):
            following = (index + 1) % count
            slot, quad = tier_slot, tier_quad
            if row == 3 and not (4 <= index <= 9 or 21 <= index <= 25 or 39 <= index <= 43):
                slot, quad = 0, 0
            indices = (rings[row][index], rings[row + 1][index], rings[row + 1][following], rings[row][following])
            # Planar per-role UVs prevent longitudinal border stripes.
            uv = [atlas_uv(quad, 0.5 + writer.vertices[v][0] / 0.30, 0.5 + writer.vertices[v][2] / 0.34) for v in indices]
            writer.face(indices, uv, slot)
    center = writer.vertex(CENTER + Vector((0.003, 0.080, -0.007)))
    for index in range(count):
        following = (index + 1) % count
        writer.face((rings[-1][index], center, rings[-1][following]), (atlas_uv(3, index / count, 0.8), atlas_uv(3, 0.5, 0.95), atlas_uv(3, (index + 1) / count, 0.8)), 0)
    # Fully closed exterior backing, separate from the anterior cavity center.
    back = writer.vertex(CENTER + Vector((0, 0.100, 0)))
    for index in range(count):
        following = (index + 1) % count
        writer.face((rings[0][following], back, rings[0][index]), (atlas_uv(3, 0.95, index / count), atlas_uv(3, 0.75, 0.5), atlas_uv(3, 0.95, (index + 1) / count)), 0)
    return writer.object("Wound_Layered_Rim_And_Cavity", root)


def catmull(points, steps=10):
    points = [Vector(p) for p in points]
    result = []
    for index in range(len(points) - 1):
        p0, p1, p2, p3 = points[max(0, index - 1)], points[index], points[index + 1], points[min(len(points) - 1, index + 2)]
        for step in range(steps):
            t = step / steps
            result.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t))
    result.append(points[-1])
    return result


def resample(points, count):
    points = catmull(points)
    lengths = [0]
    for index in range(1, len(points)):
        lengths.append(lengths[-1] + (points[index] - points[index - 1]).length)
    result = []
    index = 1
    for step in range(count):
        target = lengths[-1] * step / (count - 1)
        while index < len(points) - 1 and lengths[index] < target:
            index += 1
        t = (target - lengths[index - 1]) / max(1e-10, lengths[index] - lengths[index - 1])
        result.append(points[index - 1].lerp(points[index], t))
    return result, lengths[-1]


def transported_frames(points):
    frames = []
    previous = Vector((0, -1, 0))
    for index, point in enumerate(points):
        tangent = (points[min(index + 1, len(points) - 1)] - points[max(0, index - 1)]).normalized()
        projected = previous - tangent * previous.dot(tangent)
        if projected.length < 0.01:
            projected = Vector((1, 0, 0)) - tangent * tangent.x
        normal = projected.normalized()
        binormal = tangent.cross(normal).normalized()
        frames.append((tangent, normal, binormal))
        previous = normal
    return frames


def swept_organ(writer, points, radii, side_count=12, slot=1, quadrant=2, spill=None, flattened=0.9, cap_clot=False, variable_compression=False):
    frames = transported_frames(points)
    spill = spill or points
    spill_frames = transported_frames(spill)
    rings = []
    lengths = [0]
    for index in range(1, len(points)):
        lengths.append(lengths[-1] + (points[index] - points[index - 1]).length)
    for index, (point, radius) in enumerate(zip(points, radii)):
        _tangent, normal, binormal = frames[index]
        _st, spill_normal, spill_binormal = spill_frames[index]
        ring = []
        s = index / (len(points) - 1)
        compression = flattened
        if variable_compression:
            compression *= 0.88 + 0.16 * math.sin(s * math.pi * 8.5 + 0.2) + 0.055 * math.sin(s * math.pi * 23)
        for side in range(side_count):
            angle = 2 * math.pi * side / side_count
            lobe = 1 + 0.05 * math.cos(3 * angle + s * 11) + 0.018 * math.sin(5 * angle - s * 13)
            delta = radius * lobe * (normal * math.cos(angle) * compression + binormal * math.sin(angle))
            spilled_delta = radius * lobe * (spill_normal * math.cos(angle) * compression + spill_binormal * math.sin(angle))
            ring.append(writer.vertex(point + delta, spill[index] + spilled_delta))
        rings.append(ring)
    # Real-distance patches keep serosa detail at organ scale. UV seams are per
    # loop, so no cross-quadrant sampling or geometric surface seam is required.
    tile_length = 0.11 if quadrant == 2 else 0.065
    for index in range(len(points) - 1):
        u0 = (lengths[index] / tile_length) % 1
        u1 = (lengths[index + 1] / tile_length) % 1
        if u1 < u0:
            u1 = 1.0
        for side in range(side_count):
            following = (side + 1) % side_count
            v0, v1 = side / side_count, (side + 1) / side_count
            writer.face((rings[index][side], rings[index][following], rings[index + 1][following], rings[index + 1][side]), (atlas_uv(quadrant, u0, v0), atlas_uv(quadrant, u0, v1), atlas_uv(quadrant, u1, v1), atlas_uv(quadrant, u1, v0)), slot)
    for endpoint in (0, len(points) - 1):
        inward = 0.003 if endpoint == 0 else -0.003
        center = writer.vertex(points[endpoint] + frames[endpoint][0] * inward, spill[endpoint] + spill_frames[endpoint][0] * inward)
        cap_quadrant = 3 if cap_clot and endpoint > 0 else quadrant
        cap_slot = 0 if cap_clot and endpoint > 0 else slot
        for side in range(side_count):
            following = (side + 1) % side_count
            vertices = (rings[endpoint][following], rings[endpoint][side], center) if endpoint == 0 else (rings[endpoint][side], rings[endpoint][following], center)
            angle0, angle1 = side * 2 * math.pi / side_count, (side + 1) * 2 * math.pi / side_count
            uv = (atlas_uv(cap_quadrant, 0.5 + 0.4 * math.cos(angle0), 0.5 + 0.4 * math.sin(angle0)), atlas_uv(cap_quadrant, 0.5 + 0.4 * math.cos(angle1), 0.5 + 0.4 * math.sin(angle1)), atlas_uv(cap_quadrant, 0.5, 0.5))
            writer.face(vertices, uv, cap_slot)


def muscle_strata(root):
    writer = MeshWriter()
    for index, (angle, span) in enumerate(((-0.28, 0.55), (0.82, 0.58), (1.9, 0.48), (2.7, 0.54), (3.53, 0.45), (4.25, 0.56), (5.12, 0.44))):
        points = []
        count = 17
        for step in range(count):
            t = step / (count - 1)
            a = angle + span * (t - 0.5)
            x = 0.103 * math.cos(a) + 0.010 * math.sin(a)
            z = 0.128 * math.sin(a)
            y = -0.016 - 0.012 * math.sin(t * math.pi) - 0.004 * math.sin(3 * math.pi * t + index)
            points.append(CENTER + Vector((x, y, z)))
        radii = [0.004 + 0.0055 * math.sin(math.pi * j / (count - 1)) ** 0.8 for j in range(count)]
        swept_organ(writer, points, radii, side_count=10, slot=0, quadrant=0, flattened=0.55)
    return writer.object("Torn_Muscle_Strata", root)


def fat_lobules(root):
    writer = MeshWriter()
    for index in range(9):
        angle = 2.8 + index * 0.28
        position = CENTER + Vector((0.096 * math.cos(angle), -0.012 - 0.008 * math.sin(index), 0.112 * math.sin(angle)))
        axis = Vector((0.004 * math.cos(angle), 0.004, 0.009 * math.sin(angle)))
        points = [position + axis * (j / 6 - 0.5) * 2 for j in range(7)]
        radii = [(0.0025 + 0.006 * math.sin(j * math.pi / 6) ** 0.65) * (0.85 + 0.12 * math.sin(index * 2)) for j in range(7)]
        swept_organ(writer, points, radii, side_count=10, slot=2, quadrant=1, flattened=0.6)
    return writer.object("Fascia_Fat_Lobules", root)


def intestines(root):
    packed = [(0.008,-0.063,1.060),(-0.046,-0.130,1.103),(-0.080,-0.177,1.047),(-0.104,-0.183,0.986),(-0.060,-0.211,0.942),(0.005,-0.207,0.949),(0.078,-0.192,0.978),(0.095,-0.152,1.032),(0.055,-0.135,1.060),(0.014,-0.156,1.028),(0.027,-0.199,0.976),(0.076,-0.238,0.917),(0.105,-0.224,0.852),(0.072,-0.221,0.819),(0.009,-0.245,0.827),(-0.065,-0.249,0.850),(-0.094,-0.207,0.897),(-0.097,-0.165,0.943),(-0.060,-0.160,0.985),(-0.010,-0.189,0.955),(0.018,-0.241,0.904),(-0.007,-0.275,0.864),(-0.056,-0.279,0.862),(-0.074,-0.246,0.913),(-0.043,-0.221,0.948),(0.010,-0.249,0.973),(0.058,-0.272,0.932),(0.068,-0.248,0.879)]
    spilled = [(0.008,-0.063,1.060),(-0.016,-0.124,1.032),(-0.035,-0.192,0.927),(-0.051,-0.231,0.756),(-0.039,-0.262,0.564),(-0.034,-0.281,0.348),(0.006,-0.314,0.152),(0.049,-0.372,0.040),(0.116,-0.414,0.037),(0.168,-0.469,0.036),(0.123,-0.524,0.036),(0.053,-0.511,0.037),(-0.022,-0.463,0.038),(-0.063,-0.397,0.039),(-0.024,-0.341,0.040),(0.043,-0.337,0.039),(0.093,-0.383,0.039),(0.069,-0.443,0.040),(0.006,-0.421,0.040),(-0.019,-0.367,0.041)]
    points, packed_length = resample(packed, 150)
    floor_points, spill_length = resample(spilled, 150)
    radii = []
    for index in range(len(points)):
        s = index / (len(points) - 1)
        # Small bowel: modest uneven contraction; larger haustra are separate colon.
        radius = 0.0149 + 0.0034 * math.sin(2 * math.pi * 2.35 * s + 0.1) + 0.0014 * math.cos(2 * math.pi * 14 * s) + 0.0005 * math.sin(2 * math.pi * 33 * s)
        radius *= 0.84 + 0.16 * min(1, s * 18)
        radii.append(radius)
    writer = MeshWriter()
    swept_organ(writer, points, radii, side_count=20, slot=1, quadrant=2, spill=floor_points, flattened=0.91, cap_clot=True, variable_compression=True)
    small = writer.object("Small_Bowel_Attached_Bundle", root, morph=True)
    # Short partial colon with shallow haustra, inside upper-right cavity.
    colon_points, colon_length = resample([(0.081,-0.060,1.145),(0.083,-0.084,1.116),(0.088,-0.087,1.073),(0.065,-0.091,1.022),(0.034,-0.081,1.004)], 39)
    colon_radii = [0.020 + 0.005 * math.sin(math.pi * j / 38) + 0.004 * (0.5 + 0.5 * math.cos(2 * math.pi * 5 * j / 38)) for j in range(39)]
    writer = MeshWriter()
    swept_organ(writer, colon_points, colon_radii, side_count=18, slot=1, quadrant=2, flattened=0.80, variable_compression=True)
    colon = writer.object("Partial_Colon_Haustra", root)
    return small, colon, points, floor_points, {"smallBowelPackedMeters": packed_length, "smallBowelFloorReferenceMeters": spill_length, "partialColonMeters": colon_length, "radiusMeters": {"smallBowelMin": min(radii), "smallBowelMax": max(radii), "partialColonMin": min(colon_radii), "partialColonMax": max(colon_radii)}}


def mesentery(root, points, spill):
    writer = MeshWriter()
    vessel_writer = MeshWriter()
    # Three finished folded leaves. Their proximal roots remain inside the cavity;
    # the distal bowel can spill while the visible attachment stays short.
    for leaf, (start, end) in enumerate(((0.04,0.17),(0.17,0.29),(0.29,0.39))):
        grid = [[], []]
        rows, columns = 7, 19
        for side in range(2):
            for row in range(rows):
                ring = []
                t = row / (rows - 1)
                for column in range(columns):
                    u = column / (columns - 1)
                    s = start + (end - start) * u
                    index = round(s * (len(points) - 1))
                    root_point = CENTER + Vector((-0.025 + 0.018 * leaf + 0.014 * (u - 0.5), 0.047, -0.006 - 0.014 * leaf))
                    outer = points[index] + Vector((0, 0.009, 0))
                    outer_spilled = spill[index] + Vector((0, 0.009, 0))
                    crease = 0.013 * math.sin(u * math.pi * 5 + leaf) * math.sin(math.pi * t)
                    delta = Vector((0.003 * math.sin(u * 8) * t, crease + (0.001 if side == 0 else -0.001), 0.004 * math.sin(u * 12 + t * 2) * math.sin(math.pi * t)))
                    ring.append(writer.vertex(root_point.lerp(outer, t) + delta, root_point.lerp(outer_spilled, t) + delta))
                grid[side].append(ring)
        for side in range(2):
            for row in range(rows - 1):
                for column in range(columns - 1):
                    indices = (grid[side][row][column],grid[side][row + 1][column],grid[side][row + 1][column + 1],grid[side][row][column + 1])
                    uv = [atlas_uv(1, column/(columns-1),row/(rows-1)),atlas_uv(1,column/(columns-1),(row+1)/(rows-1)),atlas_uv(1,(column+1)/(columns-1),(row+1)/(rows-1)),atlas_uv(1,(column+1)/(columns-1),row/(rows-1))]
                    writer.face(indices if side == 0 else tuple(reversed(indices)), uv if side == 0 else list(reversed(uv)), 2)
        boundary = [(0,column) for column in range(columns)] + [(row,columns-1) for row in range(1,rows)] + [(rows-1,column) for column in range(columns-2,-1,-1)] + [(row,0) for row in range(rows-2,0,-1)]
        for index,(row,column) in enumerate(boundary):
            r2,c2 = boundary[(index+1)%len(boundary)]
            writer.face((grid[0][row][column],grid[0][r2][c2],grid[1][r2][c2],grid[1][row][column]), (atlas_uv(1,index/len(boundary),0.25),atlas_uv(1,(index+1)/len(boundary),0.25),atlas_uv(1,(index+1)/len(boundary),0.27),atlas_uv(1,index/len(boundary),0.27)), 2)
        for branch in range(3):
            s = start + (end-start)*(branch+0.5)/3
            index = round(s*(len(points)-1))
            origin = CENTER + Vector((-0.025+0.018*leaf,0.044,-0.006-0.014*leaf))
            destination = points[index] + Vector((0,0.007,0))
            floor_destination = spill[index] + Vector((0,0.007,0))
            vessel_points = [origin.lerp(destination,j/9)+Vector((0,-0.001-0.006*math.sin(j*math.pi/9),0)) for j in range(10)]
            floor_vessels = [origin.lerp(floor_destination,j/9)+Vector((0,-0.001-0.006*math.sin(j*math.pi/9),0)) for j in range(10)]
            radii = [0.0016*(1-j/16) for j in range(10)]
            swept_organ(vessel_writer,vessel_points,radii,side_count=6,slot=0,quadrant=0,spill=floor_vessels)
    return writer.object("Mesentery_Attachment_Fan", root, morph=True), vessel_writer.object("Mesenteric_Vessel_Relief", root, morph=True)


def diagnostics(obj):
    mesh = obj.data
    mesh.calc_loop_triangles()
    edge_use = Counter()
    winding = Counter()
    for face in mesh.polygons:
        indices = list(face.vertices)
        for index, a in enumerate(indices):
            b = indices[(index + 1) % len(indices)]
            key = tuple(sorted((a, b)))
            edge_use[key] += 1
            winding[key] += 1 if a < b else -1
    degenerate = sum(1 for tri in mesh.loop_triangles if ((mesh.vertices[tri.vertices[1]].co - mesh.vertices[tri.vertices[0]].co).cross(mesh.vertices[tri.vertices[2]].co - mesh.vertices[tri.vertices[0]].co)).length < 1e-10)
    normals = [loop.normal.length for loop in mesh.loops]
    normal_nonfinite = sum(not math.isfinite(component) for loop in mesh.loops for component in loop.normal)
    volume = sum(mesh.vertices[tri.vertices[0]].co.dot(mesh.vertices[tri.vertices[1]].co.cross(mesh.vertices[tri.vertices[2]].co)) / 6 for tri in mesh.loop_triangles)
    uv = mesh.uv_layers.active
    bad_uv = 0
    uv_area_zero = 0
    for tri in mesh.loop_triangles:
        coords = [uv.data[i].uv for i in tri.loops]
        uv_area_zero += abs((coords[1]-coords[0]).cross(coords[2]-coords[0])) < 1e-10
    for loop in uv.data:
        if any(not math.isfinite(c) or c < 20/1024 - 1e-6 or c > 1-20/1024+1e-6 for c in loop.uv):
            bad_uv += 1
    positions = [obj.matrix_world @ v.co for v in mesh.vertices]
    morph_diagnostics = []
    if mesh.shape_keys:
        for key in mesh.shape_keys.key_blocks:
            if key.name == "Basis":
                continue
            vertices = [vertex.co for vertex in key.data]
            areas = [(vertices[tri.vertices[1]]-vertices[tri.vertices[0]]).cross(vertices[tri.vertices[2]]-vertices[tri.vertices[0]]).length * 0.5 for tri in mesh.loop_triangles]
            morph_volume = sum(vertices[tri.vertices[0]].dot(vertices[tri.vertices[1]].cross(vertices[tri.vertices[2]])) / 6 for tri in mesh.loop_triangles)
            morph_diagnostics.append({"name": key.name, "nonfiniteCoordinates": sum(not math.isfinite(component) for vertex in vertices for component in vertex), "degenerateEndpointTriangles": sum(area < 1e-10 for area in areas), "minimumEndpointTriangleAreaMetersSquared": min(areas), "signedEndpointVolumeMetersCubed": morph_volume})
    return {"name": obj.name, "vertices": len(mesh.vertices), "triangles": len(mesh.loop_triangles), "polygonCount": len(mesh.polygons), "usedMaterialSlots": sorted(set(p.material_index for p in mesh.polygons)), "boundaryEdges": sum(n == 1 for n in edge_use.values()), "nonmanifoldEdges": sum(n != 2 for n in edge_use.values()), "inconsistentWindingEdges": sum(winding[k] != 0 for k,n in edge_use.items() if n == 2), "degenerateTriangles": degenerate, "normalLengthMin": min(normals) if normals else 0, "normalLengthMax": max(normals) if normals else 0, "normalNonfiniteComponents": normal_nonfinite, "signedVolumeMetersCubed": volume, "uvLayer": uv.name, "uvOutOfGutterRangeLoops": bad_uv, "uvZeroAreaTriangles": int(uv_area_zero), "boundsBlenderMeters": {"low": [min(p[i] for p in positions) for i in range(3)], "high": [max(p[i] for p in positions) for i in range(3)]}, "shapeKeys": [key.name for key in mesh.shape_keys.key_blocks] if mesh.shape_keys else [], "morphDiagnostics": morph_diagnostics}


def inspect_export(glb):
    raw = glb.read_bytes()
    json_length = struct.unpack_from("<I", raw, 12)[0]
    document = json.loads(raw[20:20 + json_length])
    binary = raw[28 + json_length:]
    components = {5120:("b",1),5121:("B",1),5122:("h",2),5123:("H",2),5125:("I",4),5126:("f",4)}
    widths = {"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4,"MAT4":16}
    def accessor(index):
        descriptor = document["accessors"][index]
        view = document["bufferViews"][descriptor["bufferView"]]
        code,size = components[descriptor["componentType"]]
        width = widths[descriptor["type"]]
        offset = view.get("byteOffset",0) + descriptor.get("byteOffset",0)
        stride = view.get("byteStride",size*width)
        return [struct.unpack_from("<"+code*width,binary,offset+i*stride) for i in range(descriptor["count"])]
    report = {"headerLengthMatches":struct.unpack_from("<I",raw,8)[0] == len(raw), "meshCount":len(document["meshes"]), "materialCount":len(document.get("materials",[])), "textureCount":len(document.get("textures",[])), "imageCount":len(document.get("images",[])), "embeddedImages":sum("bufferView" in image for image in document.get("images",[])), "externalUris":[image["uri"] for image in document.get("images",[]) if "uri" in image], "animationCount":len(document.get("animations",[])), "skinCount":len(document.get("skins",[])), "primitives":[], "triangles":0}
    for mesh in document["meshes"]:
        for primitive in mesh["primitives"]:
            attributes = primitive["attributes"]
            normals = accessor(attributes["NORMAL"])
            tangents = accessor(attributes["TANGENT"]) if "TANGENT" in attributes else []
            normal_lengths = [math.sqrt(sum(c*c for c in normal)) for normal in normals]
            tangent_lengths = [math.sqrt(sum(c*c for c in tangent[:3])) for tangent in tangents]
            index_count = document["accessors"][primitive["indices"]]["count"]
            vertex_count = document["accessors"][attributes["POSITION"]]["count"]
            record = {"mesh":mesh["name"],"vertices":vertex_count,"triangles":index_count//3,"attributes":sorted(attributes),"normalNonfinite":sum(not math.isfinite(c) for normal in normals for c in normal),"normalLengthRange":[min(normal_lengths),max(normal_lengths)],"tangentNonfinite":sum(not math.isfinite(c) for tangent in tangents for c in tangent),"tangentLengthRange":[min(tangent_lengths),max(tangent_lengths)] if tangent_lengths else None,"morphTargetNames":mesh.get("extras",{}).get("targetNames",[]),"morphTargets":[{"attributes":sorted(target),"vertexCounts":{attribute:document["accessors"][index]["count"] for attribute,index in target.items()}} for target in primitive.get("targets",[])]}
            report["primitives"].append(record)
            report["triangles"] += index_count//3
    report["drawGroups"] = len(report["primitives"])
    report["rootNode"] = next(node for node in document["nodes"] if node.get("name") == "Abdominal_Wound_Proof_Root")
    return report


def orient_consistently(obj):
    # Recalculate orientation per closed connected component. Intentionally keep
    # the interior cavity surface as the front of its complete shell volume.
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.data.calc_normals_split()


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def render_scene(objects):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 96
    scene.eevee.use_gtao = True
    scene.eevee.gtao_distance = 0.045
    scene.eevee.gtao_factor = 1.10
    scene.render.resolution_x = 800
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new("Neutral_Review_World")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.052,0.060,0.067,1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.4
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = -0.1
    scene.view_settings.gamma = 1.0
    camera_data = bpy.data.cameras.new("Proof_Review_Camera")
    camera = bpy.data.objects.new("Proof_Review_Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (0.52,-1.45,1.13)
    aim(camera, (0,-0.16,1.015))
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 0.54
    scene.camera = camera
    lights = []
    for name, location, energy, size in (("Form_Key",(-0.5,-0.9,1.8),75,0.8),("Broad_Fill",(0.65,-0.35,1.25),30,0.6),("Contour_Rim",(-0.25,0.45,1.3),50,0.45)):
        data = bpy.data.lights.new(name,"AREA")
        data.energy, data.size = energy,size
        light = bpy.data.objects.new(name,data)
        bpy.context.collection.objects.link(light)
        light.location = location
        aim(light,(0,-0.12,1.04))
        lights.append(light)
    render_outputs = []
    color_sets = {"neutral": ((1,1,1),(1,1,1),(1,1,1)), "warm": ((1,0.73,0.49),(0.60,0.74,1),(1,0.53,0.34)), "cool": ((0.57,0.75,1),(0.85,0.88,1),(0.38,0.61,1))}
    for mode,colors in color_sets.items():
        for light,color in zip(lights,colors):
            light.data.color = color
        path = FRAMES / ("abdominal-packed-" + mode + ".png")
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        render_outputs.append(str(path.relative_to(ROOT)).replace("\\","/"))
    for obj in objects:
        if obj.data.shape_keys:
            obj.data.shape_keys.key_blocks["Floor_Spill_Reference"].value = 1
    camera.location = (0.65,-1.7,0.77)
    aim(camera,(0,-0.24,0.62))
    camera_data.ortho_scale = 1.30
    for light in lights:
        light.data.color = (1,1,1)
    path = FRAMES / "abdominal-floor-spill-reference.png"
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    render_outputs.append(str(path.relative_to(ROOT)).replace("\\","/"))
    for obj in objects:
        if obj.data.shape_keys:
            obj.data.shape_keys.key_blocks["Floor_Spill_Reference"].value = 0
    camera.location = (0.52,-1.45,1.13)
    aim(camera,(0,-0.16,1.015))
    camera_data.ortho_scale = 0.54
    return render_outputs


def main():
    config = arguments()
    source = Path(config.input).resolve()
    for folder in (ART, MASTER, FRAMES):
        folder.mkdir(parents=True, exist_ok=True)
    fit_source = geometry_only_reference(source) if source.suffix == ".glb" else source
    report = inspect_source(fit_source)
    report["canonicalSource"] = str(source)
    report["canonicalSourceSha256"] = hashlib.sha256(source.read_bytes()).hexdigest()
    path = MASTER / "source-fit-inspection.json"
    path.write_text(json.dumps(report, indent=2))
    if config.inspect:
        print(json.dumps(report))
        return
    bpy.ops.wm.read_factory_settings(use_empty=True)
    global MATERIALS
    MATERIALS = materials(Path(config.atlas).resolve())
    root = bpy.data.objects.new("Abdominal_Wound_Proof_Root",None)
    bpy.context.collection.objects.link(root)
    root.location = CENTER
    root["attachmentHint"] = "AshWitness_Rig Hips/Spine02 transition; requires blended skin attachment/cull mask in runtime"
    objects = [wound_shell(root),muscle_strata(root),fat_lobules(root)]
    small,colon,points,spill,lengths = intestines(root)
    objects.extend([small,colon])
    objects.extend(mesentery(root,points,spill))
    bpy.context.view_layer.update()
    for obj in objects:
        orient_consistently(obj)
    reports = [diagnostics(obj) for obj in objects]
    total_triangles = sum(item["triangles"] for item in reports)
    if total_triangles > 15000 or len(MATERIALS) > 3:
        raise RuntimeError("Proof exceeded its explicit 15k-triangle / 3-material budget")
    if any(item["boundaryEdges"] or item["nonmanifoldEdges"] or item["degenerateTriangles"] or item["inconsistentWindingEdges"] or item["uvZeroAreaTriangles"] for item in reports):
        raise RuntimeError("Proof has unfinished boundaries, degenerates or inconsistent winding")
    if any(item["normalNonfiniteComponents"] or item["uvOutOfGutterRangeLoops"] or any(morph["nonfiniteCoordinates"] or morph["degenerateEndpointTriangles"] for morph in item["morphDiagnostics"]) for item in reports):
        raise RuntimeError("Normals, UVs or endpoint morph geometry failed diagnostics")
    glb = ART / "ash-witness-abdominal-proof-v1.glb"
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=str(glb),export_format="GLB",use_selection=True,export_yup=True,export_texcoords=True,export_normals=True,export_tangents=True,export_materials="EXPORT",export_animations=False,export_morph=True,export_morph_normal=True)
    export_report = inspect_export(glb)
    if export_report["triangles"] != total_triangles or export_report["externalUris"] or export_report["skinCount"] or export_report["animationCount"]:
        raise RuntimeError("Export disagrees with standalone proof contract")
    if any(primitive["normalNonfinite"] or primitive["tangentNonfinite"] or primitive["tangentLengthRange"] is None for primitive in export_report["primitives"]):
        raise RuntimeError("Exported normals/tangents failed diagnostics")
    renders = render_scene(objects)
    blend = MASTER / "Ash_Witness_Abdominal_Proof_v1.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    low = [min(item["boundsBlenderMeters"]["low"][i] for item in reports) for i in range(3)]
    high = [max(item["boundsBlenderMeters"]["high"][i] for item in reports) for i in range(3)]
    floor_positions = []
    for obj in objects:
        vertices = obj.data.shape_keys.key_blocks["Floor_Spill_Reference"].data if obj.data.shape_keys else obj.data.vertices
        floor_positions.extend(obj.matrix_world @ vertex.co for vertex in vertices)
    floor_low = [min(p[i] for p in floor_positions) for i in range(3)]
    floor_high = [max(p[i] for p in floor_positions) for i in range(3)]
    manifest = {"formatVersion":1,"id":"ash-witness-abdominal-proof-v1","status":"OFFLINE_ANATOMICAL_ASSET_PROOF_REQUIRES_VISUAL_REVIEW","integratedInGame":False,"files":{"glb":str(glb.relative_to(ROOT)).replace("\\","/"),"atlas": "art/gore-proof/tissue-atlas-v1-1024.png","master":str(blend.relative_to(ROOT)).replace("\\","/"),"authoringScript":"scripts/gore-anatomy-proof.py","renders":renders},"bytes":{"glb":glb.stat().st_size,"atlas":(ART/"tissue-atlas-v1-1024.png").stat().st_size},"sha256":{"glb":hashlib.sha256(glb.read_bytes()).hexdigest(),"source":report["canonicalSourceSha256"]},"sourceFit":{"canonicalSource":str(source.relative_to(ROOT)).replace("\\","/"),"readOnlySource":True,"inspection":".art-source/gore-proof/source-fit-inspection.json","heightMeters":1.86,"nativeAxes":"Blender +Z up, -Y anterior; glTF +Y up, +Z anterior","rootAnchorBlenderMeters":list(CENTER),"rootAnchorGltfMeters":[CENTER.x,CENTER.z,-CENTER.y],"attachmentBones":["Hips","Spine02"],"fitNote":"Sized against exact latest GLB rest geometry (only unsupported WebP material removed in an offline copy). Wound spans lower abdomen; center sits near anterior rest surface. No original topology, material, inverse-bind matrix, clip, or runtime scale changed. Character's runtime PI yaw must be inherited. True cavity requires local skin culling/wound-mask and anatomical body replacement integration."},"geometry":{"meshCount":len(objects),"triangles":total_triangles,"materialCount":len(MATERIALS),"materials":[{"name":m.name,"roughness":m.node_tree.nodes.get("Principled BSDF").inputs["Roughness"].default_value,"metalness":0} for m in MATERIALS],"textureCount":1,"atlasDimensions":[1024,1024],"atlasGutterPixels":20,"boundsBlenderMeters":{"low":low,"high":high},"boundsGltfMeters":{"low":[low[0],low[2],-high[1]],"high":[high[0],high[2],-low[1]]},"floorBoundsBlenderMeters":{"low":floor_low,"high":floor_high},"floorBoundsGltfMeters":{"low":[floor_low[0],floor_low[2],-floor_high[1]],"high":[floor_high[0],floor_high[2],-floor_low[1]]},"authoredLengths":lengths,"meshes":reports},"shape":{"key":"Floor_Spill_Reference","default":0,"floorReference":1,"animatedObjects":[o.name for o in objects if o.data.shape_keys],"clipCount":0,"note":"Single authored morph, not physics. Endpoint normals exported. Intermediate paths have not been collision-tested; floor endpoint is an anatomical placement study with hidden proximal root and finished distal cap."},"sourcing":{"geometry":"Authored offline semantic surfaces, sampled curved bowel paths with transported frames and varied cross sections; measured reused Ash Witness scanned character reference","atlas":"Generated four-quadrant image source .art-source/gore-proof/tissue-atlas-imagegen-v1.png, resized offline; not a scan or calibrated PBR set","quadrants":{"topLeft":"exposed muscle fibers","topRight":"fascia/fat/mesentery","bottomLeft":"visceral serosa/veins","bottomRight":"coagulated cavity and distal clot"},"uv":"Full packed atlas coordinates with 20px inset, per-role seams; no normal map. Bowel uses real-distance 0.11m patches; other sweeps use0.065m patches. Wound uses planar per-role patches. Seam intervals are intentional and not geometrical boundaries."},"referenceLedger":[{"path":"C:/Users/wolfk/.codex/skills/"+p,"loaded":True} for p in REFERENCE_LEDGER],"anatomicalLimits":["Authored human-scale wound and bowel study, not an exact medical dissection; location and amount of bowel are cinematic.","Small bowel has irregular contraction; partial colon includes shallow haustra, not a complete abdominal organ inventory.","Mesentery is three opaque folded sheets with relief vessels; translucency, layered fascia thickness and severed tissue motion remain approximations.","Generated diffuse atlas contains faint baked highlights. No scanned roughness, normal or SSS data; neutral-color review is mandatory.","Wound is a separate closed insert. No hole exists in Ash Witness skin until controlled mask/cull integration; overlay alone cannot create a true cavity.","Floor-reference morph changes arc length and does not preserve volume or enforce collisions. Only endpoint geometry was authored.","Asset renders do not certify game performance, correct clip attachment, mobile rendering or finished gore mechanics."],"qualityVerdict":"Needs neutral/warm/cool visual review; offline proof only."}
    manifest["exportDiagnostics"] = export_report
    manifest["qualityVerdict"] = "Offline anatomy direction proof, below professional realistic gore target. One focused correction removed stretched hose-like stripes, smoothed bowel cross sections, broke concentric rim bands, and finished membrane UVs. Neutral/warm/cool endpoint renders were inspected. Remaining loop-like bowel silhouette, broad opaque mesentery fans, thin layered wound rim and generated baked diffuse highlights need an authored/sculpted anatomy pass before game acceptance."
    manifest["review"] = {"neutralWarmCoolFramesViewed":True,"floorReferenceFrameViewed":True,"focusedCorrectionIterations":1,"claimsPremiumOrIntegrated":False,"checksPassed":["<=15000 triangles","<=3 PBR materials","closed topology/caps/back surfaces","consistent winding","finite unit normals","finite exported tangents","no degenerate basis triangles","no degenerate endpoint morph triangles","20px atlas gutter","no zero-area triangle UVs","self-contained GLB without external URLs or skins/clips"],"unverified":["intermediate morph self-intersection","skin cull integration","bone-following clip behavior","mobile performance","blood/physics/gameplay behavior"]}
    (ART / "ash-witness-abdominal-proof-v1-manifest.json").write_text(json.dumps(manifest,indent=2))
    print(json.dumps({"glb":str(glb),"blend":str(blend),"triangles":total_triangles,"materials":len(MATERIALS),"renders":renders,"exportDrawGroups":export_report["drawGroups"],"qualityVerdict":manifest["qualityVerdict"]}))


if __name__ == "__main__":
    main()
