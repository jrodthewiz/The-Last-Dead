"""Blender 2.93 headless secondary-motion pass on the exact runtime skeletons.

Only idle/gait upper-body rotation samples are authored. The packed character,
weighted jaw/grips, bind matrices, foot tracks and combat clips remain exact.
The delivered GLB retains its original materials; neutral Blender proof masters
avoid the old importer's unsupported WebP extension. No runtime Blender needed.
"""
import bisect
import copy
import hashlib
import importlib.util
import json
import math
from pathlib import Path

import bpy
from mathutils import Euler, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/character-motion-polish'
MASTER = ROOT / '.art-source/motion-polish'
TEMP = ROOT / '.codex-temp/motion-polish'
spec = importlib.util.spec_from_file_location('rig_helpers', ROOT / 'scripts/rig-zombie-v05.py')
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def sample(times, rotations, time):
    index = max(0, min(len(times) - 2, bisect.bisect_right(times, time) - 1))
    fraction = min(1, max(0, (time - times[index]) / max(1e-9, times[index + 1] - times[index])))
    a, b = rotations[index], rotations[index + 1]
    return Quaternion((a[3], *a[:3])).slerp(Quaternion((b[3], *b[:3])), fraction)


def offset(bone, phase, idle, heavy):
    # The zero-at-boundary harmonics preserve closed loop endpoints and provide
    # a continuous derivative. Delayed response uses cosine-minus-one instead
    # of a phase-shifted sine that would change the original neutral pose.
    s = math.sin(phase)
    delayed = .75 * math.sin(phase) + .25 * (math.cos(phase) - 1)
    breath = math.sin(phase * 2)
    factor = .7 if heavy else 1
    if idle:
        values = {'Spine': (.012 * breath, 0, .012 * s),
                  'Spine01': (.009 * breath, 0, -.010 * s),
                  'neck': (.010 * delayed, .025 * s, -.012 * delayed),
                  'Head': (.012 * delayed, -.030 * s, .016 * delayed),
                  'LeftShoulder': (.012 * breath, 0, .016 * s),
                  'RightShoulder': (-.010 * breath, 0, -.013 * s)}
    else:
        values = {'Spine': (.014 * breath, -.028 * s, -.022 * s),
                  'Spine01': (.010 * breath, .020 * s, .012 * s),
                  'neck': (.012 * delayed, -.022 * delayed, .014 * delayed),
                  'Head': (-.016 * delayed, .032 * delayed, -.018 * delayed),
                  'LeftShoulder': (.021 * s, -.013 * delayed, .018 * s),
                  'RightShoulder': (-.018 * s, .011 * delayed, -.015 * s)}
    return Quaternion(Euler(tuple(v * factor for v in values[bone]), 'XYZ'))


