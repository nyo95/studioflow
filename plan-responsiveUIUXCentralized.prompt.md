# PLAN: Centralized Responsive UI/UX System for 2-Sidebar Layout

**Project:** RADSAAS-2 UI Engine Responsive Architecture  
**Objective:** Implement centralized, mobile-first responsive strategy for 2-tier sidebar navigation  
**Scope:** Mobile (< 768px) → Tablet (768px-1024px) → Desktop (≥ 1024px)  
**Status:** Planning phase

---

## 📊 Current State Analysis

### Two-Sidebar Architecture
```
Desktop (1024px+):                Mobile (< 768px):
┌─────────────────────┐          ┌─────────────────┐
│      TopHeader (h-14)            │   TopHeader     │
├──────┬──────────────┤          ├─────────────────┤
│Nav   │ NavInner     │          │ ☰ | TopHeader  │
│Over  │ 256px        │          ├─────────────────┤
│64px  │              │          │                 │
│      │ [CONTENT]    │          │ [CONTENT]       │
│      │              │          │ (no sidebars)   │
└──────┴──────────────┘          └─────────────────┘
         
NavOuter visible + NavInner visible   NavOuter hidden
(static layout)                       (drawer open/close)
```

### Current Issues
1. ❌ NavInner (project sidebar) has NO mobile strategy
2. ❌ Responsive detection duplicated across multiple components
3. ❌ No centralized breakpoint management
4. ❌ Sidebar state doesn't adapt to screen size
5. ❌ Mobile UX: users see overlays that take full screen

---

## 🎯 Proposed Solution: Tiered Responsive System

### Architecture Overview

```
ui_engine/responsive/                                    [NEW]
├── responsive-config.ts         # Centralized breakpoints
├── responsive-context.tsx       # Global responsive state
├── hooks/
│   ├── useResponsive.ts         # Main hook (breakpoint-aware)
│   ├── useIsMobile.ts           # Legacy (deprecated, wraps hook)
│   └── useResponsiveLayout.ts   # Layout-specific patterns
└── providers/
    └── ResponsiveProvider.tsx    # Wrap app with context

ui_engine/layout/responsive/                             [NEW]
├── two-sidebar-layout.tsx       # Smart 2-sidebar responsive container
├── mobile-drawer-sidebar.tsx    # Mobile drawer variant
└── responsive-shell.tsx         # Dashboard shell with responsive logic

Components/
├── nav-outer-responsive.tsx     [ENHANCED]  # Use ResponsiveContext
└── nav-inner-responsive.tsx     [ENHANCED]  # Mobile drawer + state
```

### Three Breakpoint Tiers

```typescript
export const RESPONSIVE_BREAKPOINTS = {
  MOBILE: {
    label: 'mobile',
    breakpoint: 0,
    description: '< 768px',
    layout: 'single-column',
    sidebars: 'drawer-overlay',
    navigationStyle: 'hamburger-menu'
  },
  TABLET: {
    label: 'tablet',
    breakpoint: 768,
    description: '768px - 1024px',
    layout: 'two-column',
    sidebars: 'narrow-panels',
    navigationStyle: 'compact-sidebar'
  },
  DESKTOP: {
    label: 'desktop',
    breakpoint: 1024,
    description: '≥ 1024px',
    layout: 'three-column',
    sidebars: 'full-sidebars',
    navigationStyle: 'full-navigation'
  }
};
```

---

## 🏗️ Implementation Strategy

### Phase 1: Responsive Context (Foundation)

**File:** `src/ui_engine/responsive/responsive-config.ts`
```typescript
export const BREAKPOINTS = {
  mobile: 0,      // < 768px
  tablet: 768,    // 768px - 1023px
  desktop: 1024,  // ≥ 1024px
};

export const RESPONSIVE_LAYOUT = {
  mobile: { sidebarPosition: 'drawer', sidebarWidth: 'full', navInnerVisible: false },
  tablet: { sidebarPosition: 'side', sidebarWidth: '64px+256px', navInnerVisible: true },
  desktop: { sidebarPosition: 'side', sidebarWidth: '64px+256px', navInnerVisible: true },
};
```

