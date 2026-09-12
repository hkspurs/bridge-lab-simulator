import { describe, expect, it } from "vitest";
import { PUBLIC_BASE_PATH } from "./deployment";

describe("PUBLIC_BASE_PATH", () => {
  it("uses the GitHub Pages repository path with leading and trailing slashes", () => {
    expect(PUBLIC_BASE_PATH).toBe("/bridge-lab-simulator/");
  });
});
