import { expect, type Page, type TestInfo } from "@playwright/test";
import type { DiagnosticSnapshot } from "../../src/diagnostics/createDiagnostics";

declare global { interface Window { acceptanceSnapshots: DiagnosticSnapshot[]; acceptanceFrozen: boolean } }

/** Synthetic touch PointerEvents exercise the real controls and Havok world.
 * Capture bookkeeping alone is emulated: untrusted pointers cannot obtain native
 * capture. This does not establish iPhone Safari native capture/gesture behavior. */
export async function start(page: Page) {
  await page.goto("/bridge-lab-simulator/");
  await expect(page.getByTestId("bridge-lab-app")).toHaveAttribute("data-phase", "READY", { timeout: 30_000 });
  await page.evaluate(() => {
    window.acceptanceSnapshots = [];
    window.acceptanceFrozen = true;
    document.querySelector('[data-testid="bridge-lab-app"]')!.addEventListener("bridge-lab:snapshot", event => {
      const snapshot = (event as CustomEvent<DiagnosticSnapshot>).detail;
      window.acceptanceFrozen &&= Object.isFrozen(snapshot) && Object.isFrozen(snapshot.position) && Object.isFrozen(snapshot.rotation);
      window.acceptanceSnapshots.push(snapshot);
    });
    document.querySelectorAll<HTMLButtonElement>("[data-axis]").forEach(button => {
      const captured = new Set<number>();
      button.setPointerCapture = id => { captured.add(id); };
      button.hasPointerCapture = id => captured.has(id);
      button.releasePointerCapture = id => { captured.delete(id); };
    });
  });
  await expect.poll(() => page.evaluate(() => window.acceptanceSnapshots.length)).toBeGreaterThan(0);
}
export async function pointer(page: Page, axis: 1 | 2, type: string, id = 1) {
  const name = axis === 1 ? "1 Move right" : "2 Move back";
  await page.getByRole("button", { name, exact: true }).dispatchEvent(type, {
    pointerId: id, pointerType: "touch", isPrimary: id === 1, bubbles: true, button: 0, buttons: type === "pointerdown" ? 1 : 0,
  });
}
export async function latest(page: Page) { return page.evaluate(() => window.acceptanceSnapshots.at(-1)!); }
export async function phase(page: Page, value: string, timeout = 30_000) {
  await expect(page.getByTestId("bridge-lab-app")).toHaveAttribute("data-phase", value, { timeout });
}
export async function hold(page: Page, axis: 1 | 2, ticks = 42) {
  await pointer(page, axis, "pointerdown");
  const before = await latest(page);
  await expect.poll(async () => (await latest(page)).fixedStepCount - before.fixedStepCount).toBeGreaterThanOrEqual(ticks);
  await pointer(page, axis, "pointerup");
}
export async function evidence(page: Page, info: TestInfo) {
  if (!await page.evaluate(() => Array.isArray(window.acceptanceSnapshots)).catch(() => false)) return;
  await info.attach("physics-snapshots", { body: JSON.stringify(await page.evaluate(() => ({
    frozen: window.acceptanceFrozen, samples: window.acceptanceSnapshots,
    input: "Synthetic touch PointerEvents; capture bookkeeping shim only. No physical body mutation or mocked physics.",
  }))), contentType: "application/json" });
}
