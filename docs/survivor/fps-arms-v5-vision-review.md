# V5 arms: independent vision review — rejected

Reviewed October 8, 2026, at the user's request. This review supersedes any
interpretation of the preceding technical checks as visual approval. Those
checks passed; they did not test whether every finger surface genuinely joins
the palm. No arm geometry, rig, animation or gameplay was changed in this review.

The independent reviewer was the available `character_presentation_owner`
agent with image vision, following `docs/adversarial-review/README.md`. It
inspected raw images, not only source descriptions or test reports.

## Evidence and coverage

Fresh evidence: `output/playwright/fps-arms-v5-angle-review/`. Its `report.json`
records the exact exported-asset SHA-256, camera positions/directions, sampled
clip times and each screenshot. Original images are retained alongside labeled
contact sheets. The capture runs in a separate browser and ephemeral server.

The initial audit covered 270 idle views: all 15 available hands, six anatomical
directions (dorsal, palmar, radial, ulnar, distal, proximal), in original material,
neutral clay, and solid-hardware modes. It also covered 72 representative draw,
fire and strike samples, eight native-game holds, native action samples, and
standing/walking/sliding look-down views. Ninety transparent-hardware contact
diagnostics bring the capture total to 432. Transparent views are diagnostic
only; they do not represent gameplay visibility. Studio renders and native
WebGPU gameplay evidence are labeled separately.

The capture changes cameras, temporarily hides the other arm, and hides
hardware only in isolated material/clay mode. It does not hide any geometry
from the inspected glove. Proximal views often have their anatomy obscured by
the sleeve; a captured direction does not automatically establish visibility.

| Weapon | Inspected hands | Rendered glove continuity |
| --- | --- | --- |
| Ossuary | Right; left not applicable | Confirmed failure |
| Breach | Both | Confirmed failure |
| Arc | Both | Confirmed failure |
| Reliquary | Both | Confirmed failure |
| Carrion | Both | Confirmed failure |
| Mourning | Both | Confirmed failure |
| Bat | Both | Confirmed failure |
| Chainsaw | Both | Confirmed failure |

## Confirmed blocker: detached digit bases

Background-visible gaps separate outer digit bases from the distal palm edge.
This appears across all available hands and is clearest in isolated dorsal and
palmar views. Representative original evidence:

- [Breach left dorsal clay](../../output/playwright/fps-arms-v5-angle-review/breach-left-dorsal-clay-idle-0.png)
- [Breach right palmar clay](../../output/playwright/fps-arms-v5-angle-review/breach-right-palmar-clay-idle-0.png)
- [Bat right dorsal clay](../../output/playwright/fps-arms-v5-angle-review/bat-right-dorsal-clay-idle-0.png)
- [Ossuary right dorsal clay](../../output/playwright/fps-arms-v5-angle-review/ossuary-right-dorsal-clay-idle-0.png)
- [Chainsaw left palmar clay](../../output/playwright/fps-arms-v5-angle-review/chainsaw-left-palmar-clay-idle-0.png)

The strongest defense is that ordinary gameplay and hardware hide many gaps,
while wrist seating remains connected. Concealment does not establish a
continuous foreground surface.

Smallest corrective experiment: repair only the two Breach gloves and merge
every digit root into the palm before weighting. Acceptance requires no
background-visible MCP separation in any six-angle clay view, including sampled
articulation. A remaining detached root rejects the pair.

## Confirmed simplification: palm and thumb construction

The palms read as tapered slabs and the thumb as an abrupt peg, with limited
arch, thenar volume and anatomical saddle. Some dorsal surfaces also show coarse
faceting. Evidence includes Breach left palmar clay, Breach right radial clay,
and Reliquary right dorsal clay in the angle folder. The relevant construction
is in `scripts/rebuild-fps-arms-v5.py`, functions `tube` and `build_glove`.

Counterevidence: digit lengths differ, trigger positioning is distinct, and sewn
edges exist. Stylization can simplify anatomy, but it must retain a coherent
cupped palm, opposed thumb and convincing root transitions.

Smallest experiment: sculpt one representative pair around the actual handles,
including its palm arch, thumb web and thenar mass. Acceptance requires a
coherent gloved human hand in all six clay directions; extra grain or stitches
cannot change the verdict without repairing the forms.

## Risk: sleeve/body material coherence

`output/playwright/fps-arms-v5-game/look-down-slide.png` places nearly featureless
dark sleeves beside more visibly textured and creased trousers. The large
studio views reveal grain that contributes little at ordinary gameplay size.
Dark workwear can preserve weapon readability, so this is a coherence risk,
not a demonstrated software failure.

The smallest experiment is the repaired Breach pair beside the body under
native lighting, with a few deliberate cloth folds and clear sleeve/glove
separation. Acceptance requires consistent construction/detail density without
losing silhouettes.

## Separate verdicts

- **Rig/socket metrics:** supporting technical evidence; prior focused tests
  passed. These do not establish pad contact or connected surface anatomy.
- **Rendered mesh continuity:** fails, with visible defects across all weapons.
- **Complete hardware contact:** solid views often obscure the surfaces and
  cannot establish all-around contact. Transparent-diagnostic supplement is
  recorded separately below.
- **Continuous animation quality:** unverified by this still-image audit.
  Sampled poses show recoil and melee motion with connected assemblies, but
  cannot certify smooth transitions, repetition or contact through all motion.
- **Artistic acceptance:** rejected as finished high-quality FPS arms.

Review one repaired representative pair before propagating another polish pass.
The user retains final visual acceptance.

## Transparent-hardware supplement

The independent agent inspected all 15 xray sheets (90 idle views) plus six raw
Breach diagnostics. The rejection is unchanged: detached roots become easier
to see. Coarse placement now has visual support: curled digits surround the
intended handles, especially the bat and chainsaw's left grip. The reviewer did
not identify an additional unequivocal gross-penetration defect.

Exact surface contact remains **unverified**. Transparency cannot establish
zero separation, penetration depth or contact pressure; layered firearm
hardware and opaque sleeves still obstruct some surfaces. Temporal contact
also remains unverified because these added views sample idle at zero seconds.

The minimum further contact check is a cropped oblique image with only the
relevant handle opaque, paired with signed glove-to-hardware surface distances.
Credible palm/thumb/finger support must hold through movement without visible
floating contact or substantial penetration. Socket-gap metrics alone are
insufficient.

The capture completed successfully without browser errors. That capture result
is distinct from the independent **rejected** visual verdict.
