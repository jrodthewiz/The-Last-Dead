# Grounded spawning v5

New arrivals now receive the complete half-second staging warning, including the first contact and a canceled lane's retry. Concurrent queued arrivals reserve separate staging positions instead of warning on top of one another. Existing doorway routes, enemy roster, health, encounter budgets, attack slots and global 12-enemy limit remain unchanged.

## Reproduced defects and fixes

The first contact item was due 0.35 seconds into its encounter. Its first warning appeared on the next tick, leaving only 0.333 seconds of warning at 60 Hz. A co-op player occupying that pad correctly canceled the spawn; moving them away immediately after cancellation produced a new warning lasting only 0.183 seconds, because the retry deadline was just 0.2 seconds later. Both paths now set the due time to at least the warning creation time plus the existing 0.5-second lead. Waiting for a safe point cannot shorten this window.

Two items due together could also choose the same safe pad, since placement considered live enemies but not outstanding warnings. A deterministic test restricts the actual entry lane to one authored candidate and releases two items together. The old code produces overlapping warnings; the new code lets one item warn and arrive, waits for its occupied pad to clear, then warns the second. Spawn selection and commitment both check the existing warning array with the same 0.7-cell separation used for live enemies (2.8 rendered metres). Commitment ignores only its own warning. Canceling or expiring the warning removes its reservation through the existing cleanup, permitting a fresh safe attempt.

Both players' current distance and visibility, live door state, walkable staging, and the actual collision-safe ingress route are still checked at commitment. The change does not permit spawning in a watched corridor, through a closed door, or closer than 3.5 simulation cells (14 rendered metres; one cell is four metres).

## Verification

Three new regression tests in `tests/spawn-v5.test.mjs` fail on the old behavior and pass with the fix:

- First contact and later entry reinforcements retain at least 0.5 seconds of warning at 30, 60 and 120 Hz; the required room still clears.
- A co-op staging interruption cancels the original warning, resumes with a fresh full warning, and retains both-player distance/visibility checks.
- Two concurrent due items sharing one safe staging candidate reserve it in turn, both enter physically, and retain the 12-enemy concurrency limit.

Focused checks: 40 passed with `node --test --test-isolation=none tests/spawn-v5.test.mjs tests/dungeon-ingress.test.mjs tests/enemy-pressure.test.mjs enemy-ai.test.mjs engine.test.mjs`.

Progression checks: 20 passed with `node --test --test-isolation=none tests/spawn-v5.test.mjs tests/dungeon-encounter-progression.test.mjs tests/dungeon-flow.test.mjs tests/dungeon-route-topology.test.mjs`. The three new tests appear in both commands; these are 57 distinct tests. Coverage includes real portal crossing on all five floors, multi-door contact, required-room progression, gates, keys, descent, restart, pressure motion and collision safety.

## Cost and limits

The new work is a scan over the existing outstanding-warning array during spawn attempts and commitment. It creates no new per-frame path searches, geometry, textures, enemies or persistent collection. Existing 0.15-second attempt throttling and topology-derived ingress caching remain in place. Non-dungeon callers omit reservations and avoid the new scan. A blocked pad delays queued pressure until a safe opening is available; this is intentional rather than forced close or visible spawning.

This report records deterministic CPU-side gameplay verification. Production browser captures, hardware timing and human play are separate integration checks; passing these tests is not an FPS guarantee. A stationary player watching every viable entrance can intentionally keep an arrival queued.

## Reference ledger

- Read: `C:/Users/wolfk/.codex/skills/threejs-gameplay-systems/SKILL.md`.
- Read: `C:/Users/wolfk/.codex/skills/threejs-gameplay-systems/references/gameplay-workflows.md`.
- Read: `C:/Users/wolfk/.codex/skills/threejs-gameplay-systems/references/physics-engine-selection.md`. The existing grid collision and engine timestep are retained; no physics dependency added.
- Read: `C:/Users/wolfk/.codex/skills/threejs-qa-release/SKILL.md`, `references/qa-release-checklists.md` and `references/checklists/playtest-qa.md` beneath that skill directory. Browser/build checks are delegated to the parent integration pass; this worker does not mark release QA complete.
