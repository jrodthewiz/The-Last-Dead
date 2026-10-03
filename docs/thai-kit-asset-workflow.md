# Recovered Dogfight / Duals asset workflow

The user's intended inexpensive asset source is **Vibe3D + Thai Kit**.
Confirmed locally on 2026-10-02, not inferred from the Kenney download pipeline.

## Commands and evidence

The package's published usage documents:

```powershell
npx vibe3d add @thai-kit/props
npx vibe3d add @thai-kit/oil-drum
```

The first adds the kit; the second adds one model. These are documented commands
matching the installed workflow, not a recovered shell-history transcript.
Source: https://www.npmjs.com/package/@thai-kit/props

Dogfight evidence:

- `C:/Users/wolfk/Desktop/Dogfight/models.json`: `@thai-kit` registry points to
  `npm:@thai-kit/props`, pinned to `0.3.4`.
- `models.lock.json`: installed item addresses, source hashes and version.
- `src/models/`: **154** directories with `thaikit.json`, counted locally.
- `docs/thai-kit-vibe3d.md`: integration notes and the curated 37-model shelf.
- `src/shared/maps/millhaven/thaiKitProps.js`: authored 74-placement dressing
  layer for fuel caches, markets, transport, service lanes and landmarks.
- `src/shared/maps/thaiKitAssetLibrary.js`: dimensions and collision adapter.

Each installed model includes editable `createObjectModel.ts`, its `model.ts`
entry point, `thaikit.json` metadata and `colliders.json`. The pack and inspected
oil-drum metadata declare MIT licensing. Preserve the upstream license/notices
when importing. These are ready-made procedural Three.js factories, not paid
per-object generation requests and not merely GLB downloads.

## Direction for The Last Dead

Prefer this existing library for the next street-detail pass. Useful families
already installed include oil drums, bins, barriers, fences, utility lamps,
vendor carts/canopies, transit vehicles and building facades. Select related
clusters for Netmakers, Power Cut and the ferry approach, rather than filling
every free space with random objects.

Keep the complete source library available for authoring, but ship only the
chosen subset. Dogfight itself follows that distinction: 154 installed models,
37 curated source models and 74 bounded placements.

Import steps:

1. Preserve selected source, metadata, colliders, pinned version/hashes and
   upstream licensing inside this repository; avoid a runtime path to Dogfight.
2. Adapt TypeScript to this project's browser JavaScript or export verified
   GLBs. Bind factories to the existing vendored Three.js instance.
3. Verify measured bounds, material/triangle costs and any texture URLs.
4. Place related prop clusters with collision matching their actual shapes;
   preserve the eight-metre Power Cut opening and road/yard entrances.
5. Verify screenshots, reachability, pickup access and rendering cost.

Compatibility to check: installed metadata declares `three >= 0.185.0`, while
both Dogfight's notes and this game's `vendor/three.core.js` identify the 0.184
line. Dogfight already uses these assets with that version, but that is not
proof every factory is compatible here. Test the selected subset without
silently upgrading the renderer or bundling a second Three.js copy.

This discovery pass adds no assets to the running game and makes no renderer
changes. The earlier Kenney pipeline remains usable, but it was not the npm/npx
workflow the user meant. Future sourcing should start with this recovered
library and its authored placement/collider patterns.
