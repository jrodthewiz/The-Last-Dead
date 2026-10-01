"""Offline v2 authoring of the original ChestWound and Heart extraction kit.

Accepted v1 assets are preserved. Relative authored shape keys add local grip
compression and vessel lag without changing runtime character sources.

Blender 2.93, metre units; glTF +Z is the exterior/viewer-facing direction.
The existing generated tissue swatch is reused as a hybrid albedo source.
No character, existing anatomy kit or runtime source is modified.
"""
import hashlib
import json
import math
import struct
from collections import Counter
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "art/chest-anatomy-v2"
MASTER = ROOT / ".art-source/chest-anatomy-v2"
OUTPUT = ROOT / "assets/models/chest-anatomy-v2.glb"
SOURCE_ATLAS = ROOT / "art/gore-proof/tissue-atlas-v1-1024.png"
TILES = {"ventricle": (0, 1), "artery": (1, 1), "vein": (2, 1), "fat": (3, 1),
         "cavity": (0, 0), "muscle": (1, 0), "fascia": (2, 0), "cloth": (3, 0)}
MATERIAL = None
TILE = 256
PADDING = 16


def bvec(point):
    return Vector((point[0], -point[2], point[1]))


def atlas_uv(role, u, v):
    tx, ty = TILES[role]
    u, v = max(0, min(1, u)), max(0, min(1, v))
    return ((tx*TILE + PADDING + u*(TILE-2*PADDING))/(TILE*4),
            (ty*TILE + PADDING + v*(TILE-2*PADDING))/(TILE*2))


def make_material():
    source = bpy.data.images.load(str(SOURCE_ATLAS))
    sw, sh = source.size
    pixels = np.asarray(source.pixels[:], dtype=np.float32).reshape(sh, sw, 4)
    width, height = TILE*4, TILE*2
    albedo = np.ones((height, width, 4), dtype=np.float32)
    normal = np.ones_like(albedo)
    rough = np.ones_like(albedo)
    n = TILE-2*PADDING
    yy, xx = np.mgrid[0:n, 0:n]
    x, y = xx/(n-1), yy/(n-1)
    rng = np.random.RandomState(922031)
    sources = {"ventricle": (0, 0), "artery": (0, 0), "vein": (0, 0),
               "fat": (1, 1), "cavity": (1, 0), "muscle": (0, 1), "fascia": (1, 1)}
    identity = {"ventricle": .61, "artery": .58, "vein": .60, "fat": .64,
                "cavity": .89, "muscle": .60, "fascia": .65, "cloth": .86}
    for role, (tx, ty) in TILES.items():
        grain = rng.normal(0, 1, (n, n))
        broad = np.sin(x*math.pi*6+y*9+np.sin(y*11))*np.cos(x*math.pi*2-y*13)
        fibre = np.sin(x*math.pi*24+y*22+np.sin(y*18)*2)
        fine = np.sin(x*math.pi*48+y*61)*np.sin(x*math.pi*26-y*101)
        if role in sources:
            sx, sy = sources[role]
            xs = np.linspace(sx*sw/2+23, (sx+1)*sw/2-24, n).astype(int)
            ys = np.linspace(sy*sh/2+23, (sy+1)*sh/2-24, n).astype(int)
            patch = pixels[np.ix_(ys, xs)][:, :, :3].copy()
            # Retain the generated tissue texture detail, but remove its baked
            # white highlight/color cast before assigning a dark blood identity.
            luminance = np.dot(patch, np.array((.2126,.7152,.0722)))
            low, high = np.percentile(luminance,(8,92))
            detail = np.clip((luminance-low)/max(.01,high-low),0,1)
            detail = .53+.40*detail+.025*broad
            palette = {"ventricle":(.185,.021,.016),"artery":(.210,.030,.022),
                       "vein":(.108,.012,.022),"fat":(.180,.105,.044),
                       "cavity":(.017,.0045,.0042),"muscle":(.210,.040,.028),
                       "fascia":(.195,.080,.061)}
            patch = detail[:,:,None]*np.array(palette[role])
        else:
            weave = np.sin(x*math.pi*92)*np.sin(y*math.pi*84)
            value = .17 + grain*.007 + broad*.020 + weave*.010
            blood = np.clip(np.sin(x*21+y*14)*.6+broad*.5, 0, 1)
            patch = np.stack((value*.94+blood*.027, value*.93-blood*.020, value*.88-blood*.020), axis=-1)
        micro = grain*.00065+fine*.0006
        if role in ("muscle", "fascia"):
            micro += fibre*.0016
        if role == "ventricle":
            micro += broad*.0013
        gy, gx = np.gradient(micro)
        vector = np.stack((-gx*16, -gy*16, np.ones_like(gx)), axis=-1)
        vector /= np.linalg.norm(vector, axis=-1, keepdims=True)
        wet = np.clip((np.sin(x*31+y*13)*np.cos(x*17-y*29)-.58)/.42, 0, 1)**2
        moist = .30 if role in ("ventricle", "artery", "vein", "muscle") else .035
        rv = np.clip(identity[role]+broad*.022+grain*.009-wet*moist, .29, .92)
        color_tile = np.ones((n, n, 4), dtype=np.float32)
        color_tile[:, :, :3] = np.clip(patch, 0, 1)
        normal_tile = np.ones_like(color_tile)
        normal_tile[:, :, :3] = .5+.5*vector
        rough_tile = np.ones_like(color_tile)
        rough_tile[:, :, :3] = rv[:, :, None]
        for atlas, tile in ((albedo, color_tile), (normal, normal_tile), (rough, rough_tile)):
            seam = (tile[:,0]+tile[:,-1])*.5
            for edge in range(15):
                weight = (1-edge/15)**2
                tile[:,edge] = tile[:,edge]*(1-weight)+seam*weight
                tile[:,-1-edge] = tile[:,-1-edge]*(1-weight)+seam*weight
            atlas[ty*TILE:(ty+1)*TILE, tx*TILE:(tx+1)*TILE] = np.pad(
                tile, ((PADDING, PADDING), (PADDING, PADDING), (0, 0)), mode="edge")
    images = []
    for name, pixels in (("chest-albedo", albedo), ("chest-normal", normal), ("chest-roughness", rough)):
        image = bpy.data.images.new(name, width=width, height=height, alpha=True)
        if name != "chest-albedo":
            image.colorspace_settings.name = "Non-Color"
        image.pixels.foreach_set(pixels.flatten())
        image.filepath_raw = str(ART/(name+".png"))
        image.file_format = "PNG"
        image.save()
        image.pack()
        images.append(image)
    material = bpy.data.materials.new("Chest_Anatomy_Shared_PBR")
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Metallic"].default_value = 0
    shader.inputs["Specular"].default_value = .23
    shader.inputs["Roughness"].default_value = .61
    base = material.node_tree.nodes.new("ShaderNodeTexImage")
    base.image = images[0]
    color = material.node_tree.nodes.new("ShaderNodeVertexColor")
    color.layer_name = "Anatomical_Surface_Color"
    multiply = material.node_tree.nodes.new("ShaderNodeMixRGB")
    multiply.blend_type = "MULTIPLY"
    multiply.inputs[0].default_value = 1
    material.node_tree.links.new(base.outputs["Color"], multiply.inputs[1])
    material.node_tree.links.new(color.outputs["Color"], multiply.inputs[2])
    material.node_tree.links.new(multiply.outputs[0], shader.inputs["Base Color"])
    roughness = material.node_tree.nodes.new("ShaderNodeTexImage")
    roughness.image = images[2]
    material.node_tree.links.new(roughness.outputs["Color"], shader.inputs["Roughness"])
    ntex = material.node_tree.nodes.new("ShaderNodeTexImage")
    ntex.image = images[1]
    nmap = material.node_tree.nodes.new("ShaderNodeNormalMap")
    nmap.inputs["Strength"].default_value = .48
    material.node_tree.links.new(ntex.outputs["Color"], nmap.inputs["Color"])
    material.node_tree.links.new(nmap.outputs["Normal"], shader.inputs["Normal"])
    material["identityRoughness"] = json.dumps(identity)
    return material, identity


