# -*- coding: utf-8 -*-
"""
Rekonstruksi staging Master Data dari `List` sheet workbook asli.
Sumber: docs/RAD - Material + Supplier.xlsx (checksum diverifikasi cocok
dengan MATERIAL_SUPPLIER_IMPORT_HANDOFF.md).

Lingkup: HANYA sheet `List` -> master_data.Vendor / VendorContact /
VendorOffering. Sheet1 (sample fisik) TIDAK disentuh di sini -- itu jalur
StudioFlow Library terpisah, sudah dibahas cocok apa adanya dengan struktur
existing tanpa migrasi.

Aturan yang diterapkan (dari percakapan + keputusan pemilik data):
- Jess Check enam-state warna/fill sel (bukan boolean): HIJAU=verified,
  MERAH=inactive, MERAH-TUA=unreachable, PEACH=uncertain,
  PUTIH/TANPA-FILL=unverified. Hanya HIJAU yang dapat curated_by="Jessica".
- 15 baris tanpa Product tetap jadi Vendor (+VendorOffering kalau ada
  Category), TIDAK membuat ProductCatalog (itu bahkan bukan tabel yang
  disentuh sheet ini).
- 3 vendor existing di database (dari MATERIAL_SUPPLIER_IMPORT_HANDOFF.md):
  EDL, NIRO GRANITE -> fill-blanks-only, TIDAK overwrite field terisi.
  Ketiga tidak diketahui namanya di sini -- diflag utk inspect script.
- Alias: hanya "Mozza" yang punya baris di List (row 287, sudah lengkap).
  Niro/Roman alias TIDAK muncul di List -- itu murni Sheet1, dicatat di
  SSOT §6.4 untuk referensi jalur Sheet1 nanti.
- Kolom "Contact" bermakna ganda (role ATAU nama orang). 364/483 baris
  murni kata kunci role tanpa nama. Keputusan pemilik: contact_person diisi
  = kata departemen itu sendiri (bukan karangan, literal dari sumber).
- Kolom "No" adalah nomor telepon, disimpan sebagai TEKS apa adanya
  (multi-nomor tetap satu field, tidak pernah di-parse jadi angka).
- Company yang diawali PT/CV -> company_pt. Nilai lain yang bukan "-" ->
  company_name.
- catalog_price / harga: TIDAK ada satu pun kolom harga di sheet ini.
  Tidak relevan untuk staging ini.
- Tidak ada tanggal verifikasi di sumber -> verified_at selalu null.
- Tidak ada SKU asli di sheet ini sama sekali -- offering, bukan SKU.
"""
import openpyxl
import csv
import re
import hashlib
import collections
import json
from pathlib import Path

SRC = "docs/RAD - Material + Supplier.xlsx"
OUT = Path("/sessions/nifty-adoring-euler/mnt/outputs/masterdata-staging")
OUT.mkdir(parents=True, exist_ok=True)

EXPECTED_SHA256 = "1AB11BD57893424EA226135F670197B31B96B861BA05C0C4962AF5BC8D0FBCEE"

# --- 0. Verifikasi checksum ulang, wajib sebelum apa pun -------------------
h = hashlib.sha256()
with open(SRC, "rb") as f:
    h.update(f.read())
actual = h.hexdigest().upper()
assert actual == EXPECTED_SHA256, f"CHECKSUM MISMATCH! expected {EXPECTED_SHA256} got {actual}"
print(f"[OK] checksum cocok: {actual}")

wb = openpyxl.load_workbook(SRC)
ws = wb["List"]

FILL_NAMES = {
    "FF93C47D": "HIJAU",
    "FFFF0000": "MERAH",
    "FFCC0000": "MERAH-TUA",
    "FFFCE5CD": "PEACH",
    "FFFFFFFF": "PUTIH",
}

