"use client";
import { useEffect } from "react";
import { X } from "lucide-react";

interface KeyboardHelpProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutEntry {
  keys: string[];
  label: string;
}

const SHORTCUTS: ShortcutEntry[] = [
  { keys: ["j"], label: "Next item" },
  { keys: ["k"], label: "Previous item" },
  { keys: ["1"], label: "Set status to New" },
  { keys: ["2"], label: "Set status to Acknowledged" },
  { keys: ["3"], label: "Set status to Actioned" },
  { keys: ["s"], label: "Snooze item" },
  { keys: ["/"], label: "Focus search" },
  { keys: ["?"], label: "Toggle this help" },
  { keys: ["Esc"], label: "Close this help" },
];

export function KeyboardHelp({ open, onClose }: KeyboardHelpProps) {
  // Close on Escape key.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts help"
    >
      <div
        className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close help"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Keyboard shortcuts
        </h2>

        <ul className="space-y-2">
          {SHORTCUTS.map((entry) => (
            <li
              key={entry.label}
              className="flex items-center justify-between gap-4"
            >
              <span className="text-sm text-gray-700">{entry.label}</span>
              <span className="flex flex-shrink-0 items-center gap-1">
                {entry.keys.map((key) => (
                  <kbd
                    key={key}
                    className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-xs font-medium text-gray-800 shadow-sm"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
