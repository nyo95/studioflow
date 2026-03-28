# Hydration Prevention - Quick Reference Guide

## 🚀 Implementasi Global (Langkah Pertama)

Tambahkan ke `src/app/layout.tsx`:

```tsx
import { HydrationProvider, DehydrationDebug } from '@/ui_engine/components/EnhancedHydrationGuard';

export default function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning>
      <body suppressHydrationWarning>
        <HydrationProvider>
          {/* Your app */}
          {children}
          
          {/* Development debugging only */}
          {process.env.NODE_ENV === "development" && <DehydrationDebug />}
        </HydrationProvider>
      </body>
    </html>
  );
}
```

---

## 🛡️ Quick Fixes untuk Masalah Umum

### Masalah: Timestamp/Waktu Berubah-ubah
```tsx
// ❌ BURUK
<span>{formatDistanceToNow(date)}</span>

// ✅ BAIK
import { useRelativeTime } from '@/hooks/use-hydration';
const time = useRelativeTime(date);
<span>{time}</span>
```

### Masalah: Media Query Mismatch (Mobile)
```tsx
// ❌ BURUK
const isMobile = window.matchMedia("(max-width: 768px)").matches;

// ✅ BAIK
import { useResponsive } from '@/hooks/use-hydration';
const isMobile = useResponsive("(max-width: 768px)");
if (isMobile === undefined) return null; // SSR state
```

### Masalah: Content Berbeda di Server vs Client
```tsx
// ❌ BURUK
const isDark = document.documentElement.classList.contains('dark');

// ✅ BAIK
import { useIsDarkMode } from '@/hooks/use-hydration';
const isDark = useIsDarkMode();
if (isDark === undefined) return null; // Loading state
```

### Masalah: Render Dinamis yang Menyebabkan Mismatch
```tsx
// ❌ BURUK
const [showContent, setShowContent] = useState(false);
useEffect(() => setShowContent(true), []);
return <div>{showContent ? "Content" : "Loading"}</div>;

// ✅ BAIK
import { HydrationGuard } from '@/ui_engine/components/EnhancedHydrationGuard';
<HydrationGuard fallback={<div>Loading</div>}>
  <DynamicContent />
</HydrationGuard>
```

---

## 🎯 Kapan Menggunakan Apa

| Kasus | Hook/Component |
|------|-----------------|
| Waktu relatif ("2 jam lalu") | `useRelativeTime()` |
| Media query (mobile/desktop) | `useResponsive()` |
| Dark mode detection | `useIsDarkMode()` |
| Stable ID generator | `useStableId()` |
| Client-only code execution | `useClientOnly()` |
| localStorage aman hydration | `useLocalStorage()` |
| Async code di effects | `useAsyncEffect()` |
| Semua konten dinamis | `<HydrationGuard>` |
| Error handling + monitoring | `<HydrationBoundary>` |

---

## 🧪 Testing

### Verifikasi Hydration
```bash
# 1. Build production
npm run build

# 2. Start production server
npm run start

# 3. Open DevTools > Console
# 4. Pastikan NO hydration error messages
# 5. Pastikan NO layout shifts saat load
```

### Debug Hydration Issues
```tsx
// Tambahkan temporary debugging component
import { useHydrationWarnings } from '@/ui_engine/components/EnhancedHydrationGuard';

function DebugHydration() {
  const { warnings } = useHydrationWarnings();
  
  if (warnings.length === 0) return null;
  
  return (
    <div className="fixed bottom-4 right-4 bg-red-100 p-4 rounded">
      <div>Hydration Warnings: {warnings.length}</div>
      {warnings.map((w, i) => (
        <div key={i} className="text-xs text-red-600">{w}</div>
      ))}
    </div>
  );
}
```

---

## 📖 Dokumentasi Lengkap

- **[HYDRATION_STRATEGY.md](src/ui_engine/HYDRATION_STRATEGY.md)** - Penjelasan detail setiap pattern
- **[HYDRATION_AUDIT_REPORT.md](HYDRATION_AUDIT_REPORT.md)** - Laporan lengkap fixes yang sudah dilakukan
- **[use-hydration.ts](src/hooks/use-hydration.ts)** - JSDoc documentation setiap hook

---

## ⚠️ JANGAN LAKUKAN

```tsx
// ❌ Jangan gunakan suppressHydrationWarning untuk content
// Hanya untuk attributes yang minor
<div suppressHydrationWarning>
  {complexDynamicContent}
</div>

// ❌ Jangan render content berbeda di server vs client tanpa guard
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
return mounted ? <A /> : <B />; // Mismatch!

// ❌ Jangan akses window/localStorage langsung
const theme = localStorage.getItem('theme');

// ❌ Jangan gunakan Math.random() atau Date.now() untuk content
<div key={Math.random()}>{item}</div> // Setiap render berbeda!
```

---

## ✅ LAKUKAN INI

```tsx
// ✅ Guard dynamic content
import { HydrationGuard } from '@/ui_engine/components/EnhancedHydrationGuard';
<HydrationGuard><DynamicComponent /></HydrationGuard>

// ✅ Use hydration-safe hooks
import { useRelativeTime, useResponsive, useLocalStorage } from '@/hooks/use-hydration';

// ✅ Use useId() untuk stable IDs
const id = useId();
<label htmlFor={id}>Label</label>
<input id={id} />

// ✅ Properly return from useEffect
useEffect(() => {
  const handler = () => {};
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler); // Cleanup!
}, []);
```

---

## 🆘 Troubleshooting

| Error | Solusi |
|-------|--------|
| "Hydration mismatch" | Gunakan `HydrationGuard` atau `useHasMounted()` |
| Timestamp berubah | Gunakan `useRelativeTime()` |
| Mobile/desktop flashing | Gunakan `useResponsive()` dengan undefined check |
| localStorage undefined | Gunakan `useLocalStorage()` hook |
| Context value different | Defer provider initialization ke useEffect |
| ID berubah setiap render | Gunakan `useId()` atau `useStableId()` |

---

**Butuh bantuan?** Cek [HYDRATION_STRATEGY.md](src/ui_engine/HYDRATION_STRATEGY.md) untuk penjelasan detail!
