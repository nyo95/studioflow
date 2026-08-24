# PRD — StudioFlow Architecture Cleanup & Consolidation v2
**Status:** Final
**Scope:** Refactor / Cleanup / Consolidation
**Applies to:** StudioFlow Core, Master Data, BQ, Shared Core, UI Engine
**Primary rule:** **No feature expansion unless required to correct an existing architectural/business flaw.**

---

## 1. Objective

StudioFlow sudah memiliki banyak workflow dan domain logic yang bekerja, tetapi berkembang dengan pola implementasi yang berulang dan beberapa ownership yang kurang tegas.

Pekerjaan ini bertujuan untuk:

* merapikan codebase tanpa rewrite;
* mempertahankan business behavior yang sudah benar;
* mengoptimalkan schema;
* menghapus redundant tables/fields/utilities;
* menetapkan satu SSOT untuk konsep shared;
* menyederhanakan Master Data Pricing;
* memperbaiki BQ project-cost architecture;
* mengembangkan `ui_engine` menjadi actual layout/template engine;
* memperjelas dependency antar-domain;
* menghapus legacy setelah parity terbukti.

North star:

> **Satu konsep = satu ownership = satu canonical implementation.**

---

# 2. Non-Goals

Project ini **bukan** untuk:

* rewrite StudioFlow;
* membuat repository baru;
* mengganti Next.js;
* mengganti Prisma;
* mengganti PostgreSQL;
* redesign visual keseluruhan;
* mengubah formula BQ yang sudah benar;
* menambah ERP/accounting;
* menambah procurement system;
* membuat generic framework berlebihan;
* memindahkan semua business logic ke shared core.

Rule:

> **Centralize what is truly shared. Keep business rules inside their domain.**

---

# 3. Existing Foundation to Preserve

Jangan rewrite tanpa alasan:

* Authentication/session
* RBAC
* App access matrix
* Prisma/PostgreSQL
* Transaction pattern
* Action wrapper
* Master Data Brand/SKU/Party foundation
* Project Schedule snapshot semantics
* BQ standalone project
* BQ 3-level hierarchy
* BQ calculation engine
* BQ Object/Sub-object library
* Render annotations
* SketchUp integration foundation
* Audit history yang masih valid
* Integration/unit test coverage

---

# 4. Final Target Architecture

```text
                    ┌────────────────────┐
                    │     UI ENGINE      │
                    │ theme / template   │
                    │ layout / patterns  │
                    └─────────▲──────────┘
                              │
                    ┌─────────┴──────────┐
                    │    SHARED CORE     │
                    │ SSOT / utilities   │
                    │ platform services  │
                    └─────────▲──────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
         STUDIOFLOW       MASTER DATA         BQ
```

Allowed:

```text
StudioFlow  → Core
MasterData  → Core
BQ          → Core

StudioFlow  → UI Engine
MasterData  → UI Engine
BQ          → UI Engine
```

Forbidden:

```text
Core → StudioFlow
Core → MasterData
Core → BQ

UI Engine → StudioFlow business logic
UI Engine → MasterData business logic
UI Engine → BQ business logic
```

---

# 5. Source-of-Truth Architecture

Final ownership:

| Concept                      | SSOT                       |
| ---------------------------- | -------------------------- |
| User / Role / Permission     | Core / StudioFlow platform |
| Units                        | Shared Core                |
| Currency                     | Shared Core                |
| Measurement rules            | Shared Core                |
| Date/time policy             | Shared Core                |
| Formatting / normalization   | Shared Core                |
| Party                        | Master Data                |
| Brand                        | Master Data                |
| SKU                          | Master Data                |
| SKU Current Price            | Master Data                |
| Work / Service               | Master Data                |
| Canonical Categories         | Master Data                |
| Samples                      | Master Data                |
| StudioFlow Project           | StudioFlow                 |
| Project Phase                | StudioFlow                 |
| Task                         | StudioFlow                 |
| Project Schedule             | Project snapshot           |
| BQ Project                   | BQ                         |
| BQ Project Cost Database     | BQ Project                 |
| BQ Breakdown                 | BQ                         |
| BQ Project Local Material    | BQ                         |
| BQ Object/Sub-object Library | BQ                         |
| Historical changes           | Audit                      |
| Document-used value          | Snapshot                   |

