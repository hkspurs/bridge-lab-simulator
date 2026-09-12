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
