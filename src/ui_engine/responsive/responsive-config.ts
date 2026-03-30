/**
 * RESPONSIVE CONFIGURATION
 * Centralized breakpoints and layout settings for StudioFlow
 */

export const BREAKPOINTS = {
  mobile: 0,      // < 768px
  tablet: 768,    // 768px - 1023px
  desktop: 1024,  // ≥ 1024px
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

export const LAYOUT_CONFIG = {
  mobile: {
    sidebarPosition: 'drawer',
    sidebarWidth: '100%',
    showNavInner: false,
    headerHeight: '56px',
  },
  tablet: {
    sidebarPosition: 'static',
    sidebarWidth: '64px', // icon only
    showNavInner: true,   // toggleable
    headerHeight: '64px',
  },
  desktop: {
    sidebarPosition: 'static',
    sidebarWidth: '64px + 256px',
    showNavInner: true,
    headerHeight: '64px',
  },
} as const;