---

# 6. Shared Core

Create/strengthen:

```text
src/core/
  reference/
  utilities/
  platform/
  rbac/
```

---

## 6.1 Unit Dictionary

All business modules must use one canonical unit vocabulary.

No uncontrolled duplicates such as:

```text
sheet
Sheet
lembar
sht
sqm
m2
M²
```

Conceptual definition:

```text
UnitDefinition
- id
- symbol
- label
- aliases
- dimension
- precision
```

Examples:

```text
PCS
SET
SHEET
ROLL
M
M2
M3
MM
CM
LS
HOUR
DAY
```

Dimensions:

```text
COUNT
LENGTH
AREA
VOLUME
TIME
LUMP_SUM
```

Aliases are used for import/search/input normalization.

Canonical ID is used internally.

---

# 7. Measurement Engine

One reusable measurement implementation.

Responsibilities:

```text
mm ↔ cm ↔ m
length
area
volume
purchase conversion
dimension normalization
```

Shared functions conceptually:

```text
convertMeasurement()
calculateArea()
calculateVolume()
normalizeMeasurement()
```

Pricing UI may provide dimension calculators, but mathematical rules must come from this shared engine.

---

# 8. Currency & Money

Canonical currencies:

```text
IDR
SGD
USD
```

Each definition may contain:

```text
code
symbol
decimalPlaces
locale
roundingPolicy
```

Shared:

```text
formatMoney()
parseMoney()
roundMoney()
```

Business calculation must not depend on presentation formatter.

---

# 9. Date & Time

Establish one application timezone policy.

Shared:

```text
formatDate()
formatDateTime()
formatRelativeDate()
```

Remove independent `toLocaleDateString()` / locale handling from business components where possible.

---

# 10. Normalization

One implementation for:

```text
normalizeName()
normalizeCode()
normalizeSearchText()
trimOrNull()
emptyToNull()
normalizeUnit()
```

Especially important for:

* search;
* Excel import;
* categories;
* units;
* codes;
* brand/SKU matching.

---

# 11. Shared Provenance Vocabulary

Canonical vocabulary:

```text
MASTER_DATA
PROJECT_LOCAL
SNAPSHOT
MANUAL_OVERRIDE
LIBRARY
```

Domains may extend this when necessary.

Do not create multiple names for identical concepts.

---

# 12. Schema Optimization Pass

Before migrating domains, perform a complete schema audit.

Every table/field classified as:

```text
KEEP
NORMALIZE
CENTRALIZE
DERIVE
MERGE
REMOVE
```

Rules:

* derived data should not become second mutable SSOT;
* duplicated ownership must be removed;
* unused historical fields should not remain merely because they once existed;
* remove only after runtime/data parity is verified;
* migrations must be additive first where practical.

---

# 13. Master Data

Master Data is canonical office information.

Contains:

```text
Party
Brand
SKU
Category
SKU Price
Work / Service
Sample
```

---

# 14. SKU Responsibility

SKU represents product identity and costing profile.

Conceptually:

```text
SKU
- code
- name
- brand
- category
- specification
- dimensions
- base unit
- usage unit
- purchase unit
- conversion
- default waste
- minimum order
- rounding increment
- supplier/reference metadata if required
```

SKU must not accidentally change identity because a pricing record is updated.

---

# 15. Final Pricing Model

> **❌ DICABUT OWNER 2026-08-24 (keputusan final sesi takeover, ❓U1/U3).**
> Bagian §15–§18 tidak berlaku. Arah final: **multi-supplier** — setiap SKU
> boleh punya beberapa harga berlaku satu per supplier; BQ memilih
> supplier-price saat penarikan dan membekukannya sebagai snapshot immutable.
> Kontrak `SkuPrice_current_uniq` (SKU × supplier) tetap berlaku. Sisa kerja
> pricing yang disetujui: validasi unit harga vs `purchase_unit`, kolom
> `updated_by_id`, perbaikan dokumentasi.

