# Horror presence implementation QA

This report covers mechanical and visual verification of the new environmental horror sequences. It does not measure fear, enjoyment, disgust, or novelty; those claims require the player research described in [the research brief](horror-research-loop-2026-09-30.md).

## Reference ledger

All references below were read before implementation QA.

| Reference | Loaded | Purpose |
| --- | --- | --- |
| `C:/Users/wolfk/.codex/skills/threejs-qa-release/references/qa-release-checklists.md` | Yes | Browser, audio, performance, and production acceptance |
| `C:/Users/wolfk/.codex/skills/threejs-qa-release/references/checklists/visual-verification.md` | Yes | Frame captures, pixels, framing, and renderer evidence |
| `C:/Users/wolfk/.codex/skills/threejs-qa-release/references/checklists/playtest-qa.md` | Yes | Start, actual inputs, pause, retry, and sustained play |
| `C:/Users/wolfk/.codex/skills/threejs-qa-release/references/checklists/release.md` | Yes | Built output and runtime asset paths |
| `C:/Users/wolfk/.codex/skills/threejs-debug-profiler/references/debug-profile-checklists.md` | Yes | Runtime errors, audio cleanup, and resource ownership |
| `C:/Users/wolfk/.codex/skills/threejs-debug-profiler/references/checklists/scene-debugging.md` | Yes | Scene/camera/context diagnosis |
| `C:/Users/wolfk/.codex/skills/threejs-debug-profiler/references/checklists/performance-profile.md` | Yes | Renderer metrics and repeated-run resource stability |

## Ownership and method

The browser harness uses fresh, task-owned Chrome contexts and ephemeral static-server ports. It never attaches to, reloads, or closes the user's existing game tab, and never restarts the server at `127.0.0.1:5200`. Source and built output are tested sequentially to avoid concurrent GPU-heavy work. The renderer, collision map, player inputs, and normal lifecycle remain the game's real systems; developer triggers isolate nondamaging presentation sequences for repeatable captures.

The harness records page, console, request, and HTTP errors; synchronous canvas pixels; renderer calls, triangles, geometries, and textures; encounter diagnostics; and audio admission/mix state. Frames are captured at onset, a meaningful peak/contact state, and recovery rather than only at the title screen. Visual conclusions require inspecting those images in addition to state assertions.

## Status

Source and a frozen production distribution pass the scoped horror acceptance checks. Both task-owned Chrome contexts and ephemeral servers closed cleanly. The earlier live-dist probe hit missing assets during another chat's build, so that probe is rejected and preserved under `built-rejected-1/`.

| Variant | Result | Acceptance checks | Captured frames | Diagnostic views |
| --- | --- | --- | --- | --- |
| Source | PASS | 17 | 41 | 54 |
| Production snapshot | PASS | 16 | 40 | 53 |

Both accepted runs record no page, console, HTTP, or request errors and no changes to the eight hashed runtime files during testing. Those eight runtime hashes also match between source and production. The source live journey exercised movement, turning, jumping, firing, and natural scheduling for 131.3 seconds in eight input cycles. The admitted real-shot counter ended at 16 since instrumentation started; that total includes the preceding mouse-fire check.

The production snapshot contains 386 whitelist files (181.7MB), including 121 successfully parsed JavaScript files and the required model/texture assets. Its five horror integration files match accepted source bytes. The manifest records newer unrelated source revisions of `enemy-anatomy.js` and `enemy-anatomy-visuals.js`; they do not alter the frozen tested distribution. This is acceptance of the recorded variant rather than a claim that all parallel chats have finished.

## Accepted behavior and visual evidence

Actual Start unlocks the real audio system. Real W movement followed by stopping naturally produces an answering wall that learns the player's footfall intervals. Developer-triggered answering, approach, witness, transfer, strain, callback, table, and cuff sequences then exercise meaningful phases and recovery through normal renderer and engine paths. Every isolated beat preserves health, weapon, and player position; overlapping major beats are refused.

