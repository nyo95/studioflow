import type { ReactNode } from "react";

/**
 * UI ENGINE — TEMPLATE CONTRACTS (PRD Architecture Cleanup v2 §42, R5)
 * ============================================================================
 * R5 hanya mengunci KONTRAK slot untuk ketujuh template; implementasi visual
 * dan migrasi halaman adalah fase R7 (roadmap "Template migration"). Tujuannya
 * supaya R6 (AppShell) dan pemakaian di sub-app sudah punya vocabulary slot
 * yang stabil sebelum ada yang menulis template sungguhan.
 *
 * Aturan §42: templates use slots. Template sadar-struktur, tidak sadar-bisnis
 * — ia menerima konten lewat slot, tidak pernah mengimpor domain.
 */

/** Slot generik: satu node React atau `null`/`undefined` bila tidak dipakai. */
export type TemplateSlot = ReactNode;

/**
 * Kontrak slot per jenis halaman (§42). Semua slot opsional — template yang
 * sudah dirender memutuskan sendiri bagaimana slot kosong ditata.
 */
export interface DirectoryTemplateSlots {
  /** Judul + deskripsi halaman. */
  header?: TemplateSlot;
  /** Aksi primer halaman (tombol Add/Import), biasanya kanan header. */
  actions?: TemplateSlot;
  search?: TemplateSlot;
  filters?: TemplateSlot;
  /** Daftar/tabel hasil. */
  content: TemplateSlot;
  pagination?: TemplateSlot;
}

export interface DetailTemplateSlots {
  header?: TemplateSlot;
  actions?: TemplateSlot;
  /** Ringkasan identitas di atas konten. */
  summary?: TemplateSlot;
  content: TemplateSlot;
  /** Kolom samping (meta, tautan terkait). */
  aside?: TemplateSlot;
}

export interface WorkspaceTemplateSlots {
  navigation?: TemplateSlot;
  /** Konten utama workspace. */
  primary: TemplateSlot;
  /** Panel sekunder (inspector, catatan). */
  secondary?: TemplateSlot;
  actions?: TemplateSlot;
}

export interface SpreadsheetTemplateSlots {
  toolbar?: TemplateSlot;
  grid: TemplateSlot;
  inspector?: TemplateSlot;
  /** Rekapitulasi (mis. purchase summary). */
  summary?: TemplateSlot;
}

export interface ProjectTemplateSlots {
  /**
   * Template proyek sadar-proyek secara struktural (menerima id/nama proyek
   * sebagai prop), tetapi tidak sadar-bisnis: navigasi dan konteks masuk
   * lewat slot, bukan diimpor dari domain.
   */
  navigation?: TemplateSlot;
  header?: TemplateSlot;
  content: TemplateSlot;
  aside?: TemplateSlot;
}

export interface DashboardTemplateSlots {
  header?: TemplateSlot;
  content: TemplateSlot;
  sidebar?: TemplateSlot;
}

export interface SettingsTemplateSlots {
  header?: TemplateSlot;
  navigation?: TemplateSlot;
  content: TemplateSlot;
}
