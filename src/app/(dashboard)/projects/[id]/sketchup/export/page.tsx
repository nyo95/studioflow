import { getProjectScheduleDocument } from "@/extensions/sketchup/actions/sketchup-actions";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PrintButton } from "@/extensions/sketchup/components/PrintButton";

export default async function SketchupExportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      project_code: true,
      name: true,
    },
  });

  if (!project) notFound();

  // Fetch the resolved schedule document data
  const doc = await getProjectScheduleDocument(id);

  return (
    <div className="bg-white min-h-screen">
      {/* Styles to cleanly override sidebar layout when printing */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Hiding layout elements */
          header, nav, footer, button, .no-print, [role="button"] {
            display: none !important;
          }
          
          /* Canvas reset to take full width and avoid margins/paddings from dashboard shell */
          body, html {
            background-color: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          main, div, .lg\\:pl-\\[78px\\], .lg\\:pr-6, .pt-16 {
            padding-left: 0 !important;
            padding-right: 0 !important;
            padding-top: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            position: static !important;
            overflow: visible !important;
            display: block !important;
          }

          .print-container {
            padding: 1.5cm !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }

          .page-break-before {
            page-break-before: always !important;
            margin-top: 2cm !important;
          }

          table {
            page-break-inside: avoid !important;
          }

          tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
        }
      `}} />

      {/* Browser Bar (hidden on print) */}
      <div className="no-print p-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <span className="font-serif font-bold text-lg text-slate-900">Print Preview</span>
          <span className="text-xs text-slate-500 font-sans px-2 py-0.5 bg-slate-100 rounded">
            Project: {project.project_code}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <PrintButton />
          <Link
            href={`/projects/${id}/sketchup`}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-[var(--ui-radius-action)] text-sm hover:bg-slate-50 font-medium transition-colors"
          >
            Back to Project
          </Link>
        </div>
      </div>

      {/* Print Content Wrapper */}
      <div className="print-container p-8 max-w-4xl mx-auto space-y-12">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-4">
          <h1 className="text-2xl font-serif font-bold text-slate-900 uppercase tracking-tight">
            PROJECT SPECIFICATION DOCUMENT
          </h1>
          <div className="mt-2 text-sm font-sans text-slate-600 flex justify-between">
            <span>Project: {project.project_code} — {project.name}</span>
            <span>Date Generated: {new Date().toLocaleDateString("id-ID")}</span>
          </div>
        </div>

        {/* Section 1: Material Schedule */}
        <div className="space-y-4">
          <h2 className="text-lg font-serif font-bold text-slate-800 uppercase tracking-wide border-b border-slate-300 pb-1">
            I. MATERIAL SCHEDULE
          </h2>
          <table className="w-full border-collapse border border-slate-300 text-sm font-sans">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                <th className="py-2 px-3 border border-slate-300 text-left" style={{ width: "8%" }}>CODE</th>
                <th className="py-2 px-3 border border-slate-300 text-left" style={{ width: "15%" }}>MATERIAL TYPE</th>
                <th className="py-2 px-3 border border-slate-300 text-left" style={{ width: "12%" }}>BRAND</th>
                <th className="py-2 px-3 border border-slate-300 text-left" style={{ width: "25%" }}>TYPE/SKU</th>
                <th className="py-2 px-3 border border-slate-300 text-center" style={{ width: "15%" }}>IMAGE</th>
                <th className="py-2 px-3 border border-slate-300 text-left" style={{ width: "25%" }}>LOCATION</th>
              </tr>
            </thead>
            <tbody>
              {doc.materials.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400 italic border border-slate-300">
                    No linked materials synced.
                  </td>
                </tr>
              ) : (
                doc.materials.map((mat) => (
                  <tr key={mat.code} className="border-b border-slate-200 hover:bg-slate-50/20">
                    <td className="py-2 px-3 border border-slate-300 font-mono font-bold text-slate-900">{mat.code}</td>
                    <td className="py-2 px-3 border border-slate-300 text-slate-700">{mat.material_type || "—"}</td>
                    <td className="py-2 px-3 border border-slate-300 text-slate-700">{mat.brand || "—"}</td>
                    <td className="py-2 px-3 border border-slate-300 text-slate-900">
                      {mat.is_initials ? (
                        <span className="italic text-slate-500">
                          {mat.type_sku || "—"}{" "}
                          <span className="text-[10px] font-semibold not-italic text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 ml-1">
                            (Initials)
                          </span>
                        </span>
                      ) : (
                        <span>{mat.type_sku || "—"}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 border border-slate-300 text-center">
                      {mat.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mat.image_url}
                          alt={mat.code}
                          className="h-12 w-auto max-w-full object-contain mx-auto print:h-10"
                        />
                      ) : (
                        <span className="text-slate-400 italic text-xs">No Image</span>
                      )}
                    </td>
                    <td className="py-2 px-3 border border-slate-300 text-slate-600">{mat.location || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Section 2: FF&E Schedule */}
        <div className="space-y-4 page-break-before">
          <h2 className="text-lg font-serif font-bold text-slate-800 uppercase tracking-wide border-b border-slate-300 pb-1">
            II. FF&E SCHEDULE
          </h2>
          <table className="w-full border-collapse border border-slate-300 text-sm font-sans">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                <th className="py-2 px-3 border border-slate-300 text-left" style={{ width: "8%" }}>CODE</th>
                <th className="py-2 px-3 border border-slate-300 text-left" style={{ width: "15%" }}>CATEGORY</th>
                <th className="py-2 px-3 border border-slate-300 text-left" style={{ width: "27%" }}>PRODUCT NAME</th>
                <th className="py-2 px-3 border border-slate-300 text-center" style={{ width: "8%" }}>QTY</th>
                <th className="py-2 px-3 border border-slate-300 text-left" style={{ width: "17%" }}>BRAND</th>
                <th className="py-2 px-3 border border-slate-300 text-left" style={{ width: "25%" }}>LOCATION</th>
              </tr>
            </thead>
            <tbody>
              {doc.ffes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400 italic border border-slate-300">
                    No FF&E components synced.
                  </td>
                </tr>
              ) : (
                doc.ffes.map((ffe) => (
                  <tr key={ffe.code} className="border-b border-slate-200 hover:bg-slate-50/20">
                    <td className="py-2 px-3 border border-slate-300 font-mono font-bold text-slate-900">{ffe.code}</td>
                    <td className="py-2 px-3 border border-slate-300 text-slate-700">{ffe.category || "—"}</td>
                    <td className="py-2 px-3 border border-slate-300 text-slate-900">{ffe.product_name || "—"}</td>
                    <td className="py-2 px-3 border border-slate-300 text-center font-semibold text-slate-800">
                      {ffe.qty} pcs
                    </td>
                    <td className="py-2 px-3 border border-slate-300 text-slate-700">{ffe.brand || "—"}</td>
                    <td className="py-2 px-3 border border-slate-300 text-slate-600">{ffe.location || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
