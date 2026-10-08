"""Polish the saved Blender FPS gloves without rebuilding their contact rig.

Run Blender --background --python this-file -- --weapons breach first.
Then use author-fps-arms-v3.py --export-only and optimize-fps-glb.mjs.
Use --input to compare candidates from the same preserved foundation.
"""
import argparse, bpy, hashlib, json, math, sys
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / '.art-source/viewmodel-arms-v3'
args = argparse.ArgumentParser()
args.add_argument('--input', default=str(ARCHIVE / 'The_Last_Dead_Animated_FPS_Arms_v3.blend'))
args.add_argument('--output', default=str(ARCHIVE / 'The_Last_Dead_Animated_FPS_Arms_v3.blend'))
args.add_argument('--weapons', default='breach')
args.add_argument('--repair-webs', action='store_true')
args.add_argument('--resume', action='store_true', help='Keep already finished gloves when extending an accepted saved study')
args.add_argument('--checkpoint', action='store_true', help='Save each finished hand during a longer extension')
args.add_argument('--report', default=str(ARCHIVE / 'glove-polish-report.json'))
opt = args.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.wm.open_mainfile(filepath=opt.input)
reference = json.loads((ARCHIVE / 'rig-reference.json').read_text())
selected = set(opt.weapons.split(','))

def B(p): return Vector((p[0], -p[2], p[1]))
def G(p): return Vector((p[0], p[2], -p[1]))
def sat(v): return max(0, min(1, v))
def gauss(v, w): return math.exp(-(v / w) ** 2)
def blend(a, b, t): return tuple(x * (1-t) + y * t for x, y in zip(a, b))
def checksum(value): return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()

def invariant_state():
    bones = [(o.name, [(b.name, tuple(b.head_local), tuple(b.tail_local), b.parent.name if b.parent else None) for b in o.data.bones]) for o in bpy.data.objects if o.type == 'ARMATURE']
    actions = [(a.name, [(c.data_path, c.array_index, [(tuple(k.co), tuple(k.handle_left), tuple(k.handle_right), k.interpolation) for k in c.keyframe_points]) for c in a.fcurves]) for a in bpy.data.actions]
    sleeves = [(o.name, [tuple(v.co) for v in o.data.vertices]) for o in bpy.data.objects if o.name.startswith('FPSSleeve_')]
    return {k:checksum(v) for k,v in [('bones',bones),('actions',actions),('sleeves',sleeves)]}

before = invariant_state()
report = {'input': opt.input, 'inputSha256': hashlib.sha256(Path(opt.input).read_bytes()).hexdigest(), 'weapons': [], 'invariantsBefore': before}
collection_visibility={c.name:(c.hide_viewport,c.hide_render) for c in bpy.data.collections if c.name.startswith('FPS / ')}
for name in collection_visibility:
    bpy.data.collections[name].hide_viewport=False
    bpy.data.collections[name].hide_render=False

