"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCDItem,
  updateCDItem,
  updateCDStatus,
  deleteCDItem
} from "@/actions/phase-actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDownAZ, ArrowUpAZ, Loader2, Plus, Trash2 } from "lucide-react";
import { Role } from "@/generated/prisma";
import { 
  SectionCard, 
  TableCard, 
  TableCardHeader, 
  TableCardHead, 
  TableCardBody, 
  TableCardRow, 
  TableCardCell,
  Heading
} from "@/ui_engine";
import { unwrapActionResult } from "@/lib/result";

interface CDItem {
  id: string;
  group_code: string;
  drawing_name: string;
  status_enum: string;
  assigned_to_id: string | null;
}

interface CDListTableProps {
  phaseId: string;
  items: CDItem[];
  userRole: Role;
  userId: string;
  canMutate: boolean;
}

function normalizeDrawingCode(value: string) {
  const numericCode = extractNumericCode(value);
  return numericCode ? `ID_${numericCode}` : "ID_";
}

function extractNumericCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/^ARS[_\-\s]*/i, "")
    .replace(/^ID[_\-\s]*/i, "")
    .trim();
}

function parseDrawingNumber(value: string) {
  const numericCode = extractNumericCode(value);
  if (!numericCode || !/^\d+(\.\d+)?$/.test(numericCode)) {
    return null;
  }

  const [wholePart, decimalPart = ""] = numericCode.split(".");
  const wholeNumber = Number(wholePart);
  const decimalNumber = decimalPart === "" ? 0 : Number(`0.${decimalPart}`);

  if (Number.isNaN(wholeNumber) || Number.isNaN(decimalNumber)) {
    return null;
  }

  return wholeNumber + decimalNumber;
}

function extractGroup(value: string) {
  const drawingNumber = parseDrawingNumber(value);
  if (drawingNumber === null) {
    return "-";
  }

  return String(Math.floor(drawingNumber / 100) * 100);
}

function compareDrawingCodes(left: string, right: string) {
  const leftCode = extractNumericCode(left);
  const rightCode = extractNumericCode(right);
  const leftParts = leftCode.split(".");
  const rightParts = rightCode.split(".");
  const leftWhole = Number(leftParts[0] || 0);
  const rightWhole = Number(rightParts[0] || 0);

  if (leftWhole !== rightWhole) {
    return leftWhole - rightWhole;
  }

  const leftDecimal = leftParts[1] ? Number(leftParts[1]) : -1;
  const rightDecimal = rightParts[1] ? Number(rightParts[1]) : -1;
  return leftDecimal - rightDecimal;
}

function buildGroupedRows(items: CDItem[]) {
  const groups = new Map<string, CDItem[]>();

  for (const item of items) {
    const group = extractGroup(item.group_code);
    const existing = groups.get(group) ?? [];
    existing.push(item);
    groups.set(group, existing);
  }

  return [...groups.entries()]
    .sort((left, right) => Number(left[0]) - Number(right[0]))
    .map(([group, groupedItems]) => ({
      group,
      items: groupedItems.sort((left, right) => compareDrawingCodes(left.group_code, right.group_code)),
    }));
}

