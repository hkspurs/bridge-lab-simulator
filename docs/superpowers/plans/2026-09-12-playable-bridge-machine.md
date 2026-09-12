# Playable Four-Rod Bridge Machine Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not start implementation from a planning-only request.

**Goal:** Deliver a four-rod, finite-torque, two-button bridge machine that completes a full claw cycle and allows the next attempt without resetting the prize.

**Architecture:** Retain Babylon.js/Havok, sourced profiles, composite mass properties and the fixed 120 Hz clock. Introduce independent rod descriptions, a physical claw adapter, a pure sequence controller and cancellation-safe pointer input. Advance commands, physics and observations in a single fixed-step pipeline; UI and diagnostics consume read-only snapshots.

**Tech Stack:** Existing locked TypeScript, Vite, Babylon.js, Havok, Vitest and Playwright dependencies. Inspect installed APIs before implementation; do not assume a particular motor or contact-reporting API exists.

**Spec:** `docs/specs/2026-09-11-japanese-bridge-crane-simulator-design.md`, amended by the user's four-rod review and the milestone decisions below.

**Baseline:** `hkspurs/bridge-lab-simulator`, `feature/physics-foundation`, reviewed commit `8938c934878f741f7dff260955fb86125f675131`. This is a proposed next-phase plan, not an implementation or test report. Reconcile branch changes before execution.

## Global constraints and milestone decisions

- Primary target: iPhone Safari, landscape; desktop secondary.
- Gravity remains `9.80665 m/s²`; fixed physics step remains `1/120 s`. Slower rendering never changes physical parameters or timestep.
- Retain the prize's existing 2–4 internal mass-block model and shared COM/inertia derivation.
- Exactly four independently configured rods in the new playable profile. Keep the old two-cylinder profile as a named regression fixture, never silently reinterpret it as the real machine.
- Every reachable solid structure has a collider. Rod endpoints, brackets and claw thickness matter. Decorative inaccessible scenery can remain visual-only.
- No hidden supports, magnets, scripted prize movement, forced flip poses or probabilistic success.
- Finite claw actuator torque; contact may obstruct closure or produce slip. A torque cap does not itself guarantee a peak contact-force cap during impact.
- Every physical scalar retains value, unit, range, source reference and confidence. Unconfirmed rod geometry and materials stay estimated; do not assert four parallel, flat-topped rubber rods.
- Proposed control policy: button 1 holds rightward travel; release locks axis 1. Button 2 holds travel away from the player; its deliberate release starts the automatic cycle. Profile mirroring is fixed before play.
- Add OPEN after RETURN to release any held prize at home, then SETTLE and REVIEW. A Continue action enters READY without recreating the prize. Explicit New setup is the only ordinary prize reset.
- Interruptions freeze simulation and clear held input. Resume is explicit, resets wall-time accumulation and requires a fresh press for manual travel. Resume never treats cancellation as release.
- This milestone includes functional front/side cameras and a collapsible diagnostic panel. Full replay, A/B comparison, slow-motion playback, sound and final arcade art remain later milestones; they are not removed from the full product spec.
- Execution authorized by the user’s subsequent “Proceed”. Deployment remains conditional on the acceptance gates below.

## Current playable-preview publication decision

The subsequent redeployment still showed the old calibration scene without controls. The user explicitly reported this failure of the requested playable delivery. Publish the existing playable engineering preview after source, bridge/claw mechanism, build and browser checks; retain full quantitative physics as a separate visible acceptance result. No physical threshold is changed. The site must show its engineering-preview status, and the deployed URL must complete two attempts. See `docs/validation/engineering-preview-release.md`. This supersedes the earlier publication prerequisites below for the engineering preview only; validated physical release remains incomplete.

## Engineering deployment authorization — 2026-09-12

The user's later instruction, “修正1後commit and deploy”, authorizes an engineering deployment after the three failed physical criteria are fixed and automated verification passes. Recording calibration, untouched holdout, real-iPhone acceptance and visual inspection remain separate, unverified evidence requirements for a validated release. They no longer block this specifically authorized engineering deployment. Historical execution status below records the earlier review; current evidence is maintained in `docs/validation/final-review-status.md`.

