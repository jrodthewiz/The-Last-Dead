# Blackwater: ten-agent craft pass — 19 October 2026

Scope: the existing Three.js open world. Unity was excluded. The user requested
ten separate craft reviews and implementation. All ten used native available
roles, in batches of three; reviewers were read-only and the parent owned edits,
browser jobs and integration. Acceptance was not decided by voting.

Player promise: recognize a household container, search it, choose useful
equipment and return for supplies that capacity prevented collecting. The coast,
hands and room remain the visual anchor.

## Ten separate lenses

| Agent / actual role | Evidence, counterevidence and disposition |
| --- | --- |
| `craft_ui` / `ruthless_creative_director` | CONFIRMED: Arc advertised single fire despite requiring charge; touch dry-fire named F; reinforced melee impact stayed at base value. Existing field-kit hierarchy already coheres. Corrected instructions, touch PUNCH copy, effective impact and completed reinforcement labels. Rendered sword impact changes 55 → 66. |
| `craft_scavenging` / `fps_gameplay_director` | CONFIRMED: receipts expired behind the pack; eight ammo pools retained only the last three labels; search advertisement accepted a wider angle than continuation. Conservation and partial transfers already work. Pause hidden receipt lifetime, foreground active ammunition plus other-reserve summary, and share unopened-search focus eligibility. |
| `craft_rendering` / `craft_authorship_skeptic` | RISK: whole-metre shadow follow could pop; soft clouds might differ from foreground shapes. The existing olive/teal/ivory materials and readable foreground argue against global filter changes. No rendering rewrite justified. A slow fixed-view shadow comparison remains the smallest falsifying experiment. |
| `craft_interiors` / `map_authoring_owner` | CONFIRMED construction repetition: bags/crates/cases shared rigid boxes and anonymous contents. Existing domestic themes already relate room activities to loot. Added hollow faceted satchels, slatted crates, reinforced cases and five actual-inventory content families; ordinary closed/open views reviewed. |
| `craft_landscape` / `romero_fps_design_judge` | CONFIRMED geometry: rocks penetrate occupied homes 4/12; sampled timber feet float downhill. Existing foundations and access reservations are deliberate. Reserve complete building footprints from rocks; measured timber sole extensions follow actual support height; loose outdoor containers follow terrain normals. |
| `craft_npcs` / `animation_hotpath_owner` | CONFIRMED: Iven consumes his gift at 20 dressings while granting zero. Existing NPC pose restoration, sole planting and measured tool sockets counter a speculative animation rewrite. Preserve the gift at capacity; actual dialogue verifies recovery below capacity. Continuous NPC motion remains UNVERIFIED. |
| `craft_weapon_details` / `character_presentation_owner` | CONFIRMED: hidden Mourning rifle can retain its 28° ADS view through healing/search/punch. Reload/shove/Crimson already release aim. Central eligibility and combat release now cover these actions. Instant weapon/action handoff remains an artistic RISK requiring a continuous comparison. |
| `craft_feedback` / `modern_warfare_feel_judge` | CONFIRMED: later surviving victims erase a volley's kill marker; later shove reuses kill colour. Ordinary single-target damage already works. Attack-local kill aggregation and fresh nonlethal shove feedback correct this. Added restrained bundled contact audio on actual health loss with overlap guard; audio dispatch is checked, listening quality UNVERIFIED. |
| `craft_traversal` / `carmack_quake_systems_judge` | CONFIRMED: driving Space queues a walking jump; velocity survives exit. Existing supported stairs and full-body vault checks remain strong. Gate/consume driving jump input and reset travel on local/guest entry and exit. Actual brake/exit shows zero upward velocity/drift; fresh on-foot Space still jumps. |
| `craft_cohesion_judge` / `validation_gate` | Required exact built evidence and interruption/return paths. Found adjacent medical-note reward loss at capacity. Pending markers now retain the dressing without awarding old already-read notes twice. Final bounded integration verdict PASS after completed scenario report/raw views; no inference of continuous motion or whole-game performance. |

## Iterations driven by rendered evidence

First opening views put lids between the player and contents. Building containers
now face the interior approach and open away. The next review found cloth/tools
too low behind the rim; silhouettes rose 10 cm. Older saved loot could also retain
a family absent from the new household theme. All five visual families are built
once, selected/repositioned from actual remaining inventory, and hidden on depletion.
The interior reviewer accepted the regenerated ordinary linen/workshop views.

Thirty-six timber extensions terminate at the actual supported floor, including
raised interiors, with maximum extension approximately 0.518 m in the canonical
world. Loose barrels/buckets/boxes align with terrain instead of receiving posts.
Rock exclusion preserves more than 100 natural-cover rocks in each tested seed.

The UI reviewer accepted the finished receipt, synchronized reserve counter,
reinforced rack and touch layouts. A minor stale-empty-message risk prompted a
last correction: dry-fire/reserve notices end when resupply or weapon switching
resolves that failure. Mission notices retain their own lifetime. Touch location
labels sit below utility actions and yield to notifications.

## Evidence and limits

- `npm run test:blackwater`: 110 passing checks, including five regressions for
  seeded rock/building separation, capped gifts, saved pending note rewards,
  reserve receipt priority, hollow containers and depleted/older families.
- `npm run test:blackwater:input`: release paths, reload completion and actual
  skinned first-person camera/support checks pass.
- `tests/blackwater-craft-review.mjs`: built-source parity and 11 gameplay/UI
  journeys at desktop, portrait and landscape touch emulation. Completed local
  run has `passed:true`, empty JavaScript/HTTP error arrays and zero truck-exit
  vertical velocity/drift. Evidence: `output/craft-council-pass/final/`.
- Ordinary raw container/pack/receipt/action views were reviewed separately
  from camera-only architecture/terrain photographs. Final photographs wait for
  the scripted injury vignette to settle. Still images do not establish continuous
  animation, human listening quality, physical-phone usability or long-run performance.

One intermediate run stopped on a stale prompt snapshot; the test now teleports
at its intended heading before observing the prompt. Another ADS wait timed out
without a JavaScript/HTTP error; retained action/runtime diagnostics now explain
future failures. The subsequent complete run passed. Incomplete evidence was not
carried forward as final proof.

The parent preserved the user's port-5200 tab/server and pre-existing deleted
output files. One owned GPU job runs at a time. Scratch stays under
`output/craft-council-pass/`, bounded at 256 MiB / 200 files including packaging.
Reopen acceptance for disappearing leftovers, hidden receipts, stuck zoom, exit
jumps or unsupported feet. The user retains artistic acceptance.
