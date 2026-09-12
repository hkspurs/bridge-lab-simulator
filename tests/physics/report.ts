import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { playableProfile } from "../../src/config/playableProfile";
import { playableClawProfile } from "../../src/config/playableClawProfile";
import { clawProfile } from "../../src/config/clawProfile";

/** Each experiment writes before asserting, so failed gates retain their measurements. */
export function report(name: string, metrics: Record<string, unknown>, criteria: Record<string, boolean> = {}, notes = "") {
  mkdirSync("physics-reports", { recursive: true });
  const version = (pkg: string) => JSON.parse(readFileSync(`node_modules/${pkg}/package.json`, "utf8")).version;
  const result = {
    schemaVersion: 1, experiment: name, status: Object.values(criteria).every(Boolean) ? "passed" : "failed",
    metadata: {
      generatedAt: new Date().toISOString(), commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      workingTree: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
      sourceDiffSha256: createHash("sha256").update(execFileSync("git", ["diff", "HEAD"])).digest("hex"),
      lockfileSha256: createHash("sha256").update(readFileSync("package-lock.json")).digest("hex"),
      profileId: playableProfile.id, profileSha256: createHash("sha256").update(JSON.stringify(playableProfile)).digest("hex"),
      clawProfileId: clawProfile.id, playableClawProfileId: playableClawProfile.id, playableClawProfileSha256: createHash("sha256").update(JSON.stringify(playableClawProfile)).digest("hex"), playableDropHeightM: playableClawProfile.dropHeightM, babylonVersion: version("@babylonjs/core"), havokVersion: version("@babylonjs/havok"),
      nodeVersion: process.version, gravityMps2: 9.80665, fixedStepSeconds: 1 / 120,
    }, metrics, criteria, notes,
  };
  writeFileSync(`physics-reports/${name}.json`, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
}