## Evidence and release labels

Use three separate completion labels:

1. **Engineering fixture:** geometry may be estimated; useful for building and testing mechanisms.
2. **Playable prototype:** complete controls, mechanism gates and browser tests pass; real-device validation is explicitly reported as passed or pending.
3. **Validated release:** all physical, footage holdout and real-iPhone gates pass. Only this level satisfies the final acceptance in this plan.

The original source recording is named `ScreenRecording_09-11-2026 22-47-23_1.mp4` in the research baseline. Its bytes were not inspected for this plan. Retrieve it at execution and verify the recorded SHA-256 before annotating. If unavailable, keep the four-rod development fixture estimated and mark the video-specific gate blocked. Do not fabricate coordinates, dimensions or timestamps.

## File and responsibility map

| Files | Change and responsibility |
|---|---|
| `src/config/types.ts`, `baselineProfile.ts`, `validateProfile.ts` and their existing tests | Versioned four-rod and claw parameters, validation and legacy profile compatibility |
| `src/config/playableProfile.ts` | New estimated or annotated four-rod profile; no silent replacement of v0.1 |
| `src/physics/createBridge.ts`, `createPhysicsScene.ts`, existing scene tests | Rod-driven colliders and physical-world wiring |
| `src/physics/createClaw.ts`, `clawActuator.ts` and colocated tests | Dynamic claw bodies, joints and finite torque control |
| `src/physics/stepSimulation.ts` and colocated tests | Commands → physics → observations, once per fixed tick |
| `src/crane/types.ts`, `CraneSequence.ts`, `CraneSequence.test.ts` | Engine-independent state machine and contracts |
| `src/input/createControls.ts`, `createControls.test.ts` | Pointer ownership, release versus cancellation and lifecycle events |
| `src/app/createApp.ts`, `styles.css`, `createApp.test.ts` | Mount controls, status, Resume, Continue and New setup |
| `src/app/createCameraViews.ts`, `createCameraViews.test.ts` | Front/side camera presets and switching restrictions |
| `src/diagnostics/createDiagnostics.ts` and existing tests | Collapsible, read-only sourced-parameter and mechanism observations |
| `tests/physics/bridge.spec.ts`, `claw.spec.ts`, `validation.spec.ts` | Real Havok experiments, not only mocks |
| `tests/browser/playable-cycle.spec.ts`, `interruption.spec.ts` | End-to-end pointer and complete-cycle tests |
| `playwright.config.ts`, `.github/workflows/ci.yml`, `package.json` | WebKit, experiment command and retained reports |
| `docs/research/four-rod-annotations.md`, `docs/validation/playable-machine.md` | Evidence ledger and measured acceptance results |
| `docs/specs/2026-09-11-japanese-bridge-crane-simulator-design.md` | Align rods, next-attempt transition and interruption policy |

## Shared interface decisions

New contracts below are implementation targets, not claims about current APIs. Keep existing sourced-parameter types and make the new playable profile a versioned discriminated variant.

```ts
type Vec3 = Readonly<{ x: number; y: number; z: number }>;
type Quat = Readonly<{ x: number; y: number; z: number; w: number }>;
type Phase = 'READY' | 'MOVE_AXIS_1' | 'MOVE_AXIS_2' | 'DROP'
  | 'CLOSE' | 'LIFT' | 'RETURN' | 'OPEN' | 'SETTLE' | 'REVIEW'
  | 'PAUSED' | 'FAULT';
type Axis = 1 | 2;
type InputEvent =
  | { type: 'press' | 'release'; axis: Axis }
  | { type: 'cancel' | 'resume' | 'continue' };
type RigObservation = Readonly<{
  atDropLimit: boolean; atLiftLimit: boolean; atHome: boolean;
  openReached: boolean; prizeSettled: boolean; invalidPhysics: boolean;
}>;
type RigCommand = Readonly<{
  travel: 'stop' | 'axis1' | 'axis2' | 'down' | 'up' | 'home';
  claw: 'open' | 'close' | 'hold';
}>;
type ClawRig = {
  command(value: RigCommand): void;
  beforeStep(dt: number): void;
  observe(): RigObservation;
  dispose(): void;
};
```

