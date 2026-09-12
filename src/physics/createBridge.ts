import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import { PhysicsMotionType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PhysicsShapeCylinder } from "@babylonjs/core/Physics/v2/physicsShape";
import { Tags } from "@babylonjs/core/Misc/tags";
import type { Scene } from "@babylonjs/core/scene";
import type { CalibrationProfile } from "../config/types";

export function contactMaterial(profile: CalibrationProfile) {
  return {
    staticFriction: profile.contacts.boxRodStaticFriction.value,
    friction: profile.contacts.boxRodDynamicFriction.value,
    restitution: profile.contacts.restitution.value,
  };
}

export function createBridge(scene: Scene, profile: CalibrationProfile) {
  // Rod length is staging, not a calibrated contact parameter.
  const length = 0.45;
  const diameter = profile.bridge.rodDiameterM.value;
  const material = new StandardMaterial("rod satin steel", scene);
  material.diffuseColor = new Color3(0.48, 0.53, 0.57);
  material.specularColor = new Color3(0.7, 0.7, 0.7);
  return [-1, 1].map((side) => {
    const rod = CreateCylinder(`bridge rod ${side}`, { height: length, diameter, tessellation: 64 }, scene);
    Tags.AddTagsTo(rod, "bridge-rod");
    rod.rotation.x = Math.PI / 2;
    rod.position.set(side * profile.bridge.rodCenterDistanceM.value / 2, side * profile.bridge.rodHeightDeltaM.value / 2, 0);
    rod.material = material;
    rod.computeWorldMatrix(true);
    const shape = new PhysicsShapeCylinder(new Vector3(0, -length / 2, 0), new Vector3(0, length / 2, 0), diameter / 2, scene);
    shape.material = contactMaterial(profile);
    const body = new PhysicsBody(rod, PhysicsMotionType.STATIC, false, scene);
    body.shape = shape;
    rod.onDisposeObservable.add(() => shape.dispose());
    return rod;
  });
}
