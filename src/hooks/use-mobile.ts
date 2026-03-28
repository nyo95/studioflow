import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * useIsMobile: Responsive hook that detects mobile viewport
 * 
 * Safe for hydration - returns undefined during SSR, boolean after mount.
 * Components should handle undefined state to avoid hydration mismatch.
 * 
 * @returns {boolean | undefined} Mobile status (undefined during SSR)
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}

