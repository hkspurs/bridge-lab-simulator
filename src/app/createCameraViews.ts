import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

export type CameraView = "front" | "side";

export function createCameraViews(scene: Scene): { select(view: CameraView): void; dispose(): void } {
  const camera = scene.activeCamera as ArcRotateCamera | null;
  if (!camera) throw new Error("Playable camera is unavailable");
  camera.detachControl();
  camera.inputs.clear();
  camera.lowerRadiusLimit = 0.78;
  camera.upperRadiusLimit = 0.78;
  const target = new Vector3(0, 0.2, 0);
  const select = (view: CameraView) => {
    camera.setTarget(target);
    camera.radius = 0.78;
    camera.beta = Math.PI / 2.55;
    camera.alpha = view === "front" ? -Math.PI / 2 : Math.PI;
  };
  select("front");
  return { select, dispose() {} };
}
