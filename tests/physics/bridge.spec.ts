// @vitest-environment node
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import type { PhysicsEngine } from "@babylonjs/core/Physics/v2/physicsEngine";
import HavokPhysics from "@babylonjs/havok";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import { PhysicsShapeSphere } from "@babylonjs/core/Physics/v2/physicsShape";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PhysicsMotionType, PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { Tags } from "@babylonjs/core/Misc/tags";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { report } from "./report";
import { playableProfile } from "../../src/config/playableProfile";
import { createPhysicsScene, type PhysicsSceneHandle } from "../../src/physics/createPhysicsScene";

let havok: Awaited<ReturnType<typeof HavokPhysics>>;
const handles: PhysicsSceneHandle[] = [];

beforeAll(async () => {
  const wasmBinary = await readFile(createRequire(import.meta.url).resolve("@babylonjs/havok/lib/esm/HavokPhysics.wasm"));
  havok = await HavokPhysics({ wasmBinary: Uint8Array.from(wasmBinary).buffer });
});
afterEach(() => handles.splice(0).forEach((handle) => handle.dispose()));

async function setup(profile = structuredClone(playableProfile)) {
  const handle = await createPhysicsScene({} as HTMLCanvasElement, profile, {
    createEngine: () => new NullEngine(), initializeHavok: async () => havok,
  });
  handle.engine.stopRenderLoop();
  handle.rig?.dispose(); // Passive bridge fixture has only prize and four rods.
  handles.push(handle);
  return handle;
}

