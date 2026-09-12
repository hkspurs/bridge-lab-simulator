import type { SourcedParameter } from "./types";
export type ClawUnit = SourcedParameter["unit"] | "rad" | "rad/s" | "m/s" | "N";
export type ClawParameter = Omit<SourcedParameter, "unit"> & {
  readonly unit: ClawUnit;
};
const estimate = (
  key: string, value: number, unit: ClawUnit, allowedRange: readonly [number, number],
): ClawParameter => ({
  key: `claw.${key}`, value, unit, allowedRange,
  sourceKind: "engineering-initial",
  sourceRef: "docs/validation/claw-feasibility.md#engineering-fixture",
  confidence: "low",
});
export const clawProfile = {
  id: "claw-v1-engineering-fixture",
  armLengthM: estimate("armLengthM", .16, "m", [.1, .25]),
  armThicknessM: estimate("armThicknessM", .008, "m", [.004, .015]),
  armDepthM: estimate("armDepthM", .025, "m", [.015, .04]),
  armMassKg: estimate("armMassKg", .025, "kg", [.01, .08]),
  stemMassKg: estimate("stemMassKg", .025, "kg", [.01, .08]),
  headMassKg: estimate("headMassKg", .3, "kg", [.1, 1]),
  headWidthM: estimate("headWidthM", .09, "m", [.07, .15]),
  headHeightM: estimate("headHeightM", .03, "m", [.02, .06]),
  headDepthM: estimate("headDepthM", .04, "m", [.025, .08]),
  hingeHalfSpacingM: estimate("hingeHalfSpacingM", .035, "m", [.025, .06]),
  suspensionLengthM: estimate("suspensionLengthM", .08, "m", [.04, .15]),
  suspensionThicknessM: estimate("suspensionThicknessM", .008, "m", [.004, .015]),
  homeHeightM: estimate("homeHeightM", .45, "m", [.35, .8]),
  dropHeightM: estimate("dropHeightM", .24, "m", [.2, .35]),
  travelRangeM: estimate("travelRangeM", .25, "m", [.1, .4]),
  maximumTravelSpeedMps: estimate("maximumTravelSpeedMps", .1, "m/s", [.03, .2]),
  maximumTravelAccelerationMps2: estimate("maximumTravelAccelerationMps2", .4, "m/s²", [.1, 1]),
  openAngleRad: estimate("openAngleRad", .65, "rad", [.4, .9]),
  closedAngleRad: estimate("closedAngleRad", -.12, "rad", [-.15, 0]),
  limitMarginRad: estimate("limitMarginRad", .03, "rad", [.01, .08]),
  /** Maximum motor target; external loading may exceed this angular speed. */
  maximumAngularSpeedRadps: estimate("maximumAngularSpeedRadps", .5, "rad/s", [.1, 1]),
  positionGainPerSecond: estimate("positionGainPerSecond", 6, "s⁻¹", [1, 12]),
  peakContactForceN: estimate("peakContactForceN", 4, "N", [1, 6]),
  holdingContactForceN: estimate("holdingContactForceN", 2.5, "N", [.5, 4]),
  forceReserveRatio: estimate("forceReserveRatio", .85, "1", [.5, .95]),
  friction: estimate("friction", .25, "1", [0, .6]),
  restitution: estimate("restitution", 0, "1", [0, .1]),
  angleToleranceRad: estimate("angleToleranceRad", .02, "rad", [.005, .04]),
  positionToleranceM: estimate("positionToleranceM", .001, "m", [.0005, .003]),
} as const;
export type ClawProfile = Omit<typeof clawProfile, "id"> & { readonly id: string };
type ParameterKey = Exclude<keyof ClawProfile, "id">;
type ParameterRule = {
  readonly unit: ClawUnit;
  readonly positive?: boolean;
  readonly minimum?: number;
  readonly maximum?: number;
};

