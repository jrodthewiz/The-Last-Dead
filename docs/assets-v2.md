# Dead Arrival v2 menu artwork

Generated and inspected the v2 main-menu key art for the Bloodworks setting.

## Deliverable

- File: `assets/images/menu-bloodworks-v2.png`
- Source: built-in image generation tool (Gemini provider attempt was previously blocked by a missing key; no provider retry was made for this pass)
- Runtime role: wide main-menu / title backdrop
- Composition: left 42% held in near-black low-detail negative space for title and menu controls; right side carries the condemned foundry, surgical gantries, ritual machinery, and a partially obscured nonhuman silhouette.
- Palette: charcoal-black steel, bone-white braces, rust, wet crimson emergency light, cold volumetric haze.
- Copy size: 1,845,444 bytes PNG.

## Prompt

> Wide cinematic main-menu key art for an original indie horror FPS called Dead Arrival, condemned medical foundry called the Bloodworks. Original scene: vast ruined surgical machinery and ritual operating gantries in a dark industrial chamber, blackened steel, bone-white braces, rust, wet crimson emergency lights, drifting dust and cold volumetric haze. On the RIGHT side, a disturbing nonhuman silhouette stands partially obscured among the machinery: elongated asymmetric limbs, heavy industrial restraint remnants, wet sinew and plated bone, unsettling but not a recognizable existing character. Keep the LEFT 42 percent of the image dark, low-detail negative space for a title overlay; put visual detail and the silhouette on the right. Premium atmospheric indie horror concept art, sharp focal subject, controlled charcoal-black and blood-red palette, subtle film grain, deep shadows, strong depth layers, no text, no logo, no UI, no watermark, no border, 21:9 wide composition.

## Inspection notes

The generated frame has the intended title-safe left field with no baked lettering. The right third reads as a tall surgical revenant silhouette against red backlight, while the gantry, hanging restraints, wet floor reflections, and layered foundry architecture provide depth behind it. The subject is original and does not reproduce a named game character. The image is ready for a renderer to place as a cover/background texture with `cover` positioning and a dark left-side gradient kept above it for legibility.

## Handoff

Renderer should load `/assets/images/menu-bloodworks-v2.png` (or the relative staging path above), preserve the wide aspect ratio with `background-size: cover`, and avoid cropping the right-side silhouette at common desktop widths. Keep the title-safe left side visually open; do not add text into the source image.
