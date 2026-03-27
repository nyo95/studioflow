import { Clock3, Library, ListTodo, type LucideIcon } from "lucide-react";

export type Extension = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  enabled: boolean;
};

export const EXTENSIONS: Extension[] = [
  // for extension: library //
  {
    id: "library",
    label: "Library",
    icon: Library,
    href: "/library",
    enabled: false,
  },
  // for extension: timeline //
  {
    id: "timeline",
    label: "Timeline",
    icon: Clock3,
    href: "/timeline",
    enabled: false,
  },
  // for extension: upcoming //
  {
    id: "upcoming",
    label: "Upcoming",
    icon: ListTodo,
    href: "/upcoming",
    enabled: false,
  },
];