`CraneSequence(profile)` exposes `dispatch(event)`, `tick(dt, observation): RigCommand`, and read-only `phase`. Physics snapshots include fixed tick, phase, prize pose/velocities, actual/target claw angles, actuator torque, contacts when available, and profile ID. Freeze/copy values at the boundary; no UI access to body mutation methods.

For rod entries, use stable IDs `rod-1` through `rod-4`; sourced center coordinates, sourced orientation angles with an explicit rotation convention, sourced length, a discriminated circular/rounded-rectangular cross-section, material ID, contact coefficients and evidence references. Convert configuration orientation to a normalized quaternion once. Engine world axes are X right, Y up, Z depth; explicitly map the research box-local Z-up convention instead of relabelling its mass coordinates.

## Task 1: Reconcile evidence, specifications and four-rod schema

**Interfaces:** Produces the new playable profile variant and four independent rod entries; consumes the existing sourced-parameter and validation contracts.

- [ ] Inspect branch history, repository instructions, existing profile types and installed dependency versions. Record the execution commit in the validation document.
- [ ] Retrieve the source recording, verify its checksum and annotate visible rod endpoints, occlusions and contacts on several frames. Record source/time/frame, image coordinates, inferred role, confidence and scale limitations for each rod. Occlusion is unknown evidence, not a missing collider.
- [ ] Amend the spec with the milestone decisions above and a separate uncertainty ledger. Preserve original research values as historical estimates; correct the old two-rod scope without rewriting its provenance.
- [ ] Add failing schema tests to `src/config/validateProfile.test.ts`: three rods rejected; duplicate IDs rejected; non-positive lengths rejected; unsupported cross-section rejected; empty sources rejected; dynamic friction above static friction rejected. Add a regression asserting v0.1 retains its original two-rod meaning.
- [ ] Run `npm run test:run -- src/config` and confirm these fail for the intended missing behavior.
- [ ] Implement the versioned profile schema and fixture. Use the legacy 0.45 m only as an explicitly low-confidence engineering estimate, with a documented sensitivity range of 0.30–0.60 m, not as a measured dimension. Establish other uncertain fixture values from annotation where available and label each remaining engineering choice.
- [ ] Re-run the config tests and typecheck. Commit `feat: define sourced four-rod playable profile`.

**Gate:** Four independently editable entries; evidence distinguishable from estimates; no claim that source video geometry is verified without inspecting its bytes.

## Task 2: Build collision-complete bridge geometry

**Interfaces:** Preserve `createBridge(scene, profile)` for callers, dispatching on profile version. Produce four static rod meshes/bodies for the playable variant; use the same geometry description for rendering and collision.

- [ ] Add actual-engine tests in `tests/physics/bridge.spec.ts`: all four rods have colliders; moving or rotating one changes only that rod; contact at either endpoint works; a falling probe interacts with each reachable bracket.
- [ ] Run the new tests with the repository's real Havok initialization. Configure `test:physics` as `vitest run tests/physics` in `package.json`; ensure these tests load WASM rather than mocking bodies.
- [ ] Replace the fixed `[-1, 1]` generator for the new profile. Circular rods use cylinders; rounded rectangular rods use supported convex geometry matching the visible outline. Inspect installed shape APIs before choosing the adapter. Add no invisible support surface.
- [ ] Update the scene's current static body array to include all new reachable bodies. Retain ownership/disposal and cancellation behavior.
- [ ] Sweep rod length across the documented range and record support/end-fall changes. Keep all existing mass/clock regression tests passing.
- [ ] Commit `feat: build collision-complete four-rod bridge`.

**Gate:** Count, position, direction, cross-section, endpoints and visible/collision alignment verified independently. Box support stability meets the matrix below.

## Task 3: Prove finite-torque claw feasibility before sequencing

