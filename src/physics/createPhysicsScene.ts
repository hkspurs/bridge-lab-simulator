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
import { isPlayableProfile } from "./createBridge";
import { createClaw, type PhysicalClawRig } from "./createClaw";
import { clawProfile } from "../config/clawProfile";
import { CraneSequence } from "../crane/CraneSequence";
import type { InputEvent, RigObservation } from "../crane/types";
import { stepSimulation } from "./stepSimulation";

export type PhysicsSnapshotListener = (snapshot: DiagnosticSnapshot) => void;

export interface PhysicsSceneHandle {
  engine: AbstractEngine;
  scene: Scene;
  prize: Mesh;
  rods: Mesh[];
  clock: PhysicsClock;
  rig?: PhysicalClawRig;
  sequence?: CraneSequence;
  dispatch(event: InputEvent): void;
  newSetup(): void;
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
  let physicalRig: PhysicalClawRig | undefined;
  let snapshotListeners: Set<PhysicsSnapshotListener> | undefined;
  const resize = () => engine.resize();
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    snapshotListeners?.clear();
    engine.stopRenderLoop();
    if (typeof window !== "undefined") window.removeEventListener("resize", resize);
    physicalRig?.dispose();
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
    const rig = isPlayableProfile(profile) ? createClaw(scene, clawProfile) : undefined;
    physicalRig = rig;
    let sequence = rig ? new CraneSequence() : undefined;
    const bodies = [...rods, prize].map((mesh) => mesh.physicsBody!);
    if (rig) bodies.push(...rig.bodies);
    const clock = new PhysicsClock({ stepSeconds, maxFrameSeconds: 0.1, maxStepsPerFrame: 12 });
    const listeners = new Set<PhysicsSnapshotListener>();
    snapshotListeners = listeners;
    let fixedStepCount = 0;
    let paused = false;
    let rebaseNextFrame = false;
    let droppedWallSeconds = 0;
    const resetBodies = [prize.physicsBody!, ...(rig?.bodies ?? [])];
    const initialTransforms = resetBodies.map(body => ({
      body, position: body.transformNode.position.clone(), rotation: body.transformNode.rotationQuaternion!.clone(),
    }));
    const composedRig = rig && {
      ...rig,
      observe(): RigObservation {
        const value = rig.observe();
        const linear = prize.physicsBody!.getLinearVelocity().length();
        const angular = prize.physicsBody!.getAngularVelocity().length();
        return Object.freeze({ ...value,
          prizeLinearSpeedMps: linear, prizeAngularSpeedRadps: angular,
          prizeSettled: linear < .005 && angular < .05,
          invalidPhysics: value.invalidPhysics || ![...prize.position.asArray(), ...prize.rotationQuaternion!.asArray(), linear, angular].every(Number.isFinite),
        });
      },
    };
    engine.runRenderLoop(() => {
      if (disposed) return;
      const frameMilliseconds = engine.getDeltaTime();
      const sample = paused || rebaseNextFrame
        ? { steps: 0, alpha: 0, simulatedSeconds: 0, droppedSeconds: frameMilliseconds / 1000 }
        : clock.advance(frameMilliseconds / 1000, (dt) => {
          if (sequence && composedRig) stepSimulation(dt, sequence, composedRig, step => plugin.executeStep(step, bodies));
          else plugin.executeStep(dt, bodies);
        });
      rebaseNextFrame = false;
      fixedStepCount += sample.steps;
      droppedWallSeconds += sample.droppedSeconds;
      const quaternion = prize.rotationQuaternion;
      const linear = prize.physicsBody!.getLinearVelocity();
      const angular = prize.physicsBody!.getAngularVelocity();
      const actuator = rig?.actuatorSamples() ?? [];
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
        profileId: profile.id,
        phase: sequence?.phase,
        paused,
        droppedWallSeconds,
        prizeLinearVelocity: Object.freeze({ x: linear.x, y: linear.y, z: linear.z }),
        prizeAngularVelocity: Object.freeze({ x: angular.x, y: angular.y, z: angular.z }),
        clawAnglesRad: Object.freeze(actuator.map(value => value.angleRad)),
        clawTargetAnglesRad: Object.freeze(actuator.map(value => value.targetAngleRad)),
        actuatorTorqueLimitsNm: Object.freeze(actuator.map(value => value.torqueLimitNm)),
        contacts: Object.freeze((rig?.contactSamples() ?? []).map(value => Object.freeze({ ...value, normal: Object.freeze({ ...value.normal }) }))),
        prizeOutOfReach: prize.position.y < -profile.prize.heightM.value,
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
    const dispatch = (event: InputEvent) => {
      if (!sequence || !rig) return;
      if (paused && event.type !== "resume" && event.type !== "cancel") return;
      if (event.type === "cancel") {
        sequence.dispatch(event);
        rig.command({ travel: "stop", claw: "hold" });
        paused = true;
        clock.discardAccumulatedTime();
        return;
      }
      if (event.type === "resume") {
        if (!paused) return;
        sequence.dispatch(event);
        rig.command({ travel: "stop", claw: "hold" });
        clock.discardAccumulatedTime();
        rebaseNextFrame = true;
        paused = false;
        return;
      }
      sequence.dispatch(event);
    };
    const newSetup = () => {
      clock.discardAccumulatedTime();
      for (const { body, position, rotation } of initialTransforms) {
        body.transformNode.position.copyFrom(position);
        body.transformNode.rotationQuaternion!.copyFrom(rotation);
        body.transformNode.computeWorldMatrix(true);
        const disabledPreStep = body.disablePreStep;
        body.disablePreStep = false;
        plugin.setPhysicsBodyTransformation(body, body.transformNode);
        body.disablePreStep = disabledPreStep;
        body.setLinearVelocity(Vector3.Zero());
        body.setAngularVelocity(Vector3.Zero());
      }
      if (rig) {
        rig.command({ travel: "stop", claw: "open" });
        sequence = new CraneSequence();
      }
      paused = false;
    };
    return { engine, scene, prize, rods, clock, rig, get sequence() { return sequence; }, dispatch, newSetup, onSnapshot, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
