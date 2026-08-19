"use client";

/**
 * PENGAMAN PERUBAHAN BELUM DISIMPAN
 * ============================================================================
 * Dibuat 2026-08-14 sebagai syarat dihapusnya View-First Protocol.
 *
 * Sampai hari ini setiap dialog yang menyunting data yang sudah ada terbuka
 * read-only, dan harus ditekan "Modify" dulu sebelum bisa diketik. Owner
 * membuang langkah itu: *"saat diklik lgsg aja ada inline edit (ga usa di
 * pencet 'modify' lagi)"*.
 *
 * Tapi tombol Modify tidak hanya menambah klik — ia juga satu-satunya hal yang
 * membuat menyunting menjadi tindakan yang DISENGAJA. Tanpanya, membuka sebuah
 * baris untuk melihat isinya lalu tidak sengaja mengetik di atasnya, lalu
 * menekan Esc, adalah tiga gerakan yang tidak meninggalkan jejak apa pun.
 *
 * Berkas ini adalah penggantinya, dan sengaja bekerja terbalik dari Modify:
 * Modify menghalangi SEMUA orang di depan pintu masuk; ini hanya berbicara
 * kepada orang yang benar-benar mengubah sesuatu, di pintu keluar. Membuka lalu
 * menutup dialog tanpa menyentuh apa pun tetap satu klik, tanpa gangguan.
 *
 * ----------------------------------------------------------------------------
 * CARA MENDETEKSI "BERUBAH"
 * ----------------------------------------------------------------------------
 * Perbandingan `JSON.stringify` terhadap snapshot yang dipasang pemanggil lewat
 * `markPristine`. Bukan deep-equal sungguhan, dan itu keputusan sadar:
 *
 *   - Seluruh state form di aplikasi ini adalah objek biasa hasil `useState`
 *     yang isinya string, number, null, array, dan objek kecil — semuanya
 *     JSON-serialisable.
 *   - Urutan kunci stabil karena objeknya selalu dibangun dari literal atau
 *     spread dari objek yang sama, bukan dirakit dinamis.
 *
 * Yang TIDAK boleh dilewatkan ke sini: `Date`, `Map`, `Set`, fungsi, atau nilai
 * yang mengandung `undefined` pada posisi yang berpengaruh — `JSON.stringify`
 * membuang kunci ber-`undefined`, sehingga `{a: undefined}` dan `{}` terbaca
 * sama. Kalau suatu form memerlukan itu, berikan `isDirty` sendiri.
 *
 * Kesalahan yang mungkin terjadi berat sebelah ke arah yang benar: kalau
 * perbandingannya meleset, yang terjadi adalah konfirmasi muncul padahal tidak
 * perlu — mengganggu, tapi tidak menghilangkan pekerjaan orang.
 */

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/ui_engine";

export type UnsavedChangesGuard<T = unknown> = {
  /**
   * Pasang ini di `onOpenChange` milik Dialog/Sheet, BUKAN `onOpenChange`
   * aslinya. Menutup dengan perubahan tertunda akan memunculkan konfirmasi;
   * membuka, dan menutup tanpa perubahan, diteruskan apa adanya.
   */
  handleOpenChange: (open: boolean) => void;
  /**
   * WAJIB dipanggil dari efek yang mengisi form, dengan nilai yang BARU SAJA
   * dibangun — bukan dari state, yang pada saat itu masih nilai lama.
   *
   *   React.useEffect(() => {
   *     if (!open) return;
   *     const next = toForm(row);
   *     setForm(next);
   *     guard.markPristine(next);   // ← ini
   *   }, [open, row]);
   *
   * Kenapa tidak otomatis: efek pengisi form dan efek milik hook ini berjalan
   * pada commit yang SAMA, dan efek hook membaca `value` dari render itu — yang
   * masih berisi form sebelumnya. Snapshot otomatis akan selalu mengambil
   * gambar yang salah, lalu setiap dialog terlihat "sudah berubah" sejak
   * detik pertama dibuka, dan konfirmasi muncul pada setiap penutupan.
   * Efek yang sama juga menyelamatkan kasus data datang belakangan
   * (`MasterDataProductDialog` memuat detail SKU setelah dialog terbuka).
   */
  markPristine: (value: T) => void;
  /**
   * Tutup paksa tanpa bertanya. Dipakai SETELAH save berhasil — pada saat itu
   * form memang berbeda dari snapshot, dan bertanya "yakin buang perubahan?"
   * tepat setelah menyimpannya adalah pertanyaan yang salah.
   */
  closeAfterSave: () => void;
  /** Rendered oleh `<UnsavedChangesPrompt />`. Tidak untuk dibaca langsung. */
  promptOpen: boolean;
  discard: () => void;
  keepEditing: () => void;
  /** Berguna untuk menonaktifkan tombol Save saat belum ada yang berubah. */
  isDirty: boolean;
};

