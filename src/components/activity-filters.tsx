"use client";

import { Input, Checkbox, Button } from "@/ui_engine";

export interface ActivityFilterOption {
  id: string;
  label: string;
}

export interface ActivityFilterState {
  userIds: string[];
  actions: string[];
  phaseIds: string[];
  dateFrom: string;
  dateTo: string;
}

interface ActivityFiltersProps {
  users: ActivityFilterOption[];
  actions: ActivityFilterOption[];
  phases: ActivityFilterOption[];
  value: ActivityFilterState;
  onChange: (next: ActivityFilterState) => void;
}

interface MultiFilterProps {
  title: string;
  options: ActivityFilterOption[];
  selected: string[];
  onToggle: (id: string, checked: boolean) => void;
}

function MultiFilter({ title, options, selected, onToggle }: MultiFilterProps) {
  return (
    <details className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
        {title} {selected.length > 0 ? `(${selected.length})` : ""}
      </summary>
      <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
        {options.length === 0 ? (
          <p className="text-xs text-slate-400">No options</p>
        ) : (
          options.map((option) => {
            const checked = selected.includes(option.id);
            return (
              <label key={option.id} className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox checked={checked} onCheckedChange={(value) => onToggle(option.id, Boolean(value))} />
                <span className="line-clamp-1">{option.label}</span>
              </label>
            );
          })
        )}
      </div>
    </details>
  );
}

export function ActivityFilters({ users, actions, phases, value, onChange }: ActivityFiltersProps) {
  const toggle = (key: "userIds" | "actions" | "phaseIds", id: string, checked: boolean) => {
    const current = value[key];
    const next = checked ? [...current, id] : current.filter((item) => item !== id);
    onChange({ ...value, [key]: next });
  };

  function resetFilters() {
    onChange({
      userIds: [],
      actions: [],
      phaseIds: [],
      dateFrom: "",
      dateTo: "",
    });
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      <MultiFilter
        title="Orang"
        options={users}
        selected={value.userIds}
        onToggle={(id, checked) => toggle("userIds", id, checked)}
      />
      <MultiFilter
        title="Jenis Aktivitas"
        options={actions}
        selected={value.actions}
        onToggle={(id, checked) => toggle("actions", id, checked)}
      />
      <MultiFilter
        title="Tahap Proyek"
        options={phases}
        selected={value.phaseIds}
        onToggle={(id, checked) => toggle("phaseIds", id, checked)}
      />
      <Input
        type="date"
        value={value.dateFrom}
        onChange={(event) => onChange({ ...value, dateFrom: event.target.value })}
        aria-label="Tanggal awal"
      />
      <Input
        type="date"
        value={value.dateTo}
        onChange={(event) => onChange({ ...value, dateTo: event.target.value })}
        aria-label="Tanggal akhir"
      />
      <Button type="button" variant="outline" onClick={resetFilters} className="h-10">
        Reset
      </Button>
    </div>
  );
}
