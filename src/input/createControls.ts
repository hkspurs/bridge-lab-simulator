import type { InputEvent, Phase } from "../crane/types";

export interface ControlsState { readonly phase: Phase; readonly paused: boolean }
export interface ControlsHandle { update(state: ControlsState): void; dispose(): void }

export function createControls(root: HTMLElement, dispatch: (event: InputEvent) => void): ControlsHandle {
  const tray = document.createElement("div");
  tray.className = "movement-controls";
  tray.setAttribute("aria-label", "Crane movement controls");
  const makeButton = (axis: 1 | 2, label: string) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.axis = String(axis);
    button.className = "move-control";
    button.innerHTML = `<span class="control-number">${axis}</span><span>${label}</span>`;
    return button;
  };
  const buttons = [makeButton(1, "Move right"), makeButton(2, "Move back")] as const;
  tray.append(...buttons);
  root.append(tray);

  let owner: { id: number | "keyboard"; axis: 1 | 2; button: HTMLButtonElement } | undefined;
  const cleanups: (() => void)[] = [];
  const listen = (target: EventTarget, type: string, listener: EventListener) => {
    target.addEventListener(type, listener);
    cleanups.push(() => target.removeEventListener(type, listener));
  };
  const clear = (releaseCapture: boolean) => {
    const current = owner;
    owner = undefined;
    if (current && typeof current.id === "number" && releaseCapture && current.button.hasPointerCapture?.(current.id)) {
      current.button.releasePointerCapture(current.id);
    }
  };
  const cancelOwned = () => {
    if (!owner) return;
    clear(true);
    dispatch({ type: "cancel" });
  };
  const interrupt = () => {
    clear(true);
    dispatch({ type: "cancel" });
  };

  buttons.forEach((button, index) => {
    const axis = (index + 1) as 1 | 2;
    listen(button, "pointerdown", ((event: PointerEvent) => {
      if (owner) {
        if (owner.id !== event.pointerId) cancelOwned();
        return;
      }
      if (button.disabled) return;
      owner = { id: event.pointerId, axis, button };
      button.setPointerCapture?.(event.pointerId);
      dispatch({ type: "press", axis });
    }) as EventListener);
    listen(button, "pointerup", ((event: PointerEvent) => {
      if (owner?.id !== event.pointerId || owner.axis !== axis) return;
      clear(true);
      dispatch({ type: "release", axis });
    }) as EventListener);
    for (const type of ["pointercancel", "pointerleave", "lostpointercapture"]) {
      listen(button, type, ((event: PointerEvent) => {
        if (owner?.id === event.pointerId && owner.axis === axis) cancelOwned();
      }) as EventListener);
    }
    listen(button, "keydown", ((event: KeyboardEvent) => {
      if ((event.key !== " " && event.key !== "Enter") || event.repeat || button.disabled || owner) return;
      event.preventDefault();
      owner = { id: "keyboard", axis, button };
      dispatch({ type: "press", axis });
    }) as EventListener);
    listen(button, "keyup", ((event: KeyboardEvent) => {
      if ((event.key !== " " && event.key !== "Enter") || owner?.id !== "keyboard" || owner.axis !== axis) return;
      event.preventDefault();
      clear(false);
      dispatch({ type: "release", axis });
    }) as EventListener);
    listen(button, "contextmenu", event => event.preventDefault());
    listen(button, "selectstart", event => event.preventDefault());
  });
  listen(window, "blur", interrupt);
  listen(window, "orientationchange", interrupt);
  listen(document, "visibilitychange", () => { if (document.visibilityState === "hidden") interrupt(); });

  buttons[0].disabled = false;
  buttons[1].disabled = true;

  return {
    update({ phase, paused }) {
      buttons[0].disabled = paused || (phase !== "READY" && phase !== "MOVE_AXIS_1");
      buttons[1].disabled = paused || phase !== "MOVE_AXIS_2";
      if (owner?.button.disabled) cancelOwned();
    },
    dispose() { clear(true); cleanups.splice(0).forEach(cleanup => cleanup()); tray.remove(); },
  };
}
