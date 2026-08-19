import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSION } from "@/core/rbac/rbac";
import { getProjectCatalogDocument, type CatalogItem } from "@/extensions/sketchup/actions/sketchup-actions";
import { resolveCategoryLabel } from "@/extensions/schedule/lib/category-labels";
import { formatMaterialInitialsType } from "@/extensions/sketchup/utils/material-list-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Office "Material List" sheet columns (A..H).
const COLUMNS = ["CODE", "MATERIAL TYPE", "EX", "TYPE", "INITIALS TYPE", "IMAGE", "LOCATION", "CONTACT"];
const COL_WIDTHS = [14, 22, 10, 42, 18, 24, 18, 18]; // char widths
const IMAGE_COL = 6; // 1-based column F
const ROW_H = 118; // material row height (pts) — tall enough for a photo
const IMG_BOX = { w: 150, h: 150 }; // px box the photo is fitted into

// Read the intrinsic pixel size of a PNG/JPEG buffer so the embedded image
// keeps its aspect ratio inside the IMAGE box (exceljs stretches otherwise).
function imageSize(buf: Buffer): { w: number; h: number } | null {
  // PNG
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  // JPEG — scan SOF markers
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off < buf.length) {
      if (buf[off] !== 0xff) { off++; continue; }
      const marker = buf[off + 1];
      // SOF0..SOF15 (excluding DHT/DAC/RST/SOI/EOI) carry dimensions
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const h = buf.readUInt16BE(off + 5);
        const w = buf.readUInt16BE(off + 7);
        return { w, h };
      }
      const len = buf.readUInt16BE(off + 2);
      off += 2 + len;
    }
  }
  return null;
}

async function loadImage(url: string): Promise<{ buffer: Buffer; ext: "png" | "jpeg" } | null> {
  try {
    let buf: Buffer;
    if (/^https?:\/\//i.test(url)) {
      const res = await fetch(url);
      if (!res.ok) return null;
      buf = Buffer.from(await res.arrayBuffer());
    } else {
      // Local /uploads/... served from /public
      const clean = url.split("?")[0].replace(/^\//, "");
      const full = path.resolve(process.cwd(), "public", clean);
      buf = await readFile(full);
    }
    const isPng = buf.length > 4 && buf[0] === 0x89 && buf[1] === 0x50;
    return { buffer: buf, ext: isPng ? "png" : "jpeg" };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, role } = await getSession();
  // Export mirrors the board's read access: any VIEW-permission role may
  // export any project's schedule (viewing ≠ editing; membership is only
  // required for mutations).
  if (!userId || !hasPermission(role, PERMISSION.PLUGIN_SCHEDULE_VIEW)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      project_code: true,
      name: true,
      address: true,
      client_contact: true,
      client: { select: { name: true } },
    },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const doc = await getProjectCatalogDocument(id);

  // Group materials by code prefix, ordered by the canonical category sequence.
  const CANON_ORDER = ["PT", "SPR", "WD", "PL", "SO", "ST", "TER", "CT", "HT", "GL", "MT", "ACR", "F", "MSC"];
  const groups = new Map<string, CatalogItem[]>();
  for (const m of doc.materials) {
    const prefix = m.code.split("-")[0].toUpperCase();
    const arr = groups.get(prefix);
    if (arr) arr.push(m);
    else groups.set(prefix, [m]);
  }
  const orderedPrefixes = Array.from(groups.keys()).sort((a, b) => {
    const ia = CANON_ORDER.indexOf(a);
    const ib = CANON_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b);
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "StudioFlow";
  const ws = wb.addWorksheet("Material List", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  COL_WIDTHS.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const thin: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FF000000" } };
  const box = { top: thin, left: thin, bottom: thin, right: thin };

  // ── Header block ─────────────────────────────────────────────
  ws.getCell("A1").value = "MATERIAL LIST";
  ws.getCell("A1").font = { bold: true, size: 14 };
  const headerPairs: [string, string][] = [
    ["Project Name", project.name || project.project_code || ""],
    ["Client", project.client?.name || ""],
    ["Contact", project.client_contact || ""],
    ["Address", project.address || ""],
  ];
  headerPairs.forEach(([label, value], i) => {
    const r = 3 + i;
    ws.getCell(`A${r}`).value = label;
    ws.getCell(`A${r}`).font = { bold: false };
    ws.getCell(`B${r}`).value = value;
  });

  // ── Column header row (row 8) ────────────────────────────────
  const HEAD_ROW = 8;
  const headRow = ws.getRow(HEAD_ROW);
  COLUMNS.forEach((c, i) => {
    const cell = headRow.getCell(i + 1);
    cell.value = c;
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEDED" } };
    cell.border = box;
  });
  headRow.height = 22;

  // ── Category groups ──────────────────────────────────────────
  let r = HEAD_ROW + 2; // leave one spacer row (row 9)
  for (const prefix of orderedPrefixes) {
    const items = groups.get(prefix)!;
    const label = resolveCategoryLabel(prefix, null);

    // Banner row (merged A:H)
    ws.mergeCells(r, 1, r, COLUMNS.length);
    const banner = ws.getCell(r, 1);
    banner.value = label.toUpperCase();
    banner.font = { bold: true };
    banner.alignment = { vertical: "middle" };
    banner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F3F3" } };
    banner.border = box;
    ws.getRow(r).height = 20;
    r++;

    for (const item of items) {
      const row = ws.getRow(r);
      row.height = ROW_H;
      // A CODE
      const codeCell = row.getCell(1);
      codeCell.value = item.code;
      codeCell.alignment = { vertical: "top", horizontal: "left" };
      // B MATERIAL TYPE = category name
      row.getCell(2).value = label;
      // D TYPE = specific type
      row.getCell(4).value = item.type_label || "";
      // E INITIALS TYPE = Color / Pattern (Motif) / Texture (Finishing) / Size.
      row.getCell(5).value = formatMaterialInitialsType(item);
      // G LOCATION
      row.getCell(7).value = item.location || "";
      // C EX and H CONTACT remain blank for manual completion.

      // borders on all 8 cells + vertical alignment
      for (let c = 1; c <= COLUMNS.length; c++) {
        const cell = row.getCell(c);
        cell.border = box;
        if (!cell.alignment) cell.alignment = { vertical: "top", wrapText: true };
        else cell.alignment = { ...cell.alignment, wrapText: true };
      }

      // F IMAGE — embed the photo, fitted to keep aspect ratio.
      if (item.image_url) {
        const img = await loadImage(item.image_url);
        if (img) {
          const id2 = wb.addImage({ buffer: img.buffer as unknown as ExcelJS.Buffer, extension: img.ext });
          const dim = imageSize(img.buffer);
          let w = IMG_BOX.w;
          let h = IMG_BOX.h;
          if (dim && dim.w > 0 && dim.h > 0) {
            const scale = Math.min(IMG_BOX.w / dim.w, IMG_BOX.h / dim.h);
            w = Math.round(dim.w * scale);
            h = Math.round(dim.h * scale);
          }
          // Anchor near top-left of the IMAGE cell (col F, 0-based col 5).
          ws.addImage(id2, {
            tl: { col: IMAGE_COL - 1 + 0.1, row: r - 1 + 0.08 } as ExcelJS.Anchor,
            ext: { width: w, height: h },
            editAs: "oneCell",
          });
        }
      }
      r++;
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const safeName = (project.project_code || project.name || "material-list").replace(/[^\w.-]+/g, "_");
  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeName}_MaterialList.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
