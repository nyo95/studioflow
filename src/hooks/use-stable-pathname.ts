"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function useStablePathname() {
  const pathname = usePathname();
  const [stablePathname, setStablePathname] = useState("");

  useEffect(() => {
    setStablePathname(pathname);
  }, [pathname]);

  return stablePathname;
}
