export interface PhysicsClockOptions {
  readonly stepSeconds: number;
  readonly maxFrameSeconds: number;
  readonly maxStepsPerFrame: number;
}

export interface ClockSample {
  readonly steps: number;
  readonly alpha: number;
  readonly simulatedSeconds: number;
  readonly droppedSeconds: number;
}

const validatePositiveFinite = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite number greater than zero`);
  }
};

export class PhysicsClock {
  private readonly stepSeconds: number;
  private readonly maxFrameSeconds: number;
  private readonly maxStepsPerFrame: number;
  private accumulatorSeconds = 0;

  public constructor({ stepSeconds, maxFrameSeconds, maxStepsPerFrame }: PhysicsClockOptions) {
    validatePositiveFinite("stepSeconds", stepSeconds);
    validatePositiveFinite("maxFrameSeconds", maxFrameSeconds);
    if (!Number.isInteger(maxStepsPerFrame) || maxStepsPerFrame <= 0) {
      throw new Error("maxStepsPerFrame must be a positive integer");
    }

    this.stepSeconds = stepSeconds;
    this.maxFrameSeconds = maxFrameSeconds;
    this.maxStepsPerFrame = maxStepsPerFrame;
  }

  public advance(frameSeconds: number, step: (dt: number) => void): ClockSample {
    if (!Number.isFinite(frameSeconds) || frameSeconds < 0) {
      throw new Error("frameSeconds must be a finite number greater than or equal to zero");
    }

    const acceptedSeconds = Math.min(frameSeconds, this.maxFrameSeconds);
    let droppedSeconds = frameSeconds - acceptedSeconds;
    this.accumulatorSeconds += acceptedSeconds;

    let steps = 0;
    while (steps < this.maxStepsPerFrame && this.accumulatorSeconds >= this.stepSeconds) {
      step(this.stepSeconds);
      this.accumulatorSeconds -= this.stepSeconds;
      steps += 1;
    }

    // Avoid carrying an unbounded backlog after the per-frame step budget is
    // exhausted. Keep only the fractional step for interpolation.
    if (this.accumulatorSeconds >= this.stepSeconds) {
      const fractionalSeconds = this.accumulatorSeconds % this.stepSeconds;
      droppedSeconds += this.accumulatorSeconds - fractionalSeconds;
      this.accumulatorSeconds = fractionalSeconds;
    }

    return {
      steps,
      alpha: this.accumulatorSeconds / this.stepSeconds,
      simulatedSeconds: steps * this.stepSeconds,
      droppedSeconds,
    };
  }

  /** Drops fractional wall time when simulation is interrupted or reset. */
  public discardAccumulatedTime(): void {
    this.accumulatorSeconds = 0;
  }
}
