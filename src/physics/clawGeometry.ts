import { Vector3, Quaternion } from "@babylonjs/core/Maths/math.vector";
import type { ClawProfile } from "../config/clawProfile";

/** Box segments are the single source for both visible plates and compound collision. */
export function clawArmGeometry(profile: ClawProfile, side: number) {
  const length = profile.armLengthM.value;
  const outreach = profile.armOutreachM.value;
  const folded = outreach > 0;
  const pivot = new Vector3(0, folded ? 0 : length / 2, 0);
  const toe = new Vector3(side * (outreach - (folded ? profile.toeInsetM.value : 0)), -length, 0);
  const points = folded ? [Vector3.Zero(),
    new Vector3(side * outreach, -profile.elbowDropM.value, 0),
    new Vector3(side * outreach, -length + profile.toeLengthM.value, 0), toe,
  ] : [Vector3.Zero(), toe];
  const segments = points.slice(1).map((end, index) => {
    const start = points[index];
    const delta = end.subtract(start);
    return {
      name: folded ? ["outreach", "downfold", "contact toe"][index] : "straight",
      center: start.add(end).scale(.5).add(pivot),
      size: new Vector3(folded && index === 2 ? profile.toeThicknessM.value : profile.armThicknessM.value,
        delta.length(), profile.armDepthM.value),
      rotation: Quaternion.RotationAxis(Vector3.Forward(), Math.atan2(delta.x, -delta.y)),
    };
  });
  return { folded, pivot, toe, segments };
}
