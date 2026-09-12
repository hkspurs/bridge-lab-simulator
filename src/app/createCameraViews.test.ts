import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { describe, expect, it } from "vitest";
import { createCameraViews } from "./createCameraViews";

describe("camera presets", () => {
  it("frames the home claw and prize from fixed front and side views", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const camera = new ArcRotateCamera("play", 0, 0, 1, Vector3.Zero(), scene);
    const views = createCameraViews(scene);
    views.select("front");
    expect(camera.radius).toBe(0.78);
    expect(camera.target.y).toBe(0.2);
    const frontAlpha = camera.alpha;
    views.select("side");
    expect(camera.alpha).not.toBe(frontAlpha);
    expect(camera.inputs.attached.pointers).toBeDefined();
    expect(camera.lowerRadiusLimit).toBeLessThan(camera.upperRadiusLimit!);
    camera.inertialAlphaOffset = 1;
    views.select("front");
    expect(camera.inertialAlphaOffset).toBe(0);
    views.dispose();
    scene.dispose(); engine.dispose();
  });
});
