import { afterEach, describe, expect, it, vi } from "vitest";
import type { InputEvent } from "../crane/types";
import { createControls } from "./createControls";

const pointer = (type: string, id: number) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "pointerId", { value: id });
  return event;
};

describe("touch-safe controls", () => {
  afterEach(() => {
    document.body.replaceChildren();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    vi.restoreAllMocks();
  });

  function setup() {
    const root = document.createElement("div");
    document.body.append(root);
    const events: InputEvent[] = [];
    const controls = createControls(root, event => events.push(event));
    const axis1 = root.querySelector<HTMLButtonElement>('[data-axis="1"]')!;
    const axis2 = root.querySelector<HTMLButtonElement>('[data-axis="2"]')!;
    Object.assign(axis1, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true) });
    Object.assign(axis2, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true) });
    return { root, events, controls, axis1, axis2 };
  }

  it("owns one pointer and treats only its pointerup as release", () => {
    const { events, axis1 } = setup();
    axis1.dispatchEvent(pointer("pointerdown", 4));
    axis1.dispatchEvent(pointer("pointerup", 9));
    axis1.dispatchEvent(pointer("pointerup", 4));
    axis1.dispatchEvent(pointer("lostpointercapture", 4));
    expect(events).toEqual([{ type: "press", axis: 1 }, { type: "release", axis: 1 }]);
  });

  it("cancels the hold when a second pointer tries either axis", () => {
    const { events, axis1, axis2 } = setup();
    axis1.dispatchEvent(pointer("pointerdown", 4));
    axis2.dispatchEvent(pointer("pointerdown", 9));
    axis2.dispatchEvent(pointer("pointerup", 9));
    expect(events).toEqual([{ type: "press", axis: 1 }, { type: "cancel" }]);
  });

  it.each(["pointercancel", "pointerleave", "lostpointercapture"])("turns %s into one cancellation", type => {
    const { events, axis1 } = setup();
    axis1.dispatchEvent(pointer("pointerdown", 3));
    axis1.dispatchEvent(pointer(type, 3));
    axis1.dispatchEvent(pointer("lostpointercapture", 3));
    expect(events).toEqual([{ type: "press", axis: 1 }, { type: "cancel" }]);
  });

  it("cancels on blur, rotation, or a hidden document and requires a fresh press", () => {
    const { events, axis1 } = setup();
    axis1.dispatchEvent(pointer("pointerdown", 1));
    window.dispatchEvent(new Event("blur"));
    axis1.dispatchEvent(pointer("pointerdown", 2));
    window.dispatchEvent(new Event("orientationchange"));
    axis1.dispatchEvent(pointer("pointerdown", 3));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(events).toEqual([
      { type: "press", axis: 1 }, { type: "cancel" },
      { type: "press", axis: 1 }, { type: "cancel" },
      { type: "press", axis: 1 }, { type: "cancel" },
    ]);
  });

  it("dispatches lifecycle cancellation during automatic movement without an input owner", () => {
    const { events, controls } = setup();
    controls.update({ phase: "DROP", paused: false });
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("orientationchange"));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(events).toEqual([{ type: "cancel" }, { type: "cancel" }, { type: "cancel" }]);

    controls.dispose();
    window.dispatchEvent(new Event("blur"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(events).toHaveLength(3);
  });

  it("supports keyboard holds, disables unavailable stages, and removes listeners on disposal", () => {
    const { events, controls, axis1, axis2 } = setup();
    controls.update({ phase: "READY", paused: false });
    expect(axis1.disabled).toBe(false);
    expect(axis2.disabled).toBe(true);
    axis1.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    axis1.dispatchEvent(new KeyboardEvent("keyup", { key: " ", bubbles: true }));
    controls.update({ phase: "DROP", paused: false });
    expect(axis1.disabled).toBe(true);
    expect(axis2.disabled).toBe(true);
    controls.dispose();
    window.dispatchEvent(new Event("blur"));
    expect(events).toEqual([{ type: "press", axis: 1 }, { type: "release", axis: 1 }]);
  });
});
