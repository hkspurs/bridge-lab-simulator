import { baselineProfile } from "./baselineProfile";
import type {
  PlayableCalibrationProfile,
  PlayableRod,
  SourcedParameter,
} from "./types";

const fixtureRef = "docs/research/four-rod-annotations.md (engineering fixture; source recording unavailable)";

const estimate = (
  key: string,
  value: number,
  unit: SourcedParameter["unit"],
  allowedRange: readonly [number, number]
): SourcedParameter => ({
  key,
  value,
  unit,
  allowedRange,
  sourceKind: "engineering-initial",
  sourceRef: fixtureRef,
  confidence: "low",
});

const rod = (
  id: PlayableRod["id"],
  x: number,
  y: number,
  z: number,
  zDegrees: number,
  crossSection: PlayableRod["crossSection"]
): PlayableRod => ({
  id,
  centerM: {
    x: estimate(`bridge.${id}.centerM.x`, x, "m", [-0.3, 0.3]),
    y: estimate(`bridge.${id}.centerM.y`, y, "m", [-0.1, 0.3]),
    z: estimate(`bridge.${id}.centerM.z`, z, "m", [-0.3, 0.3]),
  },
  orientation: {
    convention: "intrinsic-xyz-degrees",
    xDegrees: estimate(`bridge.${id}.orientation.xDegrees`, 0, "deg", [-180, 180]),
    yDegrees: estimate(`bridge.${id}.orientation.yDegrees`, zDegrees, "deg", [-180, 180]),
    zDegrees: estimate(`bridge.${id}.orientation.zDegrees`, 0, "deg", [-180, 180]),
  },
  lengthM: estimate(`bridge.${id}.lengthM`, 0.45, "m", [0.3, 0.6]),
  crossSection,
  materialId: "fixture-low-friction-polymer",
  contact: {
    staticFriction: estimate(`bridge.${id}.contact.staticFriction`, 0.34, "1", [0.2, 0.55]),
    dynamicFriction: estimate(`bridge.${id}.contact.dynamicFriction`, 0.26, "1", [0.14, 0.42]),
    restitution: estimate(`bridge.${id}.contact.restitution`, 0.06, "1", [0.02, 0.15]),
  },
});

const circular = (id: PlayableRod["id"]): PlayableRod["crossSection"] => ({
  kind: "circular",
  diameterM: estimate(`bridge.${id}.crossSection.diameterM`, 0.025, "m", [0.02, 0.03]),
});

const rounded = (id: PlayableRod["id"]): PlayableRod["crossSection"] => ({
  kind: "rounded-rectangular",
  widthM: estimate(`bridge.${id}.crossSection.widthM`, 0.03, "m", [0.02, 0.05]),
  heightM: estimate(`bridge.${id}.crossSection.heightM`, 0.025, "m", [0.015, 0.04]),
  cornerRadiusM: estimate(`bridge.${id}.crossSection.cornerRadiusM`, 0.008, "m", [0.002, 0.0125]),
});

export const playableProfile: Readonly<PlayableCalibrationProfile> = {
  ...baselineProfile,
  id: "bridge-lab-playable-v1-engineering-fixture",
  kind: "playable-four-rod",
  bridge: {
    localAxes: {
      x: "cross-section-width",
      y: "cross-section-height",
      z: "longitudinal",
    },
    rods: [
      rod("rod-1", -0.08, 0, 0, 0, circular("rod-1")),
      rod("rod-2", 0.08, 0, 0, 0, circular("rod-2")),
      rod("rod-3", 0, -0.04, -0.27, 90, rounded("rod-3")),
      rod("rod-4", 0, -0.04, 0.27, 90, rounded("rod-4")),
    ],
  },
};
