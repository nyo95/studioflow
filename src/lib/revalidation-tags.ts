export const REVALIDATE_HOME = "home";
export const REVALIDATE_HOME_LAYOUT = "homeLayout";
export const REVALIDATE_ACTIVITY = "activity";
export const REVALIDATE_SETTINGS = "settings";
export const REVALIDATE_TODAY = "today";
export const REVALIDATE_PROJECT = "project";
export const REVALIDATE_LIBRARY = "library";
export const REVALIDATE_CUSTOM = "custom";

export const REVALIDATION_PATHS = {
  [REVALIDATE_HOME]: [{ path: "/" }],
  [REVALIDATE_HOME_LAYOUT]: [{ path: "/", type: "layout" as const }],
  [REVALIDATE_ACTIVITY]: [{ path: "/activity" }],
  [REVALIDATE_LIBRARY]: [
    { path: "/extensions/library" },
    { path: "/library" },
  ],
  [REVALIDATE_SETTINGS]: [
    { path: "/settings" },
    { path: "/settings/profile" },
    { path: "/settings/studio" },
    { path: "/settings/clients" },
  ],
  [REVALIDATE_TODAY]: [{ path: "/today" }],
} as const;
