# Four-rod evidence ledger

## Source status

- Expected recording: `ScreenRecording_09-11-2026 22-47-23_1.mp4`
- Retrieval result on 2026-09-12: no matching Library item was available.
- Byte inspection: blocked.
- SHA-256: unavailable; no checksum is asserted.
- Frame annotations: unavailable. No timestamps, image coordinates, endpoints, occlusions, contacts, dimensions, cross-sections, orientations, or materials were inferred.

Occluded geometry remains unknown evidence and must still receive a collider when later established. The source-specific validation gate remains blocked until the recording is retrieved and its bytes and checksum are verified.

## Engineering fixture

`bridge-lab-playable-v1-engineering-fixture` exists to develop and test the four-rod mechanism. Every rod scalar cites this ledger as `engineering-initial` with low confidence. The fixture provides four independently editable entries with stable IDs `rod-1` through `rod-4`.

The rod length is `0.45 m`, retained only as a low-confidence historical engineering estimate, with a sensitivity range of `0.30–0.60 m`. Centers, orientations, cross-sections, material identity, and contact coefficients are invented engineering choices. They do not describe a real machine or verified recording geometry. Mixed circular and rounded-rectangular entries exercise both supported collider shapes and must not be read as a visual annotation.

The fixture defines rod-local Z as the longitudinal axis, local X as cross-section width, and local Y as cross-section height. Orientation uses right-handed intrinsic XYZ Euler rotations in degrees in an engine world where X is right, Y is up, and Z is depth. Rods 1 and 2 are support rails along world Z at centers `(-0.08, 0, 0)` and `(0.08, 0, 0)`. Rods 3 and 4 are end rails along world X at centers `(0, -0.04, -0.27)` and `(0, -0.04, 0.27)`, using a positive 90-degree intrinsic Y rotation. This arrangement only makes the development colliders spatially distinct and coherent.

## Missing evidence to collect

For each rod, a future annotation must record the source filename and verified SHA-256, timestamp and frame, visible endpoint image coordinates, occluded endpoint status, visible contacts, inferred role, scale reference and limitations, and confidence. Only after those fields are supported by inspected frames may fixture values be promoted from engineering estimates.

## Annotation record template

Create one record per visible observation. Do not copy the unverified baseline digest into a verified-checksum field. Use `null` for unavailable fields rather than inferring values from the engineering fixture.

| Field | Required record |
|---|---|
| Record identity | Version, author and UTC creation time |
| Source | Exact filename, verified SHA-256, byte length and retrieval provenance |
| Frame | Continuous timestamp, frame index if trustworthy, and camera-motion/cut effect |
| Feature | `rod-1`…`rod-4`, claw part, prize feature or contact event |
| Image observation | Endpoint/center pixels, image dimensions, occlusion and visible contact cues |
| Scale and orientation | Reference and uncertainty; projection convention and angle; otherwise `null` |
| Event | Start/end definition, timestamp uncertainty and footage continuity |
| Classification | Direct observation, derived measurement or engineering estimate |
| Limitations | Perspective, motion, blur, obstruction and competing interpretations |

Complete `tests/fixtures/calibration/holdout-reservation.v1.json` before inspecting any reserved frames for fitting. A reserved interval remains labelled as holdout evidence even after a failed run.
