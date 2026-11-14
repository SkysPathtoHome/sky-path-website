"use client";

import { useEffect, useRef, type ReactNode } from "react";

// The "Select all" strip above an admin list: a tick-all box, how many rows
// are selected, and whatever bulk actions the page passes as children.
// "All" always means the rows on screen under the current tab.
export default function SelectionBar({
  total,
  selectedCount,
  onToggleAll,
  onClear,
  busy = false,
  hint,
  children,
}: {
  total: number;
  selectedCount: number;
  onToggleAll: () => void;
  onClear: () => void;
  busy?: boolean;
  hint: string;
  children: ReactNode;
}) {
  const boxRef = useRef<HTMLInputElement>(null);
  const allSelected = total > 0 && selectedCount === total;

  useEffect(() => {
    if (boxRef.current) boxRef.current.indeterminate = selectedCount > 0 && selectedCount < total;
  }, [selectedCount, total]);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-brand-soft-blue/60 bg-brand-gray px-3 py-2">
      <label className="flex items-center gap-2 text-sm font-medium text-brand-charcoal">
        <input ref={boxRef} type="checkbox" checked={allSelected} onChange={onToggleAll} />
        Select all ({total})
      </label>
      {selectedCount > 0 ? (
        <>
          <span className="text-sm text-brand-charcoal/80">{selectedCount} selected</span>
          <span className="flex flex-wrap items-center gap-3">
            {children}
            <button
              type="button"
              disabled={busy}
              onClick={onClear}
              className="text-xs font-medium text-brand-charcoal/80 hover:underline disabled:text-brand-charcoal/50"
            >
              Clear selection
            </button>
          </span>
        </>
      ) : (
        <span className="text-sm text-brand-charcoal/60">{hint}</span>
      )}
    </div>
  );
}

export const bulkActionClass =
  "text-xs font-medium text-brand-purple hover:underline disabled:text-brand-charcoal/50 disabled:no-underline";
export const bulkDangerClass =
  "text-xs font-medium text-red-700 hover:underline disabled:text-brand-charcoal/50 disabled:no-underline";