def jess_status(cell):
    f = cell.fill
    if f.patternType is None:
        return "UNVERIFIED_NONE"
    rgb = getattr(f.fgColor, "rgb", None)
    name = FILL_NAMES.get(rgb)
    return {
        "HIJAU": "VERIFIED_GREEN",
        "MERAH": "INACTIVE_RED",
        "MERAH-TUA": "UNREACHABLE_DARKRED",
        "PEACH": "UNCERTAIN_PEACH",
        "PUTIH": "UNVERIFIED_WHITE",
    }.get(name, "UNVERIFIED_NONE")

ROLE_WORDS = {"office", "sales", "admin", "workshop", "showroom", "marketing",
              "head office", "project", "general"}

def clean(v):
    if v is None:
        return ""
    s = str(v).strip()
    return "" if s in ("-", "—", "") else s

def normalize_brand_key(v):
    s = clean(v).lower()
    s = re.sub(r"\s+", " ", s)
    return s

def split_contact(raw):
    """Kembalikan list of (person, role) dari satu cell Contact.
    Cell bisa: murni role ('Office'), murni nama ('Erna'),
    campur ('Andray Saputra/ Admin', 'Sales\n\nAgung')."""
    raw = clean(raw)
    if not raw:
        return []
    # split multi-entry by newline (beberapa baris punya 2 kontak dalam 1 sel)
    chunks = [c.strip() for c in re.split(r"[\n]+", raw) if c.strip()]
    out = []
    for chunk in chunks:
        # 'Andray Saputra/ Admin' -> pisah oleh slash jadi [nama, role]
        parts = [p.strip() for p in re.split(r"[/]+", chunk) if p.strip()]
        role_parts = [p for p in parts if p.lower() in ROLE_WORDS]
        name_parts = [p for p in parts if p.lower() not in ROLE_WORDS]
        if role_parts and name_parts:
            out.append((name_parts[0], role_parts[0].title()))
        elif role_parts and not name_parts:
            # murni role, tanpa nama -> keputusan pemilik: contact_person = nama departemen
            out.append((role_parts[0].title(), role_parts[0].title()))
        else:
            # tidak match kata kunci role sama sekali -> anggap nama orang, role default "General"
            # (bukan karangan atas identitas, tapi label kategori generik saat role tak diketahui)
            out.append((chunk, "General"))
    return out

def phone_text(raw):
    """Nomor telepon sebagai teks murni, tidak pernah diparse jadi angka."""
    raw = clean(raw)
    if not raw:
        return ""
    # gabungkan multi-nomor (dipisah newline di sumber) dengan '; ' agar tetap satu field teks
    parts = [p.strip() for p in re.split(r"[\n]+", raw) if p.strip()]
    return "; ".join(parts)

def company_split(raw):
    v = clean(raw)
    if not v:
        return "", ""
    if re.match(r"^(PT|CV)\b", v, re.I):
        return "", v  # company_name="", company_pt=v
    return v, ""       # company_name=v, company_pt=""

# --- 1. Baca semua baris List ------------------------------------------------
rows = []
for r in range(2, ws.max_row + 1):
    brand = ws.cell(r, 2).value
    if not brand or not str(brand).strip():
        continue
    rows.append({
        "row": r,
        "jess": jess_status(ws.cell(r, 1)),
        "jess_note": clean(ws.cell(r, 1).value),
        "brand_raw": str(brand).strip(),
        "folder_url": clean(ws.cell(r, 3).value),
        "reference_url": clean(ws.cell(r, 4).value),
        "category": clean(ws.cell(r, 5).value),
        "product": clean(ws.cell(r, 6).value),
        "notes": clean(ws.cell(r, 7).value),
        "website_url": clean(ws.cell(r, 8).value),
        "instagram_url": clean(ws.cell(r, 9).value),
        "company": clean(ws.cell(r, 10).value),
        "contact": clean(ws.cell(r, 11).value),
        "phone": clean(ws.cell(r, 12).value),
        "address": clean(ws.cell(r, 13).value),
        "sample_flag": clean(ws.cell(r, 14).value),
    })

print(f"[OK] {len(rows)} baris List terbaca (brand terisi)")

