# Task 7 — automated interaction and physics acceptance

## Result and release label

**Engineering fixture; acceptance remains blocked.** The physical matrix is implemented against actual Havok, with two failing assertions retained: rod sliding acceleration is 6.069% from force balance (limit 5%), and maximum contact penetration is 1.682 mm (limit 1 mm). No gate is skipped, marked expected-failure, mocked, or assigned a wider tolerance.

Verification below used local implementation commit `70dd588004126fd053dd40f10ded5c3f9224b042`, a clean working tree, Babylon **8.56.2**, Havok **1.3.14**, Node **v24.19.0**, gravity **9.80665 m/s²**, and fixed step **1/120 s**. The four-rod profile is `bridge-lab-playable-v1-engineering-fixture`; the playable claw is `claw-playable-v1-engineering-fixture`. The original `claw-v1-engineering-fixture` remains the isolated mechanism regression fixture.

Local browsers were unavailable. A preceding remote CI run passed all ten Chromium/WebKit cases before the playable drop-height correction; that pass is evidence for the intermediate tree, not a pass for the final implementation. A subsequent remote CI run returned 9/10 browser passes with a WebKit input-readiness race; the correction and scoped verification are recorded below. Fresh CI for that correction remains a root-agent next step. Footage and physical iPhone evidence remain unavailable; this is neither a playable-prototype acceptance pass nor a validated release.

## Committed work

- `10c7ad8`: browser cycles, interruptions, screenshots, traces, read-only snapshot additions, PR verification trigger.
- `0652422`: PR verification receives only `contents: read`; Pages and OIDC writes are scoped to the push-main-only deploy job.
- `70dd588`: quantitative physical matrix, versioned machine-readable reports, separate physics command, test typechecking, and physically justified playable claw clearance.

The CI PR trigger now accepts the foundation-base PR. Deployment still requires a successful verify job and a push to `main`. After failures, the physics, build, browser installation, and browser execution steps continue unless cancelled, retaining the failing job status while collecting independent browser evidence. The artifact upload runs `always()` and retains `physics-reports/`, `playwright-report/`, and `test-results/` for 14 days.

`test:run` executes source regression tests (`vitest run src`, including incumbent source-located Havok tests). `test:physics` executes the dedicated actual-engine acceptance fixtures and writes Vitest JSON. No physics acceptance fixture imports a physics mock. Typechecking now includes browser tests, physics tests, and Playwright configuration.

## Actual final command results

The following commands were executed once as the requested final verification sequence, in this order. A later explicitly requested, bounded spawn-clearance experiment is separately recorded below and was reverted.

| Command | Exit | Actual result |
|---|---:|---|
| `npm run lint` | 0 | `eslint .`; no findings |
| `npm run typecheck` | 0 | `tsc --noEmit`; no errors |
| `npm run test:run` | 0 | 14 files passed; 133 tests passed |
| `npm run test:physics` | 1 | 2 files passed, 1 failed; 23 tests passed, 2 failed |
| `npm run build` | 0 | Vite built in 3.32 s; application chunk 1,172.12 kB, gzip 286.62 kB |
| `npm run test:browser` | 1 | 10 launch failures caused by absent Chromium/WebKit executables; no browser test body ran locally |

Exact relevant test output:

```text
 Test Files  14 passed (14)
      Tests  133 passed (133)
   Duration  2.58s

 FAIL  tests/physics/validation.spec.ts > real Havok quantitative acceptance matrix > rod sliding acceleration is within 5% of force balance
AssertionError: expected 0.06069007482201361 to be less than or equal to 0.05

 FAIL  tests/physics/validation.spec.ts > real Havok quantitative acceptance matrix > sustains 20 complete carriage cycles without NaN, joint escape, growing oscillation or body leaks
AssertionError: expected 0.001681608575842708 to be less than or equal to 0.001

 Test Files  1 failed | 2 passed (3)
      Tests  2 failed | 23 passed (25)
   Duration  3.47s

JSON report written to /workspace/scratch/8146cd73521d/bridge-lab-simulator/physics-reports/tests.json

Error: browserType.launch: Executable doesn't exist at /root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
Error: browserType.launch: Executable doesn't exist at /root/.cache/ms-playwright/webkit-2359/pw_run.sh

  10 failed
```

