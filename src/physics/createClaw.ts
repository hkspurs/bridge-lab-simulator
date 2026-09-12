import { Vector3, Quaternion } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import { PhysicsShapeBox } from "@babylonjs/core/Physics/v2/physicsShape";
import { Physics6DoFConstraint, LockConstraint } from "@babylonjs/core/Physics/v2/physicsConstraint";
import { PhysicsMotionType, PhysicsConstraintAxis as A, PhysicsConstraintMotorType, PhysicsConstraintAxisLimitMode } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import type { Scene } from "@babylonjs/core/scene";
import { validateClawProfile, type ClawProfile } from "../config/clawProfile";
import type { ClawRig, RigCommand } from "../crane/types";
import { contactMomentArmM, motorDemand } from "./clawActuator";
export type ActuatorSample = Readonly<{
  armIndex: number;
  angleRad: number;
  targetAngleRad: number;
  targetSpeedRadps: number;
  torqueLimitNm: number;
}>;
export type ContactSample = Readonly<{
  armIndex: number;
  distanceM: number;
  impulseNs: number;
  /** Raw solver contact-normal impulse / fixed dt; never total grip force. */
  solverNormalImpulseOverStepN: number;
  momentArmM: number;
  otherBodyName: string;
  normal: Readonly<{
    x: number;
    y: number;
    z: number;
  }>;
}>;
/** Physics-owned handle. Consumers must include bodies in the fixed-step batch.
 * Actuator limits are commands, never relabelled as measured contact forces.
 */
