"use client";
import { useSyncExternalStore } from "react";

/**
 * Hook to check if component has mounted (client-side only)
 */
function useHasMounted(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
}

/**
 * HydrationGuard ensures children only render on the client side
 * to prevent hydration mismatches with server-rendered content
 */
export function HydrationGuard({ children }: { children: React.ReactNode }) {
  const isMounted = useHasMounted();
  
  if (!isMounted) {
    return null;
  }
  
  return <>{children}</>;
}