class Writer:
    def __init__(self):
        self.points, self.faces, self.coords, self.colors = [], [], [], []
        self.features = []
        self.feature = "bulk"

    def vertex(self, p, color=(1, 1, 1, 1)):
        self.points.append(Vector(p))
        self.colors.append(color)
        self.features.append(self.feature)
        return len(self.points)-1

    def face(self, indices, role, coords=None):
        self.faces.append(tuple(indices))
        if coords is None:
            coords = [(.5+self.points[i].x/.23, .5+self.points[i].y/.26) for i in indices]
        self.coords.append([atlas_uv(role, *coordinate) for coordinate in coords])

    def normalize(self, target_size, front=None):
        low = Vector(tuple(min(p[i] for p in self.points) for i in range(3)))
        high = Vector(tuple(max(p[i] for p in self.points) for i in range(3)))
        center = (high+low)*.5
        scale = Vector(tuple(target_size[i]/(high[i]-low[i]) for i in range(3)))
        for p in self.points:
            p.x, p.y, p.z = (p.x-center.x)*scale.x, (p.y-center.y)*scale.y, (p.z-center.z)*scale.z
            if front is not None:
                p.z += front-target_size[2]*.5

    def object(self, name, root):
        mesh = bpy.data.meshes.new(name+"_Original_Authored_Geometry")
        mesh.from_pydata([bvec(p) for p in self.points], [], self.faces)
        mesh.update()
        mesh.materials.append(MATERIAL)
        layer = mesh.uv_layers.new(name="Padded_Tissue_Atlas_UV")
        colors = mesh.vertex_colors.new(name="Anatomical_Surface_Color")
        for polygon, coords in zip(mesh.polygons, self.coords):
            polygon.use_smooth = True
            for loop, vertex, coordinate in zip(polygon.loop_indices, polygon.vertices, coords):
                layer.data[loop].uv = coordinate
                colors.data[loop].color = self.colors[vertex]
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        obj.parent = root
        for feature in sorted(set(self.features)):
            if feature != "bulk":
                group = obj.vertex_groups.new(name=feature)
                group.add([i for i, value in enumerate(self.features) if value == feature], 1, "REPLACE")
        obj["units"] = "meters"
        obj["outwardAxis"] = "glTF +Z"
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode="OBJECT")
        mesh.calc_normals_split()
        return obj


