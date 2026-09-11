# Physics Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first browser-playable calibration scene for BRIDGE LAB with a deterministic 120 Hz physics clock, sourced machine parameters, a physically distributed prize mass, two cylindrical bridge rods, and visible centre-of-mass diagnostics.

**Architecture:** Keep physics-domain calculations in dependency-free TypeScript and adapt them into Babylon.js/Havok at the scene boundary. The browser scene owns rendering only; `PhysicsClock` owns fixed simulation time, `CalibrationProfile` owns all physical inputs, and `PrizeMassModel` derives centre of mass and inertia from the same mass blocks. This phase intentionally excludes claw controls, replay, final art, sound, and success-state logic.

**Tech Stack:** TypeScript, Vite, Babylon.js, Havok Physics, Vitest, ESLint, Playwright smoke test, GitHub Actions

**Spec:** `docs/specs/2026-09-11-japanese-bridge-crane-simulator-design.md`

## Global Constraints

- Primary target is iPhone Safari in landscape; desktop browsers are secondary.
- Physics uses standard gravity `9.80665 m/s²` and a fixed `1/120 s` simulation step.
- The prize uses one rounded external box collider plus 2–4 internal mass blocks; centre of mass and inertia come from the same distribution.
- Bridge rods are cylindrical colliders; no hidden planes, ramps, magnets, success probabilities, pose triggers, or per-frame pose correction.
- Rendering may interpolate physical state but must never mutate a rigid-body transform.
- Physics parameters retain value, unit, allowed range, source, confidence, and profile version.
- Low-confidence values remain visibly labelled as estimates.
- Lower visual quality may not reduce physics frequency or change force, friction, mass, gravity, or geometry.
- Third-party Taito, Bandai Namco, Banpresto, anime logos, characters, packaging, and names are excluded.
- Every production behavior follows red–green–refactor; configuration-only files contain no product behavior.

## Phase boundaries

This approved specification is divided into four independently testable plans:

1. **Physics foundation — this plan:** calibration profile, mass properties, fixed clock, Havok calibration scene, diagnostics, automated checks.
2. **Crane mechanism:** suspended head, two finite-torque claw joints, two-button state machine, interruption safety.
3. **Training tools:** snapshot/replay, A/B input comparison, slow-motion playback, contact/force/support overlays.
4. **Product finish:** original red-white arcade art, audio, adaptive rendering, iPhone device validation, static deployment.

## File map

| Path | Responsibility |
|---|---|
| `package.json` | Reproducible commands and runtime/dev dependencies |
| `vite.config.ts` | Vite/Vitest configuration |
| `tsconfig.json` | Strict TypeScript settings |
| `eslint.config.js` | TypeScript lint rules |
| `index.html` | Full-screen canvas host and viewport policy |
| `src/main.ts` | Browser bootstrap only |
| `src/app/createApp.ts` | Create/dispose application and connect clock to scene |
| `src/app/styles.css` | Landscape layout, safe areas, loading/error UI |
| `src/config/types.ts` | Sourced-parameter and calibration-profile contracts |
| `src/config/validateProfile.ts` | Runtime range and invariant validation |
| `src/config/baselineProfile.ts` | Versioned v0.1 research values from the approved table |
| `src/physics/vector.ts` | Small immutable 3D-vector helpers for domain math |
| `src/physics/massProperties.ts` | Composite mass, COM, and inertia calculation |
| `src/physics/PhysicsClock.ts` | Fixed-step accumulator and overload policy |
| `src/physics/createPhysicsScene.ts` | Babylon engine, Havok world, rods, floor, and prize body |
| `src/physics/createPrize.ts` | Visible prize mesh, collider, mass properties, initial pose |
| `src/physics/createBridge.ts` | Two real cylindrical rods from profile geometry |
| `src/diagnostics/createDiagnostics.ts` | Read-only COM marker, gravity arrow, clock and confidence HUD |
| `src/test/setup.ts` | Shared numerical matchers and deterministic fixtures |
| `src/**/*.test.ts` | Unit tests colocated with their production module |
| `tests/browser/calibration-scene.spec.ts` | Browser load and deterministic-scene smoke checks |
| `.github/workflows/ci.yml` | Install, lint, typecheck, unit test, build, browser smoke test |