# --- 2. Kelompokkan per canonical brand -------------------------------------
KNOWN_EXISTING = {"edl", "niro granite"}  # dari MATERIAL_SUPPLIER_IMPORT_HANDOFF.md, case-insensitive

groups = collections.defaultdict(list)
for row in rows:
    key = normalize_brand_key(row["brand_raw"])
    groups[key].append(row)

print(f"[OK] {len(groups)} vendor unik (setelah normalisasi case/whitespace)")

# --- 3. Bangun 01_vendors.csv ------------------------------------------------
vendor_out = []
vendor_id_map = {}  # normalized key -> vendor_row_id (untuk FK ke contacts/offerings)
review_rows = []

def pick_conflict(values, field_name, brand_key, source_rows):
    """values: list nilai non-kosong. Rule: paling sering, lalu paling awal."""
    non_empty = [v for v in values if v]
    if not non_empty:
        return "", False
    counts = collections.Counter(non_empty)
    max_count = max(counts.values())
    candidates = [v for v in non_empty if counts[v] == max_count]
    chosen = candidates[0]  # yang pertama muncul di antara yang paling sering
    had_conflict = len(set(non_empty)) > 1
    if had_conflict:
        review_rows.append({
            "severity": "WARN",
            "entity_type": "Vendor",
            "source_sheet": "List",
            "source_row": ";".join(str(r) for r in source_rows),
            "source_key": brand_key,
            "issue_code": "VENDOR_FIELD_CONFLICT",
            "issue_detail": f"{field_name}: nilai berbeda antar baris source = {sorted(set(non_empty))}, dipilih '{chosen}' (paling sering, lalu paling awal)",
            "suggested_action": "Rekonsiliasi manual bila field ini penting; nilai lain tidak hilang, tetap ada di source_rows.",
        })
    return chosen, had_conflict

for key, grp in sorted(groups.items()):
    vid = f"v{len(vendor_out)+1:04d}"
    vendor_id_map[key] = vid

    brand_variants = sorted(set(r["brand_raw"] for r in grp))
    canonical_brand = collections.Counter(r["brand_raw"] for r in grp).most_common(1)[0][0]

    company_names, company_pts = [], []
    for r in grp:
        cn, cp = company_split(r["company"])
        if cn: company_names.append(cn)
        if cp: company_pts.append(cp)

    company_name, _ = pick_conflict(company_names, "company_name", key, [r["row"] for r in grp])
    company_pt, _ = pick_conflict(company_pts, "company_pt", key, [r["row"] for r in grp])
    website, _ = pick_conflict([r["website_url"] for r in grp], "website_url", key, [r["row"] for r in grp])
    ig, _ = pick_conflict([r["instagram_url"] for r in grp], "instagram_url", key, [r["row"] for r in grp])
    address, _ = pick_conflict([r["address"] for r in grp], "address", key, [r["row"] for r in grp])

    is_known_existing = key in KNOWN_EXISTING
    action = "MATCH_EXISTING_FILL_BLANKS_ONLY" if is_known_existing else "INSERT_NEW"

    vendor_out.append({
        "vendor_row_id": vid,
        "canonical_brand_name": canonical_brand,
        "source_brand_variants": " | ".join(brand_variants),
        "company_name": company_name,
        "company_pt": company_pt,
        "website_url": website,
        "instagram_url": ig,
        "address": address,
        "action": action,
        "matched_existing_hint": canonical_brand if is_known_existing else "",
        "source_sheet": "List",
        "source_rows": ";".join(str(r["row"]) for r in grp),
        "source_checksum": EXPECTED_SHA256,
    })

    if is_known_existing:
        review_rows.append({
            "severity": "INFO",
            "entity_type": "Vendor",
            "source_sheet": "List",
            "source_row": ";".join(str(r["row"]) for r in grp),
            "source_key": canonical_brand,
            "issue_code": "EXISTING_VENDOR_MATCH",
            "issue_detail": f"'{canonical_brand}' sudah ada di database (dari MATERIAL_SUPPLIER_IMPORT_HANDOFF.md). Importer HARUS fill-blanks-only, tidak boleh timpa field terisi.",
            "suggested_action": "Jalankan scripts/inspect-existing-masterdata.mjs dulu untuk lihat field mana yang sudah terisi di DB sebelum menjalankan importer.",
        })

