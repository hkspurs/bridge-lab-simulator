# Rejected folded-arm contact initialization probe — 2026-09-12

Purpose: revisit one previously rejected initial-condition experiment because the playable arm geometry has changed. Prior straight-arm results do not predict the new folded arm's loaded trajectory. This is a rejected diagnostic, not a deployed fix.

Baseline source tree matches deployed main `5754d2bc859c23c1e7311c5a34ce200d88c05102` (tree `dbbf973a467ce0e7946f26a711147b8d432ee845`). Local reports identify equivalent local commit `31dcd18`. The attached patch is the complete temporary change.

Hypothesis: place the actual prize collision shape at native downward shape-cast first contact before creating its body, instead of leaving the existing crown-based air gap. This changes the physical initial condition; it is not a solver correction. Shape cast runs when only bridge bodies exist. No gravity, timestep, material, mass, inertia, motor, acceptance threshold or control changes.

| Measurement | First-contact probe | Restored baseline |
| --- | ---: | ---: |
| Full physical tests | 29 pass / 3 fail | 31 pass / 1 fail |
| Completed repeated cycles | First cycle terminates FAULT | 20 REVIEW cycles |
| Maximum observed penetration | 1.203422 mm | 1.681609 mm |
| Left hinge maximum anchor error | 1.569300 mm | See baseline report |
| Left hinge maximum locked rotation | 0.038486 rad | See baseline report |

The probe's maximum penetration occurred on tick 850 in OPEN against claw arm 0. Its run terminates early, so the smaller peak is not an equivalent twenty-cycle accuracy comparison. Rendering-rate runs also terminate FAULT; the rod-length fixture's expected fall behavior changes. No test expectation was adjusted. The new shape therefore does not rescue this initial-condition workaround.

Reverted the entire source patch and reran `npm run test:physics`: restored exactly the prior 1.681608575842708 mm failure with all twenty cycles completed. Production code and deployed site were not changed.

Next architecture decision remains the one documented in `../solver-architecture-options.md`: establish a backend/build with independently controllable contact/constraint accuracy and compatible finite-torque/static-dynamic-friction behavior before app migration. More spawn-gap tuning or threshold relaxation is not justified by these results.
