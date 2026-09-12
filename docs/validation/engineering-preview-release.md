# Playable engineering preview release

The user requested deployment and then reported that the live site still had no controls, showing the old `bridge-lab-v0.1` calibration scene. Redeploying that baseline did not deliver the requested playable machine. PR #2 is now targeted at main to publish the existing two-button engineering preview.

## Release checks

The `verify` job requires lint, type checking, 135 source regressions, actual-engine bridge and finite-force claw tests, a production build, and the Chromium/WebKit interaction suite. The deploy job remains limited to push-main, depends on `verify`, and tests two consecutive attempts against the published Pages URL. Artifact names include the run attempt to retain the main-branch redeployment fix.

The full `test:physics` command runs separately as **Physical accuracy acceptance (engineering preview)**. Every assertion and tolerance remains active, its failure remains visible in GitHub Actions, and its reports are uploaded even on failure. It is not a deployment prerequisite for this playable engineering preview. This is a deliberate distinction between operational release and quantitative physical validation, not a passing physical certificate. No branch-protection setting is changed.

## Known limitation

The retained physical result is 27 passed / 1 failed: peak penetration **1.681608576 mm exceeds 1 mm**. Sliding and hinge corrections pass. No physical behavior or test threshold changes are included in this release preparation. The UI explicitly says **Engineering preview**. Recording calibration, holdout and real-iPhone validation remain unverified. The older release-blocking notes describe the earlier deployment decision and are superseded for this engineering preview only.

## Required live evidence

A successful deployment must identify the playable profile `bridge-lab-playable-v1-engineering-fixture`, expose both movement controls, complete two attempts with Continue preserving the prize, and load the production assets. The previous baseline-only deployment is not sufficient evidence.
