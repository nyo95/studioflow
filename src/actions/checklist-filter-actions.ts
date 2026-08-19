"use server";

import { createAction } from "@/lib/action-wrapper";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_TODAY } from "@/lib/revalidation-tags";
import {
  DeleteChecklistFilterViewSchema,
  SaveChecklistFilterViewSchema,
} from "@/lib/validations";

export const saveChecklistFilterView = createAction(
  async ({ input, ctx, tx }) => {
    const view = await tx.checklistFilterView.upsert({
      where: {
        owner_id_name: {
          owner_id: ctx.userId,
          name: input.name,
        },
      },
      create: {
        owner_id: ctx.userId,
        name: input.name,
        query_json: input.query,
      },
      update: { query_json: input.query },
      select: { id: true, name: true },
    });

    invalidateCache({ scope: REVALIDATE_TODAY });
    return { ...view, query: input.query };
  },
  { schema: SaveChecklistFilterViewSchema }
);

export const deleteChecklistFilterView = createAction(
  async ({ input, ctx, tx }) => {
    const deleted = await tx.checklistFilterView.deleteMany({
      where: { id: input.filterId, owner_id: ctx.userId },
    });
    if (deleted.count === 0) {
      throw new Error("Saved filter not found");
    }

    invalidateCache({ scope: REVALIDATE_TODAY });
    return { id: input.filterId };
  },
  { schema: DeleteChecklistFilterViewSchema }
);
