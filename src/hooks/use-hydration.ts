/* ====================
   GLOBAL HYDRATION UTILITIES
   Purpose: Prevent hydration mismatches across the app
   ==================== */

"use client";

import { useEffect, useState, useId, useCallback } from "react";

/**
 * useHasMounted: Detect if component has mounted (client-side only)
 * 
 * Use this to defer rendering of any content that differs between SSR and client.
 * Returns false during SSR, true after hydration.
 * 
 * @returns {boolean} Whether component is mounted on client
 */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}

/**
 * useRelativeTime: Format time as relative string (e.g., "2 minutes ago")
 * 
 * Use this instead of directly calling formatDistanceToNow() in JSX,
 * as it causes hydration mismatches due to time-dependent formatting.
 * 
 * @param date - Date to format
 * @param addSuffix - Whether to add "ago" or "in"
 * @returns {string} Formatted relative time (empty string during SSR)
 * 
 * @example
 * const timeStr = useRelativeTime(new Date("2024-01-01"));
 * // SSR: "" → Client: "2 months ago"
 */
export function useRelativeTime(
  date: Date | string,
  addSuffix = true
): string {
  const [formatted, setFormatted] = useState("");

  useEffect(() => {
    // Import is deferred to client-side only
    const { formatDistanceToNow } = require("date-fns");
    
    try {
      setFormatted(
        formatDistanceToNow(new Date(date), { 
          addSuffix 
        })
      );
    } catch (error) {
      console.error("Failed to format time:", error);
      setFormatted("");
    }
  }, [date, addSuffix]);

  return formatted;
}

/**
 * useResponsive: Check if viewport matches a media query
 * 
 * Use this instead of calling window.matchMedia() directly,
 * which causes mismatches between SSR (no window) and client.
 * 
 * Returns undefined during SSR, boolean after hydration.
 * Use conditional rendering to handle undefined state!
 * 
 * @param query - Media query string (e.g., "(max-width: 768px)")
 * @returns {boolean | undefined} Query match result (undefined during SSR)
 * 
 * @example
 * const isMobile = useResponsive("(max-width: 768px)");
 * if (isMobile === undefined) return null; // Loading
 * return isMobile ? <MobileUI /> : <DesktopUI />;
 */
export function useResponsive(query: string): boolean | undefined {
  const [matches, setMatches] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mql = window.matchMedia(query);
    
    // Set initial value
    setMatches(mql.matches);

    // Listen for changes
    const handler = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/**
 * useStableId: Generate a stable ID suitable for SSR and client
 * 
 * React's useId() is preferred, but this is useful if you need
 * a namespace prefix or custom format.
 * 
 * @param prefix - Optional prefix for the ID
 * @returns {string} Stable ID
 * 
 * @example
 * const id = useStableId("comment");
 * // SSR + Client: ":r0:-comment" (consistent)
 */
export function useStableId(prefix?: string): string {
  const id = useId();
  return prefix ? `${prefix}-${id}` : id;
}

/**
 * useClientOnly: Execute callback only on client after mount
 * 
 * Similar to wrapping code in useEffect, but returns a boolean
 * to help with conditional rendering.
 * 
 * @param callback - Function to run after mount
 * @param deps - Dependency array
 * @returns {boolean} Whether client is mounted
 * 
 * @example
 * const isMounted = useClientOnly(() => {
 *   trackPageView();
 * }, []);
 */
export function useClientOnly(
  callback: () => void | (() => void),
  deps: React.DependencyList = []
): boolean {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const cleanup = callback();
    return cleanup;
  }, deps);

  return isClient;
}

/**
 * useIsDarkMode: Detect if dark mode is enabled
 * 
 * Avoids hydration mismatch by deferring to useEffect.
 * Returns undefined during SSR.
 * 
 * @returns {boolean | undefined} Dark mode status (undefined during SSR)
 * 
 * @example
 * const isDark = useIsDarkMode();
 * if (isDark === undefined) return null;
 * return isDark ? <DarkTheme /> : <LightTheme />;
 */
export function useIsDarkMode(): boolean | undefined {
  const [isDark, setIsDark] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    // Check multiple sources of dark mode
    const darkModeEnabled =
      window.matchMedia("(prefers-color-scheme: dark)").matches ||
      document.documentElement.classList.contains("dark");

    setIsDark(darkModeEnabled);
  }, []);

  return isDark;
}

/**
 * useLocalStorage: Safely access localStorage without hydration issues
 * 
 * @param key - Storage key
 * @param initialValue - Default value during SSR
 * @returns {[T, (value: T) => void]} Current value and setter
 * 
 * @example
 * const [count, setCount] = useLocalStorage("count", 0);
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setValue(JSON.parse(item));
      }
    } catch (error) {
      console.error(`Failed to read localStorage["${key}"]:`, error);
    }
  }, [key]);

  const setStoredValue = useCallback(
    (newValue: T) => {
      try {
        setValue(newValue);
        window.localStorage.setItem(key, JSON.stringify(newValue));
      } catch (error) {
        console.error(`Failed to set localStorage["${key}"]:`, error);
      }
    },
    [key]
  );

  return [value, setStoredValue] as const;
}

/**
 * useAsyncEffect: Run async code safely in useEffect
 * 
 * Prevents "useAsyncEffect is not a React Hook" warning.
 * Automatically cancels if component unmounts.
 * 
 * @param asyncFn - Async function to run
 * @param deps - Dependency array
 * 
 * @example
 * useAsyncEffect(async () => {
 *   const data = await fetch('/api/data');
 *   setData(data);
 * }, []);
 */
export function useAsyncEffect(
  asyncFn: () => Promise<void | (() => void)>,
  deps: React.DependencyList
): void {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const cleanup = await asyncFn();
        if (!cancelled && typeof cleanup === "function") {
          return cleanup;
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Async effect error:", error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, deps);
}

// Legacy exports for compatibility with existing hooks/use-mobile.ts
export const useIsMobile = () => {
  const isMobile = useResponsive("(max-width: 767px)");
  return isMobile !== undefined ? isMobile : false;
};
