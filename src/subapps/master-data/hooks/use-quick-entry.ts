"use client";

/**
 * MASTER DATA — quick entry, client half.
 * ============================================================================
 * The server half is `actions/quick-entry-actions.ts`. This is the bit every
 * calling screen would otherwise write for itself: call the action, unwrap the
 * result, say something, and — the part that is easy to forget — put the new
 * row into the list the picker is reading from.
 *
 * ----------------------------------------------------------------------------
 * WHY THE LIST OVERLAY EXISTS
 * ----------------------------------------------------------------------------
 * The option lists are fetched by a server component and handed down as props.
 * A row created mid-form is not in that array, and will not be until the page
 * refetches. Without an overlay the sequence is: create the vendor, watch it
 * vanish from the dropdown, create it again.
 *
 * `router.refresh()` is deliberately NOT used to solve this. It would discard
 * the half-finished form the user is standing in — the very form the quick
 * entry existed to avoid interrupting. So the new row is held locally and
 * merged over the props until the next real navigation, at which point the
 * server list contains it and the overlay is redundant (and deduped away).
 */

import * as React from "react";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import type { ActionResult } from "@/types/common";
import type { QuickEntryResult } from "../actions/quick-entry-actions";

/** The shape every picker option list shares. */
type NamedRow = { id: string; name: string };

export type UseQuickEntry<T extends NamedRow> = {
  /** Server rows with anything created this session merged in, deduped by id. */
  options: T[];
  /** Hand this to a picker's `onQuickCreate`. */
  create: (name: string) => void;
  /** True while a create is in flight — pickers may disable on it. */
  isCreating: boolean;
};

/**
 * @param serverRows  The list as fetched by the page.
 * @param action      One of the `quickCreate*Action` server actions.
 * @param toRow       Builds a full option row from the minimal result. The
 *                    fields the action does not return are genuinely unknown,
 *                    not defaulted — see the note in quick-entry-actions.ts.
 * @param onCreated   Called after a successful create, with the new row's id.
 *                    Use it to select the row in the form that asked for it.
 */
export function useQuickEntry<T extends NamedRow, TInput>({
  serverRows,
  action,
  input,
  toRow,
  onCreated,
  label = "Entry",
}: {
  serverRows: T[];
  action: (input: TInput) => Promise<ActionResult<QuickEntryResult>>;
  /** Builds the action payload from the typed name. */
  input: (name: string) => TInput;
  toRow: (created: QuickEntryResult) => T;
  onCreated?: (id: string, created: QuickEntryResult) => void;
  /** Noun used in the toast: "Vendor added", "Brand added". */
  label?: string;
}): UseQuickEntry<T> {
  const [extra, setExtra] = React.useState<T[]>([]);
  const [isCreating, setIsCreating] = React.useState(false);

  const options = React.useMemo(() => {
    if (extra.length === 0) return serverRows;
    // Server wins on conflict: once the refetch happens its row is the real
    // one, and the local copy is a stale snapshot of the same id.
    const seen = new Set(serverRows.map((r) => r.id));
    return [...serverRows, ...extra.filter((r) => !seen.has(r.id))];
  }, [serverRows, extra]);

  const create = React.useCallback(
    (rawName: string) => {
      const name = rawName.trim();
      if (!name || isCreating) return;

      setIsCreating(true);
      void (async () => {
        try {
          const created = unwrapActionResult(await action(input(name)));
          setExtra((prev) =>
            prev.some((r) => r.id === created.id) ? prev : [...prev, toRow(created)]
          );
          onCreated?.(created.id, created);
          // Reuse is not a failure, but it IS a different outcome — saying so
          // stops someone wondering why their new vendor already has prices.
          toast.success(
            created.reused
              ? `${label} "${created.name}" already existed — selected it.`
              : `${label} "${created.name}" added. Complete its details on the Supplier page.`
          );
        } catch (e) {
          toast.error(e instanceof Error ? e.message : `Could not add ${label.toLowerCase()}`);
        } finally {
          setIsCreating(false);
        }
      })();
    },
    [action, input, toRow, onCreated, label, isCreating]
  );

  return { options, create, isCreating };
}
