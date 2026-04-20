"use client";

import React from "react";

interface ScheduleTableHeaderProps {
  isFixture?: boolean;
}

export function ScheduleTableHeader({ isFixture = false }: ScheduleTableHeaderProps) {
  return (
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        <th className="px-5 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[90px]">
          Code
        </th>
        <th className="px-5 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Product Details
        </th>
        <th className="px-5 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[160px]">
          Location
        </th>
        {isFixture && (
          <th className="px-5 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[90px]">
            Qty
          </th>
        )}
        <th className="px-5 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[90px]">
          Actions
        </th>
      </tr>
    </thead>
  );
}
