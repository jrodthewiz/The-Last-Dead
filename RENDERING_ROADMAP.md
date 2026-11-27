# Blackwater Rendering Roadmap R39–R46 (plan, awaiting approval)

Synthesized from two independent Gemini planning drafts — `gemini-4-neon` ([full draft](.codex-temp/gemini-neon-plan/reply.md), 526 lines) and `gemini-4-hydrogen` ([full draft](.codex-temp/gemini-hydrogen-plan/reply.md), 266 lines) — which **converged on identical architecture independently**. Both were fed the project handoff methodology, the Hydrogen frame critique, the full ship inventory R15–R38, and the renderer constraints. Implementation by swe-2.1 with instabox A/B validation per iteration.

## Governing constraints (every iteration)

- Forward WebGL renderer, no composer: no SSAO/bloom/SSR/TAA passes, ever. ACES + sRGB, `antialias:false` is identity.
- ≤ 0.30 ms added GPU per iteration on GTX 1650; total worst-case cumulative delta ~+0.40–0.64 ms (12.0 → ~12.4–12.6 ms city median).
- One iteration = one attributable change set = one commit, independently revertable (each design names its kill flag).
- Painterly identity: big calm masses + medium structural variation + sparse fine detail. Never uniform noise at one frequency. High-frequency detail distance-fades (temporal stability).
- Matched-view A/B on the instabox harness before shipping; visual judgment decides, numeric region deltas are directional evidence only.

## Architecture decisions (both models converged)

