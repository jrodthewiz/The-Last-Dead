"""Bounded leather glove pass on the real v2 Blender hand master.

CPU authoring only. Keep a checkpoint of the accepted bare-finger v2 master,
author from that checkpoint, and save the editable final master. Export with
refine-viewmodel-arms-v2.py -- --export-only after this script completes.
"""
import bpy, math, shutil, json, hashlib
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
ARCHIVE=ROOT/'.art-source/viewmodel-arms-v2'
MASTER=ARCHIVE/'The_Last_Dead_Clean_First_Person_Arms_v2.blend'
CHECKPOINT=ARCHIVE/'Accepted_Bare_Fingertip_v2.blend'
if not CHECKPOINT.exists():shutil.copy2(MASTER,CHECKPOINT)
checkpoint_hash=hashlib.sha256(CHECKPOINT.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(CHECKPOINT))

def catmull(points,t):
    i=min(len(points)-2,int(t));f=t-i
    p0,p1,p2,p3=[Vector(points[max(0,min(len(points)-1,k))])for k in [i-1,i,i+1,i+2]]
    return .5*((2*p1)+(-p0+p2)*f+(2*p0-5*p1+4*p2-p3)*f*f+(-p0+3*p1-3*p2+p3)*f*f*f)

def game_point(p):return Vector((p.x,p.z,-p.y))
def blender_point(p):return Vector((p.x,-p.z,p.y))

# One shared leather material. Reuse the existing common crease normal and
# packed roughness maps; remove the skin atlas input. No per-finger textures.
material=bpy.data.materials['TLD_View_Hybrid_Atlas'].copy()
material.name='TLD_Full_Worn_Leather_Gloves_v2'
bsdf=material.node_tree.nodes['Principled BSDF']
for link in list(bsdf.inputs['Base Color'].links):material.node_tree.links.remove(link)
color=material.node_tree.nodes.new('ShaderNodeVertexColor');color.layer_name='AuthoredLeatherZones'
material.node_tree.links.new(color.outputs['Color'],bsdf.inputs['Base Color'])
bsdf.inputs['Base Color'].default_value=(1,1,1,1)
bsdf.inputs['Roughness'].default_value=.84
bsdf.inputs['Metallic'].default_value=0
bsdf.inputs['Specular'].default_value=.22
for node in material.node_tree.nodes:
    if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=.28

pivots_before={obj.name:[list(obj.location),list(obj.rotation_euler),list(obj.scale)]
    for obj in bpy.data.objects if obj.type=='EMPTY'}
