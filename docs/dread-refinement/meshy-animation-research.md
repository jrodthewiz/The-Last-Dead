# Ash Witness Dread v02 animation research

Meshy does provide an animation library and an Animation API for already rigged humanoids. The official library currently exposes named actions with stable numeric IDs, and the API accepts one `action_id`, several `action_ids`, or a generated `motion_task_id`. A multi-action request returns one file with one clip per requested action, in request order. The API documentation says the batch accepts up to ten preset IDs.

Relevant catalog entries verified in the official reference:

| Meshy action | ID | Intended use here |
| --- | ---: | --- |
| `Attack` | 4 | generic melee attack reference |
| `BeHit_FlyUp` | 7 | strong hit reaction reference |
| `Dead` | 8 | death reference |
| `Monster_Walk` | 112 | hunched monster gait reference |
| `Mummy_Stagger` | 113 | unstable zombie gait reference |
| `Zombie_Scream` | 386 | scare beat / vocal acting reference |

Sources: [Meshy Animation Library Reference](https://docs.meshy.ai/en/api/animation-library), [Meshy Animation API](https://docs.meshy.ai/en/api/animation), [Meshy Animate guide](https://docs.meshy.ai/en/webapp/guides/animate), [Zombie Scream](https://www.meshy.ai/animation-library/body-movements/acting/zombie-scream), and [Attack](https://www.meshy.ai/animation-library/fighting/attackingwith-weapon/attack).

Meshy’s own Animate guide recommends exporting the rigged character and authoring manually in Blender when the motion needs custom choreography. That is the path used here: no second mesh generation or animation task was started. The existing 24-joint Meshy rig was retained, then Blender authored a six-pose planted-foot gait, a short attack lunge aligned to the engine’s melee strike window, a delayed head and torso hit recoil, and the existing idle/death behavior.

The cited Meshy API exports FBX or GLB animation data. It does not document a skeleton-frame sprite-sheet export; sprite sheets would also lose close-range depth, lighting, and the runtime actor’s authored facing. The Ash Witness remains a skinned GLB for gameplay, with contact sheets used only as lightweight review evidence.

## Dread v02 phase gates

- `AshWitness_Shuffle`: six contact/passing poses over 1.5 seconds; alternating thigh/knee rotations, lateral pelvis weight shift, delayed neck/head keys, and asymmetrical arm swing. The first and last poses match for a clean loop.
- `AshWitness_AttackLunge`: 0.833 seconds; anticipation, bodyweight lunge, arm reach, then recovery. The engine’s kind-0 windup is about 0.28 seconds, so contact is authored near the attack countdown boundary while collision and damage remain simulation-owned.
- `AshWitness_HitRecoil`: 0.583 seconds; hips/spine recoil first, head follows, then the body settles. The helper triggers it from the existing `hits`, `flash`, or `stagger` edge.
- `AshWitness_Collapse`: existing one-shot death clip remains intact and wins over attack/recoil when `enemy.dead` is true.

Evidence sheets:

- [Gait and idle contact sheet](ash-witness-dread-v02-gait.png)
- [Attack, hit, and collapse contact sheet](ash-witness-dread-v02-actions.png)
- [Packaged GLB manifest](../../assets/models/afterlife-ash-witness-manifest.json)

The packaged GLB stays within the lightweight runtime gate: 2,440,060 bytes, 27,512 triangles, one visual mesh, one 24-joint skin, one 512px WebP texture, and no Draco or Meshopt decoder extension.