**File:** `src/ui_engine/responsive/responsive-context.tsx`
```typescript
interface ResponsiveContextValue {
  isMobile: boolean;      // < 768px
  isTablet: boolean;      // 768px-1024px
  isDesktop: boolean;     // ≥ 1024px
  currentBreakpoint: 'mobile' | 'tablet' | 'desktop';
  sidebarLayout: 'drawer' | 'side-panel';
  shouldShowNavInner: boolean;
}

export const ResponsiveProvider = ({ children }) => {
  // Global state managed here
  // Subscribed to window resize events
  // Handles orientation changes
};

export const useResponsive = () => useContext(ResponsiveContext);
```

### Phase 2: Two-Sidebar Layout Component

**File:** `src/ui_engine/layout/responsive/two-sidebar-layout.tsx`
```typescript
interface TwoSidebarLayoutProps {
  navOuter?: React.ReactNode;      // Left outer sidebar (64px)
  navInner?: React.ReactNode;      // Left inner sidebar (256px)
  topbar?: React.ReactNode;        // Top navigation
  children: React.ReactNode;       // Main content
}

export function TwoSidebarLayout({
  navOuter,
  navInner,
  topbar,
  children
}: TwoSidebarLayoutProps) {
  const { sidebarLayout, shouldShowNavInner } = useResponsive();
  
  // Mobile: navOuter as drawer, hide navInner
  // Tablet+: both visible as side panels
  // Handles state management for drawer open/close
}
```

### Phase 3: Enhanced Components

**Updates to `nav-outer.tsx`:**
```typescript
// Before: Hardcoded lg:hidden/lg:block logic
<nav className="lg:hidden fixed...">

// After: Use responsive context
const { isMobile, sidebarLayout } = useResponsive();
<nav className={cn(
  isMobile && sidebarLayout === 'drawer' ? 'fixed overlay' : 'static',
  !isMobile && 'static'
)}>
```

**Updates to `nav-inner.tsx`:**
```typescript
// Before: Always visible
<aside className="w-64">

// After: Responsive + drawer on mobile
const { shouldShowNavInner, isMobile } = useResponsive();

if (isMobile) {
  return <MobileDrawerSidebar>{children}</MobileDrawerSidebar>;
}

return <aside className="w-64">{children}</aside>;
```

---

## 📋 Implementation Phases & Timeline

### Phase 1: Foundation (3 days)
- [ ] Create responsive-config.ts with centralized breakpoints
- [ ] Build ResponsiveContext + ResponsiveProvider
- [ ] Create useResponsive() hook
- [ ] Write tests for context/hook
- [ ] Document responsive patterns in ui_engine/
- **Deliverable:** Centralized responsive system ready for integration

### Phase 2: Responsive Layout Component (3 days)
- [ ] Create two-sidebar-layout.tsx
- [ ] Build mobile-drawer-sidebar.tsx variant
- [ ] Create responsive-shell.tsx (dashboard-specific)
- [ ] Add Storybook stories for mobile/tablet/desktop
- **Deliverable:** Reusable responsive layout component

### Phase 3: Component Integration (4 days)
- [ ] Update nav-outer.tsx to use ResponsiveContext
- [ ] Update nav-inner.tsx with mobile drawer
- [ ] Update top-header.tsx to use context
- [ ] Update dashboard-page-shell.tsx responsive logic
- [ ] Test navigation on mobile/tablet/desktop
- **Deliverable:** All components using centralized system

### Phase 4: State Management & Polish (3 days)
- [ ] Sidebar state respects screen size changes
- [ ] Smooth transitions desktop ↔ mobile
- [ ] Persist sidebar preferences (no drawer on load if desktop)
- [ ] Performance optimization (memoization)
- [ ] Analytics: track responsive state changes
- **Deliverable:** Production-ready responsive system

**Total: ~13 days**

---

## 🎨 Responsive Behavior Specification

