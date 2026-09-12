import HavokPhysics from "@babylonjs/havok";
import havokWasmUrl from "@babylonjs/havok/lib/esm/HavokPhysics.wasm?url";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Engine } from "@babylonjs/core/Engines/engine";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import "@babylonjs/core/Physics/v2/physicsEngineComponent";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { SupportedCalibrationProfile } from "../config/types";
import { validateProfile } from "../config/validateProfile";
import { createBridge } from "./createBridge";
import { createPrize } from "./createPrize";
import { PhysicsClock } from "./PhysicsClock";
import type { DiagnosticSnapshot } from "../diagnostics/createDiagnostics";

export type PhysicsSnapshotListener = (snapshot: DiagnosticSnapshot) => void;

export interface PhysicsSceneHandle {
  engine: AbstractEngine;
  scene: Scene;
  prize: Mesh;
  rods: Mesh[];
  clock: PhysicsClock;
  onSnapshot(listener: PhysicsSnapshotListener): () => void;
  dispose(): void;
}

export interface PhysicsSceneOptions {
  signal?: AbortSignal;
  createEngine?: (canvas: HTMLCanvasElement) => AbstractEngine;
  initializeHavok?: () => ReturnType<typeof HavokPhysics>;
}

export async function createPhysicsScene(canvas: HTMLCanvasElement, profile: SupportedCalibrationProfile, options: PhysicsSceneOptions = {}): Promise<PhysicsSceneHandle> {
  const issues = validateProfile(profile);
  if (issues.length) throw new Error(`Invalid calibration profile: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  const stepSeconds = 1 / 120;
  if (profile.physics.stepSeconds.value !== stepSeconds) throw new Error("Physics calibration requires a fixed 1/120 second step");
  const gravityMps2 = 9.80665;
  if (profile.environment.gravityMps2.value !== gravityMps2) throw new Error("Physics calibration requires standard gravity of 9.80665 m/s²");
  options.signal?.throwIfAborted();
  const havok = await (options.initializeHavok?.() ?? HavokPhysics({ locateFile: () => havokWasmUrl }));
  // WASM compilation itself has no cancellation API. Aborting prevents all
  // subsequent world/renderer allocation and the unattached module is GC-able.
  options.signal?.throwIfAborted();
  const engine = options.createEngine?.(canvas) ?? new Engine(canvas, true);
  const scene = new Scene(engine);
  let disposed = false;
  let snapshotListeners: Set<PhysicsSnapshotListener> | undefined;
  const resize = () => engine.resize();
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    snapshotListeners?.clear();
    engine.stopRenderLoop();
    if (typeof window !== "undefined") window.removeEventListener("resize", resize);
    scene.dispose();
    engine.dispose();
  };
  try {
    const plugin = new HavokPlugin(true, havok);
    if (!scene.enablePhysics(new Vector3(0, -gravityMps2, 0), plugin)) {
      plugin.dispose();
      throw new Error("Havok could not enable the physics world");
    }
    plugin.setTimeStep(stepSeconds);
    // Render must not invoke Babylon's automatic physics accumulator.
    scene.physicsEnabled = false;
    scene.clearColor = new Color4(0.055, 0.069, 0.085, 1);
    const camera = new ArcRotateCamera("calibration camera", -Math.PI / 2.6, Math.PI / 2.8, 0.7, new Vector3(0, 0.05, 0), scene);
    camera.minZ = 0.001;
    camera.lowerRadiusLimit = 0.3;
    camera.upperRadiusLimit = 1.5;
    if (engine.getRenderingCanvas()) camera.attachControl(canvas, true);
    new HemisphericLight("calibration softbox", new Vector3(0, 1, -0.5), scene);
    const rods = createBridge(scene, profile);
    const prize = createPrize(scene, profile);
    const bodies = [...rods, prize].map((mesh) => mesh.physicsBody!);
    const clock = new PhysicsClock({ stepSeconds, maxFrameSeconds: 0.1, maxStepsPerFrame: 12 });
    const listeners = new Set<PhysicsSnapshotListener>();
    snapshotListeners = listeners;
    let fixedStepCount = 0;
    engine.runRenderLoop(() => {
      if (disposed) return;
      const frameMilliseconds = engine.getDeltaTime();
      const sample = clock.advance(frameMilliseconds / 1000, (dt) => plugin.executeStep(dt, bodies));
      fixedStepCount += sample.steps;
      const quaternion = prize.rotationQuaternion;
      const snapshot: DiagnosticSnapshot = Object.freeze({
        position: Object.freeze({ x: prize.position.x, y: prize.position.y, z: prize.position.z }),
        rotation: Object.freeze({
          x: quaternion?.x ?? 0,
          y: quaternion?.y ?? 0,
          z: quaternion?.z ?? 0,
          w: quaternion?.w ?? 1,
        }),
        fixedStepCount,
        renderFps: frameMilliseconds > 0 ? 1000 / frameMilliseconds : 0,
      });
      listeners.forEach((listener) => listener(snapshot));
      // Babylon syncs current physics pose in executeStep; it has no public
      // previous/current visual transform pair. Do not interpolate body nodes.
      scene.render();
    });
    if (typeof window !== "undefined") window.addEventListener("resize", resize);
    const onSnapshot = (listener: PhysicsSnapshotListener): (() => void) => {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    return { engine, scene, prize, rods, clock, onSnapshot, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
