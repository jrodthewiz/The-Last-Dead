# First-person arm reconstruction notes

Reference: `docs/survivor/first-person/reference-front.png`.

## Observable target

- Adult human forearms with a tapered olive canvas jacket sleeve, rolled cuff, exposed warm skin, blood-stained gauze wraps, and a dark fingerless glove.
- The wrist and palm are the identity-critical contact region: the palm sits around the weapon grip, the four fingers curl around the grip axis, and the thumb opposes the fingers from the lateral side.
- The arm silhouette is a continuous shoulder-to-wrist volume. It enters the first-person frame from below and reaches upward into the grip; it is not a pair of straight camera-facing cylinders.

## Scene-graph contract

- `ArmRoot -> Limb -> JacketSleeve -> BareFPSWrist -> GripHand -> GripSocket`.
- `GripSocket` is the animation/action anchor and is fitted to the weapon `grip` socket in the weapon parent frame.
- Two-handed weapons add a separate support anchor at the fore-end/pump. The support hand uses the same palm/finger construction and an independent wrist rotation.
- The socket is translated after orientation is applied; otherwise the wrist rotates away from the grip during fitting.

## Material contract

- Jacket: olive canvas, matte/satin roughness with a generated weave/blood channel.
- Skin: warm mid-value dielectric with medium roughness; no opaque glove-colored palm volume.
- Gauze: desaturated beige, rough and slightly darker at overlap bands.
- Glove: near-black/brown leather with a separate cuff and exposed fingertip/nail segments.

## Known single-image limits

The reference is a front view and does not prove hidden palm surfaces or the exact support-hand pose for each weapon. Those hidden regions are inferred and must be checked in the live first-person view for attachment, silhouette, and no-floating-part defects.

## Live review evidence

- Ossuary: the right forearm now enters from the lower-right frame, gauze bands remain visible, and the fingerless grip hand is fitted to the revolver grip socket.
- Breach / Reliquary: the right hand stays on the primary grip and the left hand is fitted to a named support anchor instead of being independently eyeballed.
- The original camera-facing tube silhouette and detached palm were rejected during review; the current factory is the continuous-limb pass.
