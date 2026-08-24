/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import { formatDateWithOptions } from "@/core/utilities/datetime";

type MomListStyle = "decimal" | "disc" | "dash" | "none";

interface MomPrintViewProps {
  projectName: string;
  clientName: string | null;
  document: {
    mom_topic: string;
    mom_date: string;
    mom_venue: string | null;
    mom_attendees: string | null;
    mom_prepared_by_name: string;
    mom_items: {
      id: string;
      is_text_only: boolean;
      list_style: MomListStyle;
      mom_points: {
        id: string;
        text: string;
      }[];
      mom_images: {
        id: string;
        sort_order: number;
        file_url: string;
      }[];
    }[];
  };
}

function displayPointPrefix(listStyle: MomListStyle, index: number) {
  switch (listStyle) {
    case "disc":
      return "•";
    case "dash":
      return "-";
    case "none":
      return "";
    default:
      return `${index + 1}.`;
  }
}

export function MomPrintView({ projectName, clientName, document }: MomPrintViewProps) {
  return (
    <div className="mx-auto w-full max-w-[210mm] bg-white px-12 py-10 text-black print:max-w-none print:px-8 print:py-8">
      <div className="mb-8 flex items-start justify-between border-b-[3px] border-black pb-5">
        <div>
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Project MOM</p>
          <h1 className="mt-2 font-serif text-4xl font-bold uppercase tracking-tight">{document.mom_topic}</h1>
          <p className="mt-2 font-sans text-sm text-slate-600">{projectName}</p>
          {clientName ? <p className="font-sans text-xs uppercase tracking-[0.16em] text-slate-400">{clientName}</p> : null}
        </div>
        <div className="text-right">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Date</p>
          <p className="mt-1 font-sans text-sm font-semibold">
            {formatDateWithOptions(document.mom_date, {
              locale: "id-ID",
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-6 border-b border-black py-3">
        <div>
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Venue</p>
          <p className="mt-1 font-sans text-sm">{document.mom_venue || "-"}</p>
        </div>
        <div>
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Attendees</p>
          <p className="mt-1 whitespace-pre-wrap font-sans text-sm">{document.mom_attendees || "-"}</p>
        </div>
        <div>
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Prepared By</p>
          <p className="mt-1 font-sans text-sm font-semibold uppercase">{document.mom_prepared_by_name}</p>
        </div>
      </div>

      <div className="space-y-6">
        {document.mom_items.map((item, itemIndex) => (
          <div key={item.id} className="break-inside-avoid border-b border-slate-300 pb-6">
            <div className={`grid gap-4 ${item.is_text_only ? "grid-cols-1" : item.mom_images.length >= 2 ? "grid-cols-[1fr_1fr_1.3fr]" : "grid-cols-[1fr_1.6fr]"}`}>
              {!item.is_text_only && (
                <>
                  <div className="space-y-3">
                    {item.mom_images[0] ? (
                      <img src={item.mom_images[0].file_url} alt={`Section ${itemIndex + 1} image 1`} className="h-auto w-full border border-slate-200 object-cover" />
                    ) : (
                      <div className="aspect-[4/3] border border-dashed border-slate-200 bg-slate-50" />
                    )}
                  </div>
                  {item.mom_images.length >= 2 ? (
                    <div className="space-y-3">
                      <img src={item.mom_images[1].file_url} alt={`Section ${itemIndex + 1} image 2`} className="h-auto w-full border border-slate-200 object-cover" />
                    </div>
                  ) : null}
                </>
              )}

              <div>
                <p className="mb-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Section {String(itemIndex + 1).padStart(2, "0")}
                </p>
                <div className="space-y-2">
                  {item.mom_points.map((point, pointIndex) => (
                    <div key={point.id} className="flex gap-2">
                      {item.list_style !== "none" ? (
                        <span className="w-6 shrink-0 font-sans text-sm font-semibold text-slate-700">
                          {displayPointPrefix(item.list_style, pointIndex)}
                        </span>
                      ) : null}
                      <p className="whitespace-pre-wrap font-sans text-sm leading-6 text-slate-900">{point.text || "-"}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 border-t border-black pt-3">
        <div className="flex justify-between">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Internal Document</p>
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">StudioFlow MOM</p>
        </div>
      </div>
    </div>
  );
}
