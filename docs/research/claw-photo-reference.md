# Claw photo reference — IMG_6791.jpeg

User-supplied screenshot inspected on 2026-09-12, 707 × 1536 pixels, 309,546 bytes. SHA-256: `4867b88773e28760d152596b18ebf32fa315c532ba7e86cd82271e5205451472`.

The screenshot is used to correct the claw silhouette. It is not the original continuous recording and has no verified camera calibration, frame timestamp, or physical scale. The original screenshot is not republished with this repository.

## Observations

- The visible left-side claw structure extends outward from the machine head, bends at an elbow, and continues downward beside the box. A single straight bar from pivot to tip does not reproduce that outline.
- Thin, parallel transparent/reflective edges or strips are visible. They support a clear, edged visual treatment; they do not establish the exact polymer, coating, friction coefficient, or complete plate topology.
- The lower contact end appears slender. Its full outline and contact with the prize are partly obscured, so the exact toe angle and length cannot be measured reliably here.
- The opposite arm and its attachment are substantially obscured by the head and prize. Mirroring the visible arm is an engineering assumption, not an observation.

## Modeling scope

Represent each playable arm as one rigid body with an outward upper section, a downward folded section and a slender contact end. Derive rendered sections and collision shapes from the same geometry. Preserve the empty space inside the bend: a convex envelope spanning the entire folded arm would create invisible contact surfaces.

Segment lengths, offsets, thickness, depth and symmetry remain explicit low-confidence estimates. Keep existing force/friction values labeled as estimates; the transparent appearance does not justify assigning a particular real material. A single image cannot establish loaded deflection, motor force, internal linkage geometry, or behavior throughout a full closure cycle.

The isolated straight-arm benchmark may remain for historical comparison. Passing that fixture cannot establish the new folded arm's obstruction, contact force or collision accuracy; those require tests of the actual playable geometry.