**Interfaces:** `createClaw(scene, profile): ClawRig`; `clawActuator.ts` owns bounded angular control. Export actuator samples separately from contact samples.

- [ ] Inspect locked Havok/Babylon joint, motor, impulse and contact-reporting interfaces. Document units and observability. If physical motor limiting or meaningful force measurement is unavailable, stop mechanism integration and report that concrete limitation; do not substitute angle animation or fabricated force telemetry.
- [ ] Add a pure torque-law test and real-engine empty-close, fixed-obstacle and external-load fixtures.

```ts
// clawActuator.test.ts: clampTorque is introduced by this task.
expect(clampTorque(10, 0.8)).toBe(0.8);
expect(clampTorque(-10, 0.8)).toBe(-0.8);
expect(clampTorque(0.2, 0.8)).toBe(0.2);
```

- [ ] Confirm the tests fail before implementation.
- [ ] Implement a dynamic suspended head and two dynamic claw arms with physical joints, finite mass/inertia, angular limits and thick colliders. Drive the carriage with bounded velocity/acceleration; never teleport a collidable claw through the prize.
- [ ] Implement bounded control, using an engine-limited motor when its units and semantics are verified, otherwise explicit equal-and-opposite joint-axis torques on dynamic bodies:

```ts
export function clampTorque(requested: number, limit: number): number {
  if (!Number.isFinite(requested) || !Number.isFinite(limit) || limit < 0)
    throw new Error('Invalid torque input');
  return Math.max(-limit, Math.min(limit, requested));
}
// Controller request: kp * angleError - kd * angularSpeed.
// kp, kd and torque limit belong to the sourced claw profile.
```

- [ ] Convert candidate force curves with the actual perpendicular lever arm: torque = force × moment arm. The research's 4 N peak and 2.5 N holding force are low-confidence initial values, not universal measured limits. Separate closing and holding phases and bound both.
- [ ] Run obstacle tests at several openings and at the profile's maximum closing speed. Log commanded torque, actual angle, penetration and separately measured contact force. Use quasi-static load tests for the 5% force gate; report collision impulses separately.
- [ ] Apply an external opening load above holding capacity and demonstrate back-driving/slip without attachment constraints between claw and prize. Verify stability and cleanup over 20 cycles.
- [ ] Commit `feat: add experimentally verified finite-torque claw` only after mechanism gates pass.

**Gate:** Obstruction prevents reaching the target; no pose forcing; bounded torque; measurable quasi-static force within 5%; overload can slip; penetration ≤1 mm. Unavailable measurement is a blocked test, not a pass.

## Task 4: Implement the complete attempt state machine

**Interfaces:** Introduce `src/crane/types.ts` contracts above and `CraneSequence`. Produce commands only; never mutate rigid bodies.

| State | Exit condition | Next state |
|---|---|---|
| READY | First valid button-1 press | MOVE_AXIS_1 |
| MOVE_AXIS_1 | Deliberate button-1 release | MOVE_AXIS_2, stationary until press |
| MOVE_AXIS_2 | Deliberate release after accepted button-2 press | DROP |
| DROP | Valid configured travel/contact-stop condition | CLOSE |
| CLOSE | Profile closure interval plus dwell elapsed | LIFT, even if claw obstructed |
| LIFT | Lift limit reached | RETURN |
| RETURN | Home reached | OPEN |
| OPEN | Opening reached | SETTLE |
| SETTLE | Low prize velocity sustained, or settle timeout | REVIEW |
| REVIEW | Continue | READY, same prize body/state |
| Active state | Cancel/interruption | PAUSED, remembered phase |
| PAUSED | Explicit Resume | Remembered phase, no held pointer |
| Any active state | Invalid numeric state or travel timeout | FAULT |

- [ ] Write sequence tests in `src/crane/CraneSequence.test.ts` for the table and the representative cancellation case:

