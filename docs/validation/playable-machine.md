# Playable bridge-machine validation

## Release status

| Item | Status | Evidence |
|---|---|---|
| Evidence label | **Engineering fixture** | Four independently configured rods use low-confidence estimates; this is not a recording reconstruction. |
| Playable prototype | **Failed** | Three criteria fail within two physics tests. See [Task 7 report](task-7-report.md). |
| Validated release | **Blocked** | No verified recording, untouched holdout, or physical-iPhone run is available. |
| Deployment | **Not authorized** | Task 9 requires all failed and blocked gates to pass for one exact commit and profile. |

The reviewed implementation is local commit `ccc8c87`, profile `bridge-lab-playable-v1-engineering-fixture`. The historical `bridge-lab-v0.1` two-cylinder fixture remains separate. The playable fixture has four distinct estimated rod entries with mixed cross-sections and orientations; it must not be described as four parallel, flat-topped rubber rods.

## Evidence matrix

| Gate | Result | Evidence or missing input |
|---|---|---|
| Source recording and annotations | **Blocked / NOT RUN** | `ScreenRecording_09-11-2026 22-47-23_1.mp4` was unavailable. Its recorded baseline digest `052bb609404b0f395aead7c5c00d180cc75a0e7ad742f82d2edf967cf79db6db` is unverified; no bytes or frames were inspected. See [four-rod ledger](../research/four-rod-annotations.md). |
| Finite-torque claw | **Passed for engineering fixture** | Actual-engine obstruction, torque, quasi-static force, slip, and endurance evidence: [claw feasibility](claw-feasibility.md) and [Task 7 report](task-7-report.md). |
| Automated controls and cycles | **Passed on current exact tree** | Intermediate [run 34679218266](https://github.com/hkspurs/bridge-lab-simulator/actions/runs/34679218266) passed 10/10 browser cases for remote `ac1c02c6` / local tree `0652422`. Later [run 34679711714](https://github.com/hkspurs/bridge-lab-simulator/actions/runs/34679711714) passed 9/10 for remote `cde762ad` / local tree `70dd588`, exposing a WebKit synthetic-input readiness race. Commit `336e28c` has the reviewed correction; [run 34680490442](https://github.com/hkspurs/bridge-lab-simulator/actions/runs/34680490442) for remote `882e7c29`, exact local tree `336e28c`, passed 10/10 Chromium/WebKit cases. Its verify job is [103518123189](https://github.com/hkspurs/bridge-lab-simulator/actions/runs/34680490442/job/103518123189); artifact `10294067864` (`acceptance-evidence`, 40.98 MB) expires 2026-09-26. Physics remained red at the same two gates; deploy was skipped. Current [run 34681268756](https://github.com/hkspurs/bridge-lab-simulator/actions/runs/34681268756), job [103520221186](https://github.com/hkspurs/bridge-lab-simulator/actions/runs/34681268756/job/103520221186), tested remote `22499d7e` / exact tree `ccc8c87`: 10/10 Chromium/WebKit passed in 56.8 seconds; artifact `10294019034` expires 2026-09-26; deploy was skipped. |
| Screenshot inspection | **Blocked / NOT RUN** | Artifact retrieval returned 403. Screenshot production is recorded, but no human visual inspection is claimed. |
| Rod sliding ≤5% error | **Failed** | Measured error **6.069%**; tolerance unchanged. |
| Contact penetration ≤1 mm | **Failed** | Measured maximum **1.682 mm**; tolerance unchanged. |
| Locked arm-axis rotation ≤0.02 rad | **Failed** | Current 20-cycle maximum **0.020458514 rad**; tolerance unchanged. All cycles still reach REVIEW with finite state, stable body identity/count, and bounded residual motion. |
| Other Task 7 physics criteria | **Passed** | Current local actual-Havok result is 26 passed / 2 failed tests, with three failed criteria inside the two failing tests. See [final review status](final-review-status.md) and [Task 7 report](task-7-report.md). |
| V2/V3 comparison | **Blocked / NOT RUN** | No frames or measured landing inputs were available; no fitting occurred. |
| Untouched holdout | **Blocked / NOT RUN** | No suitable complete untouched attempt was available. Use `tests/fixtures/calibration/holdout-reservation.v1.json` before future tuning. |
| Physical iPhone Safari | **Blocked / NOT RUN** | No physical iPhone was available. WebKit automation is not a substitute. Use `tests/fixtures/device/iphone-safari-acceptance.v1.json`. |
| Device performance | **Blocked / NOT RUN** | Requires the physical-device run. Target 60 FPS; sustained below 30 FPS fails. Physics remains `9.80665 m/s²` at `1/120 s`. |

## Pre-registered footage protocol

Calibrate in this order: geometry → mass/COM → contact friction → joint geometry/path → force curve → restitution/damping. V2 and V3 must share one parameter set and differ only in measured landing input. Record a material initial-state difference instead of claiming a controlled comparison.

The proposed engineering tolerances remain: projected center error ≤5% of visible box height; orientation error ≤5° where projection permits measurement; event timing error ≤0.10 s on continuous footage. Record camera motion and annotation uncertainty. Unobservable quantities remain untested. V2 must reproduce failure; V3 must reproduce the observed rotation direction and diagonal pose.

Before fitting, reserve an independent complete attempt with the holdout fixture, including its verified source checksum and interval. After calibration, freeze the profile and run the holdout once. Do not retune on it. A failure requires a new calibration version and another untouched holdout while retaining the failed record.

Resolve all three failed physical criteria without widening tolerances, verify the recording, complete V2/V3 and holdout validation, and run physical iPhone acceptance. All release evidence must identify the same proposed commit and profile before Task 9 review or deployment.

## Final-review fix wave: latest local physical evidence

The final-review control fixes change the 20-cycle trajectory by locking each
released manual carriage axis in the first subsequent fixed tick. A fresh local
actual-Havok matrix therefore supersedes the earlier physical behavior only for
this working tree; the historical exact-tree CI results above remain unchanged.
It reports 26 passing and two failing tests. Rod sliding remains
**6.069007% > 5%**, and maximum penetration remains
**1.681609 mm > 1 mm**. The sustained-cycle test now also reports a maximum
locked arm-axis rotation error of **0.020459 rad > 0.02 rad** while all 20
cycles reach REVIEW with finite state, stable body identity/count, and bounded
residual motion. No tolerance was changed. Final [CI run 34681268756](https://github.com/hkspurs/bridge-lab-simulator/actions/runs/34681268756) for remote `22499d7e`, exact tree `ccc8c87`, passed lint, typecheck, build, 135 source tests, and 10/10 Chromium/WebKit cases in 56.8 seconds. Physics remained 26 pass / 2 fail with the three metrics above; deploy was skipped. Historical CI results above remain attributed to their tested trees.
