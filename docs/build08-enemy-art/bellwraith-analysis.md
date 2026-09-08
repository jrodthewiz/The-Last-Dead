# Bellwraith image analysis

## Observation

The reference is a single front three-quarter concept render of a suspended, non-humanoid
hybrid character. Its macro silhouette is a radial cylindrical bell shell over a hanging skull,
with bilateral bone arms and torn membrane planes extending laterally. The bell is the dominant
volume; the skull sits inside the lower opening and is partially occluded by the lip.

The outer shell is a tapered lathed form: broad lower lip, narrower crown, and a short upper
cap. Three horn volumes attach to the crown. A chain system hangs from the shell and carries small
bell and cross-shaped pendants. The skull is a separate embedded assembly with eye sockets,
nasal cavity, teeth, and a crown of two lateral horns. The arms use articulated curved bone
segments terminating in hooked fingers. Thin dark membrane panels bridge the shoulder and arm
regions and have ragged, perforated edges.

The shell reads as aged metal with mid-value olive-brown albedo, low-to-mid roughness on worn
edges, and higher roughness in recessed ornament. Bone is warm off-white with darkened cavities
and a matte, porous response. Membranes are near-black, semi-opaque, and rough. The interior is
an occluded dark cavity with a localized red emissive signal around the skull. Small edge bands,
rune marks, chains, and bells are identity-defining meso details.

## Reconstruction contract

- Primary domain: hybrid character/prop; complexity: complex.
- Runtime scale: 1.45 m visual width, 1.39 m visible height, floor offset derived from bounds.
- Silhouette targets: continuous bell shell, readable skull outside the lip, two articulated
  bone arms, broken membrane triangles, and a low hanging hover/sigil cue.
- Material targets: independent albedo, roughness, bump channels for shell, bone, membrane, and
  chain; emissive red/acid signals kept separate from base color.
- Action anchors: `pulseOrigin`, `attackOrigin`, `leftHandSocket`, `rightHandSocket`,
  `hoverAnchor`, and `deathBurst`.

## Single-view limits

The rear shell, interior ornament, and hidden membrane attachment surfaces are occluded and remain
procedural approximations. The concept's baked lighting is used as visual evidence for palette and
feature placement only; it is not treated as a PBR texture source.