for weapon in reference['weapons']:
    if 'all' not in selected and weapon['name'] not in selected: continue
    for arm in weapon['arms']:
        name, side = weapon['name'], arm['side']
        hand = bpy.data.objects['FPSGlove_' + name + '_' + side]
        if hand.get('glove_finish_revision', 0):
            if opt.resume: continue
            raise RuntimeError('Use an unpolished saved foundation; this pass must not accumulate.')
        sign = -1 if side == 'left' else 1
        hm = Matrix([arm['handMatrix'][i::4] for i in range(4)])
        inverse = hm.inverted()
        rig = bpy.data.objects['FPSBones_' + name]
        prefix = 'FPS_' + name + '_' + side + '_'
        # Parameterization comes from this saved rig, including its exact
        # manual contact edits. No estimated replacement finger paths.
        wrist = inverse @ G(rig.data.bones[prefix + 'Hand'].head_local)
        paths = {d: [inverse @ G(rig.data.bones[prefix + d + str(i)].head_local) for i in range(3)] + [inverse @ G(rig.data.bones[prefix + d + '2'].tail_local)] for d in ['Index','Middle','Ring','Little','Thumb']}
        roots = [paths[d][0] for d in ['Index','Middle','Ring','Little']]
        end = sum(roots, Vector()) / 4
        palm_length = end.z - wrist.z
        old_count = len(hand.data.vertices)
        if opt.repair_webs:
            # Fill only the abrupt web cuts with rounded saddles. Remeshing
            # the joined skin removes the thin triangular fins themselves.
            original_hand = hand.copy(); original_hand.data = hand.data.copy()
            bpy.context.scene.collection.objects.link(original_hand)
            original_hand.name = 'WeightTransferSource'
            original_hand.modifiers.clear()
            hand.modifiers.clear()
            bpy.ops.object.select_all(action='DESELECT')
            bridges = []
            for a,b in zip(roots,roots[1:]):
                centre=(a+b)*.5; centre.z-=.006
                bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,radius=1)
                bridge=bpy.context.object
                for v in bridge.data.vertices:
                    p=centre+Vector((v.co.x*.011,v.co.y*abs(a.y-b.y)*.58,v.co.z*.015))
                    v.co=B(hm@p)
                bridges.append(bridge)
            bpy.ops.object.select_all(action='DESELECT')
            hand.select_set(True)
            for obj in bridges: obj.select_set(True)
            bpy.context.view_layer.objects.active=hand
            bpy.ops.object.join()
            hand.data.remesh_voxel_size=.0010*hm.to_scale().x
            hand.data.remesh_voxel_adaptivity=0
            bpy.ops.object.voxel_remesh()
            smooth=hand.modifiers.new('Rounded leather web saddles','SMOOTH')
            smooth.factor=.35; smooth.iterations=3
            bpy.ops.object.modifier_apply(modifier=smooth.name)
            dec=hand.modifiers.new('Hero glove topology','DECIMATE'); dec.ratio=.15
            bpy.ops.object.modifier_apply(modifier=dec.name)
            # Preserve the fitted performances through nearest-surface
            # interpolation from the saved weighted skin, not automatic rigging.
            transfer=hand.modifiers.new('Preserved contact skin weights','DATA_TRANSFER')
            transfer.object=original_hand; transfer.use_vert_data=True
            transfer.data_types_verts={'VGROUP_WEIGHTS'}; transfer.vert_mapping='POLYINTERP_NEAREST'
            transfer.layers_vgroup_select_src='ALL'; transfer.layers_vgroup_select_dst='NAME'
            bpy.ops.object.modifier_apply(modifier=transfer.name)
            saved_influences=[]
            for v in hand.data.vertices:
                influences=sorted(((g.group,g.weight) for g in v.groups if g.weight>1e-6),key=lambda row:-row[1])[:4]
                total=sum(w for _,w in influences)
                if total<.001: influences=[(hand.vertex_groups[prefix+'Hand'].index,1)]; total=1
                saved_influences.append([(group,w/total) for group,w in influences])
            # Clear each group in one Blender call, rather than once per
            # vertex. Reinsert the identical normalized top-four influences.
            vertex_indices=list(range(len(hand.data.vertices)))
            for group in hand.vertex_groups: group.remove(vertex_indices)
            for v,influences in zip(hand.data.vertices,saved_influences):
                for group,w in influences: hand.vertex_groups[group].add([v.index],w,'REPLACE')
            skin=hand.modifiers.new('FPS skin','ARMATURE'); skin.object=rig
            bpy.data.objects.remove(original_hand,do_unlink=True)
            for polygon in hand.data.polygons: polygon.use_smooth=True
        points = [inverse @ G(v.co) for v in hand.data.vertices]
        original = [p.copy() for p in points]
        adjacency = [set() for p in points]
        for edge in hand.data.edges:
            a,b = edge.vertices; adjacency[a].add(b); adjacency[b].add(a)
        valleys = [(a+b)*.5 for a,b in zip(roots,roots[1:])]
        relax = []
        for p in points:
            # Only the finger-root saddles. Contact-bearing phalanges and
            # the distinct MCP crowns stay outside this selection.
            relax.append(max(gauss(p.y-v.y,.006) * gauss(p.z-v.z+.004,.013) for v in valleys))
        for iteration in range(2 if opt.repair_webs else 8):
            next_points = []
            for i,p in enumerate(points):
                average = sum((points[j] for j in adjacency[i]), Vector()) / max(1,len(adjacency[i]))
                next_points.append(p.lerp(average, .46 * relax[i]))
            points = next_points
        # A short folded hem and one tailored dorsal reinforcement panel.
        # Dimensions are in hand meters; the raised edge is under 1.5 mm.
        cols = []; contact_fingers=[]
        for i,p in enumerate(points):
            t = (p.z-wrist.z)/palm_length
            centre = wrist.lerp(end,t)
            dorsal = sat((sign*(p.x-centre.x)-.007)/.013)
            palm = sat((.99-t)/.11) * sat((t+.32)/.12)
            u = (p.y-centre.y)/(.032 + .011*sat(t))
            # Rounded tapered panel, no plate across the four MCP roots.
            panel_distance = math.sqrt(((t-.47)/.38)**2 + (u/.82)**2)
            panel = sat((1.02-panel_distance)/.13)*dorsal*palm
            border = gauss(panel_distance-.98,.045)*dorsal*palm
            hem = gauss(t+.16,.032)*palm
            hem_edge = gauss(t+.11,.022)*palm
            ridges = max(gauss(p.y-r.y,.0105)*gauss(p.z-r.z+.018,.023) for r in roots)*dorsal*palm
            p.x += sign*(.0015*panel + .0010*border + .0012*hem_edge - .0009*hem + .0016*ridges)
            # The thenar heel slopes toward the unchanged opposed thumb.
            thumb_base = paths['Thumb'][0]
            thenar = gauss(p.z-thumb_base.z+.014,.024)*gauss(p.y-thumb_base.y+.004,.018)
            heel = sat((thumb_base.z+.003-p.z)/.030)
            p.x -= sign*.0025*thenar*heel
            leather = (.075,.053,.033)
            color = blend(leather,(.120,.087,.055),panel*.85)
            color = blend(color,(.042,.030,.019),border*.68 + hem*.40)
            color = blend(color,(.130,.097,.065),hem_edge*.80)
            nearest = None
            for digit,path in paths.items():
                cumulative = 0
                lengths = [(b-a).length for a,b in zip(path,path[1:])]
                for j,(a,b) in enumerate(zip(path,path[1:])):
                    delta=b-a; f=sat((p-a).dot(delta)/max(1e-12,delta.length_squared)); c=a+delta*f
                    d=(p-c).length
                    if nearest is None or d<nearest[0]: nearest=(d,digit,j,f,c,cumulative+f*lengths[j],lengths)
                    cumulative += lengths[j]
            distance,digit,j,f,c,along,lengths = nearest
            finger = (p-paths[digit][0]).length > (.020 if digit=='Thumb' else .016) and distance < (.018 if digit=='Thumb' else .016)
            contact_fingers.append(finger)
            if finger:
                row = arm['profile']['rows'].get(digit, arm['profile']['rows']['Index'])
                grip_centre = Vector(((min(q[0] for q in row['points'])+max(q[0] for q in row['points']))*.5,row['y'],(min(q[1] for q in row['points'])+max(q[1] for q in row['points']))*.5))
                outward = c-grip_centre; outward.y=0
                outward.normalize()
                radial = (p-c).normalized()
                back = sat((radial.dot(outward)-.12)/.70)
                flex = max(gauss(along-lengths[0],.0021),gauss(along-lengths[0]-lengths[1],.0017))
                broad_pad = math.sin(math.pi*f)**.8 * back
                # Loaded inside pads stay untouched. Articulation folds are
                # shallow, placed at actual PIP/DIP joints, never ring noise.
                p += radial*(.0008*broad_pad-.00065*flex*back)
                color = blend((.064,.044,.026),(.114,.081,.049),back*.72)
                color = blend(color,(.038,.025,.015),flex*back*.80)
                # One lateral stitched seam, not circumferential bands.
                seam = gauss(abs(radial.y)-.74,.07)*back*.6
                color = blend(color,(.140,.101,.064),seam)
            # Worn edge and the thumb saddle are broad leather signals.
            color = blend(color,(.104,.074,.043),thenar*.24)
            cols.append(color)
        # Sculpt relaxation after the relief prevents submillimeter voxel
        # facets and narrow hem displacement from making torn-looking shards.
        # Preserve the loaded digit pads and the distinct finger silhouettes.
        if opt.repair_webs:
            for iteration in range(12):
                next_points=[]
                for i,p in enumerate(points):
                    t=(p.z-wrist.z)/palm_length
                    strength=0 if contact_fingers[i] else .48*sat((1.03-t)/.12)
                    average=sum((points[j] for j in adjacency[i]),Vector())/max(1,len(adjacency[i]))
                    next_points.append(p.lerp(average,strength))
                points=next_points
        # Evaluate the leather construction on the finished skin. The earlier
        # scaffold colors would drift across the seam during relaxation.
        # Broad value changes survive the normal gameplay camera; a narrow
        # inset line describes stitching without rebuilding accepted anatomy.
        for i,p in enumerate(points):
            t=(p.z-wrist.z)/palm_length
            centre=wrist.lerp(end,t)
            dorsal=sat((sign*(p.x-centre.x)-.006)/.014)
            palm=sat((.97-t)/.13)*sat((t+.34)/.12)
            u=(p.y-centre.y)/(.032+.011*sat(t))
            panel_distance=math.sqrt(((t-.43)/.35)**2+(u/.80)**2)
            panel=sat((1.02-panel_distance)/.10)*dorsal*palm
            inset=gauss(panel_distance-.97,.055)*dorsal*palm
            stitch=gauss(panel_distance-.88,.035)*dorsal*palm
            # A continuous short cuff, deliberately darker than the back.
            cuff=sat((.055-t)/.07)*sat((t+.30)/.07)
            cuff_seam=gauss(t+.075,.032)
            cuff_stitch=gauss(t+.015,.025)
            leather=(.086,.060,.035)
            color=blend(leather,(.160,.112,.065),panel*.90)
            color=blend(color,(.029,.019,.011),inset*.88)
            color=blend(color,(.190,.136,.083),stitch*.60)
            color=blend(color,(.047,.030,.017),cuff*.83)
            color=blend(color,(.020,.013,.008),cuff_seam*.92)
            color=blend(color,(.178,.121,.068),cuff_stitch*.74)
            # The dorsal panel ends before the four distinct finger roots.
            # Keep the already authored, fitted finger folds and loaded pads.
            keep_digit=sat((t-.76)/.12) if contact_fingers[i] else 0
            cols[i]=blend(color,cols[i],keep_digit)
        for vertex,p in zip(hand.data.vertices,points): vertex.co = B(hm@p)
        layer = hand.data.vertex_colors.get('AuthoredSurface') or hand.data.vertex_colors.new(name='AuthoredSurface')
        for loop in hand.data.loops: layer.data[loop.index].color = (*cols[loop.vertex_index],1)
        # Material remains owned by the hand and uses authored vertex color.
        old = hand.data.materials[0]
        leather_mat = old.copy(); leather_mat.name = 'TLD_Full_Worn_Leather_Gloves_v3_Tailored'
        leather_mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.66
        hand.data.materials[0] = leather_mat
        hand['glove_finish_revision']=7
        hand['glove_construction']='Dorsal leather panel, thumb saddle, folded cuff hem; relaxed MCP saddles'
        hand.data.update()
        hand.data.calc_normals()
        travel = [(p-q).length for p,q in zip(points,original)]
        report['weapons'].append({'weapon':name,'side':side,'originalVertices':old_count,'vertices':len(points),'triangles':sum(len(p.vertices)-2 for p in hand.data.polygons),'webRepair':opt.repair_webs,'weightTransfer':'nearest saved surface, normalized top four' if opt.repair_webs else 'unchanged','maxLocalSculptDisplacementM':max(travel),'averageLocalSculptDisplacementM':sum(travel)/len(travel),'relaxedWebVertices':sum(w>.25 for w in relax)})
        print('POLISHED_GLOVE',name,side,flush=True)
        if opt.checkpoint:
            for collection,(viewport,render) in collection_visibility.items():
                bpy.data.collections[collection].hide_viewport=viewport;bpy.data.collections[collection].hide_render=render
            bpy.ops.wm.save_as_mainfile(filepath=opt.output)
            for collection in collection_visibility:
                bpy.data.collections[collection].hide_viewport=False;bpy.data.collections[collection].hide_render=False

after = invariant_state()
assert before == after, 'Rig, animation or garment changed during glove polish'
for name,(viewport,render) in collection_visibility.items():
    bpy.data.collections[name].hide_viewport=viewport
    bpy.data.collections[name].hide_render=render
report['invariantsAfter'] = after
report['status'] = 'PASS: stored bones, animation and sleeves unchanged; remeshed skin contact and visual acceptance checked separately'
Path(opt.output).parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=opt.output)
report['outputSha256']=hashlib.sha256(Path(opt.output).read_bytes()).hexdigest()
Path(opt.report).parent.mkdir(parents=True,exist_ok=True)
Path(opt.report).write_text(json.dumps(report,indent=2))
print('GLOVE_POLISH_REPORT',json.dumps(report),flush=True)
