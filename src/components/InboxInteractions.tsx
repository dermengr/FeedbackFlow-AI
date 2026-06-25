"use client";

import { useState, useCallback, useEffect } from "react";
import { BulkActionBar } from "@/components/BulkActionBar";
import { KeyboardHelp } from "@/components/KeyboardHelp";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

// Client-side interactions for the inbox: row selection (checkboxes),
// bulk action bar, and keyboard shortcuts help overlay.
// The inbox table is server-rendered with checkboxes that have data-item-id
// attributes; this component attaches event listeners to them.
export function InboxInteractions({ itemIds }: { itemIds: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [helpOpen, setHelpOpen] = useState(false);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(itemIds));
  }, [itemIds]);

  const clear = useCallback(() => setSelected(new Set()), []);

  // Attach listeners to server-rendered checkboxes.
  useEffect(() => {
    const checkboxes = document.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][data-item-id]'
    );
    const handlers: Array<() => void> = [];
    checkboxes.forEach((cb) => {
      const id = cb.dataset.itemId;
      if (!id) return;
      const handler = () => toggle(id);
      cb.addEventListener("change", handler);
      handlers.push(() => cb.removeEventListener("change", handler));
    });

    const selectAllCb = document.getElementById("inbox-select-all") as HTMLInputElement | null;
    const selectAllHandler = () => {
      if (selectAllCb?.checked) selectAll();
      else clear();
    };
    selectAllCb?.addEventListener("change", selectAllHandler);

    return () => {
      handlers.forEach((h) => h());
      selectAllCb?.removeEventListener("change", selectAllHandler);
    };
  }, [itemIds, toggle, selectAll, clear]);

  useKeyboardShortcuts({
    toggleHelp: () => setHelpOpen((v) => !v),
  });

  const selectedIds = Array.from(selected);

  return (
    <>
      <BulkActionBar
        selectedIds={selectedIds}
        onClear={clear}
        onDone={() => {
          clear();
          window.location.reload();
        }}
      />
      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
