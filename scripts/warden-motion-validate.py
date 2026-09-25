"""Measure Warden clip motion directly from the editable Blender source."""
import argparse
import json
import sys
from pathlib import Path

import bpy


def main():
    values = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument('--report', required=True)
    args = parser.parse_args(values)
    rig = next(obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE')
    for track in rig.animation_data.nla_tracks:
        track.mute = True
    actions = {action.name: action for action in bpy.data.actions if action.name.startswith('TLD_')}
    expected = ['TLD_Idle', 'TLD_Walk', 'TLD_Windup', 'TLD_Strike', 'TLD_Hit', 'TLD_Collapse']
    if any(name not in actions for name in expected):
        raise RuntimeError('Missing authored Warden actions')

    def sample(name, frame):
        rig.animation_data.action = actions[name]
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        return {bone: rig.matrix_world @ rig.pose.bones[bone].head
                for bone in ('LeftFoot', 'RightFoot', 'LeftHand', 'RightHand', 'Head', 'Hips')}

    def span(name, frames, bone):
        positions = [sample(name, frame)[bone] for frame in frames]
        return max((a - b).length for a in positions for b in positions)

    walk_frames = [1, 5, 9, 13, 17, 21, 25, 29, 33]
    walk_left = span('TLD_Walk', walk_frames, 'LeftFoot')
    walk_right = span('TLD_Walk', walk_frames, 'RightFoot')
    windup_hand = span('TLD_Windup', [1, 5, 10, 16, 20], 'LeftHand')
    strike_hand = span('TLD_Strike', [1, 4, 7, 10, 14, 19], 'LeftHand')
    hit_head = span('TLD_Hit', [1, 3, 6, 10, 18], 'Head')
    collapse_head = sample('TLD_Collapse', 1)['Head'].z - sample('TLD_Collapse', 44)['Head'].z
    checks = {
        'bothFeetTransfer': walk_left > .08 and walk_right > .08,
        'windupHandMoves': windup_hand > .10,
        'strikeHandMoves': strike_hand > .20,
        'hitRecoilReads': hit_head > .05,
        'collapseLowersHead': collapse_head > .35,
    }
    report = {
        'ok': all(checks.values()), 'source': bpy.data.filepath,
        'fps': bpy.context.scene.render.fps, 'joints': len(rig.data.bones),
        'clips': [{'name': name, 'frames': list(actions[name].frame_range)} for name in expected],
        'meters': {key: round(value, 4) for key, value in {
            'walkLeftFootRange': walk_left, 'walkRightFootRange': walk_right,
            'windupLeftHandRange': windup_hand, 'strikeLeftHandRange': strike_hand,
            'hitHeadRange': hit_head, 'collapseHeadDrop': collapse_head,
        }.items()},
        'checks': checks,
    }
    output = Path(args.report).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf8')
    print(json.dumps(report, indent=2))
    if not report['ok']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