def author(source, target, character):
    baseline = MASTER / source.name
    if not baseline.exists():
        baseline.write_bytes(source.read_bytes())
    # Rebuild from the preserved input, making repeat runs deterministic.
    asset = helpers.Glb(baseline)
    original = helpers.Glb(baseline)
    selected = ('TLD_Idle', 'TLD_Walk') if character == 'warden' else (
        'AshWitness_Idle', 'AshWitness_Shuffle', 'AshWitness_Chase')
    secondary = {'Spine', 'Spine01', 'neck', 'Head', 'LeftShoulder', 'RightShoulder'}
    changes = []
    for clip in asset.doc['animations']:
        if clip['name'] not in selected:
            continue
        idle = 'Idle' in clip['name']
        duration = max(asset.accessor(s['input'])[-1][0] for s in clip['samplers'])
        for channel in clip['channels']:
            bone = asset.doc['nodes'][channel['target']['node']]['name']
            if channel['target']['path'] != 'rotation' or bone not in secondary:
                continue
            old = clip['samplers'][channel['sampler']]
            if old.get('interpolation', 'LINEAR') != 'LINEAR':
                raise RuntimeError('Expected linear quaternion runtime tracks')
            times = [v[0] for v in asset.accessor(old['input'])]
            rotations = asset.accessor(old['output'])
            count = max(2, math.ceil(duration * 60))
            new_times = [duration * i / count for i in range(count + 1)]
            values, previous, maximum = [], None, 0
            for i, time in enumerate(new_times):
                base = sample(times, rotations, time)
                # Preserve the original boundary orientations (unit quaternions).
                q = base if i in (0, count) else base @ offset(bone, 2 * math.pi * time / duration, idle, character == 'warden')
                q.normalize()
                maximum = max(maximum, base.rotation_difference(q).angle)
                if previous is not None and previous.dot(q) < 0:
                    q.negate()
                values.append((q.x, q.y, q.z, q.w))
                previous = q
            new_input = asset.add_accessor(new_times, 'SCALAR')
            asset.doc['accessors'][new_input].update(min=[0], max=[duration])
            new_output = asset.add_accessor(values, 'VEC4')
            channel['sampler'] = len(clip['samplers'])
            clip['samplers'].append({'input': new_input, 'output': new_output, 'interpolation': 'LINEAR'})
            changes.append({'clip': clip['name'], 'bone': bone, 'samples': len(values), 'maxOffsetRadians': maximum})
        # Discard now-unused samplers, keeping original channel order intact.
        indices = sorted({channel['sampler'] for channel in clip['channels']})
        remap = {old: new for new, old in enumerate(indices)}
        clip['samplers'] = [clip['samplers'][i] for i in indices]
        for channel in clip['channels']:
            channel['sampler'] = remap[channel['sampler']]
    helpers.compact_reachable(asset)
    asset.doc['asset'].setdefault('extras', {})['secondaryMotionVersion'] = 6
    asset.save(target)
    # Refuse delivery if authoring touched anything outside the motion scope.
    delivered = helpers.Glb(target)
    for key in ('nodes', 'materials', 'textures', 'images', 'skins', 'meshes'):
        if key in ('nodes', 'materials', 'textures'):
            assert delivered.doc.get(key) == original.doc.get(key), key
    for a, b in zip(original.doc['meshes'], delivered.doc['meshes']):
        for pa, pb in zip(a['primitives'], b['primitives']):
            for attr, index in pa['attributes'].items():
                assert original.accessor(index) == delivered.accessor(pb['attributes'][attr]), attr
            assert original.accessor(pa['indices']) == delivered.accessor(pb['indices']), 'indices'
    assert original.accessor(original.doc['skins'][0]['inverseBindMatrices']) == delivered.accessor(delivered.doc['skins'][0]['inverseBindMatrices'])
    for i in range(len(original.doc.get('images', []))):
        assert helpers.image_bytes(original, i) == helpers.image_bytes(delivered, i), 'packed image'
    changed = {(r['clip'], r['bone']) for r in changes}
    untouched = 0
    for before, after in zip(original.doc['animations'], delivered.doc['animations']):
        assert before['name'] == after['name'] and before.get('extras') == after.get('extras')
        for ca, cb in zip(before['channels'], after['channels']):
            assert ca['target'] == cb['target']
            bone = original.doc['nodes'][ca['target']['node']]['name']
            if (before['name'], bone) in changed and ca['target']['path'] == 'rotation':
                continue
            sa, sb = before['samplers'][ca['sampler']], after['samplers'][cb['sampler']]
            for key in ('input', 'output'):
                assert original.accessor(sa[key]) == delivered.accessor(sb[key]), (before['name'], bone, key)
            untouched += 1
    return delivered, {'character': character, 'source': str(baseline.relative_to(ROOT)),
                       'sourceSha256': digest(baseline.read_bytes()), 'output': str(target.relative_to(ROOT)),
                       'outputSha256': digest(target.read_bytes()), 'bytes': target.stat().st_size,
                       'changes': changes, 'preservedChannels': untouched,
                       'geometryBindTextureAndCombatExact': True}