---

### Task 1: Reproducible project shell and observable app contract

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `eslint.config.js`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/app/createApp.ts`
- Create: `src/app/createApp.test.ts`
- Create: `src/app/styles.css`

**Interfaces:**
- Produces: `createApp(host: HTMLElement): { dispose(): void }`
- Produces: DOM root with `data-testid="bridge-lab-app"` and status with `data-testid="app-status"`

- [ ] **Step 1: Add tooling-only configuration**

Create `package.json` with scripts `dev`, `build`, `preview`, `test`, `test:run`, `typecheck`, `lint`, and `test:browser`. Install `@babylonjs/core`, `@babylonjs/havok`, and `@babylonjs/loaders` as runtime dependencies; install Vite, TypeScript, Vitest, ESLint, typescript-eslint, Playwright, and jsdom as development dependencies. Generate and commit `package-lock.json` with `npm install` so the resolved versions are exact.

- [ ] **Step 2: Write the failing app-contract test**

```ts
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./createApp";

describe("createApp", () => {
  afterEach(() => document.body.replaceChildren());

  it("mounts a named calibration application that can be disposed", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const app = createApp(host);

    expect(host.querySelector('[data-testid="bridge-lab-app"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="app-status"]')?.textContent)
      .toBe("Physics calibration loading");
    app.dispose();
    expect(host.childElementCount).toBe(0);
  });
});
```

- [ ] **Step 3: Run the focused test and confirm RED**

Run: `npm run test:run -- src/app/createApp.test.ts`

Expected: FAIL because `./createApp` does not exist.

- [ ] **Step 4: Implement the smallest app shell**

`createApp` creates one root element, one `<canvas>`, and one live status element; it returns an idempotent `dispose` function that removes only that root. `src/main.ts` fetches `#app`, throws a descriptive error if absent, and invokes `createApp` once. CSS uses `100dvh`, safe-area insets, `touch-action: none`, and a landscape warning without implementing game controls.

- [ ] **Step 5: Verify GREEN and production build**

Run: `npm run test:run -- src/app/createApp.test.ts && npm run typecheck && npm run build`

Expected: one passing test, zero TypeScript errors, and a successful Vite build.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json eslint.config.js index.html src
git commit -m "chore: scaffold bridge lab calibration app"
```

---

### Task 2: Sourced and range-checked calibration profile

**Files:**
- Create: `src/config/types.ts`
- Create: `src/config/validateProfile.ts`
- Create: `src/config/validateProfile.test.ts`
- Create: `src/config/baselineProfile.ts`
- Create: `src/config/baselineProfile.test.ts`

**Interfaces:**
- Produces: `SourcedParameter`, `Confidence`, `SourceKind`, `CalibrationProfile`
- Produces: `validateProfile(profile: CalibrationProfile): readonly ProfileIssue[]`
- Produces: `baselineProfile: Readonly<CalibrationProfile>`

- [ ] **Step 1: Write failing tests for profile invariants**

```ts
import { describe, expect, it } from "vitest";
import { validateProfile } from "./validateProfile";
import { baselineProfile } from "./baselineProfile";

