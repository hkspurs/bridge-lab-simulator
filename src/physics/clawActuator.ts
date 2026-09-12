import type { ClawProfile } from "../config/clawProfile";
import type { Quat, Vec3, RigCommand } from "../crane/types";
export function clampTorque(requested: number, limit: number): number {
  if (!Number.isFinite(requested) || !Number.isFinite(limit) || limit < 0)
    throw new Error("Invalid torque input");
  return Math.max(-limit, Math.min(limit, requested));
}
/** Velocity motor; Havok's angular maximum-force parameter is torque (N·m).
 * momentArmM is |(contactPoint - hinge) × contactNormal| projected on the hinge axis.
 * The reserve allows gravity and solver error; impacts are reported separately.
 */
export function motorDemand(angleRad: number, targetRad: number, momentArmM: number, mode: RigCommand["claw"], profile: ClawProfile) {
  const force = (mode === "hold" ? profile.holdingContactForceN : profile.peakContactForceN).value;
  return Object.freeze({
    targetSpeedRadps: clampTorque(
      (targetRad - angleRad) * profile.positionGainPerSecond.value,
      profile.maximumAngularSpeedRadps.value,
    ),
    torqueLimitNm: force * Math.abs(momentArmM) * profile.forceReserveRatio.value,
  });
}
/** World-space perpendicular lever around the rotated local Z hinge axis. */
export function contactMomentArmM(point: Vec3, normal: Vec3, head: Vec3, q: Quat, localPivot: Vec3): number {
  const rotate = (v: Vec3): Vec3 => {
    const tx = 2 * (q.y * v.z - q.z * v.y), ty = 2 * (q.z * v.x - q.x * v.z), tz = 2 * (q.x * v.y - q.y * v.x);
    return { x: v.x + q.w * tx + q.y * tz - q.z * ty, y: v.y + q.w * ty + q.z * tx - q.x * tz, z: v.z + q.w * tz + q.x * ty - q.y * tx };
  };
  const offset = rotate(localPivot);
  const axis = rotate({ x: 0, y: 0, z: 1 });
  const r = { x: point.x - head.x - offset.x, y: point.y - head.y - offset.y, z: point.z - head.z - offset.z };
  return Math.abs((r.y * normal.z - r.z * normal.y) * axis.x + (r.z * normal.x - r.x * normal.z) * axis.y + (r.x * normal.y - r.y * normal.x) * axis.z);
}
