import { describe, expect, it } from "vitest";
import { baselineProfile } from "./baselineProfile";
import { playableProfile } from "./playableProfile";
import { validateProfile } from "./validateProfile";

type Mutable<T> = {
  -readonly [Key in keyof T]: T[Key] extends readonly (infer Item)[]
    ? Mutable<Item>[]
    : T[Key] extends object
      ? Mutable<T[Key]>
      : T[Key];
};

const mutablePlayable = (): Mutable<typeof playableProfile> =>
  structuredClone(playableProfile) as unknown as Mutable<typeof playableProfile>;

const validateMutablePlayable = (profile: Mutable<typeof playableProfile>) =>
  validateProfile(profile as unknown as typeof playableProfile);

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

  it("preserves the v0.1 profile as the original two-rod calibration", () => {
    expect(baselineProfile.id).toBe("bridge-lab-v0.1");
    expect(baselineProfile.bridge).toEqual(
      expect.objectContaining({
        rodDiameterM: expect.any(Object),
        rodCenterDistanceM: expect.any(Object),
        rodHeightDeltaM: expect.any(Object),
      })
    );
    expect("rods" in baselineProfile.bridge).toBe(false);
  });

  it("accepts four independently sourced playable rods", () => {
    expect(validateProfile(playableProfile)).toEqual([]);
    expect(playableProfile.bridge.rods.map((rod) => rod.id)).toEqual([
      "rod-1",
      "rod-2",
      "rod-3",
      "rod-4",
    ]);
  });

  it("defines local axes and a coherent four-rail engineering fixture", () => {
    expect(playableProfile.bridge.localAxes).toEqual({
      x: "cross-section-width",
      y: "cross-section-height",
      z: "longitudinal",
    });
    expect(playableProfile.bridge.rods.map((rod) => ({
      id: rod.id,
      center: [rod.centerM.x.value, rod.centerM.y.value, rod.centerM.z.value],
      yaw: rod.orientation.yDegrees.value,
      length: rod.lengthM.value,
    }))).toEqual([
      { id: "rod-1", center: [-0.08, 0, 0], yaw: 0, length: 0.45 },
      { id: "rod-2", center: [0.08, 0, 0], yaw: 0, length: 0.45 },
      { id: "rod-3", center: [0, -0.04, -0.27], yaw: 90, length: 0.45 },
      { id: "rod-4", center: [0, -0.04, 0.27], yaw: 90, length: 0.45 },
    ]);
  });

  it("rejects unique but non-standard rod IDs", () => {
    const profile = mutablePlayable();
    profile.bridge.rods.forEach((rod, index) => {
      rod.id = `rod-${index + 5}` as never;
    });
    expect(validateMutablePlayable(profile)).toContainEqual(expect.objectContaining({
      path: "bridge.rods",
      code: "INVALID_ROD_ID_SET",
    }));
  });

  it("rejects wrong rod units and malformed provenance metadata", () => {
    const profile = mutablePlayable();
    profile.bridge.rods[0].lengthM.unit = "kg";
    profile.bridge.rods[1].orientation.yDegrees.unit = "1";
    profile.bridge.rods[2].contact.staticFriction.sourceKind = "unsupported" as never;
    profile.bridge.rods[3].contact.restitution.confidence = "unrated" as never;

    expect(validateMutablePlayable(profile)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "bridge.rods[0].lengthM", code: "INVALID_UNIT" }),
      expect.objectContaining({ path: "bridge.rods[1].orientation.yDegrees", code: "INVALID_UNIT" }),
      expect.objectContaining({ path: "bridge.rods[2].contact.staticFriction", code: "INVALID_SOURCE_KIND" }),
      expect.objectContaining({ path: "bridge.rods[3].contact.restitution", code: "INVALID_CONFIDENCE" }),
    ]));
  });

  it("rejects physical values hidden inside permissive declared ranges", () => {
    const profile = mutablePlayable();
    profile.bridge.rods[0].contact.staticFriction.allowedRange = [-2, 2];
    profile.bridge.rods[0].contact.staticFriction.value = -0.1;
    profile.bridge.rods[1].contact.restitution.allowedRange = [-2, 2];
    profile.bridge.rods[1].contact.restitution.value = 1.1;

    expect(validateMutablePlayable(profile)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "bridge.rods[0].contact.staticFriction", code: "OUT_OF_DOMAIN" }),
      expect.objectContaining({ path: "bridge.rods[1].contact.restitution", code: "OUT_OF_DOMAIN" }),
    ]));
  });

  it("rejects declared ranges that extend outside physical domains", () => {
    const profile = mutablePlayable();
    profile.bridge.rods[0].lengthM.allowedRange = [-1, 1];
    profile.bridge.rods[1].contact.staticFriction.allowedRange = [-2, 2];
    profile.bridge.rods[2].contact.restitution.allowedRange = [0, 2];

    expect(validateMutablePlayable(profile)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "bridge.rods[0].lengthM", code: "RANGE_OUT_OF_DOMAIN" }),
      expect.objectContaining({ path: "bridge.rods[1].contact.staticFriction", code: "RANGE_OUT_OF_DOMAIN" }),
      expect.objectContaining({ path: "bridge.rods[2].contact.restitution", code: "RANGE_OUT_OF_DOMAIN" }),
    ]));
  });

  it("rejects a playable profile with three rods", () => {
    const profile = mutablePlayable();
    profile.bridge.rods.pop();
    expect(validateMutablePlayable(profile)).toContainEqual(expect.objectContaining({
      path: "bridge.rods",
      code: "INVALID_ROD_COUNT",
    }));
  });

  it("rejects duplicate rod IDs", () => {
    const profile = mutablePlayable();
    profile.bridge.rods[1].id = "rod-1";
    expect(validateMutablePlayable(profile)).toContainEqual(expect.objectContaining({
      path: "bridge.rods[1].id",
      code: "DUPLICATE_ROD_ID",
    }));
  });

  it("rejects non-positive rod lengths", () => {
    const profile = mutablePlayable();
    profile.bridge.rods[0].lengthM.value = 0;
    expect(validateMutablePlayable(profile)).toContainEqual(expect.objectContaining({
      path: "bridge.rods[0].lengthM",
      code: "INVALID_VALUE",
    }));
  });

  it("rejects unsupported rod cross-sections", () => {
    const profile = mutablePlayable();
    profile.bridge.rods[0].crossSection = { kind: "square", widthM: profile.bridge.rods[0].lengthM } as never;
    expect(validateMutablePlayable(profile)).toContainEqual(expect.objectContaining({
      path: "bridge.rods[0].crossSection",
      code: "UNSUPPORTED_CROSS_SECTION",
    }));
  });

  it("rejects empty rod source references", () => {
    const profile = mutablePlayable();
    profile.bridge.rods[0].centerM.x.sourceRef = "   ";
    expect(validateMutablePlayable(profile)).toContainEqual(expect.objectContaining({
      path: "bridge.rods[0].centerM.x",
      code: "EMPTY_SOURCE_REF",
    }));
  });

  it("rejects per-rod dynamic friction above static friction", () => {
    const profile = mutablePlayable();
    profile.bridge.rods[0].contact.dynamicFriction.value = 0.5;
    expect(validateMutablePlayable(profile)).toContainEqual(expect.objectContaining({
      path: "bridge.rods[0].contact.dynamicFriction",
      code: "DYNAMIC_EXCEEDS_STATIC",
    }));
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
