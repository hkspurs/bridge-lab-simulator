import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateLines } from "@babylonjs/core/Meshes/Builders/linesBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import type { Confidence, SupportedCalibrationProfile } from "../config/types";
import { isPlayableProfile } from "../physics/createBridge";
import { computeMassProperties } from "../physics/massProperties";

export interface DiagnosticSnapshot {
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly rotation: Readonly<{ x: number; y: number; z: number; w: number }>;
  readonly fixedStepCount: number;
  readonly renderFps: number;
  readonly profileId?: string;
  readonly phase?: import("../crane/types").Phase;
  readonly paused?: boolean;
  readonly droppedWallSeconds?: number;
  readonly prizeLinearVelocity?: Readonly<{ x: number; y: number; z: number }>;
  readonly prizeAngularVelocity?: Readonly<{ x: number; y: number; z: number }>;
  readonly clawAnglesRad?: readonly number[];
  readonly clawTargetAnglesRad?: readonly number[];
  readonly actuatorTorqueLimitsNm?: readonly number[];
  readonly contacts?: readonly import("../physics/createClaw").ContactSample[];
  readonly prizeOutOfReach?: boolean;
  readonly prizeInstanceId?: number;
  readonly carriagePosition?: Readonly<{ x: number; y: number; z: number }>;
  readonly carriageLinearVelocity?: Readonly<{ x: number; y: number; z: number }>;
}

export interface DiagnosticsOptions {
  readonly scene: Scene;
  readonly host: HTMLElement;
  readonly profile: SupportedCalibrationProfile;
}

export interface DiagnosticsHandle {
  update(snapshot: DiagnosticSnapshot): void;
  dispose(): void;
}

const HUD_REFRESH_INTERVAL_MS = 100;
const amber = new Color3(1, 0.62, 0.1);

const confidenceLabel = (confidence: Confidence): string => confidence.toUpperCase();

const addRow = (parent: HTMLElement, label: string, testId: string, value: string): HTMLSpanElement => {
  const row = document.createElement("div");
  row.className = "diagnostic-row";
  const name = document.createElement("span");
  name.textContent = label;
  const output = document.createElement("span");
  output.dataset.testid = testId;
  output.textContent = value;
  row.append(name, output);
  parent.append(row);
  return output;
};

const createGravityArrow = (scene: Scene): Mesh[] => {
  const top = new Vector3(0, 0.25, 0);
  const bottom = new Vector3(0, 0.15, 0);
  const arrow = CreateLines("diagnostic gravity arrow", { points: [top, bottom] }, scene);
  arrow.color = amber;
  const headA = CreateLines("diagnostic gravity arrowhead A", {
    points: [bottom, new Vector3(-0.018, 0.18, 0)],
  }, scene);
  const headB = CreateLines("diagnostic gravity arrowhead B", {
    points: [bottom, new Vector3(0.018, 0.18, 0)],
  }, scene);
  headA.color = amber;
  headB.color = amber;
  return [arrow, headA, headB];
};

