import { describe, expect, it } from "vitest";
import { PhysicsClock } from "./PhysicsClock";

describe("PhysicsClock", () => {
  it("produces 120 equal steps from sixty 60 FPS frames", () => {
    const clock = new PhysicsClock({ stepSeconds: 1 / 120, maxFrameSeconds: 0.1, maxStepsPerFrame: 24 });
    const steps: number[] = [];
    for (let frame = 0; frame < 60; frame += 1) {
      clock.advance(1 / 60, (dt) => steps.push(dt));
    }
    expect(steps).toHaveLength(120);
    expect(new Set(steps)).toEqual(new Set([1 / 120]));
  });

  it("produces the same simulated second at 30, 60 and 120 FPS", () => {
    const run = (fps: number) => {
      const clock = new PhysicsClock({ stepSeconds: 1 / 120, maxFrameSeconds: 0.1, maxStepsPerFrame: 24 });
      let value = 0;
      for (let frame = 0; frame < fps; frame += 1) clock.advance(1 / fps, (dt) => { value += dt; });
      return value;
    };
    expect(run(30)).toBeCloseTo(run(60), 12);
    expect(run(60)).toBeCloseTo(run(120), 12);
  });

  it("reports discarded wall time instead of changing the step", () => {
    const clock = new PhysicsClock({ stepSeconds: 1 / 120, maxFrameSeconds: 0.1, maxStepsPerFrame: 12 });
    const sample = clock.advance(0.5, () => undefined);
    expect(sample.steps).toBe(12);
    expect(sample.droppedSeconds).toBeCloseTo(0.4, 12);
  });

  it.each([
    ["stepSeconds", { stepSeconds: 0, maxFrameSeconds: 0.1, maxStepsPerFrame: 1 }],
    ["maxFrameSeconds", { stepSeconds: 0.01, maxFrameSeconds: 0, maxStepsPerFrame: 1 }],
    ["maxStepsPerFrame", { stepSeconds: 0.01, maxFrameSeconds: 0.1, maxStepsPerFrame: 0 }],
    ["non-finite stepSeconds", { stepSeconds: Number.NaN, maxFrameSeconds: 0.1, maxStepsPerFrame: 1 }],
    ["non-finite maxFrameSeconds", { stepSeconds: 0.01, maxFrameSeconds: Infinity, maxStepsPerFrame: 1 }],
  ])("rejects invalid %s", (_description, options) => {
    expect(() => new PhysicsClock(options)).toThrow();
  });

  it.each([Number.NaN, Infinity, -Infinity, -0.001])("rejects invalid frame duration %s", (frameSeconds) => {
    const clock = new PhysicsClock({ stepSeconds: 0.01, maxFrameSeconds: 0.1, maxStepsPerFrame: 1 });
    expect(() => clock.advance(frameSeconds, () => undefined)).toThrow();
  });
});
