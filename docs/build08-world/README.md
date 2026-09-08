# Build 08 world contract

The campaign now uses authored 12x12 cell maps with a 4 m cell scale. The collision proxy remains deterministic and custom, while `course.layout` gives the renderer connected zones, readable routes, hero landmarks, machinery anchors, and sector lighting cues.

## Runtime contract

- `CAMPAIGN_MAPS` in `campaign.js` owns `blocks`, explicit internal `walls`, and spawn points.
- `CAMPAIGN_LAYOUTS` owns `zones`, `routes`, `landmarks`, `machinery`, and `lights` for Bloodworks, Ossuary, and Choir.
- `createCampaignCourse(index)` exposes `layout`, `world`, `zones`, `routes`, `landmarks`, `machinery`, and `lights` while retaining `cells`, `blocks`, and `walls` for simulation/network compatibility.
- `validateAuthoredMap` runs at module load and verifies the exit, every spawn point, and every landmark anchor are reachable from the player start.
- `world-authored.js` builds large landmark silhouettes, zone lights, and moving machinery. Dynamic parts are marked `userData.noBatch`.
- `world-horror.js` imports the authored builder and retains the original organ/core return anchors for the current renderer. The returned `authored.animate(timeSeconds)` hook is available for a renderer tick integration.
- `world-polish.js` skips `userData.noBatch` objects during static batching and adds non-colliding route spines and large focal/objective zone frames.

## Sightline intent

The first encounter starts at `[6, 10.5]`, uses the central aisle toward `[6, 6]`, and keeps the side galleries at `[2, 5]` and `[10, 5]`. The focal court and objective approach stay open in the center; landmarks sit at the edge or above the movement plane so enemy silhouettes remain readable.

## Verification

- `node --check campaign.js world-authored.js world-horror.js world-polish.js`
- `node --test tests/world-polish.test.mjs`
- `node --test engine.test.mjs tests/build06-integration.test.mjs`
- All three authored maps report a reachable exit and all authored spawn points/landmarks.

The build manifest still needs `world-authored.js` added to `RUNTIME_FILES` and `REQUIRED_RUNTIME_FILES` by the root integration pass.