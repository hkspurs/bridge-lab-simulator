import { describe, expect, it, vi } from "vitest";
import { stepSimulation } from "./stepSimulation";
import type { ClawRig, RigObservation } from "../crane/types";

const observation: RigObservation = { atDropLimit: false, atLiftLimit: true, atHome: true, openReached: true, prizeSettled: false, invalidPhysics: false };

describe("stepSimulation", () => {
  it("orders prior observation, command, actuator, physics, then published observation", () => {
    const calls: string[] = [];
    const rig: ClawRig = {
      observe: vi.fn(() => { calls.push("observe"); return observation; }),
      command: vi.fn(() => calls.push("command")),
      beforeStep: vi.fn(() => calls.push("actuator")),
      dispose: vi.fn(),
    };
    const sequence = { tick: vi.fn(() => { calls.push("sequence"); return { travel: "stop", claw: "hold" } as const; }) };
    const result = stepSimulation(1 / 120, sequence, rig, () => calls.push("physics"));
    expect(calls).toEqual(["observe", "sequence", "command", "actuator", "physics", "observe"]);
    expect(sequence.tick).toHaveBeenCalledWith(1 / 120, observation);
    expect(result).toBe(observation);
  });

  it("executes physics exactly once per fixed tick", () => {
    const execute = vi.fn();
    const rig: ClawRig = { observe: () => observation, command: vi.fn(), beforeStep: vi.fn(), dispose: vi.fn() };
    stepSimulation(1 / 120, { tick: () => ({ travel: "stop", claw: "hold" }) }, rig, execute);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(1 / 120);
  });
});
