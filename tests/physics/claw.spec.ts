// @vitest-environment node
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import HavokPhysics from "@babylonjs/havok";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import "@babylonjs/core/Physics/v2/physicsEngineComponent";
import { Vector3, Quaternion } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import { PhysicsShapeBox } from "@babylonjs/core/Physics/v2/physicsShape";
import { LockConstraint } from "@babylonjs/core/Physics/v2/physicsConstraint";
import { PhysicsMotionType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { beforeAll, afterEach, describe, expect, it } from "vitest";
import { createClaw } from "../../src/physics/createClaw";
import { clawProfile } from "../../src/config/clawProfile";
let havok: Awaited<ReturnType<typeof HavokPhysics>>;
const cleanups: (() => void)[] = [];
beforeAll(async () => {
  const wasmBinary = await readFile(createRequire(import.meta.url).resolve("@babylonjs/havok/lib/esm/HavokPhysics.wasm"));
  expect(JSON.parse(await readFile(new URL("../../node_modules/@babylonjs/core/package.json", import.meta.url), "utf8")).version).toBe("8.56.2");
  expect(JSON.parse(await readFile(new URL("../../node_modules/@babylonjs/havok/package.json", import.meta.url), "utf8")).version).toBe("1.3.14");
  havok = await HavokPhysics({ wasmBinary: Uint8Array.from(wasmBinary).buffer });
});
afterEach(() => cleanups.splice(0).forEach(f => f()));
function fixture(profile = clawProfile) {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const plugin = new HavokPlugin(true, havok);
  scene.enablePhysics(new Vector3(0, -9.80665, 0), plugin);
  scene.physicsEnabled = false;
  const rig = createClaw(scene, profile);
  const extra: PhysicsBody[] = [];
  cleanups.push(() => { rig.dispose(); scene.dispose(); engine.dispose(); });
  function step(n = 1) { for (let i = 0; i < n; i++) {
    rig.beforeStep(1 / 120);
    plugin.executeStep(1 / 120, [...rig.bodies, ...extra]);
  } }
  function box(name: string, center: Vector3, size: Vector3, motion = PhysicsMotionType.STATIC) {
    const mesh = CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene);
    mesh.position.copyFrom(center);
    mesh.rotationQuaternion = Quaternion.Identity();
    const body = new PhysicsBody(mesh, motion, false, scene);
    body.shape = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), size, scene);
    body.setMassProperties({ mass: 1 });
    extra.push(body);
    return body;
  }
  function obstacle(width: number) {
    // Two independently supported load-cell cheeks: horizontal joint impulse measures clamp force.
    const cells = [-1, 1].map(side => {
      const center = new Vector3(side * (width / 2 - .005), clawProfile.homeHeightM.value - clawProfile.suspensionLengthM.value - .155, 0);
      const anchor = box("load cell anchor", center, new Vector3(.001, .001, .001));
      anchor.shape!.filterCollideMask = 0;
      const body = box("load cell cheek", center, new Vector3(.01, .07, .04), PhysicsMotionType.DYNAMIC);
      body.shape!.material = { friction: 0, restitution: 0 };
      const joint = new LockConstraint(Vector3.Zero(), Vector3.Zero(), Vector3.Right(), Vector3.Right(), scene);
      anchor.addConstraint(body, joint);
      return { body, joint };
    });
    return cells;
  }
  return { scene, rig, step, obstacle, box, remove(body: PhysicsBody) { extra.splice(extra.indexOf(body), 1); body.dispose(); } };
}
/** Pinned to Babylon 8.56.2 + Havok 1.3.14 by beforeAll. No native access enters app code. */
function impulses(joint: LockConstraint) {
  const value = havok.HP_Constraint_GetAppliedImpulses(joint._pluginData[0]);
  expect(value[0]).toBe(havok.Result.RESULT_OK);
  return value;
}
describe("real Havok finite-torque claw", () => {
  it("closes dynamically in empty space with constrained thick dual arms", () => {
    const { rig, step } = fixture();
    expect(rig.arms).toHaveLength(2);
    expect(rig.head.getMotionType()).toBe(PhysicsMotionType.DYNAMIC);
    for (const arm of rig.arms)
      expect(arm.getMotionType()).toBe(PhysicsMotionType.DYNAMIC);
    rig.command({ travel: "stop", claw: "close" });
    step(600);
    for (const sample of rig.actuatorSamples())
      expect(Math.abs(sample.angleRad - clawProfile.closedAngleRad.value)).toBeLessThan(.02);
  });
  for (const width of [.08, .12, .18])
    it(`blocks closure and caps measured quasi-static force at opening ${width} m`, () => {
      const { rig, step, obstacle } = fixture();
      const cells = obstacle(width);
      rig.command({ travel: "stop", claw: "close" });
      let maxAppliedTorqueNm = 0, maxCommandedTorqueLimitNm = 0;
    let maxPenetration = 0, maxImpactImpulse = 0, maxForce = 0, maxTorqueRatio = 0, maxSpeed = 0, maxNormalImpulseSumVsResultantDifferenceRatio = 0;
      let count = 0;
      let minForce = Infinity;
      for (let tick = 0; tick < 720; tick++) {
        step();
        const contacts = rig.contactSamples();
        for (const arm of rig.arms)
          maxSpeed = Math.max(maxSpeed, Math.abs(arm.getAngularVelocity().z));
        for (const c of contacts) {
          maxPenetration = Math.max(maxPenetration, -c.distanceM);
          maxImpactImpulse = Math.max(maxImpactImpulse, c.impulseNs);
        }
        if (tick > 480) {
          for (const [index, cell] of cells.entries()) {
            const reaction = impulses(cell.joint)[1];
            const force = Math.hypot(reaction[0] * 120, reaction[1] * 120 - 9.80665, reaction[2] * 120);
            maxForce = Math.max(maxForce, force);
            minForce = Math.min(minForce, force);
            const contactForce = contacts.filter(c => c.armIndex === index).reduce((sum, c) => sum + c.solverNormalImpulseOverStepN, 0);
            maxNormalImpulseSumVsResultantDifferenceRatio = Math.max(maxNormalImpulseSumVsResultantDifferenceRatio, Math.abs(contactForce - force) / force);
          }
          for (const sample of rig.actuatorSamples()) {
            const native = havok.HP_Constraint_GetAppliedImpulses(rig.joints[sample.armIndex]._pluginData[0]);
            maxAppliedTorqueNm = Math.max(maxAppliedTorqueNm, Math.abs(native[2][2]) * 120);
          maxCommandedTorqueLimitNm = Math.max(maxCommandedTorqueLimitNm, sample.torqueLimitNm);
          maxTorqueRatio = Math.max(maxTorqueRatio, Math.abs(native[2][2]) * 120 / sample.torqueLimitNm);
          }
          count += contacts.length;
        }
      }
      console.log(JSON.stringify({ width, maxPenetration, maxImpactImpulse, maxForce, minForce, maxTorqueRatio, maxAppliedTorqueNm, maxCommandedTorqueLimitNm, maxSpeed, maxNormalImpulseSumVsResultantDifferenceRatio, angles: rig.actuatorSamples().map(s => s.angleRad), count }));
      expect(count).toBeGreaterThan(0);
      expect(minForce).toBeGreaterThan(.5);
      expect(maxForce).toBeLessThanOrEqual(clawProfile.peakContactForceN.value * 1.05);
      expect(maxTorqueRatio).toBeLessThanOrEqual(1.001);
      // Contact normal impulses and load-cell resultant are distinct observables; report both.
      // A finite motor velocity target is not a speed governor under gravity/external loading.
      for (const sample of rig.actuatorSamples())
        expect(Math.abs(sample.targetSpeedRadps)).toBeLessThanOrEqual(clawProfile.maximumAngularSpeedRadps.value);
      expect(maxPenetration).toBeLessThanOrEqual(.001);
      for (const sample of rig.actuatorSamples())
        expect(sample.angleRad).toBeGreaterThan(clawProfile.closedAngleRad.value + .1);
    });
  it("calibrates native load-cell impulses against a known applied force", () => {
    const { box, step, scene } = fixture();
    const center = new Vector3(1, 1, 1);
    const anchor = box("calibration anchor", center, new Vector3(.001, .001, .001));
    anchor.shape!.filterCollideMask = 0;
    const body = box("calibration mass", center, new Vector3(.02, .02, .02), PhysicsMotionType.DYNAMIC);
    body.shape!.filterCollideMask = 0;
    const joint = new LockConstraint(Vector3.Zero(), Vector3.Zero(), Vector3.Right(), Vector3.Right(), scene);
    anchor.addConstraint(body, joint);
    for (let tick = 0; tick < 240; tick++) {
      body.applyImpulse(new Vector3(1 / 120, 0, 0), body.transformNode.position);
      step();
    }
    const force = impulses(joint)[1].map(a => a * 120);
    console.log(JSON.stringify({ knownLoadReactionN: force }));
    expect(Math.abs(force[0])).toBeCloseTo(1, 2);
    expect(Math.abs(force[1])).toBeCloseTo(9.80665, 2);
  });
  it("saturates a reduced native motor torque limit without exceeding it", () => {
    const profile = structuredClone(clawProfile);
    profile.peakContactForceN.value = 1;
    profile.holdingContactForceN.value = .5;
    profile.forceReserveRatio.value = .5;
    const { rig, step, obstacle } = fixture(profile);
    obstacle(.12);
    rig.command({ travel: "stop", claw: "close" });
    let maxRatio = 0;
    for (let tick = 0; tick < 720; tick++) {
      step();
      if (tick > 480)
        for (const sample of rig.actuatorSamples()) {
          const impulse = havok.HP_Constraint_GetAppliedImpulses(rig.joints[sample.armIndex]._pluginData[0])[2][2];
          maxRatio = Math.max(maxRatio, Math.abs(impulse) * 120 / sample.torqueLimitNm);
        }
    }
    console.log(JSON.stringify({ reducedMotorMaxRatio: maxRatio }));
    expect(maxRatio).toBeGreaterThan(.95);
    expect(maxRatio).toBeLessThanOrEqual(1.001);
  });
  it("moves the carriage with bounded speed/acceleration and reports actual travel limits", () => {
    const { rig, step } = fixture();
    const carriage = rig.bodies[0];
    let maxSpeed = 0, maxAcceleration = 0;
    const run = (travel: "axis1" | "axis2" | "down" | "up" | "home" | "stop", ticks = 720) => { rig.command({ travel, claw: "open" }); for (let tick = 0; tick < ticks; tick++) {
      const previous = carriage.getLinearVelocity();
      step();
      const current = carriage.getLinearVelocity();
      maxSpeed = Math.max(maxSpeed, current.length());
      if (travel !== "stop") maxAcceleration = Math.max(maxAcceleration, current.subtract(previous).length() * 120);
    } };
    run("axis1");
    expect(carriage.transformNode.position.x).toBeCloseTo(clawProfile.travelRangeM.value, 3);
    expect(rig.observe().atAxis1Limit).toBe(true);
    run("axis2");
    expect(carriage.transformNode.position.z).toBeCloseTo(clawProfile.travelRangeM.value, 3);
    expect(rig.observe().atAxis2Limit).toBe(true);
    run("down");
    expect(rig.observe().atDropLimit).toBe(true);
    run("up");
    expect(rig.observe().atLiftLimit).toBe(true);
    run("home");
    expect(rig.observe().atHome).toBe(true);
    run("axis1", 60);
    run("stop", 120);
    expect(carriage.getLinearVelocity().length()).toBeLessThan(1e-6);
    console.log(JSON.stringify({ maxTravelSpeed: maxSpeed, maxTravelAcceleration: maxAcceleration }));
    expect(maxSpeed).toBeLessThanOrEqual(clawProfile.maximumTravelSpeedMps.value * 1.001);
    expect(maxAcceleration).toBeLessThanOrEqual(clawProfile.maximumTravelAccelerationMps2.value * 1.001);
  });
  it("stops manual carriage drive in the first tick after cancellation", () => {
    const { rig, step } = fixture();
    const carriage = rig.bodies[0];
    rig.command({ travel: "axis1", claw: "open" });
    step(30);
    expect(carriage.getLinearVelocity().x).toBeGreaterThan(0);
    rig.command({ travel: "stop", claw: "hold" });
    step();
    expect(carriage.getLinearVelocity().length()).toBeLessThan(1e-8);
    const stoppedAt = carriage.transformNode.position.clone();
    step(30);
    expect(carriage.transformNode.position.subtract(stoppedAt).length()).toBeLessThan(1e-8);
  });
  it("holds the last claw target while travelling", () => {
    const { rig, step } = fixture();
    rig.command({ travel: "axis1", claw: "hold" });
    step(360);
    for (const sample of rig.actuatorSamples()) {
      expect(sample.targetAngleRad).toBe(clawProfile.openAngleRad.value);
      expect(Math.abs(sample.angleRad - clawProfile.openAngleRad.value)).toBeLessThan(.02);
    }
  });
  it("allows an unsupported heavy prize to slip under gravity with no attachment joint", () => {
    const { rig, step, box, remove } = fixture();
    const y = clawProfile.homeHeightM.value - clawProfile.suspensionLengthM.value - .15;
    const prize = box("overload prize", new Vector3(0, y, 0), new Vector3(.12, .06, .04), PhysicsMotionType.DYNAMIC);
    const support = box("removable test support", new Vector3(0, y - .035, 0), new Vector3(.12, .01, .04));
    rig.command({ travel: "stop", claw: "close" });
    step(600);
    const initial = prize.transformNode.position.y;
    rig.command({ travel: "stop", claw: "hold" });
    remove(support);
    prize.applyImpulse(new Vector3(0, -.000001, 0), prize.transformNode.position);
    step(120);
    const fall = initial - prize.transformNode.position.y;
    console.log(JSON.stringify({ overloadPrizeFallM: fall }));
    expect(fall).toBeGreaterThan(.1);
  });
  it("backdrives under an external opening torque above holding capacity", () => {
    const { rig, step } = fixture();
    rig.command({ travel: "stop", claw: "close" });
    step(480);
    rig.command({ travel: "stop", claw: "hold" });
    const initial = rig.actuatorSamples().map(s => s.angleRad);
    for (let tick = 0; tick < 120; tick++) {
      for (const [i, arm] of rig.arms.entries())
        arm.applyAngularImpulse(new Vector3(0, 0, (i === 0 ? -1 : 1) * .8 / 120));
      step();
    }
    const final = rig.actuatorSamples().map(s => s.angleRad);
    console.log(JSON.stringify({ backdrive: final.map((a, i) => a - initial[i]) }));
    final.forEach((a, i) => { expect(a - initial[i]).toBeGreaterThan(.2); expect(a).toBeLessThanOrEqual(clawProfile.openAngleRad.value + clawProfile.limitMarginRad.value + .02); });
  });
  it("remains stable for twenty obstructed open/close cycles and cleans every claw body and joint", () => {
    const { scene, rig, step, obstacle } = fixture();
    obstacle(.12);
    const before = scene.getPhysicsEngine()!.getBodies().length;
    let maximumPenetrationM = 0;
    let maximumHeadDriftM = 0;
    const headStart = rig.head.transformNode.position.clone();
    const sampleSteps = () => {
      for (let tick = 0; tick < 360; tick++) {
        step();
        for (const contact of rig.contactSamples()) maximumPenetrationM = Math.max(maximumPenetrationM, -contact.distanceM);
        maximumHeadDriftM = Math.max(maximumHeadDriftM, rig.head.transformNode.position.subtract(headStart).length());
      }
    };
    for (let cycle = 0; cycle < 20; cycle++) {
      rig.command({ travel: "stop", claw: "close" });
      sampleSteps();
      rig.command({ travel: "stop", claw: "open" });
      sampleSteps();
      expect(rig.observe().invalidPhysics).toBe(false);
      expect(rig.observe().openReached).toBe(true);
    }
    console.log(JSON.stringify({cycles:20, maximumPenetrationM, maximumHeadDriftM}));
    expect(maximumPenetrationM).toBeLessThanOrEqual(.001);
    expect(maximumHeadDriftM).toBeLessThanOrEqual(.001);
    rig.dispose();
    rig.dispose();
    expect(scene.getPhysicsEngine()!.getBodies()).toHaveLength(before - rig.bodies.length);
  });
});
