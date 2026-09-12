import { expect, test } from "@playwright/test";
import { evidence, hold, latest, phase, start } from "./harness";

test.afterEach(async ({ page }, info) => evidence(page, info));

test("two complete attempts preserve the physical prize across Continue", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await start(page);
  for (let attempt = 0; attempt < 2; attempt++) {
    const startIndex = await page.evaluate(() => window.acceptanceSnapshots.length);
    await hold(page, 1);
    await phase(page, "MOVE_AXIS_2");
    await hold(page, 2);
    await phase(page, "REVIEW", 45_000);
    const samples = await page.evaluate(index => window.acceptanceSnapshots.slice(index), startIndex);
    const phases = samples.map(sample => sample.phase).filter((value, index, all) => value !== all[index - 1]);
    expect(phases.filter(value => value !== "READY")).toEqual(["MOVE_AXIS_1", "MOVE_AXIS_2", "DROP", "CLOSE", "LIFT", "RETURN", "OPEN", "SETTLE", "REVIEW"]);
    expect(phases.filter(value => value === "DROP")).toHaveLength(1);
    expect(phases).not.toContain("FAULT");
    for (const sample of samples) expect([...Object.values(sample.position), ...Object.values(sample.rotation)] .every(Number.isFinite)).toBe(true);
    if (attempt === 0) {
      // Capture immediately before dispatch and the first READY sample, so wall
      // time in Playwright cannot mask a teleport/reset in the continuity check.
      await page.getByRole("button", { name: "Continue", exact: true }).evaluate(button => {
        button.setAttribute("data-before-index", String(window.acceptanceSnapshots.length - 1));
        (button as HTMLButtonElement).click();
      });
      await phase(page, "READY");
      const boundary = await page.getByRole("button", { name: "Continue", exact: true }).evaluate(button => {
        const index = Number(button.getAttribute("data-before-index"));
        return { before: window.acceptanceSnapshots[index], after: window.acceptanceSnapshots.slice(index + 1).find(value => value.phase === "READY")! };
      });
      expect(boundary.after.prizeInstanceId).toBe(boundary.before.prizeInstanceId);
      const dt = (boundary.after.fixedStepCount - boundary.before.fixedStepCount) / 120;
      expect(dt).toBeGreaterThanOrEqual(0);
      expect(dt).toBeLessThanOrEqual(.1);
      const distance = Math.hypot(...(["x", "y", "z"] as const).map(axis => boundary.after.position[axis] - boundary.before.position[axis]));
      const speed = Math.hypot(...Object.values(boundary.before.prizeLinearVelocity!));
      expect(distance).toBeLessThanOrEqual(speed * dt + .5 * 9.80665 * dt * dt + .003);
      const dot = Object.keys(boundary.before.rotation).reduce((sum, key) => sum + boundary.before.rotation[key as "x"] * boundary.after.rotation[key as "x"], 0);
      const angularSpeed = Math.hypot(...Object.values(boundary.before.prizeAngularVelocity!));
      expect(2 * Math.acos(Math.min(1, Math.abs(dot)))).toBeLessThanOrEqual(angularSpeed * dt + .03);
    }
  }
  expect((await latest(page)).profileId).toBe("bridge-lab-playable-v1-engineering-fixture");
  expect(await page.evaluate(() => window.acceptanceFrozen)).toBe(true);
  expect(errors).toEqual([]);
});

test("retains successful front, side and portrait framing evidence", async ({ page }, info) => {
  await start(page);
  await page.screenshot({ path: info.outputPath("landscape-front.png"), fullPage: true });
  await page.getByRole("button", { name: "Side", exact: true }).click();
  await page.screenshot({ path: info.outputPath("landscape-side.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("Rotate to landscape to play.")).toBeVisible();
  await page.screenshot({ path: info.outputPath("portrait.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("camera drag and pinch change view without starting a claw attempt", async ({ page }) => {
  await start(page);
  const canvas = page.locator("canvas");
  const bounds = (await canvas.boundingBox())!;
  const x = bounds.x + bounds.width * .4, y = bounds.y + bounds.height * .5;
  const before = (await latest(page)).camera!;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 100, y + 20, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => Math.abs((await latest(page)).camera!.alpha - before.alpha)).toBeGreaterThan(.05);
  await phase(page, "READY");
  await page.getByRole("button", { name: "Front", exact: true }).click();
  await expect.poll(async () => (await latest(page)).camera!.alpha).toBeCloseTo(-Math.PI / 2, 4);
  // Synthetic touch input with capture shim; native iPhone gestures remain a device check.
  await canvas.evaluate(element => { element.setPointerCapture = () => {}; element.releasePointerCapture = () => {}; });
  const touch = (type: string, id: number, px: number) => canvas.dispatchEvent(type, {
    pointerId: id, pointerType: "touch", isPrimary: id === 11, clientX: px, clientY: y,
    button: 0, buttons: type === "pointerup" ? 0 : 1, bubbles: true,
  });
  await touch("pointerdown", 11, x);
  await touch("pointerdown", 12, x + 40);
  await touch("pointermove", 12, x + 60);
  await touch("pointermove", 12, x + 100);
  await touch("pointerup", 12, x + 100);
  await touch("pointerup", 11, x);
  await expect.poll(async () => Math.abs((await latest(page)).camera!.radius - .78)).toBeGreaterThan(.001);
  await phase(page, "READY");
});
