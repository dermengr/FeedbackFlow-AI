import { describe, it, expect, vi } from "vitest";
import {
  mapKeyToAction,
  isTypingTarget,
  handleShortcutEvent,
} from "@/hooks/useKeyboardShortcuts";

describe("mapKeyToAction", () => {
  it("maps navigation keys", () => {
    expect(mapKeyToAction("j")).toBe("next");
    expect(mapKeyToAction("k")).toBe("prev");
  });

  it("maps status keys", () => {
    expect(mapKeyToAction("1")).toBe("statusNew");
    expect(mapKeyToAction("2")).toBe("statusAck");
    expect(mapKeyToAction("3")).toBe("statusActioned");
  });

  it("maps snooze, help and search keys", () => {
    expect(mapKeyToAction("s")).toBe("snooze");
    expect(mapKeyToAction("?")).toBe("toggleHelp");
    expect(mapKeyToAction("/")).toBe("search");
  });

  it("returns null for unmapped keys", () => {
    expect(mapKeyToAction("a")).toBeNull();
    expect(mapKeyToAction("")).toBeNull();
    expect(mapKeyToAction("J")).toBeNull();
  });
});

// Lightweight fake element factory so we can exercise the hook's logic
// (which reads `document.activeElement`) without needing a DOM environment.
function fakeEl(tag: string, opts: { contentEditable?: boolean } = {}) {
  return {
    tagName: tag,
    isContentEditable: opts.contentEditable ?? false,
  } as unknown as Element;
}

describe("isTypingTarget", () => {
  it("treats input/textarea/select as typing targets", () => {
    expect(isTypingTarget(fakeEl("INPUT"))).toBe(true);
    expect(isTypingTarget(fakeEl("TEXTAREA"))).toBe(true);
    expect(isTypingTarget(fakeEl("SELECT"))).toBe(true);
  });

  it("treats contentEditable elements as typing targets", () => {
    expect(isTypingTarget(fakeEl("DIV", { contentEditable: true }))).toBe(true);
  });

  it("does not treat regular elements as typing targets", () => {
    expect(isTypingTarget(fakeEl("DIV"))).toBe(false);
    expect(isTypingTarget(fakeEl("BODY"))).toBe(false);
  });

  it("handles null", () => {
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("handleShortcutEvent (hook core logic)", () => {
  it("calls the matching handler for a mapped key", () => {
    const next = vi.fn();
    const result = handleShortcutEvent("j", null, { next });
    expect(next).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it("calls the correct handler for each mapped key", () => {
    const handlers = {
      next: vi.fn(),
      prev: vi.fn(),
      statusNew: vi.fn(),
      statusAck: vi.fn(),
      statusActioned: vi.fn(),
      snooze: vi.fn(),
      toggleHelp: vi.fn(),
      search: vi.fn(),
    };

    expect(handleShortcutEvent("j", null, handlers)).toBe(true);
    expect(handlers.next).toHaveBeenCalledTimes(1);

    expect(handleShortcutEvent("k", null, handlers)).toBe(true);
    expect(handlers.prev).toHaveBeenCalledTimes(1);

    expect(handleShortcutEvent("1", null, handlers)).toBe(true);
    expect(handlers.statusNew).toHaveBeenCalledTimes(1);

    expect(handleShortcutEvent("2", null, handlers)).toBe(true);
    expect(handlers.statusAck).toHaveBeenCalledTimes(1);

    expect(handleShortcutEvent("3", null, handlers)).toBe(true);
    expect(handlers.statusActioned).toHaveBeenCalledTimes(1);

    expect(handleShortcutEvent("s", null, handlers)).toBe(true);
    expect(handlers.snooze).toHaveBeenCalledTimes(1);

    expect(handleShortcutEvent("?", null, handlers)).toBe(true);
    expect(handlers.toggleHelp).toHaveBeenCalledTimes(1);

    expect(handleShortcutEvent("/", null, handlers)).toBe(true);
    expect(handlers.search).toHaveBeenCalledTimes(1);
  });

  it("ignores keys when focus is in an input element", () => {
    const next = vi.fn();
    const result = handleShortcutEvent("j", fakeEl("INPUT"), { next });
    expect(next).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it("ignores keys when focus is in a textarea element", () => {
    const next = vi.fn();
    const result = handleShortcutEvent("j", fakeEl("TEXTAREA"), { next });
    expect(next).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it("ignores keys when focus is in a select element", () => {
    const snooze = vi.fn();
    const result = handleShortcutEvent("s", fakeEl("SELECT"), { snooze });
    expect(snooze).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it("ignores keys when focus is in a contentEditable element", () => {
    const next = vi.fn();
    const result = handleShortcutEvent("j", fakeEl("DIV", { contentEditable: true }), { next });
    expect(next).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it("does not call handlers for unmapped keys", () => {
    const next = vi.fn();
    const result = handleShortcutEvent("a", null, { next });
    expect(next).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it("returns false when no handler is provided for a mapped action", () => {
    const result = handleShortcutEvent("j", null, {});
    expect(result).toBe(false);
  });
});