Build retained the existing advisory that some chunks exceed 500 kB after minification. npm emitted its environment advisory about unknown `http-proxy` configuration. Neither warning caused a failing exit. `git diff --check` passed before the implementation commit. Local browser installation/download was not retried after the previously recorded five CDN timeouts.

Full local command output is available to the root workflow at `/tmp/task7-verification/results.json` and one `.log` per command in that directory. These are scratch verification logs, not committed product files. CI retains reproducible reports and traces as artifacts.

## Physical matrix: measured values and unchanged thresholds

Each experiment writes its metrics **before** asserting. `tests/physics/report.ts` records experiment status/criteria, current commit, working-tree status, source-diff SHA-256, lockfile SHA-256, profile SHA-256, playable-claw SHA-256, sourced drop-height metadata, engine versions, gravity, timestep, and Node version. JSON files are generated under `physics-reports/`; `tests.json` supplies the authoritative test outcomes, including cleanup assertions following the numerical report.

| Experiment | Required acceptance | Final measured result |
|---|---|---|
| Free fall, pre-contact | Displacement and velocity error ≤1%; declared interval away from t=0 | **Pass.** 0.5–1.0 s; displacement 3.6810297966 m vs 3.67749375 m, error 0.096154%; velocity change 4.9032468796 m/s vs 4.903325 m/s, error 0.001593% |
| Static support after settling | Drift ≤1 mm over 10 s; no sustained jitter or increasing energy | **Pass.** After 10 s settling, maximum 3D drift over the next 10 s is 0 m; maximum linear speed 0 m/s; angular speed 1.61e-10 rad/s; energy increase 0 J |
| Friction incline | Sliding onset within 1° of atan(static coefficient) | **Pass.** μs = 0.34; expected 18.778033°, observed 19.028033°; error 0.25° |
| Quasi-static tipping | Force threshold within 5% of analytic moment balance | **Pass.** Actual prize with four mass blocks: predicted 1.6641587315 N, onset 1.6654166667 N; error 0.075590%; support-edge drift 0.003234 mm |
| Blocked claw | Actual closure blocked, torque capped; quasi-static contact force ≤105% of specified peak | **Pass.** Three 80/120/180 mm openings; peak quasi-static forces 0.850320/0.811350/0.647775 N, all ≤4.2 N. Maximum measured torque/cap ratios 0.303623/0.285164/0.230102. Closure stays obstructed. Existing reduced-cap saturation and slip/backdrive tests also pass |
| Rod sliding | Acceleration error ≤5% versus force balance over a declared interval | **Fail.** At t=1/120 through 3/120 s after 0.1 m/s initial motion: acceleration −2.7044722438 m/s² vs −2.549729 m/s²; error 6.069007% |
| Contact penetration | Maximum ≤1 mm at supported profile speeds and geometry | **Fail.** All dynamic/animated bodies monitored over 20 complete cycles: maximum 1.681608576 mm, prize against rod-1 during first manual stage, cycle 1 tick 7 |
| Render-rate independence | At equal ticks: position ≤3 mm, angle ≤1.5°, outcome identical | **Pass.** At 2,400 ticks for 30/60/120 Hz schedules: 0 m position differences; reported quaternion angle 0.015045° for all comparisons, including reference to itself, due to stored float quaternion normalization; all REVIEW/settled with identical prize quaternion components |
| Sustained mechanism operation | 20 cycles without NaN, joint escape, growing oscillation or leaked bodies | **Pass for mechanism stability; shared penetration assertion still fails.** All 20 finish REVIEW; finite prize/rig state; 10 bodies throughout; same prize instance; head/carriage locked-anchor separation ≤0.021199 mm; every terminal arm speed ≤0.05 rad/s. Original 20 obstructed open/close cleanup test passes separately |