export function createDiagnostics({ scene, host, profile }: DiagnosticsOptions): DiagnosticsHandle {
  const root = document.createElement("details");
  root.className = "diagnostics-hud";
  root.dataset.testid = "diagnostics-hud";
  root.setAttribute("aria-label", "Physics diagnostics");

  const title = document.createElement("summary");
  title.textContent = "Diagnostics";
  root.append(title);
  addRow(root, "Profile", "profile-id", profile.id);
  addRow(root, "Physics rate", "physics-rate", `${(1 / profile.physics.stepSeconds.value).toFixed(0)} Hz`);
  addRow(root, "Prize mass", "prize-mass", `${profile.prize.massKg.value.toFixed(3)} kg`);
  addRow(root, "COM height ratio", "com-height-ratio", profile.prize.centerOfMassRatioZ.value.toFixed(3));
  if (isPlayableProfile(profile)) addRow(root, "Bridge structure", "bridge-structure", `${profile.bridge.rods.length} sourced rods`);
  else addRow(root, "Rod centre distance", "rod-centre-distance", `${profile.bridge.rodCenterDistanceM.value.toFixed(3)} m`);
  const fixedStepCount = addRow(root, "Fixed steps", "fixed-step-count", "0");
  const renderFps = addRow(root, "Render FPS", "render-fps", "0");
  const observedAngles = addRow(root, "Observed claw angles", "claw-angles", "—");
  const commandedAngles = addRow(root, "Commanded claw targets", "claw-target-angles", "—");
  const torqueLimits = addRow(root, "Commanded torque limits", "claw-torque-limits", "—");
  const measuredLinear = addRow(root, "Measured prize velocity", "prize-linear-velocity", "—");
  const measuredAngular = addRow(root, "Measured angular velocity", "prize-angular-velocity", "—");

  const confidenceWarning = document.createElement("p");
  confidenceWarning.dataset.testid = "confidence-warning";
  confidenceWarning.className = "confidence-warning";
  confidenceWarning.textContent = "ESTIMATE: low-confidence calibration values are estimates";
  root.append(confidenceWarning);

  const confidenceRows = [
    ["Mass confidence", profile.prize.massKg.confidence],
    ["Friction confidence", profile.contacts.boxRodStaticFriction.confidence],
    ["Rod geometry confidence", isPlayableProfile(profile)
      ? (profile.bridge.rods[0].crossSection.kind === "circular" ? profile.bridge.rods[0].crossSection.diameterM.confidence : profile.bridge.rods[0].crossSection.widthM.confidence)
      : profile.bridge.rodDiameterM.confidence],
  ] as const;
  for (const [label, confidence] of confidenceRows) {
    const labelText = confidenceLabel(confidence);
    addRow(root, label, `confidence-${label.split(" ")[0].toLowerCase()}`, `${labelText} / ${profile.prize.massKg.sourceKind.toUpperCase()}`);
  }
  host.append(root);

  const massProperties = computeMassProperties(profile.prize.massBlocks);
  // Domain coordinates map to Babylon engine coordinates as (x, z, -y),
  // matching the body mass-properties adapter. This is the body-local COM;
  // the current world transform is applied for every diagnostic snapshot.
  const localCom = new Vector3(
    massProperties.centerOfMassM.x,
    massProperties.centerOfMassM.z - profile.prize.heightM.value / 2,
    -massProperties.centerOfMassM.y,
  );
  const markerMaterial = new StandardMaterial("diagnostic COM material", scene);
  markerMaterial.diffuseColor = amber;
  const marker = CreateSphere("diagnostic COM marker", { diameter: 0.012, segments: 12 }, scene);
  marker.material = markerMaterial;
  const arrowMeshes = createGravityArrow(scene);
  const markerPosition = new Vector3();
  const rotation = new Quaternion();
  let lastDomUpdate = Number.NEGATIVE_INFINITY;
  let disposed = false;

  return {
    update(snapshot) {
      if (disposed) return;
      // Work exclusively with newly-created Babylon values. Neither the
      // snapshot nor the source rigid body is ever mutated here.
      rotation.set(snapshot.rotation.x, snapshot.rotation.y, snapshot.rotation.z, snapshot.rotation.w);
      markerPosition.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
      localCom.rotateByQuaternionToRef(rotation, markerPosition);
      markerPosition.x += snapshot.position.x;
      markerPosition.y += snapshot.position.y;
      markerPosition.z += snapshot.position.z;
      marker.position.copyFrom(markerPosition);

      const now = performance.now();
      if (now - lastDomUpdate < HUD_REFRESH_INTERVAL_MS) return;
      lastDomUpdate = now;
      fixedStepCount.textContent = String(snapshot.fixedStepCount);
      renderFps.textContent = Number.isFinite(snapshot.renderFps) ? snapshot.renderFps.toFixed(0) : "0";
      const format = (values: readonly number[] | undefined, unit: string) => values?.length ? `${values.map(value => value.toFixed(3)).join(" / ")} ${unit}` : "—";
      observedAngles.textContent = format(snapshot.clawAnglesRad, "rad");
      commandedAngles.textContent = format(snapshot.clawTargetAnglesRad, "rad");
      torqueLimits.textContent = format(snapshot.actuatorTorqueLimitsNm, "N·m");
      const vector = (value: Readonly<{ x: number; y: number; z: number }> | undefined, unit: string) => value
        ? `${value.x.toFixed(3)} / ${value.y.toFixed(3)} / ${value.z.toFixed(3)} ${unit}` : "—";
      measuredLinear.textContent = vector(snapshot.prizeLinearVelocity, "m/s");
      measuredAngular.textContent = vector(snapshot.prizeAngularVelocity, "rad/s");
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      marker.dispose();
      arrowMeshes.forEach((mesh) => mesh.dispose());
      markerMaterial.dispose();
      root.remove();
    },
  };
}
