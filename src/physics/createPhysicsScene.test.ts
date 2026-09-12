// @vitest-environment node
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import HavokPhysics from "@babylonjs/havok";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { PhysicsMotionType, PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { Tags } from "@babylonjs/core/Misc/tags";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import type { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { baselineProfile } from "../config/baselineProfile";
import { playableProfile } from "../config/playableProfile";
import type { SupportedCalibrationProfile } from "../config/types";
import { createPhysicsScene, type PhysicsSceneHandle } from "./createPhysicsScene";
import { toPhysicsMassProperties } from "./createPrize";

let havok: Awaited<ReturnType<typeof HavokPhysics>>;
const handles: PhysicsSceneHandle[] = [];
beforeAll(async () => {
  const wasmBinary = await readFile(createRequire(import.meta.url).resolve("@babylonjs/havok/lib/esm/HavokPhysics.wasm"));
  havok = await HavokPhysics({ wasmBinary: Uint8Array.from(wasmBinary).buffer });
});
afterEach(() => handles.splice(0).forEach((handle) => handle.dispose()));
async function setup(profile: SupportedCalibrationProfile = structuredClone(baselineProfile)) {
  const handle = await createPhysicsScene({} as HTMLCanvasElement, profile, {
    createEngine: () => new NullEngine(),
    initializeHavok: async () => havok,
  });
  handles.push(handle);
  return handle;
}

describe("Havok calibration scene", () => {
  it("runs the playable rig through two real attempts without replacing the prize", async () => {
    const handle = await setup(structuredClone(playableProfile));
    vi.spyOn(handle.engine, "getDeltaTime").mockReturnValue(100);
    const frame = handle.engine.activeRenderLoops[0];
    const runAttempt = () => {
      handle.dispatch({ type: "press", axis: 1 }); frame();
      handle.dispatch({ type: "release", axis: 1 });
      handle.dispatch({ type: "press", axis: 2 }); frame();
      handle.dispatch({ type: "release", axis: 2 });
      for (let i = 0; i < 250 && handle.sequence!.phase !== "REVIEW" && handle.sequence!.phase !== "FAULT"; i++) frame();
      expect(handle.sequence!.phase).toBe("REVIEW");
    };
    const identity = handle.prize.physicsBody;
    runAttempt();
    const pose = handle.prize.position.clone();
    const velocity = handle.prize.physicsBody!.getLinearVelocity().clone();
    handle.dispatch({ type: "continue" });
    expect(handle.prize.physicsBody).toBe(identity);
    expect(handle.prize.position.equalsWithEpsilon(pose, 1e-12)).toBe(true);
    expect(handle.prize.physicsBody!.getLinearVelocity().equalsWithEpsilon(velocity, 1e-12)).toBe(true);
    runAttempt();
  }, 20_000);

  it("freezes interruption time and resumes with a stopped carriage", async () => {
    const handle = await setup(structuredClone(playableProfile));
    const frame = handle.engine.activeRenderLoops[0];
    vi.spyOn(handle.engine, "getDeltaTime").mockReturnValue(1000 / 120);
    handle.dispatch({ type: "press", axis: 1 });
    for (let i = 0; i < 30; i++) frame();
    const carriage = handle.rig!.bodies[0];
    expect(carriage.getLinearVelocity().x).toBeGreaterThan(0);
    handle.dispatch({ type: "cancel" });
    const stoppedPose = carriage.transformNode.position.clone();
    vi.spyOn(handle.engine, "getDeltaTime").mockReturnValue(10_000);
    frame();
    expect(carriage.transformNode.position.equalsWithEpsilon(stoppedPose, 1e-12)).toBe(true);
    handle.dispatch({ type: "resume" });
    const executeStep = vi.spyOn(handle.scene.getPhysicsEngine()!.getPhysicsPlugin()!, "executeStep");
    vi.spyOn(handle.engine, "getDeltaTime").mockReturnValue(10_000);
    frame();
    expect(executeStep).not.toHaveBeenCalled();
    expect(carriage.transformNode.position.equalsWithEpsilon(stoppedPose, 1e-12)).toBe(true);
    vi.spyOn(handle.engine, "getDeltaTime").mockReturnValue(1000 / 240);
    frame();
    expect(carriage.transformNode.position.equalsWithEpsilon(stoppedPose, 1e-12)).toBe(true);
    vi.spyOn(handle.engine, "getDeltaTime").mockReturnValue(1000 / 120);
    frame();
    expect(carriage.getLinearVelocity().length()).toBeLessThan(1e-8);
  });

  it("ignores controls while the world is paused until explicit resume", async () => {
    const handle = await setup(structuredClone(playableProfile));
    handle.dispatch({ type: "cancel" });
    handle.dispatch({ type: "press", axis: 1 });
    expect(handle.sequence!.phase).toBe("READY");
    handle.dispatch({ type: "resume" });
    handle.dispatch({ type: "press", axis: 1 });
    expect(handle.sequence!.phase).toBe("MOVE_AXIS_1");
  });

  it("treats duplicate resume while running as a no-op", async () => {
    const handle = await setup(structuredClone(playableProfile));
    vi.spyOn(handle.engine, "getDeltaTime").mockReturnValue(1000 / 120);
    const frame = handle.engine.activeRenderLoops[0];
    const executeStep = vi.spyOn(handle.scene.getPhysicsEngine()!.getPhysicsPlugin()!, "executeStep");
    handle.dispatch({ type: "press", axis: 1 });
    frame();
    const before = handle.rig!.bodies[0].transformNode.position.x;
    handle.dispatch({ type: "resume" });
    frame();
    expect(handle.sequence!.phase).toBe("MOVE_AXIS_1");
    expect(executeStep).toHaveBeenCalledTimes(2);
    expect(handle.rig!.bodies[0].transformNode.position.x).toBeGreaterThan(before);
  });

  it("resets the physical world only through explicit New setup", async () => {
    const handle = await setup(structuredClone(playableProfile));
    vi.spyOn(handle.engine, "getDeltaTime").mockReturnValue(1000 / 60);
    const frame = handle.engine.activeRenderLoops[0];
    const initialPrize = handle.prize.position.clone();
    handle.dispatch({ type: "press", axis: 1 });
    for (let i = 0; i < 30; i++) frame();
    expect(handle.rig!.bodies[0].transformNode.position.x).toBeGreaterThan(0);
    handle.newSetup();
    expect(handle.sequence!.phase).toBe("READY");
    expect(handle.rig!.bodies[0].transformNode.position.x).toBeCloseTo(0, 8);
    expect(handle.prize.position.equalsWithEpsilon(initialPrize, 1e-8)).toBe(true);
    frame();
    frame();
    expect(handle.rig!.bodies[0].transformNode.position.x).toBeCloseTo(0, 6);
    expect(handle.rig!.bodies.every(body => body.getLinearVelocity().length() < .01)).toBe(true);
    expect(handle.prize.position.subtract(initialPrize).length()).toBeLessThan(.01);
    expect(handle.prize.physicsBody!.getLinearVelocity().length()).toBeLessThan(.5);
  });
  it("keeps the actuator open through READY after New setup during CLOSE", async () => {
    const handle = await setup(structuredClone(playableProfile));
    vi.spyOn(handle.engine, "getDeltaTime").mockReturnValue(1000 / 60);
    const frame = handle.engine.activeRenderLoops[0];
    handle.dispatch({ type: "press", axis: 1 });
    handle.dispatch({ type: "release", axis: 1 });
    handle.dispatch({ type: "press", axis: 2 });
    handle.dispatch({ type: "release", axis: 2 });
    handle.sequence!.tick(0, { ...handle.rig!.observe(), atDropLimit: true });
    expect(handle.sequence!.phase).toBe("CLOSE");
    for (let i = 0; i < 60; i++) frame();
    expect(handle.rig!.actuatorSamples().every(sample => sample.targetAngleRad < 0)).toBe(true);

    handle.newSetup();
    expect(handle.sequence!.phase).toBe("READY");
    for (let i = 0; i < 60; i++) frame();
    for (const sample of handle.rig!.actuatorSamples()) {
      expect(sample.targetAngleRad).toBeGreaterThan(0);
      expect(sample.angleRad).toBeGreaterThan(0.6);
    }
  });
  it("builds exactly two dimensioned cylindrical static rods and a dynamic prize", async () => {
    const profile = structuredClone(baselineProfile);
    profile.bridge.rodHeightDeltaM.value = 0.01;
    const { scene, rods, prize } = await setup(profile);
    expect(scene.meshes.filter((mesh) => Tags.MatchesQuery(mesh, "bridge-rod"))).toEqual(rods);
    expect(rods).toHaveLength(2);
    rods.forEach((rod, index) => {
      expect(rod.physicsBody!.getMotionType()).toBe(PhysicsMotionType.STATIC);
      expect(rod.physicsBody!.shape!.type).toBe(PhysicsShapeType.CYLINDER);
      expect(rod.getTotalVertices()).toBeGreaterThan(24);
      rod.computeWorldMatrix(true);
      const size = rod.getBoundingInfo().boundingBox.extendSizeWorld.scale(2);
      expect(size.x).toBeCloseTo(0.025, 6);
      expect(size.y).toBeCloseTo(0.025, 6);
      expect(size.z).toBeGreaterThan(0.09);
      expect(rod.position.x).toBeCloseTo(index === 0 ? -0.08 : 0.08);
      expect(rod.position.y).toBeCloseTo(index === 0 ? -0.005 : 0.005);
    });
    expect(prize.physicsBody!.getMotionType()).toBe(PhysicsMotionType.DYNAMIC);
    expect(prize.physicsBody!.getMassProperties().mass).toBeCloseTo(0.32);
    expect(scene.getPhysicsEngine()!.gravity.asArray()).toEqual([0, -9.80665, 0]);
    expect(scene.getPhysicsEngine()!.getTimeStep()).toBe(1 / 120);
    expect(scene.getMeshByName("BRIDGE LAB lettering")).not.toBeNull();
  });

  it("applies COM, damping, contact coefficients and a sub-millimetre rounded hull", async () => {
    const { prize, rods } = await setup();
    const body = prize.physicsBody!;
    const mass = body.getMassProperties();
    expect(mass.centerOfMass!.x).toBeCloseTo(0);
    expect(mass.centerOfMass!.y).toBeCloseTo(0.032);
    expect(mass.centerOfMass!.z).toBeCloseTo(-0.0072);
    expect(body.getLinearDamping()).toBeCloseTo(0);
    expect(body.getAngularDamping()).toBeCloseTo(0.05);
    for (const mesh of [prize, ...rods]) {
      expect(mesh.physicsBody!.shape!.material).toMatchObject({ staticFriction: expect.closeTo(0.34), friction: expect.closeTo(0.26), restitution: expect.closeTo(0.06) });
    }
    expect(body.shape!.type).toBe(PhysicsShapeType.CONVEX_HULL);
    const box = body.shape!.getBoundingBox();
    const size = box.maximum.subtract(box.minimum);
    [size.x, size.y, size.z].forEach((value, index) => {
      expect(value).toBeGreaterThanOrEqual([0.14, 0.2, 0.09][index] - 0.002);
      expect(value).toBeLessThanOrEqual([0.14, 0.2, 0.09][index] + 0.002);
    });
  });

  it("steps only from the fixed clock and rendering cannot double-step or teleport", async () => {
    const handle = await setup();
    const body = handle.prize.physicsBody!;
    // Isolate freefall from the contact solver.
    body.shape!.filterCollideMask = 0;
    const plugin = handle.scene.getPhysicsEngine()!.getPhysicsPlugin()!;
    const steps = vi.spyOn(plugin, "executeStep");
    const initial = handle.prize.position.clone();
    expect(initial.y - 0.1).toBeGreaterThan(0.0125);
    expect(body.disablePreStep).toBe(true);
    const frame = handle.engine.activeRenderLoops[0];
    vi.spyOn(handle.engine, "getDeltaTime").mockReturnValue(1000 / 60);
    frame();
    expect(steps.mock.calls.map(([dt]) => dt)).toEqual([1 / 120, 1 / 120]);
    // Raw Havok also returns -0.160318 here (vs ideal -0.163444), even for
    // an isolated sphere with zero damping. Allow its integration tolerance.
    expect(body.getLinearVelocity().y).toBeCloseTo(-9.80665 / 60, 2);
    expect(handle.prize.position.y).toBeLessThan(initial.y);
    const position = handle.prize.position.clone();
    handle.scene.render();
    expect(steps).toHaveBeenCalledTimes(2);
    expect(handle.prize.position.equals(position)).toBe(true);
    vi.spyOn(handle.engine, "getDeltaTime").mockReturnValue(1);
    frame();
    expect(steps).toHaveBeenCalledTimes(2);
    handle.dispose();
    handle.dispose();
    expect(handle.engine.activeRenderLoops).toHaveLength(0);
    expect(handle.scene.isDisposed).toBe(true);
    expect(body.isDisposed).toBe(true);
  });

  it("publishes frozen read-only transform snapshots once per render frame", async () => {
    const handle = await setup();
    const listener = vi.fn();
    const unsubscribe = handle.onSnapshot(listener);
    vi.spyOn(handle.engine, "getDeltaTime").mockReturnValue(1000 / 60);

    handle.engine.activeRenderLoops[0]();

    expect(listener).toHaveBeenCalledTimes(1);
    const snapshot = listener.mock.calls[0][0];
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.position)).toBe(true);
    expect(Object.isFrozen(snapshot.rotation)).toBe(true);
    expect(Object.isFrozen(snapshot.prizeLinearVelocity)).toBe(true);
    expect(Object.isFrozen(snapshot.prizeAngularVelocity)).toBe(true);
    expect(Object.isFrozen(snapshot.clawAnglesRad)).toBe(true);
    expect(Object.isFrozen(snapshot.contacts)).toBe(true);
    expect(snapshot.fixedStepCount).toBe(2);
    expect(snapshot.renderFps).toBeCloseTo(60);
    unsubscribe();
    handle.engine.activeRenderLoops[0]();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps the native convex core inset rather than inflating the carton", async () => {
    const { scene, prize } = await setup();
    const plugin = scene.getPhysicsEngine()!.getPhysicsPlugin() as HavokPlugin;
    const { positions } = plugin.getBodyGeometry(prize.physicsBody!);
    expect(positions.length).toBeGreaterThan(0);
    for (let i = 0; i < positions.length; i += 3) {
      const envelopeFaces = [0.07, 0.1, 0.045].filter((half, axis) => Math.abs(positions[i + axis]) > half - 0.0001);
      expect(envelopeFaces.length).toBeLessThanOrEqual(1);
    }
  });

  it("rejects invalid profiles before allocating an engine or loading WASM", async () => {
    const profile = structuredClone(baselineProfile);
    profile.prize.widthM.value = -1;
    const createEngine = vi.fn(() => new NullEngine());
    const initializeHavok = vi.fn(async () => havok);
    await expect(createPhysicsScene({} as HTMLCanvasElement, profile, { createEngine, initializeHavok })).rejects.toThrow(/prize.widthM/);
    expect(createEngine).not.toHaveBeenCalled();
    expect(initializeHavok).not.toHaveBeenCalled();
  });

  it("rejects a non-120 Hz step even if the supplied range declares it valid", async () => {
    const profile = {
      ...baselineProfile,
      physics: { stepSeconds: { ...baselineProfile.physics.stepSeconds, value: 1 / 60, allowedRange: [1 / 60, 1 / 60] as const } },
    };
    const createEngine = vi.fn(() => new NullEngine());
    const outcome = await createPhysicsScene({} as HTMLCanvasElement, profile, { createEngine, initializeHavok: async () => havok }).then(
      (handle) => { handle.dispose(); return "unexpected success"; },
      (error: Error) => error.message,
    );
    expect(outcome).toMatch(/1\/120/);
    expect(createEngine).not.toHaveBeenCalled();
  });

  it("rejects nonstandard gravity before initialization even if its range declares it valid", async () => {
    const profile = {
      ...baselineProfile,
      environment: { gravityMps2: { ...baselineProfile.environment.gravityMps2, value: 4.9, allowedRange: [4.9, 4.9] as const } },
    };
    const createEngine = vi.fn(() => new NullEngine());
    const initializeHavok = vi.fn(async () => havok);
    const outcome = await createPhysicsScene({} as HTMLCanvasElement, profile, { createEngine, initializeHavok }).then(
      (handle) => { handle.dispose(); return "unexpected success"; },
      (error: Error) => error.message,
    );
    expect(outcome).toContain("9.80665");
    expect(initializeHavok).not.toHaveBeenCalled();
    expect(createEngine).not.toHaveBeenCalled();
  });

  it("lets real contacts support the baseline prize after gravity settling", async () => {
    const handle = await setup();
    const initialHeight = handle.prize.position.y;
    vi.spyOn(handle.engine, "getDeltaTime").mockReturnValue(1000 / 60);
    const frame = handle.engine.activeRenderLoops[0];
    for (let i = 0; i < 180; i++) frame();
    expect(handle.prize.position.y).toBeLessThan(initialHeight);
    // A top-heavy prize may wedge/tilt; do not require an artificial upright pose.
    expect(handle.prize.position.y).toBeGreaterThan(0);
    expect(handle.prize.physicsBody!.getLinearVelocity().length()).toBeLessThan(0.01);
  });

  it("cancels pending initialization before allocating scene resources", async () => {
    const controller = new AbortController();
    let resolve!: (value: typeof havok) => void;
    const createEngine = vi.fn(() => new NullEngine());
    const pending = createPhysicsScene({} as HTMLCanvasElement, baselineProfile, {
      createEngine, signal: controller.signal,
      initializeHavok: () => new Promise((done) => { resolve = done; }),
    });
    controller.abort();
    resolve(havok);
    await expect(pending).rejects.toThrow(/abort/i);
    expect(createEngine).not.toHaveBeenCalled();
  });
});