def catmull(control, count):
    control = [Vector(p) for p in control]
    samples = []
    for index in range(len(control)-1):
        a, b, c, d = control[max(0, index-1)], control[index], control[index+1], control[min(len(control)-1, index+2)]
        for step in range(12):
            t = step/12
            samples.append(.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
    samples.append(control[-1])
    lengths = [0]
    for a, b in zip(samples, samples[1:]):
        lengths.append(lengths[-1]+(b-a).length)
    result, index = [], 1
    for step in range(count):
        target = lengths[-1]*step/(count-1)
        while index < len(samples)-1 and lengths[index] < target:
            index += 1
        t = (target-lengths[index-1])/max(1e-9, lengths[index]-lengths[index-1])
        result.append(samples[index-1].lerp(samples[index], t))
    return result


def sweep(writer, points, radii, role, sides=12, squash=1, color=(1, 1, 1, 1), torn=False):
    points = [Vector(p) for p in points]
    rings, previous = [], Vector((0, 0, 1))
    for index, point in enumerate(points):
        t = index/(len(points)-1)
        tangent = (points[min(len(points)-1, index+1)]-points[max(0, index-1)]).normalized()
        normal = previous-tangent*previous.dot(tangent)
        if normal.length < .02:
            normal = Vector((1, 0, 0))-tangent*tangent.x
        normal.normalize()
        binormal = tangent.cross(normal).normalized()
        previous = normal
        ring = []
        for side in range(sides):
            a = side*math.pi*2/sides
            r = radii[index]*(1+.035*math.sin(a*3+t*17))
            delta = normal*math.cos(a)*squash+binormal*math.sin(a)
            q = point+r*delta
            if torn and index == len(points)-1:
                q += tangent*(.00075*math.sin(a*5)+.00045*math.cos(a*3))
            ring.append(writer.vertex(q, color))
        rings.append(ring)
    for row in range(len(rings)-1):
        for side in range(sides):
            follow = (side+1)%sides
            writer.face((rings[row][side], rings[row][follow], rings[row+1][follow], rings[row+1][side]), role,
                        [(side/sides, row/(len(rings)-1)), ((side+1)/sides, row/(len(rings)-1)),
                         ((side+1)/sides, (row+1)/(len(rings)-1)), (side/sides, (row+1)/(len(rings)-1))])
    for end in (0, len(points)-1):
        cap_ring = rings[end]
        if torn and end == len(points)-1:
            # Thick soft wall around a recessed dark lumen. The irregular lip
            # stays red, while the interior is shaded without a bright flat cap.
            tangent = (points[-1]-points[-2]).normalized()
            inner = []
            for side in range(sides):
                outer = writer.points[rings[end][side]]
                inner.append(writer.vertex(points[end]+(outer-points[end])*.65-tangent*radii[end]*.55, (.65, .43, .37, 1)))
            for side in range(sides):
                follow = (side+1)%sides
                writer.face((rings[end][side], rings[end][follow], inner[follow], inner[side]), role,
                            [(side/sides, .76), ((side+1)/sides, .76), ((side+1)/sides, .92), (side/sides, .92)])
            cap_ring = inner
        center = writer.vertex(points[end], (.48, .33, .30, 1) if torn and end else color)
        if torn and end == len(points)-1:
            writer.points[center] -= tangent*radii[end]*.73
        for side in range(sides):
            follow = (side+1)%sides
            coords = [(.5+.43*math.cos(side*math.pi*2/sides), .5+.43*math.sin(side*math.pi*2/sides)),
                      (.5+.43*math.cos((side+1)*math.pi*2/sides), .5+.43*math.sin((side+1)*math.pi*2/sides)), (.5, .5)]
            indices = (cap_ring[follow], cap_ring[side], center) if end == 0 else (cap_ring[side], cap_ring[follow], center)
            writer.face(indices, "cavity" if torn and end else role, coords)


def ellipsoid(writer, center, radius, role, rows=14, sides=28, color=(1, 1, 1, 1), phase=0):
    center = Vector(center)
    rings = []
    for row in range(1, rows):
        phi = row*math.pi/rows
        ring = []
        for side in range(sides):
            theta = side*math.pi*2/sides
            ripple = 1+.045*math.sin(theta*3+phi*5+phase)+.019*math.sin(theta*7-phi*4)
            p = center+Vector((radius[0]*math.sin(phi)*math.cos(theta)*ripple,
                               radius[1]*math.cos(phi), radius[2]*math.sin(phi)*math.sin(theta)*ripple))
            ring.append(writer.vertex(p, color))
        rings.append(ring)
    for row in range(len(rings)-1):
        for side in range(sides):
            follow = (side+1)%sides
            writer.face((rings[row][side], rings[row+1][side], rings[row+1][follow], rings[row][follow]), role,
                        [(side/sides, (row+1)/rows), (side/sides, (row+2)/rows), ((side+1)/sides, (row+2)/rows), ((side+1)/sides, (row+1)/rows)])
    for end, sign in ((0, 1), (len(rings)-1, -1)):
        pole = writer.vertex(center+Vector((0, sign*radius[1], 0)), color)
        for side in range(sides):
            follow = (side+1)%sides
            writer.face((rings[end][side], pole, rings[end][follow]), role,
                        [(side/sides, .04 if sign == 1 else .96), ((side+.5)/sides, 0 if sign == 1 else 1), ((side+1)/sides, .04 if sign == 1 else .96)])


def ventricular_point(t, theta):
    phi = math.pi*t
    cross = math.sin(phi)**.63
    y = -.061+.102*(t**.96)
    center_x = -.014*(1-t)**1.3+.005*t
    center_z = .006-.012*t
    rx = .045*cross*(.74+.28*t)
    rz = .035*cross*(.88+.14*t)
    lobe = 1+.085*math.sin(theta+phi*.8)+.024*math.sin(theta*3+phi*2.2)
    # A flatter anterior right ventricular wall and a muscular rounded apex.
    lobe -= .045*max(0, math.cos(theta))**2*max(0, math.sin(theta))
    x = center_x+rx*math.cos(theta)*lobe
    z = center_z+rz*math.sin(theta)*lobe
    groove_x = .016*t-.013*(1-t)
    front = max(0, math.sin(theta))**5
    groove = math.exp(-((x-groove_x)/.0050)**2)*front
    z -= .0031*groove*math.sin(phi)
    z += .00048*math.sin(theta*11+phi*7)*math.sin(phi)**2
    return Vector((x, y, z)), groove


def seat_on_ventricle(point, radius, front=True):
    t = max(.045, min(.93, (point.y+.060)/.101))
    # Sampling the actual sculpted form keeps coronary detail half embedded in
    # the surface, including the asymmetric bulges and recessed primary groove.
    start = 0 if front else math.pi
    candidates = [ventricular_point(t, start+i*math.pi/512)[0] for i in range(513)]
    surface = min(candidates, key=lambda p: abs(p.x-point.x))
    surface.z += radius*.12*(1 if front else -1)
    return surface


def ventricular_surface(writer):
    """One closed, asymmetric continuous surface; no paired Valentine lobes.

    The anterior interventricular groove is a recessed field, not a black decal.
    The left ventricular mass wraps posteriorly, the thinner right mass sweeps
    across the front, and the inferior apex is offset down and to the left.
    """
    rows, sides = 36, 64
    rings = []
    for row in range(1, rows):
        t = row/rows
        ring = []
        for side in range(sides):
            theta = side*math.pi*2/sides
            point, groove = ventricular_point(t, theta)
            tint = (.90-.09*groove, .81-.08*groove, .77-.075*groove, 1)
            ring.append(writer.vertex(point, tint))
        rings.append(ring)
    for row in range(len(rings)-1):
        for side in range(sides):
            follow = (side+1)%sides
            writer.face((rings[row][side], rings[row][follow], rings[row+1][follow], rings[row+1][side]), "ventricle",
                        [(side/sides, (row+1)/rows), ((side+1)/sides, (row+1)/rows), ((side+1)/sides, (row+2)/rows), (side/sides, (row+2)/rows)])
    for end, p in ((0, (-.014, -.062, .006)), (len(rings)-1, (.004, .042, -.006))):
        pole = writer.vertex(p, (.88, .78, .73, 1))
        for side in range(sides):
            follow = (side+1)%sides
            writer.face((rings[end][side], rings[end][follow], pole), "ventricle",
                        [(side/sides, .05 if end == 0 else .95), ((side+1)/sides, .05 if end == 0 else .95), ((side+.5)/sides, 0 if end == 0 else 1)])


def make_heart(root):
    writer = Writer()
    ventricular_surface(writer)
    # Broad atria are mostly embedded in the base. The auricles are irregular
    # folded tissue flaps, with a deliberate left/right mass difference.
    ellipsoid(writer, (-.022, .027, -.015), (.020, .015, .022), "ventricle", rows=14, sides=28, color=(.72, .64, .61, 1), phase=.7)
    ellipsoid(writer, (.027, .022, -.014), (.013, .019, .020), "ventricle", rows=14, sides=28, color=(.81, .68, .64, 1), phase=2.1)
    for side, path in ((-1, [(-.021, .042, .008), (-.035, .036, .015), (-.043, .022, .018), (-.033, .021, .026)]),
                       (1, [(.020, .038, .005), (.034, .027, .013), (.037, .014, .018), (.029, .010, .022)])):
        points = catmull(path, 20)
        points = [p+Vector((0,0,.00115*math.sin(i*1.15)*math.sin(i*math.pi/19)**2)) for i,p in enumerate(points)]
        radii = [.0033+.0029*math.sin(i*math.pi/19) for i in range(20)]
        sweep(writer, points, radii, "ventricle", sides=16, squash=.30, color=(.78, .66, .61, 1))
    # Proximal major vessel roots remain attached and are visibly severed.
    roots = [("artery", [(0, .031, .004), (.001, .044, .010), (-.007, .054, .019), (-.014, .061, .029)], .0090, 30, 22),
             ("artery", [(.012, .021, .019), (.021, .038, .023), (.017, .048, .027), (.010, .057, .042)], .0078, 24, 22),
             ("vein", [(-.032, .028, -.015), (-.033, .044, -.017), (-.032, .056, -.018)], .0068, 18, 18),
             ("vein", [(.031, .028, -.022), (.036, .041, -.025), (.042, .047, -.021)], .0058, 16, 18)]
    writer.feature = "MajorVessels"
    for role, control, radius, count, sides in roots:
        points = catmull(control, count)
        radii = [radius*(1-.17*i/(count-1))*(1+.028*math.sin(i*.8)) for i in range(count)]
        sweep(writer, points, radii, role, sides=sides, color=(.78, .73, .69, 1), torn=True)
    writer.feature = "bulk"
    # Coronary arteries and paired veins follow the curved surface. Their
    # branches taper and embed in the surface instead of becoming loose ropes.
    vessels = [([(.013, .029, .027), (.008, .012, .033), (-.002, -.010, .034), (-.012, -.034, .027), (-.018, -.051, .014)], .0017, "artery"),
               ([(.018, .028, .028), (.013, .008, .034), (.002, -.013, .033), (-.009, -.033, .027)], .0014, "vein"),
               ([(-.023, .026, .019), (-.037, .012, .022), (-.041, -.010, .018), (-.033, -.033, .014)], .0017, "artery"),
               ([(.026, .019, -.023), (.031, -.002, -.030), (.021, -.028, -.028), (.001, -.042, -.021)], .00155, "vein")]
    branches = [([(.007, .009, .034), (-.007, .006, .035), (-.021, .001, .032), (-.030, -.006, .027)], .0012, "artery"),
                ([(-.001, -.012, .034), (.010, -.016, .032), (.024, -.022, .026), (.029, -.029, .021)], .0011, "artery"),
                ([(-.009, -.028, .030), (-.021, -.029, .027), (-.032, -.034, .018)], .00095, "vein"),
                ([(-.037, .008, .024), (-.025, -.001, .031), (-.019, -.013, .032)], .0011, "vein"),
                ([(-.039, -.009, .019), (-.031, -.021, .025), (-.022, -.030, .028)], .00105, "artery"),
                ([(.030, -.004, -.031), (.014, -.007, -.034), (-.002, -.014, -.032)], .0010, "vein"),
                ([(.019, -.029, -.029), (.007, -.032, -.030), (-.011, -.034, -.024)], .0009, "artery")]
    for control, radius, role in vessels+branches:
        count, sides = (32, 10) if len(control) > 4 else (20, 8)
        points = catmull(control, count)
        radii = [radius*(1-.70*i/(count-1)) for i in range(count)]
        points = [seat_on_ventricle(p, r, control[0][2] > 0) for p, r in zip(points, radii)]
        sweep(writer, points, radii, role, sides=sides, squash=.75, color=(.75, .71, .70, 1))
    # Small patches of epicardial fat accumulate around the base and the grooves;
    # the dominant surface remains ventricular muscle, not a yellow foam mass.
    fat_paths = [[(-.027, .027, 0), (-.018, .029, 0), (-.010, .029, 0)],
                 [(.002, .028, 0), (.011, .027, 0), (.021, .022, 0)],
                 [(.004, .009, 0), (.001, .001, 0), (-.002, -.008, 0)]]
    for index, path in enumerate(fat_paths):
        points = catmull(path, 18)
        radii = [(.0012+.0023*math.sin(i*math.pi/17)**.7)*(1+.12*math.sin(i*1.8)) for i in range(18)]
        points = [seat_on_ventricle(p, r*.15) for p, r in zip(points, radii)]
        sweep(writer, points, radii, "fat", sides=12, squash=.17, color=(.75, .68, .57, 1))
    writer.normalize((.100, .130, .080))
    obj = writer.object("Heart", root)
    add_heart_morphs(obj)
    return obj


def torn_cloth_flap(writer, a, spread, length, phase):
    """An irregular folded fabric tongue with real thickness and closed edges."""
    writer.feature = "TornCloth"
    rows, columns = 7, 6
    grids = []
    for back in (False, True):
        grid = []
        for row in range(rows):
            t = row/(rows-1)
            ring = []
            for col in range(columns):
                u = col/(columns-1)*2-1
                width = spread*(1-.44*t+.07*math.sin(t*8+phase))
                angle = a+u*width+.13*math.sin(t*2.3+phase)*t
                radial = .88+length*t-.040*abs(u)**2
                radial += .012*math.sin(col*3.1+phase)*t**5
                profile = wound_outline(angle)
                z = -.002+.008*math.sin(t*math.pi)+.0025*u*math.sin(t*4+phase)
                z -= .0010 if back else 0
                tint = (.67+.10*t, .63-.04*t, .61-.08*t, 1)
                ring.append(writer.vertex((.082*radial*profile*math.cos(angle),
                                            .094*radial*profile*math.sin(angle), z), tint))
            grid.append(ring)
        grids.append(grid)
    front, back = grids
    for row in range(rows-1):
        for col in range(columns-1):
            writer.face((front[row][col], front[row+1][col], front[row+1][col+1], front[row][col+1]), "cloth",
                        [(col/(columns-1),row/(rows-1)), (col/(columns-1),(row+1)/(rows-1)),
                         ((col+1)/(columns-1),(row+1)/(rows-1)), ((col+1)/(columns-1),row/(rows-1))])
            writer.face((back[row][col+1], back[row+1][col+1], back[row+1][col], back[row][col]), "cloth",
                        [((col+1)/(columns-1),row/(rows-1)), ((col+1)/(columns-1),(row+1)/(rows-1)),
                         (col/(columns-1),(row+1)/(rows-1)), (col/(columns-1),row/(rows-1))])
    for row in range(rows-1):
        writer.face((front[row][0], back[row][0], back[row+1][0], front[row+1][0]), "cloth", [(0,.15),(.9,.15),(.9,.85),(0,.85)])
        writer.face((front[row+1][-1], back[row+1][-1], back[row][-1], front[row][-1]), "cloth", [(0,.15),(.9,.15),(.9,.85),(0,.85)])
    for col in range(columns-1):
        writer.face((front[0][col+1], back[0][col+1], back[0][col], front[0][col]), "cloth", [(0,.15),(.9,.15),(.9,.85),(0,.85)])
        writer.face((front[-1][col], back[-1][col], back[-1][col+1], front[-1][col+1]), "cloth", [(0,.15),(.9,.15),(.9,.85),(0,.85)])
    for index, u in enumerate((-.92,-.50,.48,.91)):
        angle = a+u*spread*.58+.13*math.sin(2.3+phase)
        radial = .88+length-.040*abs(u)**2
        profile = wound_outline(angle)
        start = Vector((.082*radial*profile*math.cos(angle),.094*radial*profile*math.sin(angle),-.002+.0025*u*math.sin(4+phase)))
        tangent = Vector((math.cos(angle)*.0035,math.sin(angle)*.0042,.0008*math.sin(index+phase)))
        controls = [start,start+tangent*.55+Vector((.0007*math.sin(index),0,.0009)),start+tangent]
        points = catmull(controls,6)
        sweep(writer,points,[.00022*(1-.63*i/5) for i in range(6)],"cloth",sides=6,color=(.64,.60,.58,1))
    writer.feature = "bulk"


def wound_outline(a):
    # Deliberate asymmetrical tears: not evenly spaced petals or a circular rim.
    profile = 1+.080*math.sin(a*3+.6)+.044*math.sin(a*7-.8)+.020*math.cos(a*11+.3)
    for angle, width, depth in ((.36, .19, .12), (2.65, .24, .10), (4.34, .16, .14)):
        distance = math.atan2(math.sin(a-angle), math.cos(a-angle))
        profile -= depth*math.exp(-(distance/width)**2)
    return profile


def make_chest(root):
    writer = Writer()
    count = 96
    tiers = [(1, -.013, "cloth"), (.972, -.004, "muscle"), (.885, -.012, "muscle"),
             (.76, -.013, "muscle"), (.665, -.033, "muscle"), (.48, -.055, "cavity"),
             (.24, -.062, "cavity")]
    front = []
    for row, (scale, z, role) in enumerate(tiers):
        ring = []
        for index in range(count):
            a = index*math.pi*2/count
            # Width varies strongly along the same perimeter; some sections
            # expose a thin tear and others a deeper displaced tissue lip.
            rim_width = .83+.22*math.sin(a*2+.7)+.08*math.cos(a*5-1.2)
            radial = 1-(1-scale)*rim_width
            profile = wound_outline(a)
            bend = .0040*radial*math.sin(a*5+.35*row)
            if row in (2, 3):
                bend += .0035*math.sin(a*9+.4)*math.sin(a*2-.6)
            point = (.082*radial*profile*math.cos(a)+.003*radial*math.sin(a),
                     .094*radial*profile*math.sin(a), z+bend)
            tint = (.69, .62, .57, 1) if row < 4 else (.57, .43, .40, 1)
            ring.append(writer.vertex(point, tint))
        front.append(ring)
    for row in range(len(front)-1):
        for index in range(count):
            follow = (index+1)%count
            role = tiers[row][2]
            if row == 0:
                angle = (index+.5)*math.pi*2/count
                cloth_here = any(abs(math.atan2(math.sin(angle-a),math.cos(angle-a))) < width for a,width in ((.56,.24),(1.77,.17),(3.48,.21),(4.85,.26)))
                role = "cloth" if cloth_here else "muscle"
            writer.face((front[row][index], front[row+1][index], front[row+1][follow], front[row][follow]), role)
    center = writer.vertex((-.004, -.003, -.064), (.46, .30, .29, 1))
    for index in range(count):
        writer.face((front[-1][index], center, front[-1][(index+1)%count]), "cavity")
    back = [front[0]]
    for row, (scale, z) in enumerate(((.92, -.025), (.72, -.050), (.48, -.066), (.22, -.070))):
        ring = []
        for index in range(count):
            a = index*math.pi*2/count
            radial = 1-(1-scale)*(.83+.22*math.sin(a*2+.7)+.08*math.cos(a*5-1.2))
            q = (.082*radial*wound_outline(a)*math.cos(a),
                 .094*radial*wound_outline(a)*math.sin(a), z+.0013*radial*math.sin(a*7+row*.4))
            ring.append(writer.vertex(q, (.53, .39, .37, 1)))
        back.append(ring)
    for row in range(len(back)-1):
        for index in range(count):
            follow = (index+1)%count
            writer.face((back[row][follow], back[row+1][follow], back[row+1][index], back[row][index]), "cavity")
    backing = writer.vertex((0, 0, -.072), (.48, .32, .30, 1))
    for index in range(count):
        writer.face((back[-1][(index+1)%count], backing, back[-1][index]), "cavity")
    # Sparse asymmetrical cloth tongues replace the exposed uniform red ring.
    # Their exposed tips are dark fabric, with red-brown staining in the atlas.
    for a, spread, length, phase in ((.56, .24, .23, .4), (1.77, .17, .27, 1.3),
                                     (3.48, .21, .17, 2.2), (4.85, .26, .22, 3.0)):
        torn_cloth_flap(writer, a, spread, length, phase)
    # Tissue tears lie mostly within the opening and have unequal orientation.
    # No regularly spaced rounded muscle beads or tooth-like fascia spokes.
    for index, a in enumerate((.98, 2.90, 4.15)):
        angle2 = a+.27*(-1 if index == 1 else 1)
        points = catmull([(.074*math.cos(a), .082*math.sin(a), -.004),
                          (.058*math.cos(angle2), .067*math.sin(angle2), -.002),
                          (.046*math.cos(angle2+.09), .054*math.sin(angle2+.09), -.024)], 18)
        radii = [.0010+.0032*math.sin(i*math.pi/17)**.8 for i in range(18)]
        sweep(writer, points, radii, "muscle", sides=10, squash=.23, color=(.62, .46, .42, 1), torn=True)
    # Buried stained rib remnant, only one short partial root rather than teeth.
    points = catmull([(-.061, -.016, -.031), (-.052, -.020, -.019), (-.044, -.025, -.014)], 13)
    radii = [.0038-.0010*i/12 for i in range(13)]
    sweep(writer, points, radii, "fat", sides=12, squash=.56, color=(.43, .25, .20, 1), torn=True)
    writer.normalize((.170, .190, .080), front=.015)
    obj = writer.object("ChestWound", root)
    add_wound_morph(obj)
    return obj


def gltf_point(point):
    return Vector((point.x, point.z, -point.y))


def smoothstep(value):
    value = max(0, min(1, value))
    return value*value*(3-2*value)


def add_relative_morph(obj, name, transform):
    if not obj.data.shape_keys:
        obj.shape_key_add(name="Basis", from_mix=False)
    key = obj.shape_key_add(name=name, from_mix=False)
    key.slider_min, key.slider_max, key.value = 0, 1, 0
    for index, vertex in enumerate(obj.data.vertices):
        key.data[index].co = bvec(transform(gltf_point(vertex.co), index))
    return key


def add_heart_morphs(obj):
    def compress(p, index):
        x, y, z = p
        band = math.exp(-((y+.006)/.047)**4)
        right_pressure = math.exp(-((x-.026)/.025)**2)*band
        left_support = math.exp(-((x+.025)/.028)**2)*band
        # A local asymmetric finger indentation plus a small longitudinal bulge.
        # Every seated surface detail shares the same continuous deformation.
        qx = x-.0053*right_pressure+.0034*left_support
        qy = y+.0044*(y+.006)/.052*band
        qz = z*(1-.16*band)-.0017*math.exp(-((x-.010)/.023)**2)*band*max(0, z/.04)
        return Vector((qx, qy, qz))
    add_relative_morph(obj, "GripCompress", compress)
    group = obj.vertex_groups.get("MajorVessels")
    roots = {v.index for v in obj.data.vertices if any(g.group == group.index for g in v.groups)}
    for name, sign in (("VesselLagLeft", -1), ("VesselLagRight", 1)):
        def bend(p, index, sign=sign):
            if index not in roots:
                return p
            weight = smoothstep((p.y-.022)/.040)
            return p+Vector((sign*.0064*weight, -.0014*weight*weight, .0022*weight))
        add_relative_morph(obj, name, bend)
    obj["morphDrive"] = "GripCompress 0..1; VesselLagLeft and VesselLagRight mutually exclusive 0..1; relax by returning weights to zero."


def add_wound_morph(obj):
    def tension(p, index):
        radius = math.sqrt((p.x/.085)**2+(p.y/.095)**2)
        surface = smoothstep((p.z+.042)/.045)
        edge = math.exp(-((radius-.78)/.27)**2)*surface
        return p+Vector((.0020*math.sin(p.y*45)*edge, .0025*math.sin(p.x*31+.9)*edge, .0035*edge))
    add_relative_morph(obj, "TissueTension", tension)
    obj["morphDrive"] = "TissueTension 0..1 is a local surface-lip flex; default zero."


def morph_diagnostics(obj):
    if not obj.data.shape_keys:
        return []
    mesh = obj.data
    mesh.calc_loop_triangles()
    base = [gltf_point(v.co) for v in mesh.vertices]
    result = []
    names = [k.name for k in mesh.shape_keys.key_blocks if k.name != "Basis"]
    combinations = [(name, [name]) for name in names]
    if obj.name == "Heart":
        combinations += [("GripCompress+VesselLagLeft", ["GripCompress", "VesselLagLeft"]),
                         ("GripCompress+VesselLagRight", ["GripCompress", "VesselLagRight"])]
    for label, active in combinations:
        points = [p.copy() for p in base]
        for name in active:
            key = mesh.shape_keys.key_blocks[name]
            for index, p in enumerate(base):
                points[index] += gltf_point(key.data[index].co)-p
        deltas = [(p-q).length for p, q in zip(points, base)]
        min_area, reversed_faces = float("inf"), 0
        for tri in mesh.loop_triangles:
            a,b,c = tri.vertices
            old = (base[b]-base[a]).cross(base[c]-base[a])
            new = (points[b]-points[a]).cross(points[c]-points[a])
            min_area = min(min_area, new.length*.5)
            reversed_faces += old.dot(new) <= 0
        if min_area < 1e-11 or reversed_faces or not all(math.isfinite(c) for p in points for c in p):
            raise RuntimeError("Invalid morph surface: "+label)
        result.append({"name":label,"weights":{name:1 for name in active},"maxDisplacementMeters":max(deltas),
                       "affectedVertices":sum(d>.000001 for d in deltas),"minTriangleAreaMeters2":min_area,
                       "reversedTriangles":reversed_faces,"finite":True})
    return result


def diagnostics(obj):
    mesh = obj.data
    mesh.calc_loop_triangles()
    usage, winding = Counter(), Counter()
    for polygon in mesh.polygons:
        indices = list(polygon.vertices)
        for i, a in enumerate(indices):
            b = indices[(i+1)%len(indices)]
            key = tuple(sorted((a, b)))
            usage[key] += 1
            winding[key] += 1 if a < b else -1
    points = [Vector((v.co.x, v.co.z, -v.co.y)) for v in mesh.vertices]
    areas = [(points[t.vertices[1]]-points[t.vertices[0]]).cross(points[t.vertices[2]]-points[t.vertices[0]]).length*.5 for t in mesh.loop_triangles]
    uv_bad = 0
    for tri in mesh.loop_triangles:
        values = [mesh.uv_layers.active.data[i].uv for i in tri.loops]
        uv_bad += abs((values[1]-values[0]).cross(values[2]-values[0])) < 1e-11
    low = [min(p[i] for p in points) for i in range(3)]
    high = [max(p[i] for p in points) for i in range(3)]
    return {"name": obj.name, "vertices": len(points), "triangles": len(mesh.loop_triangles),
            "drawGroups": 1, "boundsGltfMeters": {"low": low, "high": high},
            "sizeMeters": [high[i]-low[i] for i in range(3)],
            "boundaryEdges": sum(v == 1 for v in usage.values()),
            "nonmanifoldEdges": sum(v != 2 for v in usage.values()),
            "inconsistentWindingEdges": sum(winding[k] != 0 for k, v in usage.items() if v == 2),
            "degenerateTriangles": sum(a < 1e-11 for a in areas), "zeroAreaUvTriangles": int(uv_bad),
            "positionFinite": all(math.isfinite(c) for p in points for c in p),
            "normalFinite": all(math.isfinite(c) for loop in mesh.loops for c in loop.normal),
            "normalLengthRange": [min(loop.normal.length for loop in mesh.loops), max(loop.normal.length for loop in mesh.loops)]}


def aim(obj, point):
    obj.rotation_euler = (bvec(point)-obj.location).to_track_quat("-Z", "Y").to_euler()


def export_audit(raw, document, expected_triangles):
    """Check the actual exported binary, not just Blender authoring objects."""
    json_size = struct.unpack_from("<I", raw, 12)[0]
    binary_header = 20+json_size
    binary_size, chunk_type = struct.unpack_from("<II", raw, binary_header)
    if chunk_type != 0x004E4942:
        raise RuntimeError("Missing embedded GLB binary chunk")
    binary = raw[binary_header+8:binary_header+8+binary_size]
    formats = {5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
    components = {"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4,"MAT4":16}
    def accessor(index):
        acc = document["accessors"][index]
        view = document["bufferViews"][acc["bufferView"]]
        dtype = np.dtype(formats[acc["componentType"]])
        width = components[acc["type"]]
        start = view.get("byteOffset",0)+acc.get("byteOffset",0)
        stride = view.get("byteStride",width*dtype.itemsize)
        return np.ndarray((acc["count"],width),dtype=dtype,buffer=binary,offset=start,strides=(stride,dtype.itemsize))
    checked, morphs = [], []
    node_meshes = {node["name"]:document["meshes"][node["mesh"]] for node in document["nodes"] if "mesh" in node}
    expected_names = {"ChestWound":["TissueTension"],"Heart":["GripCompress","VesselLagLeft","VesselLagRight"]}
    for name, names in expected_names.items():
        mesh = node_meshes[name]
        if mesh.get("extras",{}).get("targetNames") != names:
            raise RuntimeError("Morph names missing or unordered: "+name)
        if any(abs(w)>1e-9 for w in mesh.get("weights",[])):
            raise RuntimeError("Nonzero default morph weights")
        for primitive in mesh["primitives"]:
            pos = accessor(primitive["attributes"]["POSITION"])
            indices = accessor(primitive["indices"]).reshape(-1)
            if int(indices.max()) >= len(pos) or len(indices)%3:
                raise RuntimeError("Invalid exported indices")
            for semantic, index in primitive["attributes"].items():
                data = accessor(index)
                if not np.isfinite(data).all():
                    raise RuntimeError("Nonfinite exported attribute: "+semantic)
                entry = {"component":name,"semantic":semantic,"count":len(data),"finite":True}
                if semantic in ("NORMAL","TANGENT"):
                    lengths = np.linalg.norm(data[:,:3],axis=1)
                    entry["lengthRange"] = [float(lengths.min()),float(lengths.max())]
                    if not np.allclose(lengths,1,atol=.001):
                        raise RuntimeError("Nonunit exported "+semantic)
                checked.append(entry)
            targets = primitive.get("targets",[])
            if len(targets) != len(names):
                raise RuntimeError("Unexpected target count")
            for target_name, target in zip(names,targets):
                if set(target) != {"POSITION","NORMAL","TANGENT"}:
                    raise RuntimeError("Morph normal/tangent export missing: "+target_name)
                delta = accessor(target["POSITION"])
                if not all(np.isfinite(accessor(index)).all() for index in target.values()):
                    raise RuntimeError("Nonfinite morph target")
                norms = np.linalg.norm(delta,axis=1)
                morphs.append({"component":name,"name":target_name,"count":len(delta),"attributes":sorted(target),
                               "maxDisplacementMeters":float(norms.max()),"affectedExportedVertices":int((norms>1e-6).sum()),"finite":True})
    maps = []
    for image in document.get("images",[]):
        view = document["bufferViews"][image["bufferView"]]
        image_bytes = binary[view.get("byteOffset",0):view.get("byteOffset",0)+view["byteLength"]]
        if image_bytes[:8] != b"\x89PNG\r\n\x1a\n":
            raise RuntimeError("Expected embedded PNG")
        width,height = struct.unpack_from(">II",image_bytes,16)
        if (width,height)!=(1024,512):
            raise RuntimeError("Atlas dimensions changed")
        maps.append({"name":image.get("name"),"width":width,"height":height,"bytes":len(image_bytes),"embedded":True})
    triangles=sum(document["accessors"][p["indices"]]["count"]//3 for m in document["meshes"] for p in m["primitives"])
    if triangles != expected_triangles:
        raise RuntimeError("Exported topology budget differs")
    baseline=ROOT/"assets/models/chest-anatomy-v1.glb"
    expected_baseline="896c71c578f6a6ff78b09b152ab9918e8e472d9ac5cda73fa7a3ea542f0685b5"
    if hashlib.sha256(baseline.read_bytes()).hexdigest()!=expected_baseline:
        raise RuntimeError("Accepted v1 baseline changed")
    return {"status":"PASS","triangles":triangles,"drawGroups":2,"attributes":checked,"morphs":morphs,"embeddedMaps":maps,
            "acceptedV1Preserved":True,"acceptedV1Sha256":expected_baseline,"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest()}


def proof_renders(objects):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 40
    scene.cycles.max_bounces = 5
    scene.cycles.use_denoising = True
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 8
    scene.render.resolution_x = 800
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    world = bpy.data.worlds.new("Neutral_Chest_Anatomy_Review")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (.070, .077, .083, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = .45
    scene.world = world
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = -.25
    camera = bpy.data.objects.new("Chest_Proof_Camera", bpy.data.cameras.new("Chest_Proof_Camera"))
    bpy.context.collection.objects.link(camera)
    camera.data.type = "ORTHO"
    scene.camera = camera
    for name, point, energy, size in (("Neutral_Key", (-.32, .39, .65), 35, .55),
                                      ("Neutral_Fill", (.38, .06, .35), 17, .50),
                                      ("Neutral_Rim", (.21, .35, -.38), 24, .38)):
        light = bpy.data.objects.new(name, bpy.data.lights.new(name, "AREA"))
        bpy.context.collection.objects.link(light)
        light.location = bvec(point)
        light.data.energy, light.data.size = energy, size
        aim(light, (0, 0, 0))
    shots = [("heart-neutral-front", "Heart", (.17, .065, .45), (0, 0, 0), .170, {}),
             ("heart-neutral-back", "Heart", (-.19, .035, -.44), (0, 0, 0), .170, {}),
             ("heart-neutral-side", "Heart", (.44, .035, .13), (0, 0, 0), .170, {}),
             ("chest-neutral-front", "ChestWound", (.18, .05, .48), (0, 0, -.018), .245, {}),
             ("chest-neutral-back", "ChestWound", (-.16, .05, -.46), (0, 0, -.028), .245, {}),
             ("heart-grip-compressed", "Heart", (.17, .065, .45), (0, 0, 0), .170, {"GripCompress":1}),
             ("heart-vessel-lag-left", "Heart", (.17, .065, .45), (0, 0, 0), .170, {"VesselLagLeft":1}),
             ("chest-tension", "ChestWound", (.18, .05, .48), (0, 0, -.018), .245, {"TissueTension":1})]
    paths = []
    for name, visible, point, target, scale, morph_weights in shots:
        for obj in objects:
            obj.hide_render = obj.name != visible
            if obj.data.shape_keys:
                for key in obj.data.shape_keys.key_blocks:
                    if key.name != "Basis":
                        key.value = morph_weights.get(key.name,0) if obj.name == visible else 0
        bpy.context.view_layer.update()
        print(json.dumps({"stage":"CPU_PROOF_RENDER","name":name,"morphWeights":morph_weights}), flush=True)
        camera.location = bvec(point)
        camera.data.ortho_scale = scale
        aim(camera, target)
        path = ART/(name+".png")
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        paths.append(str(path.relative_to(ROOT)).replace("\\", "/"))
    for obj in objects:
        obj.hide_render = False
        if obj.data.shape_keys:
            for key in obj.data.shape_keys.key_blocks:
                if key.name != "Basis":
                    key.value = 0
    return paths


def main():
    global MATERIAL
    for folder in (ART, MASTER, OUTPUT.parent):
        folder.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATERIAL, roughness = make_material()
    root = bpy.data.objects.new("ChestAnatomyKit", None)
    bpy.context.collection.objects.link(root)
    root["units"] = "meters"
    root["outwardAxis"] = "glTF +Z"
    objects = [make_chest(root), make_heart(root)]
    reports = [diagnostics(obj) for obj in objects]
    for obj, report in zip(objects, reports):
        report["morphs"] = morph_diagnostics(obj)
    triangles = sum(r["triangles"] for r in reports)
    if triangles > 30000 or any(r["boundaryEdges"] or r["nonmanifoldEdges"] or r["inconsistentWindingEdges"] or r["degenerateTriangles"] or r["zeroAreaUvTriangles"] or not r["normalFinite"] or not r["positionFinite"] for r in reports):
        raise RuntimeError("Chest anatomy authoring gate failed: "+json.dumps(reports))
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    candidate = ART/"chest-anatomy-v2.glb"
    bpy.ops.export_scene.gltf(filepath=str(candidate), export_format="GLB", use_selection=True,
                              export_yup=True, export_texcoords=True, export_normals=True,
                              export_tangents=True, export_colors=True, export_materials="EXPORT",
                              export_animations=False, export_extras=True, export_apply=False,
                              export_morph=True, export_morph_normal=True, export_morph_tangent=True)
    raw = candidate.read_bytes()
    jlength = struct.unpack_from("<I", raw, 12)[0]
    document = json.loads(raw[20:20+jlength])
    exported = sum(document["accessors"][p["indices"]]["count"]//3 for mesh in document["meshes"] for p in mesh["primitives"])
    groups = sum(len(mesh["primitives"]) for mesh in document["meshes"])
    if exported != triangles or groups != 2 or len(document["materials"]) > 4:
        raise RuntimeError("Chest anatomy exported budget mismatch")
    for material in document["materials"]:
        pbr = material.get("pbrMetallicRoughness", {})
        if not (pbr.get("baseColorTexture") and pbr.get("metallicRoughnessTexture") and material.get("normalTexture")):
            raise RuntimeError("Chest PBR maps not retained")
    if not all("bufferView" in image for image in document.get("images", [])):
        raise RuntimeError("Chest runtime contains external image dependencies")
    audit = export_audit(raw, document, triangles)
    (ART/"export-audit.json").write_text(json.dumps(audit, indent=2))
    OUTPUT.write_bytes(raw)
    print(json.dumps({"stage": "ASSET_EXPORTED", "glb": str(OUTPUT), "triangles": triangles,
                      "bytes": len(raw), "parts": reports}), flush=True)
    shots = proof_renders(objects)
    blend = MASTER/"Chest_Anatomy_v2.blend"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    references = [
        "threejs-aaa-graphics-builder/SKILL.md", "threejs-aaa-graphics-builder/references/implementation-blueprint.md",
        "threejs-aaa-graphics-builder/references/model-recipes.md", "threejs-aaa-graphics-builder/references/render-recipes.md",
        "threejs-aaa-graphics-builder/references/visual-scorecard.md",
        "threejs-aaa-graphics-builder/references/checklists/procedural-model-quality.md",
        "threejs-aaa-graphics-builder/references/checklists/material-lighting-quality.md",
        "threejs-aaa-graphics-builder/references/checklists/performance-safe-visual-detail.md",
        "threejs-aaa-graphics-builder/references/checklists/aaa-game-quality-gate.md",
        "threejs-aaa-graphics-builder/references/checklists/aaa-visual-scorecard.md",
        "threejs-3d-generator/SKILL.md", "threejs-3d-generator/references/threejs-integration.md",
        "threejs-3d-generator/references/image-generator-workflows.md", "threejs-image-generator/SKILL.md"]
    manifest = {
        "formatVersion": 1, "id": "chest-anatomy-v2", "status": "AUTHORING_CHECKS_PASSED_VISUAL_REVIEW_PENDING",
        "runtime": {"file": "assets/models/chest-anatomy-v2.glb", "root": "ChestAnatomyKit", "units": "meters",
                    "outwardAxis": [0, 0, 1], "openingPlane": "local glTF XY", "components": ["ChestWound", "Heart"],
                    "heartGripLocalMeters": [0, 0, 0], "woundOuterPlaneLocalZ": 0,
                    "attachmentNote": "Compensate inherited 0.01 character socket scale; kit mesh object scales are 1. Heart and ChestWound are independent named meshes."},
        "files": {"script": "scripts/build-chest-anatomy.py", "candidate": "art/chest-anatomy-v2/chest-anatomy-v2.glb",
                  "master": ".art-source/chest-anatomy-v2/Chest_Anatomy_v2.blend", "closeups": shots,
                  "exportAudit": "art/chest-anatomy-v2/export-audit.json"},
        "budget": {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest(), "triangles": triangles,
                   "drawGroupsAllParts": groups, "materialCount": len(document["materials"]),
                   "imageCount": len(document.get("images", [])), "textureCount": len(document.get("textures", [])),
                   "textureDimensions": [1024, 512], "atlasTilePixels": TILE, "atlasPaddingPixels": PADDING,
                   "allImagesEmbedded": True, "metalness": 0, "normalScale": .48, "roughnessByIdentity": roughness,
                   "morphTargetCount": 4, "morphNormalsAndTangents": True},
        "parts": reports,
        "sourcing": {"geometry": "Original authored continuous ventricular surface, layered wound shell and detail meshes; no copied organ model or new paid generation.",
                     "albedo": "Hybrid: existing generated tissue swatches in art/gore-proof/tissue-atlas-v1-1024.png de-lit through robust luminance detail, recolored to dark tissue identities and coupled authored fields. Spherical seam values are blended; no new generated bitmap or provider job.",
                     "normalAndRoughness": "Locally authored field maps, padded shared atlas; not calibrated or scanned PBR.",
                     "newApiJobs": 0, "newCreditSpend": 0,
                     "externalGenerationDecision": "Existing generated hybrid tissue atlas is the explicit source choice for continuity with the reviewed BrutalAnatomy kit. Original offline geometry provides controllable local masking, named heart grip and exact dimensions without replacing the character.",
                     "credentialsUsedThisPass": False,
                     "referenceAtlas": str(SOURCE_ATLAS.relative_to(ROOT)).replace("\\", "/")},
        "anatomicalForms": ["One asymmetric continuous ventricular mass with an offset inferior apex", "Unequal embedded atria and thinner corrugated auricles",
                             "Severed aortic, pulmonary and venous roots; anterior arterial lumens face the exterior instead of hiding behind rounded caps", "Surface-following tapered coronary vessels and branching veins",
                             "Small embedded epicardial fat islands", "Irregular dark thoracic cavity with nonuniform tissue lips, sparse folded torn fabric tongues and a buried rib remnant"],
        "morphs": {"Heart": {"GripCompress": 0, "VesselLagLeft": 1, "VesselLagRight": 2}, "ChestWound": {"TissueTension": 0},
                   "defaultWeights": 0, "range": [0,1], "normals": True, "tangents": True,
                   "drivePlan": "Reset all influences to zero on instance/reset. GripCompress follows actual grip/contact phase; relax by damping to zero on release. Drive only one VesselLag direction at a time from clamped palm-frame acceleration, damp to zero after release. TissueTension follows chest contact/extraction and returns to zero; do not apply whole-object scale as compression."},
        "research": [{"url": "https://docs.blender.org/manual/en/2.93/addons/import_export/scene_gltf2.html", "supports": "glTF shape keys, normals and tangents export"},
                     {"url": "https://docs.blender.org/api/2.93/bpy.ops.export_scene.html", "supports": "export_morph, export_morph_normal, export_morph_tangent and export_apply flags"},
                     {"url": "https://docs.blender.org/manual/en/3.1/animation/shape_keys/introduction.html", "supports": "Relative shape key offsets and 0..1 blend"}],
        "referenceLedger": [{"path": "C:/Users/wolfk/.codex/skills/"+path, "read": True} for path in references],
        "verification": {"command": "\"C:/Program Files/Blender Foundation/Blender 2.93/blender.exe\" --background --factory-startup --python scripts/build-chest-anatomy.py",
                         "checks": ["<30000 triangles", "Two named mesh primitives", "Shared PBR atlas embedded in GLB",
                                    "Finite position and normal components", "Closed individually authored surfaces and consistent winding",
                                    "No degenerate triangles or collapsed UV triangles", "Neutral front/back/side plus authored compression/flex CPU renders exported",
                                    "Relative morph targets contain finite position/normal/tangent deltas",
                                    "Standalone and intended combined morph extremes have no reversed or degenerate triangles",
                                    "Default GLB morph weights are all zero"],
                         "notCertified": ["Runtime cut masking and socket fit", "Player hand penetration/grip posing", "Physical ragdoll collisions or soft tissue dynamics", "Professional photorealism"]},
        "limits": ["Fictional anatomical approximation, not medical reconstruction or scanned anatomy.",
                   "Generated albedo contains baked photographic lighting; authored roughness and normal variation are approximations.",
                   "Individually closed detail components overlap rather than being one watertight boolean-unioned organ.",
                   "Grip compression and vessel lag are authored relative shape keys, not physical softbody simulation. Finger contact, runtime morph driving and ragdoll/drop physics remain runtime responsibilities.",
                   "Wound insert requires runtime local chest masking and socket orientation; inserting the mesh alone does not open the preserved character."],
        "qualityVerdict": "Pending neutral closeup comparison and parent runtime review; the authored morphs do not establish professional realism or physical tissue fidelity."}
    serialized = json.dumps(manifest, indent=2)
    (ART/"chest-anatomy-v2-manifest.json").write_text(serialized)
    (OUTPUT.parent/"chest-anatomy-v2-manifest.json").write_text(serialized)
    print(json.dumps({"stage": "AUTHORING_COMPLETE", "manifest": str(OUTPUT.parent/"chest-anatomy-v2-manifest.json"),
                      "sha256": manifest["budget"]["sha256"], "closeups": shots}), flush=True)


if __name__ == "__main__":
    main()