This is a key architecture decision.

## 15.1 One SKU = One Canonical Current Price

Business requirement:

> Master Data only needs to answer: **what is the office-approved current price of this SKU?**

Target:

```text
SKU
  1 ─── 0..1 Current Price
```

Conceptual price record:

```text
SkuPrice
- sku_id UNIQUE
- amount
- currency
- updated_at
- updated_by_id
- updated_by_name
```

Optional source/reference metadata may exist only if useful.

Do not retain unnecessary pricing lifecycle complexity such as:

```text
multiple current supplier prices
is_current
valid_to
price selection algorithm
```

unless future real business requirements explicitly require them.

---

# 16. Price Unit Ownership

Price should not repeat data unnecessarily.

Costing identity belongs primarily to SKU:

```text
usage_unit
purchase_unit
conversion
```

Therefore Price generally stores:

```text
amount
currency
```

and uses SKU purchase-unit semantics.

If a supplier quotation arrives in a different unit, normalize it before committing the canonical price.

---

# 17. Price History

Price history does **not** require multiple active historical `SkuPrice` records.

Separate three concerns:

```text
CURRENT STATE
→ SkuPrice

CHANGE HISTORY
→ Audit

VALUE USED IN DOCUMENT
→ Snapshot
```

Example:

```text
Current Master Data:
Rp370,000

Audit:
Rp350,000 → Rp370,000
Updated by Staff A
24 Aug 2026

Existing BQ:
snapshot_price = Rp350,000
```

Historical BQ remains reproducible without making Master Data Pricing itself complicated.

---

# 18. Supplier vs Price

Supplier information is not automatically price ownership.

Conceptually:

```text
SKU
├─ supplier/reference
└─ canonical office price
```

Estimator should not need to decide:

> Supplier A or Supplier B price?

unless supplier quotation comparison becomes a separate future requirement.

For current StudioFlow:

> **Master Data Price is the canonical office cost input.**

---

# 19. Work / Service

Work/service remains separate canonical pricing entity.

Conceptually:

```text
Work
- code
- name
- category
- unit
- price
- scope note
- vendor/reference
- has_material if needed
```

Do not fabricate material BOM for a commercial lump-sum/material+labor quotation.

---

# 20. Audit Platform

Refactor audit to be domain-neutral.

Conceptual:

```text
recordAudit({
  domain,
  entityType,
  entityId,
  action,
  actorId,
  before,
  after,
  metadata
})
```

Domains:

```text
STUDIOFLOW
MASTER_DATA
BQ
```

Do not require a BQ entity to pretend it belongs to StudioFlow Project.

Audit answers:

> **What changed? Who changed it? When?**

Snapshot answers:

> **What value did this project/document use?**

They are separate responsibilities.

---

# 21. Platform Action Contract

Retain centralized action wrapper.

Every mutation should consistently handle:

```text
validation
authentication
authorization
transaction
business validation
audit
error mapping
result
```

Canonical errors:

```text
VALIDATION_ERROR
NOT_FOUND
FORBIDDEN
CONFLICT
BUSINESS_RULE
LOCKED
```

Never expose raw Prisma errors.

---

# 22. Soft Delete

Canonical semantic:

```text
deleted_at = NULL
→ active

deleted_at != NULL
→ deleted
```

Shared helper/convention permitted.

Business-level restore/delete rules remain domain-owned.

---

# 23. Search / Pagination Contract

Standard request:

```text
query
page
pageSize
sort
filters
```

Standard result:

```text
items
page
pageSize
total
pageCount
```

Do not force all domains into one generic repository.

Only interface behavior is shared.

---

# 24. BQ Architecture

BQ remains standalone from StudioFlow Project.

Core hierarchy stays:

```text
L1 OBJECT
└─ L2 SUB-OBJECT
   ├─ L3 MATERIAL
   └─ L3 SERVICE
```

No fourth hierarchy level.

---

# 25. BQ Calculation Engine

Existing `calc.ts` remains canonical.

Do not duplicate BQ arithmetic elsewhere.

Order remains:

```text
material quantity
→ waste
→ conversion
→ L2 multiplier
→ L3 cost

Σ L3
→ L2 cost

Σ L2
→ object base cost

base + markup
→ object unit rate

unit rate × L1 qty
→ object total
```

Purchase rounding remains applied at the correct aggregated purchasing stage.

Existing regression values remain acceptance gates.

---

# 26. BQ Project Cost Database

Introduce/normalize a proper project-level cost source.

Architecture:

```text
MASTER DATA
     │ snapshot
     ▼
BQ PROJECT COST DATABASE
     │
     ▼
BQ BREAKDOWN
```

Project Cost Database contains:

```text
ProjectMaterial
ProjectService
```

Sources:

```text
MASTER_DATA
PROJECT_LOCAL
```

---

# 27. BQ Master Data Snapshot

When estimator imports a Master Data SKU:

```text
Master Data SKU
Current Price: Rp350,000
        │
        ▼
Project Material
snapshot_price: Rp350,000
source: MASTER_DATA
snapshot_at: timestamp
```

Future Master Data changes must **not** modify the project automatically.

---

# 28. BQ Project-Local Cost

If Master Data is incomplete, estimator must continue working.

Estimator may create:

```text
Project Material
Project Service
```

with source:

```text
PROJECT_LOCAL
```

This does not write to Master Data.

It can later be:

* matched;
* requested;
* promoted through an explicit controlled workflow.

No BQ workflow may be blocked merely because Master Data staff has not yet entered an item.

---

# 29. BQ Cost Refresh

*(Dicabut oleh owner pada sesi ratifikasi 2026-08-24 — lihat catatan di bawah.)*

> **KEPUTUSAN OWNER 2026-08-24:** bagian ini TIDAK berlaku dalam bentuk aslinya.
> BQ snapshot tidak pernah refresh dari Master Data — tidak ada "Update
> available", tidak ada Refresh selected/Refresh all. Harga current diambil
> sekali saat baris ditarik ke project; existing snapshot tidak disentuh siapa
> pun. Suntingan manual `is_manual_override` tetap jalur ubah yang sah.

If:

```text
Project snapshot = Rp350,000
Master Data now = Rp370,000
```

BQ may show:

```text
Update available
```

Actions:

```text
Refresh selected
Refresh all
Keep project values
```

~~Never silent-sync.~~ *(diganti keputusan di atas)*

---

# 30. BQ Line Snapshot

L3 remains document snapshot.

It stores enough information to reproduce calculation:

```text
identity snapshot
unit snapshot
conversion snapshot
price snapshot
waste snapshot
source
snapshot timestamp
manual override state
```

Do not retain redundant values that provide no reproducibility benefit.

---

# 31. BQ Lifecycle

Create one central guard:

```text
assertBqProjectEditable()
```

Minimum rules:

```text
deleted project → reject mutations
archived project → reject mutations
locked object → reject descendant mutations
```

Enforced server-side.

Not just hidden buttons.

---

# 32. BQ Ordering

Remove ambiguous ordering behavior.

Concurrent inserts must not create unstable ordering.

Use a deterministic strategy appropriate for internal-scale usage.

Do not overengineer distributed ordering.

---

# 33. BQ Library

Keep separate:

```text
Object Library
Sub-object Library
```

Users can:

```text
Save Object to Library
Save Sub-object to Library
```

Library is a reusable recipe.

When instantiated:

```text
Library Recipe
→ resolve through Project Cost Database
→ create project-owned structure
```

Project edits do not silently mutate template.

---

# 34. StudioFlow Project Snapshot Rules

Project Schedule remains a project-owned snapshot.

Flow:

```text
Master Data / Library
        ↓ instantiate
Project Schedule Snapshot
```

No live coupling.

Explicit refresh only.

Project must remain usable even if upstream item is later deleted or changed.

---

# 35. UI Engine v2

Current UI Engine must evolve into:

> **Theme + Primitives + Patterns + Layouts + Templates**

Target:

```text
src/ui_engine/
  theme/
  tokens/
  primitives/
  patterns/
  layout/
  templates/
```

---

# 36. UI Engine Rules

UI Engine must not know:

