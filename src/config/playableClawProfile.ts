import { clawProfile, type ClawProfile } from "./clawProfile";

const photoEstimate = (key: Exclude<keyof ClawProfile, "id">, value: number) => ({
  ...clawProfile[key], value,
  sourceKind: "inferred" as const,
  sourceRef: "docs/research/claw-photo-reference.md#observations; docs/validation/reference-claw.md#geometry-estimates",
  confidence: "low" as const,
});

/** Match the upright four-rod prize, while retaining the isolated claw fixture.
 * At 0.32 m carriage height the head bottom is 0.225 m: 12.5 mm
 * above the settled 0.2125 m prize top. The 0.16 m arms still overlap
 * the prize vertically. This is estimated geometry, not a footage calibration.
 */
export const playableClawProfile: ClawProfile = {
  ...clawProfile,
  id: "claw-playable-v2-photo-reference-estimate",
  armOutreachM: photoEstimate("armOutreachM", .055),
  elbowDropM: photoEstimate("elbowDropM", .035),
  toeLengthM: photoEstimate("toeLengthM", .03),
  toeInsetM: photoEstimate("toeInsetM", .01),
  toeThicknessM: photoEstimate("toeThicknessM", .004),
  armLengthM: photoEstimate("armLengthM", .16),
  armThicknessM: photoEstimate("armThicknessM", .008),
  armDepthM: photoEstimate("armDepthM", .025),
  dropHeightM: {
    ...clawProfile.dropHeightM,
    value: .32,
    sourceRef: "src/config/playableProfile.ts (12.5 mm rod crown + 200 mm prize) + claw suspension 80 mm + head half-height 15 mm + estimated head clearance 12.5 mm",
    confidence: "low",
  },
};
