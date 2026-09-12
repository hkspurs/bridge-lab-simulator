import { describe, expect, it } from "vitest";
import { CraneSequence, sequenceProfileFromClaw } from "./CraneSequence";
import { clawProfile } from "../config/clawProfile";
import type { RigObservation } from "./types";

const profile = sequenceProfileFromClaw(clawProfile);
const observation = (overrides: Partial<RigObservation> = {}): RigObservation => ({
  atDropLimit: false, atLiftLimit: false, atHome: false,
  openReached: false, prizeSettled: false, invalidPhysics: false,
  ...overrides,
});
const tick = (sequence: CraneSequence, seconds: number, value = observation()) =>
  sequence.tick(seconds, value);

describe("CraneSequence", () => {
  it("follows the complete successful attempt transition table", () => {
    const sequence = new CraneSequence(profile);
    sequence.dispatch({ type: "press", axis: 1 });
    expect(sequence.phase).toBe("MOVE_AXIS_1");
    expect(tick(sequence, 0)).toMatchObject({ travel: "axis1" });
    sequence.dispatch({ type: "release", axis: 1 });
    expect(sequence.phase).toBe("MOVE_AXIS_2");
    expect(tick(sequence, 0)).toMatchObject({ travel: "stop" });
    sequence.dispatch({ type: "press", axis: 2 });
    expect(tick(sequence, 0)).toMatchObject({ travel: "axis2" });
    sequence.dispatch({ type: "release", axis: 2 });
    expect(sequence.phase).toBe("DROP");
    expect(tick(sequence, 0, observation({ atDropLimit: true }))).toMatchObject({ claw: "close" });
    tick(sequence, profile.closure.durationSeconds + profile.closure.dwellSeconds, observation());
    expect(sequence.phase).toBe("LIFT");
    tick(sequence, 0, observation({ atLiftLimit: true }));
    expect(sequence.phase).toBe("RETURN");
    tick(sequence, 0, observation({ atHome: true }));
    expect(sequence.phase).toBe("OPEN");
    tick(sequence, 0, observation({ openReached: true }));
    expect(sequence.phase).toBe("SETTLE");
    tick(sequence, profile.settle.sustainedSeconds, observation({ prizeSettled: true }));
    expect(sequence.phase).toBe("REVIEW");
    sequence.dispatch({ type: "continue" });
    expect(sequence.phase).toBe("READY");
  });

  it("cancels and resumes without treating cancellation as a release", () => {
    const sequence = new CraneSequence(profile);
    sequence.dispatch({ type: "press", axis: 1 });
    sequence.dispatch({ type: "release", axis: 1 });
    sequence.dispatch({ type: "press", axis: 2 });
    sequence.dispatch({ type: "cancel" });
    expect(sequence.phase).toBe("PAUSED");
    sequence.dispatch({ type: "resume" });
    expect(sequence.phase).toBe("MOVE_AXIS_2");
    expect(tick(sequence, 0)).toMatchObject({ travel: "stop" });
    sequence.dispatch({ type: "release", axis: 2 });
    expect(sequence.phase).toBe("MOVE_AXIS_2");
    sequence.dispatch({ type: "press", axis: 2 });
    sequence.dispatch({ type: "release", axis: 2 });
    expect(sequence.phase).toBe("DROP");
  });

  it("ignores repeated, out-of-order, and unaccepted release events", () => {
    const sequence = new CraneSequence(profile);
    sequence.dispatch({ type: "release", axis: 1 });
    sequence.dispatch({ type: "press", axis: 2 });
    expect(sequence.phase).toBe("READY");
    sequence.dispatch({ type: "press", axis: 1 });
    sequence.dispatch({ type: "press", axis: 1 });
    sequence.dispatch({ type: "release", axis: 2 });
    expect(sequence.phase).toBe("MOVE_AXIS_1");
    sequence.dispatch({ type: "release", axis: 1 });
    sequence.dispatch({ type: "release", axis: 2 });
    expect(sequence.phase).toBe("MOVE_AXIS_2");
  });

  it("lifts after the conservative closure interval even when obstructed", () => {
    const sequence = new CraneSequence(profile);
    sequence.dispatch({ type: "press", axis: 1 });
    sequence.dispatch({ type: "release", axis: 1 });
    sequence.dispatch({ type: "press", axis: 2 });
    sequence.dispatch({ type: "release", axis: 2 });
    tick(sequence, 0, observation({ atDropLimit: true }));
    tick(sequence, profile.closure.durationSeconds + profile.closure.dwellSeconds, observation({ openReached: false }));
    expect(sequence.phase).toBe("LIFT");
  });

  it("times out travel, latches faults, and needs an explicit continue recovery", () => {
    const sequence = new CraneSequence(profile);
    sequence.dispatch({ type: "press", axis: 1 });
    tick(sequence, profile.travel.axis1.timeoutSeconds, observation());
    expect(sequence.phase).toBe("FAULT");
    expect(sequence.status.faultReason).toBe("travel-timeout");
    sequence.dispatch({ type: "press", axis: 1 });
    expect(sequence.phase).toBe("FAULT");
    sequence.dispatch({ type: "continue" });
    expect(sequence.phase).toBe("READY");
  });

  it("latches invalid physics and marks a settle timeout as still moving", () => {
    const sequence = new CraneSequence(profile);
    tick(sequence, 0, observation({ invalidPhysics: true }));
    expect(sequence.phase).toBe("FAULT");
    expect(sequence.status.faultReason).toBe("invalid-physics");
    sequence.dispatch({ type: "continue" });
    sequence.dispatch({ type: "press", axis: 1 });
    sequence.dispatch({ type: "release", axis: 1 });
    sequence.dispatch({ type: "press", axis: 2 });
    sequence.dispatch({ type: "release", axis: 2 });
    tick(sequence, 0, observation({ atDropLimit: true }));
    tick(sequence, profile.closure.durationSeconds + profile.closure.dwellSeconds);
    tick(sequence, 0, observation({ atLiftLimit: true }));
    tick(sequence, 0, observation({ atHome: true }));
    tick(sequence, 0, observation({ openReached: true }));
    tick(sequence, profile.settle.timeoutSeconds, observation());
    expect(sequence.phase).toBe("REVIEW");
    expect(sequence.status.settleOutcome).toBe("still-moving");
  });
});