1. **Contact grounding = hybrid two-tier.** (A) One instanced `sdRoundedBox` decal draw call darkens the *receiving surface* under rectangular props (radial gradients can't do rectangles — corners float); (B) a per-material local-Y base damp/AO skirt darkens the *prop's own bottom rim* — neither half alone seals the seam. Cap: stacked upper crates get tier-B only.
2. **Retire the `lampPools` decal system; inject analytical lamp lighting into the ground shaders.** Decals can only brighten diffuse albedo additively — wet asphalt needs a view-directed GGX specular streak, which only a real lighting term in `<lights_fragment_end>` can produce. Confirmed codebase fact: existing pools cover only the city street grid (`x=400+col*76`) — harbor lamps have nothing at all.
3. **CUT: scene-color refraction / underwater caustics** (needs a scene copy pass >1.2 ms — violates the no-composer rule) and **real-time shadow-mapped lamps** (+2.5–4 ms — blows the budget). Beer-Lambert + analytic cones achieve the reads in forward rendering.
4. **Zombie figures are a verification GATE, not a rewrite.** No shader edits until close-up captures prove an actual defect.
5. **Scope cap on wood grain/herringbone**: no fine procedural grain (aliasing shimmer under `antialias:false`); no heightfield re-tessellation or triplanar terrain lookups (>0.8 ms). Macro/medium values only; analytic band-limiting for the periodic terms.

## Iteration sequence (visual impact × screen frequency)

| Iter | Target | Est. cost | Validation poses |
|---|---|---|---|
| **R39** | Viewmodel material separation: vertex-baked cavity AO + edge convexity (`aVmMeta`, CPU-baked once), gunmetal edge wear, cloth fold roughness + wet porosity darkening, rain-film roughness collapse + streak normals, view-space cool rim micro-rig scaled by ambient | +0.08–0.12 ms | spawn, civic, forest, waterfront |
| **R40** | Water Beer-Lambert depth absorption (heightfield packed into one `DataTexture`, no depth prepass), Schlick fresnel reflection mix (F0≈0.02), shoreline foam band 0.08–0.65 m animated, alpha fade depth<0.08 erases the jagged seam, instanced piling foam collars vertex-locked to the same swell function | +0.18–0.25 ms (water views only) | waterfront, keeper, island, spawn-road |
| **R41** | Analytic streetlamp pools: 12 nearest lamps packed into shared uniforms, windowed inverse-square falloff `(1-(d/r)^4)²/(d²+1)`, downward cone mask, warm diffuse pool + wet GGX specular streak elongated by wet-mask ripple normals. Retire decals after audit | ~+0.10–0.14 ms net | civic, oldtown, spawn-road, waterfront |
| **R42** | Hybrid contact grounding per architecture decision 1. `contactShadow()` helper already exists (proven on vehicles/generator) — extend into the instanced SDF system; per-instance `(halfW, halfL, cornerRadius, strength)`; fog-matched decal tint; base-skirt `applyBaseGrounding` onBeforeCompile helper | +0.12–0.16 ms | waterfront, keeper, civic, generator |
| **R43** | Zombie verification gate: add `zombie-closeup-day` + `zombie-closeup-lamp` capture poses, audit silhouette/banded-spec/rim/texture filtering against TF2-style illustrative shading criteria. Conditional `stylizeModel` calibration only if defects proven | 0.00–0.03 ms | zombie-closeup ×2 |
| **R44** | Directional rust: anisotropic gravity-aligned drip streaks anchored at seams/ridges replacing isotropic blotch noise; blend with isotropic pitting on top faces (`abs(N.y)>0.7`); rust keeps roughness 0.9/metalness 0 coupling | +0.02–0.05 ms | generator, waterfront, civic |
| **R45** | Keeper stilt house: plank-course tonal modulation (quantized plank index hash, `fwidth` anti-alias filtered), tide-line damp + algae stain 0–1.4 m above water, boardwalk fascia geometry strip (merged, 0 extra draw calls) + plank-end variation. NO fine wood grain | +0.04–0.06 ms | keeper, waterfront |
| **R46** | Herringbone residual kill: replace periodic `sin(vGround.y*0.65)` strata with domain-warped aperiodic 1D value noise + analytic `fwidth` Nyquist band-limiting (IQ box-filtered sine), dual distance fade 45–125 m | +0.01–0.03 ms | forest, island, spawn-road |

Ordering rationale: viewmodel first (100% of frames), then water (huge screen area in coastal gameplay), lamps (the wet-city night read), contact grounding (cross-scene), then verification/ refinements. R40/R41/R42 all touch ground/water shaders — sequenced separately to keep attribution clean per the methodology.

## Consolidated source list (what each technique rests on)

- **PBR material separation, GGX specular, AO formulations** — Google Filament PBR docs §4.8/§4.11/§5.x: https://google.github.io/filament/Filament.html
- **PBR theory fundamentals** — LearnOpenGL: https://learnopengl.com/PBR/Theory
- **Wet-surface porosity darkening, windowed light falloff, specular occlusion (Lagarde)** — Lagarde & de Rousiers, *Moving Frostbite to PBR 3.0*, SIGGRAPH 2014
- **Fresnel approximation** — Schlick (1994), *An Inexpensive BRDF Model for Physically-Based Rendering*, CGF 13(3)
- **Water surface construction** — GPU Gems Ch. 1 (Finch, Cyan Worlds): https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models
- **Beer-Lambert transmittance / depth absorption** — pbr-book.org + Catlike Coding *Looking Through Water*
- **Rounded-box SDF decals** — Inigo Quilez, 2D distance functions: https://iquilezles.org/articles/distfunctions2d/
- **Analytic filtering of procedural patterns (herringbone kill, plank anti-aliasing)** — Inigo Quilez, *Filtering Procedurals*: https://iquilezles.org/articles/filterableprocedurals/
- **Stylized entity shading criteria (R43 audit)** — Mitchell et al., *Illustrative Rendering in Team Fortress 2*, NPAR 2007
- **Color pipeline discipline** — three.js color management: https://threejs.org/manual/en/color-management.html
- **Project methodology** — `threejs-rendering-quality-handoff.md` (LanternTown contact hierarchy, Rewind region-compare workflow, false-positive discipline)
- **Frame critique driving the backlog** — `.codex-temp/gemini-hydrogen-r38/reply.md`

## Validation & budget gates

1. Full 9-pose SwiftShader baseline refresh before R39 (plus 2 new zombie poses so R43 evidence exists early).
2. GPU frame checkpoints after R40, R41, R42 on the local machine **when it recovers** — city median must stay ≤ 12.6 ms. If machine stays loaded, document analytic justification instead per established practice.
3. After R42 lands: second Hydrogen/Neon paid frame review of fresh captures (closes the outer critique loop; ~sub-cent per call).
4. Every iteration: visual pass/fail criteria named in the drafts are the acceptance tests; fail = iterate or revert, never ship-and-forget.
