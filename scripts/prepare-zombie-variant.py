"""Offline, proportion-preserving Meshy zombie animation preparation.

Run Blender --background --python scripts/prepare-zombie-variant.py --
  --input raw-rig.glb --output assets/models/zombie-variant-motion-v07.glb
  --report docs/zombie-variants/variant-rig.json

No service calls, credentials, downloads, or provider tasks occur here. Mesh
positions, normals, UVs, indices, materials, and embedded images are preserved.
Only support-rig weights, canonical bone names, normalization, and animations
are authored. The input is never overwritten.
"""
import argparse
import bisect
import copy
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys

import numpy as np
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('zombie_rig_helpers', ROOT / 'scripts/rig-zombie-v05.py')
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)

MANDATORY = ['Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'Head'] + [
    side + bone for side in ('Left', 'Right')
    for bone in ('Shoulder', 'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot')]
LOOPS = {'AshWitness_Idle', 'AshWitness_Shuffle', 'AshWitness_Chase',
         'AshWitness_Run', 'AshWitness_Crawl', 'AshWitness_CrawlIdle', 'AshWitness_Contort'}
CONTROLS = ('Jaw', 'LeftGrip', 'RightGrip')


def rounded(value):
    return round(float(value), 6)


def matrix(values):
    return Matrix([values[i::4] for i in range(4)])


def serial_matrix(value):
    return tuple(value[row][column] for column in range(4) for row in range(4))


def compose(p, q, s):
    return Matrix.Translation(p) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((*s, 1))


def node_trs(node, value):
    p, q, s = value.decompose()
    node.pop('matrix', None)
    node.update(translation=list(p), rotation=[q.x, q.y, q.z, q.w], scale=list(s))


def normalized_accessor(asset, index):
    entry = asset.doc['accessors'][index]
    values = np.array(asset.accessor(index), dtype=np.float64)
    if entry.get('normalized'):
        maximum = {5121: 255, 5123: 65535}.get(entry['componentType'])
        if maximum is None:
            raise ValueError('Unsupported normalized accessor ' + str(entry['componentType']))
        values /= maximum
    return values


def require_supported(asset):
    if len(asset.doc.get('skins', [])) != 1:
        raise ValueError('A variant must have exactly one humanoid skin')
    if asset.doc.get('buffers', [{}])[0].get('uri'):
        raise ValueError('Input must be a self-contained GLB')
    if any(image.get('uri') for image in asset.doc.get('images', [])):
        raise ValueError('All provider images must be embedded before authoring')
    for mesh in asset.doc.get('meshes', []):
        for primitive in mesh['primitives']:
            if 'KHR_draco_mesh_compression' in primitive.get('extensions', {}):
                raise ValueError('Decode Draco before authoring')
            for semantic in ('POSITION', 'JOINTS_0', 'WEIGHTS_0'):
                if semantic not in primitive['attributes']:
                    raise ValueError('Every variant primitive must be skinned: missing ' + semantic)
            if 'JOINTS_1' in primitive['attributes']:
                raise ValueError('Eight-influence skins need consolidation before authoring')


