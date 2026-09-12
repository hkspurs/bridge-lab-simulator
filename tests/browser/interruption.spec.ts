import { expect, test } from "@playwright/test";
import { evidence, hold, latest, phase, pointer, start } from "./harness";

test.afterEach(async ({ page }, info) => evidence(page, info));

for (const axis of [1, 2] as const) test(`axis ${axis} cancellation freezes physics and requires a fresh press`, async ({ page }) => {
  await start(page);
  if (axis === 2) { await hold(page, 1); await phase(page, "MOVE_AXIS_2"); }
  await pointer(page, axis, "pointerdown");
  await page.waitForTimeout(150);
  await pointer(page, axis, "pointercancel");
  await phase(page, "PAUSED");
  const paused = await latest(page);
  await page.waitForTimeout(250);
  const still = await latest(page);
  expect(still.fixedStepCount).toBe(paused.fixedStepCount);
  expect(still.position).toEqual(paused.position);
  expect(still.rotation).toEqual(paused.rotation);
  expect(still.carriagePosition).toEqual(paused.carriagePosition);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await phase(page, `MOVE_AXIS_${axis}`);
  await pointer(page, axis, "pointerup"); // Stale release must not lock/start DROP.
  await page.waitForTimeout(250);
  await phase(page, `MOVE_AXIS_${axis}`);
  const resumed = await latest(page);
  expect(resumed.carriagePosition).toEqual(paused.carriagePosition);
  expect(Math.hypot(...Object.values(resumed.carriageLinearVelocity!))).toBeLessThan(1e-8);
  expect(resumed.fixedStepCount).toBeGreaterThan(paused.fixedStepCount);
  expect(await page.evaluate(() => window.acceptanceSnapshots.some(value => value.phase === "DROP"))).toBe(false);
  await hold(page, axis, 12);
  await phase(page, axis === 1 ? "MOVE_AXIS_2" : "DROP");
});

test("second pointer cancels ownership, and automation blur resumes exactly one cycle", async ({ page }) => {
  await start(page);
  await pointer(page, 1, "pointerdown", 1);
  await pointer(page, 1, "pointerdown", 2);
  await phase(page, "PAUSED");
  await pointer(page, 1, "pointerup", 1);
  await pointer(page, 1, "pointerup", 2);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await hold(page, 1, 12);
  await phase(page, "MOVE_AXIS_2");
  await hold(page, 2, 12);
  await phase(page, "DROP");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await phase(page, "PAUSED");
  const paused = await latest(page);
  await page.waitForTimeout(250);
  expect((await latest(page)).fixedStepCount).toBe(paused.fixedStepCount);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await phase(page, "DROP");
  for (let tap = 0; tap < 4; tap++) { await pointer(page, 2, "pointerdown"); await pointer(page, 2, "pointerup"); }
  await phase(page, "REVIEW", 45_000);
  await page.waitForTimeout(200);
  await phase(page, "REVIEW");
  const phases = await page.evaluate(() => window.acceptanceSnapshots.map(value => value.phase).filter((value, index, all) => value !== all[index - 1]));
  expect(phases.filter(value => value === "CLOSE")).toHaveLength(1);
  expect(phases.filter(value => value === "REVIEW")).toHaveLength(1);
  expect(phases).not.toContain("FAULT");
});
