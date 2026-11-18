---
name: blackwater-private-qa
description: Verify a Blackwater candidate with actual browser input, reload playback and isolated co-op on a CPU cloud runner or a local GPU, then synchronize the tested Git revision.
---

Identify the candidate by commit or verified archive digest. A private Site version, a screenshot fixture and a GitHub branch can contain different source. For an archive, retain its base identity, verify its checksum, and map private wrapper files back to canonical paths before merging. Record any differences when testing rebuilt or integrated source.

Use a clean checkout of the selected revision. Run node tests/private-bridge-browser.mjs from its root with Playwright installed. PLAYWRIGHT_PATH can name an existing Playwright package and CHROME_PATH its Chromium executable. BLACKWATER_QA_ROOT can select an extracted private static build. The test starts its own localhost room service and two independent browser contexts. Set BLACKWATER_QA_OUTPUT to a fresh evidence directory per revision and adapter.

The default headless run requests ANGLE SwiftShader and checks the actual WebGL adapter. Set BLACKWATER_RENDERER=gpu on the PC to require a hardware adapter. Keep the same browser version, camera, viewport and runtime for image comparisons. Inspect both bridge approaches, including the underside if deck contact is at issue. Use screenshots, crossing heights and replicated movement together. The Web Audio check observes non-silent decoded samples starting in the running game. Use a listening pass when judging loudness, timbre or mix.

The Blackwater private browser QA Actions workflow runs the CPU check on a Linux worker. Record the run URL, checkout SHA, result and adapter. A loopback room tests multiplayer code in isolation. Verify the private deployment's room binding separately when hosted multiplayer is requested.

Fetch both branches before integrating. Preserve existing work in a separate checkout or an identifiable stash. Fast-forward when possible. For divergence, merge in a candidate branch, inspect both sides of conflicts and rerun the affected fixtures on the resulting commit. A conflict reviewer may propose a resolution when requested. Push normally and compare git rev-parse HEAD against git ls-remote origin for the agreed branch. If it advanced, fetch and integrate again. A content conflict with incompatible intended outcomes requires an owner decision. Publishing a Site is a separate operation with its own source version and audience.

For a cloud-only rendering iteration, start from current GitHub main on a codex/blackwater-art-* branch. The workflow captures the reference revision and candidate on Linux with SwiftShader, matching the camera, viewport and time. Inspect the paired image artifacts and the candidate's input, reload and two-player report. Use the Actions checkout SHA as the tested revision. For later comparisons update the baseline ref to the intended reference commit. After merging, verify that main contains the tested runtime tree. Pull or merge that commit on the PC when GPU testing is needed. A private Site deployment and its hosted co-op check can follow independently.
