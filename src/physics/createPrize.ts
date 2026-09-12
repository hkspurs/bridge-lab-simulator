import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import { PhysicsMotionType, type PhysicsMassProperties } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PhysicsShapeConvexHull } from "@babylonjs/core/Physics/v2/physicsShape";
import type { Scene } from "@babylonjs/core/scene";
import type { PlayableRod, SupportedCalibrationProfile } from "../config/types";
import { computeMassProperties, type MassProperties } from "./massProperties";
import { contactMaterial, isPlayableProfile, rodOrientationQuaternion } from "./createBridge";

/** Domain (width, depth, height) -> engine (x, y, z) = (x, z, -y).
 * Havok accepts principal moments plus their orientation, not a full tensor.
 * Jacobi rotations retain products of inertia, including non-baseline profiles.
 */
export function toPhysicsMassProperties(properties: MassProperties, height: number): PhysicsMassProperties {
  const [xx, xy, xz, yy, yz, zz] = properties.inertiaKgM2;
  const a = [[xx, xz, -xy], [xz, zz, -yz], [-xy, -yz, yy]];
  const basis = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let iteration = 0; iteration < 32; iteration++) {
    let p = 0;
    let q = 1;
    for (const [i, j] of [[0, 2], [1, 2]]) {
      if (Math.abs(a[i][j]) > Math.abs(a[p][q])) { p = i; q = j; }
    }
    if (Math.abs(a[p][q]) < 1e-14) break;
    const angle = Math.atan2(2 * a[p][q], a[q][q] - a[p][p]) / 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const app = a[p][p];
    const aqq = a[q][q];
    const apq = a[p][q];
    for (let k = 0; k < 3; k++) {
      if (k !== p && k !== q) {
        const akp = a[k][p];
        const akq = a[k][q];
        a[k][p] = a[p][k] = c * akp - s * akq;
        a[k][q] = a[q][k] = s * akp + c * akq;
      }
      const bkp = basis[k][p];
      const bkq = basis[k][q];
      basis[k][p] = c * bkp - s * bkq;
      basis[k][q] = s * bkp + c * bkq;
    }
    a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    a[p][q] = a[q][p] = 0;
  }
  const rotation = Matrix.Identity();
  Matrix.FromXYZAxesToRef(
    new Vector3(basis[0][0], basis[1][0], basis[2][0]),
    new Vector3(basis[0][1], basis[1][1], basis[2][1]),
    new Vector3(basis[0][2], basis[1][2], basis[2][2]), rotation,
  );
  const center = properties.centerOfMassM;
  return {
    mass: properties.massKg,
    centerOfMass: new Vector3(center.x, center.z - height / 2, -center.y),
    // Havok's tuple is inertia for mass=1 (m²), verified by angular impulse.
    inertia: new Vector3(a[0][0], a[1][1], a[2][2]).scale(1 / properties.massKg),
    inertiaOrientation: Quaternion.FromRotationMatrix(rotation),
  };
}

// Original BRIDGE LAB pixel lettering, made from geometry (no external artwork
// or canvas textures). These visuals are children only; never physics bodies.
function addArtwork(prize: Mesh, width: number, height: number, depth: number, scene: Scene) {
  const red = new StandardMaterial("BRIDGE LAB red", scene);
  red.diffuseColor = new Color3(0.78, 0.035, 0.075);
  const stripe = CreateBox("BRIDGE LAB red stripe", { width: width * 0.96, height: height * 0.16, depth: 0.0002 }, scene);
  stripe.parent = prize;
  stripe.position.set(0, -height * 0.3, -depth / 2 - 0.0001);
  stripe.material = red;
  const glyphs: Record<string, string[]> = {
    B: ["110", "101", "110", "101", "110"], R: ["110", "101", "110", "101", "101"],
    I: ["111", "010", "010", "010", "111"], D: ["110", "101", "101", "101", "110"],
    G: ["111", "100", "101", "101", "111"], E: ["111", "100", "110", "100", "111"],
    L: ["100", "100", "100", "100", "111"], A: ["010", "101", "111", "101", "101"],
  };
  const pixels: Mesh[] = [];
  const unit = width / 44;
  [..."BRIDGE LAB"].forEach((letter, index) => glyphs[letter]?.forEach((row, y) => [...row].forEach((pixel, x) => {
    if (pixel !== "1") return;
    const mesh = CreateBox("letter pixel", { width: unit * 0.88, height: unit * 0.88, depth: 0.0002 }, scene);
    mesh.position.set((index * 4 + x - 19) * unit, (2 - y) * unit + height * 0.12, -depth / 2 - 0.0001);
    pixels.push(mesh);
  })));
  const lettering = Mesh.MergeMeshes(pixels, true)!;
  lettering.name = "BRIDGE LAB lettering";
  lettering.parent = prize;
  lettering.material = red;
}

