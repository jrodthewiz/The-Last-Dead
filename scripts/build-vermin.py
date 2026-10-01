"""Original metre-scale vermin kit, Blender 2.93 offline authoring.

Hybrid asset: native ImageGen fur/skin/chitin atlas plus authored profile
meshes and local relative shape keys. No source character or runtime file is
modified. glTF +Z faces forward; Y is up; object origins are on the floor.
"""
import hashlib
import json
import math
import shutil
import struct
import sys
from collections import Counter
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/vermin-v1'
MASTER = ROOT / '.art-source/vermin-v1'
OUTPUT = ROOT / 'assets/models/vermin-v1.glb'
SOURCE = Path('C:/Users/wolfk/.codex/generated_images/01a0ebc8-b456-7601-95ee-38cdda87a5df/exec-6cac08d0-8ded-4977-97ba-56274870ef2f.png')
TILES = {'fur': (0, 1), 'skin': (1, 1), 'chitin': (0, 0), 'mouth': (1, 0)}
MATERIAL = None


def bvec(p):
    return Vector((p[0], -p[2], p[1]))


def gvec(p):
    return Vector((p.x, p.z, -p.y))


def uv(role, u, v):
    tx, ty = TILES[role]
    return ((tx*512+16+max(0, min(1, u))*480)/1024,
            (ty*512+16+max(0, min(1, v))*480)/1024)


def material():
    shutil.copyfile(SOURCE, MASTER/'imagegen-source.png')
    source = bpy.data.images.load(str(MASTER/'imagegen-source.png'))
    source.pack()
    source.scale(1024, 1024)
    rgba = np.asarray(source.pixels[:], dtype=np.float32).reshape(1024, 1024, 4)
    color = rgba.copy()
    normal = np.ones_like(rgba)
    rough = np.ones_like(rgba)
    rng = np.random.RandomState(932701)
    yy, xx = np.mgrid[0:512, 0:512]
    x, y = xx/511, yy/511
    identities = {'fur': .94, 'skin': .72, 'chitin': .54, 'mouth': .64}
    for role, (tx, ty) in TILES.items():
        region = np.s_[ty*512:(ty+1)*512, tx*512:(tx+1)*512]
        patch = color[region].copy()
        # Retain generated colors and details, while compressing the broad
        # luminance contrast so painted lighting does not become white glare.
        lum = np.dot(patch[:, :, :3], (.2126, .7152, .0722))
        mean = max(.02, float(np.mean(lum)))
        gain = np.clip((mean*.25+lum*.75)/np.maximum(lum, .01), .60, 1.30)
        patch[:, :, :3] *= gain[:, :, None]
        if role == 'chitin':
            patch[:, :, :3] *= .68
        grain = rng.normal(0, 1, (512, 512))
        if role == 'fur':
            height = .010*lum+.004*np.sin(x*310+y*28+np.sin(y*40)*2)
        elif role == 'skin':
            height = .006*lum+.002*np.sin(y*185+x*4)
        elif role == 'chitin':
            height = .004*lum+.001*np.sin(x*150+y*90)
        else:
            height = .003*lum
        height += grain*.0006
        gy, gx = np.gradient(height)
        vectors = np.stack((-gx*18, -gy*18, np.ones_like(gx)), axis=-1)
        vectors /= np.linalg.norm(vectors, axis=-1, keepdims=True)
        normal[region][:, :, :3] = .5+vectors*.5
        rough[region][:, :, :3] = np.clip(identities[role]+grain[:, :, None]*.013+(lum[:, :, None]-mean)*.07, .35, .98)
        color[region] = patch
    images = []
    for name, pixels in [('vermin-albedo', color), ('vermin-normal', normal), ('vermin-roughness', rough)]:
        # Fine support maps are512: bounded pooled creatures do not justify
        # two megabytes of stochastic full-resolution micro-normal samples.
        resolution = 1024 if name == 'vermin-albedo' else 512
        if resolution == 512:
            pixels = pixels.reshape(512, 2, 512, 2, 4).mean(axis=(1, 3))
            if name == 'vermin-normal':
                vectors = pixels[:, :, :3]*2-1
                vectors /= np.linalg.norm(vectors, axis=-1, keepdims=True)
                pixels[:, :, :3] = vectors*.5+.5
        image = bpy.data.images.new(name, width=resolution, height=resolution, alpha=False)
        if name != 'vermin-albedo':
            image.colorspace_settings.name = 'Non-Color'
        image.pixels.foreach_set(pixels.flatten())
        image.filepath_raw = str(ART/(name+('.jpg' if name == 'vermin-albedo' else '.png')))
        image.file_format = 'JPEG' if name == 'vermin-albedo' else 'PNG'
        image.save()
        image.pack()
        images.append(image)
    mat = bpy.data.materials.new('Vermin_Shared_Atlas_PBR')
    mat.use_nodes = True
    tree = mat.node_tree
    shader = tree.nodes.get('Principled BSDF')
    shader.inputs['Metallic'].default_value = 0
    shader.inputs['Specular'].default_value = .24
    base = tree.nodes.new('ShaderNodeTexImage'); base.image = images[0]
    colors = tree.nodes.new('ShaderNodeVertexColor'); colors.layer_name = 'Surface_Tint'
    mult = tree.nodes.new('ShaderNodeMixRGB'); mult.blend_type = 'MULTIPLY'; mult.inputs[0].default_value = 1
    tree.links.new(base.outputs['Color'], mult.inputs[1]); tree.links.new(colors.outputs['Color'], mult.inputs[2])
    tree.links.new(mult.outputs[0], shader.inputs['Base Color'])
    rtex = tree.nodes.new('ShaderNodeTexImage'); rtex.image = images[2]
    tree.links.new(rtex.outputs['Color'], shader.inputs['Roughness'])
    ntex = tree.nodes.new('ShaderNodeTexImage'); ntex.image = images[1]
    bump = tree.nodes.new('ShaderNodeNormalMap'); bump.inputs['Strength'].default_value = .65
    tree.links.new(ntex.outputs['Color'], bump.inputs['Color']); tree.links.new(bump.outputs['Normal'], shader.inputs['Normal'])
    return mat