The physical suite's sustained-cycle test intentionally also asserts the separate penetration gate, so its test result is red although `sustained-mechanism.json` reports the mechanism-stability criteria as passed. `contact-penetration.json` separately reports the failing penetration criterion.

### Sampling and fixture boundaries

- The free-fall fixture is passive and has no contact surfaces during the declared interval. Its comparison uses the continuous analytic trajectory without subtracting numerical integration error.
- The static-support fixture explicitly disposes the claw and stops the render loop, leaving only the real prize and four rods. Energy includes the world COM gravitational potential and translational/principal-axis rotational kinetic energy. The energy allowance is 1 microjoule; jitter thresholds are 0.005 m/s and 0.05 rad/s, sampled every 1/120 s.
- The incline fixture rotates gravity relative to a fixed apparatus, exactly equivalent to rotating the apparatus relative to vertical gravity. Independent 0.25° trials avoid inherited launch impulses. Onset requires >1 cm displacement and >1 cm/s speed after 2 s. A low, wide box avoids tipping and uses the configured static/dynamic material pair.
- Tipping uses the actual prize convex hull and retained four-block COM/inertia. A physical high-friction test platform and μ=2 prevent sliding. Force at the world composite COM ramps by 0.05 N/s; onset is 0.02 rad tilt. The analytic target is `m*g*halfWidth/comHeight`, computed before the experiment. Support-edge motion, rather than permitted COM displacement during tilt, checks sliding.
- Rod sliding uses the actual prize mass blocks and actual circular rod colliders. An explicitly reported fixture variant sets prize width to 0.17 m and rod length to 0.6 m, both within sourced ranges, so the base reaches both crowns and the analytic normal-force assumption is meaningful. Coasting begins at 0.1 m/s and remains positive throughout the declared short interval. Collision points, normals, normal impulses, rotation and angular velocity are retained to diagnose the 6.069% residual. No coefficient was fitted to force a pass. The early three-tick contact transient remains an unresolved accuracy limitation of this measured fixture.
- Penetration samples **all** dynamic and animated body collision callbacks, not only claw-arm contacts; it includes initial settling and manual travel. It reports signed solver contact distance. Impact at the maximum-penetration event is 0.128747374 N·s; this is not presented as an actuator peak-force measurement.
- The existing claw fixture calibrates native lock-joint impulses against a known 1 N applied force and the cell's weight. Quasi-static clamp force comes from the load-cell resultant after dividing by `dt` and subtracting gravity, over ticks 481–719. Raw solver normal impulses and their sums remain separate observables. Impact impulse/`dt` is a timestep-averaged quantity, not a continuous-time peak guarantee.
- Active tipping and mechanism fixtures do not make passive-energy claims: the force applicator, motor and animated carriage do work. Passive-energy checks are confined to the unpowered support fixture.

## Concrete diagnosis and retained physical correction

### Playable claw head clearance

The original isolated-claw profile lowers the carriage to 0.24 m. With an 0.08 m suspension and 0.03 m head height, the head bottom then reaches 0.145 m. The estimated upright prize extends to roughly 0.2125 m. This commands the solid head into the prize.

The first actual full-cycle experiment measured 9.2286 mm penetration between the prize and suspended head during DROP and about 3.05 mm separation at the head/carriage locked anchor. Arm-only contact monitoring would have missed the worst collision.

`src/config/playableClawProfile.ts` now provides a separately identified, sourced engineering profile with **0.32 m** carriage drop height. Its head bottom is **0.225 m**, giving 12.5 mm clearance above the settled prize top; the 0.16 m arms still overlap the prize vertically. Value, unit, allowed range, source reference, source kind and confidence remain explicit. The isolated claw's 0.24 m fixture is unchanged. The actual scene, initial sequence, and New setup sequence all use `sequenceProfileFromClaw(playableClawProfile)` so travel timing and mechanism geometry agree.