describe("validateProfile", () => {
  it("accepts the approved v0.1 baseline", () => {
    expect(validateProfile(baselineProfile)).toEqual([]);
  });

  it("rejects a value outside its declared range", () => {
    const profile = structuredClone(baselineProfile);
    profile.prize.massKg.value = 0.60;
    expect(validateProfile(profile)).toContainEqual({
      path: "prize.massKg",
      code: "OUT_OF_RANGE",
      message: "0.6 is outside 0.22..0.48 kg",
    });
  });

  it("rejects dynamic friction greater than static friction", () => {
    const profile = structuredClone(baselineProfile);
    profile.contacts.boxRodDynamicFriction.value = 0.50;
    expect(validateProfile(profile).map((issue) => issue.code))
      .toContain("DYNAMIC_EXCEEDS_STATIC");
  });
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm run test:run -- src/config/validateProfile.test.ts`

Expected: FAIL because the profile modules do not exist.

- [ ] **Step 3: Implement types, validator, and exact v0.1 values**

Use metres, kilograms, seconds, newtons, and dimensionless coefficients internally. Include gravity `9.80665`, box `0.14 × 0.09 × 0.20 m`, mass `0.32 kg`, COM ratios `(0, 0.08, 0.66)`, rod diameter `0.025 m`, rod centre distance `0.16 m`, rod height delta `0 m`, box–rod friction `0.34/0.26`, restitution `0.06`, linear damping `0`, and angular damping `0.05 s⁻¹`. Every scalar includes its approved range, source kind, source reference, and confidence.

- [ ] **Step 4: Add a baseline-completeness test**

Assert profile ID `bridge-lab-v0.1`, physical step `1/120`, four internal prize mass blocks, total block mass `0.32 kg`, and no parameter with an empty `sourceRef`.

- [ ] **Step 5: Verify GREEN**

Run: `npm run test:run -- src/config && npm run typecheck`

Expected: all config tests pass with no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/config
git commit -m "feat: add sourced calibration profile"
```

---

### Task 3: Composite prize centre of mass and inertia

**Files:**
- Create: `src/physics/vector.ts`
- Create: `src/physics/massProperties.ts`
- Create: `src/physics/massProperties.test.ts`
- Create: `src/test/setup.ts`

**Interfaces:**
- Consumes: mass blocks from `CalibrationProfile.prize.massBlocks`
- Produces: `computeMassProperties(blocks: readonly MassBlock[]): MassProperties`
- Produces: `MassProperties = { massKg, centerOfMassM, inertiaKgM2 }`
- Uses: inertia tensor ordered as `[Ixx, Ixy, Ixz, Iyy, Iyz, Izz]`

- [ ] **Step 1: Write failing tests for mass, COM, and inertia**

```ts
import { describe, expect, it } from "vitest";
import { computeMassProperties } from "./massProperties";

describe("computeMassProperties", () => {
  it("places COM at the mass-weighted position", () => {
    const result = computeMassProperties([
      { massKg: 1, centerM: { x: 0, y: 0, z: 0 }, sizeM: { x: 0.1, y: 0.1, z: 0.1 } },
      { massKg: 3, centerM: { x: 0, y: 0, z: 0.2 }, sizeM: { x: 0.1, y: 0.1, z: 0.1 } },
    ]);
    expect(result.massKg).toBeCloseTo(4, 12);
    expect(result.centerOfMassM.z).toBeCloseTo(0.15, 12);
  });

  it("uses the parallel-axis theorem for separated blocks", () => {
    const result = computeMassProperties([
      { massKg: 1, centerM: { x: -0.1, y: 0, z: 0 }, sizeM: { x: 0.02, y: 0.02, z: 0.02 } },
      { massKg: 1, centerM: { x: 0.1, y: 0, z: 0 }, sizeM: { x: 0.02, y: 0.02, z: 0.02 } },
    ]);
    expect(result.inertiaKgM2[3]).toBeGreaterThan(0.02);
    expect(result.inertiaKgM2[5]).toBeGreaterThan(0.02);
  });

  it("rejects zero or negative mass", () => {
    expect(() => computeMassProperties([
      { massKg: 0, centerM: { x: 0, y: 0, z: 0 }, sizeM: { x: 1, y: 1, z: 1 } },
    ])).toThrow("massKg must be greater than zero");
  });
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm run test:run -- src/physics/massProperties.test.ts`

Expected: FAIL because `computeMassProperties` does not exist.

- [ ] **Step 3: Implement the physical calculation**

Calculate `Σmᵢrᵢ/Σmᵢ`; calculate each axis-aligned cuboid inertia around its own centre using `m(b²+c²)/12`; rotate nothing in this phase because all mass blocks are body-aligned; translate each tensor to the composite COM with the full parallel-axis theorem including off-diagonal products. Reject non-finite values, non-positive dimensions, empty arrays, and non-positive mass.

- [ ] **Step 4: Verify GREEN and baseline mass properties**

Run: `npm run test:run -- src/physics/massProperties.test.ts src/config/baselineProfile.test.ts`

Expected: all focused tests pass and the baseline COM remains in the upper half of the prize.

- [ ] **Step 5: Commit**

```bash
git add src/physics/vector.ts src/physics/massProperties.ts src/physics/massProperties.test.ts src/test/setup.ts
git commit -m "feat: derive prize mass properties"
```

---

### Task 4: Deterministic fixed-step clock

**Files:**
- Create: `src/physics/PhysicsClock.ts`
- Create: `src/physics/PhysicsClock.test.ts`

**Interfaces:**
- Produces: `new PhysicsClock({ stepSeconds, maxFrameSeconds, maxStepsPerFrame })`
- Produces: `advance(frameSeconds: number, step: (dt: number) => void): ClockSample`
- Produces: `ClockSample = { steps, alpha, simulatedSeconds, droppedSeconds }`

- [ ] **Step 1: Write failing determinism and overload tests**

```ts
import { describe, expect, it } from "vitest";
import { PhysicsClock } from "./PhysicsClock";

describe("PhysicsClock", () => {
  it("produces 120 equal steps from sixty 60 FPS frames", () => {
    const clock = new PhysicsClock({ stepSeconds: 1 / 120, maxFrameSeconds: 0.1, maxStepsPerFrame: 24 });
    const steps: number[] = [];
    for (let frame = 0; frame < 60; frame += 1) {
      clock.advance(1 / 60, (dt) => steps.push(dt));
    }
    expect(steps).toHaveLength(120);
    expect(new Set(steps)).toEqual(new Set([1 / 120]));
  });

  it("produces the same simulated second at 30, 60 and 120 FPS", () => {
    const run = (fps: number) => {
      const clock = new PhysicsClock({ stepSeconds: 1 / 120, maxFrameSeconds: 0.1, maxStepsPerFrame: 24 });
      let value = 0;
      for (let frame = 0; frame < fps; frame += 1) clock.advance(1 / fps, (dt) => { value += dt; });
      return value;
    };
    expect(run(30)).toBeCloseTo(run(60), 12);
    expect(run(60)).toBeCloseTo(run(120), 12);
  });

  it("reports discarded wall time instead of changing the step", () => {
    const clock = new PhysicsClock({ stepSeconds: 1 / 120, maxFrameSeconds: 0.1, maxStepsPerFrame: 12 });
    const sample = clock.advance(0.5, () => undefined);
    expect(sample.steps).toBe(12);
    expect(sample.droppedSeconds).toBeCloseTo(0.4, 12);
  });
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm run test:run -- src/physics/PhysicsClock.test.ts`

Expected: FAIL because `PhysicsClock` does not exist.

- [ ] **Step 3: Implement accumulator without variable steps**

Clamp accepted wall time to `maxFrameSeconds`; count the remainder as dropped; repeatedly call `step(stepSeconds)` while the accumulator contains a full step and the per-frame limit is not exceeded; retain the fractional accumulator for render interpolation; never enlarge `stepSeconds` to catch up.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test:run -- src/physics/PhysicsClock.test.ts && npm run typecheck`

Expected: three passing tests and no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/physics/PhysicsClock.ts src/physics/PhysicsClock.test.ts
git commit -m "feat: add deterministic physics clock"
```

---

### Task 5: Babylon/Havok calibration scene

**Files:**
- Create: `src/physics/createBridge.ts`
- Create: `src/physics/createPrize.ts`
- Create: `src/physics/createPhysicsScene.ts`
- Create: `src/physics/createPhysicsScene.test.ts`
- Modify: `src/app/createApp.ts`

**Interfaces:**
- Consumes: `CalibrationProfile`, `computeMassProperties`, `PhysicsClock`
- Produces: `createPhysicsScene(canvas, profile): Promise<PhysicsSceneHandle>`
- Produces: `PhysicsSceneHandle = { engine, scene, prize, rods, clock, dispose() }`

- [ ] **Step 1: Write a failing scene-structure test**

Use Babylon `NullEngine` and assert that the scene factory produces exactly two rod meshes tagged `bridge-rod`, both use cylinder geometry with profile diameter, the prize is dynamic with profile total mass, gravity is `(0, -9.80665, 0)`, and the physics timestep is `1/120`.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm run test:run -- src/physics/createPhysicsScene.test.ts`

Expected: FAIL because the scene factory does not exist.

- [ ] **Step 3: Implement the two cylindrical rods**

Create rods along the scene depth axis by rotating Babylon cylinder meshes by `π/2` around X. Their centres are separated by the configured centre distance; apply half the configured height delta to each in opposite directions. Attach static Havok cylinder shapes using the profile friction and restitution.

- [ ] **Step 4: Implement the prize body**

Create a visible original white/red `BRIDGE LAB` box mesh with dimensions from the profile and a rounded box collision approximation no thicker than 1 mm outside the declared dimensions. Apply mass, COM offset, inertia, restitution, damping, and box–rod friction from the profile. Start it centred across the rods with its bottom above the rod crowns, then allow gravity to settle it; do not snap it after creation.

- [ ] **Step 5: Connect fixed stepping to rendering**

`createApp` awaits Havok initialization, advances Havok only through `PhysicsClock`, renders once per animation frame, interpolates visual transforms only if Babylon exposes separate previous/current transforms, updates loading status to `Physics calibration ready`, and disposes the animation loop, scene, engine, and WASM-backed resources idempotently.

- [ ] **Step 6: Verify GREEN and check for warnings**

Run: `npm run test:run -- src/physics/createPhysicsScene.test.ts && npm run test:run && npm run typecheck && npm run build`

Expected: all tests pass, build exits zero, and no physics initialization warning appears.

- [ ] **Step 7: Commit**

```bash
git add src/app/createApp.ts src/physics/createBridge.ts src/physics/createPrize.ts src/physics/createPhysicsScene.ts src/physics/createPhysicsScene.test.ts
git commit -m "feat: add havok bridge calibration scene"
```

---

### Task 6: Read-only physical diagnostics and confidence HUD

**Files:**
- Create: `src/diagnostics/createDiagnostics.ts`
- Create: `src/diagnostics/createDiagnostics.test.ts`
- Modify: `src/app/createApp.ts`
- Modify: `src/app/styles.css`

**Interfaces:**
- Consumes: profile and read-only current rigid-body transform
- Produces: `createDiagnostics(options): { update(snapshot): void; dispose(): void }`
- Diagnostics may create render meshes and DOM text but expose no force/impulse/body-mutation method.

- [ ] **Step 1: Write failing tests for labels and read-only updates**

Assert that the HUD renders profile ID, `120 Hz`, mass `0.320 kg`, COM height ratio `0.660`, and `LOW / ESTIMATE` labels for mass/friction/rod geometry. Update a diagnostic snapshot and assert the COM marker display coordinates change while the source rigid-body snapshot remains deeply equal to its pre-update copy.

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm run test:run -- src/diagnostics/createDiagnostics.test.ts`

Expected: FAIL because the diagnostics factory does not exist.

- [ ] **Step 3: Implement diagnostic-only visuals**

Render a small amber COM sphere at the body-local COM transformed into world space, a downward gravity arrow, rod centre distance, current fixed-step count, render FPS, and parameter-confidence badges. Keep DOM updates capped at 10 Hz while the mesh markers update with rendering. The module receives frozen snapshots and never imports Havok body mutation APIs.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test:run -- src/diagnostics && npm run test:run && npm run typecheck && npm run build`

Expected: all tests and build pass.

- [ ] **Step 5: Commit**

```bash
git add src/diagnostics src/app/createApp.ts src/app/styles.css
git commit -m "feat: show physical calibration diagnostics"
```

---

### Task 7: Browser smoke test and continuous verification

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/browser/calibration-scene.spec.ts`
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`

**Interfaces:**
- Consumes: production build served by `vite preview`
- Produces: CI result for lint, types, unit tests, production build, and Chromium browser smoke test

- [ ] **Step 1: Write the failing browser test**

```ts
import { expect, test } from "@playwright/test";

test("loads the deterministic bridge calibration scene", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByTestId("app-status")).toHaveText("Physics calibration ready");
  await expect(page.getByTestId("profile-id")).toHaveText("bridge-lab-v0.1");
  await expect(page.getByTestId("physics-rate")).toHaveText("120 Hz");
  await expect(page.getByTestId("confidence-warning")).toContainText("ESTIMATE");
  expect(pageErrors).toEqual([]);
});
```

- [ ] **Step 2: Run test and confirm RED**

Run: `npm run build && npm run test:browser`

Expected: FAIL until Playwright configuration and stable diagnostic selectors are present.

- [ ] **Step 3: Configure browser test and CI**

Configure Playwright to start `npm run preview -- --host 127.0.0.1 --port 4173`, use `http://127.0.0.1:4173`, retain traces on first retry, and test Chromium at iPhone landscape viewport `844 × 390` with touch enabled. CI runs on pushes and pull requests to `main` using Node LTS, `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`, Playwright Chromium installation, and `npm run test:browser`.

