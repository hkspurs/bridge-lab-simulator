import { clawProfile, type ClawProfile } from "../config/clawProfile";
import type { InputEvent, Phase, RigCommand, RigObservation } from "./types";

export type SequenceProfile = Readonly<{
  id: string;
  travel: Readonly<Record<"axis1" | "axis2" | "drop" | "lift" | "return", Readonly<{
    maximumDistanceM: number;
    minimumSpeedMps: number;
    timeoutSeconds: number;
    sourceRef: string;
  }>>>;
  closure: Readonly<{
    durationSeconds: number;
    dwellSeconds: number;
    sourceRef: string;
    confidence: "low";
  }>;
  settle: Readonly<{
    linearSpeedThresholdMps: number;
    angularSpeedThresholdRadps: number;
    sustainedSeconds: number;
    timeoutSeconds: number;
    sourceRef: string;
  }>;
}>;

/** Engineering allowances / workflow settings, all surfaced with their sources below. */
const TRAVEL_TIMEOUT_ALLOWANCE_SECONDS = 2;
const CLOSURE_CONVERGENCE_ALLOWANCE_SECONDS = .5;
const CLOSE_DWELL_SECONDS = .2;
const SETTLE_LINEAR_SPEED_MPS = .005;
const SETTLE_ANGULAR_SPEED_RADPS = .05;
const SETTLE_SUSTAINED_SECONDS = .5;
const SETTLE_TIMEOUT_SECONDS = 5;
const travelTimeout = (distanceM: number, speedMps: number): number =>
  distanceM / speedMps + TRAVEL_TIMEOUT_ALLOWANCE_SECONDS;

/**
 * Builds timing from the profile rather than embedding controller constants.
 * The 0.5 s convergence allowance is an engineering estimate: the actuator's
 * target speed does not guarantee it reaches the target under contact load.
 */
export function sequenceProfileFromClaw(profile: ClawProfile = clawProfile): SequenceProfile {
  const travelDistance = profile.travelRangeM.value;
  const verticalDistance = profile.homeHeightM.value - profile.dropHeightM.value;
  const speed = profile.maximumTravelSpeedMps.value;
  const travel = (maximumDistanceM: number) => ({
    maximumDistanceM,
    minimumSpeedMps: speed,
    timeoutSeconds: travelTimeout(maximumDistanceM, speed),
    sourceRef: "src/config/clawProfile.ts (travel distance / configured speed + 2 s)",
  });
  const angularSpan = profile.openAngleRad.value - profile.closedAngleRad.value;
  return {
    id: `${profile.id}-sequence-v1`,
    travel: {
      axis1: travel(travelDistance),
      axis2: travel(travelDistance),
      drop: travel(verticalDistance),
      lift: travel(verticalDistance),
      return: travel(travelDistance),
    },
    closure: {
      durationSeconds: angularSpan / profile.maximumAngularSpeedRadps.value + CLOSURE_CONVERGENCE_ALLOWANCE_SECONDS,
      dwellSeconds: CLOSE_DWELL_SECONDS,
      sourceRef: "src/config/clawProfile.ts (angular span / motor target + 0.5 s convergence estimate); docs plan dwell estimate",
      confidence: "low",
    },
    settle: {
      linearSpeedThresholdMps: SETTLE_LINEAR_SPEED_MPS,
      angularSpeedThresholdRadps: SETTLE_ANGULAR_SPEED_RADPS,
      sustainedSeconds: SETTLE_SUSTAINED_SECONDS,
      timeoutSeconds: SETTLE_TIMEOUT_SECONDS,
      sourceRef: "numerical workflow thresholds from task-4 brief; 5 s engineering timeout",
    },
  };
}

export type FaultReason = "invalid-physics" | "travel-timeout";
export type SettleOutcome = "settled" | "still-moving" | undefined;
export type SequenceStatus = Readonly<{
  phase: Phase;
  pausedPhase?: Exclude<Phase, "PAUSED" | "FAULT">;
  faultReason?: FaultReason;
  settleOutcome?: SettleOutcome;
}>;

