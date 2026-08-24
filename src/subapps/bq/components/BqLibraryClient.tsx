"use client";

/**
 * BQ Library — client component with tabs for Objects and Sub-objects.
 */

import * as React from "react";
import { BookOpen, FolderOpen, Trash2 } from "lucide-react";
import {
  Button,
  DashboardTemplate,
  PageHeader,
  SectionCard,
} from "@/ui_engine";
import { UI_ENGINE_TYPE_META } from "@/ui_engine/tokens";
import { cn } from "@/lib/utils";
import type {
  BqLibraryObjectRow,
  BqLibrarySubObjectRow,
} from "../services/library-service";

type Tab = "OBJECTS" | "SUB_OBJECTS";

export function BqLibraryClient({
  initialObjects,
  initialSubObjects,
  canEdit,
}: {
  initialObjects: BqLibraryObjectRow[];
  initialSubObjects: BqLibrarySubObjectRow[];
  canEdit: boolean;
}) {
  const [tab, setTab] = React.useState<Tab>("OBJECTS");

  return (
    <DashboardTemplate
      header={
        <PageHeader
          eyebrow="BQ"
          title="Library"
          description="Saved fixture recipes. Call them from any BQ project."
        />
      }
      content={
        <>
          <div className="flex gap-1 border-b border-slate-200 mb-4">
            <button
              type="button"
              onClick={() => setTab("OBJECTS")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                tab === "OBJECTS"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              <FolderOpen className="h-4 w-4" />
              Objects
              <span className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>
                {initialObjects.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab("SUB_OBJECTS")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                tab === "SUB_OBJECTS"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              <BookOpen className="h-4 w-4" />
              Sub-objects
              <span className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>
                {initialSubObjects.length}
              </span>
            </button>
          </div>

          {tab === "OBJECTS" ? (
            <ObjectsTab objects={initialObjects} canEdit={canEdit} />
          ) : (
            <SubObjectsTab subObjects={initialSubObjects} canEdit={canEdit} />
          )}
        </>
      }
    />
  );
}

function ObjectsTab({
  objects,
  canEdit,
}: {
  objects: BqLibraryObjectRow[];
  canEdit: boolean;
}) {
  if (objects.length === 0) {
    return (
      <SectionCard padding="lg">
        <div className="text-center">
          <FolderOpen className="mx-auto h-8 w-8 text-slate-300" />
          <p className={cn(UI_ENGINE_TYPE_META, "mt-2 text-slate-400")}>
            No library objects yet. Save an object from a BQ breakdown.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard padding="none">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100 text-left">
            <th className="px-4 py-2.5 font-sans text-xs font-medium text-slate-500">Name</th>
            <th className="px-4 py-2.5 font-sans text-xs font-medium text-slate-500">Unit</th>
            <th className="px-4 py-2.5 font-sans text-xs font-medium text-slate-500">Markup</th>
            <th className="px-4 py-2.5 font-sans text-xs font-medium text-slate-500">Sub-objs</th>
            <th className="px-4 py-2.5 font-sans text-xs font-medium text-slate-500">Lines</th>
            <th className="px-4 py-2.5 font-sans text-xs font-medium text-slate-500">Created</th>
            {canEdit && <th className="px-4 py-2.5" />}
          </tr>
        </thead>
        <tbody>
          {objects.map((obj) => (
            <tr
              key={obj.id}
              className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50"
            >
              <td className="px-4 py-3">
                <span className="font-sans text-sm font-medium text-slate-900">{obj.name}</span>
                {obj.code && (
                  <span className={cn(UI_ENGINE_TYPE_META, "ml-2 text-slate-400")}>{obj.code}</span>
                )}
              </td>
              <td className={cn(UI_ENGINE_TYPE_META, "px-4 py-3 text-slate-500")}>{obj.unit}</td>
              <td className={cn(UI_ENGINE_TYPE_META, "px-4 py-3 text-slate-500")}>
                {Math.round(obj.markupPct * 100)}%
              </td>
              <td className={cn(UI_ENGINE_TYPE_META, "px-4 py-3 text-slate-500")}>
                {obj.subObjectCount}
              </td>
              <td className={cn(UI_ENGINE_TYPE_META, "px-4 py-3 text-slate-500")}>
                {obj.materialLineCount + obj.serviceLineCount}
              </td>
              <td className={cn(UI_ENGINE_TYPE_META, "px-4 py-3 text-slate-500")}>
                {obj.createdBy ?? "—"}
              </td>
              {canEdit && (
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" className="h-7 text-slate-400 hover:text-red-600">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
}

function SubObjectsTab({
  subObjects,
  canEdit,
}: {
  subObjects: BqLibrarySubObjectRow[];
  canEdit: boolean;
}) {
  if (subObjects.length === 0) {
    return (
      <SectionCard padding="lg">
        <div className="text-center">
          <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
          <p className={cn(UI_ENGINE_TYPE_META, "mt-2 text-slate-400")}>
            No library sub-objects yet. Save a sub-object from a BQ breakdown.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard padding="none">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100 text-left">
            <th className="px-4 py-2.5 font-sans text-xs font-medium text-slate-500">Name</th>
            <th className="px-4 py-2.5 font-sans text-xs font-medium text-slate-500">Qty</th>
            <th className="px-4 py-2.5 font-sans text-xs font-medium text-slate-500">Materials</th>
            <th className="px-4 py-2.5 font-sans text-xs font-medium text-slate-500">Services</th>
            <th className="px-4 py-2.5 font-sans text-xs font-medium text-slate-500">Created</th>
            {canEdit && <th className="px-4 py-2.5" />}
          </tr>
        </thead>
        <tbody>
          {subObjects.map((sub) => (
            <tr
              key={sub.id}
              className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50"
            >
              <td className="px-4 py-3">
                <span className="font-sans text-sm font-medium text-slate-900">{sub.name}</span>
              </td>
              <td className={cn(UI_ENGINE_TYPE_META, "px-4 py-3 text-slate-500")}>
                {sub.qty}
              </td>
              <td className={cn(UI_ENGINE_TYPE_META, "px-4 py-3 text-slate-500")}>
                {sub.materialLineCount}
              </td>
              <td className={cn(UI_ENGINE_TYPE_META, "px-4 py-3 text-slate-500")}>
                {sub.serviceLineCount}
              </td>
              <td className={cn(UI_ENGINE_TYPE_META, "px-4 py-3 text-slate-500")}>
                {sub.createdBy ?? "—"}
              </td>
              {canEdit && (
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" className="h-7 text-slate-400 hover:text-red-600">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
}
