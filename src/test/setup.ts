import { expect } from "vitest";

type Vector3 = Readonly<{ x: number; y: number; z: number }>;

export const expectVectorCloseTo = (
  actual: Vector3,
  expected: Vector3,
  precision = 12
): void => {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
  expect(actual.z).toBeCloseTo(expected.z, precision);
};
