# Foreground arm quality pass

The ordinary weapon arms now use a Blender-authored derivative of the existing survivor, with consistent adult proportions, separate curved fingers and opposed thumbs. The runtime fits hands to each animated grip, then rotates two fixed-length cloth segments toward the body. It no longer widens one hand differently from the other or stretches sleeves during a melee stroke.

This is a substantial silhouette, placement and grip correction. It is not a claim that the hands or the whole game meet AAA photorealism. Fingers still need a sculpted/scanned anatomical surface and richer skin shading for that standard; counter and vermin hands retain the original fused hand topology.

## Asset and preservation

`assets/survivor/viewmodel-arms-v1.glb` is 9,998,464 bytes, SHA256 `754871fa53ebddc9b9bfb5d59120b33592288895cde2f9b4f2dc752e9472708e`. It contains 76,455 triangles across 27 meshes, four materials and four 2048px texture maps, including new tangent normal and ORM detail. The interaction skin contributes 13,796 of those triangles; ordinary poses display only the arms belonging to the active weapon.

The hybrid sourcing path uses the original Meshy survivor's garment folds and UV atlas, trimmed and aligned in headless Blender 2.93, plus authored hand geometry. Five distinct digits, opposed thumbs, rounded nail surfaces, differentiated phalanx taper, knuckle volume, flattened pads and a continuous carpal transition replace the old oversized grip hands. The palm has a smoother metacarpal arch and bounded thenar/hypothenar volume. Dark leather, warmer skin, crease normals and variable roughness replace the initial smooth cream fingers. The right index has its own trigger pivot. No paid generation request was made.

The derivative also corrects radial sleeve spikes on `TLD_Remote_Arms`. Its original UVs, joint order, bone transforms, inverse bind matrices, joint indices and normalized weights are preserved. Hand positions are preserved; the source fused hand topology is a known remaining limit. Original survivor, zombie, chest and vermin GLBs and the blood atlas remain unchanged.

The asset manifest records exact landmarks, caps, budgets and source hashes. Editable ordinary and integrated Blender masters, source material and neutral front/side/palm/upper/interaction proofs are preserved under `.art-source/viewmodel-arms-v1/`; that ignored archive is excluded from runtime builds. `scripts/build-viewmodel-arms.py` reproduces the derivative offline. Runtime requires only Node and bundled assets/vendor files.

## Placement and animation

The native forearm is 0.34m and upper sleeve 0.40m. A uniform 1.4 presentation scale inside the existing 0.64 weapon scale produces 0.30464m and 0.3584m segments. Hands and both segments use the same uniform scale. Wrist and elbow origins remain connected; grip centers follow actual animated weapon sockets.

The wrist-to-forearm angle stays within 75 degrees. Forearm direction follows a preferred elbow target inside that cone. A camera-space frustum constraint selects a reachable upper sleeve endpoint below the frame, accounting for the real exported cap radius and cut-edge overshoot. The entire held assembly moves together in a separate placement pivot, preserving gun mechanisms, muzzle, grip and dropped-object transforms. Sleeves rotate without lengthening. Fixed per-weapon depth offsets stabilize framing, with the minimum additional correction when reach requires it.

Foreground firearm grip parts and bat/chainsaw handle diameters are fitted to the new hands. Existing firing, weapon collision, damage and melee contact behavior stay authoritative. Trigger articulation follows the existing presentation state. Counter and rat interactions clone the cleaned skinned derivative after it loads; a loading guard prevents permanently caching the earlier body template. If the derivative fails, the already loaded body and its animation clips remain valid.

The local counter rig also places its shoulder roots behind the lens and brings the victim into the unchanged imported bone reach. The neck grip advances those roots by 5cm to retain exact reach with the higher reduced-motion camera mount. Camera framing follows the raised head/hands during a neck twist and the extraction during a chest action. The chest withdrawal is bounded so the held hand remains in front of the lens. Peer body placement retains its existing rig.