export interface PhysicalClawRig extends ClawRig {
  readonly bodies: readonly PhysicsBody[];
  readonly head: PhysicsBody;
  readonly arms: readonly PhysicsBody[];
  readonly joints: readonly Physics6DoFConstraint[];
  actuatorSamples(): readonly ActuatorSample[];
  contactSamples(): readonly ContactSample[];
}
export function createClaw(scene: Scene, profile: ClawProfile): PhysicalClawRig {
  validateClawProfile(profile);
  const bodies: PhysicsBody[] = [];
  const shapes: PhysicsShapeBox[] = [];
  const joints: Physics6DoFConstraint[] = [];
  const v = (key: Exclude<keyof ClawProfile, "id">) => profile[key].value;
  const box = (name: string, size: Vector3, position: Vector3, mass: number, motion = PhysicsMotionType.DYNAMIC, angle = 0) => {
    const mesh = CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene);
    mesh.position.copyFrom(position);
    mesh.rotationQuaternion = Quaternion.RotationAxis(Vector3.Forward(), angle);
    mesh.computeWorldMatrix(true);
    const body = new PhysicsBody(mesh, motion, false, scene);
    const shape = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), size, scene);
    shape.material = { friction: v("friction"), restitution: v("restitution") };
    body.shape = shape;
    body.setMassProperties({ mass });
    bodies.push(body);
    shapes.push(shape);
    return body;
  };
  const headSize = new Vector3(v("headWidthM"), v("headHeightM"), v("headDepthM"));
  const carriage = box(
    "claw carriage", headSize, new Vector3(0, v("homeHeightM"), 0),
    v("headMassKg"), PhysicsMotionType.ANIMATED,
  );
  const head = box(
    "claw suspended head", headSize,
    new Vector3(0, v("homeHeightM") - v("suspensionLengthM"), 0), v("headMassKg"),
  );
  // Physical rigid suspension stem is part of the head assembly; it has its own collider and lock.
  const stem = box(
    "claw suspension stem",
    new Vector3(v("suspensionThicknessM"), v("suspensionLengthM"), v("suspensionThicknessM")),
    new Vector3(0, v("homeHeightM") - v("suspensionLengthM") / 2, 0), v("stemMassKg"),
  );
  const supports = [
    new LockConstraint(
      new Vector3(0, -v("suspensionLengthM"), 0), Vector3.Zero(),
      Vector3.Right(), Vector3.Right(), scene,
    ),
    new LockConstraint(
      new Vector3(0, v("suspensionLengthM") / 2, 0), Vector3.Zero(),
      Vector3.Right(), Vector3.Right(), scene,
    ),
  ];
  carriage.addConstraint(head, supports[0]);
  head.addConstraint(stem, supports[1]);
  // Bodies connected through the suspension must not collide with its own rigid links.
  carriage.shape!.filterMembershipMask = 2;
  carriage.shape!.filterCollideMask = 1;
  head.shape!.filterMembershipMask = 2;
  head.shape!.filterCollideMask = 1;
  stem.shape!.filterMembershipMask = 2;
  stem.shape!.filterCollideMask = 1;
  let contacts: ContactSample[] = [];
  let lastContacts: ContactSample[] = [];
  let samples: ActuatorSample[] = [];
  let dt = 1 / 120;
  const arms = [-1, 1].map((side, index) => {
    const angle = side * v("openAngleRad");
    const length = v("armLengthM");
    const arm = box(
      `claw arm ${index}`, new Vector3(v("armThicknessM"), length, v("armDepthM")),
      head.transformNode.position.add(new Vector3(
        side * v("hingeHalfSpacingM") + Math.sin(angle) * length / 2,
        -Math.cos(angle) * length / 2, 0,
      )),
      v("armMassKg"), PhysicsMotionType.DYNAMIC, angle,
    );
    const joint = new Physics6DoFConstraint({
      pivotA: new Vector3(side * v("hingeHalfSpacingM"), 0, 0),
      pivotB: new Vector3(0, length / 2, 0),
      axisA: Vector3.Right(), axisB: Vector3.Right(),
      perpAxisA: Vector3.Up(), perpAxisB: Vector3.Up(), collision: false,
    }, [A.LINEAR_X, A.LINEAR_Y, A.LINEAR_Z, A.ANGULAR_X, A.ANGULAR_Y]
      .map(axis => ({ axis, minLimit: 0, maxLimit: 0 })), scene);
    head.addConstraint(arm, joint);
    joint.setAxisMode(A.ANGULAR_Z, PhysicsConstraintAxisLimitMode.LIMITED);
    const endpoints = [
      side * (v("closedAngleRad") - v("limitMarginRad")),
      side * (v("openAngleRad") + v("limitMarginRad")),
    ];
    joint.setAxisMinLimit(A.ANGULAR_Z, Math.min(...endpoints));
    joint.setAxisMaxLimit(A.ANGULAR_Z, Math.max(...endpoints));
    joint.setAxisMotorType(A.ANGULAR_Z, PhysicsConstraintMotorType.VELOCITY);
    joints.push(joint);
    arm.setCollisionCallbackEnabled(true);
    arm.getCollisionObservable().add(event => {
      const moment = event.point && event.normal ? contactMomentArmM(
        event.point, event.normal, head.transformNode.position,
        head.transformNode.rotationQuaternion!, { x: side * v("hingeHalfSpacingM"), y: 0, z: 0 },
      ) : 0;
      contacts.push(Object.freeze({
        armIndex: index, distanceM: event.distance, impulseNs: event.impulse,
        solverNormalImpulseOverStepN: event.impulse / dt, momentArmM: moment,
        otherBodyName: event.collidedAgainst.transformNode.name,
        normal: Object.freeze({ x: event.normal?.x ?? 0, y: event.normal?.y ?? 0, z: event.normal?.z ?? 0 }),
      }));
    });
    return arm;
  });
  let command: RigCommand = Object.freeze({ travel: "stop", claw: "open" });
  let targetClawAngle = v("openAngleRad");
  let disposed = false;
  const angle = (index: number) => {
    const q = head.transformNode.rotationQuaternion!.conjugate()
      .multiply(arms[index].transformNode.rotationQuaternion!);
    return (index === 0 ? -1 : 1) * Math.atan2(
      2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z),
    );
  };
  const beforeStep = (step: number) => {
    if (disposed)
      throw new Error("Claw is disposed");
    if (step !== 1 / 120)
      throw new Error("Claw requires fixed 1/120 s step");
    dt = step;
    lastContacts = contacts;
    contacts = [];
    const position = carriage.transformNode.position;
    const current = carriage.getLinearVelocity();
    const target = Vector3.Zero();
    const speed = v("maximumTravelSpeedMps");
    const acceleration = v("maximumTravelAccelerationMps2");
    const approach = (error: number) => Math.sign(error) * Math.min(speed, Math.sqrt(2 * acceleration * Math.abs(error)), Math.abs(error) / step);
    if (command.travel === "axis1")
      target.x = approach(v("travelRangeM") - position.x);
    if (command.travel === "axis2")
      target.z = approach(v("travelRangeM") - position.z);
    if (command.travel === "down")
      target.y = approach(v("dropHeightM") - position.y);
    if (command.travel === "up")
      target.y = approach(v("homeHeightM") - position.y);
    if (command.travel === "home") {
      target.x = approach(-position.x);
      target.z = approach(-position.z);
      target.y = approach(v("homeHeightM") - position.y);
    }
    // A released/cancelled manual drive is a locked carriage axis. Clear the
    // animated body's retained velocity in this tick so resume cannot drift.
    if (command.travel === "stop") current.setAll(0);
    if (target.length() > speed)
      target.normalize().scaleInPlace(speed);
    const delta = target.subtract(current);
    if (delta.length() > acceleration * step)
      delta.normalize().scaleInPlace(acceleration * step);
    carriage.setLinearVelocity(current.add(delta));
    samples = arms.map((_, index) => {
      const actual = angle(index);
      if (command.claw === "open") targetClawAngle = v("openAngleRad");
      if (command.claw === "close") targetClawAngle = v("closedAngleRad");
      const targetAngle = targetClawAngle;
      const moments = lastContacts.filter(c => c.armIndex === index && c.momentArmM > 0).map(c => c.momentArmM);
      const lever = moments.length ? Math.min(...moments) : Math.abs(v("armLengthM") * Math.cos(actual));
      const demand = motorDemand(actual, targetAngle, lever, command.claw, profile);
      joints[index].setAxisMotorMaxForce(A.ANGULAR_Z, demand.torqueLimitNm);
      joints[index].setAxisMotorTarget(A.ANGULAR_Z, (index === 0 ? -1 : 1) * demand.targetSpeedRadps);
      return Object.freeze({ armIndex: index, angleRad: actual, targetAngleRad: targetAngle, ...demand });
    });
  };
  return {
    bodies, head, arms, joints,
    command(value) { command = Object.freeze({ ...value }); },
    beforeStep,
    actuatorSamples: () => Object.freeze(samples.map(sample => Object.freeze({
      ...sample, angleRad: angle(sample.armIndex),
    }))),
    contactSamples: () => Object.freeze([...contacts]),
    observe: () => Object.freeze({
      atAxis1Limit: Math.abs(carriage.transformNode.position.x - v("travelRangeM")) < v("positionToleranceM"),
      atAxis2Limit: Math.abs(carriage.transformNode.position.z - v("travelRangeM")) < v("positionToleranceM"),
      atDropLimit: Math.abs(carriage.transformNode.position.y - v("dropHeightM")) < v("positionToleranceM"),
      atLiftLimit: Math.abs(carriage.transformNode.position.y - v("homeHeightM")) < v("positionToleranceM"),
      atHome: carriage.transformNode.position.subtract(new Vector3(0, v("homeHeightM"), 0))
        .length() < v("positionToleranceM"),
      openReached: arms.every((_, i) => Math.abs(angle(i) - v("openAngleRad")) < v("angleToleranceRad")),
      // Task 5 must compose the independent prize settling observation.
      prizeSettled: false,
      invalidPhysics: bodies.some(body => ![
        ...body.transformNode.position.asArray(), ...body.transformNode.rotationQuaternion!.asArray(),
        ...body.getLinearVelocity().asArray(), ...body.getAngularVelocity().asArray(),
      ].every(Number.isFinite)),
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      [...joints, ...supports].forEach(joint => joint.dispose());
      bodies.forEach(body => {
        const mesh = body.transformNode;
        body.dispose();
        mesh.dispose();
      });
      shapes.forEach(shape => shape.dispose());
      contacts = [];
      lastContacts = [];
      samples = [];
    },
  };
}
