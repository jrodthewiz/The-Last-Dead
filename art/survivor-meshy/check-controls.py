import bpy,json
from pathlib import Path
assert bpy.app.background
base=Path('C:/Users/wolfk/Desktop/thelastdead/art/survivor-meshy')
bpy.ops.wm.open_mainfile(filepath=str(base/'TLD_Survivor_Meshy_v02_GameRig.blend'))
rig=bpy.data.objects['TLD_Meshy_Survivor'];scene=bpy.context.scene
scene.frame_set(1)
rig['Arm_IK']=1.0;rig['Leg_IK']=1.0;rig.update_tag();bpy.context.view_layer.update()
errors={}
for side in ['Left','Right']:
    for mid,end in [('ForeArm','Hand'),('Leg','Foot')]:
        endpoint=rig.matrix_world@rig.pose.bones[side+mid].tail
        target=bpy.data.objects['CTRL_'+side+end].matrix_world.translation
        errors[side+end]=(endpoint-target).length
        assert errors[side+end]<.01,(side+end,errors[side+end])
socket_scales={n:list(bpy.data.objects[n].matrix_world.to_scale()) for n in ['SOCKET_LeftHand','SOCKET_RightHand']}
assert all(abs(s-1)<1e-4 for scale in socket_scales.values() for s in scale)
report={'ik_endpoint_error_m':errors,'socket_world_scales':socket_scales}
(base/'control-validation.json').write_text(json.dumps(report,indent=2))
print('CONTROLS_OK '+json.dumps(report))
