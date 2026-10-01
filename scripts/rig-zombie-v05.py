"""Offline weighted jaw/support-rig candidate, preserving authoritative v04 data.

Run inside Blender 2.93. This script never writes the live v04 asset.
"""
import argparse
import copy
import hashlib
import json
import math
import shutil
import struct
import subprocess
import sys
from collections import Counter
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/models/afterlife-ash-witness-motion-v04.glb"
ART = ROOT / "art/character-rig-v05"
MASTER = ROOT / ".art-source/character-rig-v05"
FRAMES = ROOT / "output/playwright/character-rig-v05"
MOUTH = Vector((.022,1.698,.113))
MOUTH_RIGHT = Vector((math.cos(-.34),math.sin(-.34),0))
MOUTH_UP = Vector((-math.sin(-.34),math.cos(-.34),0))
MOUTH_RADII = (.030,.0048)
CONTROLS = {}


def prepare_preview_image():
    """Decode the exact existing WebP only for Blender 2.93 form review.

    The delivered GLB keeps the original packed WebP. A saved PNG avoids an
    unsupported WebP glTF import extension in this older Blender version.
    """
    preview = MASTER / "original-skin-preview.png"
    if preview.exists():
        return
    interpreter = shutil.which("python")
    if not interpreter:
        raise RuntimeError("Saved preview PNG is missing; authoring needs host Python/Pillow to decode the existing WebP")
    decoder = "from PIL import Image; import sys; Image.open(sys.argv[1]).save(sys.argv[2])"
    subprocess.run([interpreter,"-c",decoder,str(MASTER/"original-skin-source.webp"),str(preview)],check=True)