Actual Escape/resume freezes solo clocks, stops owned audio, restores the cuff surface, and resumes the same phase. Death and actual retry clear actors, learned memory, and owned voices. Normal movement stays responsive during a world cue; actual mouse firing on the default Ossuary admits a shot event and cancels cosmetic presentation. Rifle-only `shotSequence` is deliberately not used as the Ossuary firing measure.

Actual settings controls verify master mute, gore-off contact residue, and reduced motion. The cuff modifies the authored sleeve surface without new draw calls or materials, restores it on cancellation/recovery, and is suppressed for a missing arm. Measured sleeve displacement is 5.93mm normally and 2.42mm in reduced motion; the reduced-motion fold remains stationary. The strain peak deforms 309 weighted source-hand vertices with approximately 11.1mm compression. Table and callback captures coincide with actual pulse peaks rather than arbitrary idle frames.

Source and built witness/contact frames, chronological motion strips, and sleeve enlargements were visually inspected, along with the source table and portrait frames. World actors, anatomy behind the pane, sheet silhouette, and the actual sleeve source are visible. Fine knuckle, filament, residue, and fold details remain subtle at gameplay distance under bodycam noise. This is bounded prototype legibility, with further art/readability polish still useful. Portrait HUD and controls fit the captured viewport; touch actions were not exercised.

Earlier image inspection rejected an occluded distant anchor, opaque contact backing, and reflective pane hotspot. Those findings drove placement/line-of-sight and pane corrections. The fixture also needed pacing initialization after retry and velocity reset after movement inspections. Rejected receipts are retained under `source-rejected-*`; the transient shared-module syntax failure and cold-start timing rejection are also preserved.

## Resource and startup limits

Twelve alternating world/cuff lifecycle cycles keep history/queues bounded and finish with no owned presence voices. The presence voice budget peaks at three. Source warmed-to-final renderer resources are 1088→1089 geometries and 156→156 textures; this demonstrates bounded lifecycle resources, not an interactive frame-rate certification. Sampled headless FPS ranges 10–60 while synchronous pixel readback and screenshots run.

Cold startup is slow on this machine: source takes approximately 70 seconds from document load to hooks and 69 seconds from actual Start to play; production takes approximately 72 and 84 seconds respectively. The harness uses bounded 180-second cold readiness checks, aborts immediately on startup errors, and continues an already-ready error-free owned context if the polling deadline races readiness. Source and production are tested sequentially; the player's existing tab and port 5200 remain intact.

Human fear/disgust/novelty, headphone listening quality, physical controllers, and real mobile touch play remain untested. Browser audio evidence covers admission, ownership, mute, pause, and cleanup, rather than subjective listening.

## Receipts and reproduction

- [Browser harness](../tests/horror-presence-browser.mjs)
- [Source report](../output/playwright/horror-presence/source/report.json) and [frame gallery](../output/playwright/horror-presence/source/frames.html)
- [Source motion strips](../output/playwright/horror-presence/source/motion-strips.png) and [sleeve enlargement](../output/playwright/horror-presence/source/cuff-surface-enlargement.png)
- [Built report](../output/playwright/horror-presence/built/report.json), [frame gallery](../output/playwright/horror-presence/built/frames.html), [motion strips](../output/playwright/horror-presence/built/motion-strips.png), and [sleeve enlargement](../output/playwright/horror-presence/built/cuff-surface-enlargement.png)
- [Combined source/built summary](../output/playwright/horror-presence/summary.json)
- [Production snapshot manifest](../output/playwright/horror-presence/production-snapshot.json), recording the whitelist and copied asset/runtime hashes

Set `PLAYWRIGHT_PATH` to the bundled/local Playwright package and `CHROME_PATH` to Chrome. Run `node tests/horror-presence-browser.mjs` with `HORROR_QA_ROOTS=source` and `HORROR_QA_SOAK=1` for the source journey. For production under parallel work, build, run `node --experimental-vm-modules output/playwright/horror-presence/snapshot-production.mjs`, and set `HORROR_QA_ROOTS` to the verified snapshot path. The snapshot excludes other chats' nested verification folders and protects the live browser from shared-dist rebuilds. Its manifest records unrelated newer-source drift separately; the accepted horror integration bytes are required to match.
