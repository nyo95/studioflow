import type { UISettings, UISettingsStyle } from "@/types/common";

export type { UISettings } from "@/types/common";

const DEFAULT_UI_SETTINGS: UISettings = {
  canvasBg: "rgb(248 250 252)",
  radiusCard: "1.5rem",
  sectionPx: "1.5rem",
  sectionPy: "1.5rem",
  rowPaddingY: "1rem",
  sidebarWidth: "272px",
  containerMaxWidth: "1280px",
  fontSerif: "var(--font-serif-base)",
  fontSans: "var(--font-sans-base)",
  pagePaddingY: "2.5rem",
  pageMaxWidth: "1280px",
  tableDensity: "compact", // default to compact for rows
  modalDensity: "standard", // default modal padding
  radiusControl: "0.5rem",
  radiusAction: "0.25rem",
};

export function sanitizeUISettings(input?: UISettings | null): UISettings {
  const sanitizedInput = !input
    ? {}
    : Object.fromEntries(
        Object.entries(input).filter(([, value]) => typeof value === "string" && value.trim().length > 0)
      );

  return {
    ...DEFAULT_UI_SETTINGS,
    ...sanitizedInput,
  };
}

export function uiSettingsToStyle(settings: UISettings): UISettingsStyle {
  const style: UISettingsStyle = {};

  const variableMap: Array<[keyof UISettings, `--${string}`]> = [
    ["canvasBg", "--ui-canvas-bg"],
    ["radiusCard", "--ui-radius-card"],
    ["sectionPx", "--ui-section-px"],
    ["sectionPy", "--ui-section-py"],
    ["rowPaddingY", "--ui-row-padding-y"],
    ["sidebarWidth", "--ui-sidebar-width"],
    ["containerMaxWidth", "--ui-container-max-width"],
    ["fontSerif", "--ui-font-serif"],
    ["fontSans", "--ui-font-sans"],
    ["pagePaddingY", "--ui-page-padding-y"],
    ["pageMaxWidth", "--ui-page-max-width"],
    ["tableDensity", "--ui-table-density"],
    ["modalDensity", "--ui-modal-density"],
    ["radiusControl", "--ui-radius-control"],
    ["radiusAction", "--ui-radius-action"],
  ];

  for (const [key, variableName] of variableMap) {
    const value = settings[key];
    if (value) {
      style[variableName] = value;
    }
  }

  style["--ui-sidebar-rail-width"] = "78px";
  style["--ui-surface-shadow"] = "0 18px 45px -30px rgba(15, 23, 42, 0.22)";
  style["--ui-dialog-width-sm"] = "420px";
  style["--ui-dialog-width-md"] = "560px";
  style["--ui-dialog-width-lg"] = "760px";
  style["--ui-dialog-width-xl"] = "980px";
  style["--ui-dialog-width-full"] = "1180px";

  return style;
}
