# First-person survivor revision

Observed reference: adult human with olive open canvas jacket, charcoal cargo trousers, leather belt/harness, reinforced knees and dark laced boots. Front and side silhouettes show attached trouser legs from waist to soles, approximately 7.5 head units; boots and cargo pockets are identity cues for the downward view. Face, hair, back fabric and exact photographed folds are outside this repair. Existing procedural textures retain separate albedo, bump and roughness channels.

Suitability: conditional for reference-inspired procedural clothing; pass for restoring the existing body visibility. No claim of measured fabric parameters or exact facial likeness. The existing spec/assessment and factory are reused; the runtime revision defines measurable gameplay-camera acceptance.

Source evidence: assets/survivor/player-survivor.js hides every mesh directly under the pelvis in first-person mode, additionally hides jacket and chest, shifts legs -0.18m, and survivor-runtime.js applies scale/translation in addition to the slide pelvis pose. Camera eye is 1.6m standing and 0.88m sliding.

Plan: preserve garment materials and articulated parts; restore body visibility in a candidate module; solve the body/camera relationship and slide joint pose; validate down/forward/orbit/movement frames in a separate playground; promote the accepted implementation only.