class Writer:
    def __init__(self):
        self.points, self.faces, self.uvs, self.colors, self.tags = [], [], [], [], []
        self.roles = []
        self.tag = 'body'

    def vertex(self, p, color=(1, 1, 1, 1)):
        self.points.append(Vector(p)); self.colors.append(color); self.tags.append(self.tag)
        return len(self.points)-1

    def face(self, indices, role, coords):
        if self.tag == 'jaw' and role == 'fur' and sum(self.points[i].y for i in indices)/len(indices) > .0406:
            role = 'mouth'
        self.faces.append(tuple(indices)); self.uvs.append([uv(role, *p) for p in coords])
        self.roles.append(role)

    def object(self, name, root):
        mesh = bpy.data.meshes.new(name+'_Authored_Indexed_Mesh')
        mesh.from_pydata([bvec(p) for p in self.points], [], self.faces); mesh.update()
        obj = bpy.data.objects.new(name, mesh); bpy.context.collection.objects.link(obj); obj.parent = root
        mesh.materials.append(MATERIAL)
        coords = mesh.uv_layers.new(name='Padded_Atlas_UV')
        tint = mesh.vertex_colors.new(name='Surface_Tint')
        for poly, values, role in zip(mesh.polygons, self.uvs, self.roles):
            poly.use_smooth = True
            for li, value in zip(poly.loop_indices, values):
                coords.data[li].uv = value
                vi = mesh.loops[li].vertex_index
                color = self.colors[vi]
                if role == 'mouth' and self.tags[vi] == 'jaw' and color[0] > .4:
                    color = (.35, .25, .23, 1)
                tint.data[li].color = color
        # Reorient closed components coherently, before keys are authored.
        bpy.context.view_layer.objects.active = obj; obj.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT')
        obj.select_set(False)
        for tag in sorted(set(self.tags)):
            group = obj.vertex_groups.new(name=tag)
            group.add([i for i, t in enumerate(self.tags) if t == tag], 1, 'REPLACE')
        return obj


def tube(w, points, radii, role, sides=8, squash=1, color=(1, 1, 1, 1)):
    points = [Vector(p) for p in points]
    rings = []
    previous_normal = None
    for i, (point, radius) in enumerate(zip(points, radii)):
        tangent = (points[min(i+1, len(points)-1)]-points[max(0, i-1)]).normalized()
        if previous_normal is None:
            ref = Vector((0, 1, 0)) if abs(tangent.y) < .93 else Vector((1, 0, 0))
            normal = tangent.cross(ref).normalized()
        else:
            normal = (previous_normal-tangent*previous_normal.dot(tangent)).normalized()
        previous_normal = normal.copy()
        bitangent = tangent.cross(normal).normalized()
        ring = []
        for k in range(sides):
            a = k*math.tau/sides
            # Cross sections, not overlapping capsules, author limb/tail bends.
            p = point+radius*(normal*math.cos(a)+bitangent*(math.sin(a)*squash))
            ring.append(w.vertex(p, color))
        rings.append(ring)
    for i in range(len(rings)-1):
        for k in range(sides):
            j = (k+1)%sides
            w.face((rings[i][k], rings[i][j], rings[i+1][j], rings[i+1][k]), role,
                   [(k/sides, i/(len(rings)-1)), ((k+1)/sides, i/(len(rings)-1)),
                    ((k+1)/sides, (i+1)/(len(rings)-1)), (k/sides, (i+1)/(len(rings)-1))])
    for ri, flip in ((0, True), (len(rings)-1, False)):
        center = w.vertex(points[ri], color)
        for k in range(sides):
            j = (k+1)%sides
            indices = (center, rings[ri][j], rings[ri][k]) if flip else (center, rings[ri][k], rings[ri][j])
            coords = [(.5, .5), (.5+.45*math.cos(j*math.tau/sides), .5+.45*math.sin(j*math.tau/sides)),
                      (.5+.45*math.cos(k*math.tau/sides), .5+.45*math.sin(k*math.tau/sides))]
            if not flip: coords[1], coords[2] = coords[2], coords[1]
            w.face(indices, role, coords)


