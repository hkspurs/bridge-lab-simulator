# Final review status

## Result

Whole-branch software review is clean at local commit `ccc8c87`. Release remains an **engineering fixture** and is not eligible to merge or deploy: current actual-Havok verification has three failed criteria within two failing tests, and recording, holdout, physical-iPhone, and screenshot-inspection evidence remains blocked or not run.

CI [run 34681268756](https://github.com/hkspurs/bridge-lab-simulator/actions/runs/34681268756), [job 103520221186](https://github.com/hkspurs/bridge-lab-simulator/actions/runs/34681268756/job/103520221186), tests remote `22499d7e`, whose tree exactly matches local `ccc8c87`. Lint, typecheck, and build passed; 135 source tests passed; physics reported 26 passed / 2 failed tests with the three metrics below; all 10 Chromium/WebKit cases passed in 56.8 seconds; deploy was skipped. Artifact `10294019034`, `acceptance-evidence` (40,618,665 bytes), expires 2026-09-26.

## Review defects corrected

| Defect | Correction | Regression evidence |
|---|---|---|
| READY idle consumed the first powered phase timeout. | Axis-1 press now enters `MOVE_AXIS_1` through the phase transition helper, resetting phase-local elapsed time. | Before fix: focused test failed with `FAULT`; after fix: fresh-timeout regression passed. |
| Released carriage coordinates drifted when accepted input arrived between fixed ticks. | Non-driven animated-carriage axes have velocity cleared; axis 1 locks during axis 2 and axis 2 locks at DROP. | Before fix: both axes drifted **15.866537 mm**; after fix: actual-Havok handoff regressions preserve released coordinates and zero residual velocity. |
| New setup's explicit open target could be overwritten by the following READY hold. | Explicit `open` and `close` targets latch synchronously; `hold` retains the prior target. | Before fix: target remained closed at **−0.12 rad**; after fix: actual-Havok reset regression keeps both targets open and both arm angles above 0.6 rad for 120 READY ticks. |

The pre-edit focused run produced 4 expected failures in 2 files. The identical post-edit run passed all 4. A broader focused run passed 45 tests across the sequence, scene, and real-Havok claw fixtures; lint, typecheck, and build passed.

## Current gates

`npm run test:physics` reports 26 passed and 2 failed tests. Three criteria fail without tolerance changes:

- rod-sliding relative error **0.06069007482201361** (**6.069007482201361%**), limit **0.05** (**5%**);
- contact penetration **0.001681608575842708 m**, limit **0.001 m**;
- locked arm-axis rotation **0.02045851382159589 rad**, limit **0.02 rad**.

All 20 endurance cycles reach REVIEW; state stays finite; ten bodies and the same prize instance persist; residual-motion and no-growing-oscillation criteria pass. The exact command evidence is retained in the scratch `final-fix-report.md`; historical CI results remain in [playable-machine validation](playable-machine.md) and [Task 7 report](task-7-report.md).

No recording bytes or frames were inspected, no untouched holdout was available, no physical-iPhone acceptance or performance run occurred, and no screenshot was visually inspected. Those records remain `NOT_RUN`/blocked. No merge or deployment has occurred.
