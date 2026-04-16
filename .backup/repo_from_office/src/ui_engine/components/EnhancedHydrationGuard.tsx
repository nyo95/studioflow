/* ====================
   ENHANCED HYDRATION GUARD
   Purpose: Prevent and detect hydration mismatches
   ==================== */

"use client";

import React, { ReactNode, useEffect, useState, createContext, useContext } from "react";
import { useSyncExternalStore } from "react";

/**
 * Hook to check if component has mounted on the client side.
 * Uses useSyncExternalStore to avoid hydration warnings.
 * 
 * Returns false on server, true after client hydration.
 */
function useHasMounted(): boolean {
  return useSyncExternalStore(
    () => () => undefined, // No subscription needed
    () => true,             // Client: always true
    () => false             // Server: always false
  );
}

interface HydrationGuardProps {
  children: ReactNode;
  fallback?: ReactNode; // What to show during SSR
}

/**
 * HydrationGuard: Prevent hydration mismatches
 * 
 * Ensures children only render on client-side to avoid mismatches
 * with server-rendered HTML. Safe to use anywhere.
 * 
 * @example
 * // Wrap dynamic or time-dependent content
 * <HydrationGuard>
 *   <RelativeTimeComponent />
 * </HydrationGuard>
 */
export function HydrationGuard({ 
  children, 
  fallback = null
}: HydrationGuardProps) {
  const isMounted = useHasMounted();

  if (!isMounted) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}

/**
 * HydrationBoundary: Error boundary for hydration-specific issues
 * 
 * Catches hydration errors and logs them for debugging.
 * Falls back to null render if hydration fails.
 */
interface HydrationBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

export function HydrationBoundary({
  children,
  fallback = null,
  onError
}: HydrationBoundaryProps) {
  const [error, setError] = useState<Error | null>(null);
  const isMounted = useHasMounted();

  useEffect(() => {
    // Listen for hydration errors
    const handleError = (event: ErrorEvent) => {
      if (
        event.message.includes("hydration") ||
        event.message.includes("mismatch")
      ) {
        const error = new Error(event.message);
        setError(error);
        onError?.(error);
        console.warn("[Hydration Error]", event.message);
      }
    };

    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, [onError]);

  if (!isMounted) return fallback ? <>{fallback}</> : null;
  if (error) return fallback ? <>{fallback}</> : null;

  return <>{children}</>;
}

// Context for hydration warnings
interface HydrationContextType {
  warnings: string[];
  addWarning: (message: string) => void;
  clearWarnings: () => void;
}

const HydrationContext = createContext<HydrationContextType | undefined>(
  undefined
);

interface HydrationProviderProps {
  children: ReactNode;
}

/**
 * HydrationProvider: Global hydration monitoring
 * 
 * Wraps your app to track and log hydration issues.
 * Place in root layout.
 * 
 * @example
 * export default function RootLayout({ children }) {
 *   return (
 *     <HydrationProvider>
 *       {children}
 *     </HydrationProvider>
 *   );
 * }
 */
export function HydrationProvider({ children }: HydrationProviderProps) {
  const [warnings, setWarnings] = useState<string[]>([]);
  const MAX_WARNINGS = 10; // Limit to prevent memory leak

  useEffect(() => {
    // Only monitor in development or when explicitly enabled
    if (process.env.NODE_ENV !== "development") return;

    const originalWarn = console.warn;

    // Intercept hydration warnings
    console.warn = (...args: unknown[]) => {
      const message = String(args[0]);
      if (
        message.includes("hydration") ||
        message.includes("mismatch") ||
        message.includes("did not match")
      ) {
        setWarnings((prev) => {
          const newWarnings = [
            ...prev,
            `[${new Date().toISOString()}] ${message}`,
          ];
          // Keep only last MAX_WARNINGS to prevent unbounded growth
          return newWarnings.slice(-MAX_WARNINGS);
        });
        console.error("[HYDRATION WARNING DETECTED]", args);
      }
      originalWarn.apply(console, args as Parameters<typeof originalWarn>);
    };

    return () => {
      console.warn = originalWarn;
    };
  }, []);

  const value: HydrationContextType = {
    warnings,
    addWarning: (msg) => setWarnings((prev) => [...prev, msg]),
    clearWarnings: () => setWarnings([]),
  };

  return (
    <HydrationContext.Provider value={value}>
      {children}
    </HydrationContext.Provider>
  );
}

/**
 * useHydrationWarnings: Access global hydration warnings
 * 
 * @example
 * const { warnings } = useHydrationWarnings();
 * console.log("Hydration issues:", warnings);
 */
export function useHydrationWarnings() {
  const context = useContext(HydrationContext);

  if (context === undefined) {
    console.warn(
      "useHydrationWarnings must be used within HydrationProvider"
    );
    return {
      warnings: [],
      addWarning: () => {},
      clearWarnings: () => {},
    };
  }

  return context;
}

/**
 * DehydrationDebug: Component to display hydration status
 * 
 * Useful for development to verify hydration is working.
 * 
 * @example
 * {process.env.NODE_ENV === "development" && <DehydrationDebug />}
 */
export function DehydrationDebug() {
  const { warnings } = useHydrationWarnings();
  const isMounted = useHasMounted();

  if (!isMounted) return null;

  return (
    <div
      className="fixed bottom-4 left-4 max-w-sm rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs font-mono text-blue-900 z-50 pointer-events-none"
      style={{ opacity: 0.9 }}
    >
      <div className="mb-2 font-bold">Hydration Debug</div>
      <div className="space-y-1">
        <div>✓ Client mounted</div>
        {warnings.length > 0 && (
          <div className="border-t border-blue-200 pt-2 mt-2">
            <div className="font-bold text-red-600">Warnings: {warnings.length}</div>
            {warnings.slice(-3).map((w, i) => (
              <div key={i} className="text-red-600 truncate">
                {w}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
