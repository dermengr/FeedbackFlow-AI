"use client";
import { useEffect, useRef } from "react";

export interface ShortcutHandlers {
  next?: () => void; // j
  prev?: () => void; // k
  statusNew?: () => void; // 1
  statusAck?: () => void; // 2
  statusActioned?: () => void; // 3
  snooze?: () => void; // s
  toggleHelp?: () => void; // ?
  search?: () => void; // /
}

/**
 * Pure mapping from a keyboard `key` value to a logical action name.
 * Returns `null` when the key does not correspond to a shortcut.
 *
 * Extracted as an exported pure function so it can be unit-tested without
 * needing a DOM environment.
 */
export function mapKeyToAction(key: string): string | null {
  switch (key) {
    case "j":
      return "next";
    case "k":
      return "prev";
    case "1":
      return "statusNew";
    case "2":
      return "statusAck";
    case "3":
      return "statusActioned";
    case "s":
      return "snooze";
    case "?":
      return "toggleHelp";
    case "/":
      return "search";
    default:
      return null;
  }
}

/**
 * Returns true when the given element is a text-input-like element where
 * keyboard shortcuts should be ignored to avoid interfering with typing.
 *
 * Exported as a pure function so the "ignore while typing" rule can be
 * unit-tested without a DOM.
 */
export function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  if ((el as HTMLElement).isContentEditable) {
    return true;
  }
  return false;
}

/**
 * Core, side-effect-routing logic shared by the hook. Given the pressed key,
 * the currently focused element, and the shortcut handlers, this:
 *   - skips when focus is in a typing target (input/textarea/select/contentEditable)
 *   - maps the key to an action
 *   - calls the matching handler if one was provided
 *
 * Returns `true` when a handler was invoked (so callers can `preventDefault`),
 * `false` otherwise. Pure with respect to the DOM — safe to unit-test in a
 * node environment by passing a fake `activeElement`.
 */
export function handleShortcutEvent(
  key: string,
  activeElement: Element | null,
  handlers: ShortcutHandlers
): boolean {
  if (isTypingTarget(activeElement)) {
    return false;
  }

  const action = mapKeyToAction(key);
  if (action === null) return false;

  const handler = (
    handlers as Record<string, (() => void) | undefined>
  )[action];
  if (typeof handler === "function") {
    handler();
    return true;
  }
  return false;
}

/**
 * Registers a single keydown listener that dispatches to the provided
 * shortcut handlers. The listener is only registered while `enabled` is
 * true and is cleaned up on unmount.
 *
 * Shortcuts are ignored when focus is inside an input/textarea/select or
 * any `contentEditable` element so typing is not disrupted.
 */
export function useKeyboardShortcuts(
  handlers: ShortcutHandlers,
  enabled: boolean = true
) {
  // Keep the latest handlers in a ref so we can register the listener once
  // while still always calling the most recent callbacks.
  const handlersRef = useRef<ShortcutHandlers>(handlers);
  handlersRef.current = handlers;

  const enabledRef = useRef<boolean>(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!enabledRef.current) return;
      const handled = handleShortcutEvent(
        e.key,
        document.activeElement,
        handlersRef.current
      );
      if (handled) {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
    // Register a single listener; handlers/enablement are read via refs.
  }, [enabled]);
}
