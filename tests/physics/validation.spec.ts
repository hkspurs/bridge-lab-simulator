// @vitest-environment node
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import type { PhysicsEngine } from "@babylonjs/core/Physics/v2/physicsEngine";
import HavokPhysics from "@babylonjs/havok";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import "@babylonjs/core/Physics/v2/physicsEngineComponent";
import { Vector3, Quaternion } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import { PhysicsShapeBox } from "@babylonjs/core/Physics/v2/physicsShape";
import { PhysicsMotionType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { beforeAll, afterEach, describe, expect, it } from "vitest";
import { playableProfile } from "../../src/config/playableProfile";
import { createPhysicsScene } from "../../src/physics/createPhysicsScene";
import { createPrize } from "../../src/physics/createPrize";
import { contactMaterial } from "../../src/physics/createBridge";
import { PhysicsClock } from "../../src/physics/PhysicsClock";
import { stepSimulation } from "../../src/physics/stepSimulation";
import { report } from "./report";

const dt = 1 / 120, gravity = 9.80665;
let havok: Awaited<ReturnType<typeof HavokPhysics>>;
const cleanups: (() => void)[] = [];
beforeAll(async () => {
  const bytes = await readFile(createRequire(import.meta.url).resolve("@babylonjs/havok/lib/esm/HavokPhysics.wasm"));
  havok = await HavokPhysics({ wasmBinary: Uint8Array.from(bytes).buffer });
});
afterEach(() => cleanups.splice(0).forEach(dispose => dispose()));

function passive(gravityVector = new Vector3(0, -gravity, 0)) {
  const engine = new NullEngine(), scene = new Scene(engine), plugin = new HavokPlugin(true, havok);
  scene.enablePhysics(gravityVector, plugin); scene.physicsEnabled = false;
  const bodies: PhysicsBody[] = [];
  cleanups.push(() => { scene.dispose(); engine.dispose(); });
  function box(center: Vector3, size: Vector3, mass = 1, friction = contactMaterial(playableProfile)) {
    const mesh = CreateBox("analytic fixture box", { width: size.x, height: size.y, depth: size.z }, scene);
    mesh.position.copyFrom(center); mesh.rotationQuaternion = Quaternion.Identity();
    const body = new PhysicsBody(mesh, mass ? PhysicsMotionType.DYNAMIC : PhysicsMotionType.STATIC, false, scene);
    body.shape = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), size, scene);
    body.shape.material = friction; body.setMassProperties({ mass });
    body.setLinearDamping(0); body.setAngularDamping(0); bodies.push(body);
    return body;
  }
  return { scene, plugin, box, step(n = 1) { for (let i = 0; i < n; i++) plugin.executeStep(dt, (scene.getPhysicsEngine()! as PhysicsEngine).getBodies()); } };
}
async function machine(profile = structuredClone(playableProfile)) {
  const handle = await createPhysicsScene({} as HTMLCanvasElement, profile, { createEngine: () => new NullEngine(), initializeHavok: async () => havok });
  handle.engine.stopRenderLoop(); cleanups.push(() => handle.dispose());
  const plugin = (handle.scene.getPhysicsEngine()! as PhysicsEngine).getPhysicsPlugin();
  const bodies = [...handle.rods, handle.prize].map(mesh => mesh.physicsBody!).concat(handle.rig!.bodies);
  const rig = { ...handle.rig!, observe() {
    const value = handle.rig!.observe();
    const linear = handle.prize.physicsBody!.getLinearVelocity().length(), angular = handle.prize.physicsBody!.getAngularVelocity().length();
    return { ...value, prizeSettled: linear < .005 && angular < .05, prizeLinearSpeedMps: linear, prizeAngularSpeedRadps: angular };
  } };
  return { ...handle, bodies, tick() { stepSimulation(dt, handle.sequence!, rig, seconds => plugin.executeStep(seconds, bodies)); } };
}

