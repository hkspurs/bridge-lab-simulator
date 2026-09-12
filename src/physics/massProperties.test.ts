import { describe, expect, it } from "vitest";
import { baselineProfile } from "../config/baselineProfile";
import { expectVectorCloseTo } from "../test/setup";
import { computeMassProperties } from "./massProperties";

type NumericMassBlock = {
  massKg: number;
  centerM: { x: number; y: number; z: number };
  sizeM: { x: number; y: number; z: number };
};

const validBlock = (): NumericMassBlock => ({
  massKg: 1,
  centerM: { x: 0, y: 0, z: 0 },
  sizeM: { x: 0.1, y: 0.1, z: 0.1 },
});

describe("computeMassProperties", () => {
  it("places COM at the mass-weighted position", () => {
    const result = computeMassProperties([
      { massKg: 1, centerM: { x: 0, y: 0, z: 0 }, sizeM: { x: 0.1, y: 0.1, z: 0.1 } },
      { massKg: 3, centerM: { x: 0.04, y: -0.02, z: 0.2 }, sizeM: { x: 0.1, y: 0.1, z: 0.1 } },
    ]);

    expect(result.massKg).toBeCloseTo(4, 12);
    expectVectorCloseTo(result.centerOfMassM, { x: 0.03, y: -0.015, z: 0.15 });
  });

  it("uses each body-aligned cuboid's centre inertia", () => {
    const result = computeMassProperties([
      { massKg: 12, centerM: { x: 0, y: 0, z: 0 }, sizeM: { x: 2, y: 3, z: 4 } },
    ]);

    expect(result.inertiaKgM2).toEqual([25, 0, 0, 20, 0, 13]);
  });

  it("uses the parallel-axis theorem for separated blocks", () => {
    const result = computeMassProperties([
      { massKg: 1, centerM: { x: -0.1, y: 0, z: 0 }, sizeM: { x: 0.02, y: 0.02, z: 0.02 } },
      { massKg: 1, centerM: { x: 0.1, y: 0, z: 0 }, sizeM: { x: 0.02, y: 0.02, z: 0.02 } },
    ]);

    expect(result.inertiaKgM2[3]).toBeGreaterThan(0.02);
    expect(result.inertiaKgM2[5]).toBeGreaterThan(0.02);
  });

  it("includes negative off-diagonal products in the composite tensor", () => {
    const result = computeMassProperties([
      { massKg: 1, centerM: { x: 1, y: 2, z: 3 }, sizeM: { x: 1, y: 1, z: 1 } },
      { massKg: 1, centerM: { x: -1, y: -2, z: -3 }, sizeM: { x: 1, y: 1, z: 1 } },
    ]);

    expect(result.inertiaKgM2[1]).toBeCloseTo(-4, 12);
    expect(result.inertiaKgM2[2]).toBeCloseTo(-6, 12);
    expect(result.inertiaKgM2[4]).toBeCloseTo(-12, 12);
  });

  it("accepts sourced profile mass blocks through the narrower numeric interface", () => {
    const result = computeMassProperties(baselineProfile.prize.massBlocks);

    expect(result.massKg).toBeCloseTo(0.32, 12);
    expect(result.centerOfMassM.z).toBeGreaterThan(baselineProfile.prize.heightM.value / 2);
  });

  it("rejects an empty block list", () => {
    expect(() => computeMassProperties([])).toThrow("blocks must not be empty");
  });

  it.each([
    ["a non-finite mass", (block: NumericMassBlock) => (block.massKg = Number.NaN), "massKg must be finite"],
    ["a non-finite centre", (block: NumericMassBlock) => (block.centerM.y = Infinity), "centerM.y must be finite"],
    ["a non-finite dimension", (block: NumericMassBlock) => (block.sizeM.z = Number.NaN), "sizeM.z must be finite"],
    ["zero mass", (block: NumericMassBlock) => (block.massKg = 0), "massKg must be greater than zero"],
    ["negative mass", (block: NumericMassBlock) => (block.massKg = -1), "massKg must be greater than zero"],
    ["zero dimension", (block: NumericMassBlock) => (block.sizeM.x = 0), "sizeM.x must be greater than zero"],
    ["a negative dimension", (block: NumericMassBlock) => (block.sizeM.z = -1), "sizeM.z must be greater than zero"],
  ])("rejects %s", (_description, mutate, message) => {
    const block = validBlock();
    mutate(block);

    expect(() => computeMassProperties([block])).toThrow(message);
  });
});
