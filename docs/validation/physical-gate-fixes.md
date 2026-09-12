# Physical gate diagnosis — 2026-09-12

This record extends the historical Task 7 report. The source recording, untouched holdout and physical-iPhone acceptance remain unverified. Engineering deployment authorization does not turn these fixtures into a validated real-machine model.

## Reproduced baseline

Local baseline `1eb977e` reproduces 26 passing physical tests and two failing tests containing three failed criteria:

| Criterion | Baseline | Unchanged limit |
|---|---:|---:|
| Rod sliding, gravity-only acceleration target | 6.069007482% relative error | 5% |
| Signed contact penetration | 1.681608576 mm | 1 mm |
| Locked arm-axis rotation | 0.020458514 rad | 0.02 rad |

## Correct hinge frame

The physical arm rotates about its local Z axis. The initial generic 6DoF constraint aligned its primary axis with local X and freed its tertiary angular Z coordinate. Installed Babylon 8.56.2's native HINGE setup instead locks angular Y/Z and uses the primary angular X coordinate for twist (`havokPlugin.js`, HINGE branch).

The corrected 6DoF frame points its primary axis along physical local Z, retaining Up as the perpendicular axis. Limits and finite velocity-motor torque apply to angular X in that constraint frame. Physical world Z rotations, minimum/maximum angles, dimensions, masses, inertia, motor demand and torque caps do not change. Native applied angular impulses are documented in world coordinates, so existing world-Z torque measurements remain valid.

With the original spawn placement, this changes maximum arm swing from 0.020458514 rad to 0.015880575 rad. All 15 isolated claw tests pass, including the reduced-torque saturation fixture (maximum ratio 0.99531895). This improves the solver's hinge representation without adding stabilization forces.

## Sliding apparatus: account for measured vertical momentum

The original three-tick coast-down interval is retained, with 600 settling ticks, 0.1 m/s initial speed, 0.17 m prize width, 0.6 m rod length, the actual mass blocks and unmodified material coefficients. No samples are selected or discarded to obtain a pass.

The original formula `a_z = -mu*g` requires zero vertical acceleration. Independently measured vertical velocities at the original interval endpoints are -0.002857028507 and +0.001243653474 m/s. The resulting vertical acceleration is +0.246040919 m/s², so Newton's vertical momentum equation gives `N/m = g + a_y`. The appropriate transient prediction is `a_z = -mu*(g+a_y)`.

The unchanged horizontal measurement is -2.704472244 m/s², with **3.472954716%** relative error against this corrected force-balance target. The historical gravity-only expectation (-2.549729 m/s²) and its **6.069007482%** residual remain explicit JSON diagnostics.

Independent guards keep this correction physically meaningful:

- Linear damping is exactly zero.
- Contact normals deviate from vertical by at most 0.0003578 in horizontal magnitude (bound 0.001).
- Contact-point tangential velocities have minimum direction cosine 0.994754 along travel (bound 0.99), limiting the omitted lateral projection effect to less than 1%.
- Solver normal impulse agrees with the separate mass/gravity/vertical-velocity momentum calculation to 0.0066113% (bound 1%). Solver impulses never determine the expected horizontal deceleration.
- The prize remains sliding at the end of the same interval.

## Rejected hypotheses and independent penetration evidence

A native post-step `shapeProximity` query independently measures 1.681614667 mm actual overlap on tick 6. The collision callback reports the same contact distance one tick later. Changing sampling interpretation cannot resolve this failure and has not been used to do so.

The narrow rounded prize lands on circular rod flanks, below the rod crowns. Its actual initial collider clearance is about 6 mm even though the spawn formula adds 2 mm above the crown. A one-time shape cast to actual first contact reduces penetration, but changes the subsequent physical contact history:

| Rejected experiment | Maximum penetration | Maximum locked arm rotation | Reason rejected |
|---|---:|---:|---|
| First contact + 0.2 mm initial gap | 0.639252 mm | 0.0585751 rad | Later prize/arm impact violates rigidity |
| First contact + preserved 2 mm gap | 0.697143 mm | 0.0742348 rad | Later impact also gives 1.84297 mm anchor error |
| Rigidly animated carriage/head/stem prototype, 2 mm contact gap | 0.697143 mm | 0.127321 rad | Removing redundant support locks worsens loaded arm hinge error to 2.58571 mm anchor error |

All three experiments are reverted. No search over spawn gaps or altered prize trajectories is retained. All measured rectangular-prism inertias match their analytic dimensions, so mass reduction or inertia inflation is not justified.

A further isolated comparison used Havok's documented default ideal-step reference of 1/60 while retaining the actual 1/120 tick and original spawn. Babylon normally supplies ideal=actual every step. This reference change worsens penetration to 3.581440073 mm and locked hinge rotation to 0.043906005 rad; sliding also fails at 5.544822% with normal/alignment guards failing. It is reverted. Restoring the native default solver reference is not a demonstrated fix.

## Verified retained result and escalation

The retained source change is only the corrected hinge frame; the sliding benchmark now accounts for independently measured vertical momentum. Original spawn geometry, dynamic suspension chain, solver timestep/reference, gravity, masses, inertia and contact coefficients remain unchanged.

Final local verification:

| Command | Result |
|---|---|
| `npm run test:run` | 135 passed |
| `npm run test:physics` | 27 passed, 1 failed |
| `npm run lint` | passed |
| `npm run typecheck` | passed |
| `npm run build` | passed; existing >500 kB chunk advisory |
| `git diff --check` | passed |

