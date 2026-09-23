# The Last Dead — new Meshy survivor

Status: complete. The user explicitly approved the two-image upload and up to 35 existing Meshy credits. Source task `01a09510-2f99-76ca-8cf0-71efa0184c45` and rig task `01a09513-bd80-77e7-b91a-d90df084f03e` both succeeded on 2026-09-12, using exactly 35 credits. Blender preparation and the Three.js export check are complete. See README.md for deliverables and remaining weapon-hand limitations.

## Prepared inputs

- `references/survivor-front.png`: front T-pose, generated using the built-in image tool.
- `references/survivor-back.png`: matching rear T-pose, edited from the front reference using the built-in image tool.
- Original adult male survivor; natural anatomy, worn olive canvas jacket, charcoal cargo trousers, leather harness, rugged laced boots, wrist wraps and fingerless gloves. No weapon or backpack is baked into the character.
- Generation prompt: full-body front orthographic neutral T-pose with straight horizontal arms, separated fingers and shoulder-width legs; realistic PBR game character, natural face and garment construction, plain light grey background and diffuse studio lighting. Matching rear image preserves body proportions, outfit and pose.

## Workflow

The Codex project called Duals resolves to `C:/Users/wolfk/Desktop/Dogfight`.

Reuse its existing `scripts/generate-meshy-rigged-character.mjs` without modifying that repository. A local dry run passed for both source images and the output directory. That script journals submitted task IDs, resumes existing jobs, downloads provider results, and inspects source geometry plus the humanoid skeleton and skin.

Requested output directory: `C:/Users/wolfk/Desktop/thelastdead/art/survivor-meshy/tld-survivor-v02`.

Generation settings: multi-image-to-3D, latest model, textured PBR at 4K, T-pose, remeshed to approximately 60,000 triangles, GLB output. Rig the exact generated task at 1.78 m character height. Estimated existing-credit cost: 30 for the textured mesh plus 5 for rigging. No additional paid animation jobs are included.

Before submission, the read-only account check returned 3,189 credits on 2026-09-12 at 09:57 UTC. Source: `balance-before.json`. Current pricing was checked against https://help.meshy.ai/en/articles/16815622-how-many-credits-does-each-meshy-api-task-cost .

Approved scope: upload the two fictional generated reference images to Meshy and consume up to 35 existing Meshy credits for one character generation plus one rigging job. The user answered yes to that exact request. Additional paid generations or animation jobs are not included.

After approval, inspect the resulting mesh and rig. Preserve Meshy's skinning if it deforms well; use Blender to add animator controls and first-person sockets. Save a new Blender file in this repository and use only the previously identified Last Dead window. The Duals/JROD project and existing Last Dead procedural rig remain separate.

Do not claim the generated mesh, rig, or in-game integration exists until the provider completes and outputs are checked.