def ellipsoid(w, center, scale, role, rings=6, sides=12, color=(1, 1, 1, 1)):
    c = Vector(center); rows = []
    # Distinct pole vertex avoids a coincident zero-area pole ring.
    bottom = w.vertex(c+Vector((0, -scale[1], 0)), color)
    for i in range(1, rings):
        a = i*math.pi/rings
        row = []
        for k in range(sides):
            b = k*math.tau/sides
            p = c+Vector((math.sin(a)*math.cos(b)*scale[0], -math.cos(a)*scale[1], math.sin(a)*math.sin(b)*scale[2]))
            row.append(w.vertex(p, color))
        rows.append(row)
    top = w.vertex(c+Vector((0, scale[1], 0)), color)
    for k in range(sides):
        j = (k+1)%sides
        w.face((bottom, rows[0][k], rows[0][j]), role, [((k+.5)/sides, 0), (k/sides, 1/rings), ((k+1)/sides, 1/rings)])
        w.face((rows[-1][k], top, rows[-1][j]), role, [(k/sides, (rings-1)/rings), ((k+.5)/sides, 1), ((k+1)/sides, (rings-1)/rings)])
    for i in range(len(rows)-1):
        for k in range(sides):
            j = (k+1)%sides
            w.face((rows[i][k], rows[i+1][k], rows[i+1][j], rows[i][j]), role,
                   [(k/sides, (i+1)/rings), (k/sides, (i+2)/rings), ((k+1)/sides, (i+2)/rings), ((k+1)/sides, (i+1)/rings)])


def sampled_path(control, steps):
    control = [Vector(p) for p in control]
    result = []
    for i in range(steps):
        t = i/(steps-1)*(len(control)-1); j = min(int(t), len(control)-2); f = t-j
        p0, p1 = control[max(0, j-1)], control[j]
        p2, p3 = control[j+1], control[min(len(control)-1, j+2)]
        result.append(.5*((2*p1)+(-p0+p2)*f+(2*p0-5*p1+4*p2-p3)*f*f+(-p0+3*p1-3*p2+p3)*f*f*f))
    return result


def profile(w, table, role, sides=24, samples=25, ripple=0):
    # Longitudinal authored cross sections: z, height, width, upper/lower radius.
    rows = []
    for i in range(samples):
        q = i/(samples-1)*(len(table)-1); j = min(int(q), len(table)-2); f = q-j
        v = [table[j][k]*(1-f)+table[j+1][k]*f for k in range(5)]
        z, y, width, upper, lower = v
        ring = []
        for k in range(sides):
            a = k*math.tau/sides
            ry = upper if math.sin(a) >= 0 else lower
            surface = 1+ripple*math.sin(a*7+i*1.3)
            p = (width*math.cos(a)*surface, y+ry*math.sin(a)*surface, z)
            belly = max(0, -math.sin(a))
            col = (.75+.20*belly, .70+.19*belly, .65+.19*belly, 1) if role == 'fur' else (1, 1, 1, 1)
            ring.append(w.vertex(p, col))
        rows.append(ring)
    for i in range(samples-1):
        for k in range(sides):
            j = (k+1)%sides
            w.face((rows[i][k], rows[i+1][k], rows[i+1][j], rows[i][j]), role,
                   [(k/sides, i/(samples-1)), (k/sides, (i+1)/(samples-1)), ((k+1)/sides, (i+1)/(samples-1)), ((k+1)/sides, i/(samples-1))])
    for ri in (0, samples-1):
        center = w.vertex((0, table[0 if ri == 0 else -1][1], table[0 if ri == 0 else -1][0]))
        for k in range(sides):
            j = (k+1)%sides
            w.face((center, rows[ri][k], rows[ri][j]), role,
                   [(.5, .5), (.5+.45*math.cos(k*math.tau/sides), .5+.45*math.sin(k*math.tau/sides)),
                    (.5+.45*math.cos(j*math.tau/sides), .5+.45*math.sin(j*math.tau/sides))])


def ear(w, side):
    w.tag = 'ear'
    # Closed cup shell, pink interior recessed in its furred outer margin.
    rows = []
    for layer, radius in enumerate((.04, .42, .78, 1, .78, .42, .04)):
        row = []
        for k in range(16):
            a = k*math.tau/16
            py = .090+.014*radius*math.cos(a)
            pz = .073+.012*radius*math.sin(a)+.0012*math.sin(a*2)
            px = side*(.017+.005*radius+.0024*math.sin(a)+(.0008 if layer <= 3 else -.002))
            row.append(w.vertex((px, py, pz), (.88, .82, .79, 1)))
        rows.append(row)
    for layer in range(len(rows)-1):
        for k in range(16):
            j = (k+1)%16
            w.face((rows[layer][k], rows[layer+1][k], rows[layer+1][j], rows[layer][j]), 'skin' if layer < 3 else 'fur',
                   [(k/16, layer/6), (k/16, (layer+1)/6), ((k+1)/16, (layer+1)/6), ((k+1)/16, layer/6)])
    for ri in (0, len(rows)-1):
        center = w.vertex((side*(.017+(.0008 if ri == 0 else -.002)), .090, .073))
        for k in range(16):
            j = (k+1)%16
            w.face((center, rows[ri][k], rows[ri][j]), 'skin', [(.5, .5), (.5+.4*math.cos(k*math.tau/16), .5+.4*math.sin(k*math.tau/16)), (.5+.4*math.cos(j*math.tau/16), .5+.4*math.sin(j*math.tau/16))])