export function CDListTable({
  phaseId,
  items,
  canMutate,
}: CDListTableProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftCode, setDraftCode] = useState("");
  const [draftName, setDraftName] = useState("");
  const [sortBy, setSortBy] = useState<"drawing_code" | "group">("drawing_code");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const router = useRouter();

  const isEditable = canMutate;

  const sortedItems = useMemo(() => {
    return [...items].sort((left, right) => {
      const comparison =
        sortBy === "drawing_code"
          ? compareDrawingCodes(left.group_code, right.group_code)
          : Number(extractGroup(left.group_code)) - Number(extractGroup(right.group_code)) ||
            compareDrawingCodes(left.group_code, right.group_code);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [items, sortBy, sortDirection]);

  const groupedRows = useMemo(() => {
    const baseItems = sortDirection === "asc" ? sortedItems : [...sortedItems].reverse();
    const grouped = buildGroupedRows(baseItems);
    return sortDirection === "asc" ? grouped : [...grouped].reverse();
  }, [sortedItems, sortDirection]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim() || !isEditable) return;

    setLoading("creating");
    try {
      unwrapActionResult(await createCDItem({ phaseId, data: { group_code: newCode, drawing_name: newName } }));
      setNewCode("");
      setNewName("");
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    setLoading(id);
    try {
      unwrapActionResult(await updateCDStatus({ itemId: id, status }));
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this drawing?")) return;
    setLoading(id);
    try {
      unwrapActionResult(await deleteCDItem({ itemId: id }));
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  const beginEdit = (item: CDItem) => {
    setEditingId(item.id);
    setDraftCode(extractNumericCode(item.group_code));
    setDraftName(item.drawing_name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftCode("");
    setDraftName("");
  };

  const handleSaveEdit = async (id: string) => {
    if (!draftCode.trim() || !draftName.trim()) return;
    setLoading(`edit-${id}`);
    try {
      unwrapActionResult(await updateCDItem({ itemId: id, data: { group_code: draftCode, drawing_name: draftName } }));
      cancelEdit();
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <SectionCard
      header={
        <div className="flex w-full flex-col gap-4 md:flex-row md:items-start md:justify-between py-2">
          <div>
            <Heading level={3} className="uppercase">Construction Drawing List</Heading>
            <p className="mt-1 text-xs text-slate-500">
              Enter only the drawing number. StudioFlow stores it automatically as <span className="font-mono">ID_[number]</span>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as "drawing_code" | "group")}>
              <SelectTrigger className="h-9 w-[180px] border-slate-200 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="drawing_code">Sort by Drawing Code</SelectItem>
                <SelectItem value="group">Sort by Group</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
              className="h-9 w-9 border-slate-200 text-slate-500"
            >
              {sortDirection === "asc" ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-8">
        {isEditable && (
          <form onSubmit={handleCreate} className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-6 md:grid-cols-[180px_minmax(0,1fr)_auto]">
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Drawing Code</p>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-2.5 font-mono text-xs text-slate-400">ID_</span>
                <Input
                  placeholder="e.g. 100.1"
                  value={newCode}
                  onChange={(e) => setNewCode(extractNumericCode(e.target.value))}
                  className="h-9 border-slate-200 pl-10 font-mono text-xs focus-visible:ring-slate-200"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Drawing Name</p>
              <Input
                placeholder="Reflected Ceiling Plan"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-9 border-slate-200 text-xs focus-visible:ring-slate-200"
              />
            </div>
            <div className="flex items-end">
              <Button disabled={loading === "creating"} size="sm" className="bg-slate-900 h-9 font-sans text-xs px-6 hover:bg-slate-800 transition-colors">
                {loading === "creating" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 mr-1.5" />}
                Add Drawing
              </Button>
            </div>
          </form>
        )}

        <TableCard>
          <TableCardHeader>
            <TableCardHead className="w-28">Group</TableCardHead>
            <TableCardHead className="w-40">Drawing Code</TableCardHead>
            <TableCardHead>Drawing Name</TableCardHead>
            <TableCardHead className="w-48">Status</TableCardHead>
            <TableCardHead className="w-28 align-right"></TableCardHead>
          </TableCardHeader>
          <TableCardBody>
            {groupedRows.length === 0 ? (
              <TableCardRow>
                <TableCardCell colSpan={5} className="text-center py-20 text-slate-400 font-sans italic text-sm">
                  No drawings listed for this phase.
                </TableCardCell>
              </TableCardRow>
            ) : (
              groupedRows.flatMap((grouped) => [
                <TableCardRow key={`group-${grouped.group}`} className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableCardCell colSpan={5} className="py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    {`Group ${grouped.group}`}
                  </TableCardCell>
                </TableCardRow>,
                ...grouped.items.map((item) => (
                  <TableCardRow key={item.id} className="group">
                    <TableCardCell className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {extractGroup(item.group_code)}
                    </TableCardCell>
                    <TableCardCell className="font-mono text-xs font-bold text-slate-600">
                      {editingId === item.id ? (
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-2.5 font-mono text-xs text-slate-400">ID_</span>
                          <Input
                            value={draftCode}
                            onChange={(e) => setDraftCode(extractNumericCode(e.target.value))}
                            className="h-8 border-slate-200 pl-10 font-mono text-xs"
                          />
                        </div>
                      ) : (
                        normalizeDrawingCode(item.group_code)
                      )}
                    </TableCardCell>
                    <TableCardCell className="font-sans text-sm font-medium text-slate-900">
                      {editingId === item.id ? (
                        <Input
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          className="h-8 text-sm border-slate-200"
                        />
                      ) : (
                        `${normalizeDrawingCode(item.group_code)} - ${item.drawing_name}`
                      )}
                    </TableCardCell>
                    <TableCardCell>
                      <Select
                        disabled={!isEditable || loading === item.id || loading === `edit-${item.id}` || editingId === item.id}
                        defaultValue={item.status_enum}
                        onValueChange={(val) => handleUpdateStatus(item.id, val)}
                      >
                        <SelectTrigger className="h-8 text-xs font-medium border-slate-200 focus:ring-0 shadow-none bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent side="top">
                          <SelectItem value="PENDING">PENDING</SelectItem>
                          <SelectItem value="ON_PROGRESS">ON PROGRESS</SelectItem>
                          <SelectItem value="DELIVERED">DELIVERED</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCardCell>
                    <TableCardCell align="right">
                      {isEditable && (
                        <div className="flex items-center justify-end gap-1 opacity-0 transition-all group-hover:opacity-100">
                          {editingId === item.id ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={() => handleSaveEdit(item.id)}
                                disabled={loading === `edit-${item.id}`}
                                className="h-8 border-slate-200 text-xs px-3"
                              >
                                {loading === `edit-${item.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                onClick={cancelEdit}
                                className="h-8 text-xs text-slate-500"
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                onClick={() => beginEdit(item)}
                                disabled={loading === item.id}
                                className="h-8 px-2 text-xs text-slate-400 hover:text-slate-900"
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                disabled={loading === item.id}
                                className="h-8 w-8 text-slate-300 hover:text-red-500"
                              >
                                {loading === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </TableCardCell>
                  </TableCardRow>
                )),
              ])
            )}
          </TableCardBody>
        </TableCard>
      </div>
    </SectionCard>
  );
}