// Independent physical schema: a caller cannot authorize negative mass or
// change a unit by changing a parameter's self-declared allowedRange/metadata.
const parameterRules: Record<ParameterKey, ParameterRule> = {
  armLengthM: { unit: "m", positive: true },
  armThicknessM: { unit: "m", positive: true },
  armDepthM: { unit: "m", positive: true },
  armMassKg: { unit: "kg", positive: true },
  stemMassKg: { unit: "kg", positive: true },
  headMassKg: { unit: "kg", positive: true },
  headWidthM: { unit: "m", positive: true },
  headHeightM: { unit: "m", positive: true },
  headDepthM: { unit: "m", positive: true },
  hingeHalfSpacingM: { unit: "m", positive: true },
  suspensionLengthM: { unit: "m", positive: true },
  suspensionThicknessM: { unit: "m", positive: true },
  homeHeightM: { unit: "m", positive: true },
  dropHeightM: { unit: "m", positive: true },
  travelRangeM: { unit: "m", positive: true },
  maximumTravelSpeedMps: { unit: "m/s", positive: true },
  maximumTravelAccelerationMps2: { unit: "m/s²", positive: true },
  openAngleRad: { unit: "rad", minimum: 0, maximum: Math.PI / 2 },
  closedAngleRad: { unit: "rad", minimum: -Math.PI / 2, maximum: 0 },
  limitMarginRad: { unit: "rad", positive: true, maximum: Math.PI / 2 },
  maximumAngularSpeedRadps: { unit: "rad/s", positive: true },
  positionGainPerSecond: { unit: "s⁻¹", positive: true },
  peakContactForceN: { unit: "N", positive: true },
  holdingContactForceN: { unit: "N", minimum: 0 },
  forceReserveRatio: { unit: "1", positive: true, maximum: 1 },
  friction: { unit: "1", minimum: 0 },
  restitution: { unit: "1", minimum: 0, maximum: 1 },
  angleToleranceRad: { unit: "rad", positive: true },
  positionToleranceM: { unit: "m", positive: true },
};
const confidenceLevels = ["high", "medium", "low", "unknown"];
const sourceKinds = ["measured", "manufacturer", "published", "inferred", "engineering-initial", "unknown"];

export function validateClawProfile(input: unknown): asserts input is ClawProfile {
  if (!input || typeof input !== "object") throw new Error("Invalid claw profile");
  const profile = input as Record<string, unknown>;
  if (typeof profile.id !== "string" || !profile.id.trim()) throw new Error("Invalid claw profile id");

  for (const [key, rule] of Object.entries(parameterRules)) {
    const parameter = profile[key];
    const invalid = (reason: string): never => { throw new Error(`Invalid claw parameter ${key}: ${reason}`); };
    if (!parameter || typeof parameter !== "object") invalid("required sourced parameter is missing");
    const p = parameter as Record<string, unknown>;
    if (p.key !== `claw.${key}`) invalid("parameter identity does not match its field");
    if (p.unit !== rule.unit) invalid(`expected unit ${rule.unit}`);
    if (typeof p.sourceRef !== "string" || !p.sourceRef.trim()) invalid("source reference is required");
    if (typeof p.sourceKind !== "string" || !sourceKinds.includes(p.sourceKind)) invalid("invalid source kind");
    if (typeof p.confidence !== "string" || !confidenceLevels.includes(p.confidence)) invalid("invalid confidence");

    const range = p.allowedRange;
    if (!Array.isArray(range) || range.length !== 2 ||
      !range.every(endpoint => typeof endpoint === "number" && Number.isFinite(endpoint)) ||
      range[0] > range[1]) invalid("expected two finite ordered range endpoints");
    const [minimum, maximum] = range as [number, number];
    const withinDomain = (value: unknown): value is number =>
      typeof value === "number" && Number.isFinite(value) &&
      (!rule.positive || value > 0) &&
      (rule.minimum === undefined || value >= rule.minimum) &&
      (rule.maximum === undefined || value <= rule.maximum);
    if (!withinDomain(minimum) || !withinDomain(maximum)) invalid("allowed range exceeds physical domain");
    const value = p.value;
    if (!withinDomain(value)) return invalid("value exceeds physical domain");
    if (value < minimum || value > maximum) invalid("value is outside its allowed range");
  }

  // Fields are complete and physically typed after the required-key loop.
  const valid = profile as unknown as ClawProfile;
  if (valid.holdingContactForceN.value > valid.peakContactForceN.value ||
    valid.closedAngleRad.value >= valid.openAngleRad.value ||
    valid.dropHeightM.value >= valid.homeHeightM.value) {
    throw new Error("Invalid claw profile ordering");
  }
}
