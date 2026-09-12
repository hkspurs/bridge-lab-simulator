# Playable machine implementation decisions

These decisions preserve the material rulings behind the engineering fixture. Each should be revisited when physical evidence contradicts its premise.

| Decision | Why | Cost if wrong |
|---|---|---|
| Define rod-local Z as length, X as width and Y as height; use two support rails at X ±0.08 m and two lower end rails at Z ±0.27 m, Y −0.04 m, yaw 90°. | Provides a coherent four-rod engineering fixture without claiming footage reconstruction. | Replace fixture coordinates after annotation. |
| Treat motor velocity as a requested target, not a guaranteed angular-speed limit under external load. | Finite torque cannot guarantee instantaneous speed against gravity or contact. | Revise the physical governor model without pose correction. |
| Use independently calibrated load-cell reactions for quasi-static force acceptance; keep raw contact impulses separate. | Scalar normal-impulse sums are not total grip force. | Rework instrumentation before claiming force accuracy. |
| Derive the close interval from 0.77 rad travel at 0.5 rad/s plus convergence. | The preliminary 0.65 s estimate cannot complete the engineering fixture's tested motion. | Retune timing from verified footage. |
| Make `hold` retain the prior claw target and stop lock the animated carriage immediately. | Prevents premature closure and stale manual drift while preserving dynamic prize state. | Replace the braking model after hardware timing measurements. |
| Give the playable claw a 0.32 m drop height and use that profile for sequence timing. | The earlier 0.24 m target commanded the solid head into the prize; the isolated claw fixture remains unchanged. | Recalibrate clearance from verified footage. |
| Keep the 5% rod-sliding and 1 mm penetration gates failed; do not widen them. | Measured results exceed the pre-registered limits. | Release waits for a physical-model or engine correction. |
| Restrict PR CI to read-only contents and grant Pages/OIDC writes only to the push-main deploy job. | Verification does not need deployment credentials. | Adjust job permissions if the existing deployment later demonstrates a specific need. |
| Require physical-device and untouched-holdout evidence for validated release. | CI and WebKit automation cannot establish native iPhone behavior or footage fidelity. | Release remains blocked until those inputs are available. |