class Skeleton:
    def __init__(self, asset, global_transform=None):
        self.asset = asset
        self.skin = asset.doc['skins'][0]
        self.joints = self.skin['joints']
        self.names = {n.get('name', ''): i for i, n in enumerate(asset.doc['nodes'])}
        self.inverse = [matrix(v) for v in asset.accessor(self.skin['inverseBindMatrices'])]
        transform = global_transform or Matrix.Identity(4)
        self.bind = {node: transform @ inverse.inverted() for node, inverse in zip(self.joints, self.inverse)}
        self.local = [asset.local_matrix(i) for i in range(len(asset.doc['nodes']))]
        self.order = sorted(self.joints, key=self.depth)
        self.rest = [v.copy() for v in self.local]
        for node in self.order:
            parent = asset.parents.get(node)
            parent_world = self.bind[parent] if parent in self.bind else self.default_world(parent)
            self.rest[node] = parent_world.inverted() @ self.bind[node]
        self.local = [v.copy() for v in self.rest]
        self.cache = {}
        self.primitives = []
        for mesh in asset.doc['meshes']:
            for primitive in mesh['primitives']:
                attribute = primitive['attributes']
                positions = normalized_accessor(asset, attribute['POSITION'])
                self.primitives.append({
                    'primitive': primitive,
                    'points': np.column_stack((positions, np.ones(len(positions)))),
                    'joints': np.array(asset.accessor(attribute['JOINTS_0']), dtype=np.int64),
                    'weights': normalized_accessor(asset, attribute['WEIGHTS_0']),
                })

    def depth(self, node):
        count = 0
        while node in self.asset.parents:
            node = self.asset.parents[node]
            count += 1
        return count

    def default_world(self, node):
        if node is None:
            return Matrix.Identity(4)
        parent = self.asset.parents.get(node)
        return self.default_world(parent) @ self.asset.local_matrix(node)

    def reset(self):
        self.local = [m.copy() for m in self.rest]
        self.cache.clear()

    def world(self, node):
        if isinstance(node, str):
            node = self.names[node]
        if node not in self.cache:
            parent = self.asset.parents.get(node)
            self.cache[node] = (self.world(parent) if parent is not None else Matrix.Identity(4)) @ self.local[node]
        return self.cache[node]

    def position(self, name, desired):
        node = self.names[name]
        parent = self.asset.parents.get(node)
        self.local[node].translation = self.world(parent).inverted() @ desired if parent is not None else desired
        self.cache.clear()

    def rotation(self, name, desired):
        node = self.names[name]
        parent = self.asset.parents.get(node)
        q = self.world(parent).to_quaternion().inverted() @ desired if parent is not None else desired
        p, _, s = self.local[node].decompose()
        self.local[node] = compose(p, q.normalized(), s)
        self.cache.clear()

    def limb(self, upper, lower, end, desired, pole):
        a, b, c = [self.world(name).translation.copy() for name in (upper, lower, end)]
        l1, l2 = (b - a).length, (c - b).length
        displacement = desired - a
        direction = displacement.normalized()
        distance = max(abs(l1 - l2) + .001, min(displacement.length, l1 + l2 - .001))
        bend = pole - direction * pole.dot(direction)
        if bend.length < .0001:
            bend = Vector((0, 0, 1)) - direction * direction.z
        bend.normalize()
        along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance)
        elbow = a + direction * along + bend * math.sqrt(max(0, l1 * l1 - along * along))
        self.rotation(upper, (b - a).rotation_difference(elbow - a) @ self.world(upper).to_quaternion())
        b, c = self.world(lower).translation.copy(), self.world(end).translation.copy()
        self.rotation(lower, (c - b).rotation_difference(a + direction * distance - b) @ self.world(lower).to_quaternion())
        return (self.world(end).translation - desired).length

    def bounds(self, selected=None):
        matrices = np.array([self.world(node) @ inverse for node, inverse in zip(self.joints, self.inverse)], dtype=np.float64)
        low = np.full(3, np.inf)
        high = np.full(3, -np.inf)
        for primitive_index, primitive in enumerate(self.primitives):
            points = primitive['points']
            joints, weights = primitive['joints'], primitive['weights']
            if selected is not None:
                selection = selected[primitive_index]
                points, joints, weights = points[selection], joints[selection], weights[selection]
            if not len(points):
                continue
            deformed = np.zeros((len(points), 4), dtype=np.float64)
            for slot in range(4):
                deformed += np.einsum('nij,nj->ni', matrices[joints[:, slot]], points) * weights[:, slot, None]
            low = np.minimum(low, deformed[:, :3].min(axis=0))
            high = np.maximum(high, deformed[:, :3].max(axis=0))
        return {'min': [rounded(v) for v in low], 'max': [rounded(v) for v in high],
                'height': rounded(high[1] - low[1])}


