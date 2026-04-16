/* ====================
   GLOBAL HYDRATION UTILITIES
   Purpose: Prevent hydration mismatches across the app
   ==================== */

"use client";

import { formatDistanceToNow } from "date-fns";
import { useCallback, useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * useHasMounted: Detect if component has mounted (client-side only)
 * 
 * Use this to defer rendering of any content that differs between SSR and client.
 * Returns false during SSR, true after hydration.
 * 
 * @returns {boolean} Whether component is mounted on client
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
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
  const hasMounted = useHasMounted();

  return useMemo(() => {
    if (!hasMounted) {
      return "";
    }

    try {
      return formatDistanceToNow(new Date(date), { addSuffix });
    } catch (error) {
      console.error("Failed to format time:", error);
      return "";
    }
  }, [addSuffix, date, hasMounted]);
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
  return useSyncExternalStore(
    (onStoreChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(query).matches,
    () => undefined
  );
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
  deps: ReadonlyArray<unknown> = []
): boolean {
  const isClient = useHasMounted();

  useEffect(() => {
    const cleanup = callback();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callback, ...deps]);

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
  return useSyncExternalStore(
    (onStoreChange) => {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", onStoreChange);

      const observer = new MutationObserver(onStoreChange);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

      return () => {
        mediaQuery.removeEventListener("change", onStoreChange);
        observer.disconnect();
      };
    },
    () =>
      window.matchMedia("(prefers-color-scheme: dark)").matches ||
      document.documentElement.classList.contains("dark"),
    () => undefined
  );
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
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.error(`Failed to read localStorage["${key}"]:`, error);
      return initialValue;
    }
  });

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
  deps: ReadonlyArray<unknown>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asyncFn, ...deps]);
}

// Legacy exports for compatibility with existing hooks/use-mobile.ts
export const useIsMobile = () => {
  const isMobile = useResponsive("(max-width: 767px)");
  return isMobile !== undefined ? isMobile : false;
};