def rat(root):
    w = Writer()
    profile(w, [(-.134, .044, .002, .003, .003), (-.114, .054, .025, .037, .029),
                (-.078, .058, .036, .048, .039), (-.025, .060, .033, .044, .033),
                (.025, .061, .027, .032, .027), (.055, .067, .027, .029, .026),
                (.085, .063, .023, .024, .020), (.114, .055, .014, .018, .011),
                (.145, .050, .006, .006, .005)], 'fur', samples=29, sides=24, ripple=.012)
    w.tag = 'nose'
    ellipsoid(w, (0, .050, .147), (.0064, .0034, .0038), 'skin', rings=5, sides=12, color=(.68, .56, .52, 1))
    for side in (-1, 1):
        ear(w, side)
        w.tag = 'eye'; ellipsoid(w, (side*.016, .071, .096), (.0038, .0041, .0036), 'skin', rings=6, sides=12, color=(.014, .012, .009, 1))
        w.tag = 'body'
        # Whiskers emanate from cheek pads, unequal and swept backwards.
        for k in range(5):
            points = sampled_path([(side*.010, .054+k*.0013, .128), (side*.028, .053+k*.0023, .124-k*.005),
                                   (side*(.042+.003*k), .049+k*.0032, .108-k*.009)], 5)
            tube(w, points, [.00030-.00022*i/4 for i in range(5)], 'skin', sides=4, color=(.39, .36, .30, 1))
        for front in (True, False):
            name = ('fore' if front else 'hind')+str(side)
            w.tag = name
            if front:
                controls = [(side*.022, .049, .050), (side*.029, .028, .045), (side*.026, .009, .063)]
                radii = [.008, .006, .0045]
                paw = Vector((side*.025, .0055, .069)); toes = 4; width = .014; length = .015
            else:
                controls = [(side*.027, .057, -.069), (side*.040, .027, -.096), (side*.036, .009, -.075)]
                radii = [.014, .010, .0055]
                paw = Vector((side*.035, .0055, -.060)); toes = 5; width = .019; length = .022
            path = sampled_path(controls, 8)
            tube(w, path, [radii[0]*(1-i/7)+radii[-1]*i/7+.001*math.sin(i*math.pi/7) for i in range(8)], 'fur', sides=12, squash=.82)
            ellipsoid(w, paw, (width*.52, .0045, length*.43), 'skin', rings=4, sides=10, color=(.77, .71, .65, 1))
            for toe in range(toes):
                x = paw.x+(toe-(toes-1)/2)*width/toes
                reach = length*(.78+.22*math.sin((toe+1)*math.pi/(toes+1)))
                points = [(x, .005, paw.z), (x+(toe-(toes-1)/2)*.0014, .004, paw.z+reach*.6),
                          (x+(toe-(toes-1)/2)*.0018, .0045, paw.z+reach)]
                tube(w, points, [.0020, .00165, .0009], 'skin', sides=6, squash=.8, color=(.86, .79, .72, 1))
                end = Vector(points[-1]); tube(w, [end, end+Vector((0, -.0011, .0035))], [.00095, .00014], 'skin', sides=5, color=(.9, .82, .64, 1))
    w.tag = 'jaw'
    ellipsoid(w, (0, .040, .124), (.012, .006, .020), 'fur', rings=5, sides=14, color=(.77, .74, .68, 1))
    # Dark lower oral slit, tongue and separate paired incisors.
    ellipsoid(w, (0, .043, .138), (.0076, .0021, .0060), 'mouth', rings=4, sides=10, color=(.10, .07, .05, 1))
    for side in (-1, 1):
        w.tag = 'jaw'; tube(w, [(side*.0018, .042, .142), (side*.0018, .046, .144)], [.0015, .0011], 'skin', sides=6, color=(1, .89, .57, 1))
        w.tag = 'body'; tube(w, [(side*.0018, .046, .143), (side*.0018, .0418, .145)], [.0015, .0011], 'skin', sides=6, color=(1, .89, .57, 1))
    w.tag = 'tail'
    tail = sampled_path([(0, .032, -.125), (.014, .018, -.176), (.011, .011, -.238), (-.010, .009, -.298), (-.022, .010, -.354)], 49)
    radii = [(.0059*(1-i/48)**.76+.00040)*(1+.055*math.cos(i*math.pi)) for i in range(49)]
    tube(w, tail, radii, 'skin', sides=8, color=(.75, .72, .67, 1))
    # Sparse tapered guard-hair tufts soften the outer silhouette, no fur cards.
    w.tag = 'body'
    for i in range(40):
        side = -1 if i < 20 else 1
        ring = 4+int((i%20)*.8)
        angular = 9 if side < 0 else 3
        rootp = w.points[ring*24+angular]-Vector((side*.0006, .0006, 0))
        tube(w, [rootp, rootp+Vector((side*.0026, .001, -.004))], [.00075, .00010], 'fur', sides=3, color=(.7, .63, .53, 1))
    obj = w.object('Rat', root)
    return obj, w.tags


