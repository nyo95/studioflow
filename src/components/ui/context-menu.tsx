"use client"

/**
 * CONTEXT MENU — aksi yang muncul di tempat, lewat klik kanan.
 *
 * ============================================================================
 * KENAPA ADA
 * ============================================================================
 * Editor BQ sempat memasang form "tambah" PERMANEN di setiap pengelompok:
 * satu untuk Sub Section, satu untuk Works, di tiap seksi dan tiap divisi.
 * Pada BQ berukuran dokumen kantor itu belasan form nganggur di layar
 * sekaligus, ditambah blok chip saran dan tiga paragraf instruksi drop.
 * `designbq.md` §4 meminta yang sebaliknya: ringkas, tidak redundant.
 *
 * Klik kanan memindahkan seluruh afordans itu ke satu gesture yang muncul
 * hanya saat diminta — dan hanya menawarkan yang memang sah di baris itu,
 * sehingga tidak perlu lagi ada pesan "kamu menjatuhkannya di tempat yang
 * salah".
 *
 * ============================================================================
 * AKSESIBILITAS
 * ============================================================================
 * Radix membuka menu ini juga lewat tombol Menu/Shift+F10 dan menangani roving
 * focus, jadi ia tidak mengunci pengguna keyboard. Tapi klik kanan tetap
 * gesture yang tidak terlihat: **jangan pernah menjadikan context menu
 * satu-satunya jalan ke sebuah aksi yang tidak punya padanan lain.** Aksi
 * merusak (hapus) tetap wajib punya konfirmasi sendiri.
 */

import * as React from "react"
import { ContextMenu as ContextMenuPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function ContextMenu({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />
}

function ContextMenuTrigger({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return (
    <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
  )
}

function ContextMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        data-slot="context-menu-content"
        className={cn(
          "z-50 min-w-[11rem] overflow-hidden border bg-popover p-1 text-popover-foreground shadow-md",
          "rounded-[var(--ui-radius-control,0.5rem)]",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  )
}

function ContextMenuItem({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item> & {
  /** `destructive` mewarnai merah — tetap wajib punya konfirmasi sendiri. */
  variant?: "default" | "destructive"
}) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-variant={variant}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-2 text-sm outline-hidden select-none",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        variant === "destructive" &&
          "text-red-600 focus:bg-red-50 focus:text-red-700",
        className
      )}
      {...props}
    />
  )
}

function ContextMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Label>) {
  return (
    <ContextMenuPrimitive.Label
      data-slot="context-menu-label"
      className={cn(
        "px-2 py-1.5 text-xs font-medium text-[var(--ui-text-tertiary,#64748b)]",
        className
      )}
      {...props}
    />
  )
}

function ContextMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
}
