import { addScaledVector, scaleVector, subtractVectors, type Vector3M } from "./vector";

export interface MassBlockInput {
  readonly massKg: number;
  readonly centerM: Vector3M;
  readonly sizeM: Vector3M;
}

export type InertiaTensorKgM2 = readonly [
  Ixx: number,
  Ixy: number,
  Ixz: number,
  Iyy: number,
  Iyz: number,
  Izz: number,
];

export interface MassProperties {
  readonly massKg: number;
  readonly centerOfMassM: Vector3M;
  readonly inertiaKgM2: InertiaTensorKgM2;
}

const zeroVector: Vector3M = { x: 0, y: 0, z: 0 };
const zeroTensor: InertiaTensorKgM2 = [0, 0, 0, 0, 0, 0];

const validateFinite = (name: string, value: number): void => {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be finite`);
  }
};

const validateBlock = (block: MassBlockInput): void => {
  validateFinite("massKg", block.massKg);
  if (block.massKg <= 0) {
    throw new Error("massKg must be greater than zero");
  }

  for (const axis of ["x", "y", "z"] as const) {
    validateFinite(`centerM.${axis}`, block.centerM[axis]);
    validateFinite(`sizeM.${axis}`, block.sizeM[axis]);
    if (block.sizeM[axis] <= 0) {
      throw new Error(`sizeM.${axis} must be greater than zero`);
    }
  }
};

/**
 * Returns the composite body-frame tensor [Ixx, Ixy, Ixz, Iyy, Iyz, Izz].
 * The products of inertia use the conventional negative sign: Ixy = -Σmxy,
 * Ixz = -Σmxz, and Iyz = -Σmyz. Phase 1 blocks are body-aligned, so their
 * individual cuboid tensors need no rotational transform.
 */
export const computeMassProperties = (
  blocks: readonly MassBlockInput[]
): MassProperties => {
  if (blocks.length === 0) {
    throw new Error("blocks must not be empty");
  }

  for (const block of blocks) {
    validateBlock(block);
  }

  const massKg = blocks.reduce((total, block) => total + block.massKg, 0);
  const weightedCenter = blocks.reduce(
    (total, block) => addScaledVector(total, block.centerM, block.massKg),
    zeroVector
  );
  const centerOfMassM = scaleVector(weightedCenter, 1 / massKg);

  const inertiaKgM2 = blocks.reduce<InertiaTensorKgM2>((total, block) => {
    const { x: width, y: depth, z: height } = block.sizeM;
    const { x, y, z } = subtractVectors(block.centerM, centerOfMassM);
    const localIxx = (block.massKg * (depth ** 2 + height ** 2)) / 12;
    const localIyy = (block.massKg * (width ** 2 + height ** 2)) / 12;
    const localIzz = (block.massKg * (width ** 2 + depth ** 2)) / 12;

    return [
      total[0] + localIxx + block.massKg * (y ** 2 + z ** 2),
      total[1] - block.massKg * x * y,
      total[2] - block.massKg * x * z,
      total[3] + localIyy + block.massKg * (x ** 2 + z ** 2),
      total[4] - block.massKg * y * z,
      total[5] + localIzz + block.massKg * (x ** 2 + y ** 2),
    ];
  }, zeroTensor);

  return { massKg, centerOfMassM, inertiaKgM2 };
};
