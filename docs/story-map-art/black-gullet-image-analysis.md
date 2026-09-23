# Black Gullet reference analysis

Reference: `assets/concepts/black-gullet-concept-v01.png`. Target use: a static, visual-only F5 exit landmark in the playable Story descent. The existing course grid, collision cells, encounter gates, exit, and player lane remain authoritative.

## Intake and suitability

The subject is a compound architectural threshold or altar, confidence 0.94. It has one dominant frontal view, a readable arch silhouette, a large central opening, and distinct stone, bone, membrane, metal, and floor responses. Suitability is **conditional**: the reference is a concept render rather than an orthographic drawing, and the rear, side depth, true scale, and construction joints are hidden. Those regions will use a restrained bilateral continuation and will be judged as an authored approximation, not exact reconstruction.

The skill's technical probe passed: PNG, 1536×1024, aspect 1.5, 2,472,381 bytes, no warnings. The reference-admission gate admitted the front view with `foregroundCoverage=0.7103`, `largestComponentFraction=0.9945`, and no duplicate reference hash.

## Observations, bottom up

The visible bounding mass is wider than it is deep and approximately 1.45 times as wide as tall. A dark, irregular outer arch rises from a broad broken footing. A lighter, nearly bilateral set of thick bone-like ribs follows the arch profile and narrows the central opening. The opening is tall and rounded at its crown; its interior remains mostly dark. Several tapered bone forms hang from the upper inner edge. Shorter fractured spurs rise from the lower inner sides. Paired metal bands clamp lateral ribs, and dark red flexible lines run from those clamps into the structure. A thin, branching oxblood web is visible inside the throat, behind the front ribs. A small amber point sits deep in the opening. The foreground is a dark, flat stone floor with narrow reflected highlights.

The macro assembly is a load-bearing dark arch around a traversable aperture. Meso assemblies are the segmented pale ribs, lateral buttresses, base rubble, inner throat frame, membrane web, paired clamp-and-cable groups, hanging crown spurs, and deep ember. Micro features are irregular chips, pores, shallow grooves, edge wear, clamp fasteners, and narrow vascular branches.

Visible connections suggest embedded bone-to-stone contact at the arch and footing, overlapping metal collars around lateral ribs, and cable ends socketed beneath those collars. The membrane appears stretched between rear inner supports. These are construction inferences; the image does not reveal exact sockets or the rear attachment surface.

## Material evidence and confidence

- **Outer stone:** charcoal to near-black, nonmetallic, rough, mottled, with pitting, broken edges, and lighter exposed facets. Roughness is inferred high (about 0.8–0.95); metalness near 0.
- **Bone ribs and spurs:** pale warm ivory with gray-brown grooves, porous/scuffed surface, broad matte response, and sharper worn ridges. Roughness is inferred high (about 0.7–0.9); metalness near 0.
- **Membrane/web:** dark oxblood with thin branching strands and sparse openings. It appears less matte than bone but does not show enough evidence to determine translucency; keep it opaque and use layered depth rather than transparent sheets.
- **Clamps and cables:** small muted bronze collars around organic struts and dark red-brown flexible lines. The metal response is inferred from the visible warm specular edge; use moderate metalness and worn satin roughness, with the lines kept dielectric.
- **Floor:** charcoal stone, mostly matte with localized damp reflections; vary roughness by patches instead of making the entire floor glossy.
- **Ember:** a small, low-area amber emissive cue in the depth of the throat; it is not a broad fill light.

## Identity targets and uncertainty

Critical identity features are the broad broken stone silhouette, layered pale ribs, a tall unobstructed dark aperture, oxblood web recessed behind the front edge, paired collar-and-cable attachments, crown spurs, and the distant ember. The single reference does not establish the back profile, hidden side surfaces, exact rib count, scale, or whether the web is tissue or cordage. Model the concealed side as a lower-detail continuation, document the guess, and preserve a clear standing passage with the existing course collision layout.

## Current in-game mismatch

The isolated F5 approach render shows the focal opening primarily as red toroidal bands at distance; the visible bone-and-basalt mass does not dominate the doorway the way the concept does. The next build pass should strengthen the nested architectural silhouette and value separation first, then add local material relief and attached hardware. No course topology or collision change is needed for this pass.

## Local img2threejs precedent search

The skill's local BM25 search ran against the `core_3d` collection with the combined terms `black gullet architectural arch horror threshold`. The index was current (fingerprint `6857e5ab528b42ac12f4f411f862610a0bffce8e47aee3610a7603c318072fe8`). Its two returned records were generic weapon-PBR notes about alpha-mask wear and subsurface scattering; neither describes architectural massing or a compatible environment material. They were not transferred into this model. This threshold therefore uses the directly observed concept features above and the existing room's authored course dimensions rather than claiming a close library precedent.