type ActivePhase = Exclude<Phase, "READY" | "REVIEW" | "PAUSED" | "FAULT">;
const STOP: RigCommand = Object.freeze({ travel: "stop", claw: "hold" });
const commandFor = (phase: Phase, heldAxis?: 1 | 2): RigCommand => {
  switch (phase) {
    case "MOVE_AXIS_1": return { travel: heldAxis === 1 ? "axis1" : "stop", claw: "hold" };
    case "MOVE_AXIS_2": return { travel: heldAxis === 2 ? "axis2" : "stop", claw: "hold" };
    case "DROP": return { travel: "down", claw: "hold" };
    case "CLOSE": return { travel: "stop", claw: "close" };
    case "LIFT": return { travel: "up", claw: "hold" };
    case "RETURN": return { travel: "home", claw: "hold" };
    case "OPEN": return { travel: "stop", claw: "open" };
    default: return STOP;
  }
};

export class CraneSequence {
  #phase: Phase = "READY";
  #pausedPhase?: ActivePhase;
  #heldAxis?: 1 | 2;
  #phaseSeconds = 0;
  #settledSeconds = 0;
  #faultReason?: FaultReason;
  #settleOutcome?: SettleOutcome;

  constructor(readonly profile: SequenceProfile = sequenceProfileFromClaw()) {}

