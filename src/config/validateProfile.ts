import type {
  CalibrationProfile,
  Confidence,
  MassBlock,
  NumericRange,
  ProfileIssue,
  SourceKind,
  SourcedParameter,
} from "./types";

const confidenceLevels: readonly Confidence[] = ["high", "medium", "low", "unknown"];
const sourceKinds: readonly SourceKind[] = [
  "measured",
  "manufacturer",
  "published",
  "inferred",
  "engineering-initial",
  "unknown",
];
const vectorAxes = ["x", "y", "z"] as const;

const sourcedParameters = (
  profile: CalibrationProfile
): readonly { readonly path: string; readonly parameter: SourcedParameter }[] => [
  { path: "physics.stepSeconds", parameter: profile.physics.stepSeconds },
  { path: "environment.gravityMps2", parameter: profile.environment.gravityMps2 },
  { path: "prize.widthM", parameter: profile.prize.widthM },
  { path: "prize.depthM", parameter: profile.prize.depthM },
  { path: "prize.heightM", parameter: profile.prize.heightM },
  { path: "prize.massKg", parameter: profile.prize.massKg },
  { path: "prize.centerOfMassRatioX", parameter: profile.prize.centerOfMassRatioX },
  { path: "prize.centerOfMassRatioY", parameter: profile.prize.centerOfMassRatioY },
  { path: "prize.centerOfMassRatioZ", parameter: profile.prize.centerOfMassRatioZ },
  { path: "bridge.rodDiameterM", parameter: profile.bridge.rodDiameterM },
  { path: "bridge.rodCenterDistanceM", parameter: profile.bridge.rodCenterDistanceM },
  { path: "bridge.rodHeightDeltaM", parameter: profile.bridge.rodHeightDeltaM },
  { path: "contacts.boxRodStaticFriction", parameter: profile.contacts.boxRodStaticFriction },
  { path: "contacts.boxRodDynamicFriction", parameter: profile.contacts.boxRodDynamicFriction },
  { path: "contacts.restitution", parameter: profile.contacts.restitution },
  { path: "damping.linearPerSecond", parameter: profile.damping.linearPerSecond },
  { path: "damping.angularPerSecond", parameter: profile.damping.angularPerSecond },
];

const rangeText = (minimum: number, maximum: number, unit: string): string =>
  `${minimum}..${maximum} ${unit}`;

const hasValidRange = ([minimum, maximum]: NumericRange): boolean =>
  Number.isFinite(minimum) && Number.isFinite(maximum) && minimum <= maximum;

const validateMassBlockValue = (
  issues: ProfileIssue[],
  path: string,
  value: number,
  allowedRange: NumericRange,
  unit: "kg" | "m",
  mustBePositive: boolean
): void => {
  const [minimum, maximum] = allowedRange;

  if (!hasValidRange(allowedRange)) {
    issues.push({
      path,
      code: "INVALID_RANGE",
      message: `Invalid allowed range for ${path}`,
    });
    return;
  }

  if (!Number.isFinite(value) || (mustBePositive && value <= 0)) {
    issues.push({
      path,
      code: "INVALID_VALUE",
      message: `${path} must be finite${mustBePositive ? " and positive" : ""}`,
    });
    return;
  }

  if (value < minimum || value > maximum) {
    issues.push({
      path,
      code: "OUT_OF_RANGE",
      message: `${value} is outside ${rangeText(minimum, maximum, unit)}`,
    });
  }
};

const blockFitsPrizeEnvelope = (block: MassBlock, profile: CalibrationProfile): boolean => {
  const { widthM, depthM, heightM } = profile.prize;
  const values = [
    block.centerM.x,
    block.centerM.y,
    block.centerM.z,
    block.sizeM.x,
    block.sizeM.y,
    block.sizeM.z,
    widthM.value,
    depthM.value,
    heightM.value,
  ];

  if (values.some((value) => !Number.isFinite(value))) {
    return true;
  }

  return (
    Math.abs(block.centerM.x) + block.sizeM.x / 2 <= widthM.value / 2 &&
    Math.abs(block.centerM.y) + block.sizeM.y / 2 <= depthM.value / 2 &&
    block.centerM.z - block.sizeM.z / 2 >= 0 &&
    block.centerM.z + block.sizeM.z / 2 <= heightM.value
  );
};