describe("four-rod engineering fixture in real Havok", () => {
  it("creates four independently configured static colliders", async () => {
    const { scene, rods } = await setup();
    expect(scene.meshes.filter((mesh) => Tags.MatchesQuery(mesh, "bridge-rod"))).toEqual(rods);
    expect(rods).toHaveLength(4);
    for (const [index, rod] of rods.entries()) {
      expect(rod.name).toBe(`bridge ${playableProfile.bridge.rods[index].id}`);
      expect(rod.physicsBody!.getMotionType()).toBe(PhysicsMotionType.STATIC);
      expect(rod.physicsBody!.shape!.type).toBe(index < 2 ? PhysicsShapeType.CYLINDER : PhysicsShapeType.CONVEX_HULL);
    }
  });

  it("uses sampled circular corners for the rounded-rectangular rail contour", async () => {
    const { rods } = await setup();
    const rail = rods[2];
    const positions = rail.getVerticesData(VertexBuffer.PositionKind)!;
    const normals = rail.getVerticesData(VertexBuffer.NormalKind)!;
    const width = playableProfile.bridge.rods[2].crossSection.kind === "rounded-rectangular" ? playableProfile.bridge.rods[2].crossSection.widthM.value : 0;
    const height = playableProfile.bridge.rods[2].crossSection.kind === "rounded-rectangular" ? playableProfile.bridge.rods[2].crossSection.heightM.value : 0;
    const radius = playableProfile.bridge.rods[2].crossSection.kind === "rounded-rectangular" ? playableProfile.bridge.rods[2].crossSection.cornerRadiusM.value : 0;
    const expected = { x: width / 2 - radius + radius / Math.sqrt(2), y: height / 2 - radius + radius / Math.sqrt(2) };
    const hasArcMidpoint = Array.from({ length: positions.length / 3 }, (_, index) => ({ x: positions[index * 3], y: positions[index * 3 + 1] }))
      .some((point) => Math.hypot(point.x - expected.x, point.y - expected.y) < 1e-6);
    expect(rail.getTotalVertices()).toBeGreaterThan(16);
    expect(normals).toHaveLength(positions.length);
    for (let index = 0; index < normals.length; index += 3) expect(Math.hypot(normals[index], normals[index + 1], normals[index + 2])).toBeGreaterThan(0.5);
    expect(hasArcMidpoint).toBe(true);
  });

  it("applies one rod's configured transform without changing the other rods", async () => {
    const profile = structuredClone(playableProfile);
    profile.bridge.rods[0].centerM.x.value = -0.12;
    profile.bridge.rods[0].orientation.xDegrees.value = 25;
    profile.bridge.rods[0].orientation.yDegrees.value = 15;
    profile.bridge.rods[0].orientation.zDegrees.value = -10;
    const { rods } = await setup(profile);
    expect(rods[0].position.x).toBeCloseTo(-0.12);
    const radians = Math.PI / 180;
    const expected = Quaternion.RotationAxis(Vector3.Right(), 25 * radians)
      .multiply(Quaternion.RotationAxis(Vector3.Up(), 15 * radians))
      .multiply(Quaternion.RotationAxis(Vector3.Forward(), -10 * radians));
    expect(rods[0].rotationQuaternion!.equalsWithEpsilon(expected, 1e-5)).toBe(true);
    expect(rods[0].rotationQuaternion!.equalsWithEpsilon(rods[1].rotationQuaternion!, 1e-5)).toBe(false);
    for (let index = 1; index < rods.length; index++) {
      expect(rods[index].position.x).toBeCloseTo(playableProfile.bridge.rods[index].centerM.x.value);
      expect(rods[index].position.y).toBeCloseTo(playableProfile.bridge.rods[index].centerM.y.value);
      expect(rods[index].position.z).toBeCloseTo(playableProfile.bridge.rods[index].centerM.z.value);
    }
  });

  it("collides with a falling probe at both circular-rail endpoints", async () => {
    const { scene, rods, prize } = await setup();
    const plugin = (scene.getPhysicsEngine()! as PhysicsEngine).getPhysicsPlugin();
    const bodies = [...rods, prize].map((mesh) => mesh.physicsBody!);
    prize.physicsBody!.shape!.filterCollideMask = 0;
    for (const endpoint of [-1, 1]) {
      const probe = CreateSphere(`endpoint probe ${endpoint}`, { diameter: 0.02 }, scene);
      probe.position.set(-0.08, 0.12, endpoint * 0.225);
      const body = new PhysicsBody(probe, PhysicsMotionType.DYNAMIC, false, scene);
      body.shape = new PhysicsShapeSphere(Vector3.Zero(), 0.01, scene);
      const contacts: unknown[] = [];
      body.setCollisionCallbackEnabled(true);
      body.getCollisionObservable().add((event) => contacts.push(event));
      for (let tick = 0; tick < 120; tick++) plugin.executeStep(1 / 120, [...bodies, body]);
      expect(contacts.length).toBeGreaterThan(0);
      probe.dispose();
    }
  });

  it("collides with a falling probe over each reachable end rail", async () => {
    const { scene, rods, prize } = await setup();
    const plugin = (scene.getPhysicsEngine()! as PhysicsEngine).getPhysicsPlugin();
    const bodies = [...rods, prize].map((mesh) => mesh.physicsBody!);
    prize.physicsBody!.shape!.filterCollideMask = 0;
    for (const rod of rods.slice(2)) {
      const probe = CreateSphere(`bracket probe ${rod.name}`, { diameter: 0.02 }, scene);
      probe.position.copyFrom(rod.position).addInPlaceFromFloats(0, 0.16, 0);
      const body = new PhysicsBody(probe, PhysicsMotionType.DYNAMIC, false, scene);
      body.shape = new PhysicsShapeSphere(Vector3.Zero(), 0.01, scene);
      const contacts: unknown[] = [];
      body.setCollisionCallbackEnabled(true);
      body.getCollisionObservable().add((event) => contacts.push(event));
      for (let tick = 0; tick < 120; tick++) plugin.executeStep(1 / 120, [...bodies, body]);
      expect(contacts.length).toBeGreaterThan(0);
      probe.dispose();
    }
  });

  it("sweeps the documented rail-length range and records its end-fall threshold", async () => {
    for (const length of [0.3, 0.45, 0.6]) {
      const profile = structuredClone(playableProfile);
      profile.bridge.rods[0].lengthM.value = length;
      profile.bridge.rods[1].lengthM.value = length;
      const { scene, rods, prize } = await setup(profile);
      const plugin = (scene.getPhysicsEngine()! as PhysicsEngine).getPhysicsPlugin();
      const bodies = [...rods, prize].map((mesh) => mesh.physicsBody!);
      for (let tick = 0; tick < 120 * 2; tick++) plugin.executeStep(1 / 120, bodies);
      expect(prize.position.y < 0).toBe(length === 0.3);
      if (length > 0.3) expect(prize.position.y).toBeGreaterThan(0);
      const probe = CreateSphere(`sweep endpoint ${length}`, { diameter: 0.02 }, scene);
      probe.position.set(-0.08, 0.12, length / 2);
      const body = new PhysicsBody(probe, PhysicsMotionType.DYNAMIC, false, scene);
      body.shape = new PhysicsShapeSphere(Vector3.Zero(), 0.01, scene);
      const contacts: unknown[] = [];
      body.setCollisionCallbackEnabled(true);
      body.getCollisionObservable().add((event) => contacts.push(event));
      for (let tick = 0; tick < 120; tick++) plugin.executeStep(1 / 120, [...bodies, body]);
      expect(contacts.length).toBeGreaterThan(0);
      probe.dispose();
    }
  });

  it("keeps the prize supported with under one millimetre drift for ten seconds", async () => {
    const { scene, rods, prize } = await setup();
    const plugin = (scene.getPhysicsEngine()! as PhysicsEngine).getPhysicsPlugin();
    const bodies = [...rods, prize].map((mesh) => mesh.physicsBody!);
    for (let tick = 0; tick < 120 * 10; tick++) plugin.executeStep(1 / 120, bodies);
    const settled = prize.position.clone();
    const body = prize.physicsBody!;
    const properties = body.getMassProperties();
    const energy = () => {
      const localCom = properties.centerOfMass!.rotateByQuaternionToRef(prize.rotationQuaternion!, new Vector3());
      const principalRotation = prize.rotationQuaternion!.multiply(properties.inertiaOrientation!);
      const omega = body.getAngularVelocity().rotateByQuaternionToRef(principalRotation.conjugate(), new Vector3());
      const inertia = properties.inertia!;
      return properties.mass! * (9.80665 * (prize.position.y + localCom.y) + body.getLinearVelocity().lengthSquared() / 2 +
        (inertia.x * omega.x ** 2 + inertia.y * omega.y ** 2 + inertia.z * omega.z ** 2) / 2);
    };
    const initialEnergyJ = energy();
    let drift = 0, maximumLinearSpeedMps = 0, maximumAngularSpeedRadps = 0, maximumEnergyIncreaseJ = 0;
    for (let tick = 0; tick < 120 * 10; tick++) {
      plugin.executeStep(1 / 120, bodies);
      drift = Math.max(drift, prize.position.subtract(settled).length());
      maximumLinearSpeedMps = Math.max(maximumLinearSpeedMps, body.getLinearVelocity().length());
      maximumAngularSpeedRadps = Math.max(maximumAngularSpeedRadps, body.getAngularVelocity().length());
      maximumEnergyIncreaseJ = Math.max(maximumEnergyIncreaseJ, energy() - initialEnergyJ);
    }
    report("static-support", { settlingSeconds: 10, measuredSeconds: 10, maximumDriftM: drift, maximumLinearSpeedMps, maximumAngularSpeedRadps, maximumEnergyIncreaseJ }, {
      driftWithinOneMm: drift <= .001, noSustainedJitter: maximumLinearSpeedMps <= .005 && maximumAngularSpeedRadps <= .05,
      noIncreasingEnergy: maximumEnergyIncreaseJ <= 1e-6,
    }, "Passive prize plus four static rods. 120 Hz samples over entire 10 s interval; 3D drift from settled pose. Energy includes world COM gravitational potential and principal-axis rotational/translational kinetic energy. Numerical energy allowance 1 microjoule.");
    expect(drift).toBeLessThanOrEqual(0.001);
    expect(maximumLinearSpeedMps).toBeLessThanOrEqual(.005);
    expect(maximumAngularSpeedRadps).toBeLessThanOrEqual(.05);
    expect(maximumEnergyIncreaseJ).toBeLessThanOrEqual(1e-6);
  });
});
