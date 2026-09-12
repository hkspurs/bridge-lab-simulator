import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPhysicsScene, type PhysicsSceneHandle } from "../physics/createPhysicsScene";
import { createApp } from "./createApp";

// Browser graphics startup is the boundary; the scene suite uses real Havok.
vi.mock("../physics/createPhysicsScene", () => ({ createPhysicsScene: vi.fn() }));

describe("createApp", () => {
  beforeEach(() => { vi.mocked(createPhysicsScene).mockReset().mockImplementation(() => new Promise(() => {})); });
  afterEach(() => document.body.replaceChildren());

  it("mounts a named calibration application that can be disposed", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const app = createApp(host);

    expect(host.querySelector('[data-testid="bridge-lab-app"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="app-status"]')?.textContent).toBe(
      "Physics calibration loading"
    );
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
    expect(host.textContent).toContain("loading");
    const dispose = vi.fn();
    resolve({ dispose } as unknown as PhysicsSceneHandle);
    await vi.waitFor(() => expect(host.textContent).toContain("Physics calibration ready"));
    app.dispose();
    app.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
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
