import { afterEach, describe, expect, it, vi } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { baselineProfile } from "../config/baselineProfile";
import { playableProfile } from "../config/playableProfile";
import { createDiagnostics, type DiagnosticSnapshot } from "./createDiagnostics";

describe("physical diagnostics", () => {
  const resources: { scene: Scene; engine: NullEngine; diagnostics: { dispose(): void } }[] = [];

  afterEach(() => {
    resources.splice(0).forEach(({ diagnostics, scene, engine }) => {
      diagnostics.dispose();
      scene.dispose();
      engine.dispose();
    });
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  function setup() {
    const host = document.createElement("div");
    document.body.append(host);
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const diagnostics = createDiagnostics({ scene, host, profile: baselineProfile });
    resources.push({ scene, engine, diagnostics });
    return { host, scene, diagnostics };
  }

  it("renders profile, rate, mass, COM ratio, and low-confidence calibration labels", () => {
    const { host } = setup();

    expect(host.querySelector('[data-testid="profile-id"]')?.textContent).toBe("bridge-lab-v0.1");
    expect(host.querySelector('[data-testid="physics-rate"]')?.textContent).toBe("120 Hz");
    expect(host.textContent).toContain("0.320 kg");
    expect(host.textContent).toContain("0.660");
    expect(host.textContent).toContain("LOW");
    expect(host.textContent).toContain("LOW / ENGINEERING-INITIAL");
    expect(host.querySelector('[data-testid="confidence-warning"]')?.textContent).toContain("ESTIMATE");
  });

  it("moves the COM marker from immutable transform snapshots", () => {
    const { scene, diagnostics } = setup();
    const first: DiagnosticSnapshot = Object.freeze({
      position: Object.freeze({ x: 0, y: 0.2, z: 0 }),
      rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
      fixedStepCount: 12,
      renderFps: 60,
    });
    const sourceCopy = structuredClone(first);
    diagnostics.update(first);
    const marker = scene.getMeshByName("diagnostic COM marker")!;
    const firstPosition = marker.position.clone();
    expect(firstPosition.x).toBeCloseTo(0);
    expect(firstPosition.y).toBeCloseTo(0.232);
    expect(firstPosition.z).toBeCloseTo(-0.0072);

    const second: DiagnosticSnapshot = Object.freeze({
      position: Object.freeze({ x: 0.1, y: 0.25, z: -0.04 }),
      rotation: Object.freeze({ x: 0, y: 0, z: Math.sin(Math.PI / 8), w: Math.cos(Math.PI / 8) }),
      fixedStepCount: 13,
      renderFps: 60,
    });
    diagnostics.update(second);

    expect(marker.position.equals(firstPosition)).toBe(false);
    expect(marker.position.x).toBeCloseTo(0.077373, 4);
    expect(marker.position.y).toBeCloseTo(0.272627, 4);
    expect(marker.position.z).toBeCloseTo(-0.0472, 4);
    expect(first).toEqual(sourceCopy);
    expect(second).toEqual({
      position: { x: 0.1, y: 0.25, z: -0.04 },
      rotation: { x: 0, y: 0, z: Math.sin(Math.PI / 8), w: Math.cos(Math.PI / 8) },
      fixedStepCount: 13,
      renderFps: 60,
    });
  });

  it("throttles dynamic HUD text to ten updates per second", () => {
    const now = vi.spyOn(performance, "now");
    now.mockReturnValue(0);
    const { host, diagnostics } = setup();
    const snapshot = (fixedStepCount: number): DiagnosticSnapshot => Object.freeze({
      position: Object.freeze({ x: 0, y: 0.2, z: 0 }),
      rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
      fixedStepCount,
      renderFps: 60,
    });
    diagnostics.update(snapshot(1));
    expect(host.querySelector('[data-testid="fixed-step-count"]')?.textContent).toBe("1");
    now.mockReturnValue(50);
    diagnostics.update(snapshot(2));
    expect(host.querySelector('[data-testid="fixed-step-count"]')?.textContent).toBe("1");
    now.mockReturnValue(100);
    diagnostics.update(snapshot(3));
    expect(host.querySelector('[data-testid="fixed-step-count"]')?.textContent).toBe("3");
  });

  it("starts collapsed and labels observed and commanded claw quantities", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const diagnostics = createDiagnostics({ scene, host, profile: playableProfile });
    resources.push({ scene, engine, diagnostics });
    const details = host.querySelector("details")!;
    expect(details.open).toBe(false);
    diagnostics.update({
      position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 },
      fixedStepCount: 2, renderFps: 60, profileId: playableProfile.id,
      clawAnglesRad: [0.2, 0.3], clawTargetAnglesRad: [0.4, 0.5], actuatorTorqueLimitsNm: [0.8, 0.8],
    });
    expect(host.textContent).toContain("Observed claw angles");
    expect(host.textContent).toContain("0.200 / 0.300 rad");
    expect(host.textContent).toContain("Commanded claw targets");
    expect(host.textContent).toContain("0.400 / 0.500 rad");
    expect(host.textContent).toContain("LOW / ENGINEERING-INITIAL");
  });
});
