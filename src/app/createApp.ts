import { baselineProfile } from "../config/baselineProfile";
import { createDiagnostics, type DiagnosticsHandle } from "../diagnostics/createDiagnostics";
import { createPhysicsScene, type PhysicsSceneHandle } from "../physics/createPhysicsScene";

export interface BridgeLabApp {
  dispose(): void;
}

export function createApp(host: HTMLElement): BridgeLabApp {
  const root = document.createElement("main");
  root.dataset.testid = "bridge-lab-app";

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Bridge Lab physics calibration view");

  const status = document.createElement("p");
  status.dataset.testid = "app-status";
  status.setAttribute("role", "status");
  status.textContent = "Physics calibration loading";

  root.append(canvas, status);
  host.append(root);

  let disposed = false;
  let physics: PhysicsSceneHandle | undefined;
  let diagnostics: DiagnosticsHandle | undefined;
  let unsubscribeSnapshots: (() => void) | undefined;
  const initialization = new AbortController();
  void createPhysicsScene(canvas, baselineProfile, { signal: initialization.signal }).then(
    (handle) => {
      if (disposed) {
        handle.dispose();
        return;
      }
      physics = handle;
      // Test doubles and older embedders may provide only disposal. A real
      // physics handle always supplies the scene needed for diagnostics.
      if (handle.scene) {
        diagnostics = createDiagnostics({ scene: handle.scene, host: root, profile: baselineProfile });
        if (typeof handle.onSnapshot === "function") {
          unsubscribeSnapshots = handle.onSnapshot((snapshot) => diagnostics?.update(snapshot));
        }
      }
      status.textContent = "Physics calibration ready";
    },
    (error: unknown) => {
      if (disposed) return;
      status.setAttribute("role", "alert");
      status.textContent = `Simulation unavailable: ${error instanceof Error ? error.message : String(error)}`;
    },
  );

  return {
    dispose() {
      if (disposed) return;

      disposed = true;
      initialization.abort();
      unsubscribeSnapshots?.();
      diagnostics?.dispose();
      physics?.dispose();
      root.remove();
    }
  };
}