### Mobile (< 768px)
```
┌─────────────────────────┐
│  ☰ TopHeader Avatar     │  (Menu button + notification + user)
├─────────────────────────┤
│                         │
│      MAIN CONTENT       │  (Full width - padding)
│      (no sidebars)      │
│                         │
├─────────────────────────┤
│   Optional bottom nav   │  (Tab bar for mobile nav)
└─────────────────────────┘

Drawer (when ☰ clicked):
┌─────────────────────────┐
│ ← | NAV | X             │  (Overlay, slide-in from left)
│                         │
│  NavOuter items         │
│  + NavInner (if in      │
│    project route)       │
│                         │
└─────────────────────────┘
```

**State:**
- Drawer: starts closed by default
- Content: full-width, no padding adjustment
- Transitions: smooth slide-in/out

### Tablet (768px - 1024px)
```
┌──────────────────────────────┐
│      TopHeader               │
├────────┬─────────────────────┤
│ NavOuter│   MAIN CONTENT      │
│ (narrow)│   (flex-1)          │
│ icons   │                     │
│ only    │                     │
├────────┴─────────────────────┤
│      Optional footer          │
└──────────────────────────────┘

When in project:
├─────┬───────────┬────────────┤
│ Out │NavInner   │ CONTENT    │
│ 64  │(compact   │            │
│ px  │200px)     │            │
└─────┴───────────┴────────────┘
```

**State:**
- Both sidebars visible (side-by-side)
- NavOuter: icon-only or narrow
- NavInner: compact width
- Content: remains responsive

### Desktop (≥ 1024px)
```
┌──────────────────────────────────┐
│        TopHeader                 │
├───────┬──────────────┬───────────┤
│ NavOuter│ NavInner   │ CONTENT   │
│  64px   │  256px     │ (flex-1)  │
│ (icons) │  (full)    │           │
│         │            │           │
└───────┴──────────────┴───────────┘
```

**State:**
- Both sidebars always visible (static layout)
- No drawer/overlay
- Full navigation available

---

## 🔧 Component API Specification

### ResponsiveContext Hook

```typescript
interface ResponsiveState {
  // Breakpoint detection
  isMobile: boolean;              // < 768px
  isTablet: boolean;              // 768px-1024px
  isDesktop: boolean;             // ≥ 1024px
  currentBreakpoint: 'mobile' | 'tablet' | 'desktop';
  
  // Layout preferences
  sidebarLayout: 'drawer' | 'static';  // drawer on mobile, static on desktop+
  shouldShowNavInner: boolean;        // Show inner sidebar? (true on tablet+)
  
  // Sidebar state (synchronized with breakpoint)
  navOuterOpen: boolean;           // Drawer open state (mobile only)
  toggleNavOuter: () => void;      // Toggle drawer
  
  // Utilities
  getBreakpointClass: (config: BreakpointConfig) => string;  // For Tailwind
}

// Usage:
const { isMobile, navOuterOpen, toggleNavOuter } = useResponsive();
```

### Two-Sidebar Layout Component

```typescript
interface TwoSidebarLayoutProps {
  navOuter?: React.ReactNode;
  navInner?: React.ReactNode;
  topbar?: React.ReactNode;
  children: React.ReactNode;
  onNavOuterToggle?: (isOpen: boolean) => void;
  defaultNavOuterOpen?: boolean;  // Desktop default: true, Mobile: false
}

<TwoSidebarLayout
  navOuter={<NavOuter />}
  navInner={<NavInner />}
  topbar={<TopHeader />}
>
  <MainContent />
</TwoSidebarLayout>
```

---

## 📁 File Structure & Dependencies