class Evaluator:
    def __init__(self, skeleton, animation):
        self.skeleton = skeleton
        self.channels = []
        for channel in animation['channels']:
            sampler = animation['samplers'][channel['sampler']]
            interpolation = sampler.get('interpolation', 'LINEAR')
            if interpolation not in ('LINEAR', 'STEP'):
                raise ValueError('Unsupported source interpolation ' + interpolation)
            self.channels.append((channel['target']['node'], channel['target']['path'],
                                  [v[0] for v in skeleton.asset.accessor(sampler['input'])],
                                  skeleton.asset.accessor(sampler['output']), interpolation))
        self.duration = max(times[-1] for _, _, times, _, _ in self.channels)

    def sample(self, time):
        self.skeleton.reset()
        for node, path, times, values, interpolation in self.channels:
            lo = max(0, min(len(times) - 1, bisect.bisect_right(times, time) - 1))
            hi = min(lo + 1, len(times) - 1)
            alpha = 0 if interpolation == 'STEP' else max(0, min(1, (time - times[lo]) / max(1e-9, times[hi] - times[lo])))
            p, q, s = self.skeleton.local[node].decompose()
            if path == 'rotation':
                a, b = values[lo], values[hi]
                q = Quaternion((a[3], *a[:3])).slerp(Quaternion((b[3], *b[:3])), alpha).normalized()
            elif path == 'translation':
                p = Vector(values[lo]).lerp(Vector(values[hi]), alpha)
            elif path == 'scale':
                s = Vector(values[lo]).lerp(Vector(values[hi]), alpha)
            else:
                raise ValueError('Unsupported source channel ' + path)
            self.skeleton.local[node] = compose(p, q, s)
        self.skeleton.cache.clear()


def canonical_names(asset):
    joints = asset.doc['skins'][0]['joints']
    named = {asset.doc['nodes'][i].get('name', '').split(':')[-1].lower().replace('_', ''): i for i in joints}
    aliases = {'Hips': ('hips', 'pelvis'), 'Head': ('head',), 'neck': ('neck', 'neck1')}
    for side in ('Left', 'Right'):
        lower = side.lower()
        for role, alternatives in {
            'Shoulder': ('shoulder', 'clavicle'), 'Arm': ('arm', 'upperarm'),
            'ForeArm': ('forearm', 'lowerarm'), 'Hand': ('hand', 'wrist'),
            'UpLeg': ('upleg', 'thigh', 'upperleg'), 'Leg': ('leg', 'calf', 'lowerleg'),
            'Foot': ('foot', 'ankle'), 'ToeBase': ('toebase', 'toe')}.items():
            aliases[side + role] = tuple(lower + part for part in alternatives)
    mapped = {}
    for role, choices in aliases.items():
        candidate = next((named[name] for name in choices if name in named), None)
        if candidate is not None:
            mapped[role] = candidate
    if 'neck' not in mapped or 'Hips' not in mapped:
        raise ValueError('Missing hips/neck; supported rigs are Meshy or Mixamo-style humanoids')
    chain = []
    node = asset.parents.get(mapped['neck'])
    while node is not None and node != mapped['Hips']:
        if node in joints:
            chain.append(node)
        node = asset.parents.get(node)
    chain.reverse()
    if len(chain) != 3:
        raise ValueError('Need exactly three independent spine joints, found ' + str(len(chain)))
    mapped.update(zip(('Spine02', 'Spine01', 'Spine'), chain))
    for name in ('Jaw', 'LeftGrip', 'RightGrip', 'headfront', 'head_end', 'Tongue'):
        candidate = next((i for i in joints if asset.doc['nodes'][i].get('name') == name), None)
        if candidate is not None:
            mapped[name] = candidate
    missing = set(MANDATORY) - set(mapped)
    if missing:
        raise ValueError('Missing anatomical chains: ' + ', '.join(sorted(missing)))
    for side in ('Left', 'Right'):
        for upper, lower, end in [('Arm', 'ForeArm', 'Hand'), ('UpLeg', 'Leg', 'Foot')]:
            if asset.parents.get(mapped[side + lower]) != mapped[side + upper] or asset.parents.get(mapped[side + end]) != mapped[side + lower]:
                raise ValueError('Unsupported branching/twist chain: ' + side + upper)
    skeleton = Skeleton(asset)
    for side in ('Left', 'Right'):
        for upper, lower, end in [('Arm', 'ForeArm', 'Hand'), ('UpLeg', 'Leg', 'Foot')]:
            a, b, c = [skeleton.bind[mapped[side + name]].translation for name in (upper, lower, end)]
            if min((b - a).length, (c - b).length) < .03:
                raise ValueError('Degenerate limb segment: ' + side + upper)
    changes = []
    for role, node in mapped.items():
        old = asset.doc['nodes'][node].get('name', '')
        if old != role:
            changes.append({'from': old, 'to': role})
            asset.doc['nodes'][node]['name'] = role
    return changes


