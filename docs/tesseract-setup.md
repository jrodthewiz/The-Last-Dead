# Tesseract by Mirage

Installed on this Windows machine on 2026-09-24 for The Last Dead video promotion.

## Installed tools

- Runtime: `C:\Users\wolfk\AppData\Local\Tesseract\bin\tsrct.cmd`
- Version: `0.2.0` (`91214aa14b4e2bd9c48622ab0419cb7f288b3e48`), matching the official skills' version pin.
- Video skill: `C:\Users\wolfk\.codex\skills\tesseract-video\SKILL.md`
- Motion graphics skill: `C:\Users\wolfk\.codex\skills\tesseract-motion\SKILL.md`
- Optional runtime telemetry: disabled and verified.

The two skills provide Mirage's official agent guidance; a separate plugin installation is unnecessary. They will be available to Codex on the next turn.

## Cost and eligibility

Mirage advertises the local engine and local rendering as free, with no Mirage account required. Codex subscription or usage charges remain separate. No paid service, subscription, asset purchase, or advertising campaign was activated during setup.

The current terms permit commercial use subject to eligibility. A for-profit business with at least US$1 million in worldwide gross revenue during the preceding twelve months, aggregated with controlled/affiliated businesses as defined in the terms, needs a separate written agreement with Mirage. Marketing and testing are included in commercial use. Separate agreement pricing is not specified here. Recheck the terms when eligibility or versions change.

- Official setup: https://mirage.app/tesseract/codex
- Official source and skills: https://github.com/mirage-hq/Tesseract
- Terms, especially section 2.2.3: https://github.com/mirage-hq/Tesseract/blob/main/TERMS.md

## Verification

Downloaded the official Windows x86_64 version 0.2.0 release and verified its ZIP against the publisher's SHA-256 file:

`35822d306209476d5c80ac3fafed6be6110afd70840f6c7179e5a35caf57b988`

The bundled installer also verified its file checksums and launched the executable successfully. Installed `--version`, `project --help`, `export --help`, and `telemetry status` checks passed.

The user confirmed the business is below the commercial-use revenue threshold on 2026-09-25. A three-second test containing a real game-rendered frame exported successfully as 1280×720 H.264 MP4 at 24 fps. Its duration/codec were verified with ffprobe and an extracted frame was visually inspected. The retained test is `promotion/descent-film/.tesseract-work/setup-test.mp4`.

## Using it

Ask Codex to use Tesseract with local gameplay footage. Keep each edit's `.tsrct` document, source assets, previews, and MP4 together in a dedicated promotion project folder in this repository. Keep these assets independent of the game's runtime and build.

PowerShell version check:

```powershell
& "$env:LOCALAPPDATA\Tesseract\bin\tsrct.cmd" --version
```

Example brief:

> Use Tesseract to edit our gameplay footage into a 15-second vertical teaser for The Last Dead. Open with a strong gameplay moment, add an editable title, preserve useful game sound, and show a preview. Use only existing footage and free local tools. Keep the editable project with the export.

Tesseract edits supplied footage and native motion graphics. It is not a footage-generation service or a conventional desktop timeline editor. Paid generated assets and paid ad distribution would be separate decisions.

The existing game browser tab and local game server were not changed during installation.
