import { describe, expect, it } from "vitest";
import { clampTorque, motorDemand, contactMomentArmM } from "./clawActuator";
import { clawProfile } from "../config/clawProfile";
describe("finite claw actuator", () => {
  it("clamps both signs and rejects nonphysical input", () => {
    expect(clampTorque(10, .8)).toBe(.8);
    expect(clampTorque(-10, .8)).toBe(-.8);
    expect(clampTorque(.2, .8)).toBe(.2);
    for (const [request, limit] of [[NaN, 1], [1, -1], [1, Infinity]])
      expect(() => clampTorque(request, limit)).toThrow();
  });
  it("measures a contact lever in the rotated head frame", () => {
    const root = { x: 1, y: 2, z: 3 };
    // 90 degrees about Y rotates the hinge's Z axis to world X.
    const rotation = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 };
    const localPivot = { x: .035, y: 0, z: 0 };
    expect(contactMomentArmM({ x: 1, y: 1.88, z: 2.965 }, { x: 0, y: 0, z: 1 }, root, rotation, localPivot)).toBeCloseTo(.12);
  });
  it("uses perpendicular moment arm and separates closing from holding", () => {
    const close = motorDemand(0, -.4, .12, "close", clawProfile);
    const hold = motorDemand(0, -.4, .12, "hold", clawProfile);
    expect(close.torqueLimitNm).toBeLessThanOrEqual(4 * .12);
    expect(hold.torqueLimitNm).toBeLessThan(close.torqueLimitNm);
    expect(Math.abs(close.targetSpeedRadps)).toBeLessThanOrEqual(clawProfile.maximumAngularSpeedRadps.value);
  });
});