def cockroach(root):
    w = Writer(); w.tag = 'body'
    profile(w, [(-.020, .0040, .0006, .0008, .0008), (-.016, .0044, .0060, .0028, .0021),
                (-.007, .0045, .0093, .0034, .0022), (.004, .0048, .0081, .0032, .0026),
                (.012, .0049, .0068, .0030, .0021), (.018, .0040, .0029, .0020, .0019)],
            'chitin', sides=16, samples=16)
    # Five shallow tergite edges expose segmentation below the forewing
    # margins. Their radius is140microns, not large ornamental armor bands.
    for z, width, cy, ry in [(-.016, .0060, .0044, .0028), (-.012, .0074, .00445, .00305),
                             (-.008, .0090, .0045, .00335), (-.004, .00895, .0046, .00335),
                             (0, .00855, .0047, .0033)]:
        points = [(width*math.cos(i*math.pi/7), cy+ry*math.sin(i*math.pi/7), z) for i in range(8)]
        tube(w, points, [.00014]*8, 'chitin', sides=4, color=(.53, .46, .37, 1))
    # The darker head protrudes below the shield; its rear is buried in the
    # continuous thorax. Antennae attach inside this actual volume, not at an
    # assumed cap point beyond the tapered thorax.
    w.tag = 'head'
    ellipsoid(w, (0, .0038, .0178), (.0032, .0020, .0038), 'chitin', rings=5, sides=12, color=(.65, .59, .50, 1))
    # Forewings overlap the abdomen, with offset central seam and tapered tips.
    for side in (-1, 1):
        w.tag = 'wing'
        points = sampled_path([(side*.0031, .00665, .007), (side*.0041, .00695, -.002), (side*.0032, .00565, -.0145)], 7)
        tube(w, points, [.0044*math.sin((i+.6)/7.2*math.pi)**.6 for i in range(7)], 'chitin', sides=10, squash=.14, color=(.85, .77, .63, 1))
        w.tag = 'head'; ellipsoid(w, (side*.0025, .0041, .0193), (.00095, .0011, .0012), 'chitin', rings=4, sides=8, color=(.13, .12, .10, 1))
        for leg in range(3):
            w.tag = 'leg'+str(leg)+str(side)
            z = .010-leg*.010
            extension = .012+leg*.003
            controls = [(side*.0052, .0044, z), (side*(.008+leg*.002), .0031, z-.003),
                        (side*extension, .0018, z-.006-leg*.001), (side*(extension+.003), .0009, z-.003)]
            points = sampled_path(controls, 7)
            tube(w, points, [.00080-.00049*i/6 for i in range(7)], 'chitin', sides=5, color=(.75, .69, .59, 1))
            # Fine tibial spines, small enough not to read as enormous claws.
            for k in (2, 4, 5):
                p = points[k]
                tube(w, [p, p+Vector((side*.0011, -.0003, -.0007))], [.00023, .00004], 'chitin', sides=3, color=(.6, .55, .46, 1))
        w.tag = 'antenna'+str(side)
        antenna = sampled_path([(side*.0020, .0048, .018), (side*.008, .008, .030),
                                (side*.013, .0065, .044), (side*.016, .0027, .055)], 17)
        tube(w, antenna, [.00033-.00026*i/16 for i in range(17)], 'chitin', sides=4, color=(.79, .75, .65, 1))
        w.tag = 'body'
        tube(w, [(side*.0022, .0037, -.0168), (side*.0039, .0019, -.023)], [.00065, .00016], 'chitin', sides=5)
    obj = w.object('Cockroach', root)
    return obj, w.tags


def shape(obj, name, transform, tags):
    if not obj.data.shape_keys: obj.shape_key_add(name='Basis', from_mix=False)
    key = obj.shape_key_add(name=name, from_mix=False)
    key.slider_min, key.slider_max, key.value = 0, 1, 0
    for i, vertex in enumerate(obj.data.vertices):
        key.data[i].co = bvec(transform(gvec(vertex.co), tags[i]))


def rat_shapes(obj, tags):
    for name, direction in [('ScurryA', 1), ('ScurryB', -1)]:
        def scurry(p, tag, direction=direction):
            leg = tag.startswith('fore') or tag.startswith('hind')
            if not leg: return p+Vector((.0015*direction*math.sin(p.z*13), .0008*math.sin(p.z*8)**2, 0))
            side = -1 if tag.endswith('-1') else 1
            phase = side*(1 if tag.startswith('fore') else -1)*direction
            pivot = .050 if tag.startswith('fore') else .057
            weight = max(0, min(1, (pivot-p.y)/pivot))
            return p+Vector((phase*.0014*weight, .0070*weight if phase > 0 else 0, phase*.010*weight))
        shape(obj, name, scurry, tags)
    def bite(p, tag):
        if tag != 'jaw': return p
        pivot = Vector((0, .052, .106)); q = p-pivot; angle = .48
        return pivot+Vector((q.x, q.y*math.cos(angle)-q.z*math.sin(angle), q.y*math.sin(angle)+q.z*math.cos(angle)))
    shape(obj, 'Bite', bite, tags)
    for name, sign in [('TailLeft', -1), ('TailRight', 1)]:
        def tail(p, tag, sign=sign):
            if tag != 'tail': return p
            t = max(0, min(1, (-p.z-.125)/.229))
            return p+Vector((sign*.032*t*t, .0035*t*math.sin(t*math.pi), .003*t*t))
        shape(obj, name, tail, tags)


def roach_shapes(obj, tags):
    for name, direction in [('ScurryA', 1), ('ScurryB', -1)]:
        def scurry(p, tag, direction=direction):
            if not tag.startswith('leg'): return p
            side = -1 if tag.endswith('-1') else 1
            index = int(tag[3]); phase = direction*side*(1 if index%2 == 0 else -1)
            weight = max(0, min(1, (abs(p.x)-.005)/.014))
            return p+Vector((.0009*phase*weight, .0018*weight if phase > 0 else 0, .0025*phase*weight))
        shape(obj, name, scurry, tags)
    for name, sign in [('AntennaLeft', -1), ('AntennaRight', 1)]:
        def antenna(p, tag, sign=sign):
            if not tag.startswith('antenna'): return p
            t = max(0, min(1, (p.z-.019)/.036))
            return p+Vector((sign*.005*t*t, .002*t*t, -.0015*t*t))
        shape(obj, name, antenna, tags)


