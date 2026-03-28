# Hydration Strategy & Prevention

## 🔍 Current Hydration Issues Detected

### 1. **Dynamic Content Mismatch (MEDIUM SEVERITY)**
- **Location**: `comment-item.tsx` line 21 - `formatDistanceToNow()`
- **Problem**: Time-relative formatting changes on every render
- **Current Fix**: `suppressHydrationWarning` (symptom suppression, not prevention)
- **Impact**: Possible hydration mismatch warnings in production

### 2. **Responsive State Mismatch (MEDIUM SEVERITY)**
- **Location**: `hooks/use-mobile.ts`
- **Problem**: Mobile breakpoint detection differs between SSR and client
- **Current Fix**: `setState()` in `useEffect()` but no guard before rendering
- **Impact**: Mobile UI flashes or misaligns on load

### 3. **URL/Pathname Mismatch (LOW SEVERITY)**
- **Location**: `hooks/use-stable-pathname.ts`
- **Problem**: `usePathname()` not available during SSR
- **Current Fix**: Deferred with `useEffect()` but renders empty string initially
- **Impact**: Unused pathname on page load

### 4. **Scattered HydrationGuard Usage**
- **Location**: Only in phase detail page and discussion board
- **Problem**: Not standardized across all dynamic components
- **Impact**: Inconsistent hydration handling

---

## ✅ Current Mitigation Patterns

### Pattern 1: HydrationGuard with useSyncExternalStore ⭐ (BEST)
```tsx
// Already implemented in src/ui_engine/components/HydrationGuard.tsx
export function HydrationGuard({ children }: { children: React.ReactNode }) {
  const isMounted = useHasMounted(); // useSyncExternalStore pattern
  if (!isMounted) return null;
  return <>{children}</>;
}
```
- ✅ Uses `useSyncExternalStore` (no hydration warning)
- ✅ Safe server rendering (returns null)
- ✅ Proper client-side rendering

### Pattern 2: suppressHydrationWarning
```tsx
// In root layout.tsx
<html suppressHydrationWarning>
<body suppressHydrationWarning>
```
- ⚠️ Suppresses warnings but doesn't prevent mismatches
- ✅ OK for low-risk attributes (theme, viewport)
- ❌ Bad for content mismatches

---

## 🛡️ Global Hydration Prevention Strategy

### 1. **For Time-Relative Content** (formatDistanceToNow)
```tsx
// ✅ CORRECT: Use custom hook that defers formatting
function useRelativeTime(date: Date | string) {
  const [formatted, setFormatted] = useState("");

  useEffect(() => {
    setFormatted(formatDistanceToNow(new Date(date), { addSuffix: true }));
  }, [date]);

  return formatted;
}
```

### 2. **For Responsive/Breakpoint Logic** (Media queries)
```tsx
// ✅ CORRECT: Defer rendering until mounted
function useResponsive() {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);
  
  useEffect(() => {
    setIsMobile(window.matchMedia("(max-width: 767px)").matches);
  }, []);

  return isMobile; // undefined during SSR, proper value after mount
}
```

### 3. **For Dynamic Attributes** (ID, aria-describedby)
```tsx
// ✅ CORRECT: Generate stable IDs or guard with HydrationGuard
const useStableId = () => {
  const id = useId(); // Next.js built-in, safe for SSR
  return id;
};
```

---

## 📋 Implementation Checklist

### Immediate Actions (Priority: HIGH)
- [ ] Replace `suppressHydrationWarning` timestamp with `useRelativeTime` hook
- [ ] Verify all `useEffect` patterns in `use-mobile.ts` and `use-stable-pathname.ts`
- [ ] Ensure `HydrationGuard` wraps all dynamic client content

### Recommended Enhancements (Priority: MEDIUM)
- [ ] Create centralized hydration utility hooks
- [ ] Add hydration error monitoring/logging
- [ ] Document hydration patterns for team

### Testing
- [ ] Test page hydration in dev tools (React Dev Tools -> Profiler)
- [ ] Check browser console for hydration warnings
- [ ] Verify no layout shift on page load

---

## 📌 Rules for New Code

### ❌ AVOID
```tsx
// DON'T: Render time-dependent content directly
<span>{formatDistanceToNow(date)}</span>

// DON'T: Direct media query checks without guarding
const isMobile = window.matchMedia(...).matches;

// DON'T: Use non-stable IDs
<div id={`comment-${Math.random()}`}>
```

### ✅ PREFER
```tsx
// DO: Guard dynamic content
<HydrationGuard>
  <span>{useRelativeTime(date)}</span>
</HydrationGuard>

// DO: Use hooks with useEffect
const isMobile = useResponsive();

// DO: Use useId() or stable IDs
const id = useId();
<div id={id}>
```

---

## 🧪 Testing Hydration

### Check for Hydration Errors
```bash
# 1. Open DevTools > Console
# 2. Look for "Hydration failed" or "hydration mismatch" messages
# 3. Build and test in production mode:
npm run build
npm run start
```

### Verify Component Mounting
```tsx
// Temporary debug component
export function HydrationDebug() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <span className="text-xs text-slate-400">
      {mounted ? "✓ hydrated" : "⏳ hydrating..."}
    </span>
  );
}
```

---

## 📚 References
- [Next.js Hydration Mismatch](https://nextjs.org/docs/messages/react-hydration-error)
- [React 18 useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
- [React useId](https://react.dev/reference/react/useId)
