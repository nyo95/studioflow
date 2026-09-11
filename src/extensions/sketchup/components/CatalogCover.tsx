import React from "react";

/**
 * Full-bleed cover page for the exported catalog / material schedule PDF.
 * Print-only: hidden in the on-screen preview, rendered as the first A4-landscape
 * page (297 × 210mm) when printing.
 */
export function CatalogCover({
  title,
  subtitle,
  exportDate,
}: {
  title: string;
  subtitle?: string | null;
  exportDate: string;
}) {
  return (
    <div
      className="catalog-cover"
      style={{
        position: "relative",
        width: "100%",
        height: "var(--catalog-cover-print-height, var(--ui-render-print-page-height, 210mm))",
        background: "#fff",
        color: "#0f172a",
        overflow: "hidden",
        fontFamily: "Helvetica, 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {/* RAD logo — top right (black wordmark on white). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/rad.png"
        alt="RAD"
        style={{ position: "absolute", top: "13mm", right: "15mm", width: "40mm", height: "auto" }}
      />

      {/* Title block — left, around the lower-middle. */}
      <div style={{ position: "absolute", left: "16mm", top: "52%", transform: "translateY(-50%)", maxWidth: "72%" }}>
        <div
          style={{
            fontSize: "34pt",
            fontWeight: 700,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            lineHeight: 1.02,
            color: "#0f172a",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              marginTop: "6mm",
              fontSize: "12pt",
              fontWeight: 600,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "#475569",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {/* Bottom-left: Material Schedule label */}
      <div
        style={{
          position: "absolute",
          left: "16mm",
          bottom: "13mm",
          fontSize: "10pt",
          fontWeight: 600,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: "#334155",
        }}
      >
        Material Schedule
      </div>

      {/* Bottom-right: export date */}
      <div
        style={{
          position: "absolute",
          right: "16mm",
          bottom: "13mm",
          fontSize: "9pt",
          fontWeight: 600,
          letterSpacing: "0.24em",
          color: "#334155",
        }}
      >
        {exportDate}
      </div>
    </div>
  );
}
