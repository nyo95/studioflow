import type { UISettings, UISettingsStyle } from "@/types/common";

export type { UISettings } from "@/types/common";

export function sanitizeUISettings(input?: UISettings | null): UISettings {
  if (!input) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => typeof value === "string" && value.trim().length > 0)
  );
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
    ["fontSerif", "--ui-font-serif"],
    ["fontSans", "--ui-font-sans"],
    ["pagePaddingY", "--ui-page-padding-y"],
    ["pageMaxWidth", "--ui-page-max-width"],
  ];

  for (const [key, variableName] of variableMap) {
    const value = settings[key];
    if (value) {
      style[variableName] = value;
    }
  }

  return style;
}
