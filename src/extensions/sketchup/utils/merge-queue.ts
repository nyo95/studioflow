/**
 * Display-only helpers for the SketchUp Merge Actions Queue.
 *
 * `normalizeSketchupMaterialCodesAction` (see ../actions/sketchup-actions.ts)
 * intentionally queues renames in two hops — source -> temporary -> target —
 * to avoid code collisions while renumbering a whole prefix group (the same
 * technique used by MaterialOps.compact_prefix on the SketchUp plugin side).
 *
 * Both hops are real DB rows and both must still be executed by the plugin
 * in order. But showing both rows to the user in the queue list is
 * confusing: "ACR-4 -> ACR-5" then "ACR-5 -> ACR-3" reads like two separate
 * merges instead of one rename. collapseMergeActionChains() walks the
 * source/target adjacency and folds any chain into a single logical entry
 * for display, without touching the underlying rows or execution order.
 */

export type ChainableMergeAction = {
  id: string;
  source_code: string;
  target_code: string;
};

export type CollapsedMergeAction<T extends ChainableMergeAction> = {
  /** All underlying rows that make up this logical change, in hop order. */
  steps: T[];
  /** The code as it exists today (first hop's source). */
  sourceCode: string;
  /** The code it will end up as once every hop executes (last hop's target). */
  targetCode: string;
  /** True when this is a multi-hop temporary-code chain, not a direct merge. */
  isMultiStep: boolean;
};

export function collapseMergeActionChains<T extends ChainableMergeAction>(
  actions: T[]
): CollapsedMergeAction<T>[] {
  // A hop is a "continuation" if some other pending hop's target_code equals
  // its own source_code — i.e. it picks up where another hop left off.
  const targetToAction = new Map<string, T>();
  for (const action of actions) {
    // If two actions ever shared a target_code the data would already be
    // ambiguous; keep the first one and let the rest render standalone
    // rather than risk an incorrect chain.
    if (!targetToAction.has(action.target_code)) {
      targetToAction.set(action.target_code, action);
    }
  }

  const sourceToAction = new Map<string, T>();
  for (const action of actions) {
    if (!sourceToAction.has(action.source_code)) {
      sourceToAction.set(action.source_code, action);
    }
  }

  const isContinuation = (action: T) => {
    const predecessor = targetToAction.get(action.source_code);
    return predecessor !== undefined && predecessor !== action;
  };

  const visited = new Set<string>();
  const collapsed: CollapsedMergeAction<T>[] = [];

  const walkChain = (head: T) => {
    const steps: T[] = [head];
    visited.add(head.id);

    let current = head;
    while (true) {
      const next = sourceToAction.get(current.target_code);
      if (!next || next === current || visited.has(next.id)) break;
      steps.push(next);
      visited.add(next.id);
      current = next;
    }

    collapsed.push({
      steps,
      sourceCode: steps[0].source_code,
      targetCode: steps[steps.length - 1].target_code,
      isMultiStep: steps.length > 1,
    });
  };

  for (const head of actions) {
    if (visited.has(head.id) || isContinuation(head)) continue;
    walkChain(head);
  }

  // A cyclic swap (e.g. A -> B, B -> A) has no action without a predecessor —
  // every hop is "someone else's" continuation, so the loop above leaves all
  // of them unvisited even though pending_action_count is non-zero. Rather
  // than drop them from the display, break the cycle at an arbitrary
  // remaining action and walk it exactly like a normal chain; this only
  // changes which hop is shown as the "start" of the loop, never the
  // underlying rows or execution order.
  for (const action of actions) {
    if (!visited.has(action.id)) walkChain(action);
  }

  return collapsed;
}
