# StudioFlow — Master SSOT v1.2 (ENGINEERING EDITION)

**Status:** LOCKED / PRODUCTION-READY  
**Core Principle:** Strict on Data Integrity, Agile on Operational Workflow

---

# 0. EXECUTION RULES (MANDATORY)

- SSOT adalah satu-satunya sumber kebenaran.
- Tidak boleh improvisasi tanpa update SSOT.
- Tidak boleh ada logic di luar service layer.
- Semua enum HARUS uppercase.
- Tidak boleh ada hidden behavior.
- Jika ragu: STOP dan eskalasi.

---

# 1. ARCHITECTURE

## Modular Monolith
- Satu codebase
- Modul terpisah secara logika
- Tidak ada cross-import antar modul

## Modules
- project
- design
- schedule
- drafting
- catalog

---

# 2. CENTRALIZED ENUMS

ROLE = ADMIN | DIC | DRIC | STAFF

PHASE_NAME = MOODBOARD | LAYOUT | DESIGN_3D | CD | SUPERVISION | COMPLETED

PHASE_STATUS =
PENDING | IN_PROGRESS | ON_REVIEW_INTERNAL | APPROVED_INTERNAL | ON_REVIEW_CLIENT | READY_FOR_NEXT | COMPLETED

ACTIVITY_STATUS = OPEN | COMPLETED
ACTIVITY_MODE = TODO | FEEDBACK

DESIGN_TYPE = LAYOUT | MOODBOARD | 3D_RENDER

PRODUCT_TYPE = MATERIAL | FIXTURE

LIBRARY_STATUS = PENDING | APPROVED | REJECTED

CD_ITEM_STATUS = PENDING | IN_PROGRESS | COMPLETED

---

# 3. DATABASE MODELS

## Project
- id (uuid)
- project_code (unique)
- name
- status

## Phase
- id
- project_id
- name_enum
- status_enum
- order_index
- is_locked
- allow_parallel

## Activity
- id
- project_id
- phase_id (optional)
- content
- mode
- status

## DesignItem
- id
- project_id
- phase_id (optional)
- asset_url
- version (auto increment per upload context)
- design_type
- order_index

## ProjectScheduleEntry
- id
- project_id
- schedule_category
- schedule_prefix
- schedule_increment
- schedule_sort_order
- section
- data_snapshot (IMMUTABLE)
- schedule_qty
- schedule_location

UNIQUE: (project_id, section, schedule_prefix, schedule_increment)

## CDList
- id
- phase_id
- group_code
- drawing_name
- status_enum

UNIQUE: (phase_id, group_code, drawing_name)

## ProductCatalog
- id
- catalog_category
- catalog_sku
- catalog_product_name
- catalog_brand
- catalog_color
- catalog_finishing
- catalog_image_url
- catalog_type
- catalog_status
- created_at
- deleted_at

## AuditLog
- id
- action
- entity_type
- entity_id
- user_id
- project_id
- details
- created_at

---

# 4. DATA RULES

## Immutable Snapshot
- data_snapshot tidak boleh diubah
- catalog tidak boleh override snapshot

## Enum Rule
- semua enum uppercase
- tidak boleh boolean state

## Smart Input Guard (OR)
VALID:
- SKU + Name
ATAU
- Category + Color/Finishing

INVALID:
- kedua kosong

---

# 5. SERVICE CONTRACT

## Schedule Flow
1. validate input
2. create snapshot
3. normalize codes
4. insert audit log

## Code Normalizer
- hanya jalan setelah mutation
- backend only
- tidak boleh di frontend

---

# 6. UTILITIES

## Entity Engine
- schema driven
- view-first

## Media Harvester
- crop 1:1
- compress
- color fallback

## RBAC
- hide unauthorized action

## Audit Hook
- wajib log semua mutation

## Code Normalizer
- deterministic
- post-mutation only

---

# 7. MODULE RELATIONS

- Tidak ada auto-generate antar modul
- Tidak ada dependency blocking
- Semua relasi bersifat reference

Design → Schedule (reference)
Design → CD (reference)
Schedule → CD (none)

---

# 8. BANNED PRACTICES

- Hardcode enum string
- Direct DB mutation dari frontend
- Hidden auto sync
- Cross module logic
- Over validation UI

---

# 9. UX RULES

- Max 2–3 klik
- Inline edit utama
- Creatable search wajib
- Tidak boleh tampilkan "N/A"

---

# FINAL STATEMENT

System ini dibuat untuk:
- mencegah kesalahan
- mempercepat kerja
- menjaga konsistensi data

