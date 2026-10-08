"""Headless Blender 2.93+ shell experiment. Outputs GLB + collision metadata.
Usage: blender --background --python scripts/export-neighborhood-house.py -- --output output/house-poc
No downloads; metres; runtime metadata uses Y-up, X/Z ground coordinates.
"""
import argparse
import json
import sys
from pathlib import Path
import bpy

args = argparse.ArgumentParser()
args.add_argument('--output', required=True)
opts = args.parse_args(sys.argv[sys.argv.index('--') + 1:])
out = Path(opts.output).resolve()
out.mkdir(parents=True, exist_ok=True)

def box(name, position, size, material):
    x, y, z = position
    w, h, d = size
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (w, d, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    return obj

def material(name, color):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = .9
    return mat

reports = []
for variant in ('intact', 'storm-damaged'):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    walls = material('Weathered plaster', (.32, .37, .30))
    roof = material('Oxidized roof', (.18, .22, .23))
    foundation = material('Concrete', (.27, .25, .22))
    # Front door clear width 1.4m, height 2.4m. Wall volumes meet at
    # edges; no overlapping façade sheets or separate coplanar decals.
    parts = [
        ('floor', [0, -.1, 0], [6.4, .2, 8.2], 'floor'),
        ('west-wall', [-3.1, 1.5, 0], [.2, 3, 7.8], 'wall'),
        ('east-wall', [3.1, 1.5, 0], [.2, 3, 7.8], 'wall'),
        ('rear-wall', [0, 1.5, -4], [6.4, 3, .2], 'wall'),
        ('front-left', [-1.95, 1.5, 4], [2.5, 3, .2], 'wall'),
        ('front-right', [1.95, 1.5, 4], [2.5, 3, .2], 'wall'),
        ('door-lintel', [0, 2.7, 4], [1.4, .6, .2], 'wall'),
    ]
    if variant == 'intact':
        parts.append(('roof', [0, 3.1, 0], [6.8, .2, 8.6], 'roof'))
    else:
        parts.append(('roof-front', [0, 3.1, 2.15], [6.8, .2, 4.3], 'roof'))
    for name, position, size, kind in parts:
        box(name, position, size, foundation if kind == 'floor' else roof if kind == 'roof' else walls)
    # Verify a 0.25m-radius standing capsule can cross the doorway and that
    # the same footprint cannot pass through either side of the front wall.
    def clear(x, z):
        for _, pos, size, kind in parts:
            if kind != 'wall' or pos[1] - size[1] / 2 >= 1.8:
                continue
            if abs(x - pos[0]) < size[0] / 2 + .25 and abs(z - pos[2]) < size[2] / 2 + .25:
                return False
        return True
    assert all(clear(0, 5 - step * .05) for step in range(101)), 'Door traversal blocked'
    assert not clear(1.5, 4) and not clear(-1.5, 4), 'Front wall proxy missing'
    faces = set()
    for obj in bpy.context.scene.objects:
        for polygon in obj.data.polygons:
            points = tuple(sorted(tuple(round(v, 5) for v in obj.matrix_world @ obj.data.vertices[i].co) for i in polygon.vertices))
            assert points not in faces, 'Duplicate coplanar face'
            faces.add(points)
    metadata = {'id': 'house-' + variant, 'units': 'metres', 'up': 'Y',
        'door': {'position': [0, 0, 4], 'width': 1.4, 'height': 2.4},
        'colliders': [{'id': name, 'position': pos, 'size': size, 'kind': kind} for name, pos, size, kind in parts],
        'checks': {'doorTraversal': True, 'wallBlocking': True, 'duplicateFaces': 0},
        'triangles': len(faces) * 2}
    stem = out / ('house-' + variant)
    bpy.ops.wm.save_as_mainfile(filepath=str(stem.with_suffix('.blend')))
    bpy.ops.export_scene.gltf(filepath=str(stem.with_suffix('.glb')), export_format='GLB', export_yup=True, export_animations=False)
    stem.with_suffix('.json').write_text(json.dumps(metadata, indent=2))
    reports.append(metadata)
(out / 'report.json').write_text(json.dumps(reports, indent=2))
print('HOUSE_POC_PASS: 2 variants, door traversal, wall blocking, no duplicate faces')