def normalize(asset, height):
    model = Skeleton(asset)
    bounds = model.bounds()
    if bounds['height'] <= 0:
        raise ValueError('Invalid bind height')
    left = model.bind[model.names['LeftHand']].translation
    right = model.bind[model.names['RightHand']].translation
    across = left - right
    up = model.bind[model.names['Head']].translation - model.bind[model.names['Hips']].translation
    if up.normalized().dot(Vector((0, 1, 0))) < .85:
        raise ValueError('Rig must use +Y up')
    yaw = math.atan2(across.z, across.x)
    factor = height / bounds['height']
    rotation = Quaternion((0, 1, 0), yaw).to_matrix().to_4x4()
    transform = rotation @ Matrix.Diagonal((factor, factor, factor, 1))
    center = Vector(((bounds['min'][0] + bounds['max'][0]) / 2, bounds['min'][1],
                     (bounds['min'][2] + bounds['max'][2]) / 2))
    transform.translation = -(transform.to_3x3() @ center)
    scene = asset.doc['scenes'][asset.doc.get('scene', 0)]
    wrapper = len(asset.doc['nodes'])
    node = {'name': 'ZombieVariant_Normalization', 'children': list(scene['nodes']),
            'extras': {'visualOnly': True, 'heightMeters': height}}
    node_trs(node, transform)
    asset.doc['nodes'].append(node)
    for child in node['children']:
        asset.parents[child] = wrapper
    scene['nodes'] = [wrapper]
    return transform, {'originalBindBounds': bounds, 'scale': rounded(factor), 'yawRadians': rounded(yaw)}