function playableRodTop(rod: PlayableRod): number {
  const rotation = rodOrientationQuaternion(rod);
  const matrix = Matrix.Identity();
  Matrix.FromQuaternionToRef(rotation, matrix);
  const axes = [Vector3.Right(), Vector3.Up(), Vector3.Forward()].map((axis) => Vector3.TransformNormal(axis, matrix));
  if (rod.crossSection.kind === "circular") {
    return rod.centerM.y.value + Math.abs(axes[2].y) * rod.lengthM.value / 2 + Math.sqrt(Math.max(0, 1 - axes[2].y ** 2)) * rod.crossSection.diameterM.value / 2;
  }
  return rod.centerM.y.value + Math.abs(axes[0].y) * rod.crossSection.widthM.value / 2 + Math.abs(axes[1].y) * rod.crossSection.heightM.value / 2 + Math.abs(axes[2].y) * rod.lengthM.value / 2;
}

function prizeSpawnY(profile: SupportedCalibrationProfile, height: number): number {
  if (!isPlayableProfile(profile)) return height / 2 + profile.bridge.rodDiameterM.value / 2 + Math.abs(profile.bridge.rodHeightDeltaM.value) / 2 + 0.002;
  return height / 2 + Math.max(...profile.bridge.rods.map(playableRodTop)) + 0.002;
}

export function createPrize(scene: Scene, profile: SupportedCalibrationProfile) {
  const width = profile.prize.widthM.value;
  const height = profile.prize.heightM.value;
  const depth = profile.prize.depthM.value;
  const prize = CreateBox("BRIDGE LAB prize", { width, height, depth }, scene);
  const white = new StandardMaterial("BRIDGE LAB white carton", scene);
  white.diffuseColor = new Color3(0.96, 0.95, 0.92);
  prize.material = white;
  addArtwork(prize, width, height, depth, scene);

  // 0.5 mm corner-beveled input to Havok's rounded convex-hull approximation.
  // Havok shrinks/simplifies the core internally; test its actual outer AABB.
  // No enlarged invisible box and no support planes.
  const hull = new Mesh("prize collision source", scene);
  const vertices: number[] = [];
  const half = [width / 2, height / 2, depth / 2];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    for (let axis = 0; axis < 3; axis++) {
      vertices.push(...[x, y, z].map((sign, i) => sign * (half[i] - (i === axis ? 0.0005 : 0))));
    }
  }
  hull.setVerticesData(VertexBuffer.PositionKind, vertices);
  let shape: PhysicsShapeConvexHull;
  try { shape = new PhysicsShapeConvexHull(hull, scene); } finally { hull.dispose(); }
  shape.material = contactMaterial(profile);
  prize.onDisposeObservable.add(() => shape.dispose());
  // 2 mm air gap above the higher crown. Only Havok changes pose from here.
  prize.position.y = prizeSpawnY(profile, height);
  prize.computeWorldMatrix(true);
  const body = new PhysicsBody(prize, PhysicsMotionType.DYNAMIC, false, scene);
  body.shape = shape;
  const blocks = computeMassProperties(profile.prize.massBlocks);
  const massScale = profile.prize.massKg.value / blocks.massKg;
  body.setMassProperties(toPhysicsMassProperties({ ...blocks, massKg: profile.prize.massKg.value, inertiaKgM2: blocks.inertiaKgM2.map((value) => value * massScale) as unknown as MassProperties["inertiaKgM2"] }, height));
  body.setLinearDamping(profile.damping.linearPerSecond.value);
  body.setAngularDamping(profile.damping.angularPerSecond.value);
  return prize;
}
