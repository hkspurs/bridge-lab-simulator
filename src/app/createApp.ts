import { playableProfile } from "../config/playableProfile";
import { createDiagnostics, type DiagnosticsHandle } from "../diagnostics/createDiagnostics";
import { createPhysicsScene, type PhysicsSceneHandle } from "../physics/createPhysicsScene";
import { createControls, type ControlsHandle } from "../input/createControls";
import { createCameraViews } from "./createCameraViews";

export interface BridgeLabApp {
  dispose(): void;
}

export function createApp(host: HTMLElement): BridgeLabApp {
  const root = document.createElement("main");
  root.dataset.testid = "bridge-lab-app";

  const header = document.createElement("header");
  const title = document.createElement("h1"); title.textContent = "BRIDGE LAB";
  const views = document.createElement("div"); views.className = "view-controls"; views.setAttribute("aria-label", "Camera view");
  const front = document.createElement("button"); front.type = "button"; front.textContent = "Front"; front.dataset.view = "front";
  const side = document.createElement("button"); side.type = "button"; side.textContent = "Side"; side.dataset.view = "side";
  views.append(front, side); header.append(title, views);

  const stage = document.createElement("section"); stage.className = "machine-stage";
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Playable four-rod bridge crane");

  const status = document.createElement("p");
  status.dataset.testid = "app-status";
  status.setAttribute("role", "status");
  status.textContent = "Starting playable machine…";

  const actions = document.createElement("div"); actions.className = "attempt-actions";
  const action = (name: string, label: string) => { const button = document.createElement("button"); button.type = "button"; button.dataset.action = name; button.textContent = label; return button; };
  const resume = action("resume", "Resume"); const next = action("continue", "Continue"); const reset = action("new-setup", "New setup");
  resume.disabled = true; next.disabled = true; actions.append(resume, next, reset);
  const portrait = document.createElement("p"); portrait.className = "portrait-message"; portrait.textContent = "Rotate to landscape to play.";

  stage.append(canvas, portrait); root.append(header, stage, status, actions);
  host.append(root);

  let disposed = false;
  let physics: PhysicsSceneHandle | undefined;
  let diagnostics: DiagnosticsHandle | undefined;
  let unsubscribeSnapshots: (() => void) | undefined;
  let controls: ControlsHandle | undefined;
  let cameraViews: ReturnType<typeof createCameraViews> | undefined;
  let removePortraitListener: (() => void) | undefined;
  const initialization = new AbortController();
  void createPhysicsScene(canvas, playableProfile, { signal: initialization.signal }).then(
    (handle) => {
      if (disposed) {
        handle.dispose();
        return;
      }
      physics = handle;
      controls = createControls(root, event => handle.dispatch(event));
      if (typeof window.matchMedia === "function") {
        const portraitQuery = window.matchMedia("(orientation: portrait)");
        const stopForPortrait = (event: MediaQueryListEvent | MediaQueryList) => { if (event.matches) handle.dispatch({ type: "cancel" }); };
        portraitQuery.addEventListener("change", stopForPortrait);
        removePortraitListener = () => portraitQuery.removeEventListener("change", stopForPortrait);
        stopForPortrait(portraitQuery);
      }
      resume.addEventListener("click", () => handle.dispatch({ type: "resume" }));
      next.addEventListener("click", () => handle.dispatch({ type: "continue" }));
      reset.addEventListener("click", () => handle.newSetup());
      // Test doubles and older embedders may provide only disposal. A real
      // physics handle always supplies the scene needed for diagnostics.
      if (handle.scene) {
        cameraViews = createCameraViews(handle.scene);
        cameraViews.select("front");
        front.addEventListener("click", () => cameraViews?.select("front"));
        side.addEventListener("click", () => cameraViews?.select("side"));
        diagnostics = createDiagnostics({ scene: handle.scene, host: root, profile: playableProfile });
        if (typeof handle.onSnapshot === "function") {
          unsubscribeSnapshots = handle.onSnapshot((snapshot) => {
            diagnostics?.update(snapshot);
            const phase = snapshot.phase ?? "READY";
            const paused = snapshot.paused === true;
            root.dataset.phase = phase;
            root.dataset.paused = String(paused);
            root.dataset.fixedStepCount = String(snapshot.fixedStepCount);
            root.dispatchEvent(new CustomEvent("bridge-lab:snapshot", { detail: snapshot }));
            controls?.update({ phase, paused });
            resume.disabled = !paused;
            next.disabled = paused || phase !== "REVIEW";
            const manual = !paused && phase === "READY";
            front.disabled = !manual; side.disabled = !manual;
            const messages: Record<string, string> = {
              READY: "Hold 1 to move right.", MOVE_AXIS_1: "Release 1 to lock rightward travel.", MOVE_AXIS_2: "Hold 2 to move back; release starts the drop.",
              DROP: "Lowering the claw automatically…", CLOSE: "Closing the claw automatically…", LIFT: "Lifting automatically…", RETURN: "Returning home automatically…",
              OPEN: "Releasing at home…", SETTLE: "Waiting for the prize to settle…", REVIEW: "Attempt complete. Continue with this prize or start a new setup.", FAULT: "The mechanism stopped. Start a new setup.",
            };
            status.textContent = paused ? "Paused. Select Resume, then press a movement control again." : (messages[phase] ?? phase);
          });
        }
      }
      status.textContent = "Hold 1 to move right.";
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
      removePortraitListener?.();
      controls?.dispose();
      cameraViews?.dispose();
      diagnostics?.dispose();
      physics?.dispose();
      root.remove();
    }
  };
}
