# World landmarks img2threejs intake

Reference: `docs/build08/sector-1.png` (gameplay screenshot) with `assets/images/menu-bloodworks-v2.png` as the sector mood and material reference. The gameplay image is a perspective capture with HUD and a weapon occupying the lower foreground; it is conditional evidence for the world landmark silhouettes rather than an isolated object photograph.

## Identification and confidence

The visible landmark family is an industrial-organic room kit. The central bloodworks focal prop is a suspended, radial rib cage around a dark organic core, with a rear spine and red conduit lines. The same authored-world slot carries sector variants: a bone reliquary in Ossuary and a mouth/choir altar in Choir. Confidence is 0.78 for the bloodworks silhouette and 0.56 for hidden backs and interior attachments.

## Form and silhouette

The Bloodworks focal prop is a vertical ellipsoid body inside an open radial cage. The cage is built from repeated curved tubes and horizontal collars; the body is taller than it is wide and hangs above the movement plane. The dominant negative space is the gap between the front ribs and the core. The screenshot shows the front and a shallow three-quarter view only; the rear shell, suspension joint, and lower attachment are occluded or hidden.

The sector variants need a shared structural vocabulary so they read as authored landmarks rather than unrelated primitives: a load-bearing frame, a focal organic volume, a repeated surface motif, a recessed emissive focus, and anchored conduits. The Ossuary motif is bone arches and vertebrae; the Choir motif is bell throats, teeth, and suspended resonators.

## Macro, meso, and micro decomposition

Macro components are `frame`, `core`, `suspension`, `conduits`, and `signal`. Meso components are radial ribs, front plates or arches, a rear spine/backplate, collars, sockets, and a sector-specific focal shell. Micro details are bevel highlights, cavity occlusion, fastener collars, cable junctions, rib tips, tooth or bell repetition, and emissive pulse breakup.

## Spatial relationships and attachments

The core is embedded inside the frame; front ribs overlap the frame sockets by at least 0.04 world units. Rear conduits attach at the upper and lower frame collars and terminate at the core shell. Suspension cables attach to a top crown and remain above the playable movement volume. Sector-specific teeth, bells, and skulls attach to a parent rail or ring instead of floating as independent meshes.

## Materials and finish

Bloodworks uses a dark iron frame (metalness approximately 0.72, roughness 0.52 with edge wear), a maroon organic shell (metalness 0.08, roughness 0.63 with wet clearcoat), and red emissive channels with a narrow hot core. Ossuary uses warm bone (metalness 0.05, roughness 0.78 with cavity darkening), violet emissive sockets, and dark steel fasteners. Choir uses oxidized brass (metalness 0.78, roughness 0.42), warm flesh (metalness 0.04, roughness 0.64), and orange emissive resonators. The materials are procedural approximations because the gameplay screenshot has baked lighting and no isolated PBR maps.

## Identity features and uncertainty

The defining features are the open cage negative space, asymmetrical front plate stack, visible red/violet/orange signal core, and long anchored tubes that connect the landmark to the architecture. The weapon and HUD obscure lower foreground detail; the single gameplay view does not prove exact rear topology, underside construction, or material channel values. Those regions remain approximations and should be reviewed from at least front, side, and rear turntable views.

## Intended iteration

Use a staged procedural pass: blockout silhouette, structural sockets and continuous profiles, sector material separation, emissive and contact-light pass, then interaction metadata and static batching. Preserve the world API and collision proxy while replacing shallow sphere/torus stacks with named, inspectable subassemblies.
