# The Last Dead — art direction experiments

Seven concept paintovers produced with built-in ImageGen from a fresh screenshot captured on 2026-09-23. These illustrate possible art directions, not implemented rendering changes.

Open `http://127.0.0.1:5200/docs/artstyle-experiments-2026-09-23/index.html` while the existing local game server is running. The gallery has seven full-size views, an original/concept comparison slider, keyboard navigation, and a local browser shortlist.

1. Anatomical woodcut — `01-anatomical-woodcut.png`
2. Wax & wire — `02-wax-wire-stop-motion.png`
3. Decaying fresco — `03-decaying-fresco.png`
4. Porcelain anatomy — `04-porcelain-anatomy.png`
5. Haunted photocopy — `05-haunted-photocopy.png`
6. Living charcoal — `06-living-charcoal.png`
7. Forsaken afterlife — `07-forsaken-afterlife.png` (new Insidious-inspired lighting and psychological-horror study; see `afterlife-references.md`)

The edit target is `sources/04-comparison-source.png`, captured at 1536 × 864 in a separate browser QA tab from the live Catacombs level, floor 3. It contains two naturally spawned enemies and the actual Ossuary viewmodel. The simulation was paused and the camera moved backward to frame both enemies. Existing user tabs and runtime files were left unchanged. Earlier captures are also preserved in `sources/`.

Exact generation prompts and capture coordinates are in `prompts.json`. The generated images preserve the broad composition but include interpretive surface, lighting, and detail changes. No game build is required to view the gallery.
