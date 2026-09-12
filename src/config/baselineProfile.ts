import type { CalibrationProfile, SourcedParameter } from "./types";

const researchRef =
  "docs/research/Japanese_Bridge_Crane_Physics_Parameter_Baseline_v0.1.md";
const massModelRef =
  "BRIDGE LAB engineering-initial mass distribution ruling (2026-09-11)";

const massBlockRanges = {
  massKg: [0.001, 0.32] as const,
  centerM: {
    x: [-0.07, 0.07] as const,
    y: [-0.045, 0.045] as const,
    z: [0, 0.2] as const,
  },
  sizeM: {
    x: [0.001, 0.14] as const,
    y: [0.001, 0.09] as const,
    z: [0.001, 0.2] as const,
  },
};

const parameter = (
  key: string,
  value: number,
  unit: SourcedParameter["unit"],
  allowedRange: SourcedParameter["allowedRange"],
  sourceKind: SourcedParameter["sourceKind"],
  sourceRef: string,
  confidence: SourcedParameter["confidence"]
): SourcedParameter => ({
  key,
  value,
  unit,
  allowedRange,
  sourceKind,
  sourceRef,
  confidence,
});

export const baselineProfile: Readonly<CalibrationProfile> = {
  id: "bridge-lab-v0.1",
  physics: {
    stepSeconds: parameter(
      "physics.stepSeconds",
      1 / 120,
      "s",
      [1 / 120, 1 / 120],
      "engineering-initial",
      "Physics Foundation Implementation Plan: Global Constraints",
      "high"
    ),
  },
  environment: {
    gravityMps2: parameter(
      "environment.gravityMps2",
      9.80665,
      "m/s²",
      [9.80665, 9.80665],
      "published",
      `${researchRef} (S6 standard gravity)`,
      "high"
    ),
  },
  prize: {
    widthM: parameter(
      "prize.widthM",
      0.14,
      "m",
      [0.12, 0.17],
      "inferred",
      `${researchRef} (section 4, box width)`,
      "low"
    ),
    depthM: parameter(
      "prize.depthM",
      0.09,
      "m",
      [0.07, 0.12],
      "inferred",
      `${researchRef} (section 4, box depth)`,
      "low"
    ),
    heightM: parameter(
      "prize.heightM",
      0.2,
      "m",
      [0.18, 0.23],
      "inferred",
      `${researchRef} (section 4, box height)`,
      "low"
    ),
    massKg: parameter(
      "prize.massKg",
      0.32,
      "kg",
      [0.22, 0.48],
      "engineering-initial",
      `${researchRef} (section 4, total box mass)`,
      "low"
    ),
    centerOfMassRatioX: parameter(
      "prize.centerOfMassRatioX",
      0,
      "1",
      [-0.08, 0.08],
      "inferred",
      `${researchRef} (section 4, x/W)`,
      "low"
    ),
    centerOfMassRatioY: parameter(
      "prize.centerOfMassRatioY",
      0.08,
      "1",
      [-0.15, 0.25],
      "inferred",
      `${researchRef} (section 4, y/D)`,
      "low"
    ),
    centerOfMassRatioZ: parameter(
      "prize.centerOfMassRatioZ",
      0.66,
      "1",
      [0.6, 0.74],
      "inferred",
      `${researchRef} (section 4, z/H)`,
      "medium"
    ),
    massBlocks: [
      {
        id: "shell",
        massKg: 0.04,
        massKgUnit: "kg",
        allowedMassKg: massBlockRanges.massKg,
        centerM: { x: 0, y: 0, z: 0.1 },
        centerMUnit: "m",
        allowedCenterM: massBlockRanges.centerM,
        sizeM: { x: 0.14, y: 0.09, z: 0.012 },
        sizeMUnit: "m",
        allowedSizeM: massBlockRanges.sizeM,
        sourceKind: "engineering-initial",
        sourceRef: massModelRef,
        confidence: "low",
      },
      {
        id: "upper-figure",
        massKg: 0.14,
        massKgUnit: "kg",
        allowedMassKg: massBlockRanges.massKg,
        centerM: { x: 0, y: 0.01, z: 0.165 },
        centerMUnit: "m",
        allowedCenterM: massBlockRanges.centerM,
        sizeM: { x: 0.1, y: 0.055, z: 0.06 },
        sizeMUnit: "m",
        allowedSizeM: massBlockRanges.sizeM,
        sourceKind: "engineering-initial",
        sourceRef: massModelRef,
        confidence: "low",
      },
      {
        id: "lower-figure",
        massKg: 0.1,
        massKgUnit: "kg",
        allowedMassKg: massBlockRanges.massKg,
        centerM: { x: 0, y: 0.005, z: 0.11 },
        centerMUnit: "m",
        allowedCenterM: massBlockRanges.centerM,
        sizeM: { x: 0.08, y: 0.06, z: 0.06 },
        sizeMUnit: "m",
        allowedSizeM: massBlockRanges.sizeM,
        sourceKind: "engineering-initial",
        sourceRef: massModelRef,
        confidence: "low",
      },
      {
        id: "packing",
        massKg: 0.04,
        massKgUnit: "kg",
        allowedMassKg: massBlockRanges.massKg,
        centerM: { x: 0, y: 0.0101, z: 0.1035 },
        centerMUnit: "m",
        allowedCenterM: massBlockRanges.centerM,
        sizeM: { x: 0.12, y: 0.065, z: 0.035 },
        sizeMUnit: "m",
        allowedSizeM: massBlockRanges.sizeM,
        sourceKind: "engineering-initial",
        sourceRef: massModelRef,
        confidence: "low",
      },
    ],
  },
  bridge: {
    rodDiameterM: parameter(
      "bridge.rodDiameterM",
      0.025,
      "m",
      [0.02, 0.03],
      "inferred",
      `${researchRef} (section 4, rod diameter)`,
      "low"
    ),
    rodCenterDistanceM: parameter(
      "bridge.rodCenterDistanceM",
      0.16,
      "m",
      [0.12, 0.21],
      "inferred",
      `${researchRef} (section 4, rod centre distance)`,
      "low"
    ),
    rodHeightDeltaM: parameter(
      "bridge.rodHeightDeltaM",
      0,
      "m",
      [-0.015, 0.015],
      "inferred",
      `${researchRef} (section 4, rod height delta)`,
      "low"
    ),
  },
  contacts: {
    boxRodStaticFriction: parameter(
      "contacts.boxRodStaticFriction",
      0.34,
      "1",
      [0.2, 0.55],
      "engineering-initial",
      `${researchRef} (section 6, box-rod static friction)`,
      "low"
    ),
    boxRodDynamicFriction: parameter(
      "contacts.boxRodDynamicFriction",
      0.26,
      "1",
      [0.14, 0.42],
      "engineering-initial",
      `${researchRef} (section 6, box-rod dynamic friction)`,
      "low"
    ),
    restitution: parameter(
      "contacts.restitution",
      0.06,
      "1",
      [0.02, 0.15],
      "engineering-initial",
      `${researchRef} (section 6, restitution)`,
      "low"
    ),
  },
  damping: {
    linearPerSecond: parameter(
      "damping.linearPerSecond",
      0,
      "s⁻¹",
      [0, 0.08],
      "engineering-initial",
      `${researchRef} (section 6, linear damping)`,
      "low"
    ),
    angularPerSecond: parameter(
      "damping.angularPerSecond",
      0.05,
      "s⁻¹",
      [0.01, 0.2],
      "engineering-initial",
      `${researchRef} (section 6, angular damping)`,
      "low"
    ),
  },
};