```text
PhaseName
DIC
DRIC
SKU
BQ Object
Project business lifecycle
```

It may know:

```text
navigation item
slot
badge tone
page title
sidebar
toolbar
content
layout geometry
responsive behavior
```

---

# 37. Theme

Theme owns:

```text
typography
colors
spacing
radius
shadow
density
header height
rail widths
canvas
```

Hardcoded geometry such as:

```text
78px
256px
top-14
```

should derive from theme/layout tokens.

Domain-specific configuration such as RenderBoard label geometry does not belong in global design system config.

---

# 38. Primitive Layer

Keep existing primitives behind:

```text
@/ui_engine
```

Examples:

```text
Button
Input
Dialog
Select
Table
Tabs
Checkbox
Tooltip
```

Application code should not bypass engine primitives without reason.

---

# 39. Shared UI Patterns

Add reusable patterns:

```text
SearchPicker
CreatablePicker

InlineTextCell
InlineNumberCell
InlineSelectCell

DataTable
Pagination

EmptyState
LoadingState
ErrorState

ConfirmAction
```

Domain components remain adapters:

```text
SkuPicker
BrandPicker
PartyPicker
WorkPicker
```

---

# 40. Generic Status Component

UI Engine receives tone:

```text
neutral
info
success
warning
critical
```

Example:

```text
<StatusBadge tone="warning" />
```

Mapping belongs to domain:

```text
PhaseStatus → tone
SkuStatus → tone
SampleStatus → tone
BqProjectStatus → tone
```

UI Engine must not contain lists like:

```text
ON_REVIEW_CLIENT
READY_FOR_NEXT
DISCONTINUED
```

---

# 41. AppShell

One shared shell should replace duplicated StudioFlow/MasterData/BQ chrome.

Responsibilities:

```text
canvas
top header
app switcher
outer navigation
main viewport
responsive behavior
optional footer
```

Target:

```text
<AppShell
  app={appDefinition}
  navigation={navigation}
>
  {children}
</AppShell>
```

Sub-app layouts retain authorization responsibility but no longer duplicate visual shell implementation.

---

# 42. UI Template Engine

Required page templates:

```text
DashboardTemplate
DirectoryTemplate
DetailTemplate
WorkspaceTemplate
ProjectTemplate
SpreadsheetTemplate
SettingsTemplate
```

Templates use slots.

---

## DirectoryTemplate

For:

```text
SKU
Brand
Supplier
Sample
```

Slots:

```text
header
actions
search
filters
content
pagination
```

---

## SpreadsheetTemplate

For BQ.

Slots:

```text
toolbar
grid
inspector
summary
```

---

## WorkspaceTemplate

For:

```text
Render
Supervision
phase workspaces
```

Slots:

```text
navigation
primary
secondary
actions
```

---

## ProjectTemplate

Project-aware structurally, but not business-aware.

Receives context/navigation through slots or props.

---

# 43. Definition of UI Engine Success

UI Engine is successful when:

> Changing shell/template structure in one place changes every consumer of that template without editing every page.

This is the intended WordPress-template-like behavior.

---

# 44. Dependency Enforcement

Automated lint/import rules required.

Forbidden:

```text
src/core/** → src/subapps/**
src/core/** → src/extensions/**

src/ui_engine/** → src/subapps/**
src/ui_engine/** → domain-specific extensions
```

Exceptions require explicit architectural justification.

---

# 45. Cleanup of Repeated Utilities

Audit and consolidate repeated implementations of:

* currency formatting;
* number formatting;
* date formatting;
* measurement conversion;
* normalization;
* picker behavior;
* inline editing;
* pagination;
* status rendering;
* confirmations;
* audit writes;
* error mapping;
* soft-delete queries;
* ordering where semantics are identical.

Do not centralize domain-specific calculations merely because the code looks similar.

---

# 46. Documentation Hierarchy

Final authority order:

```text
1. Product PRD
2. Domain Contracts
3. Schema / migrations
4. Runtime implementation
5. Roadmap
6. Changelog
7. Archive
```

Old documents that contradict current decisions must be marked archived.

---

# 47. Migration Strategy

Never:

