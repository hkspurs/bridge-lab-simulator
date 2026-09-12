import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import { PhysicsMotionType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PhysicsShapeConvexHull, PhysicsShapeCylinder } from "@babylonjs/core/Physics/v2/physicsShape";
import { Tags } from "@babylonjs/core/Misc/tags";
import type { Scene } from "@babylonjs/core/scene";
import type { CalibrationProfile, PlayableCalibrationProfile, PlayableRod, SupportedCalibrationProfile } from "../config/types";

export function contactMaterial(profile: Pick<CalibrationProfile, "contacts">) {
  return { staticFriction: profile.contacts.boxRodStaticFriction.value, friction: profile.contacts.boxRodDynamicFriction.value, restitution: profile.contacts.restitution.value };
}

function rodMaterial(scene: Scene) {
  const material = new StandardMaterial("rod satin steel", scene);
  material.diffuseColor = new Color3(0.48, 0.53, 0.57);
  material.specularColor = new Color3(0.7, 0.7, 0.7);
  return material;
}

export function rodOrientationQuaternion(rod: PlayableRod): Quaternion {
  const degrees = Math.PI / 180;
  // Intrinsic XYZ: rotate around each successively rotated local axis.
  return Quaternion.RotationAxis(Vector3.Right(), rod.orientation.xDegrees.value * degrees)
    .multiply(Quaternion.RotationAxis(Vector3.Up(), rod.orientation.yDegrees.value * degrees))
    .multiply(Quaternion.RotationAxis(Vector3.Forward(), rod.orientation.zDegrees.value * degrees))
    .normalize();
}

/** A chamfered rectangular prism: the same vertices render the rod and define its convex collider. */
function roundedRectangularRod(name: string, length: number, width: number, height: number, radius: number, scene: Scene): Mesh {
  const mesh = new Mesh(name, scene);
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const chamfer = Math.min(radius, halfWidth, halfHeight);
  const corners = [
    { x: halfWidth - chamfer, y: halfHeight - chamfer, start: 0 },
    { x: -halfWidth + chamfer, y: halfHeight - chamfer, start: Math.PI / 2 },
    { x: -halfWidth + chamfer, y: -halfHeight + chamfer, start: Math.PI },
    { x: halfWidth - chamfer, y: -halfHeight + chamfer, start: Math.PI * 1.5 },
  ];
  // Four segments per quarter arc bound the 8 mm fixture corner error below 1 mm.
  const outline = corners.flatMap((corner) => Array.from({ length: 5 }, (_, index) => {
    const angle = corner.start + index * Math.PI / 8;
    return [corner.x + Math.cos(angle) * chamfer, corner.y + Math.sin(angle) * chamfer];
  }));
  const vertexCount = outline.length;
  const positions: number[] = [];
  for (const z of [-length / 2, length / 2]) for (const [x, y] of outline) positions.push(x, y, z);
  const indices: number[] = [];
  for (let index = 1; index < vertexCount - 1; index++) indices.push(0, index + 1, index, vertexCount, vertexCount + index, vertexCount + index + 1);
  for (let index = 0; index < vertexCount; index++) {
    const next = (index + 1) % vertexCount;
    indices.push(index, next, vertexCount + next, index, vertexCount + next, vertexCount + index);
  }
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  mesh.setVerticesData(VertexBuffer.PositionKind, positions);
  mesh.setVerticesData(VertexBuffer.NormalKind, normals);
  mesh.setIndices(indices);
  mesh.refreshBoundingInfo();
  return mesh;
}

function addPlayableRod(scene: Scene, rod: PlayableRod, material: StandardMaterial): Mesh {
  const name = `bridge ${rod.id}`;
  const length = rod.lengthM.value;
  const mesh = rod.crossSection.kind === "circular"
    ? CreateCylinder(name, { height: length, diameter: rod.crossSection.diameterM.value, tessellation: 64 }, scene)
    : roundedRectangularRod(name, length, rod.crossSection.widthM.value, rod.crossSection.heightM.value, rod.crossSection.cornerRadiusM.value, scene);
  if (rod.crossSection.kind === "circular") mesh.bakeTransformIntoVertices(Matrix.RotationX(Math.PI / 2));
  mesh.position.set(rod.centerM.x.value, rod.centerM.y.value, rod.centerM.z.value);
  mesh.rotationQuaternion = rodOrientationQuaternion(rod);
  mesh.material = material;
  Tags.AddTagsTo(mesh, "bridge-rod");
  mesh.computeWorldMatrix(true);
  const shape = rod.crossSection.kind === "circular"
    ? new PhysicsShapeCylinder(new Vector3(0, 0, -length / 2), new Vector3(0, 0, length / 2), rod.crossSection.diameterM.value / 2, scene)
    : new PhysicsShapeConvexHull(mesh, scene);
  shape.material = { staticFriction: rod.contact.staticFriction.value, friction: rod.contact.dynamicFriction.value, restitution: rod.contact.restitution.value };
  const body = new PhysicsBody(mesh, PhysicsMotionType.STATIC, false, scene);
  body.shape = shape;
  mesh.onDisposeObservable.add(() => shape.dispose());
  return mesh;
}

function createLegacyBridge(scene: Scene, profile: CalibrationProfile): Mesh[] {
  const length = 0.45;
  const diameter = profile.bridge.rodDiameterM.value;
  const material = rodMaterial(scene);
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

export function isPlayableProfile(profile: SupportedCalibrationProfile): profile is PlayableCalibrationProfile {
  return "kind" in profile && profile.kind === "playable-four-rod";
}

export function createBridge(scene: Scene, profile: SupportedCalibrationProfile): Mesh[] {
  if (!isPlayableProfile(profile)) return createLegacyBridge(scene, profile);
  const material = rodMaterial(scene);
  return profile.bridge.rods.map((rod) => addPlayableRod(scene, rod, material));
}