Targeted red-to-corrected experiment command:

```text
npx vitest run tests/physics/validation.spec.ts -t 'sustains'
```

After this physical configuration correction, all 20 cycles finish and the locked-anchor error drops to approximately 0.0212 mm. The head collision is removed; the retained 1.682 mm penetration now occurs at the initial prize/rod contact. No gravity, timestep, torque cap, collider filter, force, or prize pose was scripted to suppress the result.

### Tipping apparatus diagnosis

The first generic `PhysicsShapeBox` apparatus tilted at 3.455833 N against a sharp-box target of 4.903325 N (29.52% error). Its outer AABB was correctly ±50 mm, but reported contact points were around ±35 mm. Installed Havok/Babylon declarations expose no convex-radius setter; using the observed contact span to redefine the target would fit the result rather than validate it.

The accepted tipping experiment therefore uses the implementation's existing beveled convex prize hull and its actual four-block COM/inertia, whose independent moment-balance result passes as recorded above. The primitive-box diagnostic is retained here as an engine contact-shape limitation; it is not presented as a passed sharp-box benchmark. No production collision geometry was changed for this experiment.

### Rejected smaller spawn-gap experiment

After the final verification, the root agent requested one bounded test of the existing 2 mm spawn clearance as a possible cause of initial penetration. The actual playable `createPrize` path was temporarily changed to 0.2 mm clearance, preserving the legacy profile, and the full 20-cycle test above was rerun.

Result: **failure**, maximum penetration **1.801725801 mm**, prize/rod-1 at cycle 1 tick 5; impulse **0.117708415 N·s**. This worsened the original 1.681608576 mm result. The change was reverted, the working tree again matched `70dd588`, and the final-verification metric files were restored from the recorded final-command JSON output. No unproven clearance change ships.

## Browser behavior and read-only APIs

`tests/browser/harness.ts` waits for the actual app, listens **directly** on `[data-testid="bridge-lab-app"]` for the non-bubbling `bridge-lab:snapshot` event, and retains the original immutable event details. It tests that the snapshot and pose values are frozen. It never receives body mutation APIs.

Snapshot fields used: `fixedStepCount`, `phase`, `paused`, `position`, `rotation`, `prizeLinearVelocity`, `prizeAngularVelocity`, `profileId`, `clawAnglesRad`, and contacts. This task adds copied/frozen `carriagePosition` and `carriageLinearVelocity`, plus scalar `prizeInstanceId`, so tests can check carriage locking and prize identity rather than infer them from status text.

Accessible controls are `1 Move right`, `2 Move back`, `Resume`, `Continue`, `New setup`, `Front`, and `Side`.

The two-attempt case holds/releases both axes and asserts the ordered phase sequence through DROP, CLOSE, LIFT, RETURN, OPEN, SETTLE, REVIEW. At Continue it records the immediately preceding snapshot and first READY snapshot, asserting unchanged prize identity and position/angle continuity within measured velocities and the actual tick interval. It then completes a second attempt and checks one DROP per attempt.

Interruption cases cover both manual axes, a second pointer, and automation blur. They assert frozen ticks and prize pose while paused, no stale-release DROP after Resume, unchanged carriage position and zero carriage velocity until a fresh press, and exactly one completion after repeated automation taps.

The harness dispatches **synthetic touch PointerEvents** and emulates capture bookkeeping on the movement buttons because untrusted pointers cannot obtain native capture. The real controls, state machine and Havok world run throughout. This verifies dispatch/ownership semantics, **not native iPhone Safari capture, touch cancellation, gesture handling, or device performance**.

Both Chromium and WebKit use 844×390 touch-capable landscape contexts, device scale factor 3, and 120-second test timeouts. The framing case saves successful `landscape-front.png`, `landscape-side.png`, and `portrait.png` images. Every test retains a trace; snapshot JSON is attached on success and on in-page failures.