```text
delete old
→ build replacement
```

Use:

```text
identify behavior
→ add regression test
→ introduce canonical replacement
→ migrate consumers
→ verify parity
→ remove legacy
```

Database migrations should preserve recoverability.

---

# 48. Execution Roadmap

## R0 — Baseline Freeze

* no unrelated feature expansion;
* capture current schema;
* run typecheck/tests/integration;
* capture critical workflow acceptance cases;
* establish approved baseline.

**Exit:** known-good baseline.

---

## R1 — Schema & Ownership Audit

Audit StudioFlow, Master Data, BQ.

Classify:

```text
KEEP
NORMALIZE
CENTRALIZE
DERIVE
MERGE
REMOVE
```

Special focus:

* pricing;
* units;
* snapshots;
* duplicate metadata;
* audit references;
* legacy project links;
* redundant BQ recipe fields.

**Exit:** approved migration map.

---

## R2 — Shared Core SSOT

Implement:

* Unit Dictionary
* Measurement
* Currency
* Money
* Date/time
* Normalization
* Provenance vocabulary

No major visual changes.

---

## R3 — Platform Consolidation

Refactor:

* audit;
* action errors;
* pagination;
* soft-delete conventions;
* actor metadata;
* shared infrastructure.

---

## R4 — Pricing Simplification

Convert Master Data pricing to:

> **one canonical current price per SKU**

Requirements:

* unique SKU-price relationship;
* current price only;
* audit captures changes;
* existing BQ values remain snapshots;
* remove unused price lifecycle complexity after verification.

---

## R5 — UI Engine v2 Foundation

Create:

```text
theme
tokens
primitives
patterns
layout
templates
```

Remove business-domain knowledge.

No broad redesign.

---

## R6 — AppShell Migration

Migrate:

1. Master Data
2. BQ
3. StudioFlow

Remove duplicated shell code after parity.

---

## R7 — Template Migration

Introduce/migrate:

```text
Directory
Detail
Workspace
Project
Spreadsheet
Settings
Dashboard
```

Start with representative pages before bulk migration.

---

## R8 — Master Data Cleanup

* canonical unit integration;
* price simplification integration;
* picker consolidation;
* formatter consolidation;
* SKU/Price ownership correction;
* remove redundant local utility implementations.

---

## R9 — BQ Cleanup

* Project Cost Database;
* Master Data snapshots;
* Project-local data;
* lifecycle guards;
* provenance cleanup;
* ordering hardening;
* shared units/money;
* audit cleanup.

**Do not change BQ calculation result.**

---

## R10 — StudioFlow Cleanup

* shared date utilities;
* task interaction consolidation;
* generic templates;
* phase presentation mapping;
* remove obsolete layout wrappers;
* move StudioFlow-specific components out of UI Engine.

---

## R11 — Boundary Enforcement

Enable strict imports/lint guards.

Zero known violations.

---

## R12 — Legacy Purge

Remove:

* dead utilities;
* duplicated components;
* stale layout implementations;
* obsolete pricing schema;
* dead migrations compatibility where safely removable;
* obsolete docs;
* temporary files.

Only after all consumers migrated.

---

# 49. Acceptance Criteria

## Shared Core

* no duplicate unit dictionaries;
* no independent currency rules;
* common formatting/conversion uses one implementation.

## Pricing

*(§15–§18 dicabut 2026-08-24 — arah final multi-supplier; kriteria di bawah
diganti sesuai keputusan final.)*

* tepat satu harga berlaku per pasangan (SKU × supplier) — `SkuPrice_current_uniq`;
* price update records actor + timestamp;
* audit preserves before/after;
* price changes never mutate old BQ snapshots;
* unit harga divalidasi = `sku.purchase_unit` saat tulis.

## BQ

Estimator can:

```text
create BQ project
→ snapshot Master Data prices
→ create project-local material if unavailable
→ use both in breakdown
→ calculate
→ update Project Cost Database
→ explicitly refresh selected snapshots
```

No dependency on staff updating Master Data first.

*(Catatan ratifikasi 2026-08-24: langkah "explicitly refresh selected snapshots"
dicabut owner — snapshot tidak pernah refresh dari Master Data, lihat §29.)*

