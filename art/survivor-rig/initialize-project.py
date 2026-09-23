import bpy, os, json
from pathlib import Path
BASE = Path('C:/Users/wolfk/Desktop/thelastdead/art/survivor-rig')
assert not bpy.data.filepath, 'Refusing to modify an existing saved project'
assert set(bpy.data.objects.keys()) <= {'Cube', 'Camera', 'Light'}, 'Expected only untouched startup objects'
assert not bpy.data.armatures, 'Expected an empty startup project'
bpy.context.scene.name = 'THE LAST DEAD | Survivor Rig'
original = bpy.data.collections.get('Collection')
if original:
    original.name = '00 | Startup objects (preserved)'
    original.hide_viewport = True
    original.hide_render = True
bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.scene.unit_settings.scale_length = 1.0
bpy.context.scene['project'] = 'The Last Dead'
bpy.context.scene['rig_workspace'] = str(BASE)
bpy.ops.wm.save_as_mainfile(filepath=str(BASE / 'The_Last_Dead_Survivor_Rig_v01.blend'))
(BASE / 'project-identity.json').write_text(json.dumps({'pid':os.getpid(),'file':bpy.data.filepath,'scene':bpy.context.scene.name}))