def diagnostics(obj):
    mesh = obj.data; mesh.calc_loop_triangles()
    usage = Counter(); winding = Counter()
    for poly in mesh.polygons:
        values = list(poly.vertices)
        for i, a in enumerate(values):
            b = values[(i+1)%len(values)]; edge = tuple(sorted((a, b)))
            usage[edge] += 1; winding[edge] += 1 if a < b else -1
    points = [gvec(v.co) for v in mesh.vertices]
    areas = [(points[t.vertices[1]]-points[t.vertices[0]]).cross(points[t.vertices[2]]-points[t.vertices[0]]).length*.5 for t in mesh.loop_triangles]
    low = [min(p[i] for p in points) for i in range(3)]; high = [max(p[i] for p in points) for i in range(3)]
    morphs = []
    for key in list(mesh.shape_keys.key_blocks)[1:]:
        shaped = [gvec(v.co) for v in key.data]
        deltas = [(p-q).length for p, q in zip(shaped, points)]
        flipped = 0
        for tri in mesh.loop_triangles:
            a, b, c = tri.vertices
            old = (points[b]-points[a]).cross(points[c]-points[a]); new = (shaped[b]-shaped[a]).cross(shaped[c]-shaped[a])
            flipped += old.dot(new) <= 0
        morphs.append({'name': key.name, 'maxDisplacementMeters': max(deltas), 'affectedVertices': sum(d > 1e-6 for d in deltas), 'reversedTriangles': flipped})
    return {'name': obj.name, 'vertices': len(points), 'triangles': len(mesh.loop_triangles),
            'boundsGltfMeters': {'low': low, 'high': high}, 'sizeMeters': [high[i]-low[i] for i in range(3)],
            'boundaryEdges': sum(v == 1 for v in usage.values()), 'nonmanifoldEdges': sum(v != 2 for v in usage.values()),
            'inconsistentWindingEdges': sum(winding[k] != 0 for k, v in usage.items() if v == 2),
            'degenerateTriangles': sum(a < 1e-14 for a in areas),
            'positionFinite': all(math.isfinite(c) for p in points for c in p), 'morphs': morphs}


def audit(raw):
    length = struct.unpack_from('<I', raw, 12)[0]; doc = json.loads(raw[20:20+length])
    offset = 20+length; size, kind = struct.unpack_from('<II', raw, offset)
    if kind != 0x004E4942: raise RuntimeError('Missing embedded BIN')
    binary = raw[offset+8:offset+8+size]
    types = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}
    widths = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
    def accessor(index):
        a = doc['accessors'][index]; v = doc['bufferViews'][a['bufferView']]
        dtype = np.dtype(types[a['componentType']]); width = widths[a['type']]
        return np.ndarray((a['count'], width), dtype=dtype, buffer=binary, offset=v.get('byteOffset', 0)+a.get('byteOffset', 0),
                          strides=(v.get('byteStride', dtype.itemsize*width), dtype.itemsize))
    parts = []
    for mesh in doc['meshes']:
        if len(mesh['primitives']) != 1: raise RuntimeError('Species must be one draw')
        p = mesh['primitives'][0]; points = accessor(p['attributes']['POSITION']); indices = accessor(p['indices']).flatten()
        if max(indices) >= len(points) or len(indices)%3: raise RuntimeError('Invalid indices')
        attrs = {}
        for name, index in p['attributes'].items():
            data = accessor(index)
            if not np.isfinite(data).all(): raise RuntimeError('Nonfinite '+name)
            attrs[name] = {'count': len(data), 'finite': True}
            if name in ('NORMAL', 'TANGENT'):
                lengths = np.linalg.norm(data[:, :3], axis=1)
                if not np.allclose(lengths, 1, atol=.001): raise RuntimeError('Invalid '+name)
                attrs[name]['lengthRange'] = [float(lengths.min()), float(lengths.max())]
        keys = mesh.get('extras', {}).get('targetNames', [])
        if len(keys) != len(p.get('targets', [])) or any(mesh.get('weights', [])): raise RuntimeError('Invalid shape keys')
        targets = []
        for name, target in zip(keys, p['targets']):
            if not {'POSITION', 'NORMAL'} <= set(target): raise RuntimeError('Morph normal missing')
            if not all(np.isfinite(accessor(i)).all() for i in target.values()): raise RuntimeError('Nonfinite morph')
            targets.append({'name': name, 'attributes': list(target), 'maxDisplacementMeters': float(np.linalg.norm(accessor(target['POSITION']), axis=1).max())})
        parts.append({'name': mesh['name'], 'triangles': len(indices)//3, 'exportedVertices': len(points), 'attributes': attrs,
                      'morphTargets': targets, 'defaultWeights': mesh.get('weights', []), 'indexed': True, 'drawGroups': 1})
    if len(doc['materials']) != 1 or len(parts) != 2: raise RuntimeError('Material/draw budget mismatch')
    if len(raw) > 2400000: raise RuntimeError('Asset exceeds 2.4 MB hard bound')
    if any('bufferView' not in i for i in doc['images']): raise RuntimeError('External texture dependency')
    return {'status': 'PASS', 'parts': parts, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(), 'materialCount': 1,
            'drawGroups': 2, 'embeddedImages': len(doc['images']), 'embeddedImageNames': [i.get('name') for i in doc['images']], 'morphNormals': True}


def aim(obj, point):
    obj.rotation_euler = (bvec(point)-obj.location).to_track_quat('-Z', 'Y').to_euler()


