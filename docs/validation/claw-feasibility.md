# Finite-torque claw engineering fixture

## Engineering fixture

This is an estimated mechanism, not a measured replica or a validated release. The source recording remains unavailable. `src/config/clawProfile.ts` keeps value, unit, allowed range, source kind, source reference and low confidence for every adjustable physical scalar. Dimensions, masses, friction, travel and control gains are engineering estimates. The 4 N closing / 2.5 N holding candidates are **per-arm** low-confidence starting ceilings from the research brief, not measured forces or universal machine limits.

The two solid arms are 160 × 8 × 25 mm with 25 g mass each. Havok derives finite box inertia from geometry and configured mass. The 300 g dynamic head is suspended from a velocity-driven carriage by a rigid constrained assembly; a collidable 80 mm stem represents its support. This fixture is a rigid stem suspension, not a cable/swing model. Arm hinges constrain translation and two angular axes, with explicitly enabled limits about local Z. Only adjacent/self-support collision pairs are disabled; accessible surfaces have physical colliders.

`createClaw(scene, clawProfile)` returns a physics-owned handle implementing `ClawRig`, plus bodies, joints and read-only sample functions. Its body list must be included in the **same** fixed 1/120 s step as the bridge/prize. It does not enable a second physics loop, mutate prize transforms, attach the prize, or integrate the app/state machine. Gravity remains 9.80665 m/s².

## Installed API evidence and measurement

Inspected local locked code: Babylon 8.56.2, Havok 1.3.14. `HavokPhysics.d.ts` explicitly documents angular `HP_Constraint_SetAxisMotorMaxForce` as maximum **torque**; `HP_Constraint_GetAppliedImpulses` supplies linear/angular world-space impulses. Babylon forwards motor maximum force without conversion. Joint angular limits/targets are radians and rad/s. Test `beforeAll` asserts exact package versions before accessing native constraint handles; native measurement stays entirely in the test harness.

The production actuator uses Babylon's public velocity motor and its native torque limit. Requested speed is a proportional position-error target clamped to 0.5 rad/s. Torque ceiling is candidate force × actual perpendicular contact lever × 0.85 reserve. The lever is the projection of `(contact point − world hinge) × contact normal` on the world hinge axis; both hinge offset and axis rotate with the head. Before contact, the estimated tip lever is used. The preceding step's contact samples update the next step's bound. Close/open use the peak candidate, hold uses the lower holding candidate. This is not a universal contact-force limiter during impact or at arbitrary collision geometries.

`actuatorSamples` explicitly reports commanded torque **limits**, angles and velocity targets, never measured grip force. `contactSamples` reports separate solver normal impulses (N·s), signed distance (m), normal and impulse/step (N). The latter is not calibrated total grip force. In these fixtures, summed normal impulse/step differs by 23–32% from the independently measured resultant. Do not turn that sum into a grip-force HUD value. The mechanism force gate uses independently calibrated load cells instead.

The load cell is a dynamic 1 kg cheek attached by a physical lock joint to a static anchor. At quasi-static equilibrium, contact resultant equals the joint reaction after subtracting its weight vector. The native adapter is calibrated with a known 1 N lateral impulse train and standard gravity: measured 1.00000005 N lateral and 9.80664968 N vertical. Contact measurement is therefore independent of actuator commands. A reduced-cap experiment reaches 99.5352% of the configured native torque ceiling without exceeding it, establishing that the cap is active rather than merely larger than the motor's ordinary demand.

## Real-Havok results, 2026-09-12

Each obstacle fixture closes at the maximum configured motor target. Run 720 ticks; evaluate quasi-static forces after tick 480. Contact penetration and impact samples cover the entire run. Angles are measured from dynamic bodies.

| Opening | Blocked arm angles (rad) | Peak resultant / arm (N) | Max applied joint-axis torque (N·m) | Max commanded torque limit (N·m) | Max penetration (mm) | Max individual contact impulse (N·s) |
|---|---|---:|---:|---:|---:|---:|
| 80 mm | 0.073815 / 0.073994 | 0.850320 | 0.128672 | 0.423788 | 0.001756 | 0.004607 |
| 120 mm | 0.231500 / 0.231847 | 0.811350 | 0.122399 | 0.429223 | 0.001829 | 0.004459 |
| 180 mm | 0.449326 / 0.449794 | 0.647775 | 0.105072 | 0.456632 | 0.001713 | 0.003882 |

All openings prevent the −0.12 rad closed target. Every quasi-static measured peak is below 4.2 N (105% of the 4 N candidate). This proves a ceiling for the tested fixture; it does **not** demonstrate delivery of 4 N or fidelity to a real machine. Native joint-axis torque/ceiling ratios are 0.304, 0.285 and 0.230 in ordinary fixtures; the deliberately reduced-cap fixture reaches 0.995352.

An applied 0.8 N·m opening load backdrives the arms by 0.818439 / 0.800207 rad and encounters the physical open stops. A supported 1 kg test prize, after closure and transition to hold, falls 4.905657 m over one second when its test support is removed; no claw/prize attachment exists. A 1 µN·s downward impulse wakes the sleeping prize after support removal; it is not a holding aid or scripted movement.

Twenty obstructed close/open cycles at 120 mm opening produce maximum contact penetration 0.001829 mm and maximum head-position drift 0.017769 mm. Each returns to the open target with finite poses/velocities; disposal is idempotent and removes all five claw bodies. No prize reset participates in the cycles.

The maximum **motor target** is 0.5 rad/s; observed first-tick angular speed is 0.740894 rad/s because a finite motor cannot forbid gravity/external loads from producing additional motion. No pose/velocity clamp masks that transient. Impact values above are individual solver contact impulses and are not subject to the quasi-static force assertion.

## Integration boundary

Carriage commands `axis1`, `axis2`, `down`, `up`, `home`, `stop` are implemented using bounded velocity/acceleration, without target-transform teleportation. All directions/limits/return were tested. Peak vector speed is 0.100000015 m/s against 0.1 m/s, peak acceleration 0.400002252 m/s² against 0.4 m/s² (float tolerance). Stop decelerates; interruption **freeze** must instead stop all physics stepping in the future app integration. Joint mechanical support reactions are not motor torque telemetry.

Observations report actual carriage positions/open angles. `prizeSettled` deliberately remains false because this module does not own or inspect the prize; Task 5 must compose that observation from prize physics. No automatic sequence, controller UI, browser validation or deployment is included. Browser and real-iPhone gates remain pending; original-video calibration remains blocked. This passes the Task 3 mechanism feasibility gate only.

## Profile validation

The claw profile is checked against an independent required-field schema before physics allocation. Units, finite ordered ranges, physical domains of values and range endpoints, parameter identities, source-kind/confidence enums and nonempty source references are validated. Self-declared ranges cannot authorize negative dimensions/masses, invalid signed angles or superelastic restitution. Valid negative closed angles and zero restitution remain supported; closing/holding force, angle and travel ordering are checked. Review regression coverage: 29 validation tests, 119 total tests passing; typecheck and lint pass. Physics behavior and mechanism measurements above are unchanged.