export function useUnsavedChangesGuard<T>({
  open,
  value,
  onOpenChange,
  enabled = true,
  isDirty: isDirtyOverride,
}: {
  open: boolean;
  /** State form saat ini, dibandingkan dengan baseline dari `markPristine`. */
  value: T;
  /** `onOpenChange` asli milik pemanggil. */
  onOpenChange: (open: boolean) => void;
  /**
   * Matikan pada dialog read-only (user tanpa izin ubah). Tidak ada yang bisa
   * berubah di sana, jadi bertanya hanya akan membingungkan.
   */
  enabled?: boolean;
  /** Ganti perbandingan bawaan bila bentuk form tidak JSON-serialisable. */
  isDirty?: (baseline: T | null, current: T) => boolean;
}): UnsavedChangesGuard<T> {
  /**
   * Baseline disimpan sebagai STATE, bukan ref.
   *
   * Sempat ditulis sebagai ref, dan React Compiler menolaknya dengan benar:
   * membaca ref saat render membuat `isDirty` tidak reaktif — ia tidak akan
   * dihitung ulang ketika baseline berubah, hanya ketika `value` berubah.
   * Efeknya halus dan jahat: satu render pertama setelah `markPristine` masih
   * memakai baseline lama, dan pada dialog yang datanya menyusul (detail SKU)
   * render itulah yang menentukan.
   */
  const [baseline, setBaseline] = React.useState<string | null>(null);
  const [baselineValue, setBaselineValue] = React.useState<T | null>(null);
  const [promptOpen, setPromptOpen] = React.useState(false);

  /**
   * Snapshot dipasang oleh pemanggil, lewat `markPristine`. Lihat komentar
   * pada tipe `UnsavedChangesGuard` untuk alasannya — versi otomatis berbasis
   * efek SELALU memotret form yang salah.
   */
  const markPristine = React.useCallback((next: T) => {
    setBaselineValue(next);
    try {
      setBaseline(JSON.stringify(next));
    } catch {
      // Form yang tidak bisa di-serialise: menyerah pada deteksi, jangan
      // menebak. `isDirty` menjadi false dan dialog berperilaku seperti sebelum
      // guard ini ada — bukan hasil terbaik, tapi jujur.
      setBaseline(null);
    }
  }, []);

  // Menutup dialog membuang baseline. Kalau tidak, dialog yang dibuka lagi
  // untuk baris LAIN akan dibandingkan dengan baris sebelumnya sampai efek
  // pengisi form sempat memanggil `markPristine`.
  React.useEffect(() => {
    if (open) return;
    setBaseline(null);
    setBaselineValue(null);
  }, [open]);

  const isDirty = React.useMemo(() => {
    if (!enabled || !open) return false;
    if (isDirtyOverride) return isDirtyOverride(baselineValue, value);
    if (baseline === null) return false;
    try {
      return JSON.stringify(value) !== baseline;
    } catch {
      return false;
    }
  }, [enabled, open, value, isDirtyOverride, baseline, baselineValue]);

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (next) {
        onOpenChange(true);
        return;
      }
      if (isDirty) {
        setPromptOpen(true);
        return;
      }
      onOpenChange(false);
    },
    [isDirty, onOpenChange]
  );

  const closeAfterSave = React.useCallback(() => {
    // Nolkan baseline supaya `isDirty` tidak sempat bernilai true di render
    // terakhir sebelum dialog benar-benar tertutup.
    setBaseline(null);
    setBaselineValue(null);
    setPromptOpen(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const discard = React.useCallback(() => {
    setBaseline(null);
    setBaselineValue(null);
    setPromptOpen(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const keepEditing = React.useCallback(() => setPromptOpen(false), []);

  return {
    handleOpenChange,
    markPristine,
    closeAfterSave,
    promptOpen,
    discard,
    keepEditing,
    isDirty,
  };
}

/**
 * Konfirmasi yang menyertai hook di atas. Dirender SEBAGAI SAUDARA dialognya,
 * bukan anaknya: sebuah AlertDialog di dalam Dialog yang sedang menutup ikut
 * ter-unmount bersama induknya, dan pertanyaannya hilang sebelum sempat dibaca.
 */
export function UnsavedChangesPrompt({
  guard,
  description = "Changes in this form have not been saved. Closing now will discard them.",
}: {
  /**
   * Bagian yang dirender komponen ini tidak menyentuh `T` sama sekali, jadi
   * `unknown` di sini bukan pelonggaran tipe — ia memang tidak peduli bentuk
   * formnya. `Omit` dipakai supaya `markPristine` yang kontravarian tidak
   * memaksa setiap pemanggil menuliskan tipe generiknya.
   */
  guard: Omit<UnsavedChangesGuard<unknown>, "markPristine">;
  description?: string;
}) {
  return (
    <AlertDialog
      open={guard.promptOpen}
      onOpenChange={(open) => { if (!open) guard.keepEditing(); }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard changes?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* "Lanjut mengedit" adalah pilihan yang aman, jadi ia yang jadi
              Cancel — tombol yang didapat Esc dan tombol yang tidak berwarna
              merah. */}
          <AlertDialogCancel onClick={guard.keepEditing}>Keep editing</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => { event.preventDefault(); guard.discard(); }}
            variant="destructive"
          >
            Discard changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
