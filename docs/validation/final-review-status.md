# Final review status

## Result

Whole-branch software review is clean at `ccc8c87`; the later physical fixes in `de4cfe1` also passed independent scoped review. Two of the three physical criteria are corrected. Actual-Havok verification now reports **27 passed / 1 failed**: penetration remains **1.681608576 mm > 1 mm**.

The user explicitly authorized “修正1後commit and deploy”. Engineering deployment is authorized once these physical failures are fixed and automated verification passes; recording, holdout and real-iPhone gaps remain separately unverified. The remaining physical failure still prevents satisfying that condition. No merge or deployment of this branch has occurred. The deployed previous main commit is `5daa534b4252740f477b7ae591d036e85fbf142a`.

The [physical-fix report](physical-gate-fixes.md) and [raw experiments](physical-gate-experiments.json) retain the rejected numerical, collider, initial-condition and equivalent-bearing investigations. They did not meet all gates together and were reverted. No tolerance, coefficient, mass, inertia, gravity or final fixed timestep was changed. The design specification names Havok as a core technology; a replacement backend or a sourced finite-force structural redesign needs a deliberate architecture decision.

Deployment preparation in `ebf1eeb` adds a two-attempt test against the actual Pages URL after publication. Typecheck, exact test discovery, and independent configuration review pass. This is preparation only; the live test has not run. The cloud browser reports WebGL unsupported on the prior site, so it cannot provide interactive visual acceptance here.

CI [run 34681268756](https://github.com/hkspurs/bridge-lab-simulator/actions/runs/34681268756), [job 103520221186](https://github.com/hkspurs/bridge-lab-simulator/actions/runs/34681268756/job/103520221186), tests remote `22499d7e`, whose tree exactly matches local `ccc8c87`. Lint, typecheck, and build passed; 135 source tests passed; physics reported 26 passed / 2 failed tests with the three metrics below; all 10 Chromium/WebKit cases passed in 56.8 seconds; deploy was skipped. Artifact `10294019034`, `acceptance-evidence` (40,618,665 bytes), expires 2026-09-26.

## Review defects corrected

| Defect | Correction | Regression evidence |
|---|---|---|
| READY idle consumed the first powered phase timeout. | Axis-1 press now enters `MOVE_AXIS_1` through the phase transition helper, resetting phase-local elapsed time. | Before fix: focused test failed with `FAULT`; after fix: fresh-timeout regression passed. |
| Released carriage coordinates drifted when accepted input arrived between fixed ticks. | Non-driven animated-carriage axes have velocity cleared; axis 1 locks during axis 2 and axis 2 locks at DROP. | Before fix: both axes drifted **15.866537 mm**; after fix: actual-Havok handoff regressions preserve released coordinates and zero residual velocity. |
| New setup's explicit open target could be overwritten by the following READY hold. | Explicit `open` and `close` targets latch synchronously; `hold` retains the prior target. | Before fix: target remained closed at **−0.12 rad**; after fix: actual-Havok reset regression keeps both targets open and both arm angles above 0.6 rad for 120 READY ticks. |

The pre-edit focused run produced 4 expected failures in 2 files. The identical post-edit run passed all 4. A broader focused run passed 45 tests across the sequence, scene, and real-Havok claw fixtures; lint, typecheck, and build passed.

## Historical gates before `de4cfe1`

At `ccc8c87`, `npm run test:physics` reported 26 passed and 2 failed tests. The three baseline criteria were:

- rod-sliding relative error **0.06069007482201361** (**6.069007482201361%**), limit **0.05** (**5%**);
- contact penetration **0.001681608575842708 m**, limit **0.001 m**;
- locked arm-axis rotation **0.02045851382159589 rad**, limit **0.02 rad**.

All 20 endurance cycles reach REVIEW; state stays finite; ten bodies and the same prize instance persist; residual-motion and no-growing-oscillation criteria pass. The exact command evidence is retained in the scratch `final-fix-report.md`; historical CI results remain in [playable-machine validation](playable-machine.md) and [Task 7 report](task-7-report.md).

No recording bytes or frames were inspected, no untouched holdout was available, no physical-iPhone acceptance or performance run occurred, and no screenshot was visually inspected. Those records remain `NOT_RUN`/blocked. No merge or deployment has occurred.
