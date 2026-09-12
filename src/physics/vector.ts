export interface Vector3M {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const addScaledVector = (
  total: Vector3M,
  vector: Vector3M,
  scalar: number
): Vector3M => ({
  x: total.x + vector.x * scalar,
  y: total.y + vector.y * scalar,
  z: total.z + vector.z * scalar,
});

export const scaleVector = (vector: Vector3M, scalar: number): Vector3M => ({
  x: vector.x * scalar,
  y: vector.y * scalar,
  z: vector.z * scalar,
});

export const subtractVectors = (left: Vector3M, right: Vector3M): Vector3M => ({
  x: left.x - right.x,
  y: left.y - right.y,
  z: left.z - right.z,
});
