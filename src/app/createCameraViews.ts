import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

export type CameraView = "front" | "side";

export function createCameraViews(scene: Scene): { select(view: CameraView): void; dispose(): void } {
  const camera = scene.activeCamera as ArcRotateCamera | null;
  if (!camera) throw new Error("Playable camera is unavailable");
  camera.detachControl();
  camera.inputs.clear();
  camera.inputs.addPointers();
  camera.inputs.addMouseWheel();
  camera.panningSensibility = 0;
  camera.angularSensibilityX = 700;
  camera.angularSensibilityY = 700;
  camera.pinchDeltaPercentage = .01;
  camera.wheelDeltaPercentage = .01;
  camera.lowerRadiusLimit = .5;
  camera.upperRadiusLimit = 1.5;
  camera.lowerBetaLimit = .2;
  camera.upperBetaLimit = Math.PI / 2;
  if (scene.getEngine().getRenderingCanvas()) camera.attachControl(false);

  const target = new Vector3(0, 0.2, 0);
  const select = (view: CameraView) => {
    camera.inertialAlphaOffset = 0;
    camera.inertialBetaOffset = 0;
    camera.inertialRadiusOffset = 0;
    camera.setTarget(target);
    camera.radius = 0.78;
    camera.beta = Math.PI / 2.55;
    camera.alpha = view === "front" ? -Math.PI / 2 : Math.PI;
  };
  select("front");
  return { select, dispose() { camera.detachControl(); } };
}