### Existing remote browser evidence

The root agent reported a successful intermediate CI run for remote commit `ac1c02c6` (tree matching local `0652422`): 152 source-plus-existing tests, 19 existing physical tests, and **10/10 browser tests passed**; deploy was skipped.

- Run: https://github.com/hkspurs/bridge-lab-simulator/actions/runs/34679218266
- Verify job: https://github.com/hkspurs/bridge-lab-simulator/actions/runs/34679218266/job/103514567653
- Artifact ID: `10293336237`, `acceptance-evidence`, approximately 43 MB.

The connector returned an artifact download URL, but workspace retrieval returned 403. Consequently no actual screenshot inspection is claimed here. The successful framing test and retained artifact are evidence that screenshots were produced. The final implementation, including its changed drop geometry and ordered phase assertion, needs a fresh remote CI run.

## Root next steps

1. Save the final implementation/report commit through the authorized remote workflow and run PR CI. Expect the unchanged physical assertions to keep verification red unless the measured residuals are resolved. Confirm browser execution still completes after the physical failure and inspect its retained snapshots/traces.
2. Retrieve and inspect successful front/side/portrait screenshots when artifact access permits. Record the final remote commit, run, job and artifact IDs separately from the intermediate pass.
3. Keep release status at engineering fixture. Diagnose prize/rod contact penetration and rod sliding accuracy with physical evidence; preserve the 1 mm and 5% gates. The bounded smaller-gap experiment did not resolve penetration.
4. Task 8 must state the footage/holdout and physical-iPhone gates as blocked or pending, with no invented measurements. No deployment or validated-release claim is authorized by these results.


## Review correction — all-joint endurance and browser readiness

This section supersedes the earlier endurance claim based only on head/carriage translation and one instantaneous REVIEW arm-speed sample. Those measurements alone did not establish all-joint integrity or absence of growing oscillation. No physical implementation or acceptance threshold was changed in this correction.

### Every-tick joint observations

The endurance fixture now measures all four joint pairs on **every fixed tick**, including both manual axes, every automatic phase, and the terminal observation window:

- Carriage/head lock: world anchor separation and full relative rotation.
- Head/stem lock: world anchor separation and full relative rotation.
- Both arm hinges: world anchor separation, relative local-Z angle against the configured minimum/maximum limits, and the remaining X/Y swing after decomposing permitted Z twist.

Anchor positions are transformed from the actual joint-local pivots using the observed body quaternions. Relative quaternions are normalized locally for measurement. The existing conservative 1 mm anchor bound applies to each pair. Locked rotation and hinge-limit numerical error are bounded by the sourced `angleToleranceRad = 0.02 rad`; this bound was declared before the experiment. The original head/carriage and entry-to-REVIEW speed measurements are retained as diagnostics, not the sole criteria.

| Joint | Maximum anchor error | Maximum locked rotation error |
|---|---:|---:|
| Carriage/head lock | 0.021199 mm | 0.003794862 rad |
| Head/stem lock | 0.109058 mm | 0.003794864 rad |
| Left arm hinge | 0.111856 mm | 0.004512460 rad |
| Right arm hinge | 0.355604 mm | 0.019851045 rad |

Both hinge angles remain within the configured `[-0.15, 0.68] rad` limits: left `[-0.119857693, 0.650191168]`, right `[-0.119874557, 0.650132656]`; maximum limit violation is 0 rad. The right hinge's locked-axis error is close to the declared 0.02 rad numerical bound and should remain visible in CI evidence; it was not given a larger tolerance after measurement.

### Windowed motion and energy comparison

Each completed attempt remains in REVIEW for **120 additional fixed ticks (1 s)** before Continue. Its existing hold command continues normally. Every sample measures all four dynamic mechanism bodies (head, stem, both arms), recording peak/RMS linear and angular speed, mean/peak kinetic energy, and both arm angle excursions. Kinetic energy includes translation plus rotation in each body's principal-inertia frame with the repository's mass-normalized Havok convention.