```ts
const sequence = new CraneSequence(profile);
sequence.dispatch({ type: 'press', axis: 1 });
sequence.dispatch({ type: 'release', axis: 1 });
sequence.dispatch({ type: 'press', axis: 2 });
sequence.dispatch({ type: 'cancel' });
expect(sequence.phase).toBe('PAUSED');
sequence.dispatch({ type: 'resume' });
expect(sequence.phase).toBe('MOVE_AXIS_2');
// Subsequent tick must command stop until a new accepted press.
```

- [ ] Run `npm run test:run -- src/crane` and confirm expected failure.
- [ ] Implement transitions driven by fixed simulation time and observed limits. Repeated presses, out-of-order axis input and release without an accepted press are ignored. At a travel limit stop motion but wait for deliberate release.
- [ ] Add sourced machine travel bounds and timing. Use the existing research close/dwell estimates initially. Set travel fault timeouts from maximum distance / minimum configured speed plus 2 s; use a documented 5 s settle timeout. Timeout proceeds to REVIEW with “still moving” status, without freezing or relocating the prize.
- [ ] Define settling as linear speed <0.005 m/s and angular speed <0.05 rad/s for 0.5 simulation seconds. Label these as numerical workflow thresholds, not measured machine settings.
- [ ] Test obstructed close still lifts, return opens, continued attempts preserve the prize, cancellation never initiates DROP and faults require explicit recovery.
- [ ] Commit `feat: implement complete two-button claw sequence`.

## Task 5: Integrate one fixed-step physical pipeline

**Interfaces:** `stepSimulation(dt, sequence, rig, executePhysics)` in `src/physics/stepSimulation.ts`; consumes the sequence and ClawRig contracts. Extend scene snapshots with read-only mechanism state.

- [ ] Add tests counting exactly one physics step per clock callback, command application before physics and observations after physics. Add a real-engine two-attempt fixture recording prize body identity and pose across Continue.
- [ ] Run the tests and confirm the missing integration fails.
- [ ] Wire each tick: read prior observation → sequence tick → rig command → actuator update → engine executeStep over all active bodies → publish observation/snapshot. Ensure render still cannot advance physics a second time.
- [ ] Pause the clock on interruption. Resume discards elapsed hidden wall time and clears any accumulator remainder that could create an unintended control tick. Preserve physical pose and velocities, restoring no stale pointer state.
- [ ] Define New setup as an explicit world reset; keep Continue as controller reset only. Detect an entirely fallen prize with a read-only outlet sensor for status; detection must never cause falling. Offer New setup when the prize is out of reach.
- [ ] Test 30/60/120 FPS schedules using inputs at the same fixed ticks, not wall-clock pointer timing. Report dropped wall time independently.
- [ ] Commit `feat: integrate repeatable physical claw attempts`.

## Task 6: Add safe controls and the playable interface

**Interfaces:** `createControls(root, dispatch): { dispose(): void }`; `createCameraViews(scene): { select(view: 'front' | 'side'): void; dispose(): void }`. Application decides when view switching is allowed.

- [ ] Add DOM tests for pointer ownership, cancel versus release, button enablement and disposal. Add cases for lost capture, pointer leaving the button, second finger, blur, orientation change and hidden document.
- [ ] Confirm tests fail; implement one accepted pointer ID per active press and explicit press/release/cancel events. On cancellation clear ownership before releasing capture. A normal pointerup clears ownership before lostpointercapture arrives, preventing accidental double cancellation.
- [ ] Ignore unrelated pointer IDs. A second finger cannot start the other axis. Suppress long-press context menu/selection on controls. Use touch-action rules narrowly enough to preserve diagnostic-panel scrolling.
- [ ] Create labelled large controls (minimum 64 CSS px, respecting safe areas), phase text, Resume, Continue and New setup. Show buttons as disabled during automatic movement and explain the active stage.
- [ ] Add front/side presets, permitted before manual movement; remove unrestricted camera dragging from normal play. Add collapsible diagnostics with profile confidence, actual/target claw angles and measured versus commanded quantities clearly identified.
- [ ] Test landscape/portrait layouts and app disposal. Ensure collapsing diagnostics cannot affect simulation.
- [ ] Commit `feat: add touch-safe playable machine interface`.

