import { describe, expect, it } from "vitest";
import { clawProfile, validateClawProfile, type ClawProfile } from "./clawProfile";

type ParameterKey = Exclude<keyof ClawProfile, "id">;
const altered = (key: ParameterKey, changes: Record<string, unknown>): ClawProfile => {
  const profile = structuredClone(clawProfile);
  Object.assign(profile[key], changes);
  return profile;
};

describe("claw profile validation", () => {
  it("accepts sourced defaults, signed closed angles and zero restitution", () => {
    expect(() => validateClawProfile(clawProfile)).not.toThrow();
    expect(() => validateClawProfile(altered("closedAngleRad", { value: -.1 }))).not.toThrow();
    expect(() => validateClawProfile(altered("closedAngleRad", { value: 0 }))).not.toThrow();
  });

  it.each([
    ["negative length", "armLengthM", { value: -1, allowedRange: [-2, 0] }],
    ["zero mass", "armMassKg", { value: 0, allowedRange: [0, 1] }],
    ["negative range endpoint", "armLengthM", { allowedRange: [-2, 1] }],
    ["NaN range endpoint", "armLengthM", { allowedRange: [NaN, 1] }],
    ["infinite range endpoint", "armLengthM", { allowedRange: [.1, Infinity] }],
    ["reversed range", "armLengthM", { allowedRange: [.2, .1] }],
    ["missing range", "armLengthM", { allowedRange: undefined }],
    ["short range", "armLengthM", { allowedRange: [.1] }],
    ["nonfinite value", "armLengthM", { value: NaN }],
    ["outside declared range", "armLengthM", { value: .5 }],
    ["length units", "armLengthM", { unit: "kg" }],
    ["angular units", "openAngleRad", { unit: "deg" }],
    ["force units", "peakContactForceN", { unit: "1" }],
    ["missing confidence", "armLengthM", { confidence: undefined }],
    ["invalid confidence", "armLengthM", { confidence: "certain" }],
    ["invalid source kind", "armLengthM", { sourceKind: "invented" }],
    ["missing source reference", "armLengthM", { sourceRef: undefined }],
    ["empty source reference", "armLengthM", { sourceRef: "  " }],
    ["mismatched parameter identity", "armLengthM", { key: "claw.armMassKg" }],
    ["negative friction", "friction", { value: -.2, allowedRange: [-1, 1] }],
    ["superelastic restitution", "restitution", { value: 2, allowedRange: [0, 2] }],
    ["force reserve above unity", "forceReserveRatio", { value: 2, allowedRange: [.1, 2] }],
    ["zero angular speed", "maximumAngularSpeedRadps", { value: 0, allowedRange: [0, 1] }],
    ["negative open angle", "openAngleRad", { value: -.2, allowedRange: [-1, 1] }],
    ["positive closed angle", "closedAngleRad", { value: .1, allowedRange: [-1, 1] }],
  ] as const)("rejects %s with a parameter-specific validation error", (_name, key, changes) => {
    expect(() => validateClawProfile(altered(key, changes))).toThrow(`Invalid claw parameter ${key}`);
  });

  it("requires every physical parameter instead of enumerating only supplied fields", () => {
    for (const key of Object.keys(clawProfile).filter(key => key !== "id")) {
      const profile = structuredClone(clawProfile) as unknown as Record<string, unknown>;
      delete profile[key];
      expect(() => validateClawProfile(profile as unknown as ClawProfile)).toThrow(`Invalid claw parameter ${key}`);
    }
  });

  it("requires a nonempty profile identity", () => {
    expect(() => validateClawProfile({ ...clawProfile, id: "" })).toThrow("Invalid claw profile id");
  });

  it("preserves force, angle and travel ordering", () => {
    expect(() => validateClawProfile(altered("peakContactForceN", { value: 2 }))).toThrow("ordering");
    expect(() => validateClawProfile(altered("homeHeightM", { value: .35 }))).not.toThrow();
    const profile = altered("homeHeightM", { value: .35 });
    profile.dropHeightM.value = .35;
    expect(() => validateClawProfile(profile)).toThrow("ordering");
  });
});