def support_rig(asset, transform):
    model = Skeleton(asset, transform)
    skin = model.skin
    inverse_values = list(asset.accessor(skin['inverseBindMatrices']))
    controls = []
    for name in CONTROLS:
        parent_name = 'Head' if name == 'Jaw' else name.replace('Grip', 'Hand')
        parent = model.names[parent_name]
        parent_joint = skin['joints'].index(parent)
        existing = model.names.get(name)
        if existing is not None:
            metadata = {'role': 'jaw' if name == 'Jaw' else 'grip', 'axis': [1, 0, 0],
                        'maxAngleRadians': .38 if name == 'Jaw' else .55,
                        'sign': 1 if name == 'Jaw' or name.startswith('Right') else -1}
            asset.doc['nodes'][existing].setdefault('extras', {}).setdefault('articulation', metadata)
            controls.append({'name': name, 'retained': True})
            continue
        eligible = {parent_joint}
        for joint_index, node_index in enumerate(skin['joints']):
            ancestor = asset.parents.get(node_index)
            while ancestor is not None:
                if ancestor == parent:
                    eligible.add(joint_index)
                    break
                ancestor = asset.parents.get(ancestor)
        candidates = []
        for primitive in model.primitives:
            mask = np.isin(primitive['joints'], list(eligible))
            amount = np.sum(primitive['weights'] * mask, axis=1)
            candidates.extend([transform @ Vector(point[:3]) for point in primitive['points'][amount > .5]])
        if len(candidates) < 30:
            raise ValueError('Not enough independently weighted skin for ' + name)
        p = model.bind[parent].translation
        parent_scale = model.bind[parent].to_scale()
        if name == 'Jaw':
            low = Vector(tuple(min(v[i] for v in candidates) for i in range(3)))
            high = Vector(tuple(max(v[i] for v in candidates) for i in range(3)))
            extent = high - low
            pivot = Vector((p.x, low.y + extent.y * .40, low.z + extent.z * .43))
            orientation = Quaternion((1, 0, 0, 0))
            def influence(point):
                if point.y > low.y + extent.y * .47 or point.z < low.z + extent.z * .47:
                    return 0
                horizontal = abs(point.x - p.x) / max(.001, extent.x * .50)
                if horizontal > .85:
                    return 0
                return .72 * max(0, min(1, (low.y + extent.y * .47 - point.y) / max(.001, extent.y * .12)))
        else:
            forearm = model.bind[model.names[parent_name.replace('Hand', 'ForeArm')]].translation
            direction = (p - forearm).normalized()
            distances = [(point - p).dot(direction) for point in candidates]
            length = max(distances)
            if length < .035:
                raise ValueError('No separated distal hand silhouette for ' + name)
            pivot = p + direction * length * .28
            orientation = Quaternion((0, 1, 0), -math.pi / 2)
            def influence(point):
                distance = (point - p).dot(direction) / max(.001, length)
                return .90 * max(0, min(1, (distance - .28) / .35))
        world = compose(pivot, orientation, parent_scale)
        local = model.bind[parent].inverted() @ world
        node = {'name': name, 'extras': {'rigVersion': 7, 'weighted': True, 'articulation': {
            'role': 'jaw' if name == 'Jaw' else 'grip', 'axis': [1, 0, 0],
            'maxAngleRadians': .38 if name == 'Jaw' else .55,
            'sign': 1 if name == 'Jaw' or name.startswith('Right') else -1}}}
        node_trs(node, local)
        index = len(asset.doc['nodes'])
        asset.doc['nodes'].append(node)
        asset.doc['nodes'][parent].setdefault('children', []).append(index)
        asset.parents[index] = parent
        joint = len(skin['joints'])
        skin['joints'].append(index)
        inverse_values.append(serial_matrix(world.inverted() @ transform))
        count = 0
        moved_mass = 0
        for primitive in model.primitives:
            ids = primitive['joints'].copy()
            weights = primitive['weights'].copy()
            for vertex, raw in enumerate(primitive['points']):
                point = transform @ Vector(raw[:3])
                amount = influence(point)
                if amount <= 0:
                    continue
                contributions = {}
                transfer = 0
                for old_joint, old_weight in zip(ids[vertex], weights[vertex]):
                    moved = float(old_weight) * amount if old_joint in eligible else 0
                    transfer += moved
                    contributions[int(old_joint)] = contributions.get(int(old_joint), 0) + float(old_weight) - moved
                if transfer < .01:
                    continue
                contributions[joint] = transfer
                best = sorted(contributions.items(), key=lambda value: -value[1])[:4]
                total = sum(weight for _, weight in best)
                best += [(0, 0)] * (4 - len(best))
                ids[vertex] = [j for j, _ in best]
                weights[vertex] = [w / total for _, w in best]
                count += 1
                moved_mass += transfer
            primitive['primitive']['attributes']['JOINTS_0'] = asset.add_accessor(ids.tolist(), 'VEC4', 5123, 34962)
            primitive['primitive']['attributes']['WEIGHTS_0'] = asset.add_accessor(weights.tolist(), 'VEC4', 5126, 34962)
            primitive['joints'] = ids
            primitive['weights'] = weights
        if count < 20:
            raise ValueError('Support rig would not visibly deform ' + name)
        controls.append({'name': name, 'retained': False, 'weightedVertices': count,
                         'weightMass': rounded(moved_mass), 'worldPivot': [rounded(v) for v in pivot]})
    skin['inverseBindMatrices'] = asset.add_accessor(inverse_values, 'MAT4')
    return controls


def attachment_sockets(asset, transform):
    model = Skeleton(asset, transform)
    specs = [('Head', 'Head', (0, .035, .015)), ('Neck', 'neck', (0, 0, .025)),
             ('Chest', 'Spine', (0, -.05, .105)), ('Abdomen', 'Spine02', (0, .02, .105)),
             ('LeftWrist', 'LeftHand', (0, 0, 0)), ('RightWrist', 'RightHand', (0, 0, 0))]
    sockets = []
    for role, parent_name, delta in specs:
        name = 'Socket_' + role
        if name in model.names:
            sockets.append({'name': name, 'retained': True})
            continue
        parent = model.names[parent_name]
        world = compose(model.bind[parent].translation + Vector(delta), Quaternion((1, 0, 0, 0)),
                        model.bind[parent].to_scale())
        node = {'name': name, 'extras': {'attachmentSocket': True, 'role': role.lower(), 'rigVersion': 7}}
        node_trs(node, model.bind[parent].inverted() @ world)
        index = len(asset.doc['nodes'])
        asset.doc['nodes'].append(node)
        asset.doc['nodes'][parent].setdefault('children', []).append(index)
        asset.parents[index] = parent
        sockets.append({'name': name, 'parent': parent_name, 'retained': False})
    return sockets