## UI Engine

* StudioFlow/MasterData/BQ share AppShell;
* templates are reusable;
* no domain statuses inside generic UI;
* hardcoded app-shell geometry centralized;
* UI Engine does not import business domains.

## Backend

* archived/deleted BQ cannot be mutated;
* permissions remain server-enforced;
* audit generic across domains;
* no raw DB errors leak to UI.

## Regression

Must pass:

```text
Prisma validate
typecheck
unit tests
integration tests
production build
boundary enforcement
```

Critical BQ calculation regression must remain unchanged.

---

# 50. Agent Guardrails

Implementation agent must **not**:

* introduce new product features opportunistically;
* rewrite working domains for stylistic reasons;
* change formula semantics;
* introduce microservices;
* create new SSOT for an existing canonical concept;
* duplicate compatibility implementations indefinitely;
* modify unrelated modules in the same work order;
* infer new business rules without explicit evidence.

When uncertain:

> **Preserve current behavior and simplify ownership, not behavior.**

---

# 51. Final Architecture Principles

### Canonical data

```text
Master Data = global facts
```

### Current pricing

```text
1 SKU = 1 canonical current price
```

### Historical change

```text
Audit = who changed what and when
```

### Project state

```text
Project/BQ = snapshots
```

### Missing canonical data

```text
Project Local = valid operational fallback
```

### Reusability

```text
Library = reusable recipe/template
```

### Shared concepts

```text
Core = one canonical utility/reference implementation
```

### Interface structure

```text
UI Engine = Theme + Components + Patterns + Layout + Templates
```

### Domain ownership

```text
StudioFlow logic stays StudioFlow
Master Data logic stays Master Data
BQ logic stays BQ
```

---

# 52. Final Definition of Done

Refactor selesai ketika codebase berubah dari:

```text
banyak cara untuk melakukan hal yang sama
```

menjadi:

```text
satu canonical way
+
domain-specific rules hanya di domain pemiliknya
```

tanpa user merasa aplikasinya dibangun ulang.

**StudioFlow setelah cleanup harus lebih kecil secara konseptual, lebih jelas ownership-nya, lebih sulit mengalami logic drift, dan lebih mudah dikembangkan tanpa menciptakan versi kedua dari utility, price rule, layout, atau source-of-truth yang sama.**

---

## Ratifikasi owner (sesi 2026-08-24)

Keputusan eksplisit owner saat PRD ini diratifikasi, mengikat di atas teks di atas:

1. ~~**§15–§18 (pricing): disetujui.**~~ **❌ DICABUT di hari yang sama** —
   keputusan final owner (jawaban ❓U1/U3): **multi-supplier dipertahankan**;
   setiap SKU boleh punya beberapa current price per supplier; BQ memilih
   supplier saat penarikan dan snapshot-nya immutable.
2. **§29 (cost refresh): dicabut dan diganti.** BQ snapshot tidak pernah refresh
   dari Master Data dalam bentuk apa pun; harga current diambil sekali saat
   baris ditarik; existing snapshot tidak disentuh.
3. **§20 (audit): konsolidasi fisik.** Satu tabel `AuditLog` generic lintas
   domain plus satu shared interface `recordAudit(...)`; `MasterDataAudit`
   digabung lewat migrasi terjadwal (R3).
4. **§46 (otoritas dokumen): diklarifikasi.** AGENTS.md hanya aturan kerja
   agent, bukan source of truth requirement produk; Product PRD otoritas
   tertinggi untuk requirement produk.

Keputusan tambahan sesi takeover (audit R1, 2026-08-24):

5. Unit harga wajib = `sku.purchase_unit` (validasi app-layer saat tulis).
6. `SkuPrice.updated_by_id` ditambahkan sebagai plain column.
7. Timezone: simpan UTC, tampilkan default Asia/Jakarta; device-local bukan
   sumber kebenaran.
8. `ProjectTimeline` (write-only, nol pembaca) di-drop; fitur timeline masa
   depan dirancang ulang dari PRD baru bila dibutuhkan.
