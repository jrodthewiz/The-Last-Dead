"""Author a bundled, original fictional wound kit in headless Blender 2.93.

All four named meshes use metre units, XY opening planes and glTF +Z outward.
This asset compiler does not edit any character, rig, runtime or renderer file.
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
ART = ROOT / "art/brutal-anatomy-v1"
MASTER = ROOT / ".art-source/brutal-anatomy-v1"
OUTPUT = ROOT / "assets/models/brutal-anatomy-v1.glb"
SOURCE_ATLAS = ROOT / "art/gore-proof/tissue-atlas-v1-1024.png"
MATERIAL = None
TILES = {"muscle":(0,1),"bone":(1,1),"skin":(2,1),"fat":(3,1),"serosa":(0,0),"cavity":(1,0),"fascia":(2,0),"blood":(3,0)}
PADDING = 10


def bvec(point):
    return Vector((point[0],-point[2],point[1]))


def uv(tile,u,v):
    x,y = TILES[tile]
    u,v = max(0,min(1,u)),max(0,min(1,v))
    return ((x*128+PADDING+u*(128-2*PADDING))/512,(y*128+PADDING+v*(128-2*PADDING))/256)


def make_atlas():
    """Causal fields supply coupled micro-normal and roughness identities.

    Existing generated tissue swatches provide four albedo regions. The bone,
    ash skin and fascia regions are authored locally. Every region has repeated
    10px border padding; no provider or runtime generation is needed.
    """
    source = bpy.data.images.load(str(SOURCE_ATLAS))
    width,height = source.size
    pixels = np.asarray(source.pixels[:],dtype=np.float32).reshape(height,width,4)
    color = np.ones((256,512,4),dtype=np.float32)
    roughness = np.ones((256,512,4),dtype=np.float32)
    normal = np.ones((256,512,4),dtype=np.float32)
    normal[:,:,:3] = (.5,.5,1)
    rng = np.random.RandomState(713)
    yy,xx = np.mgrid[0:108,0:108]
    nx,ny = xx/107,yy/107
    role_rough = {"muscle":.52,"bone":.72,"skin":.78,"fat":.54,"serosa":.38,"cavity":.60,"fascia":.52,"blood":.32}
    regions = {"muscle":(0,1),"fat":(1,1),"serosa":(0,0),"cavity":(1,0),"blood":(1,0)}
    for role,(tx,ty) in TILES.items():
        grain = rng.normal(0,1,(108,108))
        fibres = np.sin(nx*46+ny*9+np.sin(ny*13)*1.4)
        pores = np.exp(-((np.sin(nx*57)*np.sin(ny*61))/0.11)**2)
        if role in regions:
            sx,sy = regions[role]
            xs = np.linspace(sx*width/2+20,(sx+1)*width/2-21,108).astype(int)
            ys = np.linspace(sy*height/2+20,(sy+1)*height/2-21,108).astype(int)
            patch = pixels[np.ix_(ys,xs)][:,:,:3].copy()
            patch = np.clip(patch*(.78 if role=="serosa" else .85),0,1)
            if role=="blood":
                patch *= np.array((.68,.48,.50))
        elif role=="bone":
            value = .85+grain*.018-pores*.035
            patch = np.stack((value*.98,value*.94,value*.83),axis=-1)
        elif role=="skin":
            value = .55+grain*.017+np.sin(nx*16+ny*11)*.020
            patch = np.stack((value*.92,value*.94,value*.90),axis=-1)
        else:
            value = .67+fibres*.025+grain*.012
            mottling=.055*np.sin(nx*10+ny*17)*np.sin(nx*19-ny*8)
            patch = np.stack((value*.88+mottling,value*.52+mottling*.5,value*.48+mottling*.4),axis=-1)
        height_field = fibres*.004+grain*.001 if role=="muscle" else grain*.0015+pores*.001
        if role=="serosa":
            height_field = grain*.0005+np.sin(nx*15+ny*11)*.001
        grad_y,grad_x = np.gradient(height_field)
        vector = np.stack((-grad_x*13,-grad_y*13,np.ones_like(grad_x)),axis=-1)
        vector /= np.linalg.norm(vector,axis=-1,keepdims=True)
        nmap = .5+.5*vector
        rmap = np.clip(role_rough[role]+grain*.015+height_field*.8,.18,.90)
        tile_color = np.ones((108,108,4),dtype=np.float32)
        tile_color[:,:,:3] = patch
        tile_normal = np.ones((108,108,4),dtype=np.float32)
        tile_normal[:,:,:3] = nmap
        tile_rough = np.ones((108,108,4),dtype=np.float32)
        tile_rough[:,:,:3] = rmap[:,:,None]
        for atlas,patch_values in ((color,tile_color),(normal,tile_normal),(roughness,tile_rough)):
            atlas[ty*128:(ty+1)*128,tx*128:(tx+1)*128] = np.pad(patch_values,((10,10),(10,10),(0,0)),mode="edge")
    images = []
    for name,array in (("anatomy-albedo",color),("anatomy-normal",normal),("anatomy-roughness",roughness)):
        image = bpy.data.images.new(name,width=512,height=256,alpha=True,float_buffer=False)
        if name != "anatomy-albedo":
            image.colorspace_settings.name = "Non-Color"
        image.pixels.foreach_set(np.clip(array,0,1).flatten())
        image.filepath_raw = str(ART/(name+".png"))
        image.file_format = "PNG"
        image.save()
        image.pack()
        images.append(image)
    material = bpy.data.materials.new("Brutal_Anatomy_Shared_PBR")
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Metallic"].default_value = 0
    shader.inputs["Specular"].default_value = .30
    base = material.node_tree.nodes.new("ShaderNodeTexImage")
    base.image = images[0]
    vertex = material.node_tree.nodes.new("ShaderNodeVertexColor")
    vertex.layer_name = "Anatomical_Contact_Color"
    multiply = material.node_tree.nodes.new("ShaderNodeMixRGB")
    multiply.blend_type = "MULTIPLY"
    multiply.inputs[0].default_value = 1
    material.node_tree.links.new(base.outputs["Color"],multiply.inputs[1])
    material.node_tree.links.new(vertex.outputs["Color"],multiply.inputs[2])
    material.node_tree.links.new(multiply.outputs[0],shader.inputs["Base Color"])
    rough = material.node_tree.nodes.new("ShaderNodeTexImage")
    rough.image = images[2]
    material.node_tree.links.new(rough.outputs["Color"],shader.inputs["Roughness"])
    micro = material.node_tree.nodes.new("ShaderNodeTexImage")
    micro.image = images[1]
    normal_node = material.node_tree.nodes.new("ShaderNodeNormalMap")
    normal_node.inputs["Strength"].default_value = .28
    material.node_tree.links.new(micro.outputs["Color"],normal_node.inputs["Color"])
    material.node_tree.links.new(normal_node.outputs["Normal"],shader.inputs["Normal"])
    material["fictionalAnatomy"] = True
    material["roughnessIdentity"] = json.dumps(role_rough)
    return material,role_rough


class Writer:
    def __init__(self):
        self.points=[]
        self.faces=[]
        self.uvs=[]
        self.colors=[]

    def vertex(self,point,color=(1,1,1,1)):
        self.points.append(Vector(point))
        self.colors.append(tuple(color))
        return len(self.points)-1

    def face(self,indices,tile,coords=None):
        if coords is None:
            coords=[(.5+self.points[i].x/.23,.5+self.points[i].y/.27) for i in indices]
        self.faces.append(tuple(indices))
        self.uvs.append([uv(tile,*p) for p in coords])

    def object(self,name,root):
        mesh=bpy.data.meshes.new(name+"_Authored_Geometry")
        mesh.from_pydata([bvec(p) for p in self.points],[],self.faces)
        mesh.update()
        mesh.materials.append(MATERIAL)
        layer=mesh.uv_layers.new(name="Padded_Physical_Scale_Anatomy_Atlas")
        colors=mesh.vertex_colors.new(name="Anatomical_Contact_Color")
        for polygon,coords in zip(mesh.polygons,self.uvs):
            polygon.use_smooth=True
            for loop,vertex,coordinate in zip(polygon.loop_indices,polygon.vertices,coords):
                layer.data[loop].uv=coordinate
                colors.data[loop].color=self.colors[vertex]
        obj=bpy.data.objects.new(name,mesh)
        bpy.context.collection.objects.link(obj)
        obj.parent=root
        obj["units"]="meters"
        obj["openingPlane"]="glTF XY; +Z outward"
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active=obj
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode="OBJECT")
        mesh.calc_normals_split()
        return obj


def catmull(points,count):
    points=[Vector(p) for p in points]
    samples=[]
    for index in range(len(points)-1):
        a,b,c,d=points[max(0,index-1)],points[index],points[index+1],points[min(len(points)-1,index+2)]
        for step in range(12):
            t=step/12
            samples.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
    samples.append(points[-1])
    lengths=[0]
    for a,b in zip(samples,samples[1:]):
        lengths.append(lengths[-1]+(b-a).length)
    result=[]
    index=1
    for step in range(count):
        target=lengths[-1]*step/(count-1)
        while index<len(samples)-1 and lengths[index]<target:
            index+=1
        t=(target-lengths[index-1])/max(1e-9,lengths[index]-lengths[index-1])
        result.append(samples[index-1].lerp(samples[index],t))
    return result,lengths[-1]


def sweep(writer,points,radii,tile="serosa",sides=16,compression=1,variable=False,color=(1,1,1,1)):
    points=[Vector(p) for p in points]
    rings=[]
    previous=Vector((0,0,1))
    lengths=[0]
    for a,b in zip(points,points[1:]):
        lengths.append(lengths[-1]+(b-a).length)
    for index,point in enumerate(points):
        t=index/(len(points)-1)
        tangent=(points[min(len(points)-1,index+1)]-points[max(0,index-1)]).normalized()
        normal=previous-tangent*previous.dot(tangent)
        if normal.length<.02:
            normal=Vector((1,0,0))-tangent*tangent.x
        normal.normalize()
        binormal=tangent.cross(normal).normalized()
        previous=normal
        squash=compression*(.82+.17*math.sin(t*23+.7)+.06*math.sin(t*61)) if variable else compression
        ring=[]
        for side in range(sides):
            angle=side*2*math.pi/sides
            lobe=1+.05*math.cos(angle*3+t*21)+.025*math.sin(angle*5-t*17)
            crease=1-.08*max(0,math.sin(t*49+math.sin(t*17)))**6 if variable else 1
            point_on_ring=point+radii[index]*lobe*crease*(normal*math.cos(angle)*squash+binormal*math.sin(angle))
            tint=(color[0]*(.89+.11*math.sin(t*8+.8)**2),color[1],color[2],1)
            ring.append(writer.vertex(point_on_ring,tint))
        rings.append(ring)
    for index in range(len(rings)-1):
        u0=(lengths[index]/.09)%1
        u1=(lengths[index+1]/.09)%1
        if u1<u0:
            u1=1
        for side in range(sides):
            follow=(side+1)%sides
            writer.face((rings[index][side],rings[index][follow],rings[index+1][follow],rings[index+1][side]),tile,[(u0,side/sides),(u0,(side+1)/sides),(u1,(side+1)/sides),(u1,side/sides)])
    for endpoint in (0,len(points)-1):
        center=writer.vertex(points[endpoint],color)
        for side in range(sides):
            follow=(side+1)%sides
            coords=[(.5+.45*math.cos(side*2*math.pi/sides),.5+.45*math.sin(side*2*math.pi/sides)),(.5+.45*math.cos((side+1)*2*math.pi/sides),.5+.45*math.sin((side+1)*2*math.pi/sides)),(.5,.5)]
            indices=(rings[endpoint][follow],rings[endpoint][side],center) if endpoint==0 else (rings[endpoint][side],rings[endpoint][follow],center)
            writer.face(indices,"cavity" if tile=="serosa" else tile,coords)


def closed_wound(writer,rx,ry,depth,count,kind):
    rings=[]
    # The torn fascia is intermittent, avoiding concentric colored donut rings.
    tiers=[(1.0,-.006,"skin"),(.94,.007,"skin"),(.85,.011,"muscle"),(.71,-.010,"muscle"),(.54,-depth*.72,"cavity"),(.22,-depth,"cavity")]
    for row,(scale,z,role) in enumerate(tiers):
        ring=[]
        for index in range(count):
            angle=index*2*math.pi/count
            asym=1+.10*math.sin(angle*3+.4)+.036*math.sin(angle*7-.8)
            asym+=.030*math.sin(angle*9+row*.85)*math.sin(row*math.pi/5)
            if kind=="abdomen":
                asym+=.045*math.sin(angle*2+1.3)
            point=(rx*scale*asym*math.cos(angle)+.010*scale*math.sin(angle),ry*scale*asym*math.sin(angle),z+.007*scale*math.sin(angle*5+row*.64))
            tint=(.68,.62,.60,1) if row<2 else ((.82,.71,.69,1) if row<4 else (.50,.42,.44,1))
            ring.append(writer.vertex(point,tint))
        rings.append(ring)
    for row in range(len(rings)-1):
        role=tiers[row][2]
        for index in range(count):
            follow=(index+1)%count
            region="fat" if row==3 and index%19 in (2,3,4) else role
            writer.face((rings[row][index],rings[row+1][index],rings[row+1][follow],rings[row][follow]),region)
    center=writer.vertex((.004,-.004,-depth-.006),(.29,.23,.24,1))
    backing=writer.vertex((0,0,-depth-.022),(.3,.25,.25,1))
    for index in range(count):
        follow=(index+1)%count
        writer.face((rings[-1][index],center,rings[-1][follow]),"cavity",[(index/count,.25),(.5,.75),((index+1)/count,.25)])
        # The closed underside can be visible during a detached-part spin or a
        # glancing view of a stump. It is exposed torn tissue, not a broad skin
        # patch: keep the gray ash skin restricted to the narrow exterior rim.
        writer.face((rings[0][follow],backing,rings[0][index]),"cavity",[(index/count,.25),(.5,.75),((index+1)/count,.25)])
    # Short shredded muscle bundles embedded in the cavity wall, not a continuous
    # trim ring. Flattened fibres have uneven pinched and ruptured ends.
    for index,angle in enumerate((.25,1.10,2.0,2.85,3.6,4.25,5.15,5.8)):
        points=[]
        for step in range(11):
            t=step/10
            a=angle+.31*(t-.5)
            points.append(Vector((rx*.78*math.cos(a),ry*.78*math.sin(a),-.009-.010*math.sin(t*math.pi)+.009*math.sin(a*4))))
        radii=[.002+.0050*(rx/.08)*math.sin(j*math.pi/10)**.7 for j in range(11)]
        sweep(writer,points,radii,"muscle",sides=10,compression=.50,color=(.78,.70,.69,1))
    return rings


def fractured_bone(writer,center,rx,ry,length,count=24):
    center=Vector(center)
    rings=[]
    for row in range(4):
        ring=[]
        for index in range(count):
            angle=index*2*math.pi/count
            radius=1+.07*math.sin(angle*3)+.04*math.cos(angle*7)
            z=(-length*.75,-length*.28,length*.24,length*.48)[row]
            if row==3:
                z+=length*.09*math.sin(angle*7+.4)+length*.065*math.sin(angle*11)
            point=center+Vector((rx*radius*math.cos(angle),ry*radius*math.sin(angle),z))
            tint=(.79,.65,.49,1) if row==3 else (.72,.64,.51,1)
            ring.append(writer.vertex(point,tint))
        rings.append(ring)
    for row in range(3):
        for index in range(count):
            follow=(index+1)%count
            writer.face((rings[row][index],rings[row][follow],rings[row+1][follow],rings[row+1][index]),"bone",[(index/count,row/3),((index+1)/count,row/3),((index+1)/count,(row+1)/3),(index/count,(row+1)/3)])
    marrow=[]
    for index in range(count):
        angle=index*2*math.pi/count
        point=center+Vector((rx*.60*math.cos(angle),ry*.60*math.sin(angle),length*.41+.004*math.sin(angle*5)))
        marrow.append(writer.vertex(point,(.20,.060,.046,1)))
    for index in range(count):
        follow=(index+1)%count
        writer.face((rings[3][index],rings[3][follow],marrow[follow],marrow[index]),"bone",[(.5+.45*math.cos(index*2*math.pi/count),.5+.45*math.sin(index*2*math.pi/count)),(.5+.45*math.cos((index+1)*2*math.pi/count),.5+.45*math.sin((index+1)*2*math.pi/count)),(.5+.28*math.cos((index+1)*2*math.pi/count),.5+.28*math.sin((index+1)*2*math.pi/count)),(.5+.28*math.cos(index*2*math.pi/count),.5+.28*math.sin(index*2*math.pi/count))])
    for endpoint in (0,3):
        z=-length*.75 if endpoint==0 else length*.43
        cap=writer.vertex(center+Vector((.002,-.001,z)),(.11,.025,.020,1) if endpoint==3 else (.68,.59,.47,1))
        for index in range(count):
            follow=(index+1)%count
            indices=(rings[endpoint][follow],rings[endpoint][index],cap) if endpoint==0 else (marrow[index],marrow[follow],cap)
            writer.face(indices,"bone",[(.5+.4*math.cos(index*2*math.pi/count),.5+.4*math.sin(index*2*math.pi/count)),(.5+.4*math.cos((index+1)*2*math.pi/count),.5+.4*math.sin((index+1)*2*math.pi/count)),(.5,.5)])


def vertebral_core(writer):
    fractured_bone(writer,(0,-.016,-.004),.021,.015,.060)
    # Cervical posterior arch: substantial bony loop, central foramen and torn
    # pedicles. A custom irregular annular extrusion replaces a naked torus.
    rings=[]
    count=36
    for radius,z in ((1,-.028),(1,.013),(.60,.009),(.60,-.028)):
        ring=[]
        for index in range(count):
            a=index*2*math.pi/count
            variation=1+.10*math.sin(3*a)+.045*math.sin(7*a)
            point=(.031*radius*variation*math.cos(a),.017+.023*radius*variation*math.sin(a),z+.0025*math.sin(5*a))
            tint=(.70,.60,.46,1) if math.sin(a*3+.8)>-.2 else (.55,.34,.27,1)
            ring.append(writer.vertex(point,tint))
        rings.append(ring)
    for row in range(4):
        nextrow=(row+1)%4
        for index in range(count):
            follow=(index+1)%count
            writer.face((rings[row][index],rings[row][follow],rings[nextrow][follow],rings[nextrow][index]),"bone",[(index/count,row/4),((index+1)/count,row/4),((index+1)/count,(row+1)/4),(index/count,(row+1)/4)])
    for side in (-1,1):
        points=[Vector((side*.022,.031,-.002)),Vector((side*.035,.038,.005)),Vector((side*.040,.042,.013))]
        sweep(writer,points,[.009,.006,.0025],"bone",sides=12,compression=.58,color=(.84,.78,.67,1))
    points=[Vector((0,.034,-.008)),Vector((0,.054,-.001)),Vector((.004,.063,.012))]
    sweep(writer,points,[.011,.007,.002],"bone",sides=12,compression=.56,color=(.86,.80,.69,1))


def wound_meshes(root):
    objects=[]
    writer=Writer()
    closed_wound(writer,.077,.066,.053,72,"neck")
    vertebral_core(writer)
    # Cut vessel ends and fascia slips, partly embedded in the muscle bed.
    for i,angle in enumerate((.8,2.6,4.3,5.5)):
        center=Vector((.045*math.cos(angle),.038*math.sin(angle),-.026))
        sweep(writer,[center,center+Vector((.003,-.002,.014)),center+Vector((.005,.002,.028))],[.0035,.003,.0018],"blood",sides=10,color=(.64,.53,.53,1))
    objects.append(writer.object("NeckWound",root))
    writer=Writer()
    closed_wound(writer,.050,.044,.045,56,"arm")
    fractured_bone(writer,(.007,-.005,-.005),.014,.011,.061)
    objects.append(writer.object("ArmWound",root))
    writer=Writer()
    closed_wound(writer,.084,.104,.056,80,"abdomen")
    # Oblique peeled flaps create torn asymmetry and depth at the opening.
    for i,(x,y) in enumerate(((-.056,.055),(.067,.014),(-.045,-.076),(.022,.086))):
        points=[Vector((x,y,-.013)),Vector((x*.93,y*.86,.005)),Vector((x*.75+.004,y*.71,.012))]
        sweep(writer,points,[.009,.0075,.0025],"muscle",sides=12,compression=.38,color=(.74,.65,.64,1))
    objects.append(writer.object("AbdomenWound",root))
    return objects


def mesentery(writer,points):
    # Small pleated, finished connective leaves sit behind the packed bowel.
    # Broad paper-like wedges are avoided by taper, scalloping and near-occlusion.
    for leaf,(start,end) in enumerate(((.11,.28),(.29,.49),(.52,.70))):
        rows,columns=7,17
        grid=[[],[]]
        for side in range(2):
            for row in range(rows):
                t=row/(rows-1)
                ring=[]
                for column in range(columns):
                    u=column/(columns-1)
                    s=start+(end-start)*u
                    endpoint=points[round(s*(len(points)-1))]+Vector((0,0,-.012))
                    anchor=Vector((-.013+leaf*.013+.016*(u-.5),-.065-leaf*.031+.002*math.sin(u*math.pi*2),.022))
                    p=anchor.lerp(endpoint,t)
                    p.z-=.014*math.sin(u*math.pi*7+.5*leaf)*math.sin(t*math.pi)
                    p.x+=.005*math.sin(u*15)*t*(1-t)
                    p.z+=.0007 if side==0 else -.0007
                    ring.append(writer.vertex(p,(.68,.48,.46,1)))
                grid[side].append(ring)
        for side in range(2):
            for row in range(rows-1):
                for column in range(columns-1):
                    indices=(grid[side][row][column],grid[side][row+1][column],grid[side][row+1][column+1],grid[side][row][column+1])
                    coords=[(column/(columns-1),row/(rows-1)),(column/(columns-1),(row+1)/(rows-1)),((column+1)/(columns-1),(row+1)/(rows-1)),((column+1)/(columns-1),row/(rows-1))]
                    writer.face(indices if side==0 else tuple(reversed(indices)),"fascia",coords if side==0 else list(reversed(coords)))
        boundary=[(0,c) for c in range(columns)]+[(r,columns-1) for r in range(1,rows)]+[(rows-1,c) for c in range(columns-2,-1,-1)]+[(r,0) for r in range(rows-2,0,-1)]
        for i,(r,c) in enumerate(boundary):
            r2,c2=boundary[(i+1)%len(boundary)]
            writer.face((grid[0][r][c],grid[0][r2][c2],grid[1][r2][c2],grid[1][r][c]),"fascia",[(i/len(boundary),.2),((i+1)/len(boundary),.2),((i+1)/len(boundary),.24),(i/len(boundary),.24)])
        for branch in range(3):
            endpoint=points[round((start+(end-start)*(branch+.5)/3)*(len(points)-1))]+Vector((0,0,-.010))
            origin=Vector((-.013+leaf*.013,-.065-leaf*.031,.022))
            branchpoints=[origin.lerp(endpoint,t/7)+Vector((.003*math.sin(t*math.pi/7),0,.001)) for t in range(8)]
            sweep(writer,branchpoints,[.0014*(1-t/12) for t in range(8)],"blood",sides=6,color=(.64,.50,.50,1))


def intestinal_bundle(root):
    writer=Writer()
    path=[(0,.025,-.025),(-.055,.002,.032),(-.116,-.018,.054),(-.143,-.069,.060),(-.102,-.107,.091),(-.027,-.091,.111),(.070,-.108,.081),(.126,-.071,.049),(.099,-.023,.048),(.040,-.031,.036),(.023,-.080,.071),(.085,-.135,.103),(.132,-.194,.124),(.096,-.239,.108),(.014,-.249,.071),(-.080,-.259,.101),(-.127,-.216,.057),(-.132,-.160,.090),(-.088,-.133,.135),(-.051,-.169,.157),(-.009,-.209,.174),(.032,-.209,.152),(.031,-.165,.119),(-.004,-.131,.128),(-.059,-.100,.170),(-.108,-.125,.179),(-.102,-.178,.171),(-.069,-.211,.184),(-.020,-.174,.192),(.033,-.143,.175),(.079,-.179,.180),(.068,-.228,.166),(.021,-.269,.159),(-.025,-.278,.129),(-.039,-.307,.098),(.016,-.328,.062),(.053,-.301,.082),(.032,-.256,.095),(-.005,-.215,.102),(-.031,-.160,.082),(-.011,-.080,.048),(0,.012,-.014)]
    points,length=catmull(path,210)
    radii=[]
    for index in range(len(points)):
        t=index/(len(points)-1)
        radius=.0163+.0049*math.sin(t*17+.3)+.0024*math.sin(t*43)+.0011*math.cos(t*103)
        radius*=.82+.18*min(1,t*20,(1-t)*20)
        radii.append(radius)
    sweep(writer,points,radii,"serosa",sides=20,compression=.94,variable=True,color=(.79,.68,.67,1))
    # Colon fragment at the root: broad shallow haustra rather than a duplicate
    # small-bowel rope. It seats into the cavity, joined visually by the web.
    colon,colon_length=catmull([(.057,.018,-.026),(.077,-.024,.013),(.066,-.075,.034),(.034,-.095,.030),(.006,-.073,.008)],45)
    colon_radii=[.022+.007*math.sin(index*math.pi/44)+.004*math.cos(index*math.pi*10/44) for index in range(45)]
    sweep(writer,colon,colon_radii,"serosa",sides=18,compression=.84,variable=True,color=(.68,.59,.58,1))
    mesentery(writer,points)
    return writer.object("IntestinalBundle",root),{"smallBowelPathMeters":length,"colonFragmentPathMeters":colon_length,"smallBowelRadiusMin":min(radii),"smallBowelRadiusMax":max(radii),"compressionVaries":True}


def diagnostics(obj):
    mesh=obj.data
    mesh.calc_loop_triangles()
    usage=Counter()
    winding=Counter()
    for polygon in mesh.polygons:
        vertices=list(polygon.vertices)
        for i,a in enumerate(vertices):
            b=vertices[(i+1)%len(vertices)]
            edge=tuple(sorted((a,b)))
            usage[edge]+=1
            winding[edge]+=1 if a<b else -1
    points=[Vector((v.co.x,v.co.z,-v.co.y)) for v in mesh.vertices]
    areas=[(points[t.vertices[1]]-points[t.vertices[0]]).cross(points[t.vertices[2]]-points[t.vertices[0]]).length*.5 for t in mesh.loop_triangles]
    bad_uv=0
    for triangle in mesh.loop_triangles:
        values=[mesh.uv_layers.active.data[i].uv for i in triangle.loops]
        bad_uv+=abs((values[1]-values[0]).cross(values[2]-values[0]))<1e-11
    low=[min(p[i] for p in points) for i in range(3)]
    high=[max(p[i] for p in points) for i in range(3)]
    return {"name":obj.name,"vertices":len(points),"triangles":len(mesh.loop_triangles),"drawGroups":1,"materials":1,"boundsGltfMeters":{"low":low,"high":high},"sizeMeters":[high[i]-low[i] for i in range(3)],"boundaryEdges":sum(v==1 for v in usage.values()),"nonmanifoldEdges":sum(v!=2 for v in usage.values()),"inconsistentWindingEdges":sum(winding[k]!=0 for k,v in usage.items() if v==2),"degenerateTriangles":sum(a<1e-11 for a in areas),"zeroAreaUvTriangles":int(bad_uv),"normalFinite":all(math.isfinite(c) for loop in mesh.loops for c in loop.normal),"normalLengthRange":[min(loop.normal.length for loop in mesh.loops),max(loop.normal.length for loop in mesh.loops)]}


def aim(obj,target):
    obj.rotation_euler=(bvec(target)-obj.location).to_track_quat("-Z","Y").to_euler()


def proof_renders(objects):
    scene=bpy.context.scene
    scene.render.engine="BLENDER_EEVEE"
    scene.eevee.taa_render_samples=96
    scene.eevee.use_gtao=True
    scene.eevee.gtao_distance=.028
    scene.eevee.gtao_factor=1.08
    scene.render.resolution_x=800
    scene.render.resolution_y=800
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.world=bpy.data.worlds.new("Neutral_Anatomy_Review")
    scene.world.use_nodes=True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value=(.055,.063,.070,1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value=.40
    scene.view_settings.view_transform="Filmic"
    scene.view_settings.look="Medium High Contrast"
    scene.view_settings.exposure=-.2
    camera=bpy.data.objects.new("Anatomy_Proof_Camera",bpy.data.cameras.new("Anatomy_Proof_Camera"))
    bpy.context.collection.objects.link(camera)
    camera.data.type="ORTHO"
    scene.camera=camera
    for name,point,energy,size in (("Neutral_Key",(-.35,.45,.70),55,.7),("Neutral_Fill",(.45,.02,.35),22,.6),("Neutral_Rim",(.2,.3,-.35),38,.45)):
        light=bpy.data.objects.new(name,bpy.data.lights.new(name,"AREA"))
        bpy.context.collection.objects.link(light)
        light.location=bvec(point)
        light.data.energy,light.data.size=energy,size
        aim(light,(0,-.04,0))
    outputs=[]
    shots=[("neck-neutral-close",{"NeckWound"},(.22,.12,.52),(0,0,-.005),.255),
           ("arm-neutral-close",{"ArmWound"},(.21,.10,.50),(0,0,-.004),.19),
           ("abdomen-intestines-neutral-close",{"AbdomenWound","IntestinalBundle"},(.32,.04,.85),(0,-.11,.045),.49),
           ("neck-neutral-back",{"NeckWound"},(.18,.09,-.46),(0,0,-.035),.255),
           ("arm-neutral-back",{"ArmWound"},(.17,.08,-.42),(0,0,-.030),.19)]
    for name,visible,point,target,scale in shots:
        for obj in objects:
            obj.hide_render=obj.name not in visible
        camera.location=bvec(point)
        aim(camera,target)
        camera.data.ortho_scale=scale
        path=ART/(name+".png")
        scene.render.filepath=str(path)
        bpy.ops.render.render(write_still=True)
        outputs.append(str(path.relative_to(ROOT)).replace("\\","/"))
    for obj in objects:
        obj.hide_render=False
    return outputs


def main():
    global MATERIAL
    for folder in (ART,MASTER,OUTPUT.parent):
        folder.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATERIAL,roughness=make_atlas()
    root=bpy.data.objects.new("BrutalAnatomyKit",None)
    bpy.context.collection.objects.link(root)
    root["fictionalAnatomy"]=True
    root["units"]="meters"
    root["outwardAxis"]="glTF +Z"
    objects=wound_meshes(root)
    bundle,lengths=intestinal_bundle(root)
    objects.append(bundle)
    reports=[diagnostics(obj) for obj in objects]
    triangles=sum(r["triangles"] for r in reports)
    if triangles>=22000 or any(r["boundaryEdges"] or r["nonmanifoldEdges"] or r["inconsistentWindingEdges"] or r["degenerateTriangles"] or r["zeroAreaUvTriangles"] or not r["normalFinite"] for r in reports):
        raise RuntimeError("Anatomy kit triangle/closed-surface gate failed:"+json.dumps(reports))
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active=root
    candidate=ART/"brutal-anatomy-v1.glb"
    bpy.ops.export_scene.gltf(filepath=str(candidate),export_format="GLB",use_selection=True,export_yup=True,export_texcoords=True,export_normals=True,export_tangents=True,export_colors=True,export_materials="EXPORT",export_animations=False,export_extras=True)
    raw=candidate.read_bytes()
    jlength=struct.unpack_from("<I",raw,12)[0]
    document=json.loads(raw[20:20+jlength])
    for material in document["materials"]:
        if not all((material.get("pbrMetallicRoughness",{}).get("baseColorTexture"),material.get("pbrMetallicRoughness",{}).get("metallicRoughnessTexture"),material.get("normalTexture"))):
            raise RuntimeError("Authored albedo/roughness/normal textures were not retained by the exporter: "+json.dumps(material))
    exported_triangles=sum(document["accessors"][p["indices"]]["count"]//3 for mesh in document["meshes"] for p in mesh["primitives"])
    drawgroups=sum(len(mesh["primitives"]) for mesh in document["meshes"])
    if exported_triangles!=triangles or drawgroups>=6 or len(document["materials"])>3:
        raise RuntimeError("Export budget mismatch")
    outputs=proof_renders(objects)
    blend=MASTER/"Brutal_Anatomy_v1.blend"
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    OUTPUT.write_bytes(raw)
    manifest={"formatVersion":1,"id":"brutal-anatomy-v1","status":"RUNTIME_KIT_CANDIDATE_REQUIRES_VISUAL_REVIEW","runtime":{"file":"assets/models/brutal-anatomy-v1.glb","units":"meters","root":"BrutalAnatomyKit","outwardAxis":[0,0,1],"openingPlane":"local glTF XY","socketScaleNote":"Original Ash Witness sockets inherit0.01 scale. Attach code must compensate to preserve the authored metre sizes."},"files":{"candidate":"art/brutal-anatomy-v1/brutal-anatomy-v1.glb","master":".art-source/brutal-anatomy-v1/Brutal_Anatomy_v1.blend","script":"scripts/build-brutal-anatomy.py","closeups":outputs},"budget":{"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest(),"triangles":triangles,"drawGroupsAllParts":drawgroups,"drawGroupsAbdomenAndBundle":2,"materialCount":len(document["materials"]),"imageCount":len(document.get("images",[])),"textureCount":len(document.get("textures",[])),"textureDimensions":[512,256],"atlasTilePixels":128,"atlasPaddingPixels":10,"metalness":0,"normalScale":.28,"roughnessByIdentity":roughness,"allImagesEmbedded":all("bufferView" in image for image in document.get("images",[]))},"parts":reports,"intestines":lengths,"sourcing":{"geometry":"Original closed semantic meshes authored offline; no new generation job, no copied organ model.","albedo":"Existing generated tissue swatches reused with locally authored bone/ash-skin/fascia identity regions. Not scanned/calibrated PBR.","normalAndRoughness":"Locally authored coupled pore/fibre fields; physical identity roughness and restrained micro-normal variation.","referenceAtlas":"art/gore-proof/tissue-atlas-v1-1024.png"},"limits":["Cinematic fictional anatomical inspiration, not medical reconstruction or AAA realism.","Generated tissue albedo contains baked lighting cues; roughness and micro-normal maps are authored approximations.","Bowell loops are static geometry. Local overlap/contact is authored; no collision/volume-preserving softbody simulation.","Mesentery is finished thin opaque geometry; translucency and real tissue scattering are not represented.","Separate wound inserts require character mask/cull integration; they do not cut the preserved character by themselves.","PC runtime finish timing, socket placement and lighting remain parent QA responsibilities."],"qualityVerdict":"Pending neutral closeup inspection."}
    manifest["status"]="AUTHORING_AND_NEUTRAL_CLOSEUP_CHECKS_PASSED_RUNTIME_REVIEW_PENDING"
    manifest["runtime"]["socketScaleNote"]="Original Ash Witness sockets inherit 0.01 scale. Attach code must compensate to preserve the authored metre sizes."
    manifest["limits"][2]="Bowel loops are static geometry. Local overlap/contact is authored; no collision or volume-preserving softbody simulation."
    manifest["limits"].extend(["Bone fracture, fascia and bowel folds remain visibly procedural/stylized at extreme close range.","Individually closed tissue components meet by authored overlap; this is not a boolean-unioned medical topology."])
    manifest["qualityVerdict"]="Neutral front and back closeups inspected after the material-map, marrow, mesentery and dark underside corrections. Usable fictional wound-kit candidate with layered depth and varying, overlapping bowel forms; requires fresh runtime socket/masking and finish-playback review. Not scanned anatomy or AAA realism."
    manifest["visualReview"]={"inspectedFrames":outputs,"lighting":"Neutral key/fill/rim at authored metre dimensions, no bloom","corrections":["Preserved generated roughness/normal pixels by assigning non-color space before pixel upload.","Finished the narrow mesentery root strip and all bone-arch UVs without collapsed triangles.","Added dark marrow recessed inside irregular bone cortex and stained arch sectors.","Recolored and refined mesentery pleats to reduce the canvas-sheet appearance.","Mapped all closed wound undersides to dark cavity tissue, retaining gray ash skin only on the narrow exterior border."],"remainingLimits":["Very tight bowel bends reveal some angular longitudinal segments in a full-frame closeup.","Opaque membrane has no real translucency or tissue scattering.","Skin border coloration is generic ash gray and needs the runtime character lighting to confirm its match.","Kit dimensions are preserved; current runtime Socket_Neck is an anterior surface anchor and needs a centered cut frame."]}
    manifest["sourceFitMeasurement"]={"source":"assets/models/afterlife-ash-witness-rig-v05.glb (read only)","method":"Rest-position exterior vertex slice within 0.006 m of y=1.58 m; includes the full original scanned surface","neckSliceMeters":{"centerY":1.58,"widthX":.170418,"extentZ":[-.103458,.030000],"midpointZ":-.036729},"socketNeckGltfMeters":[0,1.58,.025],"fitDecision":"Keep the .164 m authored neck width; moving the runtime frame roughly .062 m posterior is safer than shrinking the cap without matching the cut. Arm dimensions unchanged pending a precise shoulder plane measurement."}
    backing_limit="Direct macro back views still reveal stretched radial-fan UVs and faceted backing geometry; the dark tissue identity correction does not certify a sculpted underside."
    manifest["limits"].append(backing_limit)
    manifest["visualReview"]["remainingLimits"].append(backing_limit)
    manifest["verification"]={"command":"\"C:/Program Files/Blender Foundation/Blender 2.93/blender.exe\" --background --factory-startup --python scripts/build-brutal-anatomy.py","checked":["Authored mesh triangles <22000","Four mesh primitives and one material","Closed surfaces, consistent winding, no degenerate triangles","All UV triangles have positive area; finite unit normals","Albedo, packed metal/roughness and normal maps retained in GLB","All image dependencies embedded in GLB","Three front and two back neutral closeups rendered and inspected"],"notCertified":["Runtime socket placement and bone masking","PC browser finish performance and player animation integration"]}
    (ART/"brutal-anatomy-v1-manifest.json").write_text(json.dumps(manifest,indent=2))
    (OUTPUT.parent/"brutal-anatomy-v1-manifest.json").write_text(json.dumps(manifest,indent=2))
    print(json.dumps({"glb":str(OUTPUT),"bytes":len(raw),"triangles":triangles,"drawgroups":drawgroups,"materials":len(document["materials"]),"images":len(document.get("images",[])),"parts":reports,"closeups":outputs}))


if __name__=="__main__":
    main()