authored=[]
for side in ['Left','Right']:
    sign=-1 if side=='Left' else 1
    for digit,y,r,length in [('Index',.043,.0105,1),('Middle',.015,.0107,1.06),('Ring',-.013,.0099,1),('Little',-.039,.0084,.86),('Thumb',0,.012,1)]:
        if digit=='Thumb':path=[(sign*.048,-.019,-.016),(sign*.059,.002,-.027),(sign*.044,.021,-.039),(sign*.026,.028,-.044),(sign*.009,.025,-.032)]
        elif side=='Right' and digit=='Index':path=[(.032,.043,-.016),(.016,.048,-.003),(-.007,.055,.008),(-.029,.061,.014),(-.048,.063,.008),(-.065,.059,-.002)]
        else:path=[(sign*.050,y,-.016),(sign*.052,y-.002,.007),(sign*.035,y-.004,.030),(sign*.010,y-.007,.036),(-sign*.015*length,y-.010,.027),(-sign*.025*length,y-.014,.007)]
        origin=Vector(path[0]);local=[tuple(Vector(p)-origin)for p in path]
        frames=[]
        for k in range(129):
            f=k/128;t=f*(len(path)-1);center=catmull(local,t)
            tangent=(catmull(local,min(len(path)-1,t+.018))-catmull(local,max(0,t-.018))).normalized()
            absolute=center+origin;normal=Vector((absolute.x,0,absolute.z));normal-=tangent*normal.dot(tangent)
            if normal.length<1e-7:normal=Vector((0,1,0))-tangent*tangent.y
            normal.normalize();frames.append((f,center,normal,tangent.cross(normal).normalized()))
        for prefix in ['Grip','Nail']:
            obj=bpy.data.objects[prefix+digit+'_'+side];data=obj.data
            zones=[]
            for vertex in data.vertices:
                point=game_point(vertex.co)
                f,center,normal,binormal=min(frames,key=lambda frame:(point-frame[1]).length_squared)
                radial=point-center;size=max(radial.length,1e-7)
                dorsal=max(0,radial.dot(normal)/size)
                angle=math.atan2(radial.dot(binormal),radial.dot(normal))
                pad=sum(math.exp(-((f-middle)/width)**2)for middle,width in [(.20,.085),(.53,.07),(.76,.055)])
                seam=math.exp(-((abs(angle)-.86)/.085)**2)*dorsal
                if prefix=='Grip':
                    # Integral restrained dorsal padding and shallow seam
                    # channels; contact-side pads and the centerline stay put.
                    point+=normal*(.0016*pad*dorsal*dorsal-.00020*seam)
                    vertex.co=blender_point(point)
                grain=1+.045*math.sin(f*193+angle*17)*math.cos(angle*41-f*77)
                base=Vector((.028,.034,.031))*grain
                base+=Vector((.014,.014,.011))*min(1,pad)*dorsal
                stitch=seam*(.5+.5*(math.sin(f*235)>.05))
                base=base.lerp(Vector((.090,.088,.072)),min(.72,stitch*.72))
                if prefix=='Nail':base=Vector((.040,.045,.037))*(.93+.07*math.sin(f*91))
                zones.append((*base,1))
            data.update()
            for layer in list(data.vertex_colors):data.vertex_colors.remove(layer)
            layer=data.vertex_colors.new(name='AuthoredLeatherZones')
            for loop in data.loops:layer.data[loop.index].color=zones[loop.vertex_index]
            data.materials.clear();data.materials.append(material)
            obj['surface_revision']=4;obj['garment']='Full worn leather glove; integrated dorsal pad and interrupted seam'
            obj['maximum_added_dorsal_padding_metres']=.0016 if prefix=='Grip' else 0
            # Existing nail plates now form subdued stitched reinforcement;
            # retain their names and topology to preserve integration contracts.
            obj['skin_or_nail_visible']=False
            authored.append(obj.name)
    palm=bpy.data.objects['GripPalm_'+side];data=palm.data
    for layer in list(data.vertex_colors):data.vertex_colors.remove(layer)
    layer=data.vertex_colors.new(name='AuthoredLeatherZones')
    colors=[]
    for vertex in data.vertices:
        p=game_point(vertex.co);dorsal=max(0,min(1,(sign*p.x-.015)/.065))
        seam=math.exp(-((p.y+.051)/.0023)**2)+.7*math.exp(-((p.y-.032)/.0023)**2)
        grain=1+.05*math.sin(p.x*561+p.y*317)*math.cos(p.z*397-p.y*239)
        c=Vector((.028,.034,.031))*grain+Vector((.014,.014,.011))*dorsal
        c=c.lerp(Vector((.090,.088,.072)),min(.65,seam*dorsal*.65))
        colors.append((*c,1))
    for loop in data.loops:layer.data[loop.index].color=colors[loop.vertex_index]
    data.materials.clear();data.materials.append(material);palm['surface_revision']=4;palm['garment']='Shared worn glove with stitched cuff and dorsal reinforcement'
    authored.append(palm.name)

for name,before in pivots_before.items():
    obj=bpy.data.objects[name];assert [list(obj.location),list(obj.rotation_euler),list(obj.scale)]==before,'Joint changed: '+name
bpy.context.scene['full_leather_gloves_revision']=1
bpy.context.scene['full_leather_gloves_contract']='Shared dark leather with authored vertex wear/seams and existing common normal/roughness maps; all pivots and contact centerlines retained'
bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
assert hashlib.sha256(CHECKPOINT.read_bytes()).hexdigest()==checkpoint_hash
manifest={'checkpoint':str(CHECKPOINT.relative_to(ROOT)),'checkpoint_sha256':checkpoint_hash,
    'authoring':str(MASTER.relative_to(ROOT)),'shared_material':material.name,
    'authored_objects':authored,'mesh_count_added':0,'max_dorsal_padding_metres':.0016,
    'pivots_preserved':True,'textures':'Reused common normal/roughness; no per-digit maps or skin atlas input',
    'blender':bpy.app.version_string}
(ARCHIVE/'glove-authoring.json').write_text(json.dumps(manifest,indent=2))
print('BLENDER_FULL_LEATHER_GLOVES',json.dumps(manifest),flush=True)