describe("sequence timing profile", () => {
  it("derives travel fault timing and conservative closure timing from claw sources", () => {
    expect(profile.travel.axis1.timeoutSeconds).toBeCloseTo(4.5);
    expect(profile.travel.drop.timeoutSeconds).toBeCloseTo(4.1);
    expect(profile.closure.durationSeconds).toBeCloseTo(2.04);
    expect(profile.closure.dwellSeconds).toBe(.2);
    expect(profile.settle).toMatchObject({
      linearSpeedThresholdMps: .005, angularSpeedThresholdRadps: .05,
      sustainedSeconds: .5, timeoutSeconds: 5,
    });
  });

  it("stops at a manual travel limit but still requires the deliberate release", () => {
    const sequence = new CraneSequence(profile);
    sequence.dispatch({ type: "press", axis: 1 });
    expect(tick(sequence, profile.travel.axis1.timeoutSeconds * 2, observation({ atAxis1Limit: true }))).toEqual({ travel: "stop", claw: "hold" });
    expect(sequence.phase).toBe("MOVE_AXIS_1");
    sequence.dispatch({ type: "release", axis: 1 });
    expect(sequence.phase).toBe("MOVE_AXIS_2");
  });
});

describe("settle observations", () => {
  const enterSettle = (): CraneSequence => {
    const sequence = new CraneSequence(profile);
    sequence.dispatch({ type: "press", axis: 1 });
    sequence.dispatch({ type: "release", axis: 1 });
    sequence.dispatch({ type: "press", axis: 2 });
    sequence.dispatch({ type: "release", axis: 2 });
    tick(sequence, 0, observation({ atDropLimit: true }));
    tick(sequence, profile.closure.durationSeconds + profile.closure.dwellSeconds);
    tick(sequence, 0, observation({ atLiftLimit: true }));
    tick(sequence, 0, observation({ atHome: true }));
    tick(sequence, 0, observation({ openReached: true }));
    return sequence;
  };

  it("uses paired speed samples over the legacy settled flag", () => {
    const sequence = enterSettle();
    tick(sequence, profile.settle.sustainedSeconds, observation({
      prizeSettled: true, prizeLinearSpeedMps: 1, prizeAngularSpeedRadps: 1,
    }));
    expect(sequence.phase).toBe("SETTLE");
  });

  it("faults negative speed magnitudes as invalid physics", () => {
    const sequence = new CraneSequence(profile);
    tick(sequence, 0, observation({ prizeLinearSpeedMps: -.001, prizeAngularSpeedRadps: 0 }));
    expect(sequence.phase).toBe("FAULT");
    expect(sequence.status.faultReason).toBe("invalid-physics");
  });

  it("faults when opening cannot reach its limit within the actuator interval", () => {
    const sequence = new CraneSequence(profile);
    sequence.dispatch({ type: "press", axis: 1 });
    sequence.dispatch({ type: "release", axis: 1 });
    sequence.dispatch({ type: "press", axis: 2 });
    sequence.dispatch({ type: "release", axis: 2 });
    tick(sequence, 0, observation({ atDropLimit: true }));
    tick(sequence, profile.closure.durationSeconds + profile.closure.dwellSeconds);
    tick(sequence, 0, observation({ atLiftLimit: true }));
    tick(sequence, 0, observation({ atHome: true }));
    expect(sequence.phase).toBe("OPEN");
    tick(sequence, profile.closure.durationSeconds, observation());
    expect(sequence.phase).toBe("FAULT");
    expect(sequence.status.faultReason).toBe("travel-timeout");
  });
});