def proofs(objects):
    scene = bpy.context.scene; scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1024; scene.render.resolution_y = 768; scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'Filmic'; scene.view_settings.look = 'Medium High Contrast'; scene.view_settings.exposure = 0
    scene.world = bpy.data.worlds.new('Studio_Verification'); scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.16, .18, .20, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .45
    camera_data = bpy.data.cameras.new('Proof_Camera'); camera = bpy.data.objects.new('Proof_Camera', camera_data)
    bpy.context.collection.objects.link(camera); scene.camera = camera; camera_data.type = 'ORTHO'
    camera_data.clip_start = .001; camera_data.clip_end = 10
    lights = []
    for name, p, energy, size in [('Key', (.20, .28, .22), 6, .24), ('Fill', (-.20, .14, .08), 2, .28), ('Rim', (.05, .24, -.20), 4, .18)]:
        data = bpy.data.lights.new(name, 'AREA'); data.energy = energy; data.size = size
        obj = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(obj); obj.location = bvec(p); aim(obj, (0, .04, -.06)); lights.append(data)
    bpy.ops.mesh.primitive_plane_add(size=3, location=bvec((0, -.001, 0)))
    ground = bpy.context.object; ground.name = 'Proof_Ground'
    mat = bpy.data.materials.new('Proof_Concrete'); mat.diffuse_color = (.055, .065, .072, 1); ground.data.materials.append(mat)
    paths = []
    tree = objects[0].data.materials[0].node_tree
    shader = tree.nodes.get('Principled BSDF')
    rough_source = shader.inputs['Roughness'].links[0].from_socket
    wet_scale = tree.nodes.new('ShaderNodeMath'); wet_scale.operation = 'MULTIPLY'; wet_scale.inputs[1].default_value = 1
    tree.links.new(rough_source, wet_scale.inputs[0]); tree.links.new(wet_scale.outputs[0], shader.inputs['Roughness'])
    for obj in objects:
        for item in objects: item.hide_render = item != obj
        roach = obj.name == 'Cockroach'; scale = .095 if roach else .58; target = (0, .004, .015) if roach else (0, .045, -.101)
        distance = .080 if roach else .52
        shots = [('neutral-front', (distance*.70, distance*.49, distance*.76), None),
                 ('neutral-side', (distance, distance*.33, -.02), None),
                 ('neutral-top', (.005, distance, -.02), None),
                 ('cold-contact', (distance*.70, distance*.49, distance*.76), None),
                 ('warm-wet', (distance*.7, distance*.49, distance*.76), None),
                 ('scurry-a', (distance*.90, distance*.32, distance*.4), 'ScurryA'),
                 ('scurry-b', (distance*.90, distance*.32, distance*.4), 'ScurryB'),
                 ('antenna-bend' if roach else 'bite-contact', (distance*.36, distance*.38, distance*.9), 'AntennaLeft' if roach else 'Bite')]
        for label, position, morph in shots:
            if '--roach-proofs' in sys.argv and not roach:
                # Rat source geometry/maps/poses are unchanged by this join
                # correction; preserve the already reviewed eight rat proofs.
                paths.append(str((ART/('rat-'+label+'.png')).relative_to(ROOT)).replace('\\', '/'))
                continue
            for key in list(obj.data.shape_keys.key_blocks)[1:]: key.value = 1 if key.name == morph else 0
            lights[0].color = (.70, .83, 1) if label == 'cold-contact' else (1, .89, .76)
            lights[2].color = (1, .72, .52) if label == 'warm-wet' else (.65, .76, 1)
            wet_scale.inputs[1].default_value = .65 if label == 'warm-wet' else 1
            camera_data.ortho_scale = scale; camera.location = bvec(position); aim(camera, target)
            if label == 'neutral-top': camera_data.ortho_scale = .115 if roach else .73
            if label == 'bite-contact': camera_data.ortho_scale = .23; aim(camera, (0, .058, .085))
            scene.render.filepath = str(ART/(obj.name.lower()+'-'+label+'.png'))
            bpy.ops.render.render(write_still=True); paths.append(str(Path(scene.render.filepath).relative_to(ROOT)).replace('\\', '/'))
        for key in list(obj.data.shape_keys.key_blocks)[1:]: key.value = 0
        obj.hide_render = False
    tree.links.new(rough_source, shader.inputs['Roughness']); tree.nodes.remove(wet_scale)
    return paths