The one remaining failed assertion is penetration **1.681608576 mm > 1 mm**. All 20 cycles finish, all joint/hinge integrity criteria pass, residual motion and growth criteria pass, ten bodies and the same prize instance persist. This result is not all-gates-passing and does not establish engineering deployment readiness.

Further work requires a deliberate solver architecture/configuration choice. The documented native ideal-step API could be studied as an explicit stiffness control using a reference smaller than the actual 120 Hz tick; that would be a new numerical configuration, not restoration of a default. If it cannot maintain both contact and constraint accuracy, a backend exposing solver iteration/contact-quality settings is the concrete alternative. Consolidating the rigid suspension or reducing the spawn gap alone is experimentally insufficient. None of these unproven alternatives is enabled in the retained implementation.

## Follow-up numerical and mechanical investigations

The root authorized numerical substeps and additional equivalent mechanical formulations after the initial escalation. None of the following configurations is retained. Raw reports, including independent measurement guards and source-diff hashes, are preserved in `physical-gate-experiments.json`.

The native ideal-time API adjusts effective stiffness; it is not an iteration-count or true higher-rate simulation setting. A declared powers-of-two comparison retained actual 120 Hz integration and original geometry/initial pose:

| Native numerical reference | Penetration | Sliding residual | Other result |
|---|---:|---:|---|
| 1/240 s | 0.969547 mm | 10.623891% | Joint gate passes; contact/friction pair does not |
| 1/480 s | 1.295797 mm | 27.297589% | Cycles incomplete; normal-momentum guard fails |
| 1/960 s | 1.927374 mm | 63.493976% | Cycles incomplete; normal-momentum guard fails |

Lock rigidity improves, but contact/friction accuracy does not converge. Selecting the isolated near-boundary penetration pass at 1/240 would conceal a failed friction gate. A physical COM impulse gives exactly the same 1/240 launch results as setting initial velocity. Making static/dynamic coefficients equal **only as a rejected diagnostic** still produces 9.637171% residual. Explicit driven preparation of the sliding state also fails and develops lateral motion; none of these apparatus changes is retained.

True integration substeps were then compared, retaining outer input/time accounting at 120 Hz and evaluating rig motion, motor demand and contact feedback on each inner step:

| Actual physics cadence | Penetration | Sliding residual | Other result |
|---|---:|---:|---|
| Two 1/240 s steps per outer tick | 1.444985 mm | 13.243159% | Slip-alignment guard fails |
| Four 1/480 s steps per outer tick | 1.290874 mm | 12.422381% | Changed loaded trajectory causes 0.540621 rad hinge swing; growth gate fails |

These diagnostic joint observations remain at outer ticks, so their failed bounds cannot certify unobserved inner-step integrity. Penetration callbacks capture every inner step. Since these comparisons already fail, no higher-rate configuration or associated fixture rewrite is retained.

Live initialized JavaScript exports **and** compiled WASM exports were inspected independently of TypeScript declarations. This pinned Havok binary exposes no solver iteration count, contact-quality control, penetration tolerance, or convex-radius setter. The available axis stiffness/damping methods explicitly replace hard constraints with spring models; they do not increase hard-solver iteration quality.

Additional contact/constraint representations also failed:

| Rejected formulation | Penetration | Maximum arm swing | Result |
|---|---:|---:|---|
| Circular rods use existing 64-segment rendered mesh as static triangle colliders | 10.521119 mm | 0.120682 rad | Contact normals and friction guards fail |
| Same circular mesh vertices as solid convex hulls | 2.913563 mm | 0.015881 rad | Penetration fails |
| Exact native first-contact initial position, zero added air gap | 0.631819 mm | 0.063129 rad | Removes initial drop, but later loaded hinge fails |
| Exact-contact initialization plus two ball-socket axle bearings across existing 25 mm arm depth | 0.659542 mm | 0.037793 rad | Loaded hinge still fails |
| Same bearings with one axial constraint removed: three positional constraints at one end and two radial constraints at the other | 0.651208 mm | 0.036810 rad | Avoids redundant axial lock; loaded hinge still fails |
| Independent bearings with rigidly animated suspension prototype | 0.562600 mm | 0.038819 rad | Loaded hinge still fails |

Both bearing formulations retain exactly one finite-torque twist motor and the same twist limits; masses, inertia and dimensions are unchanged. The 64-segment cylinder chord error is approximately 15 µm, but a small geometric approximation error does not guarantee good triangle-contact behavior. No triangle-surface result is accepted as proof of solid-body penetration accuracy.

The exact-contact formulation is a distinct physical initial condition—placing the prize on supports at rest—rather than choosing a favorable gap. Nevertheless, it also fails overall and is reverted. No unsupported claim about zero initial overlap, inner-step success, or all-force-gates passing is made for these rejected probes.

The remaining architecture options are now more specific: use a backend/build exposing contact and constraint solver-quality controls, or explicitly redesign the ideal animated-carriage/rigid-structure model with physically sourced finite-force travel and structural compliance. The latter changes the mechanical model and requires new calibration evidence; it is not a numerical patch. Neither is enabled. The retained implementation remains the two proven fixes in `de4cfe1`, with genuine penetration **1.681608576 mm** unresolved.
