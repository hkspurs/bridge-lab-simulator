export type Vec3 = Readonly<{
  x: number;
  y: number;
  z: number;
}>;
export type Quat = Readonly<{
  x: number;
  y: number;
  z: number;
  w: number;
}>;
export type Phase = "READY" | "MOVE_AXIS_1" | "MOVE_AXIS_2" | "DROP" | "CLOSE" | "LIFT" | "RETURN" | "OPEN" | "SETTLE" | "REVIEW" | "PAUSED" | "FAULT";
export type Axis = 1 | 2;
export type InputEvent = {
  type: "press" | "release";
  axis: Axis;
} | {
  type: "cancel" | "resume" | "continue";
};
export type RigObservation = Readonly<{
  atDropLimit: boolean;
  atLiftLimit: boolean;
  atHome: boolean;
  /** Optional manual-axis stops preserve compatibility with rigs that clamp travel internally. */
  atAxis1Limit?: boolean;
  atAxis2Limit?: boolean;
  openReached: boolean;
  prizeSettled: boolean;
  /** Speed samples let a rig report the documented settle thresholds directly. */
  prizeLinearSpeedMps?: number;
  prizeAngularSpeedRadps?: number;
  invalidPhysics: boolean;
}>;
export type RigCommand = Readonly<{
  travel: "stop" | "axis1" | "axis2" | "down" | "up" | "home";
  claw: "open" | "close" | "hold";
}>;
export type ClawRig = {
  command(value: RigCommand): void;
  beforeStep(dt: number): void;
  observe(): RigObservation;
  dispose(): void;
};