def retarget(source, target, report, fps):
    source_model = Skeleton(source)
    model = Skeleton(target, matrix(report['normalization']['matrix']))
    for joint in model.joints:
        node_trs(target.doc['nodes'][joint], model.rest[joint])
    source_height = source_model.bind[source_model.names['Head']].translation.y - source_model.bind[source_model.names['LeftFoot']].translation.y
    target_height = model.bind[model.names['Head']].translation.y - model.bind[model.names['LeftFoot']].translation.y
    ratio = target_height / source_height
    target.doc['animations'] = []
    source_bind_q = {name: source_model.bind[index].to_quaternion() for name, index in source_model.names.items() if index in source_model.bind}
    target_bind_q = {name: model.bind[index].to_quaternion() for name, index in model.names.items() if index in model.bind}
    rest_alignment = {}
    limb_specs = [(side + upper, side + lower, side + end)
                  for side in ('Left', 'Right')
                  for upper, lower, end in [('Arm', 'ForeArm', 'Hand'), ('UpLeg', 'Leg', 'Foot')]]
    for upper, lower, end in limb_specs:
        for a, b in ((upper, lower), (lower, end), (end, None)):
            reference_a, reference_b = (lower, end) if b is None else (a, b)
            toe = end.replace('Foot', 'ToeBase')
            if b is None and end.endswith('Foot') and toe in source_model.names and toe in model.names:
                reference_a, reference_b = end, toe
            source_axis = source_model.bind[source_model.names[reference_b]].translation - source_model.bind[source_model.names[reference_a]].translation
            target_axis = model.bind[model.names[reference_b]].translation - model.bind[model.names[reference_a]].translation
            rest_alignment[a] = target_axis.rotation_difference(source_axis)
    for side in ('Left', 'Right'):
        rest_alignment[side + 'Grip'] = rest_alignment[side + 'Hand']
    source_hip = source_model.bind[source_model.names['Hips']].translation
    target_hip = model.bind[model.names['Hips']].translation
    for animation in source.doc['animations']:
        evaluate = Evaluator(source_model, animation)
        name = animation['name']
        duration = evaluate.duration
        steps = max(2, round(duration * fps))
        times = [duration * i / steps for i in range(steps + 1)]
        if name == 'AshWitness_AttackLunge':
            times = sorted(set(times + [.375]))
        poses = []
        maximum_reach_error = 0
        for time in times:
            evaluate.sample(time)
            model.reset()
            delta = source_model.world('Hips').translation - source_hip
            model.position('Hips', target_hip + delta * ratio)
            for node in model.order:
                bone = target.doc['nodes'][node]['name']
                if bone in source_bind_q:
                    alignment = rest_alignment.get(bone, Quaternion((1, 0, 0, 0)))
                    desired = source_model.world(bone).to_quaternion() @ source_bind_q[bone].inverted() @ alignment @ target_bind_q[bone]
                    model.rotation(bone, desired)
            # IK keeps the four distal contacts in the same world-space motion
            # language while retaining every target segment's own bind length.
            # This also handles a provider's neutral arms-down bind pose.
            posed_hip = model.world('Hips').translation.copy()
            source_posed_hip = source_model.world('Hips').translation
            for upper, lower, end in limb_specs:
                goal = posed_hip + (source_model.world(end).translation - source_posed_hip) * ratio
                pole = source_model.world(lower).translation - source_model.world(upper).translation
                end_orientation = model.world(end).to_quaternion().copy()
                error = model.limb(upper, lower, end, goal, pole)
                maximum_reach_error = max(maximum_reach_error, error)
                model.rotation(end, end_orientation)
            poses.append([value.copy() for value in model.local])
        ground = math.inf
        for sample in range(0, len(poses), 3):
            model.local = [v.copy() for v in poses[sample]]
            model.cache.clear()
            ground = min(ground, model.bounds()['min'][1])
        offset = .012 - ground
        parent = target.parents.get(model.names['Hips'])
        scale_y = model.world(parent).to_scale().y
        for pose in poses:
            pose[model.names['Hips']].translation.y += offset / scale_y
        run_support = None
        if name == 'AshWitness_Run':
            # Provider soles carry different calf/ankle blend weights. A
            # constant floor offset can leave them floating in mid-stance.
            # Adapt vertical pelvis support to the actual complete sole while
            # preserving the authored .42 duty and two brief flight intervals.
            feet = {model.joints.index(model.names[side + bone])
                    for side in ('Left', 'Right') for bone in ('Foot', 'ToeBase')
                    if side + bone in model.names}
            foot_masks = []
            for primitive in model.primitives:
                amount = np.sum(primitive['weights'] * np.isin(primitive['joints'], list(feet)), axis=1)
                foot_masks.append(amount > .10)
            maximum_support_change = 0
            for time, pose in zip(times, poses):
                phase = time / duration
                flight = 0
                for a, b in ((.42, .5), (.92, 1)):
                    if a < phase < b:
                        flight = math.sin(math.pi * (phase - a) / (b - a)) ** 2
                model.local = [v.copy() for v in pose]
                model.cache.clear()
                minimum = model.bounds(foot_masks)['min'][1]
                correction = (.012 - minimum) * (1 - flight)
                pose[model.names['Hips']].translation.y += correction / scale_y
                maximum_support_change = max(maximum_support_change, abs(correction))
            run_support = {'supportDuty': .42, 'targetSoleClearanceMeters': .012,
                           'maximumPelvisSupportCorrectionMeters': rounded(maximum_support_change)}
        if name == 'AshWitness_Collapse':
            for pose in poses:
                model.local = [v.copy() for v in pose]
                model.cache.clear()
                pose[model.names['Hips']].translation.y += (.012 - model.bounds()['min'][1]) / scale_y
        output = {'name': name, 'samplers': [], 'channels': [], 'extras': copy.deepcopy(animation.get('extras', {}))}
        output['extras'].update(variantRetargetVersion=1, canonicalMotionVersion=7,
                                proportionScale=rounded(ratio))
        if run_support:
            output['extras']['variantRunSupport'] = run_support
        if 'strideMeters' in output['extras']:
            output['extras']['strideMeters'] *= ratio
        if name in LOOPS:
            output['extras']['loop'] = True
        time_accessor = target.add_accessor(times, 'SCALAR')
        maximum_length_error = 0
        for joint in model.joints:
            previous = None
            rotation_values, translation_values, scale_values = [], [], []
            for pose in poses:
                p, q, s = pose[joint].decompose()
                if previous is not None and previous.dot(q) < 0:
                    q.negate()
                previous = q.copy()
                rotation_values.append([q.x, q.y, q.z, q.w])
                translation_values.append(list(p))
                scale_values.append(list(s))
                if joint != model.names['Hips']:
                    maximum_length_error = max(maximum_length_error, (p - model.rest[joint].translation).length)
            for path, values, kind in [('rotation', rotation_values, 'VEC4'), ('translation', translation_values, 'VEC3'), ('scale', scale_values, 'VEC3')]:
                accessor = target.add_accessor(values, kind)
                sampler = len(output['samplers'])
                output['samplers'].append({'input': time_accessor, 'output': accessor, 'interpolation': 'LINEAR'})
                output['channels'].append({'sampler': sampler, 'target': {'node': joint, 'path': path}})
        if maximum_length_error > .0001:
            raise ValueError('Local bone translation changed in ' + name)
        evidence = []
        minimum_skin = math.inf
        for sample in sorted(set(range(0, len(poses), max(1, len(poses) // 12))) | {len(poses) - 1} | ({times.index(.375)} if name == 'AshWitness_AttackLunge' else set())):
            model.local = [v.copy() for v in poses[sample]]
            model.cache.clear()
            bounds = model.bounds()
            if not all(math.isfinite(v) for v in bounds['min'] + bounds['max']) or not .1 < bounds['height'] < 2.6:
                raise ValueError('Exploded/invalid skinned bounds in ' + name)
            minimum_skin = min(minimum_skin, bounds['min'][1])
            evidence.append({'time': rounded(times[sample]), 'bounds': bounds,
                             'head': [rounded(v) for v in model.world('Head').translation],
                             'leftHand': [rounded(v) for v in model.world('LeftHand').translation],
                             'rightHand': [rounded(v) for v in model.world('RightHand').translation]})
        if minimum_skin < -.035:
            raise ValueError('Skin below floor tolerance in ' + name)
        target.doc['animations'].append(output)
        report['clips'].append({'name': name, 'duration': rounded(duration), 'samples': len(times),
                                'groundCorrectionMeters': rounded(offset), 'minimumSkinY': minimum_skin,
                                'localLengthError': rounded(maximum_length_error),
                                'maximumIkReachErrorMeters': rounded(maximum_reach_error), 'evidence': evidence})
        if run_support:
            report['clips'][-1]['runSupport'] = run_support
    if len(target.doc['animations']) != 10:
        raise ValueError('Canonical library must contain ten clips')


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    parser.add_argument('--canonical', type=Path, default=ROOT / 'assets/models/afterlife-ash-witness-motion-v07.glb')
    parser.add_argument('--height', type=float, default=1.86)
    parser.add_argument('--fps', type=int, default=60)
    options = parser.parse_args(args)
    if options.input.resolve() == options.output.resolve():
        raise ValueError('Refusing to overwrite raw provider input')
    source, target = helpers.Glb(options.canonical), helpers.Glb(options.input)
    require_supported(source)
    require_supported(target)
    source_binary = bytes(target.binary)
    preserved = {key: copy.deepcopy(target.doc.get(key)) for key in ('materials', 'textures', 'images', 'samplers')}
    report = {'input': str(options.input.resolve()), 'output': str(options.output.resolve()),
              'canonical': str(options.canonical.resolve()), 'rawSha256': hashlib.sha256(target.raw).hexdigest(),
              'canonicalSha256': hashlib.sha256(source.raw).hexdigest(), 'clips': [],
              'retarget': 'source world rotation * inverse source bind rotation * target bind rotation; only Hips translates',
              'referenceLedger': [{'path': 'threejs-3d-generator/references/threejs-integration.md', 'read': True},
                                  {'path': 'threejs-procedural-animation/references/procedural-motion-and-docking-systems.md', 'read': True}]}
    report['renamedBones'] = canonical_names(target)
    transform, normalization = normalize(target, options.height)
    normalization['matrix'] = serial_matrix(transform)
    report['normalization'] = normalization
    report['supportRig'] = support_rig(target, transform)
    report['sockets'] = attachment_sockets(target, transform)
    target.doc['scenes'][target.doc.get('scene', 0)].setdefault('extras', {})['characterArticulation'] = {
        'rigVersion': 7, 'jaw': True, 'grips': True, 'controls': list(CONTROLS),
        'scope': 'weighted lower-face and distal-hand support controls; original skin topology retained'}
    retarget(source, target, report, options.fps)
    report['intake'] = {'meshes': len(target.doc['meshes']), 'materials': len(target.doc.get('materials', [])),
                        'images': len(target.doc.get('images', [])),
                        'triangles': sum((target.doc['accessors'][primitive['indices']]['count'] if 'indices' in primitive else target.doc['accessors'][primitive['attributes']['POSITION']]['count']) // 3
                                         for mesh in target.doc['meshes'] for primitive in mesh['primitives']),
                        'vertices': sum(target.doc['accessors'][primitive['attributes']['POSITION']]['count'] for mesh in target.doc['meshes'] for primitive in mesh['primitives'])}
    report['preservedSourceBinaryPrefix'] = bytes(target.binary[:len(source_binary)]) == source_binary
    report['preservedPbr'] = all(target.doc.get(key) == value for key, value in preserved.items())
    if not report['preservedPbr'] or not report['preservedSourceBinaryPrefix']:
        raise ValueError('Source preservation contract failed')
    options.output.parent.mkdir(parents=True, exist_ok=True)
    options.report.parent.mkdir(parents=True, exist_ok=True)
    target.save(options.output)
    report['bytes'] = options.output.stat().st_size
    report['outputSha256'] = hashlib.sha256(options.output.read_bytes()).hexdigest()
    report['jointCount'] = len(target.doc['skins'][0]['joints'])
    report['status'] = 'baked-awaiting-runtime-and-visual-validation'
    options.report.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'output': str(options.output), 'report': str(options.report),
                      'bytes': report['bytes'], 'clips': len(report['clips']), 'jointCount': report['jointCount']}))


if __name__ == '__main__':
    main()
