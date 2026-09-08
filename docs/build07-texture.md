# Build07 crypt wall texture

## Deliverables

- Runtime PNG: `assets/textures/crypt-wall-albedo.png` (1024x1024, 1,949,540 bytes, sRGB)
- Runtime WebP: `assets/textures/crypt-wall-albedo.webp` (1024x1024, 250,440 bytes, sRGB)
- Source archive: `assets/textures/crypt-wall-source.png` (1254x1254, 2,930,417 bytes)

The PNG is the conservative fallback for loaders that do not enable WebP. The WebP is the preferred opaque runtime map when the renderer supports it. Both outputs were resized and stripped with ImageMagick from the same generated source; no normal, roughness, height, or metallic map was invented from the image.

## Generation

The built-in image generation tool produced and displayed the source image. The frame was inspected before copying: it is a flat, front-on, square panel material with repeating manufactured construction, no dramatic lighting, no words, no creatures, no scene perspective, and no single focal feature. The provider script was not retried for this task.

Prompt:

> Create a seamless tileable 2048x2048 game texture for a dark industrial ossuary wall, orthographic flat front-on PBR albedo reference. Readable manufactured construction: repeating weathered charcoal iron panels with clear rectangular seams, inset stone and concrete inserts, worn chamfered edges, evenly spaced rivet lines, subtle dried rust and mineral staining, fine micro-surface variation, restrained bone-grey and iron-black palette with muted rust accents. Uniform diffuse studio treatment, no dramatic lighting, no perspective, no depth-of-field, no cast shadows, no scene framing, no words, no logos, no creatures, no props. Ensure the left and right and top and bottom edges tile cleanly and avoid a single central focal feature.

## Integration notes

Use the PNG/WebP as the wall albedo on the 4 m crypt panels. Set the map color space to sRGB. Keep the material rough and dark (roughness approximately 0.72-0.9, metalness approximately 0.55-0.75 for the iron frame; stone inserts can use a separate lower-metalness slot). Tile the UVs instead of stretching the full image over a hallway. Derive subtle normal and roughness variation procedurally or in the existing material pass; the generated file is intentionally albedo-only.

No renderer or gameplay files were changed for this asset task. Remaining visual work is an authored normal/roughness pass and a seam check on the exact hallway mesh in the Build07 renderer.