describe("mass-properties engine adapter", () => {
  it("preserves every tensor component under the right-handed (x,z,-y) basis", () => {
    const result = toPhysicsMassProperties({ massKg: 2, centerOfMassM: { x: 0.01, y: 0.02, z: 0.15 }, inertiaKgM2: [4, 1, 2, 5, 0.5, 6] }, 0.2);
    expect(result.centerOfMass!.asArray()).toEqual([0.01, expect.closeTo(0.05), -0.02]);
    const rotation = Matrix.FromQuaternionToRef(result.inertiaOrientation!, Matrix.Identity());
    const axes = [Vector3.Right(), Vector3.Up(), Vector3.Forward()].map((axis) => Vector3.TransformNormal(axis, rotation).asArray());
    const moments = result.inertia!.asArray();
    const expected = [[4, 2, -1], [2, 6, -0.5], [-1, -0.5, 5]];
    expected.forEach((row, i) => row.forEach((value, j) => {
      expect(axes.reduce((sum, axis, k) => sum + 2 * moments[k] * axis[i] * axis[j], 0)).toBeCloseTo(value, 5);
    }));
  });

  it("uses absolute kg m² principal moments in real Havok angular response", async () => {
    const { prize } = await setup();
    const body = prize.physicsBody!;
    body.setMassProperties(toPhysicsMassProperties({ massKg: 2, centerOfMassM: { x: 0, y: 0, z: 0.1 }, inertiaKgM2: [4, 0, 0, 5, 0, 6] }, 0.2));
    body.applyAngularImpulse(new Vector3(4, 0, 0));
    expect(body.getAngularVelocity().x).toBeCloseTo(1, 5);
  });
});
