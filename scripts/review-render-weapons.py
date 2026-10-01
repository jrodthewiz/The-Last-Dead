# Blender 2.93 headless weapon review renderer.
# usage: blender -b -P scripts/review-render-weapons.py -- <objdir> <outdir> [indices]
import bpy, sys, json, math, os
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
objdir, outdir = argv[0], argv[1]
indices = [int(i) for i in argv[2].split(',')] if len(argv) > 2 else range(8)
names = ['ossuary','breach','arc','reliquary','carrion','mourning','bat','chainsaw']
os.makedirs(outdir, exist_ok=True)

def hex2rgb(h):
    h = h.lstrip('#'); c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return [(x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4) for x in c] + [1]

for idx in indices:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 900, 600
    sc.eevee.taa_render_samples = 24; sc.view_settings.view_transform = 'Filmic'; sc.view_settings.exposure = -0.3; sc.eevee.use_soft_shadows = True; sc.eevee.use_ssr = True; sc.eevee.use_gtao = True
    bpy.ops.import_scene.obj(filepath=f'{objdir}/w{idx}.obj')
    mats = json.load(open(f'{objdir}/w{idx}.json'))
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in objs:
        for slot in o.material_slots:
            d = mats.get(slot.material.name.split('.')[0])
            if not d:
                slot.material.use_nodes = True; b0 = slot.material.node_tree.nodes.get('Principled BSDF'); b0.inputs['Base Color'].default_value = (.16,.15,.14,1); b0.inputs['Roughness'].default_value = .9; continue
            m = slot.material; m.use_nodes = True
            bsdf = m.node_tree.nodes.get('Principled BSDF')
            bsdf.inputs['Base Color'].default_value = hex2rgb(d['c'])
            bsdf.inputs['Roughness'].default_value = d['r']
            bsdf.inputs['Metallic'].default_value = d['m']
            if d['ei'] > 0.05:
                bsdf.inputs['Emission'].default_value = hex2rgb(d['e'])
                bsdf.inputs['Emission Strength'].default_value = min(d['ei'], 4)
        o.data.use_auto_smooth = True; o.data.auto_smooth_angle = math.radians(50)
        bpy.context.view_layer.objects.active = o
    # bounds
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    ctr = (lo + hi) / 2; size = max((hi - lo).length, .1)
    # world: dark warm room + lights
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (.02, .022, .028, 1)
    def light(kind, loc, energy, color):
        d = bpy.data.lights.new('l', kind); d.energy = energy; d.color = color
        o = bpy.data.objects.new('l', d); sc.collection.objects.link(o); o.location = ctr + Vector(loc) * size
        c = o.constraints.new('TRACK_TO'); tgt = bpy.data.objects.new('t', None); tgt.location = ctr; sc.collection.objects.link(tgt)
        c.target = tgt; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    light('AREA', (-.7, -.6, .9), 110 * size * size, (1, .82, .62)); bpy.data.lights[-1].size = size
    light('AREA', (.9, .5, .3), 50 * size * size, (.55, .75, .95)); bpy.data.lights[-1].size = size
    light('POINT', (0, -.8, -.2), 14 * size * size, (1, .5, .3))
    cam = bpy.data.cameras.new('c'); cam.lens = 50
    co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
    tc = co.constraints.new('TRACK_TO'); tg = bpy.data.objects.new('ct', None); tg.location = ctr; sc.collection.objects.link(tg)
    tc.target = tg; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'
    views = {'view': (.75, -.85, .45), 'side': (1.35, 0, .05), 'top': (.15, -.2, 1.4)}
    for vn, dv in views.items():
        # weapon points +Y after import; viewmodel camera sits behind-right-above
        co.location = ctr + Vector(dv) * size * 1.15
        sc.render.filepath = f'{outdir}/{names[idx]}_{vn}.png'
        bpy.ops.render.render(write_still=True)
