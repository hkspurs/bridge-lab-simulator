import { describe, expect, it } from "vitest";
import { baselineProfile } from "./baselineProfile";
import { validateProfile } from "./validateProfile";

type MutableMassBlock = {
  massKg: number;
  massKgUnit: "kg";
  allowedMassKg: [number, number];
  centerM: { x: number; y: number; z: number };
  sizeM: { x: number; y: number; z: number };
  sourceKind: string;
  sourceRef: string;
  confidence: string;
};

const mutableBlocks = (profile: typeof baselineProfile): MutableMassBlock[] =>
  profile.prize.massBlocks as unknown as MutableMassBlock[];

describe("validateProfile", () => {
  it("accepts the approved v0.1 baseline", () => {
    expect(validateProfile(baselineProfile)).toEqual([]);
  });

  it("rejects a value outside its declared range", () => {
    const profile = structuredClone(baselineProfile);
    profile.prize.massKg.value = 0.6;

    expect(validateProfile(profile)).toContainEqual({
      path: "prize.massKg",
      code: "OUT_OF_RANGE",
      message: "0.6 is outside 0.22..0.48 kg",
    });
  });

  it("rejects dynamic friction greater than static friction", () => {
    const profile = structuredClone(baselineProfile);
    profile.contacts.boxRodDynamicFriction.value = 0.5;

    expect(validateProfile(profile).map((issue) => issue.code)).toContain(
      "DYNAMIC_EXCEEDS_STATIC"
    );
  });

  it("rejects mass-block values that are non-positive or outside their declared ranges", () => {
    const profile = structuredClone(baselineProfile);
    const blocks = mutableBlocks(profile);
    blocks[0].massKg = 0;
    blocks[1].sizeM.x = 0;
    blocks[1].sizeM.z = Number.NaN;
    blocks[2].allowedMassKg = [0.2, 0.1];
    blocks[3].centerM.y = 0.05;

    expect(validateProfile(profile)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "prize.massBlocks[0].massKg",
          code: "INVALID_VALUE",
        }),
        expect.objectContaining({
          path: "prize.massBlocks[1].sizeM.x",
          code: "INVALID_VALUE",
        }),
        expect.objectContaining({
          path: "prize.massBlocks[1].sizeM.z",
          code: "INVALID_VALUE",
        }),
        expect.objectContaining({
          path: "prize.massBlocks[2].massKg",
          code: "INVALID_RANGE",
        }),
        expect.objectContaining({
          path: "prize.massBlocks[3].centerM.y",
          code: "OUT_OF_RANGE",
        }),
      ])
    );
  });

  it("rejects mass-block provenance with blank or invalid metadata", () => {
    const profile = structuredClone(baselineProfile);
    const blocks = mutableBlocks(profile);
    blocks[0].sourceRef = "   ";
    blocks[1].sourceKind = "unsupported";
    blocks[2].confidence = "unrated";
    blocks[3].massKgUnit = "m" as never;

    expect(validateProfile(profile)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "prize.massBlocks[0]",
          code: "EMPTY_SOURCE_REF",
        }),
        expect.objectContaining({
          path: "prize.massBlocks[1]",
          code: "INVALID_SOURCE_KIND",
        }),
        expect.objectContaining({
          path: "prize.massBlocks[2]",
          code: "INVALID_CONFIDENCE",
        }),
        expect.objectContaining({
          path: "prize.massBlocks[3].massKgUnit",
          code: "INVALID_UNIT",
        }),
      ])
    );
  });

  it("rejects a mass block that extends outside the prize envelope", () => {
    const profile = structuredClone(baselineProfile);
    mutableBlocks(profile)[0].centerM.z = 0.199;

    expect(validateProfile(profile)).toContainEqual({
      path: "prize.massBlocks[0]",
      code: "BLOCK_OUTSIDE_ENVELOPE",
      message: "Mass block must fit completely inside the prize envelope",
    });
  });
});