const validateMassBlock = (
  issues: ProfileIssue[],
  block: MassBlock,
  index: number,
  profile: CalibrationProfile
): void => {
  const path = `prize.massBlocks[${index}]`;

  if (block.massKgUnit !== "kg") {
    issues.push({
      path: `${path}.massKgUnit`,
      code: "INVALID_UNIT",
      message: "Mass block mass must use kg",
    });
  }
  if (block.centerMUnit !== "m") {
    issues.push({
      path: `${path}.centerMUnit`,
      code: "INVALID_UNIT",
      message: "Mass block centre must use m",
    });
  }
  if (block.sizeMUnit !== "m") {
    issues.push({
      path: `${path}.sizeMUnit`,
      code: "INVALID_UNIT",
      message: "Mass block dimensions must use m",
    });
  }

  validateMassBlockValue(
    issues,
    `${path}.massKg`,
    block.massKg,
    block.allowedMassKg,
    "kg",
    true
  );
  for (const axis of vectorAxes) {
    validateMassBlockValue(
      issues,
      `${path}.centerM.${axis}`,
      block.centerM[axis],
      block.allowedCenterM[axis],
      "m",
      false
    );
    validateMassBlockValue(
      issues,
      `${path}.sizeM.${axis}`,
      block.sizeM[axis],
      block.allowedSizeM[axis],
      "m",
      true
    );
  }

  if (block.sourceRef.trim().length === 0) {
    issues.push({
      path,
      code: "EMPTY_SOURCE_REF",
      message: "Mass block must include a source reference",
    });
  }
  if (!sourceKinds.includes(block.sourceKind)) {
    issues.push({
      path,
      code: "INVALID_SOURCE_KIND",
      message: "Mass block source kind is invalid",
    });
  }
  if (!confidenceLevels.includes(block.confidence)) {
    issues.push({
      path,
      code: "INVALID_CONFIDENCE",
      message: "Mass block confidence is invalid",
    });
  }
  if (!blockFitsPrizeEnvelope(block, profile)) {
    issues.push({
      path,
      code: "BLOCK_OUTSIDE_ENVELOPE",
      message: "Mass block must fit completely inside the prize envelope",
    });
  }
};

export const validateProfile = (profile: CalibrationProfile): readonly ProfileIssue[] => {
  const issues: ProfileIssue[] = [];

  for (const { path, parameter } of sourcedParameters(profile)) {
    const [minimum, maximum] = parameter.allowedRange;

    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum > maximum) {
      issues.push({
        path,
        code: "INVALID_RANGE",
        message: `Invalid allowed range for ${parameter.key}`,
      });
      continue;
    }

    if (!Number.isFinite(parameter.value)) {
      issues.push({
        path,
        code: "INVALID_VALUE",
        message: `${parameter.key} must be finite`,
      });
    } else if (parameter.value < minimum || parameter.value > maximum) {
      issues.push({
        path,
        code: "OUT_OF_RANGE",
        message: `${parameter.value} is outside ${rangeText(minimum, maximum, parameter.unit)}`,
      });
    }

    if (parameter.sourceRef.trim().length === 0) {
      issues.push({
        path,
        code: "EMPTY_SOURCE_REF",
        message: `${parameter.key} must include a source reference`,
      });
    }
  }

  profile.prize.massBlocks.forEach((block, index) => {
    validateMassBlock(issues, block, index, profile);
  });

  if (
    profile.contacts.boxRodDynamicFriction.value >
    profile.contacts.boxRodStaticFriction.value
  ) {
    issues.push({
      path: "contacts.boxRodDynamicFriction",
      code: "DYNAMIC_EXCEEDS_STATIC",
      message: "Dynamic friction must not exceed static friction",
    });
  }

  return issues;
};