def main():
    global MATERIAL
    for folder in (ART, MASTER, OUTPUT.parent): folder.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATERIAL = material()
    root = bpy.data.objects.new('VerminKit', None); bpy.context.collection.objects.link(root)
    root['units'] = 'meters'; root['forward'] = 'glTF +Z'; root['pivot'] = 'ground plane Y0'
    a, tags_a = rat(root); b, tags_b = cockroach(root)
    rat_shapes(a, tags_a); roach_shapes(b, tags_b); objects = [a, b]
    reports = [diagnostics(o) for o in objects]
    for report, budget in zip(reports, (8000, 2500)):
        if report['triangles'] > budget or report['nonmanifoldEdges'] or report['inconsistentWindingEdges'] or report['degenerateTriangles'] or not report['positionFinite']:
            raise RuntimeError('Authoring quality gate failed: '+json.dumps(report))
        if any(m['reversedTriangles'] for m in report['morphs']): raise RuntimeError('Reversed morph triangles: '+json.dumps(report))
    bpy.ops.object.select_all(action='DESELECT'); root.select_set(True)
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    candidate = ART/'vermin-v1.glb'
    bpy.ops.export_scene.gltf(filepath=str(candidate), export_format='GLB', use_selection=True,
                              export_yup=True, export_texcoords=True, export_normals=True, export_tangents=True,
                              export_colors=True, export_materials='EXPORT', export_animations=False, export_extras=True,
                              export_apply=False, export_morph=True, export_morph_normal=True, export_morph_tangent=False)
    raw = candidate.read_bytes(); checked = audit(raw)
    (ART/'export-audit.json').write_text(json.dumps(checked, indent=2)); OUTPUT.write_bytes(raw)
    print(json.dumps({'stage': 'ASSET_EXPORTED', 'audit': checked, 'bounds': reports}), flush=True)
    shots = proofs(objects)
    bpy.context.preferences.filepaths.save_version = 0
    blend = MASTER/'Vermin_v1.blend'; bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    manifest = {'id': 'vermin-v1', 'status': 'AUTHORING_PASSED_VISUAL_REVIEW_PENDING',
                'runtime': {'file': 'assets/models/vermin-v1.glb', 'units': 'meters', 'forwardAxis': [0, 0, 1], 'upAxis': [0, 1, 0],
                            'floorPivot': [0, 0, 0], 'objectScale': [1, 1, 1], 'components': ['Rat', 'Cockroach']},
                'budget': checked, 'parts': reports,
                'morphs': {'Rat': {'ScurryA': 0, 'ScurryB': 1, 'Bite': 2, 'TailLeft': 3, 'TailRight': 4},
                           'Cockroach': {'ScurryA': 0, 'ScurryB': 1, 'AntennaLeft': 2, 'AntennaRight': 3},
                           'defaultWeights': 0, 'range': [0, 1], 'normals': True,
                           'drive': 'Alternate mutually exclusive ScurryA/B weights. TailLeft/Right and AntennaLeft/Right mutually exclusive. Rat Bite rotates only lower jaw, oral slit and lower incisors.'},
                'files': {'script': 'scripts/build-vermin.py', 'master': '.art-source/vermin-v1/Vermin_v1.blend', 'proofs': shots, 'exportAudit': 'art/vermin-v1/export-audit.json'},
                'sourcing': {'geometry': 'Original Blender custom profile/sweep surfaces with separate digits, closed ears and authored appendages; no copied 3D mesh.',
                             'albedo': 'Native ImageGen four-surface atlas, packed original preserved; resampled to1024, contrast-compressed broad lighting with a dark chitin material factor. JPEG albedo and authored normal/roughness field maps embedded.',
                             'source': str(SOURCE), 'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'newPaidJobs': 0, 'newCreditSpend': 0,
                             'decision': 'Hybrid native ImageGen texture + offline controllable morphology and morph keys. No API credentials used; parent credential probe applies to sourcing ledger.'},
                'anatomy': ['Brown rat continuous tapered torso/head silhouette, shorter ears, blunt elongated muzzle, four foredigits/five hinddigits, paired upper/lower incisors and unequal whiskers.',
                            'Rat naked tapered tail, fur guard tufts and ear cup surfaces.', 'Flattened cockroach thorax and abdomen, overlapping forewings, six jointed spiny legs, two long tapering antennae and paired cerci.'],
                'research': [{'url': 'https://animaldiversity.org/accounts/Rattus_norvegicus/', 'supports': 'Brown coarse dorsal fur, lighter belly, naked ears and tail shorter than body.'},
                             {'url': 'https://animaldiversity.org/collections/contributors/arttoday/rat/', 'supports': 'Four foredigits and five hinddigits.'},
                             {'url': 'https://entomology.ucr.edu/we-ch-4', 'supports': 'Insect segmented body and six thoracic legs.'},
                             {'url': 'https://www.sites.ext.vt.edu/departments/entomology/factsheets/brownban.html', 'supports': 'Flattened oval cockroach body, spiny legs and filamentous antennae.'}],
                'verification': {'command': 'blender.exe --background --factory-startup --python scripts/build-vermin.py',
                                 'checks': ['Closed authored surfaces, consistent winding, finite indexed triangles', 'Rat<=8000tris, Cockroach<=2500tris, two drawgroups, one material',
                                            'All nine shape keys contain POSITION+NORMAL and defaultzero weights', 'Exact exported binary attribute and target validation', 'Neutral/morph/cold/warm CPU proof renders'],
                                 'notCertified': ['Runtime floor and hand contacts', 'Physical softbody simulation', 'Game renderer visual quality', 'Professional photorealism']},
                'limits': ['Authored fictional brown sewer rat and roach, not scanned zoological assets.', 'Generated albedo has residual painted lighting; normal/roughness maps are approximate authored fields.',
                           'Closed overlapping appendage surfaces rather than one boolean-unioned watertight creature.', 'Gaits are bounded relative shape keys, not skeletal locomotion or physical paws.', 'No alpha-card or strand-based fur; modest geometric guard tufts and texture normal details.']}
    serialized = json.dumps(manifest, indent=2)
    (ART/'vermin-v1-manifest.json').write_text(serialized); (OUTPUT.parent/'vermin-v1-manifest.json').write_text(serialized)
    print(json.dumps({'stage': 'AUTHORING_COMPLETE', 'sha256': checked['sha256'], 'proofs': shots}), flush=True)


if __name__ == '__main__':
    if '--proof-only' in sys.argv:
        bpy.ops.wm.open_mainfile(filepath=str(MASTER/'Vermin_v1.blend'))
        for obj in list(bpy.data.objects):
            if obj.name not in ('Rat', 'Cockroach', 'VerminKit'):
                bpy.data.objects.remove(obj, do_unlink=True)
        shots = proofs([bpy.data.objects['Rat'], bpy.data.objects['Cockroach']])
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(MASTER/'Vermin_v1.blend'))
        print(json.dumps({'stage': 'PROOF_COMPLETE', 'proofs': shots}), flush=True)
    else:
        main()