def proof(asset, character):
    # Import exactly the delivered motion/rest hierarchy. Preview materials are
    # deliberately neutral; runtime GLB materials never go through this path.
    preview = copy.deepcopy(asset)
    preview.doc.pop('extensionsUsed', None)
    preview.doc.pop('extensionsRequired', None)
    for key in ('images', 'textures', 'samplers'):
        preview.doc.pop(key, None)
    for material in preview.doc.get('materials', []):
        material.clear()
        material.update({'pbrMetallicRoughness': {'baseColorFactor': [.48, .42, .37, 1], 'roughnessFactor': .85}})
    path = TEMP / (character + '-proof.glb')
    preview.save(path)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 60
    bpy.ops.import_scene.gltf(filepath=str(path))
    scene = bpy.context.scene
    rig = next(obj for obj in scene.objects if obj.type == 'ARMATURE')
    actions = list(bpy.data.actions)
    for action in actions:
        action.use_fake_user = True
    rig.animation_data_clear()
    rig.animation_data_create()
    bpy.context.preferences.filepaths.save_version = 0
    blend = MASTER / (character + '-motion-v06.blend')
    scene['runtimeMotionSource'] = str(path)
    scene['materials'] = 'Neutral motion proof; runtime packed textures preserved exactly'
    # Preserve editable NLA actions in the master.
    for action in actions:
        track = rig.animation_data.nla_tracks.new()
        track.name = action.name
        track.strips.new(action.name, 0, action)
        track.mute = True
    points = [obj.matrix_world @ Vector(corner) for obj in scene.objects if obj.type == 'MESH' for corner in obj.bound_box]
    low = Vector(tuple(min(v[i] for v in points) for i in range(3)))
    high = Vector(tuple(max(v[i] for v in points) for i in range(3)))
    center = (low + high) * .5
    camera_data = bpy.data.cameras.new('MotionCamera')
    camera = bpy.data.objects.new('MotionCamera', camera_data)
    scene.collection.objects.link(camera)
    height = high.z - low.z
    camera.location = center + Vector((height * .9, -height * 2.8, height * .15))
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = height * 1.35
    scene.camera = camera
    scene.world = bpy.data.worlds.new('MotionWorld')
    scene.world.color = (.045, .045, .045)
    for name, delta, energy in [('Key', (-2, -3, 3), 650), ('Fill', (2, -1, 2), 350)]:
        data = bpy.data.lights.new(name, 'AREA')
        data.energy, data.size = energy, height * 2
        light = bpy.data.objects.new(name, data)
        scene.collection.objects.link(light)
        light.location = center + Vector(delta) * height
        light.rotation_euler = (center - light.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.taa_render_samples = 16
    scene.render.resolution_x, scene.render.resolution_y = 320, 420
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'Standard'
    records = []
    labels = ['TLD_Idle', 'TLD_Walk'] if character == 'warden' else ['AshWitness_Idle', 'AshWitness_Shuffle', 'AshWitness_Chase']
    for label in labels:
        action = next(a for a in actions if a.name == label or a.name.startswith(label + '_'))
        rig.animation_data.action = action
        start, end = action.frame_range
        for phase in (.0, .25, .5, .75):
            frame = start + (end - start) * phase
            scene.frame_set(int(frame), subframe=frame % 1)
            filename = character + '-' + label + '-' + str(int(phase * 100)) + '.png'
            scene.render.filepath = str(OUT / filename)
            bpy.ops.render.render(write_still=True)
            records.append(filename)
    # Open the editable master on a readable idle with the review camera set.
    rig.animation_data.action = next(a for a in actions if 'Idle' in a.name)
    scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    return str(blend.relative_to(ROOT)), records


def main():
    for directory in (OUT, MASTER, TEMP):
        directory.mkdir(parents=True, exist_ok=True)
    records = []
    for character, source, target in [
        ('zombie', 'afterlife-ash-witness-rig-v05.glb', 'afterlife-ash-witness-motion-v06.glb'),
        ('warden', 'bloodworks-warden.glb', 'bloodworks-warden.glb')]:
        asset, report = author(ROOT / 'assets/models' / source, ROOT / 'assets/models' / target, character)
        report['blend'], report['renders'] = proof(asset, character)
        records.append(report)
        (OUT / 'validation.json').write_text(json.dumps(records, indent=2) + '\n', encoding='utf8')
        print(json.dumps({'character': character, 'changedTracks': len(report['changes']), 'preservedChannels': report['preservedChannels'], 'bytes': report['bytes']}))


if __name__ == '__main__':
    main()
