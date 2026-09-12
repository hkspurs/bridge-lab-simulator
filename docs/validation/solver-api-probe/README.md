# Pinned backend API feasibility probe — 2026-09-12

This throwaway diagnostic answers the prerequisite API question, not whether an alternate backend fixes the bridge. No production dependency, physics adapter or deployed behavior changed. Reproduce in this directory with `npm ci --ignore-scripts` then `node probe.mjs`. Exact package versions and registry integrity hashes are in the lockfile.

## Finding that supersedes the earlier Rapier assessment

`@dimforge/rapier3d-compat@0.20.0` exposes `UnitImpulseJoint.setMotorMaxForce` in shipped TypeScript, JS runtime and native WASM binding `jointSetMotorMaxForce`. The online [RevoluteImpulseJoint reference](https://rapier.rs/javascript3d/classes/RevoluteImpulseJoint.html) inspected during this probe did not list it. Installed version evidence supersedes that documentation omission: a native motor cap is now established for this package.

A zero-gravity rotor, inertia 0.001 kg·m², zero damping and center-of-mass hinge runs one 1/120 s step under a deliberately unattainable 100 rad/s velocity target. Inferred torque is independently `I * delta_omega / dt`. Motor cap 0, 0.02 and 0.08 N·m produces 0, 0.019999999 and 0.080000010 N·m respectively, all within 1e-6 N·m. This proves the elementary saturated native cap; it does not prove an obstructed compound arm, a loaded suspension, contact stability or twenty cycles.

Rapier's [official friction guide](https://rapier.rs/docs/user_guides/javascript/collider_friction/) still states that static and dynamic coefficients are not distinguished. Shipped collider API has one coefficient, and shipped `PhysicsHooks` exposes contact/intersection filters without a solver-contact modification callback. The guide's generic contact-modification link does not establish that capability in this JS build. Full equivalence to existing 0.34/0.26 coefficients remains blocked. Per-collider speed switching is not an equivalent per-contact stick/slip solver and was not implemented.

## Jolt alternative

Initialized `jolt-physics@1.1.0` WASM and verified native setter/getter round trips for signed motor torque limits, velocity/position iteration counts, penetration slop and combined contact friction. `ContactListenerJS.OnContactAdded` and `OnContactPersisted` are exposed. These are API checks, not physical tests. The [official contact-listener documentation](https://jrouwe.github.io/JoltPhysics/class_contact_listener.html) describes writable contact settings before the solver runs; the [JS bindings source](https://github.com/jrouwe/JoltPhysics.js/blob/main/JoltJS.idl) provides corresponding binding context, while the pinned package controls this result.

Jolt also presents a single native contact friction coefficient. Its contact callbacks make an explicit stick/slip constitutive model a plausible investigation, not a proven equivalent. Choosing a velocity threshold alone cannot prove static friction, re-stick behavior or absence of chatter. Torque saturation, actual callback execution and contact accuracy have not been tested in Jolt here.

## Decision and next bounded experiment

Do not migrate the app to either package on this evidence. Prefer Jolt for the next isolated friction-model feasibility experiment because its pinned JS build exposes per-contact settings and solver-quality controls. Retain Rapier as a capped-motor/kinetic-only comparison, not a full-profile replacement.

Before porting four rods or the sequence, the Jolt experiment must demonstrate all of:

1. Actual added/persisted callbacks on sliding contacts, with paired tests proving changes affect the solver. No forces applied directly to prizes to mimic grip.
2. Static holding below mu_s=0.34, breakaway above it, kinetic momentum balance at mu_k=0.26, and re-stick without chatter. Predeclare tolerances and contact-state law; no threshold search for a favorable result.
3. Native hinge saturation at zero, reduced and nominal torque, independent angular-momentum response and external-load backdrive at 120 Hz.
4. Only if those pass: port exact profile geometry/mass and compare 4/8/16 solver iterations with independently measured <=1 mm penetration, original initial pose, friction gates and full folded-arm loaded cycles.

This stage is complete as an API feasibility result. The 1.681609 mm Havok overlap remains unresolved. Neither package is certified for the real machine or iPhone Safari.