## Task 7: Automate interaction and physics acceptance

**Interfaces:** Browser tests use accessible button names and read-only snapshots. Engine experiments emit machine-readable metrics plus profile/commit/engine versions.

- [ ] Add Chromium and WebKit Playwright projects with touch-capable landscape viewports. Keep actual-engine integration tests separate from mocked unit tests. Update CI to install both browsers and retain failing traces and physics reports.
- [ ] Implement full-cycle browser tests: hold/release button 1 → hold/release button 2 → observe every automatic phase → Continue → complete second attempt. Assert prize continuity, not just status text. Use Playwright touch input support or a controlled PointerEvent test harness for automated multi-pointer cases; explicitly record the limits of synthetic events.
- [ ] Add browser interruption cases at both manual axes and during automation. Assert no unexpected DROP after cancel/resume, no latched travel and no duplicate cycle after repeated taps.
- [ ] Implement and run the following physical matrix against actual Havok. A mock that returns expected contact data cannot satisfy these gates.

| Experiment | Acceptance |
|---|---|
| Free fall, pre-contact | Displacement and velocity error ≤1%; compare over a declared interval away from t=0 |
| Static support after settling | Drift ≤1 mm over 10 s; no sustained jitter or increasing energy |
| Friction incline | Sliding onset within 1° of atan(static coefficient) |
| Quasi-static tipping | Force threshold within 5% of the fixture's analytic moment balance |
| Blocked claw | Actual closure blocked, torque capped; quasi-static contact force ≤105% of specified peak |
| Rod sliding | Acceleration error ≤5% versus force balance over a declared interval |
| Contact penetration | Maximum ≤1 mm at supported profile speeds and geometry |
| Render-rate independence | At equal simulation ticks: position difference ≤3 mm, angle ≤1.5°, outcome identical |
| Sustained mechanism operation | 20 consecutive cycles without NaN, joint escape, growing oscillation or leaked bodies |