print(f"[OK] {len(vendor_out)} baris vendor dibangun")

# --- 4. Bangun 02_vendor_contacts.csv ---------------------------------------
contact_out = []
seen_contacts = set()
for row in rows:
    key = normalize_brand_key(row["brand_raw"])
    vid = vendor_id_map[key]
    phone = phone_text(row["phone"])
    for person, role in split_contact(row["contact"]):
        dedupe_key = (vid, person.lower(), phone)
        if dedupe_key in seen_contacts:
            continue
        seen_contacts.add(dedupe_key)
        contact_out.append({
            "vendor_row_id": vid,
            "canonical_brand_name": row["brand_raw"],
            "contact_person": person,
            "contact_role": role,
            "phone_number": phone,
            "email": "",
            "source_sheet": "List",
            "source_row": row["row"],
            "note": "contact_person = label departemen (tidak ada nama orang di sumber)" if person == role else "",
        })

print(f"[OK] {len(contact_out)} baris kontak dibangun")

# --- 5. Bangun 03_vendor_offerings.csv --------------------------------------
offering_out = []
for row in rows:
    key = normalize_brand_key(row["brand_raw"])
    vid = vendor_id_map[key]
    has_category = bool(row["category"])
    has_product = bool(row["product"])

    if not has_category and not has_product:
        # 15 baris vendor-only, tidak ada offering sama sekali
        review_rows.append({
            "severity": "BLOCKER",
            "entity_type": "VendorOffering",
            "source_sheet": "List",
            "source_row": row["row"],
            "source_key": row["brand_raw"],
            "issue_code": "SOURCE_PRODUCT_MISSING",
            "issue_detail": "Tidak ada Category maupun Product. Vendor tetap dibuat, tidak ada VendorOffering.",
            "suggested_action": "Vendor-only, sesuai keputusan #2. Tidak perlu tindakan lebih lanjut kecuali kategori ditemukan kemudian.",
        })
        continue

    multiline = ("\n" in row["category"]) or ("\n" in row["product"])
    tags = []
    if row["category"]:
        raw_tags = re.split(r"[\n/]+", row["category"])
        tags = [t.strip() for t in raw_tags if t.strip()]

    active_status = "ACTIVE"
    if row["jess"] in ("INACTIVE_RED", "UNREACHABLE_DARKRED"):
        active_status = "ARCHIVED"

    curated_by = "Jessica" if row["jess"] == "VERIFIED_GREEN" else ""

    offering_out.append({
        "vendor_row_id": vid,
        "canonical_brand_name": row["brand_raw"],
        "category_raw": row["category"],
        "tags": json.dumps(tags, ensure_ascii=False),
        "product_family_name": row["product"],
        "reference_url": row["reference_url"],
        "folder_url": row["folder_url"],
        "source_notes": row["notes"] or row["jess_note"],
        "jess_status": row["jess"],
        "curated_by": curated_by,
        "active_status": active_status,
        "verified_at": "",  # tidak pernah -- sumber tidak menyediakan tanggal
        "source_sheet": "List",
        "source_row": row["row"],
        "source_checksum": EXPECTED_SHA256,
        "needs_review_multiline": "YES" if multiline else "",
    })

    if multiline:
        review_rows.append({
            "severity": "WARN",
            "entity_type": "VendorOffering",
            "source_sheet": "List",
            "source_row": row["row"],
            "source_key": row["brand_raw"],
            "issue_code": "MULTI_VALUE_PRODUCT",
            "issue_detail": f"Category/Product mengandung beberapa baris (multi-line) dan mungkin merepresentasikan beberapa offering terpisah: category={row['category']!r} product={row['product']!r}",
            "suggested_action": "Konfirmasi apakah harus dipecah jadi beberapa VendorOffering. Tidak dipecah otomatis -- disimpan utuh apa adanya.",
        })

    if row["jess"] in ("INACTIVE_RED", "UNREACHABLE_DARKRED"):
        review_rows.append({
            "severity": "INFO",
            "entity_type": "VendorOffering",
            "source_sheet": "List",
            "source_row": row["row"],
            "source_key": row["brand_raw"],
            "issue_code": "JESS_CURATED_NOTE",
            "issue_detail": f"Jess Check = {row['jess']}, catatan: {row['jess_note']!r}. Diarsipkan di level offering (bukan vendor), sesuai keputusan #4.",
            "suggested_action": "Tidak ada tindakan -- offering ini masuk sebagai ARCHIVED, vendor tetap aktif.",
        })