Every window must have peak angular speed ≤0.05 rad/s, peak linear speed ≤0.005 m/s, and arm excursion ≤0.02 rad. For all six speed/energy metrics, every later window must remain within 110% of the maximum of the first three windows plus a declared numerical floor; the mean of the final three windows must also remain within 110% of the mean of the first three windows plus that floor. Floors are `1e-4 rad/s`, `1e-5 m/s`, and `1e-10 J`. These comparisons expose growth across cycles as well as motion missed by a single turning-point observation. They compare identically commanded active windows and make no passive-energy conservation claim.

All 20 windows completed. Maximum observed window angular speed is **0.005088314 rad/s**, linear speed **0.000406965 m/s**, kinetic energy **5.450486e-9 J**, and arm excursion **0.000794683 rad**. All six growth comparisons pass. Representative first-three versus last-three means:

| Window metric | First three mean | Final three mean |
|---|---:|---:|
| RMS angular speed | 0.001027460 rad/s | 0.001028525 rad/s |
| RMS linear speed | 0.000082360 m/s | 0.000082475 m/s |
| Mean kinetic energy | 4.522731e-10 J | 4.534488e-10 J |
| Peak kinetic energy | 5.437579e-9 J | 5.434895e-9 J |

The strengthened joint/window criteria pass in this local run; the shared **penetration assertion still fails at exactly 1.681608576 mm**. Twenty cycles retain ten bodies and the same prize instance. The earlier full-matrix sliding failure remains **6.069007% > 5%** and was not rerun or relaxed during this scoped correction.

### WebKit failure and readiness correction

The root agent reported run `34679711714`, job `103515936597`: **9 browser cases passed, 1 WebKit case failed on both attempts**. Both ordinary two-attempt cycles passed. In the second-pointer interruption case, the test clicked Resume, immediately dispatched a synthetic hold, then remained at MOVE_AXIS_1 instead of reaching MOVE_AXIS_2.

- Run: https://github.com/hkspurs/bridge-lab-simulator/actions/runs/34679711714
- Job: https://github.com/hkspurs/bridge-lab-simulator/actions/runs/34679711714/job/103515936597

Code inspection identifies a harness readiness race: Resume dispatches immediately, but the real controls become enabled only on the next authoritative snapshot. Playwright `dispatchEvent` does not perform an enabled-state actionability wait; the disabled control correctly ignores an early synthetic pointerdown. `hold()` now waits for its accessible movement button to be enabled before dispatching that pointerdown. This is state synchronization, with no blind delay, synthetic physics response, or application gating change. Remote CI must verify the fix; no new local browser execution or download was attempted.

### Scoped verification and remaining status

```text
npm run test:physics -- -t 'sustains 20'
Exit 1
 Test Files  1 failed | 2 skipped (3)
      Tests  1 failed | 24 skipped (25)
   Duration  2.78s
AssertionError: expected 0.001681608575842708 to be less than or equal to 0.001
```

The 24 skipped tests are excluded by the requested test-name filter; no test was changed to `.skip` or expected failure. The new all-joint and window criteria are reported before the unchanged hard penetration assertion. JSON reports and the full scoped output are available in `physics-reports/` and `/tmp/task7-review-endurance.log` respectively.

`npm run typecheck` and `npm run lint` both pass after correction. The first typecheck caught an inferred array type and was fixed with an explicit cycle/window result type. The first lint encountered generated Playwright trace-viewer JavaScript from the prior browser run (3,965 generated-code errors); ESLint now ignores `playwright-report/`, `test-results/`, and `physics-reports/` alongside its existing generated-output exclusions. Source/test lint rules remain unchanged and artifacts are retained. `git diff --check` passes.

No broader tests, browser retries, or physical tuning experiments were added in this review correction. Release remains **engineering fixture / acceptance blocked**, pending resolution of the unchanged physical failures and a fresh browser CI result.
