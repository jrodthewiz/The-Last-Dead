# The Last Dead — The Descent

A 67-second widescreen cinematic preview of the five story floors, in campaign order.

## Deliverables

- `The Last Dead - Descent.mp4`: 1920×1080, 24 fps, H.264/AAC master for presentation and sharing.
- `The Last Dead - In-Game Preview.mp4`: smaller 1280×720 H.264/AAC copy for use in a game menu or preview.
- `The Last Dead - Descent.tsrct`: editable Tesseract composition, packaged source footage, fonts, audio, and native title layers.
- `index.html`: local playback page with floor chapter buttons. Open it through the existing local server at `/promotion/descent-film/`.
- `Sources/`: retained individual camera takes and soundtrack stems.
- `Previews/`: visual review frames, filmstrip, and poster.
- `.tesseract-work/`: retained capture/edit scripts, editable JSON, timing, provenance, and verification reports.

The compact preview is a ready-to-use asset. This work does not automatically add video loading or a trailer button to the main game menu.

## Sequence

| Time | Floor |
| --- | --- |
| 00:00–00:12 | Intake Foundry |
| 00:12–00:24 | Graft Galleries |
| 00:24–00:36 | The Catacombs |
| 00:36–00:48 | Resonance |
| 00:48–01:02 | The Last Descent |
| 01:02–01:07 | Title ending |

Three shots per floor move from environment to closer threat, with slow camera movement and quieter holds. Floor titles and cinema bars remain editable in Tesseract.

## Image provenance

All scene imagery is captured directly from this repository's `Renderer`, `makeDungeonCourse`, authored dungeon data, materials, lighting, and character assets. No generated stills, external cinematic footage, or replacement environments are used.

This is an **in-engine cinematic**, not a recording of a player completing the game. The isolated capture page hides the HUD/viewmodel, scripts the camera, and holds combat AI. Enemies use the floor's authored types and spawn points, with the game's native character animations. The capture code does not alter the playable game or its existing browser tab/server. Each camera path is checked at 41 positions against the game collision map before visual review.

The five floors are the active story descent. The older three-sector campaign is a separate mode and is not presented as extra story floors.

## Audio provenance and cost

The edit reuses the game's bundled `abandoned-passages.ogg`, `dark-cavern-loop.ogg`, `industrial-reveal.ogg`, `string-sting.ogg`, and `distant-scream-rough.ogg`. Their source/license records are in `../../docs/audio-sources.md`. Music is extended with local crossfades; effects retain separate editable audio layers.

No paid audio, imagery, rendering service, or advertising campaign is used. The user confirmed eligibility for Tesseract's free commercial license. Existing agent subscription/usage costs remain separate.

## Reproduction

Run from `C:/Users/wolfk/Desktop/thelastdead` with the local game server already serving this checkout on port 5200. Coordinate exclusive GPU use with other rendering/performance tasks.

1. Review `.tesseract-work/shots.json` and run `node promotion/descent-film/.tesseract-work/check-camera-paths.mjs` after camera edits.
2. `node promotion/descent-film/.tesseract-work/capture.mjs scout` produces stills for review in an isolated headless Chrome session.
3. `node promotion/descent-film/.tesseract-work/capture.mjs record` renders each retained take frame by frame at 24 fps. An optional third argument selects zero-based shot indices, such as `0,1,2`. Recording refuses to overwrite existing take files.
4. `.tesseract-work/edit.mjs audio` prepares the local soundtrack derivatives. `assemble` imports takes into the newly created Tesseract project, commits the timeline, and applies native graphics. Do not rerun initial assembly on an already populated project: revise its editable JSON/actions instead.
5. Render using the installed Tesseract 0.2.0 CLI. Preserve the original master when making delivery derivatives.

The scripts accept `PLAYWRIGHT_PATH`, `CHROME_PATH`, and `FFMPEG_PATH` capture overrides. `.tesseract-work/tools.json` records the locally verified tooling. FFmpeg 9.0.2 was obtained from the Windows build provider linked by ffmpeg.org; its archive SHA-256 was checked. It is a local preparation/encoding dependency, not a replacement for Tesseract rendering.

## Review scope

Both delivery files are 67 seconds at 24 fps and passed full-file video/audio decoding. The 1080p film is 64,488,076 bytes; the 720p preview is 7,252,546 bytes. Measured final audio is -15.97 / -16.00 LUFS, with true peaks of -1.50 / -1.63 dBTP respectively.

The composed 16-frame filmstrip was visually inspected for floor order, framing, titles, and the ending. The chaptered player passed real Chrome playback and chapter-seeking checks with no page or media errors. Desktop and 390-pixel mobile screenshots were inspected; the mobile page has no horizontal overflow. Capture, delivery, and playback evidence is retained in `.tesseract-work/record-report.json`, `delivery-verification.json`, and `playback-verification.json`.

Review reports live in `.tesseract-work/`. Visual filmstrip review and encoded-file validation are distinct from an auditory review. This session has no audio-listening tool, so hearing-based judgments about the final mix must not be treated as verified. Listen through the supplied player before public use. No speech or spoken captions were invented.

Windows Georgia and Arial fonts are embedded in the editable project to match the game's typography; use the video for public sharing and review font embedding rights before redistributing the editable package.