- [ ] **Step 4: Verify the whole Phase 1 gate**

Run:

```bash
npm ci
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run test:browser
```

Expected: every command exits zero; all unit and browser tests report zero failures; the production scene reaches `Physics calibration ready` without page errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json playwright.config.ts tests/browser .github/workflows/ci.yml
git commit -m "ci: verify physics calibration scene"
```

## Phase 1 acceptance checklist

- [ ] The production page loads Babylon.js with Havok and shows a box resting across two cylindrical rods.
- [ ] The clock feeds Havok only `1/120 s` steps at 30, 60, and 120 render FPS.
- [ ] The prize total mass, COM, and inertia are derived from the same four internal blocks.
- [ ] The default COM is above half-height and visibly marked.
- [ ] Geometry, mass, friction, restitution, damping, and gravity originate from the versioned profile.
- [ ] Low-confidence values are visibly labelled as estimates.
- [ ] No hidden success rule, animation force, magnetic force, kinematic prize motion, or pose correction exists.
- [ ] Unit tests, typecheck, lint, production build, and browser smoke test all pass.

## Self-review record

- Spec coverage for this phase: sections 4.1, 4.2 items 1/5/7, 6.1–6.3, 6.5, 7, 8 analysis basics, 10 physics-quality rule, 11 load failure, and 12.1 foundation tests are mapped to Tasks 1–7.
- Deliberately deferred with explicit later plans: claw mechanics/state machine, interruption behavior, replay/A-B, full force/contact overlay, arcade art/audio, adaptive quality, physical V2/V3 calibration, and real-iPhone acceptance.
- Placeholder scan: passed; every implementation and verification step is concrete and named.
- Type consistency: profile, mass-property, clock, scene-handle, and diagnostic interfaces have one canonical name and one producer.
