# Photo-reference folded claw

The playable profile now estimates the broad outreach, distinct downfold and slender terminal plate visible in IMG_6791.jpeg. See [photo provenance and observations](../research/claw-photo-reference.md#observations). The far arm is mirrored as an implementation assumption; the photograph does not establish its complete shape. Transparency represents the visible clear appearance, not a confirmed material specification. No branding or artwork is copied.

## Geometry estimates

All dimensions below are low-confidence scene-scale estimates, not measurements or millimetre calibration from a single perspective. They retain the existing 160 mm vertical reach and permit obstruction by the 140 mm prize with existing hinge limits.

| Item | Estimate |
| --- | --- |
| Right-arm hinge-frame centerline | (0, 0) → (55, −35) → (55, −130) → (45, −160) mm |
| Left arm | Mirror X; same dimensions and mass |
| Upper outreach / downfold thickness | 8 mm |
| Terminal contact plate thickness | 4 mm |
| Plate depth | 25 mm |
| Declared arm mass | Existing 25 g engineering estimate |
| Hinge spacing, open/closed angles | Existing ±35 mm, 0.65 / −0.12 rad |
| Carriage drop and head clearance | Existing 320 mm; nominal head bottom 12.5 mm above settled prize |

`clawArmGeometry` supplies the same box dimensions, centers and rotations to render meshes and the Havok compound. Each folded arm has one dynamic body and three collision children: outreach, downfold and contact toe. The bend cavity has no enclosing collider. Rectangular segment ends meet with small overlapping joint regions; this is a constituent-plate approximation, not a reconstructed seamless manufactured part. The straight isolated fixture retains its original box and origin.

The folded body's origin is the hinge. Its local constraint anchor is zero; the quantitative four-joint observer consumes that same anchor. Pose reset still operates on the single rigid arm body and carries every child plate with it. World-Z finite-torque hinges, step frequency, gravity, friction, motor limits and sequence controls are unchanged. With no contact sample, the rotated terminal endpoint supplies the horizontal-normal lever estimate; measured world-space contact moments replace it on the next fixed step, including contacts on upper segments.

## Mass and dynamics

Havok derives the compound COM and principal inertia from the rotated constituent boxes, with equal density across them, and applies the existing 25 g total mass. This treats the small joint overlaps as constituent material. No inertia override or inflation is applied. Independently summing the box volumes gives COM magnitude X = 44.3648 mm and Y = −64.0386 mm relative to the hinge. An analytical Z angular impulse produces 0.99830 rad/s versus the ideal 1 rad/s; the test permits 0.5% native compound-integration tolerance.

## Verification

The first real-Havok test failed on the original straight playable arm at the estimated upper outreach. It passes on the new profile: both arms have solid upper, elbow-adjacent, downfold and toe regions; their bend cavities remain empty. Matching render-mesh ray picks check the same points. Compound/body counts, mass response, material and mesh disposal are checked independently.

The folded 140 mm load-cell trial runs 720 ticks at 120 Hz. During ticks 481–719 it records 1,912 cheek contact samples, steady resultant reaction 0.17216–0.17290 N, blocked angles −0.05226 / −0.05241 rad, actual hinge torque at most 0.057376 N·m and commanded cap at most 0.458257 N·m. Maximum penetration is 0.001222 mm. These are separate measurements: the normal-impulse sum is not the resultant grip force. This geometry's nominal motor does not saturate in that pose and produces substantially less force than the straight fixture; this is not a calibrated claim of real-machine grip strength. The contact-presence assertion requires a positive measured load (>0.05 N), not the straight fixture's >0.5 N response.

A separate folded-arm backdrive experiment applies 0.8 N·m external opening torque. The actual holding-motor torque saturates at a measured command ratio of 1.000000077 and both arms backdrive by more than 0.2 rad. Free closure and reopening reach their existing targets.

Local verification:

- Source suite: 135/135 passed, including two real attempts preserving prize identity, pause/resume, cancellation and explicit reset.
- Mandatory bridge/claw physics: 26/26 passed, including four folded-arm tests.
- Full physics: 31/32 passed. The twenty complete folded cycles reach REVIEW with finite states, stable body count, bounded residual motion and no hinge escape; only the pre-existing 1.681608575842708 mm penetration exceeds the unchanged 1 mm quantitative criterion.
- Maximum folded hinge anchor error in the twenty-cycle trial: 0.412602 mm; no hinge-angle-limit violation.
- Lint, TypeScript and production build pass. Vite retains its large-chunk warning.

Browser and live-site validation are tracked separately by the publishing/review task. Quantitative acceptance remains incomplete because of the existing penetration failure.