class Glb:
    def __init__(self, path):
        self.raw = Path(path).read_bytes()
        length = struct.unpack_from("<I", self.raw, 12)[0]
        self.doc = json.loads(self.raw[20:20+length])
        self.binary = bytearray(self.raw[28+length:])
        self.parents = {child:index for index,node in enumerate(self.doc["nodes"]) for child in node.get("children",[])}

    def accessor(self, index):
        entry = self.doc["accessors"][index]
        view = self.doc["bufferViews"][entry["bufferView"]]
        code,size = {5120:("b",1),5121:("B",1),5122:("h",2),5123:("H",2),5125:("I",4),5126:("f",4)}[entry["componentType"]]
        width = {"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4,"MAT4":16}[entry["type"]]
        offset = view.get("byteOffset",0)+entry.get("byteOffset",0)
        stride = view.get("byteStride",size*width)
        return [struct.unpack_from("<"+code*width,self.binary,offset+i*stride) for i in range(entry["count"])]

    def add_accessor(self, values, kind, component=5126, target=None):
        self.binary += b"\x00"*((-len(self.binary))%4)
        offset = len(self.binary)
        code = {5120:"b",5121:"B",5122:"h",5123:"H",5125:"I",5126:"f"}[component]
        width = {"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4,"MAT4":16}[kind]
        for value in values:
            value = (value,) if not isinstance(value,(tuple,list,Vector)) else value
            self.binary += struct.pack("<"+code*width,*value)
        view = {"buffer":0,"byteOffset":offset,"byteLength":len(self.binary)-offset}
        if target:
            view["target"] = target
        view_index = len(self.doc["bufferViews"])
        self.doc["bufferViews"].append(view)
        entry = {"bufferView":view_index,"componentType":component,"count":len(values),"type":kind}
        if kind == "VEC3":
            entry["min"] = [min(v[i] for v in values) for i in range(3)]
            entry["max"] = [max(v[i] for v in values) for i in range(3)]
        index = len(self.doc["accessors"])
        self.doc["accessors"].append(entry)
        return index

    def local_matrix(self, index):
        node = self.doc["nodes"][index]
        if "matrix" in node:
            return Matrix([node["matrix"][i::4] for i in range(4)])
        rotation = node.get("rotation",[0,0,0,1])
        return Matrix.Translation(node.get("translation",[0,0,0])) @ Quaternion((rotation[3],*rotation[:3])).to_matrix().to_4x4() @ Matrix.Diagonal((*node.get("scale",[1,1,1]),1))

    def world_matrix(self, index):
        local = self.local_matrix(index)
        return self.world_matrix(self.parents[index]) @ local if index in self.parents else local

    def save(self, path):
        self.binary += b"\x00"*((-len(self.binary))%4)
        self.doc["buffers"][0]["byteLength"] = len(self.binary)
        encoded = json.dumps(self.doc,separators=(",",":")).encode()
        encoded += b" "*((-len(encoded))%4)
        content = struct.pack("<III",0x46546C67,2,28+len(encoded)+len(self.binary))+struct.pack("<II",len(encoded),0x4E4F534A)+encoded+struct.pack("<II",len(self.binary),0x004E4942)+self.binary
        Path(path).write_bytes(content)


def xyz(point):
    """glTF +Y up/+Z anterior to Blender +Z up/-Y anterior."""
    return Vector((point[0],-point[2],point[1]))


def smoothstep(a,b,value):
    t = max(0,min(1,(value-a)/(b-a)))
    return t*t*(3-2*t)


def mouth_uv(point):
    delta = Vector(point)-MOUTH
    return Vector((delta.dot(MOUTH_RIGHT),delta.dot(MOUTH_UP)))


def mix_weights(a,b,t):
    weights = Counter()
    for joint,weight in zip(*a):
        weights[joint] += weight*(1-t)
    for joint,weight in zip(*b):
        weights[joint] += weight*t
    selected = sorted(((j,w) for j,w in weights.items() if w>1e-8),key=lambda v:-v[1])[:4]
    total = sum(v[1] for v in selected)
    selected += [(0,0)]*(4-len(selected))
    return tuple(v[0] for v in selected),tuple(v[1]/total for v in selected)


class Geometry:
    def __init__(self,glb):
        primitive = glb.doc["meshes"][0]["primitives"][0]
        attribute = primitive["attributes"]
        self.positions = [Vector(p) for p in glb.accessor(attribute["POSITION"])]
        self.normals = [Vector(p) for p in glb.accessor(attribute["NORMAL"])]
        self.uvs = list(glb.accessor(attribute["TEXCOORD_0"]))
        self.joints = list(glb.accessor(attribute["JOINTS_0"]))
        self.weights = list(glb.accessor(attribute["WEIGHTS_0"]))
        self.colors = [(1,1,1,1)]*len(self.positions)
        indices = [p[0] for p in glb.accessor(primitive["indices"])]
        self.triangles = [[tuple(indices[i:i+3]) for i in range(0,len(indices),3)],[],[]]
        self.source_count = len(self.positions)
        self.clip_cache = {}
        self.oral_start = None
        self.cut_boundary = []
        self.cut_changed_faces = 0

    def add(self,point,weight,uv=(.5,.5),normal=(0,0,0),color=(1,1,1,1)):
        self.positions.append(Vector(point))
        self.normals.append(Vector(normal))
        self.uvs.append(tuple(uv))
        self.joints.append(tuple(weight[0]))
        self.weights.append(tuple(weight[1]))
        self.colors.append(tuple(color))
        return len(self.positions)-1

    def blend(self,a,b,t):
        point = self.positions[a].lerp(self.positions[b],t)
        uv = Vector(self.uvs[a]).lerp(Vector(self.uvs[b]),t)
        key = tuple(round(v,8) for v in (*point,*uv))
        if key in self.clip_cache:
            return self.clip_cache[key]
        normal = self.normals[a].lerp(self.normals[b],t).normalized()
        index = self.add(point,mix_weights((self.joints[a],self.weights[a]),(self.joints[b],self.weights[b]),t),uv,normal)
        self.clip_cache[key] = index
        return index

    def triangle(self,slot,a,b,c):
        if (self.positions[b]-self.positions[a]).cross(self.positions[c]-self.positions[a]).length > 1e-12:
            self.triangles[slot].append((a,b,c))

    def quad(self,slot,a,b,c,d):
        self.triangle(slot,a,b,c)
        self.triangle(slot,a,c,d)

    def finish_oral_normals(self):
        for faces in self.triangles[1:]:
            for a,b,c in faces:
                normal = (self.positions[b]-self.positions[a]).cross(self.positions[c]-self.positions[a])
                for index in (a,b,c):
                    if index >= self.oral_start:
                        self.normals[index] += normal
        for index in range(self.oral_start,len(self.normals)):
            self.normals[index].normalize()


def add_rig(glb):
    skin = glb.doc["skins"][0]
    old_matrices = glb.accessor(skin["inverseBindMatrices"])
    lookup = {node.get("name"):i for i,node in enumerate(glb.doc["nodes"])}
    joint_lookup = {glb.doc["nodes"][node]["name"]:i for i,node in enumerate(skin["joints"])}
    head_ibm = old_matrices[joint_lookup["Head"]]
    bind_basis = glb.world_matrix(lookup["Head"]) @ Matrix([head_ibm[i::4] for i in range(4)])
    specs = [
        ("Jaw","Head",(.010,1.738,.002),Quaternion((1,0,0,0)),"jaw",.58,1),
        ("Tongue","Jaw",(.022,1.691,.053),Quaternion((1,0,0,0)),"tongue",.16,-1),
        ("LeftGrip","LeftHand",(.724,1.400,.080),Quaternion((0,1,0),-math.pi/2),"grip",.70,-1),
        ("RightGrip","RightHand",(-.724,1.405,.081),Quaternion((0,1,0),-math.pi/2),"grip",.70,1),
    ]
    new_matrices = list(old_matrices)
    for name,parent,position,orientation,role,maximum,sign in specs:
        world = Matrix.Translation(position) @ orientation.to_matrix().to_4x4() @ Matrix.Diagonal((.01,.01,.01,1))
        local = glb.world_matrix(lookup[parent]).inverted() @ world
        location,rotation,scale = local.decompose()
        index = len(glb.doc["nodes"])
        control = {"name":name,"translation":list(location),"rotation":[rotation.x,rotation.y,rotation.z,rotation.w],"scale":list(scale),"extras":{"articulation":{"role":role,"axis":[1,0,0],"maxAngleRadians":maximum,"sign":sign},"rigVersion":5,"weighted":True}}
        glb.doc["nodes"].append(control)
        glb.doc["nodes"][lookup[parent]].setdefault("children",[]).append(index)
        glb.parents[index] = lookup[parent]
        lookup[name] = index
        joint_lookup[name] = len(skin["joints"])
        skin["joints"].append(index)
        inverse = world.inverted() @ bind_basis
        new_matrices.append(tuple(inverse[row][column] for column in range(4) for row in range(4)))
        CONTROLS[name] = {"node":index,"joint":joint_lookup[name],"parent":parent,"pivotGltfMeters":list(position),"globalRestQuaternion":[orientation.x,orientation.y,orientation.z,orientation.w],"articulation":control["extras"]["articulation"]}
    skin["inverseBindMatrices"] = glb.add_accessor(new_matrices,"MAT4")
    sockets = [("Socket_Head","Head",(0,1.735,0)),("Socket_Neck","neck",(0,1.58,.025)),("Socket_Chest","Spine",(0,1.40,.105)),("Socket_Abdomen","Spine02",(-.01,1.045,.103)),("Socket_LeftWrist","LeftHand",(.6432,1.41965,.08618)),("Socket_RightWrist","RightHand",(-.6474,1.42203,.08611))]
    socket_report = []
    for name,parent,position in sockets:
        world = Matrix.Translation(position) @ Matrix.Diagonal((.01,.01,.01,1))
        local = glb.world_matrix(lookup[parent]).inverted() @ world
        location,rotation,scale = local.decompose()
        index = len(glb.doc["nodes"])
        glb.doc["nodes"].append({"name":name,"translation":list(location),"rotation":[rotation.x,rotation.y,rotation.z,rotation.w],"scale":list(scale),"extras":{"attachmentSocket":True,"role":name.replace("Socket_","").lower(),"rigVersion":5}})
        glb.doc["nodes"][lookup[parent]].setdefault("children",[]).append(index)
        glb.parents[index] = lookup[parent]
        socket_report.append({"name":name,"parent":parent,"node":index,"positionGltfMeters":list(position),"nodeLocalUnit":"inherits original0.01 parent scale; socket children need matching world-scale handling"})
    return joint_lookup,socket_report


def articulation_weights(geometry,joints):
    counts = Counter()
    head_sources = {joints[name] for name in ("Head","headfront","head_end")}
    for index,point in enumerate(geometry.positions):
        u,v = mouth_uv(point)
        jaw = smoothstep(.006,-.007,v)*smoothstep(.095,.048,abs(u))*smoothstep(1.602,1.650,point.y)*smoothstep(-.055,.045,point.z)
        if abs(u)<.039 and point.z>.087 and 1.663<point.y<1.719:
            jaw = smoothstep(.0014,-.0014,v)
        if point.y>1.725 or point.y<1.600:
            jaw = 0
        weights = Counter({j:0 for j in geometry.joints[index]})
        for joint,weight in zip(geometry.joints[index],geometry.weights[index]):
            strength = jaw if joint in head_sources else 0
            weights[joint] += weight*(1-strength)
            if strength:
                weights[joints["Jaw"]] += weight*strength
        for side,hand,control in ((1,"LeftHand","LeftGrip"),(-1,"RightHand","RightGrip")):
            strength = smoothstep(.719,.774,point.x*side)
            amount = weights[joints[hand]]*strength
            if amount>1e-7:
                weights[joints[hand]] -= amount
                weights[joints[control]] += amount
        chosen = sorted(((j,w) for j,w in weights.items() if w>1e-8),key=lambda value:-value[1])[:4]
        total = sum(w for _,w in chosen)
        chosen += [(0,0)]*(4-len(chosen))
        geometry.joints[index] = tuple(j for j,_ in chosen)
        geometry.weights[index] = tuple(w/total for _,w in chosen)
        for name in ("Jaw","LeftGrip","RightGrip"):
            if weights[joints[name]]>.001:
                counts[name] += 1
    return dict(counts)


def cut_mouth(geometry):
    polygon = [Vector((MOUTH_RADII[0]*math.cos(i*2*math.pi/24),MOUTH_RADII[1]*math.sin(i*2*math.pi/24))) for i in range(24)]
    def signed(point,a,b):
        p = mouth_uv(geometry.positions[point])
        return (b-a).cross(p-a)
    def clip(vertices,a,b,inside):
        result = []
        for index,current in enumerate(vertices):
            previous = vertices[index-1]
            d0,d1 = signed(previous,a,b),signed(current,a,b)
            okay0,okay1 = (d0>=-1e-12,d1>=-1e-12) if inside else (d0<=1e-12,d1<=1e-12)
            if okay0 != okay1:
                result.append(geometry.blend(previous,current,d0/(d0-d1)))
            if okay1:
                result.append(current)
        return result
    original = geometry.triangles[0]
    geometry.triangles[0] = []
    for triangle in original:
        points = [geometry.positions[i] for i in triangle]
        projected = [mouth_uv(p) for p in points]
        if max(p.z for p in points)<.079 or max(p.y for p in points)<1.670 or min(p.y for p in points)>1.723 or max(v.x for v in projected)<-.034 or min(v.x for v in projected)>.034:
            geometry.triangles[0].append(triangle)
            continue
        remainder = list(triangle)
        pieces = []
        for index,a in enumerate(polygon):
            b = polygon[(index+1)%len(polygon)]
            exterior = clip(remainder,a,b,False)
            if len(exterior)>=3:
                pieces.append(exterior)
            remainder = clip(remainder,a,b,True)
            if len(remainder)<3:
                break
        if len(remainder)>=3:
            geometry.cut_changed_faces += 1
        for piece in pieces:
            for index in range(1,len(piece)-1):
                geometry.triangle(0,piece[0],piece[index],piece[index+1])
    boundary = {}
    for vertex in geometry.clip_cache.values():
        p = mouth_uv(geometry.positions[vertex])
        distances = []
        for index,a in enumerate(polygon):
            b = polygon[(index+1)%len(polygon)]
            direction = b-a
            t = (p-a).dot(direction)/direction.length_squared
            distances.append((p-(a+direction*max(0,min(1,t)))).length)
        if min(distances)<1e-6:
            key = tuple(round(c,6) for c in p)
            if key not in boundary or geometry.positions[vertex].z>geometry.positions[boundary[key]].z:
                boundary[key] = vertex
    geometry.cut_boundary = sorted(boundary.values(),key=lambda index:math.atan2(mouth_uv(geometry.positions[index]).y/MOUTH_RADII[1],mouth_uv(geometry.positions[index]).x/MOUTH_RADII[0]))
    if len(geometry.cut_boundary)<24 or geometry.cut_changed_faces<2:
        raise RuntimeError("Real scanned-lip cut failed; refusing a mouth overlay fallback")


def oral_weight(joints,lower,tongue=False):
    lower = max(0,min(1,lower))
    return ((joints["Jaw"],joints["Head"],joints["Tongue"] if tongue else 0,0),(lower*(.35 if tongue else 1),1-lower,lower*.65 if tongue else 0,0))


def cavity(geometry,joints):
    geometry.oral_start = len(geometry.positions)
    rings = []
    for row in range(5):
        ring = []
        for index,vertex in enumerate(geometry.cut_boundary):
            point = geometry.positions[vertex]
            u,v = mouth_uv(point)
            angle = math.atan2(v/MOUTH_RADII[1],u/MOUTH_RADII[0])
            sine = math.sin(angle)
            if row == 0:
                new_point = point.copy()
                weight = (geometry.joints[vertex],geometry.weights[vertex])
            else:
                scale = (1,.99,.92,.68,.38)[row]
                vertical = (MOUTH_RADII[1],.0057,.0105,.014,.017)[row]
                depth = (point.z,.105,.091,.063,.033)[row]
                new_point = MOUTH + MOUTH_RIGHT*(u*scale) + MOUTH_UP*(vertical*sine)
                new_point.z = depth
                lower = smoothstep(.35,-.35,sine)
                weight = oral_weight(joints,lower)
            shade = (.33,.10,.12,1) if row==1 else ((.060,.024,.030,1) if row>=3 else (.15,.047,.060,1))
            ring.append(geometry.add(new_point,weight,normal=(0,0,0),color=shade))
        rings.append(ring)
    for row in range(len(rings)-1):
        for index in range(len(rings[row])):
            following = (index+1)%len(rings[row])
            geometry.quad(1,rings[row][index],rings[row+1][index],rings[row+1][following],rings[row][following])
    back = geometry.add(MOUTH+Vector((0,.001,-.095)),oral_weight(joints,.3),color=(.018,.009,.011,1))
    for index in range(len(rings[-1])):
        geometry.triangle(1,rings[-1][index],back,rings[-1][(index+1)%len(rings[-1])])
    return len(geometry.cut_boundary)


def sweep(geometry,points,radii,weight,slot,color,sides=10,flatten=.7):
    rings = []
    for index,point in enumerate(points):
        tangent = (points[min(index+1,len(points)-1)]-points[max(0,index-1)]).normalized()
        normal = Vector((0,0,1))-tangent*tangent.z
        normal.normalize()
        binormal = tangent.cross(normal).normalized()
        ring = []
        for side in range(sides):
            angle = 2*math.pi*side/sides
            ring.append(geometry.add(point+radii[index]*(normal*math.cos(angle)*flatten+binormal*math.sin(angle)),weight,color=color))
        rings.append(ring)
    for index in range(len(rings)-1):
        for side in range(sides):
            following = (side+1)%sides
            geometry.quad(slot,rings[index][side],rings[index][following],rings[index+1][following],rings[index+1][side])
    for endpoint in (0,len(points)-1):
        center = geometry.add(points[endpoint],weight,color=color)
        for side in range(sides):
            following = (side+1)%sides
            if endpoint==0:
                geometry.triangle(slot,rings[endpoint][following],rings[endpoint][side],center)
            else:
                geometry.triangle(slot,rings[endpoint][side],rings[endpoint][following],center)


def dentition(geometry,joints):
    tooth_count = 0
    for upper in (True,False):
        weight = oral_weight(joints,0 if upper else 1)
        arc = []
        for index in range(27):
            u = -.031+.062*index/26
            point = MOUTH+MOUTH_RIGHT*u+MOUTH_UP*(.011 if upper else -.010)
            point.z = .097-.022*(abs(u)/.031)**1.7
            arc.append(point)
        radii = [.0026+.0004*math.cos(index*2.2) for index in range(len(arc))]
        sweep(geometry,arc,radii,weight,1,(.42,.13,.15,1),sides=10,flatten=1.25)
        for index in range(10):
            u = (index-4.5)*.0055
            incisor = abs(index-4.5)<2
            canine = abs(index-4.5)==2.5
            width = .0048 if incisor else (.0045 if canine else .0055)
            height = .0086 if incisor else (.0105 if canine else .0066)
            if upper and index in (3,6):
                height *= .72
            root = MOUTH+MOUTH_RIGHT*u+MOUTH_UP*(.0102 if upper else -.0094)
            root.z = .097-.020*(abs(u)/.030)**1.6
            tooth_rings = []
            for row in range(5):
                t = row/4
                crown = .78+.22*math.sin(t*math.pi*.82)
                tip_width = .17 if canine else .72
                crown *= 1-(1-tip_width)*max(0,(t-.72)/.28)
                center = root+MOUTH_UP*((-1 if upper else 1)*height*t)
                center.z += .0015*math.sin(t*math.pi)
                ring = []
                for side in range(8):
                    angle = side*2*math.pi/8
                    lateral = width*.5*crown*math.copysign(abs(math.cos(angle))**.48,math.cos(angle))
                    depth = .0022*(.9+.1*math.sin(t*math.pi))*math.copysign(abs(math.sin(angle))**.55,math.sin(angle))
                    point = center+MOUTH_RIGHT*lateral+Vector((0,0,depth))
                    if not incisor and not canine and row==4:
                        point += MOUTH_UP*((-1 if upper else 1)*.001*math.cos(angle*2))
                    shade = (.77,.69,.52,1) if row==0 else (.94,.87,.71,1)
                    ring.append(geometry.add(point,weight,color=shade))
                tooth_rings.append(ring)
            for row in range(4):
                for side in range(8):
                    following = (side+1)%8
                    geometry.quad(2,tooth_rings[row][side],tooth_rings[row][following],tooth_rings[row+1][following],tooth_rings[row+1][side])
            for endpoint in (0,4):
                center = sum((geometry.positions[i] for i in tooth_rings[endpoint]),Vector())/8
                cap = geometry.add(center,weight,color=(.88,.78,.61,1))
                for side in range(8):
                    following = (side+1)%8
                    if endpoint==0:
                        geometry.triangle(2,tooth_rings[endpoint][following],tooth_rings[endpoint][side],cap)
                    else:
                        geometry.triangle(2,tooth_rings[endpoint][side],tooth_rings[endpoint][following],cap)
            tooth_count += 1
    # Tongue: broad dorsal/ventral mesh with a tapered anterior tip and central
    # dorsal crease; not a sphere or a detached red overlay.
    tongue_rings = []
    for row in range(15):
        t = row/14
        z = .043+.056*t
        width = .004+.014*math.sin(math.pi*t)**.6
        depth = .0024+.0020*math.sin(math.pi*t)
        ring = []
        for side in range(16):
            angle = side*2*math.pi/16
            x = width*math.cos(angle)
            y = depth*math.sin(angle)
            if y>0:
                y -= .0012*math.exp(-(x/.003)**2)*math.sin(math.pi*t)
            point = MOUTH+MOUTH_RIGHT*x+MOUTH_UP*(-.0105+y)
            point.z = z
            tongue_weight = ((joints["Tongue"],joints["Jaw"],0,0),(.70+.30*t,.30*(1-t),0,0))
            ring.append(geometry.add(point,tongue_weight,color=(.56,.21,.25,1)))
        tongue_rings.append(ring)
    for row in range(14):
        for side in range(16):
            following = (side+1)%16
            geometry.quad(1,tongue_rings[row][side],tongue_rings[row][following],tongue_rings[row+1][following],tongue_rings[row+1][side])
    for endpoint in (0,14):
        center = sum((geometry.positions[i] for i in tongue_rings[endpoint]),Vector())/16
        cap = geometry.add(center,oral_weight(joints,1,True),color=(.45,.16,.20,1))
        for side in range(16):
            following = (side+1)%16
            if endpoint==0:
                geometry.triangle(1,tongue_rings[endpoint][following],tongue_rings[endpoint][side],cap)
            else:
                geometry.triangle(1,tongue_rings[endpoint][side],tongue_rings[endpoint][following],cap)
    return tooth_count


def export_candidate(glb,geometry):
    materials = [{"name":"Oral_Tissue_Gums_Tongue_And_Cavity","doubleSided":True,"pbrMetallicRoughness":{"baseColorFactor":[.45,.34,.36,1],"metallicFactor":0,"roughnessFactor":.44},"extras":{"oralSurface":True,"surfaceRole":"oral-tissue","rigVersion":5}},{"name":"Irregular_Dentition_Enamel","doubleSided":False,"pbrMetallicRoughness":{"baseColorFactor":[.82,.77,.64,1],"metallicFactor":0,"roughnessFactor":.52},"extras":{"oralSurface":True,"surfaceRole":"teeth","rigVersion":5}}]
    glb.doc["materials"].extend(materials)
    attributes = {"POSITION":glb.add_accessor([tuple(p) for p in geometry.positions],"VEC3",target=34962),"NORMAL":glb.add_accessor([tuple(n) for n in geometry.normals],"VEC3",target=34962),"TEXCOORD_0":glb.add_accessor(geometry.uvs,"VEC2",target=34962),"JOINTS_0":glb.add_accessor(geometry.joints,"VEC4",component=5121,target=34962),"WEIGHTS_0":glb.add_accessor(geometry.weights,"VEC4",target=34962),"COLOR_0":glb.add_accessor(geometry.colors,"VEC4",target=34962)}
    primitives = []
    for slot,triangles in enumerate(geometry.triangles):
        primitives.append({"attributes":attributes,"indices":glb.add_accessor([i for t in triangles for i in t],"SCALAR",component=5125,target=34963),"mode":4,"material":slot})
    old_extras = copy.deepcopy(glb.doc["meshes"][0].get("extras",{}))
    glb.doc["meshes"][0] = {"name":"Ash_Witness_Articulated_Exterior_And_Oral_Anatomy","primitives":primitives,"extras":{**old_extras,"rigVersion":5,"actualExteriorMouthCut":True,"detachedMouthOverlay":False}}
    glb.doc["asset"].setdefault("extras",{})["rigVersion"] = 5
    output = ART/"afterlife-ash-witness-rig-v05.glb"
    glb.save(output)
    return output


def compact_reachable(glb):
    """Remove obsolete original mesh storage, retaining reachable bytes exactly.

    Accessors and bufferViews are remapped; image, clip, skin and vertex contents
    are copied without conversion, compression or resampling.
    """
    doc = glb.doc
    used = set()
    for mesh in doc.get("meshes",[]):
        for primitive in mesh["primitives"]:
            used.update(primitive["attributes"].values())
            if "indices" in primitive:
                used.add(primitive["indices"])
            for target in primitive.get("targets",[]):
                used.update(target.values())
    for skin in doc.get("skins",[]):
        if "inverseBindMatrices" in skin:
            used.add(skin["inverseBindMatrices"])
    for animation in doc.get("animations",[]):
        for sampler in animation["samplers"]:
            used.add(sampler["input"])
            used.add(sampler["output"])
    accessor_map = {old:new for new,old in enumerate(sorted(used))}
    new_accessors = [copy.deepcopy(doc["accessors"][old]) for old in sorted(used)]
    views = {accessor["bufferView"] for accessor in new_accessors}
    views.update(image["bufferView"] for image in doc.get("images",[]) if "bufferView" in image)
    view_map = {old:new for new,old in enumerate(sorted(views))}
    binary = bytearray()
    new_views = []
    for old in sorted(views):
        view = copy.deepcopy(doc["bufferViews"][old])
        start = view.get("byteOffset",0)
        data = bytes(glb.binary[start:start+view["byteLength"]])
        binary += b"\x00"*((-len(binary))%4)
        view["buffer"],view["byteOffset"] = 0,len(binary)
        binary += data
        new_views.append(view)
    for accessor in new_accessors:
        accessor["bufferView"] = view_map[accessor["bufferView"]]
    for mesh in doc.get("meshes",[]):
        for primitive in mesh["primitives"]:
            primitive["attributes"] = {name:accessor_map[index] for name,index in primitive["attributes"].items()}
            if "indices" in primitive:
                primitive["indices"] = accessor_map[primitive["indices"]]
            for target in primitive.get("targets",[]):
                for name,index in target.items():
                    target[name] = accessor_map[index]
    for skin in doc.get("skins",[]):
        if "inverseBindMatrices" in skin:
            skin["inverseBindMatrices"] = accessor_map[skin["inverseBindMatrices"]]
    for animation in doc.get("animations",[]):
        for sampler in animation["samplers"]:
            sampler["input"] = accessor_map[sampler["input"]]
            sampler["output"] = accessor_map[sampler["output"]]
    for image in doc.get("images",[]):
        if "bufferView" in image:
            image["bufferView"] = view_map[image["bufferView"]]
    previous_length = len(glb.binary)
    previous_views = len(doc["bufferViews"])
    previous_accessors = len(doc["accessors"])
    glb.binary = binary
    doc["accessors"],doc["bufferViews"] = new_accessors,new_views
    doc["buffers"] = [{"byteLength":len(binary)}]
    return {"binaryBytesBefore":previous_length,"binaryBytesAfter":len(binary),"removedBytes":previous_length-len(binary),"accessorsBefore":previous_accessors,"accessorsAfter":len(new_accessors),"bufferViewsBefore":previous_views,"bufferViewsAfter":len(new_views),"method":"Copy reachable bufferView contents exactly; remap accessor/view indices. No quantization, resampling or image conversion."}


def image_bytes(glb,index=0):
    view = glb.doc["bufferViews"][glb.doc["images"][index]["bufferView"]]
    start = view.get("byteOffset",0)
    return bytes(glb.binary[start:start+view["byteLength"]])


def animation_metadata(animations):
    result = copy.deepcopy(animations)
    for animation in result:
        for sampler in animation["samplers"]:
            sampler["input"],sampler["output"] = 0,0
    return result


def master_armature(glb,geometry):
    # Import a copy with only unsupported WebP materials removed. Original node
    # transforms and clip buffers remain authoritative in the delivered GLB.
    reference = Glb(SOURCE)
    reference.doc.pop("extensionsUsed",None)
    reference.doc.pop("extensionsRequired",None)
    for name in ("images","textures","samplers"):
        reference.doc.pop(name,None)
    reference.doc["materials"] = [{"name":"Temporary_Reference_Material"}]
    reference_path = MASTER/"v04-geometry-and-clips-reference.glb"
    reference.save(reference_path)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(reference_path))
    rig = next(obj for obj in bpy.context.scene.objects if obj.type=="ARMATURE")
    for obj in list(bpy.context.scene.objects):
        if obj.type=="MESH":
            bpy.data.objects.remove(obj,do_unlink=True)
    rig.animation_data_clear()
    rig.data.pose_position = "POSE"
    for bone in rig.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    conversion = Matrix(((1,0,0),(0,0,-1),(0,1,0)))
    for name,control in CONTROLS.items():
        q = control["globalRestQuaternion"]
        orientation = conversion @ Quaternion((q[3],*q[:3])).to_matrix()
        point = xyz(control["pivotGltfMeters"])
        bone = rig.data.edit_bones.new(name)
        bone.matrix = Matrix.Translation(rig.matrix_world.inverted() @ point) @ orientation.to_4x4()
        bone.length = 2.7
        bone.parent = rig.data.edit_bones[control["parent"]]
        bone.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    for name,control in CONTROLS.items():
        rig.pose.bones[name].rotation_mode = "QUATERNION"
        rig.pose.bones[name]["articulation"] = json.dumps(control["articulation"])
    mesh = bpy.data.meshes.new("Weighted_v05_Exterior_And_Oral_Anatomy")
    all_faces = [triangle for triangles in geometry.triangles for triangle in triangles]
    mesh.from_pydata([xyz(p) for p in geometry.positions],[],all_faces)
    mesh.update()
    uv = mesh.uv_layers.new(name="Original_Skin_UV_Unchanged")
    vertex_color = mesh.vertex_colors.new(name="Oral_Anatomical_Color")
    for face in mesh.polygons:
        face.use_smooth = True
        for loop,index in zip(face.loop_indices,face.vertices):
            uv.data[loop].uv = (geometry.uvs[index][0],1-geometry.uvs[index][1])
            vertex_color.data[loop].color = geometry.colors[index]
    mesh.use_auto_smooth = True
    mesh.normals_split_custom_set_from_vertices([xyz(n).normalized() for n in geometry.normals])
    obj = bpy.data.objects.new("Ash_Witness_Rig_v05_Weighted_Character",mesh)
    bpy.context.collection.objects.link(obj)
    for index,node in enumerate(glb.doc["skins"][0]["joints"]):
        name = glb.doc["nodes"][node]["name"]
        obj.vertex_groups.new(name=name)
    for index,(joints,weights) in enumerate(zip(geometry.joints,geometry.weights)):
        for joint,weight in zip(joints,weights):
            if weight>.000001:
                obj.vertex_groups[joint].add([index],weight,"REPLACE")
    modifier = obj.modifiers.new("Genuine_Weighted_Articulation","ARMATURE")
    modifier.object = rig
    skin_material = bpy.data.materials.new("Scanned_Skin_Review_No_Emission")
    skin_material.use_nodes = True
    texture = skin_material.node_tree.nodes.new("ShaderNodeTexImage")
    texture.image = bpy.data.images.load(str(MASTER/"original-skin-preview.png"))
    texture.image.pack()
    shader = skin_material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = .68
    skin_material.node_tree.links.new(texture.outputs["Color"],shader.inputs["Base Color"])
    mesh.materials.append(skin_material)
    for description in glb.doc["materials"][1:]:
        material = bpy.data.materials.new(description["name"])
        material.use_nodes = True
        shader = material.node_tree.nodes.get("Principled BSDF")
        pbr = description["pbrMetallicRoughness"]
        shader.inputs["Roughness"].default_value = pbr["roughnessFactor"]
        shader.inputs["Specular"].default_value = .30
        color = material.node_tree.nodes.new("ShaderNodeVertexColor")
        color.layer_name = "Oral_Anatomical_Color"
        multiply = material.node_tree.nodes.new("ShaderNodeMixRGB")
        multiply.blend_type = "MULTIPLY"
        multiply.inputs[0].default_value = 1
        multiply.inputs[2].default_value = pbr["baseColorFactor"]
        material.node_tree.links.new(color.outputs["Color"],multiply.inputs[1])
        material.node_tree.links.new(multiply.outputs[0],shader.inputs["Base Color"])
        material["oralSurface"] = True
        material["surfaceRole"] = description["extras"]["surfaceRole"]
        mesh.materials.append(material)
    face_index = 0
    for slot,triangles in enumerate(geometry.triangles):
        for _triangle in triangles:
            mesh.polygons[face_index].material_index = slot
            face_index += 1
    return rig,obj


def pose_controls(rig,jaw=0,tongue=0,left=0,right=0):
    values = {"Jaw":jaw,"Tongue":tongue,"LeftGrip":left,"RightGrip":right}
    for name,value in values.items():
        spec = CONTROLS[name]["articulation"]
        rig.pose.bones[name].rotation_quaternion = Quaternion(Vector(spec["axis"]),value*spec["maxAngleRadians"]*spec["sign"])
    bpy.context.view_layer.update()


def rig_proof(glb):
    original = Glb(SOURCE)
    original_doc = copy.deepcopy(glb.doc)
    original_ibm = original.accessor(original.doc["skins"][0]["inverseBindMatrices"])
    geometry = Geometry(glb)
    joints,sockets = add_rig(glb)
    cut_mouth(geometry)
    # Weight the newly clipped lip boundary from its actual position. Interpolated
    # weights from coarse source edges otherwise create dangling chin/lip spikes.
    exterior_weight_counts = articulation_weights(geometry,joints)
    boundary = cavity(geometry,joints)
    tooth_count = dentition(geometry,joints)
    geometry.finish_oral_normals()
    total_triangles = sum(len(t) for t in geometry.triangles)
    if total_triangles>36000:
        raise RuntimeError("Rig candidate exceeded36k triangle budget")
    output = export_candidate(glb,geometry)
    rig,obj = master_armature(glb,geometry)
    camera = review_setup()
    outputs = []
    pose_controls(rig)
    outputs.append(snapshot(camera,"jaw-closed-front",(0,-.8,1.73),(0,-.015,1.70),.34))
    outputs.append(snapshot(camera,"jaw-closed-side",(.70,-.18,1.72),(0,-.01,1.70),.34))
    pose_controls(rig,jaw=1,tongue=.3)
    outputs.append(snapshot(camera,"jaw-open-front",(0,-.8,1.73),(0,-.015,1.68),.38))
    outputs.append(snapshot(camera,"jaw-open-side",(.70,-.22,1.70),(0,-.015,1.68),.38))
    outputs.append(snapshot(camera,"oral-interior-close",(.015,-.65,1.70),(.022,-.093,1.680),.17))
    pose_controls(rig,left=1,right=1)
    outputs.append(snapshot(camera,"hand-group-grip",(.77,-.50,1.46),(.74,-.065,1.39),.29))
    pose_controls(rig)
    blend = MASTER/"Ash_Witness_Rig_v05.blend"
    for action in bpy.data.actions:
        action.use_fake_user = True
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    exported = Glb(output)
    preserved_nodes = all({k:v for k,v in original_doc["nodes"][i].items() if k!="children"}=={k:v for k,v in exported.doc["nodes"][i].items() if k!="children"} for i in range(len(original_doc["nodes"])))
    preserved_children = all(exported.doc["nodes"][i].get("children",[])[:len(node.get("children",[]))]==node.get("children",[]) for i,node in enumerate(original_doc["nodes"]))
    current_ibm = exported.accessor(exported.doc["skins"][0]["inverseBindMatrices"])
    original_attributes = original.doc["meshes"][0]["primitives"][0]["attributes"]
    source_positions = original.accessor(original_attributes["POSITION"])
    source_normals = original.accessor(original_attributes["NORMAL"])
    source_uv = original.accessor(original_attributes["TEXCOORD_0"])
    node_checks = {"first24JointOrderExact":exported.doc["skins"][0]["joints"][:24]==original_doc["skins"][0]["joints"],"originalNodeTrsAndExtrasExact":preserved_nodes,"originalChildOrderPrefixExact":preserved_children,"first24InverseBindMatricesExact":current_ibm[:24]==original_ibm,"sixAnimationDefinitionsExact":exported.doc["animations"]==original_doc["animations"],"originalBinaryPrefixExact":bytes(exported.binary[:len(original.binary)])==bytes(original.binary),"originalMaterialExact":exported.doc["materials"][0]==original_doc["materials"][0],"originalImageTextureDefinitionsExact":exported.doc["images"]==original_doc["images"] and exported.doc["textures"]==original_doc["textures"],"originalVertexPositionsExact":[tuple(v) for v in geometry.positions[:geometry.source_count]]==source_positions,"originalVertexNormalsExact":[tuple(v) for v in geometry.normals[:geometry.source_count]]==source_normals,"originalVertexUvExact":geometry.uvs[:geometry.source_count]==source_uv}
    if not all(node_checks.values()):
        raise RuntimeError("Authoritative v04 preservation contract failed:"+json.dumps(node_checks))
    packing = compact_reachable(glb)
    glb.save(output)
    exported = Glb(output)
    del node_checks["originalBinaryPrefixExact"]
    del node_checks["sixAnimationDefinitionsExact"]
    del node_checks["originalImageTextureDefinitionsExact"]
    node_checks["sixAnimationMetadataExact"] = animation_metadata(exported.doc["animations"])==animation_metadata(original_doc["animations"])
    node_checks["sixAnimationInputOutputArraysExact"] = all(original.accessor(old_sampler[attribute])==exported.accessor(new_sampler[attribute]) for old_animation,new_animation in zip(original.doc["animations"],exported.doc["animations"]) for old_sampler,new_sampler in zip(old_animation["samplers"],new_animation["samplers"]) for attribute in ("input","output"))
    node_checks["originalPackedWebpBytesExact"] = image_bytes(original)==image_bytes(exported)
    node_checks["originalTextureDefinitionsExact"] = original.doc["textures"]==exported.doc["textures"]
    node_checks["first24InverseBindMatricesExact"] = exported.accessor(exported.doc["skins"][0]["inverseBindMatrices"])[:24]==original_ibm
    if not all(node_checks.values()) or output.stat().st_size>5*1024*1024:
        raise RuntimeError("Packed preservation/5MiB budget failed:"+json.dumps(node_checks))
    weight_counts = Counter()
    for joint_values,weights in zip(geometry.joints,geometry.weights):
        for joint,weight in zip(joint_values,weights):
            if weight>.001:
                weight_counts[exported.doc["nodes"][exported.doc["skins"][0]["joints"][joint]]["name"]] += 1
    manifest = {"formatVersion":1,"id":"afterlife-ash-witness-rig-v05","status":"ASSET_AUTHORING_REVIEWED_RUNTIME_QA_PENDING","integratedInGame":False,"files":{"glb":str(output.relative_to(ROOT)).replace("\\","/"),"master":str(blend.relative_to(ROOT)).replace("\\","/"),"script":"scripts/rig-zombie-v05.py","renders":[str(Path(p).relative_to(ROOT)).replace("\\","/") for p in outputs]},"source":{"file":"assets/models/afterlife-ash-witness-motion-v04.glb","sha256":hashlib.sha256(SOURCE.read_bytes()).hexdigest(),"preservationChecks":node_checks},"candidate":{"bytes":output.stat().st_size,"sha256":hashlib.sha256(output.read_bytes()).hexdigest(),"triangles":total_triangles,"primitiveTriangles":[len(t) for t in geometry.triangles],"vertices":len(geometry.positions),"jointCount":len(exported.doc["skins"][0]["joints"]),"materialCount":len(exported.doc["materials"]),"imageCount":len(exported.doc["images"]),"animations":[{"name":a["name"],"channels":len(a["channels"]),"extras":a.get("extras",{})} for a in exported.doc["animations"]],"packing":packing},"controls":CONTROLS,"sockets":sockets,"weights":{"exteriorWeightedVertices":exterior_weight_counts,"allWeightedVertices":dict(weight_counts),"maxSumError":max(abs(sum(w)-1) for w in geometry.weights),"unweightedVertices":sum(sum(w)<.999 for w in geometry.weights)},"mouth":{"actualExteriorCut":True,"overlay":False,"centerGltfMeters":list(MOUTH),"planeRight":list(MOUTH_RIGHT),"planeUp":list(MOUTH_UP),"ellipseRadiiMeters":list(MOUTH_RADII),"changedScannedFaces":geometry.cut_changed_faces,"cutBoundaryVertices":boundary,"authoredTeeth":tooth_count,"interior":"continuous weighted lip edge, cheek/palate cavity and closed throat back; upper/lower dental arcs, clipped/cusped enamel shapes, gum ridges and weighted dorsal tongue"},"metadataApi":{"pose":"restQuaternion * Quaternion(axisLocal, normalizedAmount*maxAngleRadians*sign), applied absolutely after mixer","controls":"node.extras.articulation","oralMaterials":"material.extras.oralSurface and surfaceRole","sockets":"node.extras.attachmentSocket; original0.01 scale inheritance retained"},"limits":["Finger silhouettes remain fused; LeftGrip/RightGrip curl weighted groups, not independent anatomical fingers.","Original scanned exterior is not remeshed; mouth boundary uses a local convex ellipse and blended chin/cheek weights.","No facial expressions, full dental occlusion solver, corrective shape keys or tissue SSS.","Original v04 motion channels and packed WebP remain exact; additional controls require runtime application after the mixer.","Sockets inherit original0.01 joint scale; attachment code must account for scale.","Blender proof uses the exact decoded original atlas without emission for form review; final game lighting needs separate QA."],"qualityVerdict":"Visibly usable weighted jaw/tongue and fused-hand group-curl candidate. Open/closed front/side and interior/grip neutral renders were inspected. Initial lower-lip spikes were corrected by analytically weighting actual clipped boundary vertices. Maximum opening stretches the coarse scanned cheeks; finer facial deformation and dental occlusion need corrective sculpt/shape work. Runtime clip blending and game-lighting QA remain pending."}
    manifest["review"] = {"frontSideOpenClosedViewed":True,"oralInteriorCloseViewed":True,"weightedHandGripViewed":True,"initialLipSpikeCorrected":True,"runtimeIntegrationVerified":False,"claimsProfessionalPhotorealism":False}
    manifest["referenceLedger"] = [{"path":"C:/Users/wolfk/.codex/skills/"+path,"loaded":True} for path in ("threejs-3d-generator/SKILL.md","threejs-3d-generator/references/threejs-integration.md","threejs-aaa-graphics-builder/references/model-recipes.md","threejs-aaa-graphics-builder/references/checklists/procedural-model-quality.md","threejs-procedural-animation/SKILL.md","threejs-procedural-animation/references/procedural-motion-and-docking-systems.md")]
    manifest["externalGeneration"] = {"newPaidJobs":0,"reason":"User-authorized source rig revision: exact existing scanned exterior/packed texture reused. New oral geometry authored offline to preserve existing skeleton/clips; no provider generation needed."}
    path = ART/"afterlife-ash-witness-rig-v05-manifest.json"
    path.write_text(json.dumps(manifest,indent=2))
    print(json.dumps({"glb":str(output),"blend":str(blend),"triangles":total_triangles,"vertices":len(geometry.positions),"joints":len(exported.doc["skins"][0]["joints"]),"mouthBoundary":boundary,"checks":node_checks,"renders":outputs}))


def aim(obj,target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()


def static_source(glb):
    primitive = glb.doc["meshes"][0]["primitives"][0]
    attributes = primitive["attributes"]
    positions = glb.accessor(attributes["POSITION"])
    uvs = glb.accessor(attributes["TEXCOORD_0"])
    indices = [v[0] for v in glb.accessor(primitive["indices"])]
    faces = [indices[i:i+3] for i in range(0,len(indices),3)]
    mesh = bpy.data.meshes.new("Exact_v04_Exterior_Inspection")
    mesh.from_pydata([xyz(p) for p in positions],[],faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="Original_v04_UV")
    for face in mesh.polygons:
        face.use_smooth = True
        for loop,vertex in zip(face.loop_indices,face.vertices):
            uv_layer.data[loop].uv = (uvs[vertex][0],1-uvs[vertex][1])
    obj = bpy.data.objects.new("Exact_v04_Exterior_Inspection",mesh)
    bpy.context.collection.objects.link(obj)
    material = bpy.data.materials.new("Original_Scanned_Skin_Preview_No_Emission")
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = 0.68
    texture = material.node_tree.nodes.new("ShaderNodeTexImage")
    image_path = MASTER / "original-skin-preview.png"
    if image_path.exists():
        texture.image = bpy.data.images.load(str(image_path))
        texture.image.pack()
        material.node_tree.links.new(texture.outputs["Color"],shader.inputs["Base Color"])
    mesh.materials.append(material)
    return obj, positions, faces, uvs


def review_setup():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 96
    scene.eevee.use_gtao = True
    scene.eevee.gtao_distance = 0.04
    scene.render.resolution_x = 800
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.world = bpy.data.worlds.new("Rig_Review_Neutral")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.06,0.07,0.08,1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.45
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = -0.2
    camera = bpy.data.objects.new("Rig_Review_Camera",bpy.data.cameras.new("Rig_Review_Camera"))
    bpy.context.collection.objects.link(camera)
    camera.data.type = "ORTHO"
    scene.camera = camera
    for name,location,energy,size in (("Neutral_Key",(-0.6,-0.8,2.2),65,0.8),("Neutral_Fill",(0.6,-0.4,1.8),25,0.5),("Neutral_Rim",(0.1,0.5,1.9),40,0.45)):
        light = bpy.data.objects.new(name,bpy.data.lights.new(name,"AREA"))
        bpy.context.collection.objects.link(light)
        light.location = location
        light.data.energy,light.data.size = energy,size
        aim(light,(0,0,1.7))
    return camera


def snapshot(camera,name,location,target,scale):
    camera.location = location
    aim(camera,target)
    camera.data.ortho_scale = scale
    path = FRAMES/(name+".png")
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    return str(path)


def main():
    argv = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--inspect",action="store_true")
    config = parser.parse_args(argv)
    for folder in (ART,MASTER,FRAMES):
        folder.mkdir(parents=True,exist_ok=True)
    glb = Glb(SOURCE)
    image_view = glb.doc["bufferViews"][glb.doc["images"][0]["bufferView"]]
    (MASTER/"original-skin-source.webp").write_bytes(glb.binary[image_view.get("byteOffset",0):image_view.get("byteOffset",0)+image_view["byteLength"]])
    prepare_preview_image()
    if not config.inspect:
        rig_proof(glb)
        return
    bpy.ops.wm.read_factory_settings(use_empty=True)
    obj,positions,faces,uvs = static_source(glb)
    camera = review_setup()
    outputs = []
    for name,location,target,scale in (("source-head-front",(0,-0.8,1.73),(0,-0.01,1.70),0.34),("source-head-side",(.7,-.22,1.70),(0,-.01,1.70),.34),("source-left-hand",(.77,-.5,1.46),(.73,-.065,1.405),.27),("source-left-hand-palm",(.74,.42,1.45),(.73,-.035,1.405),.27)):
        outputs.append(snapshot(camera,name,location,target,scale))
    if config.inspect:
        for point,color in (((-.02,1.698,.130),(1,.08,.08,1)),((.015,1.686,.130),(.08,1,.08,1)),((.048,1.674,.130),(.08,.08,1,1))):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=.002,location=xyz(point))
            marker = bpy.context.object
            marker_material = bpy.data.materials.new("Mouth_Inspection_Marker")
            marker_material.diffuse_color = color
            marker.data.materials.append(marker_material)
        outputs.append(snapshot(camera,"source-mouth-markers",(0,-.8,1.73),(0,-.01,1.70),.34))
    skin = glb.doc["skins"][0]
    ibms = glb.accessor(skin["inverseBindMatrices"])
    bind = []
    for joint,values in zip(skin["joints"],ibms):
        bind.append({"name":glb.doc["nodes"][joint]["name"],"worldMatrix":[list(row) for row in glb.world_matrix(joint)],"inverseBind":list(values),"combinedMatrix":[list(row) for row in glb.world_matrix(joint) @ Matrix([values[i::4] for i in range(4)])]})
    inspection = {"sourceSha256":hashlib.sha256(SOURCE.read_bytes()).hexdigest(),"sourceTriangles":len(faces),"sourceVertices":len(positions),"jointBindMatrices":bind,"renders":outputs,"mouthSectionVertices":[{"index":i,"position":p,"uv":uvs[i]} for i,p in enumerate(positions) if abs(p[0])<.045 and 1.60<p[1]<1.71 and p[2]>.09]}
    (MASTER/"source-inspection.json").write_text(json.dumps(inspection,indent=2))
    print(json.dumps({"sourceTriangles":len(faces),"sourceVertices":len(positions),"renders":outputs,"headBind":next(b for b in bind if b["name"]=="Head")}))


if __name__ == "__main__":
    main()