- [ ] Keep impact force reports separate from actuator force validation; document sampling and impulse-to-force conversion. Check passivity only in passive fixtures or include actuator/carriage work in the energy balance.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run test:physics`, `npm run build`, `npm run test:browser`. Record actual outputs rather than checking plan boxes based on expected results.
- [ ] Commit `test: gate playable cycles and engine physics`.

## Task 8: Calibrate footage and verify real iPhone

**Files:** `docs/research/four-rod-annotations.md`, `docs/validation/playable-machine.md`, versioned calibration fixtures under `tests/fixtures/`.

- [ ] Before tuning, reserve an independent complete claw attempt as holdout; record checksum/time interval and why it was not used for fitting. A segment already inspected to tune geometry or physics is not an untouched holdout.
- [ ] Calibrate in order: geometry → mass/COM → contact friction → joint geometry/path → force curve → restitution/damping. Keep V2 and V3 on one parameter set, changing only the measured landing input for the paired comparison. If their initial states differ materially, record that limitation rather than claiming the controlled comparison succeeded.
- [ ] Require V2 failure and V3 observed rotation direction/diagonal pose. Pre-register measurable video tolerances: projected center error ≤5% of visible box height, orientation error ≤5° where projection permits measurement, event timing error ≤0.10 s on continuous footage. These are proposed engineering acceptance thresholds, not existing measured accuracy. Account for camera motion and annotation uncertainty; unobservable quantities remain untested.
- [ ] Freeze the profile and run the holdout once. Require correct translation/rotation direction and observed success/failure. Failure prompts a new calibration version and a new untouched holdout; do not retune on the holdout and retain its label.
- [ ] Run real iPhone Safari acceptance, recording device, iOS/Safari version, commit and profile: landscape holds/releases, slide-out, second finger, long press, rotation, App switch and Resume during both axes and automatic motion; then 10 minutes of repeated attempts.
- [ ] Record frame-time distribution, dropped simulation time, visible jitter and warm-device behavior. Aim for 60 FPS; any sustained period below 30 FPS fails the performance gate. Reduce visual workload, never physical frequency or forces.
- [ ] If no physical iPhone or suitable holdout is available, explicitly mark the relevant acceptance blocked. WebKit emulation is not a substitute for the physical-device check.
- [ ] Commit `docs: record calibration and iPhone acceptance evidence` with actual measurements and remaining limitations.

## Recorded progress (2026-09-12)

| Task | Status | Basis |
|---|---|---|
| 1–6 | **Implemented and review complete** | Four-rod schema/geometry, finite-torque claw, sequence, fixed-step integration, and interface are committed. Recording-derived geometry remains blocked and estimated. |
| 7 | **Implementation complete; acceptance failed** | Final software review is clean at `ccc8c87`. Current local physics is 26 pass / 2 fail: sliding 6.069% > 5%, penetration 1.682 mm > 1 mm, and locked arm-axis rotation 0.020458514 rad > 0.02 rad. Exact-tree CI run 34681268756 passed lint, typecheck, build, 135 source tests, and 10/10 browser cases; physics remained 26 pass / 2 fail and deploy was skipped. |
| 8 | **Feasible documentation complete; external tests blocked** | Recording, untouched holdout and physical iPhone were unavailable. No calibration or device measurement was run. Reservation and device-record fixtures are present for future evidence. |
| 9 | **Review complete; release blocked** | Whole-branch software review is clean. No merge or deployment while physical, footage, holdout and device gates remain failed or blocked. |

## Task 9: Review and deploy the accepted version

- [ ] Review the implementation against the user's seven review findings and every matrix row. Keep full-product replay/art/audio milestones listed separately so this release is not mistaken for the entire original specification.
- [ ] Confirm CI and real-device/holdout evidence refer to the exact proposed release commit and profile. Run extra tests only for changes after that evidence was collected.
- [ ] Inspect the repository's actual hosting workflow and deployment target before publishing. Use its existing provider and access settings; do not invent a new hosting destination.
- [ ] When deployment is authorized, publish that accepted commit. Verify the deployed URL loads its assets and supports two consecutive complete attempts; report live commit/profile and any difference from the tested build.
- [ ] Preserve the previous deployment for rollback. Roll back if the deployed build fails the interaction smoke test; retain the failed build's diagnostics.

## Completion checklist

- [ ] Four independently sourced/estimated rod descriptions; all reachable structures collide.
- [ ] Finite-torque claw obstruction, slip and stability experimentally demonstrated.
- [ ] Two real hold/release controls complete the entire cycle and permit another attempt.
- [ ] Continue preserves prize pose, velocities and body identity; reset is explicit.
- [ ] Cancel, blur, orientation and App changes cannot accidentally trigger a drop.
- [ ] Front/side views and collapsible diagnostics usable on iPhone.
- [ ] Numeric engine gates, both browser projects and real iPhone evidence pass.
- [ ] V2/V3 calibration and an untouched holdout pass under the documented criteria.
- [ ] Estimates remain labelled; measured accuracy is never inferred from a successful build.

## Source references

- [Reviewed source branch](https://github.com/hkspurs/bridge-lab-simulator/tree/8938c934878f741f7dff260955fb86125f675131)
- [Existing physics-foundation plan](https://github.com/hkspurs/bridge-lab-simulator/blob/8938c934878f741f7dff260955fb86125f675131/docs/superpowers/plans/2026-09-11-physics-foundation.md)
- [Design specification](https://github.com/hkspurs/bridge-lab-simulator/blob/8938c934878f741f7dff260955fb86125f675131/docs/specs/2026-09-11-japanese-bridge-crane-simulator-design.md)
- [Parameter baseline and original tolerance matrix](https://github.com/hkspurs/bridge-lab-simulator/blob/8938c934878f741f7dff260955fb86125f675131/docs/research/Japanese_Bridge_Crane_Physics_Parameter_Baseline_v0.1.md)

Execution order is Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Task 3 is the mechanism feasibility gate: do not wire automatic grabbing until it passes. This plan was self-reviewed for review coverage and contract consistency; implementation tests have not been run as part of planning.
