# Task 1 report

## Status

Implemented the discriminated `playable-four-rod` profile and kept `CalibrationProfile` as the legacy v0.1 two-cylinder contract. Added four independently editable sourced rods, per-rod contact properties, supported cross-section variants, schema validation, and regression coverage.

The named source recording was unavailable. The evidence ledger explicitly blocks checksum and frame claims and labels every fixture scalar as a low-confidence engineering estimate. The `0.45 m` rod length has a `0.30–0.60 m` sensitivity range.

## Verification

- `npm run test:run -- src/config`
- `npm run typecheck`
- `npm run lint -- src/config`
- `git diff --check`

## Concerns

Source-specific geometry, occlusion, contact, and holdout gates remain blocked until the recording bytes can be retrieved and verified.

## Review fix

Added `deg`, explicit right-handed intrinsic XYZ and rod-local axes, exact runtime rod-ID validation, expected units, provenance/confidence validation, and physical domains for sourced fields. Revised the invented fixture to two world-Z support rails and two world-X end rails with distinct centers.

TDD evidence: the focused validator run first failed 4 of 18 tests for the missing local-axis fixture, stable ID set, metadata/unit checks, and physical-domain checks. After implementation, the same focused suite passed 18 of 18 tests. Final gate counts are recorded after the fresh verification run below.

Final verification: config tests passed 23/23 across 3 files; typecheck, config lint, and `git diff --check` passed.

## Allowed-range review fix

Added runtime rejection when a sourced parameter's declared `allowedRange` extends beyond its physical domain. Positive dimensions and time steps require a strictly positive lower endpoint; friction and restitution ranges must remain within `0..1`. Signed coordinates and angles retain signed ranges. The focused red run failed 1 of 19 tests as intended; green passed 19/19. Final config verification passed 24/24 across 3 files, with typecheck, lint, and diff check passing.