```
src/ui_engine/responsive/
├── responsive-config.ts                [NEW]
│   └── Exports: BREAKPOINTS, RESPONSIVE_LAYOUT
│
├── responsive-context.tsx              [NEW]
│   └── Exports: ResponsiveProvider, useResponsive, ResponsiveContext
│
└── hooks/                              [NEW]
    ├── useResponsive.ts                # Main hook
    ├── useResponsiveLayout.ts          # Layout-specific hook
    └── index.ts                        # Export all hooks

src/ui_engine/layout/responsive/
├── two-sidebar-layout.tsx              [NEW]
│   ├── Imports: useResponsive(), responsive-config
│   └── Renders: responsive sidebar layout
│
├── mobile-drawer-sidebar.tsx           [NEW]
│   └── Component: Drawer wrapper for mobile
│
└── responsive-shell.tsx                [NEW]
    ├── Imports: two-sidebar-layout, TwoSidebarLayout
    └── Wraps: dashboard content with responsive layout

src/components/
├── nav-outer-responsive.tsx            [REFACTORED]
│   └── Uses: useResponsive() instead of direct lg:hidden
│
├── nav-inner-responsive.tsx            [REFACTORED]
│   └── Uses: mobile drawer on < tablet
│
└── top-header-responsive.tsx           [REFACTORED]
    └── Uses: responsive context for state management
```

---

## 🧪 Testing Strategy

### Unit Tests
- `useResponsive()` hook behavior at different breakpoints
- ResponsiveContext provides correct values
- Breakpoint calculations are accurate

### Integration Tests
- Two-sidebar layout renders correctly at each breakpoint
- Drawer opens/closes properly on mobile
- NavInner shows/hides at correct breakpoints
- Sidebar state persists across navigation

### E2E Tests
- Mobile: Menu toggle works, drawer slides in/out
- Tablet: Both sidebars visible, responsive to resize
- Desktop: Full layout stable, no jank
- Window resize: Smooth transitions between breakpoints

### Visual Regression Tests
- Screenshots at 3 breakpoints for each component
- Compare against design system spec

---

## 📊 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Mobile UX** | Score 90+ | Lighthouse mobile score |
| **Responsive Speed** | < 16ms | Breakpoint change render time |
| **Code Reuse** | 100% | All components use ResponsiveContext |
| **Mobile Adoption** | 40%+ | Analytics tracking |
| **User Satisfaction** | 4.5/5 | Post-deployment survey |

---

## 🚀 Future Enhancements (Out of Scope)

1. **Advanced layouts**: Side-by-side content panes on desktop
2. **Gesture support**: Swipe to open/close drawer on mobile
3. **Breakpoint-specific animations**: Different easing on mobile vs desktop
4. **Responsive typography**: Font size scales with breakpoint
5. **Dark mode responsive**: Different sidebar colors at breakpoints
6. **Keyboard navigation**: Responsive focus mgmt

---

## 🔗 Related Systems

- **Design System**: [src/ui_engine/design-system.config.ts](src/ui_engine/design-system.config.ts)
- **Sidebar Context**: [src/context/sidebar-context.tsx](src/context/sidebar-context.tsx) (current)
- **Hydration Strategy**: ../HYDRATION_STRATEGY.md (use useIsMobile for SSR safety)
- **TypeScript types**: Extend types.ts with ResponsiveContext types

---

## 📝 Decision Log

| Decision | Rationale | Alternative Considered |
|----------|-----------|----------------------|
| **Three breakpoints** | Aligns with design, covers 95% of devices | 4+ breakpoints (complexity) |
| **Context-based** | Centralized, testable, performant | Props drilling (verbose) |
| **useResponsive hook** | Single import, unify API | Multiple hooks (fragmented) |
| **Drawer on mobile** | Standard mobile UX pattern | Collapse sidebar (confusing) |
| **No persist drawer state** | Better UX - defaults match screen size | Always remember state (confusing) |

---

## ✅ Checklist for Implementation

- [ ] Design responsive wireframes (planning complete)
- [ ] Create responsive-config.ts
- [ ] Build ResponsiveContext + provider
- [ ] Write useResponsive() hook
- [ ] Build TwoSidebarLayout component
- [ ] Refactor nav-outer.tsx
- [ ] Refactor nav-inner.tsx
- [ ] Update dashboard layout
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Visual regression testing
- [ ] Performance testing
- [ ] Documentation
- [ ] Storybook stories
- [ ] Code review
- [ ] Deployment

---

**Status:** Ready for implementation  
**Owner:** To assign  
**Priority:** High (improves mobile UX significantly)  
**Estimated effort:** 2 weeks (13 days)
