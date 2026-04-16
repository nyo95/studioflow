import { Clock3, Library, ListTodo, type LucideIcon } from "lucide-react";

export type Extension = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  enabled: boolean;
};

function isEnabled(rawValue: string | undefined, fallback = true) {
  if (!rawValue) return fallback;
  return rawValue.toLowerCase() !== "false";
}

export const EXTENSIONS: Extension[] = [
  // for extension: library //
  {
    id: "library",
    label: "Library",
    icon: Library,
    href: "/extensions/library",
    enabled: isEnabled(process.env.NEXT_PUBLIC_ENABLE_LIBRARY, true),
  },
  // for extension: timeline //
  {
    id: "timeline",
    label: "Timeline",
    icon: Clock3,
    href: "/timeline",
    enabled: isEnabled(process.env.NEXT_PUBLIC_ENABLE_TIMELINE, false),
  },
  // for extension: upcoming //
  {
    id: "upcoming",
    label: "Upcoming",
    icon: ListTodo,
    href: "/upcoming",
    enabled: isEnabled(process.env.NEXT_PUBLIC_ENABLE_UPCOMING, false),
  },
];
