export type Confidence = "high" | "medium" | "low" | "unknown";

export type SourceKind =
  | "measured"
  | "manufacturer"
  | "published"
  | "inferred"
  | "engineering-initial"
  | "unknown";

export type Unit = "1" | "deg" | "kg" | "m" | "m/s²" | "s" | "s⁻¹";

export interface SourcedParameter {
  readonly key: string;
  value: number;
  readonly unit: Unit;
  readonly allowedRange: readonly [number, number];
  readonly sourceKind: SourceKind;
  readonly sourceRef: string;
  readonly confidence: Confidence;
  readonly calibrationDate?: string;
}

export interface Vector3M {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SourcedVector3M {
  readonly x: SourcedParameter;
  readonly y: SourcedParameter;
  readonly z: SourcedParameter;
}

export interface RodOrientation {
  /** Right-handed intrinsic XYZ Euler angles in engine X-right/Y-up/Z-depth axes. */
  readonly convention: "intrinsic-xyz-degrees";
  readonly xDegrees: SourcedParameter;
  readonly yDegrees: SourcedParameter;
  readonly zDegrees: SourcedParameter;
}

export type RodCrossSection =
  | { readonly kind: "circular"; readonly diameterM: SourcedParameter }
  | {
      readonly kind: "rounded-rectangular";
      readonly widthM: SourcedParameter;
      readonly heightM: SourcedParameter;
      readonly cornerRadiusM: SourcedParameter;
    };

export interface PlayableRod {
  readonly id: "rod-1" | "rod-2" | "rod-3" | "rod-4";
  readonly centerM: SourcedVector3M;
  readonly orientation: RodOrientation;
  readonly lengthM: SourcedParameter;
  readonly crossSection: RodCrossSection;
  readonly materialId: string;
  readonly contact: {
    readonly staticFriction: SourcedParameter;
    readonly dynamicFriction: SourcedParameter;
    readonly restitution: SourcedParameter;
  };
}

export type NumericRange = readonly [number, number];

export interface Vector3Range {
  readonly x: NumericRange;
  readonly y: NumericRange;
  readonly z: NumericRange;
}

/**
 * A body-aligned internal mass distribution input. The source metadata covers
 * the complete engineering-initial block, whose mass, centre, and dimensions
 * are used together by the later mass-properties calculation.
 */
export interface MassBlock {
  readonly id: string;
  readonly massKg: number;
  readonly massKgUnit: "kg";
  readonly allowedMassKg: NumericRange;
  readonly centerM: Vector3M;
  readonly centerMUnit: "m";
  readonly allowedCenterM: Vector3Range;
  readonly sizeM: Vector3M;
  readonly sizeMUnit: "m";
  readonly allowedSizeM: Vector3Range;
  readonly sourceKind: SourceKind;
  readonly sourceRef: string;
  readonly confidence: Confidence;
}

export interface CalibrationProfile {
  readonly id: string;
  readonly physics: {
    readonly stepSeconds: SourcedParameter;
  };
  readonly environment: {
    readonly gravityMps2: SourcedParameter;
  };
  readonly prize: {
    readonly widthM: SourcedParameter;
    readonly depthM: SourcedParameter;
    readonly heightM: SourcedParameter;
    readonly massKg: SourcedParameter;
    readonly centerOfMassRatioX: SourcedParameter;
    readonly centerOfMassRatioY: SourcedParameter;
    readonly centerOfMassRatioZ: SourcedParameter;
    readonly massBlocks: readonly MassBlock[];
  };
  readonly bridge: {
    readonly rodDiameterM: SourcedParameter;
    readonly rodCenterDistanceM: SourcedParameter;
    readonly rodHeightDeltaM: SourcedParameter;
  };
  readonly contacts: {
    readonly boxRodStaticFriction: SourcedParameter;
    readonly boxRodDynamicFriction: SourcedParameter;
    readonly restitution: SourcedParameter;
  };
  readonly damping: {
    readonly linearPerSecond: SourcedParameter;
    readonly angularPerSecond: SourcedParameter;
  };
}

/** Four-rod engineering fixture. CalibrationProfile remains the legacy v0.1 contract. */
export interface PlayableCalibrationProfile
  extends Omit<CalibrationProfile, "bridge"> {
  readonly kind: "playable-four-rod";
  readonly bridge: {
    readonly localAxes: {
      readonly x: "cross-section-width";
      readonly y: "cross-section-height";
      readonly z: "longitudinal";
    };
    readonly rods: readonly PlayableRod[];
  };
}

export type SupportedCalibrationProfile = CalibrationProfile | PlayableCalibrationProfile;

export type ProfileIssueCode =
  | "OUT_OF_RANGE"
  | "INVALID_RANGE"
  | "INVALID_VALUE"
  | "EMPTY_SOURCE_REF"
  | "INVALID_SOURCE_KIND"
  | "INVALID_CONFIDENCE"
  | "INVALID_UNIT"
  | "BLOCK_OUTSIDE_ENVELOPE"
  | "DYNAMIC_EXCEEDS_STATIC"
  | "INVALID_ROD_COUNT"
  | "DUPLICATE_ROD_ID"
  | "INVALID_ROD_ID_SET"
  | "OUT_OF_DOMAIN"
  | "RANGE_OUT_OF_DOMAIN"
  | "UNSUPPORTED_CROSS_SECTION";

export interface ProfileIssue {
  readonly path: string;
  readonly code: ProfileIssueCode;
  readonly message: string;
}
