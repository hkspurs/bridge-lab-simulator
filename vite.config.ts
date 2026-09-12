import { configDefaults, defineConfig } from "vitest/config";
import { PUBLIC_BASE_PATH } from "./src/config/deployment";

export default defineConfig({
  base: PUBLIC_BASE_PATH,
  test: {
    environment: "jsdom",
    exclude: [...configDefaults.exclude, "tests/browser/**"],
  }
});
