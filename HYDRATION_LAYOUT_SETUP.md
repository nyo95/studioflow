# Layout.tsx Setup - Hydration Provider Configuration

**Purpose:** Add global hydration monitoring to your app  
**File:** `src/app/layout.tsx`  
**Effort:** 5 minutes  
**Benefit:** Global hydration error detection + debugging component

---

## ✅ Current State (No Changes Needed Yet)

Your `layout.tsx` is already correctly configured with `suppressHydrationWarning` on `<html>` and `<body>` tags, which is correct for static attributes like `lang` and CSS classes.

```tsx
// ✅ CORRECT - these suppressions are OK
<html suppressHydrationWarning>
<body suppressHydrationWarning>
```

---

## 🚀 Optional: Add Global Hydration Monitoring

### Step 1: Add Imports

```tsx
// Add these imports at the top of layout.tsx
import { HydrationProvider, DehydrationDebug } from '@/ui_engine/components/EnhancedHydrationGuard';
```

### Step 2: Wrap Children with Provider

```tsx
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${lora.variable} h-screen overflow-hidden antialiased`}
      suppressHydrationWarning
    >
      <head>
        <UISettingsInjector />
      </head>
      <body
        suppressHydrationWarning
        className={`h-screen overflow-hidden ${UI_ENGINE_CANVAS_CLASS} font-sans text-slate-900 antialiased`}
      >
        <HydrationProvider>
          <LayoutClient>{children}</LayoutClient>
          
          {/* Optional: Show debug panel in development */}
          {process.env.NODE_ENV === "development" && <DehydrationDebug />}
        </HydrationProvider>
      </body>
    </html>
  );
}
```

### Step 3: Verify Setup

```bash
# Build and test
npm run build
npm run start

# In browser DevTools > Console:
# Should NOT see any hydration warnings
# In development mode: Click the blue debug panel in bottom-right corner
```

---

## 📊 What Each Component Does

| Component | Purpose | When to Use |
|-----------|---------|------------|
| `HydrationProvider` | Wraps app to monitor hydration | Always (in root layout) |
| `DehydrationDebug` | Shows hydration status panel | Development only |
| `useHydrationWarnings()` | Access collected warnings | For custom monitoring |

---

## 🔍 Debug Panel Features (Development Only)

When you add `<DehydrationDebug />`, you'll see a panel that shows:

```
┌─────────────────────┐
│ Hydration Debug     │
├─────────────────────┤
│ ✓ Client mounted    │  ← Shows hydration complete
│                     │
│ Warnings: 0         │  ← No issues found!
└─────────────────────┘
```

If there are warnings:
```
┌─────────────────────────────────────────┐
│ Hydration Debug                         │
├─────────────────────────────────────────┤
│ ✓ Client mounted                        │
│                                         │
│ Warnings: 3                             │
│ Hydration failed on span                │
│ Text content mismatch on div            │
│ Server HTML: "2 min ago"                │
└─────────────────────────────────────────┘
```

---

## ⚙️ Alternative: Minimal Setup (No Provider)

If you prefer not to use the provider (lightweight approach):

```tsx
// Just import individual utilities where needed
import { useRelativeTime, useResponsive } from '@/hooks/use-hydration';
import { HydrationGuard } from '@/ui_engine/components/EnhancedHydrationGuard';

// Then in components:
<HydrationGuard>
  <YourComponent />
</HydrationGuard>
```

This still prevents mismatches but without global monitoring.

---

## 📋 Configuration Matrix

| Setup | Full-Featured | Lightweight | No Changes |
|------|---|---|---|
| Uses HydrationProvider | ✅ | ❌ | ❌ |
| Uses DehydrationDebug | ✅ | ❌ | ❌ |
| Can use HydrationGuard | ✅ | ✅ | ✅ |
| Can use hooks | ✅ | ✅ | ✅ |
| Monitoring in dev | ✅ | ❌ | ❌ |
| Recommended for | Teams | Solo | Testing |

---

## 🧪 Testing After Setup

```bash
# 1. Verify build succeeds
npm run build

# 2. Start dev server
npm run dev

# 3. Check console for errors
# Expected: No hydration-related errors

# 4. Look for debug panel (bottom-right)
# Expected: Blue panel showing "✓ Client mounted"

# 5. Test responsive behavior
# Open DevTools > Responsive Mode
# Switch between mobile/desktop views
# Expected: No flashing or layout jitter
```

---

## ❓ FAQ

**Q: Is HydrationProvider required?**  
A: No, it's optional. Individual hooks like `useRelativeTime()` work without it.

**Q: Can I use HydrationProvider with existing providers?**  
A: Yes, wrap it outside your other providers or nest inside them.

**Q: Will DehydrationDebug affect production performance?**  
A: No, it only shows in `NODE_ENV === "development"`.

**Q: What if I already have other root-level providers?**  
A: You can nest them or wrap HydrationProvider around all of them.

---

## 🔗 See Also

- [Quick Reference Guide](HYDRATION_QUICK_REFERENCE.md)
- [Strategy Document](src/ui_engine/HYDRATION_STRATEGY.md)
- [Audit Report](HYDRATION_AUDIT_REPORT.md)
- [Implementation Summary](HYDRATION_IMPLEMENTATION_SUMMARY.md)

---

**Next Step:** Apply one of the setups above, then run `npm run build && npm run start` to verify!