print(f"[OK] {len(offering_out)} baris offering dibangun")

# --- 6. Tulis semua CSV ------------------------------------------------------
def write_csv(filename, rows_data, fieldnames):
    path = OUT / filename
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows_data:
            w.writerow(r)
    print(f"  -> {path} ({len(rows_data)} baris)")

write_csv("01_vendors.csv", vendor_out, [
    "vendor_row_id", "canonical_brand_name", "source_brand_variants",
    "company_name", "company_pt", "website_url", "instagram_url", "address",
    "action", "matched_existing_hint", "source_sheet", "source_rows", "source_checksum",
])

write_csv("02_vendor_contacts.csv", contact_out, [
    "vendor_row_id", "canonical_brand_name", "contact_person", "contact_role",
    "phone_number", "email", "source_sheet", "source_row", "note",
])

write_csv("03_vendor_offerings.csv", offering_out, [
    "vendor_row_id", "canonical_brand_name", "category_raw", "tags",
    "product_family_name", "reference_url", "folder_url", "source_notes",
    "jess_status", "curated_by", "active_status", "verified_at",
    "source_sheet", "source_row", "source_checksum", "needs_review_multiline",
])

review_rows_sorted = sorted(review_rows, key=lambda r: {"BLOCKER": 0, "WARN": 1, "INFO": 2}[r["severity"]])
write_csv("04_import_review.csv", review_rows_sorted, [
    "severity", "entity_type", "source_sheet", "source_row", "source_key",
    "issue_code", "issue_detail", "suggested_action",
])

# --- 7. Ringkasan -------------------------------------------------------------
sev_counts = collections.Counter(r["severity"] for r in review_rows)
summary = {
    "source_checksum_verified": actual,
    "list_rows_read": len(rows),
    "vendors_out": len(vendor_out),
    "vendors_new": sum(1 for v in vendor_out if v["action"] == "INSERT_NEW"),
    "vendors_match_existing": sum(1 for v in vendor_out if v["action"] != "INSERT_NEW"),
    "contacts_out": len(contact_out),
    "contacts_role_only_no_name": sum(1 for c in contact_out if c["note"]),
    "offerings_out": len(offering_out),
    "offerings_active": sum(1 for o in offering_out if o["active_status"] == "ACTIVE"),
    "offerings_archived": sum(1 for o in offering_out if o["active_status"] == "ARCHIVED"),
    "offerings_jess_verified": sum(1 for o in offering_out if o["jess_status"] == "VERIFIED_GREEN"),
    "vendor_only_no_offering": sum(1 for r in review_rows if r["issue_code"] == "SOURCE_PRODUCT_MISSING"),
    "review_blockers": sev_counts.get("BLOCKER", 0),
    "review_warnings": sev_counts.get("WARN", 0),
    "review_info": sev_counts.get("INFO", 0),
}
with open(OUT / "BUILD_SUMMARY.json", "w", encoding="utf-8") as f:
    json.dump(summary, f, indent=2, ensure_ascii=False)

print("\n=== RINGKASAN ===")
for k, v in summary.items():
    print(f"  {k}: {v}")
