"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { BulkActionBar } from "@/components/BulkActionBar";
import { KeyboardHelp } from "@/components/KeyboardHelp";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

// Client-side interactions for the inbox: row selection (checkboxes),
// bulk action bar, and keyboard shortcuts help overlay.
// The inbox table is server-rendered with checkboxes that have data-item-id
// attributes; this component syncs their checked state with React state and
// wires up the select-all checkbox.
export function InboxInteractions({ itemIds }: { itemIds: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [helpOpen, setHelpOpen] = useState(false);
  const lastToggledRef = useRef<string | null>(null);

  const toggle = useCallback((id: string, range?: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (range && lastToggledRef.current && lastToggledRef.current !== id) {
        const lastIdx = itemIds.indexOf(lastToggledRef.current);
        const currentIdx = itemIds.indexOf(id);
        if (lastIdx !== -1 && currentIdx !== -1) {
          const start = Math.min(lastIdx, currentIdx);
          const end = Math.max(lastIdx, currentIdx);
          const selecting = !next.has(id);
          for (let i = start; i <= end; i++) {
            if (selecting) next.add(itemIds[i]);
            else next.delete(itemIds[i]);
          }
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    lastToggledRef.current = id;
  }, [itemIds]);

  const selectAll = useCallback(() => {
    setSelected(new Set(itemIds));
  }, [itemIds]);

  const clear = useCallback(() => {
    setSelected(new Set());
    lastToggledRef.current = null;
  }, []);

  // Sync the checked state of all rendered checkboxes and row highlight.
  useEffect(() => {
    const checkboxes = document.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][data-item-id]'
    );
    checkboxes.forEach((cb) => {
      const id = cb.dataset.itemId;
      if (!id) return;
      cb.checked = selected.has(id);
      const row = cb.closest("tr");
      if (row) {
        row.classList.toggle("bg-brand-50/60", selected.has(id));
        row.classList.toggle("dark:bg-brand-900/20", selected.has(id));
        row.classList.toggle("hover:bg-brand-50/80", selected.has(id));
        row.classList.toggle("dark:hover:bg-brand-900/30", selected.has(id));
      }
    });

    const selectAllCb = document.getElementById("inbox-select-all") as HTMLInputElement | null;
    if (selectAllCb) {
      const allSelected = itemIds.length > 0 && itemIds.every((id) => selected.has(id));
      const someSelected = itemIds.some((id) => selected.has(id));
      selectAllCb.checked = allSelected;
      selectAllCb.indeterminate = someSelected && !allSelected;
    }
  }, [selected, itemIds]);

  // Attach listeners to server-rendered checkboxes.
  useEffect(() => {
    const checkboxes = document.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][data-item-id]'
    );
    const handlers: Array<() => void> = [];
    checkboxes.forEach((cb) => {
      const id = cb.dataset.itemId;
      if (!id) return;
      const handler = (e: Event) => {
        const mouseEvent = e as MouseEvent;
        toggle(id, mouseEvent.shiftKey);
      };
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
