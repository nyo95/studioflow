/**
 * BQ — mencocokkan pekerjaan di project dengan grup template.
 *
 * ============================================================================
 * KENAPA PENCOCOKAN LEWAT NAMA, BUKAN KOLOM BARU
 * ============================================================================
 * Alternatifnya menambah `template_key` di `BqObject` — satu migrasi lagi demi
 * tautan yang cuma dipakai untuk menampilkan saran. Nama sudah cukup: object
 * dibuat `applyBqTemplateAction` dengan nama persis dari template, dan kalau
 * estimator menggantinya, saran hilang dengan sendirinya. Itu perilaku yang
 * benar — pekerjaan bernama "Lantai Lt.2 Khusus" memang bukan lagi "Floor
 * Works" standar, dan menawarinya item Floor Works akan menyesatkan.
 *
 * Konsekuensi yang diterima: dua pekerjaan bernama sama dapat saran yang sama.
 * Itu tidak merugikan — sarannya memang identik.
 */

import {
  BQ_TEMPLATE_SECTIONS,
  type BqTemplateGroup,
  type BqTemplateItem,
} from "./bq-template-data";

/** Samakan bentuk nama sebelum dibandingkan. */
function norm(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Indeks nama grup -> grup. Dibangun sekali saat modul dimuat. */
const GROUP_BY_NAME = new Map<string, BqTemplateGroup>();
const ITEM_BY_KEY = new Map<string, BqTemplateItem>();
const ITEM_KEY_BY_REF = new WeakMap<BqTemplateItem, string>();
for (const [sectionIndex, section] of BQ_TEMPLATE_SECTIONS.entries()) {
  for (const [groupIndex, group] of section.groups.entries()) {
    GROUP_BY_NAME.set(norm(group.name), group);
    for (const [itemIndex, item] of group.items.entries()) {
      const key = `${sectionIndex}:${groupIndex}:${itemIndex}`;
      ITEM_BY_KEY.set(key, item);
      ITEM_KEY_BY_REF.set(item, key);
    }
  }
}

function matchKey(name: string, unit?: string | null, spec?: string | null): string {
  return [norm(name), norm(unit ?? ""), norm(spec ?? "")].join("::");
}

/** Grup template yang cocok dengan sebuah pekerjaan, atau NULL. */
export function findTemplateGroup(objectName: string): BqTemplateGroup | null {
  return GROUP_BY_NAME.get(norm(objectName)) ?? null;
}

type ExistingTemplateItem = {
  name: string;
  unit?: string | null;
  spec?: string | null;
};

/**
 * Item template yang BELUM ada sebagai sub-pekerjaan.
 *
 * `existingNames` adalah nama sub-pekerjaan yang sudah dibuat di pekerjaan itu.
 * Item yang sudah ada tidak ditawarkan lagi — daftar saran mengecil sejalan
 * estimator mengisinya, dan habis sendiri saat lengkap.
 */
export function suggestedTemplateItems(
  objectName: string,
  existingItems: readonly ExistingTemplateItem[],
): BqTemplateItem[] {
  const group = findTemplateGroup(objectName);
  if (!group) return [];
  const taken = new Set(
    existingItems.map((item) => matchKey(item.name, item.unit, item.spec)),
  );
  return group.items.filter(
    (item) => !taken.has(matchKey(displayName(item), item.unit, item.spec)),
  );
}

/**
 * Nama yang dipakai saat item dijadikan sub-pekerjaan.
 *
 * Area ("Shopfront Area") bukan lapis hirarki — ia keterangan tempat. Digabung
 * ke nama supaya dua "Wall Finish" di area berbeda tidak terbaca kembar.
 */
export function displayName(item: BqTemplateItem): string {
  return item.area ? `${item.area} — ${item.name}` : item.name;
}

export function templateItemKey(item: BqTemplateItem): string | null {
  return ITEM_KEY_BY_REF.get(item) ?? null;
}

export function getTemplateItemByKey(key: string): BqTemplateItem | null {
  return ITEM_BY_KEY.get(key) ?? null;
}

/** Cari satu item template di dalam sebuah grup, berdasarkan nama tampilnya. */
export function findTemplateItem(
  objectName: string,
  itemDisplayName: string,
): BqTemplateItem | null {
  const group = findTemplateGroup(objectName);
  if (!group) return null;
  const target = norm(itemDisplayName);
  return group.items.find((i) => norm(displayName(i)) === target) ?? null;
}

/**
 * Seluruh grup template, untuk ditelusuri di dock.
 *
 * Berbeda dari `suggestedTemplateItems` yang menyaring berdasarkan pekerjaan
 * tertentu: di dock estimator menelusuri SELURUH template dan memutuskan
 * sendiri di mana item itu ditaruh dengan menjatuhkannya. Itu sebabnya
 * pencarian di sini tidak peduli nama pekerjaan sama sekali.
 */
export type BqTemplateBrowseRow = {
  templateKey: string;
  sectionCode: string;
  sectionName: string;
  groupName: string;
  itemName: string;
  itemSpec: string | null;
  unit: string;
  lineCount: number;
};

export function browseTemplateItems(query: string): BqTemplateBrowseRow[] {
  const q = norm(query);
  const out: BqTemplateBrowseRow[] = [];
  for (const [sectionIndex, section] of BQ_TEMPLATE_SECTIONS.entries()) {
    for (const [groupIndex, group] of section.groups.entries()) {
      for (const [itemIndex, item] of group.items.entries()) {
        const name = displayName(item);
        if (
          q &&
          !norm(name).includes(q) &&
          !norm(group.name).includes(q) &&
          !norm(section.name).includes(q)
        ) {
          continue;
        }
        out.push({
          templateKey: `${sectionIndex}:${groupIndex}:${itemIndex}`,
          sectionCode: section.code,
          sectionName: section.name,
          groupName: group.name,
          itemName: name,
          itemSpec: item.spec,
          unit: item.unit,
          lineCount: item.lines.length,
        });
      }
    }
  }
  return out;
}