  get phase(): Phase { return this.#phase; }
  get status(): SequenceStatus {
    return Object.freeze({
      phase: this.#phase,
      ...(this.#pausedPhase ? { pausedPhase: this.#pausedPhase } : {}),
      ...(this.#faultReason ? { faultReason: this.#faultReason } : {}),
      ...(this.#settleOutcome ? { settleOutcome: this.#settleOutcome } : {}),
    });
  }

  dispatch(event: InputEvent): void {
    if (event.type === "cancel") {
      if (this.isActive(this.#phase)) {
        this.#pausedPhase = this.#phase;
        this.#heldAxis = undefined;
        this.#phase = "PAUSED";
      }
      return;
    }
    if (event.type === "resume") {
      if (this.#phase === "PAUSED" && this.#pausedPhase) {
        this.#phase = this.#pausedPhase;
        this.#pausedPhase = undefined;
        this.#heldAxis = undefined;
      }
      return;
    }
    if (event.type === "continue") {
      if (this.#phase === "REVIEW" || this.#phase === "FAULT") this.resetAttempt();
      return;
    }
    if (event.type !== "press" && event.type !== "release") return;
    if (this.#phase === "READY" && event.type === "press" && event.axis === 1) {
      this.#phase = "MOVE_AXIS_1";
      this.#heldAxis = 1;
      return;
    }
    if (this.#phase === "MOVE_AXIS_1" && event.axis === 1) {
      if (event.type === "press") this.#heldAxis = 1;
      if (event.type === "release" && this.#heldAxis === 1) {
        this.#heldAxis = undefined;
        this.transition("MOVE_AXIS_2");
      }
      return;
    }
    if (this.#phase === "MOVE_AXIS_2" && event.axis === 2) {
      if (event.type === "press") this.#heldAxis = 2;
      if (event.type === "release" && this.#heldAxis === 2) {
        this.#heldAxis = undefined;
        this.transition("DROP");
      }
    }
  }

  tick(dt: number, observation: RigObservation): RigCommand {
    if (this.#phase === "PAUSED" || this.#phase === "FAULT") return STOP;
    const invalidSpeedSample = (observation.prizeLinearSpeedMps !== undefined &&
        (!Number.isFinite(observation.prizeLinearSpeedMps) || observation.prizeLinearSpeedMps < 0)) ||
      (observation.prizeAngularSpeedRadps !== undefined &&
        (!Number.isFinite(observation.prizeAngularSpeedRadps) || observation.prizeAngularSpeedRadps < 0));
    if (!Number.isFinite(dt) || dt < 0 || observation.invalidPhysics || invalidSpeedSample) {
      this.fault("invalid-physics");
      return STOP;
    }

    this.#phaseSeconds += dt;
    switch (this.#phase) {
      case "MOVE_AXIS_1": this.manualTimeout("axis1", observation.atAxis1Limit === true); break;
      case "MOVE_AXIS_2": this.manualTimeout("axis2", observation.atAxis2Limit === true); break;
      case "DROP":
        if (observation.atDropLimit) this.transition("CLOSE");
        else this.travelTimeout("drop");
        break;
      case "CLOSE":
        if (this.#phaseSeconds >= this.profile.closure.durationSeconds + this.profile.closure.dwellSeconds) this.transition("LIFT");
        break;
      case "LIFT":
        if (observation.atLiftLimit) this.transition("RETURN");
        else this.travelTimeout("lift");
        break;
      case "RETURN":
        if (observation.atHome) this.transition("OPEN");
        else this.travelTimeout("return");
        break;
      case "OPEN":
        if (observation.openReached) this.transition("SETTLE");
        // Opening covers the same actuator angular span as closing, without its dwell.
        else if (this.#phaseSeconds >= this.profile.closure.durationSeconds) this.fault("travel-timeout");
        break;
      case "SETTLE": this.advanceSettle(dt, observation); break;
    }
    if ((this.#phase === "MOVE_AXIS_1" && observation.atAxis1Limit) ||
      (this.#phase === "MOVE_AXIS_2" && observation.atAxis2Limit)) return STOP;
    return commandFor(this.#phase, this.#heldAxis);
  }

  private isActive(phase: Phase): phase is ActivePhase { return !["READY", "REVIEW", "PAUSED", "FAULT"].includes(phase); }
  private transition(phase: Phase): void {
    this.#phase = phase;
    this.#phaseSeconds = 0;
    this.#settledSeconds = 0;
  }
  private resetAttempt(): void {
    this.#phase = "READY";
    this.#pausedPhase = undefined;
    this.#heldAxis = undefined;
    this.#phaseSeconds = 0;
    this.#settledSeconds = 0;
    this.#faultReason = undefined;
    this.#settleOutcome = undefined;
  }
  private fault(reason: FaultReason): void {
    if (this.#phase !== "FAULT") {
      this.#phase = "FAULT";
      this.#heldAxis = undefined;
      this.#pausedPhase = undefined;
      this.#faultReason = reason;
    }
  }
  private manualTimeout(key: "axis1" | "axis2", atLimit: boolean): void {
    if (this.#heldAxis && !atLimit && this.#phaseSeconds >= this.profile.travel[key].timeoutSeconds) this.fault("travel-timeout");
    // A hard stop ends powered travel; its required deliberate release can wait indefinitely.
    if (!this.#heldAxis || atLimit) this.#phaseSeconds = 0;
  }
  private travelTimeout(key: "drop" | "lift" | "return"): void {
    if (this.#phaseSeconds >= this.profile.travel[key].timeoutSeconds) this.fault("travel-timeout");
  }
  private advanceSettle(dt: number, observation: RigObservation): void {
    const hasPairedSpeedSamples = observation.prizeLinearSpeedMps !== undefined &&
      observation.prizeAngularSpeedRadps !== undefined;
    const withinObservedThresholds = hasPairedSpeedSamples &&
      observation.prizeLinearSpeedMps < this.profile.settle.linearSpeedThresholdMps &&
      observation.prizeAngularSpeedRadps < this.profile.settle.angularSpeedThresholdRadps;
    // Complete numerical samples are authoritative; prizeSettled supports legacy rigs only.
    const settled = hasPairedSpeedSamples ? withinObservedThresholds : observation.prizeSettled;
    if (settled) this.#settledSeconds += dt;
    else this.#settledSeconds = 0;
    if (this.#settledSeconds >= this.profile.settle.sustainedSeconds) {
      this.#settleOutcome = "settled";
      this.transition("REVIEW");
    } else if (this.#phaseSeconds >= this.profile.settle.timeoutSeconds) {
      this.#settleOutcome = "still-moving";
      this.transition("REVIEW");
    }
  }
}
