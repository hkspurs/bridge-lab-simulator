import type {
  Confidence,
  MassBlock,
  NumericRange,
  PlayableCalibrationProfile,
  PlayableRod,
  ProfileIssue,
  SourceKind,
  SourcedParameter,
  SupportedCalibrationProfile,
  Unit,
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
type ParameterRule = {
  readonly path: string;
  readonly parameter: SourcedParameter;
  readonly expectedUnit: Unit;
  readonly domain?: NumericRange;
  readonly positive?: boolean;
};

const sourcedParameters = (
  profile: SupportedCalibrationProfile
): readonly ParameterRule[] => [
  { path: "physics.stepSeconds", parameter: profile.physics.stepSeconds, expectedUnit: "s", positive: true },
  { path: "environment.gravityMps2", parameter: profile.environment.gravityMps2, expectedUnit: "m/s²", domain: [0, Infinity] },
  { path: "prize.widthM", parameter: profile.prize.widthM, expectedUnit: "m", positive: true },
  { path: "prize.depthM", parameter: profile.prize.depthM, expectedUnit: "m", positive: true },
  { path: "prize.heightM", parameter: profile.prize.heightM, expectedUnit: "m", positive: true },
  { path: "prize.massKg", parameter: profile.prize.massKg, expectedUnit: "kg", positive: true },
  { path: "prize.centerOfMassRatioX", parameter: profile.prize.centerOfMassRatioX, expectedUnit: "1", domain: [-1, 1] },
  { path: "prize.centerOfMassRatioY", parameter: profile.prize.centerOfMassRatioY, expectedUnit: "1", domain: [-1, 1] },
  { path: "prize.centerOfMassRatioZ", parameter: profile.prize.centerOfMassRatioZ, expectedUnit: "1", domain: [-1, 1] },
  { path: "contacts.boxRodStaticFriction", parameter: profile.contacts.boxRodStaticFriction, expectedUnit: "1", domain: [0, 1] },
  { path: "contacts.boxRodDynamicFriction", parameter: profile.contacts.boxRodDynamicFriction, expectedUnit: "1", domain: [0, 1] },
  { path: "contacts.restitution", parameter: profile.contacts.restitution, expectedUnit: "1", domain: [0, 1] },
  { path: "damping.linearPerSecond", parameter: profile.damping.linearPerSecond, expectedUnit: "s⁻¹", domain: [0, Infinity] },
  { path: "damping.angularPerSecond", parameter: profile.damping.angularPerSecond, expectedUnit: "s⁻¹", domain: [0, Infinity] },
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

const blockFitsPrizeEnvelope = (block: MassBlock, profile: SupportedCalibrationProfile): boolean => {
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
  profile: SupportedCalibrationProfile
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

const isPlayableProfile = (
  profile: SupportedCalibrationProfile
): profile is PlayableCalibrationProfile =>
  "kind" in profile && profile.kind === "playable-four-rod";

const rodParameters = (rod: PlayableRod, index: number) => {
  const path = `bridge.rods[${index}]`;
  const values: ParameterRule[] = [
    ...vectorAxes.map((axis) => ({ path: `${path}.centerM.${axis}`, parameter: rod.centerM[axis], expectedUnit: "m" as const })),
    { path: `${path}.orientation.xDegrees`, parameter: rod.orientation.xDegrees, expectedUnit: "deg", domain: [-180, 180] },
    { path: `${path}.orientation.yDegrees`, parameter: rod.orientation.yDegrees, expectedUnit: "deg", domain: [-180, 180] },
    { path: `${path}.orientation.zDegrees`, parameter: rod.orientation.zDegrees, expectedUnit: "deg", domain: [-180, 180] },
    { path: `${path}.lengthM`, parameter: rod.lengthM, expectedUnit: "m", positive: true },
    { path: `${path}.contact.staticFriction`, parameter: rod.contact.staticFriction, expectedUnit: "1", domain: [0, 1] },
    { path: `${path}.contact.dynamicFriction`, parameter: rod.contact.dynamicFriction, expectedUnit: "1", domain: [0, 1] },
    { path: `${path}.contact.restitution`, parameter: rod.contact.restitution, expectedUnit: "1", domain: [0, 1] },
  ];
  if (rod.crossSection.kind === "circular") {
    values.push({ path: `${path}.crossSection.diameterM`, parameter: rod.crossSection.diameterM, expectedUnit: "m", positive: true });
  } else if (rod.crossSection.kind === "rounded-rectangular") {
    values.push(
      { path: `${path}.crossSection.widthM`, parameter: rod.crossSection.widthM, expectedUnit: "m", positive: true },
      { path: `${path}.crossSection.heightM`, parameter: rod.crossSection.heightM, expectedUnit: "m", positive: true },
      { path: `${path}.crossSection.cornerRadiusM`, parameter: rod.crossSection.cornerRadiusM, expectedUnit: "m", positive: true }
    );
  }
  return values;
};

export const validateProfile = (profile: SupportedCalibrationProfile): readonly ProfileIssue[] => {
  const issues: ProfileIssue[] = [];

  const parameters: ParameterRule[] = [
    ...sourcedParameters(profile),
  ];
  if (isPlayableProfile(profile)) {
    profile.bridge.rods.forEach((rod, index) => parameters.push(...rodParameters(rod, index)));
  } else {
    parameters.push(
      { path: "bridge.rodDiameterM", parameter: profile.bridge.rodDiameterM, expectedUnit: "m", positive: true },
      { path: "bridge.rodCenterDistanceM", parameter: profile.bridge.rodCenterDistanceM, expectedUnit: "m", positive: true },
      { path: "bridge.rodHeightDeltaM", parameter: profile.bridge.rodHeightDeltaM, expectedUnit: "m" }
    );
  }

  for (const { path, parameter, expectedUnit, domain, positive } of parameters) {
    const [minimum, maximum] = parameter.allowedRange;

    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum > maximum) {
      issues.push({
        path,
        code: "INVALID_RANGE",
        message: `Invalid allowed range for ${parameter.key}`,
      });
      continue;
    }

    if (!Number.isFinite(parameter.value) || (positive && parameter.value <= 0)) {
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
    if (parameter.unit !== expectedUnit) {
      issues.push({ path, code: "INVALID_UNIT", message: `${parameter.key} must use ${expectedUnit}` });
    }
    if (!sourceKinds.includes(parameter.sourceKind)) {
      issues.push({ path, code: "INVALID_SOURCE_KIND", message: `${parameter.key} source kind is invalid` });
    }
    if (!confidenceLevels.includes(parameter.confidence)) {
      issues.push({ path, code: "INVALID_CONFIDENCE", message: `${parameter.key} confidence is invalid` });
    }
    if (domain && (parameter.value < domain[0] || parameter.value > domain[1])) {
      issues.push({ path, code: "OUT_OF_DOMAIN", message: `${parameter.key} is outside its physical domain` });
    }
    const rangeOutsideDomain = domain &&
      (parameter.allowedRange[0] < domain[0] || parameter.allowedRange[1] > domain[1]);
    if (rangeOutsideDomain || (positive && parameter.allowedRange[0] <= 0)) {
      issues.push({
        path,
        code: "RANGE_OUT_OF_DOMAIN",
        message: `${parameter.key} allowed range extends outside its physical domain`,
      });
    }
  }

  profile.prize.massBlocks.forEach((block, index) => {
    validateMassBlock(issues, block, index, profile);
  });

  if (isPlayableProfile(profile)) {
    if (profile.bridge.rods.length !== 4) {
      issues.push({ path: "bridge.rods", code: "INVALID_ROD_COUNT", message: "Playable profiles require exactly four rods" });
    }
    const ids = new Set<string>();
    profile.bridge.rods.forEach((rod, index) => {
      if (ids.has(rod.id)) {
        issues.push({ path: `bridge.rods[${index}].id`, code: "DUPLICATE_ROD_ID", message: `Duplicate rod ID: ${rod.id}` });
      }
      ids.add(rod.id);
      if (rod.crossSection.kind !== "circular" && rod.crossSection.kind !== "rounded-rectangular") {
        issues.push({ path: `bridge.rods[${index}].crossSection`, code: "UNSUPPORTED_CROSS_SECTION", message: `Unsupported rod cross-section` });
      }
      if (rod.contact.dynamicFriction.value > rod.contact.staticFriction.value) {
        issues.push({ path: `bridge.rods[${index}].contact.dynamicFriction`, code: "DYNAMIC_EXCEEDS_STATIC", message: "Dynamic friction must not exceed static friction" });
      }
    });
    const stableIds = ["rod-1", "rod-2", "rod-3", "rod-4"];
    if (stableIds.some((id) => !ids.has(id))) {
      issues.push({ path: "bridge.rods", code: "INVALID_ROD_ID_SET", message: "Playable profiles require rod-1 through rod-4" });
    }
  }

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