describe("real Havok quantitative acceptance matrix", () => {
  it("free fall is within 1% displacement and velocity over 0.5–1.0 s", () => {
    const { box, step } = passive();
    const body = box(new Vector3(0, 10, 0), new Vector3(.1, .1, .1));
    step(60); const y0 = body.transformNode.position.y, v0 = body.getLinearVelocity().y;
    step(60); const displacement = y0 - body.transformNode.position.y, velocityChange = v0 - body.getLinearVelocity().y;
    const expectedDisplacement = gravity * (1 ** 2 - .5 ** 2) / 2, expectedVelocityChange = gravity * .5;
    const displacementError = Math.abs(displacement / expectedDisplacement - 1), velocityError = Math.abs(velocityChange / expectedVelocityChange - 1);
    report("free-fall", { intervalSeconds: [.5, 1], displacementM: displacement, expectedDisplacementM: expectedDisplacement, velocityChangeMps: velocityChange, expectedVelocityChangeMps: expectedVelocityChange, displacementError, velocityError }, { displacementWithinOnePercent: displacementError <= .01, velocityWithinOnePercent: velocityError <= .01 }, "Passive body; no surfaces/contact in this interval. Continuous analytic trajectory, without correcting away fixed-step integration error.");
    expect(displacementError).toBeLessThanOrEqual(.01); expect(velocityError).toBeLessThanOrEqual(.01);
  });

  it("friction incline sliding onset is within 1 degree of atan(mu static)", () => {
    const coefficient = playableProfile.contacts.boxRodStaticFriction.value;
    const expectedDegrees = Math.atan(coefficient) * 180 / Math.PI;
    const trials: { degrees: number; speedMps: number; displacementM: number }[] = [];
    // Rotate gravity instead of apparatus: exact coordinate equivalent of tilt,
    // fresh resting fixture at each 0.25 degree sample, no accumulated impulse.
    for (let degrees = expectedDegrees - 2; degrees <= expectedDegrees + 2.001; degrees += .25) {
      const radians = degrees * Math.PI / 180;
      const { box, step } = passive(new Vector3(gravity * Math.sin(radians), -gravity * Math.cos(radians), 0));
      box(new Vector3(0, -.025, 0), new Vector3(4, .05, 1), 0);
      const body = box(new Vector3(0, .011, 0), new Vector3(.1, .02, .1));
      step(240);
      trials.push({ degrees, speedMps: body.getLinearVelocity().x, displacementM: body.transformNode.position.x });
    }
    const onset = trials.find(trial => trial.speedMps > .01 && trial.displacementM > .01)?.degrees ?? Infinity;
    const errorDegrees = Math.abs(onset - expectedDegrees);
    report("friction-incline", { coefficient, expectedDegrees, onsetDegrees: onset, errorDegrees, trials }, { withinOneDegree: errorDegrees <= 1 }, "Sliding is sustained >1 cm displacement and >1 cm/s at 2 s; 0.25 degree angular resolution. Wide low block prevents tipping. Same configured static/dynamic material coefficients as prize/rods.");
    expect(errorDegrees).toBeLessThanOrEqual(1);
  });

  it("quasi-static tipping force is within 5% of analytic moment balance", () => {
    const { box, step, scene } = passive();
    const highFriction = { staticFriction: 2, friction: 2, restitution: 0 };
    box(new Vector3(0, -.025, 0), new Vector3(2, .05, 1), 0, highFriction);
    const prize = createPrize(scene, playableProfile);
    const body = prize.physicsBody!;
    body.shape!.material = highFriction;
    const contactPoints: { x: number; y: number; normalY: number }[] = [];
    body.setCollisionCallbackEnabled(true);
    body.getCollisionObservable().add(event => { if (event.point) contactPoints.push({ x: event.point.x, y: event.point.y, normalY: event.normal?.y ?? 0 }); });
    step(240);
    const settledPose = { position: body.transformNode.position.asArray(), rotation: body.transformNode.rotationQuaternion!.asArray() };
    const shapeBounds = body.shape!.getBoundingBox();
    const localCom = body.getMassProperties().centerOfMass!;
    const comHeightM = playableProfile.prize.heightM.value / 2 + localCom.y;
    const massKg = body.getMassProperties().mass!;
    const halfWidthM = playableProfile.prize.widthM.value / 2;
    const expectedForceN = massKg * gravity * halfWidthM / comHeightM;
    const pivotX = () => new Vector3(halfWidthM, -playableProfile.prize.heightM.value / 2, 0).rotateByQuaternionToRef(prize.rotationQuaternion!, new Vector3()).addInPlace(prize.position).x;
    const initialPivotX = pivotX();
    let onsetForceN = Infinity, onsetAngleRad = 0, maximumBaseDriftM = 0;
    for (let tick = 1; tick <= 120 * 110; tick++) {
      const forceN = .05 * tick * dt;
      contactPoints.length = 0;
      body.applyImpulse(new Vector3(forceN * dt, 0, 0), localCom.rotateByQuaternionToRef(prize.rotationQuaternion!, new Vector3()).addInPlace(prize.position));
      step();
      const angle = Math.abs(body.transformNode.rotationQuaternion!.toEulerAngles().z);
      if (angle < .01) maximumBaseDriftM = Math.max(maximumBaseDriftM, Math.abs(pivotX() - initialPivotX));
      if (angle > .02) { onsetForceN = forceN; onsetAngleRad = angle; break; }
    }
    const relativeError = Math.abs(onsetForceN / expectedForceN - 1);
    report("quasi-static-tipping", { settledPose, shapeBounds: { min: shapeBounds.minimum.asArray(), max: shapeBounds.maximum.asArray() }, contactPointsAtOnset: contactPoints, massProperties: body.getMassProperties(), expectedForceN, onsetForceN, onsetAngleRad, relativeError, maximumBaseDriftM, forceRampNps: .05, fixture: { massKg, halfWidthM, comHeightM, friction: 2, massBlockCount: playableProfile.prize.massBlocks.length } }, { forceWithinFivePercent: relativeError <= .05, noPriorSliding: maximumBaseDriftM <= .001 }, "Force at actual prize composite COM, ramp 0.05 N/s. Analytic onset F*h=m*g*b. Detect 0.02 rad tilt; high-friction test apparatus prevents sliding; drift measures the bottom tipping-edge world X, not permitted COM displacement from rotation. This is an actively forced moment-balance experiment, not a passive energy claim.");
    expect(relativeError).toBeLessThanOrEqual(.05); expect(maximumBaseDriftM).toBeLessThanOrEqual(.001);
  }, 30_000);

  it("rod sliding acceleration is within 5% of force balance", async () => {
    const profile = structuredClone(playableProfile);
    profile.prize.widthM.value = .17;
    profile.bridge.rods[0].lengthM.value = .6; profile.bridge.rods[1].lengthM.value = .6;
    const handle = await machine(profile);
    const body = handle.prize.physicsBody!;
    for (let tick = 0; tick < 600; tick++) handle.tick();
    body.setLinearVelocity(new Vector3(0, 0, .1));
    const velocities: number[] = [];
    const slidingContacts: { tick: number; point: number[]; normal: number[]; impulseNs: number; other: string }[] = [];
    let sampleTick = 0;
    body.setCollisionCallbackEnabled(true);
    body.getCollisionObservable().add(event => slidingContacts.push({ tick: sampleTick, point: event.point?.asArray() ?? [], normal: event.normal?.asArray() ?? [], impulseNs: event.impulse, other: event.collidedAgainst.transformNode.name }));
    // Deceleration test begins already sliding, over 3 fixed ticks before stop.
    for (let tick = 0; tick < 3; tick++) { sampleTick = tick; handle.tick(); velocities.push(body.getLinearVelocity().z); }
    const expectedAcceleration = -profile.contacts.boxRodDynamicFriction.value * gravity;
    const acceleration = (velocities[2] - velocities[0]) / (2 * dt);
    const error = Math.abs(acceleration / expectedAcceleration - 1);
    report("rod-sliding", { slidingContacts, rotationAfter: handle.prize.rotationQuaternion!.asArray(), angularVelocityAfter: body.getAngularVelocity().asArray(), intervalSeconds: [dt, 3 * dt], initialSpeedMps: .1, velocitiesMps: velocities, expectedAccelerationMps2: expectedAcceleration, accelerationMps2: acceleration, relativeError: error, fixturePrizeWidthM: .17, fixtureRodLengthM: .6 }, { accelerationWithinFivePercent: error <= .05, stillSliding: velocities[2] > 0 }, "Widened prize within sourced range reaches both circular crowns, giving vertical normals; actual prize mass blocks, inertia and rod colliders. Horizontal coast-down at configured maximum carriage speed; interval ends before kinetic friction switches to static.");
    expect(error).toBeLessThanOrEqual(.05); expect(velocities[2]).toBeGreaterThan(0);
  });

  it("render scheduling gives the same actual-engine state at equal ticks", async () => {
    const results = [];
    for (const hz of [30, 60, 120]) {
      const handle = await machine();
      const clock = new PhysicsClock({ stepSeconds: dt, maxFrameSeconds: .1, maxStepsPerFrame: 12 });
      let ticks = 0;
      const commands = () => {
        if (ticks === 0) handle.dispatch({ type: "press", axis: 1 });
        if (ticks === 42) handle.dispatch({ type: "release", axis: 1 });
        if (ticks === 44) handle.dispatch({ type: "press", axis: 2 });
        if (ticks === 86) handle.dispatch({ type: "release", axis: 2 });
        handle.tick(); ticks++;
      };
      while (ticks < 2400) clock.advance(1 / hz, commands);
      results.push({ hz, ticks, position: handle.prize.position.clone(), rotation: handle.prize.rotationQuaternion!.clone(), phase: handle.sequence!.phase, outcome: handle.sequence!.status.settleOutcome });
    }
    const reference = results[0];
    const differences = results.map(value => ({ hz: value.hz, ticks: value.ticks, positionM: value.position.subtract(reference.position).length(), angleDegrees: 2 * Math.acos(Math.min(1, Math.abs(Quaternion.Dot(value.rotation, reference.rotation)))) * 180 / Math.PI, phase: value.phase, outcome: value.outcome }));
    report("render-rate-independence", { fixedTicks: 2400, differences }, { positionWithinThreeMm: differences.every(value => value.positionM <= .003), angleWithinOnePointFiveDegrees: differences.every(value => value.angleDegrees <= 1.5), identicalOutcome: differences.every(value => value.phase === reference.phase && value.outcome === reference.outcome), completed: reference.phase === "REVIEW" }, "Same real Havok scene and per-tick input; 30/60/120 Hz clock schedules. No modified gravity, physics step or body poses.");
    for (const value of differences) { expect(value.positionM).toBeLessThanOrEqual(.003); expect(value.angleDegrees).toBeLessThanOrEqual(1.5); expect(value.phase).toBe("REVIEW"); expect(value.outcome).toBe(reference.outcome); }
  }, 30_000);

  it("sustains 20 complete carriage cycles without NaN, joint escape, growing oscillation or body leaks", async () => {
    const handle = await machine();
    const bodyCount = (handle.scene.getPhysicsEngine()! as PhysicsEngine).getBodies().length;
    const prizeId = handle.prize.uniqueId;
    const cycles = [];
    let peakContact: unknown;
    let activeCycle = 0, activeTick = 0;
    let maximumPenetrationM = 0;
    for (const body of handle.bodies.filter(value => value.getMotionType() !== PhysicsMotionType.STATIC)) {
      body.setCollisionCallbackEnabled(true);
      body.getCollisionObservable().add(event => {
        if (-event.distance > maximumPenetrationM) {
          maximumPenetrationM = -event.distance;
          peakContact = { cycle: activeCycle, tick: activeTick, phase: handle.sequence!.phase, body: body.transformNode.name, other: event.collidedAgainst.transformNode.name, distanceM: event.distance, impulseNs: event.impulse, bodyVelocityMps: body.getLinearVelocity().asArray() };
        }
      });
    }
    let invalidPhysics = false, maximumJointEscapeM = 0;
    const step = () => { activeTick++; handle.tick(); };
    for (let cycle = 0; cycle < 20; cycle++) {
      activeCycle = cycle + 1; activeTick = 0;
      handle.dispatch({ type: "press", axis: 1 });
      for (let tick = 0; tick < 42; tick++) step();
      handle.dispatch({ type: "release", axis: 1 }); handle.dispatch({ type: "press", axis: 2 });
      for (let tick = 0; tick < 42; tick++) step();
      handle.dispatch({ type: "release", axis: 2 });
      let ticks = 0;
      while (handle.sequence!.phase !== "REVIEW" && handle.sequence!.phase !== "FAULT" && ticks++ < 3600) {
        step(); invalidPhysics ||= handle.rig!.observe().invalidPhysics || ![...handle.prize.position.asArray(), ...handle.prize.rotationQuaternion!.asArray(), ...handle.prize.physicsBody!.getLinearVelocity().asArray(), ...handle.prize.physicsBody!.getAngularVelocity().asArray()].every(Number.isFinite);
        const head = handle.rig!.head.transformNode;
        const carriage = handle.rig!.bodies[0].transformNode;
        maximumJointEscapeM = Math.max(maximumJointEscapeM, head.position.subtract(carriage.position).subtract(new Vector3(0, -.08, 0)).length());
        for (const contact of handle.rig!.contactSamples()) maximumPenetrationM = Math.max(maximumPenetrationM, -contact.distanceM);
      }
      const terminalAngularSpeedRadps = Math.max(...handle.rig!.arms.map(arm => arm.getAngularVelocity().length()));
      cycles.push({ cycle: cycle + 1, ticks, phase: handle.sequence!.phase, terminalAngularSpeedRadps, bodyCount: (handle.scene.getPhysicsEngine()! as PhysicsEngine).getBodies().length, prizeInstanceId: handle.prize.uniqueId });
      if (handle.sequence!.phase !== "REVIEW") break;
      handle.dispatch({ type: "continue" });
    }
    report("contact-penetration", { maximumPenetrationM, peakContact, cycles: cycles.length }, { maximumWithinOneMm: maximumPenetrationM <= .001 }, "All dynamic and animated body collision callbacks sampled on every 1/120 s tick, including manual travel and initial prize settling; all 20 complete cycles at the sourced playable speeds and geometry. Solver signed contact distance, not visual AABB overlap. Impact impulse remains separate from quasi-static actuator force validation.");
    report("sustained-mechanism", { peakContact, cycles, invalidPhysics, maximumPenetrationM, maximumJointEscapeM, initialBodyCount: bodyCount }, { twentyCompleteCycles: cycles.length === 20 && cycles.every(value => value.phase === "REVIEW"), finitePhysics: !invalidPhysics, noJointEscape: maximumJointEscapeM <= .001, noGrowingOscillation: cycles.every(value => value.terminalAngularSpeedRadps <= .05), noBodyLeakOrPrizeRecreation: cycles.every(value => value.bodyCount === bodyCount && value.prizeInstanceId === prizeId) }, "Complete automatic DROP/CLOSE/LIFT/RETURN/OPEN/SETTLE with deliberate manual holds and Continue. Prize never reset. Oscillation criterion is every REVIEW arm speed <=0.05 rad/s. Head-to-carriage LockConstraint anchor separation is checked against a conservative 1 mm numerical bound. Active actuator/carriage means no passive energy assertion.");
    expect(cycles).toHaveLength(20); expect(cycles.every(value => value.phase === "REVIEW")).toBe(true);
    expect(invalidPhysics).toBe(false); expect(maximumJointEscapeM).toBeLessThanOrEqual(.001);
    expect(cycles.every(value => value.terminalAngularSpeedRadps <= .05)).toBe(true);
    expect(cycles.every(value => value.bodyCount === bodyCount && value.prizeInstanceId === prizeId)).toBe(true);
    expect(maximumPenetrationM).toBeLessThanOrEqual(.001);
  }, 60_000);
});
