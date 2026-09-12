import { describe, expect, it } from "vitest";
import { baselineProfile } from "./baselineProfile";
import type { CalibrationProfile, SourcedParameter } from "./types";

const allParameters = (profile: CalibrationProfile): readonly SourcedParameter[] => [
  profile.physics.stepSeconds,
  profile.environment.gravityMps2,
  profile.prize.widthM,
  profile.prize.depthM,
  profile.prize.heightM,
  profile.prize.massKg,
  profile.prize.centerOfMassRatioX,
  profile.prize.centerOfMassRatioY,
  profile.prize.centerOfMassRatioZ,
  profile.bridge.rodDiameterM,
  profile.bridge.rodCenterDistanceM,
  profile.bridge.rodHeightDeltaM,
  profile.contacts.boxRodStaticFriction,
  profile.contacts.boxRodDynamicFriction,
  profile.contacts.restitution,
  profile.damping.linearPerSecond,
  profile.damping.angularPerSecond,
];

describe("baselineProfile", () => {
  it("contains the approved v0.1 calibration inputs", () => {
    expect(baselineProfile.id).toBe("bridge-lab-v0.1");
    expect(baselineProfile.physics.stepSeconds.value).toBe(1 / 120);
    expect(baselineProfile.prize.massBlocks).toHaveLength(4);
    expect(
      baselineProfile.prize.massBlocks.reduce((total, block) => total + block.massKg, 0)
    ).toBeCloseTo(0.32, 12);
  });

  it("locks the controller-approved internal mass distribution", () => {
    expect(baselineProfile.prize.massBlocks).toEqual([
      {
        id: "shell",
        massKg: 0.04,
        massKgUnit: "kg",
        allowedMassKg: [0.001, 0.32],
        centerM: { x: 0, y: 0, z: 0.1 },
        centerMUnit: "m",
        allowedCenterM: {
          x: [-0.07, 0.07],
          y: [-0.045, 0.045],
          z: [0, 0.2],
        },
        sizeM: { x: 0.14, y: 0.09, z: 0.012 },
        sizeMUnit: "m",
        allowedSizeM: {
          x: [0.001, 0.14],
          y: [0.001, 0.09],
          z: [0.001, 0.2],
        },
        sourceKind: "engineering-initial",
        sourceRef: "BRIDGE LAB engineering-initial mass distribution ruling (2026-09-11)",
        confidence: "low",
      },
      {
        id: "upper-figure",
        massKg: 0.14,
        massKgUnit: "kg",
        allowedMassKg: [0.001, 0.32],
        centerM: { x: 0, y: 0.01, z: 0.165 },
        centerMUnit: "m",
        allowedCenterM: {
          x: [-0.07, 0.07],
          y: [-0.045, 0.045],
          z: [0, 0.2],
        },
        sizeM: { x: 0.1, y: 0.055, z: 0.06 },
        sizeMUnit: "m",
        allowedSizeM: {
          x: [0.001, 0.14],
          y: [0.001, 0.09],
          z: [0.001, 0.2],
        },
        sourceKind: "engineering-initial",
        sourceRef: "BRIDGE LAB engineering-initial mass distribution ruling (2026-09-11)",
        confidence: "low",
      },
      {
        id: "lower-figure",
        massKg: 0.1,
        massKgUnit: "kg",
        allowedMassKg: [0.001, 0.32],
        centerM: { x: 0, y: 0.005, z: 0.11 },
        centerMUnit: "m",
        allowedCenterM: {
          x: [-0.07, 0.07],
          y: [-0.045, 0.045],
          z: [0, 0.2],
        },
        sizeM: { x: 0.08, y: 0.06, z: 0.06 },
        sizeMUnit: "m",
        allowedSizeM: {
          x: [0.001, 0.14],
          y: [0.001, 0.09],
          z: [0.001, 0.2],
        },
        sourceKind: "engineering-initial",
        sourceRef: "BRIDGE LAB engineering-initial mass distribution ruling (2026-09-11)",
        confidence: "low",
      },
      {
        id: "packing",
        massKg: 0.04,
        massKgUnit: "kg",
        allowedMassKg: [0.001, 0.32],
        centerM: { x: 0, y: 0.0101, z: 0.1035 },
        centerMUnit: "m",
        allowedCenterM: {
          x: [-0.07, 0.07],
          y: [-0.045, 0.045],
          z: [0, 0.2],
        },
        sizeM: { x: 0.12, y: 0.065, z: 0.035 },
        sizeMUnit: "m",
        allowedSizeM: {
          x: [0.001, 0.14],
          y: [0.001, 0.09],
          z: [0.001, 0.2],
        },
        sourceKind: "engineering-initial",
        sourceRef: "BRIDGE LAB engineering-initial mass distribution ruling (2026-09-11)",
        confidence: "low",
      },
    ]);
  });

  it("keeps every mass block inside the stated prize envelope", () => {
    const { widthM, depthM, heightM, massBlocks } = baselineProfile.prize;

    expect(
      massBlocks.every(
        ({ centerM, sizeM }) =>
          Math.abs(centerM.x) + sizeM.x / 2 <= widthM.value / 2 &&
          Math.abs(centerM.y) + sizeM.y / 2 <= depthM.value / 2 &&
          centerM.z - sizeM.z / 2 >= 0 &&
          centerM.z + sizeM.z / 2 <= heightM.value
      )
    ).toBe(true);
  });

  it("records a source reference for every parameter and mass block", () => {
    expect(allParameters(baselineProfile).every((parameter) => parameter.sourceRef.length > 0)).toBe(
      true
    );
    expect(
      baselineProfile.prize.massBlocks.every((block) => block.sourceRef.length > 0)
    ).toBe(true);
  });
});
