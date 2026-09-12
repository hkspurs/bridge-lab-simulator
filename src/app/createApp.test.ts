import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPhysicsScene, type PhysicsSceneHandle } from "../physics/createPhysicsScene";
import type { DiagnosticSnapshot } from "../diagnostics/createDiagnostics";
import { createApp } from "./createApp";

// Browser graphics startup is the boundary; the scene suite uses real Havok.
vi.mock("../physics/createPhysicsScene", () => ({ createPhysicsScene: vi.fn() }));
vi.mock("./createCameraViews", () => ({ createCameraViews: () => ({ select: vi.fn(), dispose: vi.fn() }) }));
vi.mock("../diagnostics/createDiagnostics", () => ({ createDiagnostics: () => ({ update: vi.fn(), dispose: vi.fn() }) }));

describe("createApp", () => {
  beforeEach(() => { vi.mocked(createPhysicsScene).mockReset().mockImplementation(() => new Promise(() => {})); });
  afterEach(() => document.body.replaceChildren());

  it("mounts a named calibration application that can be disposed", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const app = createApp(host);

    expect(host.querySelector('[data-testid="bridge-lab-app"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="app-status"]')?.textContent).toContain("Starting");
    app.dispose();
    expect(host.childElementCount).toBe(0);
  });

  it("announces calibration status as a live region", () => {
    const host = document.createElement("div");
    document.body.append(host);

    createApp(host);

    expect(host.querySelector('[data-testid="app-status"]')?.getAttribute("role")).toBe(
      "status"
    );
  });

  it("leaves host siblings intact when disposed more than once", () => {
    const host = document.createElement("div");
    const sibling = document.createElement("aside");
    host.append(sibling);
    document.body.append(host);

    const app = createApp(host);

    expect(() => {
      app.dispose();
      app.dispose();
    }).not.toThrow();
    expect(host.children).toHaveLength(1);
    expect(host.firstElementChild).toBe(sibling);
  });

  it("stays loading until initialization succeeds, then disposes the scene once", async () => {
    let resolve!: (handle: PhysicsSceneHandle) => void;
    vi.mocked(createPhysicsScene).mockImplementation(() => new Promise((done) => { resolve = done; }));
    const host = document.createElement("div");
    const app = createApp(host);
    expect(host.textContent).toContain("Starting");
    const dispose = vi.fn();
    resolve({ dispose } as unknown as PhysicsSceneHandle);
    await vi.waitFor(() => expect(host.textContent).toContain("Move right"));
    app.dispose();
    app.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("uses authoritative snapshots to gate play actions and keeps new setup explicit", async () => {
    let publish!: (snapshot: DiagnosticSnapshot) => void;
    const dispatch = vi.fn();
    const newSetup = vi.fn();
    vi.mocked(createPhysicsScene).mockResolvedValue({
      scene: {} as PhysicsSceneHandle["scene"], dispatch, newSetup,
      onSnapshot(listener: (snapshot: DiagnosticSnapshot) => void) { publish = listener; return vi.fn(); }, dispose: vi.fn(),
    } as unknown as PhysicsSceneHandle);
    const host = document.createElement("div");
    createApp(host);
    await vi.waitFor(() => expect(host.querySelector('[data-action="resume"]')).not.toBeNull());
    const seen: DiagnosticSnapshot[] = [];
    host.querySelector("main")!.addEventListener("bridge-lab:snapshot", event => seen.push((event as CustomEvent<DiagnosticSnapshot>).detail));
    const resume = host.querySelector<HTMLButtonElement>('[data-action="resume"]')!;
    const next = host.querySelector<HTMLButtonElement>('[data-action="continue"]')!;
    const reset = host.querySelector<HTMLButtonElement>('[data-action="new-setup"]')!;
    expect(resume.disabled).toBe(true);
    expect(next.disabled).toBe(true);
    publish({ phase: "READY", paused: true, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, fixedStepCount: 0, renderFps: 60 });
    expect(resume.disabled).toBe(false);
    resume.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "resume" });
    publish({ phase: "REVIEW", paused: false, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, fixedStepCount: 1, renderFps: 60 });
    expect(next.disabled).toBe(false);
    next.click(); reset.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "continue" });
    expect(newSetup).toHaveBeenCalledOnce();
    expect(host.querySelector("main")?.dataset).toMatchObject({ phase: "REVIEW", paused: "false", fixedStepCount: "1" });
    expect(seen.at(-1)?.phase).toBe("REVIEW");
  });

  it("announces initialization errors without reporting readiness", async () => {
    vi.mocked(createPhysicsScene).mockRejectedValue(new Error("WASM unavailable"));
    const host = document.createElement("div");
    const app = createApp(host);
    await vi.waitFor(() => expect(host.querySelector('[role="alert"]')?.textContent).toContain("WASM unavailable"));
    expect(host.textContent).toContain("Simulation unavailable");
    expect(host.textContent).not.toContain("ready");
    app.dispose();
  });

  it("aborts initialization and releases any late result after immediate disposal", async () => {
    let resolve!: (handle: PhysicsSceneHandle) => void;
    vi.mocked(createPhysicsScene).mockImplementation(() => new Promise((done) => { resolve = done; }));
    const host = document.createElement("div");
    const app = createApp(host);
    const signal = vi.mocked(createPhysicsScene).mock.calls[0][2]!.signal!;
    app.dispose();
    expect(signal.aborted).toBe(true);
    const dispose = vi.fn();
    resolve({ dispose } as unknown as PhysicsSceneHandle);
    await vi.waitFor(() => expect(dispose).toHaveBeenCalledTimes(1));
    expect(host.childElementCount).toBe(0);
  });
});
