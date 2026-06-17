"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  linkSketchupMaterialAction,
  updateSketchupMaterialAction,
  updateSketchupFFEAction,
  pushStagedDataToScheduleAction,
  pushMaterialAsNewEntryAction,
} from "../actions/sketchup-actions";

type ScheduleEntryOption = {
  id: string;
  schedule_prefix: string;
  schedule_increment: number;
};

type MaterialItem = {
  id: string;
  code: string;
  uuid: string;
  brand: string | null;
  type: string | null;
  finish: string | null;
  image_url: string | null;
  location_notes: string | null;
  area: number | null;
  linked_entry_id: string | null;
};

type FFEItem = {
  id: string;
  code: string;
  instance_count: number;
  metadata: any;
};

interface SketchupMappingQueueProps {
  projectId: string;
  materials: MaterialItem[];
  ffes: FFEItem[];
  scheduleEntries: ScheduleEntryOption[];
}

export function SketchupMappingQueue({
  projectId,
  materials,
  ffes,
  scheduleEntries,
}: SketchupMappingQueueProps) {
  const [activeTab, setActiveTab] = useState<"materials" | "ffe">("materials");
  const [isPending, startTransition] = useTransition();

  // State for Material inline edits
  const [materialEdits, setMaterialEdits] = useState<
    Record<string, { brand: string; type: string; location_notes: string }>
  >({});

  // State for FFE inline edits
  const [ffeEdits, setFfeEdits] = useState<
    Record<string, { brand: string; product_name: string; location_notes: string }>
  >({});

  const handlePushStagedData = () => {
    startTransition(async () => {
      const res = await pushStagedDataToScheduleAction(projectId);
      if ("success" in res && res.success) {
        toast.success("Successfully pushed staged data to Product Schedule.");
      } else {
        toast.error(("error" in res ? res.error : "Failed to push staged data") || "Failed to push staged data.");
      }
    });
  };

  const handlePushMaterialAsNewEntry = (matId: string) => {
    startTransition(async () => {
      const res = await pushMaterialAsNewEntryAction(matId, projectId);
      if ("success" in res && res.success) {
        toast.success("Material pushed as a new schedule entry.");
      } else {
        toast.error(("error" in res ? res.error : "Failed to push material") || "Failed to push material.");
      }
    });
  };

  const handleMaterialEditChange = (
    matId: string,
    field: "brand" | "type" | "location_notes",
    value: string
  ) => {
    const item = materials.find((m) => m.id === matId);
    const currentEdit = materialEdits[matId] || {
      brand: item?.brand || "",
      type: item?.type || "",
      location_notes: item?.location_notes || "",
    };

    setMaterialEdits({
      ...materialEdits,
      [matId]: {
        ...currentEdit,
        [field]: value,
      },
    });
  };

  const handleFfeEditChange = (
    ffeId: string,
    field: "brand" | "product_name" | "location_notes",
    value: string
  ) => {
    const item = ffes.find((f) => f.id === ffeId);
    const meta = item?.metadata || {};
    const currentEdit = ffeEdits[ffeId] || {
      brand: meta.brand || "",
      product_name: meta.product_name || "",
      location_notes: meta.location_notes || "",
    };

    setFfeEdits({
      ...ffeEdits,
      [ffeId]: {
        ...currentEdit,
        [field]: value,
      },
    });
  };

  const saveMaterialEdits = (matId: string) => {
    const edits = materialEdits[matId];
    if (!edits) return;

    startTransition(async () => {
      const res = await updateSketchupMaterialAction(matId, edits, projectId);
      if (res.success) {
        toast.success("Material details saved successfully.");
      } else {
        toast.error(res.error || "Failed to save material details.");
      }
    });
  };

  const saveFfeEdits = (ffeId: string) => {
    const edits = ffeEdits[ffeId];
    if (!edits) return;

    startTransition(async () => {
      const res = await updateSketchupFFEAction(ffeId, edits, projectId);
      if (res.success) {
        toast.success("FF&E details saved successfully.");
      } else {
        toast.error(res.error || "Failed to save FF&E details.");
      }
    });
  };

  const linkMaterial = (matId: string, entryId: string | null) => {
    startTransition(async () => {
      const res = await linkSketchupMaterialAction(matId, entryId, projectId);
      if (res.success) {
        if (entryId) {
          toast.success("Material linked to schedule entry.");
        } else {
          toast.success("Material unlinked.");
        }
      } else {
        toast.error(res.error || "Failed to update material link.");
      }
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-[var(--ui-radius-card)] overflow-hidden shadow-sm">
      {/* Tabs Header */}
      <div className="flex border-b border-slate-200 bg-slate-50/50">
        <button
          onClick={() => setActiveTab("materials")}
          className={`flex-1 py-4 text-center font-serif font-bold text-base transition-colors ${
            activeTab === "materials"
              ? "border-b-2 border-slate-900 text-slate-900 bg-white"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Synced Materials Mapping
        </button>
        <button
          onClick={() => setActiveTab("ffe")}
          className={`flex-1 py-4 text-center font-serif font-bold text-base transition-colors ${
            activeTab === "ffe"
              ? "border-b-2 border-slate-900 text-slate-900 bg-white"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Synced FF&E (Fixtures) Mapping
        </button>
      </div>

      <div className="p-6">
        {activeTab === "materials" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-serif font-bold text-xl text-slate-900 mb-2">Materials Mapping Queue</h3>
                <p className="text-slate-500 font-sans text-sm">
                  Map SketchUp model materials to your active project schedule entries. Materials must be manually linked.
                </p>
              </div>
              <button
                disabled={isPending}
                onClick={handlePushStagedData}
                className="px-4 py-2 bg-emerald-700 text-white font-sans text-xs font-semibold rounded-[var(--ui-radius-action)] hover:bg-emerald-800 transition-colors disabled:opacity-50"
              >
                {isPending ? "Pushing..." : "Push Staged Data to Schedule"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-sans text-xs uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Linked Entry</th>
                    <th className="py-3 px-4">Brand (Manual)</th>
                    <th className="py-3 px-4">Type (Manual)</th>
                    <th className="py-3 px-4">Location Notes (Manual)</th>
                    <th className="py-3 px-4">Area</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans text-sm text-slate-700">
                  {materials.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                        No materials synchronized from SketchUp yet.
                      </td>
                    </tr>
                  ) : (
                    materials.map((mat) => {
                      const edits = materialEdits[mat.id] || {
                        brand: mat.brand || "",
                        type: mat.type || "",
                        location_notes: mat.location_notes || "",
                      };
                      const hasChanges =
                        edits.brand !== (mat.brand || "") ||
                        edits.type !== (mat.type || "") ||
                        edits.location_notes !== (mat.location_notes || "");

                      return (
                        <tr key={mat.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-4 font-mono font-bold text-slate-900">{mat.code}</td>
                          <td className="py-4 px-4 min-w-[200px]">
                            {mat.linked_entry_id ? (
                              <div className="flex items-center gap-2">
                                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-1 text-xs font-semibold rounded-[var(--ui-radius-action)]">
                                  {(() => {
                                    const entry = scheduleEntries.find((e) => e.id === mat.linked_entry_id);
                                    return entry
                                      ? `${entry.schedule_prefix}-${String(entry.schedule_increment).padStart(
                                          2,
                                          "0"
                                        )}`
                                      : "Linked";
                                  })()}
                                </span>
                                <button
                                  disabled={isPending}
                                  onClick={() => linkMaterial(mat.id, null)}
                                  className="text-xs text-red-600 hover:text-red-700 font-medium hover:underline disabled:opacity-50"
                                >
                                  Unlink
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <select
                                  disabled={isPending}
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      linkMaterial(mat.id, e.target.value);
                                    }
                                  }}
                                  className="border border-slate-200 bg-white font-sans text-xs rounded-[var(--ui-radius-control)] p-1.5 focus:border-slate-300 focus:outline-none"
                                  defaultValue=""
                                >
                                  <option value="" disabled>
                                    -- Link to Schedule --
                                  </option>
                                  {scheduleEntries.map((entry) => (
                                    <option key={entry.id} value={entry.id}>
                                      {entry.schedule_prefix}-{String(entry.schedule_increment).padStart(2, "0")}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <input
                              type="text"
                              value={edits.brand}
                              disabled={isPending}
                              onChange={(e) => handleMaterialEditChange(mat.id, "brand", e.target.value)}
                              className="w-full border border-slate-200 bg-white font-sans text-xs rounded-[var(--ui-radius-control)] p-1.5 focus:border-slate-300 focus:outline-none"
                              placeholder="e.g. Nippon Paint"
                            />
                          </td>
                          <td className="py-4 px-4">
                            <input
                              type="text"
                              value={edits.type}
                              disabled={isPending}
                              onChange={(e) => handleMaterialEditChange(mat.id, "type", e.target.value)}
                              className="w-full border border-slate-200 bg-white font-sans text-xs rounded-[var(--ui-radius-control)] p-1.5 focus:border-slate-300 focus:outline-none"
                              placeholder="e.g. Paint Finish"
                            />
                          </td>
                          <td className="py-4 px-4">
                            <input
                              type="text"
                              value={edits.location_notes}
                              disabled={isPending}
                              onChange={(e) => handleMaterialEditChange(mat.id, "location_notes", e.target.value)}
                              className="w-full border border-slate-200 bg-white font-sans text-xs rounded-[var(--ui-radius-control)] p-1.5 focus:border-slate-300 focus:outline-none"
                              placeholder="e.g. Bedroom Wall"
                            />
                          </td>
                          <td className="py-4 px-4 text-xs font-mono text-slate-500 whitespace-nowrap">
                            {mat.area ? `${mat.area.toFixed(2)} m²` : "—"}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex justify-end items-center gap-2">
                              {!mat.linked_entry_id && (
                                <button
                                  disabled={isPending}
                                  onClick={() => handlePushMaterialAsNewEntry(mat.id)}
                                  className="border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-sans text-xs font-semibold rounded-[var(--ui-radius-action)] px-2.5 py-1.5 transition-colors disabled:opacity-50"
                                >
                                  Push as New Entry
                                </button>
                              )}
                              {hasChanges && (
                                <button
                                  disabled={isPending}
                                  onClick={() => saveMaterialEdits(mat.id)}
                                  className="bg-slate-900 text-white font-sans text-xs font-semibold rounded-[var(--ui-radius-action)] px-2.5 py-1.5 hover:bg-slate-800 transition-colors disabled:opacity-50"
                                >
                                  Save
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "ffe" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-serif font-bold text-xl text-slate-900 mb-2">FF&E Mapping Queue</h3>
                <p className="text-slate-500 font-sans text-sm">
                  FF&E components are resolved dynamically by matching code strings. Edit manual fallback fields directly below.
                </p>
              </div>
              <button
                disabled={isPending}
                onClick={handlePushStagedData}
                className="px-4 py-2 bg-emerald-700 text-white font-sans text-xs font-semibold rounded-[var(--ui-radius-action)] hover:bg-emerald-800 transition-colors disabled:opacity-50"
              >
                {isPending ? "Pushing..." : "Push Staged Data to Schedule"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-sans text-xs uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Qty</th>
                    <th className="py-3 px-4">Brand</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Location Notes</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans text-sm text-slate-700">
                  {ffes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                        No FF&E components synchronized from SketchUp yet.
                      </td>
                    </tr>
                  ) : (
                    ffes.map((ffe) => {
                      const meta = ffe.metadata || {};
                      const edits = ffeEdits[ffe.id] || {
                        brand: meta.brand || "",
                        product_name: meta.product_name || "",
                        location_notes: meta.location_notes || "",
                      };
                      const hasChanges =
                        edits.brand !== (meta.brand || "") ||
                        edits.product_name !== (meta.product_name || "") ||
                        edits.location_notes !== (meta.location_notes || "");

                      return (
                        <tr key={ffe.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-4 font-mono font-bold text-slate-900">{ffe.code}</td>
                          <td className="py-4 px-4 font-mono font-semibold text-slate-700">{ffe.instance_count}</td>
                          <td className="py-4 px-4">
                            <input
                              type="text"
                              value={edits.brand}
                              disabled={isPending}
                              onChange={(e) => handleFfeEditChange(ffe.id, "brand", e.target.value)}
                              className="w-full border border-slate-200 bg-white font-sans text-xs rounded-[var(--ui-radius-control)] p-1.5 focus:border-slate-300 focus:outline-none"
                              placeholder="e.g. IKEA"
                            />
                          </td>
                          <td className="py-4 px-4">
                            <input
                              type="text"
                              value={edits.product_name}
                              disabled={isPending}
                              onChange={(e) => handleFfeEditChange(ffe.id, "product_name", e.target.value)}
                              className="w-full border border-slate-200 bg-white font-sans text-xs rounded-[var(--ui-radius-control)] p-1.5 focus:border-slate-300 focus:outline-none"
                              placeholder="e.g. Ektorp Sofa"
                            />
                          </td>
                          <td className="py-4 px-4">
                            <input
                              type="text"
                              value={edits.location_notes}
                              disabled={isPending}
                              onChange={(e) => handleFfeEditChange(ffe.id, "location_notes", e.target.value)}
                              className="w-full border border-slate-200 bg-white font-sans text-xs rounded-[var(--ui-radius-control)] p-1.5 focus:border-slate-300 focus:outline-none"
                              placeholder="e.g. Living Room"
                            />
                          </td>
                          <td className="py-4 px-4 text-right">
                            {hasChanges && (
                              <button
                                disabled={isPending}
                                onClick={() => saveFfeEdits(ffe.id)}
                                className="bg-slate-900 text-white font-sans text-xs font-semibold rounded-[var(--ui-radius-action)] px-2.5 py-1.5 hover:bg-slate-800 transition-colors disabled:opacity-50"
                              >
                                Save
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