Weapon recovery frames the actual fallen firearm from beside the corpse. It positions the eyes and shoulder roots together before solving hand reach, with a wall-ray constraint and a bounded horizontal camera displacement. The hand holds its floor target through the grab, which now requires wrist contact within 20mm. The floor target freezes when the firearm is grabbed, preventing a feedback loop from following the hand that now holds it. That presentation anchor lasts through the complete return blend, including the earlier gameplay grip-target cutoff. No eye-only retreat runs after this solve. Source bone lengths, gun physics and ragdoll release physics remain unchanged.

The shared GLB loader consumes the full original response before parsing and validates the header and declared length. This resolves large local asset request-abort warnings observed during the arm preview, while leaving real HTTP/load failures visible.

## Research and techniques

[Three.js SkinnedMesh documentation](https://threejs.org/docs/pages/SkinnedMesh.html) informed the separation between static grip surfaces and skin-driven interaction arms, and preservation of the existing bind graph and normalized weights. The actual bundled loader, skin implementation and bone hierarchy were inspected rather than assuming another Three.js version.

[Blender animation and rigging release notes](https://developer.blender.org/docs/release_notes/2.92/animation_rigging/) provide primary background on authoring and constraint tools. Production used installed Blender 2.93; browser deformation is verified with the bundled linear blend skinning implementation. Blender viewport preserve-volume behavior is not assumed to transfer to glTF. The fixed-length reach and offscreen-cap solver are an engineering application, checked against exported mesh vertices and real browser captures.

## Skills and phase ledger

| Loaded skill | Application |
| --- | --- |
| threejs-game-director | Coordinated art, runtime and independent QA phases |
| threejs-aaa-graphics-builder | Hybrid sourcing, authored geometry, neutral proofs and honest quality rubric |
| threejs-debug-profiler | Scale, wrist, sleeve-end, grip and loading diagnostics |
| threejs-qa-release | Desktop pose matrix, production build and combat/input regressions |

The relevant model/material/render, visual/playtest and release references from those skills were read. Gameplay architecture, existing UI and audio were retained; no physics engine or control scheme was replaced. PC and standard-mapped controller are the target, as requested. No mobile work is included.

## Quality scorecard

Scores use the loaded 0–3 rubric and assess the current captured feature alongside the existing game, rather than certifying untouched rooms and encounters.

| Category | Before | After | Evidence and remaining gap |
| --- | ---: | ---: | --- |
| Art direction | 2 | 2 | Worn bodycam equipment and garments remain consistent |
| Hero/player | 1 | 2 | Corrected proportions, connected fixed-length reach; hands remain stylized |
| Obstacles/enemies | 1 | 1 | Existing enemy art retained |
| Rewards/interactables | 2 | 2 | Weapon handles fit the hands; existing item quality varies |
| World/environment | 2 | 2 | Current dungeon preserved |
| Materials/textures | 2 | 2 | Native garment UV detail and leather/skin separation; skin response still limited |
| Lighting/render | 2 | 2 | Bodycam and viewmodel illumination verified in posed captures |
| VFX/motion | 2 | 2 | Grip contact, wrist cone, trigger motion and cap-safe swings |
| UI/HUD | 2 | 2 | Existing PC/controller HUD retained |
| Performance evidence | 3 | 3 | Bounded meshes, full-pass counts, source hashes and lifecycle checks |
| **Average** | **1.9** | **2.0** | Below the 2.3 premium threshold |

The outstanding professional-art gap is anatomical finger/knuckle surface quality and skin shading, followed by the fused interaction fingers and existing enemy/environment variation. Measurable arm distortion and floating sleeve caps have been corrected; a numerical fit cannot certify realistic hand art.

## Verification

Arm geometry, placement and captured interaction framing: **PASS**. The [verification ledger](../output/playwright/arms-v1/verification.json) records exact source hashes, protected originals, CPU results and frozen browser runtimes.

| Coverage | Result | Evidence |
| --- | --- | --- |
| Ordinary weapon poses | 36 views, 68 arm measurements, zero browser errors | [Report and full matrix](../output/playwright/arms-v1/final-v2/review.md) |
| Counter interactions | 17 views, zero browser errors | [Final report](../output/playwright/arms-v1/counters-reach-final/report.json) |
| Chest extraction and firearm recovery | 17 views, 12 checks, zero browser errors | [Final report](../output/playwright/arms-v1/chest-pickup-contact-final/report.json) |
| Vermin interactions | 26 views, 15 checks, 72 temporal frames, zero browser errors | [Report](../output/playwright/arms-v1/vermin-integrated2/report.json) |
| Injury and restart behavior | 22 views, zero browser errors | [Report](../output/playwright/arms-v1/injury-final/report.json) |
| Standard controller mapping | 14 checks, 6 views, zero browser errors | [Report](../output/playwright/arms-v1/controller-final/report.json) |
| Selected CPU regression | 584/584 passed | Recorded in the verification ledger |
| Final focused arm/grip/chest/physics regression | 94/94 passed | Recorded in the verification ledger |

Ordinary forearm and upper-arm lengths remain 0.30464m and 0.3584m across the pose matrix; wrist flex stays within 75 degrees. Sampled hand/sleeve surface gaps are 1.33–5.37mm, and actual sleeve-cap clearance is 37.34–259.55mm. Full-frame rendering counts are recorded for every pass; neither those counts nor the HUD FPS is a throughput benchmark.

The final interaction gate measures the actual 155 left and 185 right proximal sleeve vertices against the camera frustum. No measured cut-edge vertex is visible. Every active captured band has at least 5mm of whole-band frustum clearance; the minimum bottom-plane margin is 15.91mm in counters and 86.37mm in chest actions. Checked contact/guard-target gaps stay below 20mm. Normal and reduced-motion neck-grip residuals are below 0.001mm; the maximum checked counter gap is 19.14mm at the free chop guard. Firearm recovery's actual first-grab gap is 18.77mm, and the return maintains shared camera/shoulder framing after the gameplay grip-target cutoff.

The [independent final visual review](../output/playwright/arms-v1/interaction-final-review/receipt.md) accepts all 34 interaction captures. Extraction retains both hands, heart and face; recovery shows the weapon path over the floor; neck-grip phases retain the head and active grips; no exposed shoulder cuts or obvious arm distortion remain in these captures. Intentional downward abdominal views crop the upper head while retaining their action. The [pickup transition](../output/playwright/arms-v1/pickup-cpu-review/review.md) and [reduced-motion neck reach](../output/playwright/arms-v1/twist-cpu-review/review.md) CPU receipts document their reconstruction assumptions.

The tested runtime copies each contain 386 files with 114 authored-JavaScript syntax checks. Ordinary poses, broader gameplay regressions, chest recovery and the final counter correction have separately frozen provenance. Current arm-owned components match their verified hashes. Concurrent map, anatomy and audio edits are preserved and explicitly listed in the ledger; this is an arm verification pass rather than certification of the entire evolving checkout.

The original survivor, zombie, chest and vermin models and blood atlas are checked by SHA256. The existing game tab remains intact; port 5200 retains the same server process and creation time. All isolated QA browsers and temporary servers closed. Editable Blender sources remain in the excluded offline archive.

Controller coverage uses simulated standard-mapped snapshots, not physical hardware. The vermin regression includes 158.6 seconds of live input, 16 actual shots and measured movement. Five environment/audio/network-specific CPU suites are outside the selected 584-check run and are listed in the ledger. Rejected candidate captures remain preserved, including the earlier exposed sleeve ends, missed contact, cropped head/heart, obstructed pickup and reduced-motion reach miss. Remaining sculpt/material limitations are described above and in the independent review.
