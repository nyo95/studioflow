# PRD — StudioFlow Rebuild / Architecture & Product Simplification

**Status:** Final Rebuild PRD
**Scope:** StudioFlow Core + Master Data + BQ + Shared Core + UI Engine
**Strategy:** **Refactor existing repo, not rewrite from zero.**
**Primary Goal:** Menyederhanakan produk, memperjelas SSOT, memperbaiki UX, dan membersihkan arsitektur tanpa menghilangkan behavior yang sudah benar.

---

# 1. Product Vision

StudioFlow harus menjadi:

> **Internal Operating System untuk design studio**, bukan generic project-management / ERP.

User harus merasa:

> “Saya sedang mengerjakan proyek.”

Bukan:

> “Saya sedang mengisi sistem.”

Tiga domain utama:

```text
MASTER DATA
= canonical office data / SSOT

STUDIOFLOW
= project & design workflow

BQ
= estimating / costing workspace
```

Hubungannya:

```text
                 MASTER DATA
                     SSOT
              ┌───────┴───────┐
              ▼               ▼
         STUDIOFLOW            BQ
        project use        costing use
              │               │
              ▼               ▼
          SNAPSHOT          SNAPSHOT
```

**Expose data, never create hidden live coupling.**

---

# 2. Rebuild Strategy

Tidak membuat aplikasi baru.

Gunakan:

```text
Current Repo
→ Freeze Behavior
→ Audit Architecture
→ Establish Contracts
→ Refactor Incrementally
→ Migrate Consumers
→ Verify Parity
→ Remove Legacy
```

Dilarang:

```text
delete first
→ rebuild later
```

Wajib:

```text
introduce
→ migrate
→ test
→ verify
→ remove
```

---

# 3. Non-Negotiable Product Principles

### 3.1 One Canonical Source, Many Snapshots

```text
MASTER DATA = FACT
PROJECT     = SNAPSHOT
LIBRARY     = REUSE
```

---

### 3.2 No Workflow May Be Blocked by Master Data

Jika canonical data belum tersedia:

* StudioFlow tetap bekerja.
* BQ tetap bekerja.
* Project-local data diperbolehkan.

Master Data tidak boleh menjadi bottleneck operasional.

---

### 3.3 No Silent Upstream Update

Perubahan Master Data tidak boleh mengubah project/BQ lama.

---

### 3.4 Centralize Infrastructure, Not Business Logic

Shared Core boleh punya:

* Unit
* Currency
* Money
* Date/time
* Measurement
* Normalization
* Audit
* Errors
* Pagination

Tetapi:

* BQ calculation tetap BQ.
* StudioFlow phase logic tetap StudioFlow.
* pricing behavior tetap Master Data.

---

# 4. Target Architecture

```text
                  UI ENGINE
       Theme / Patterns / Templates
                        ▲
                        │
                  SHARED CORE
       Reference / Utilities / Platform
                        ▲
             ┌──────────┼──────────┐
             │          │          │
        STUDIOFLOW  MASTERDATA     BQ
```

Allowed:

```text
Domains → Core
Domains → UI Engine
```

Forbidden:

```text
Core → Domain
UI Engine → Domain business logic
```

---

# 5. Shared Core SSOT

Target:

```text
src/core/
  reference/
  utilities/
  platform/
  rbac/
```

---

## 5.1 Unit Dictionary

Canonical unit vocabulary.

Examples:

```text
PCS
SET
SHEET
ROLL

MM
CM
M
M2
M3

LS
HOUR
DAY
PERSON_DAY
```

Definition:

```text
UnitDefinition
- id
- symbol
- label
- dimension
- aliases
- precision
```

Aliases:

```text
sheet
sheets
lembar
sht
```

semuanya resolve ke:

```text
SHEET
```

Storage/comparison menggunakan canonical ID.

---

# 6. Measurement Utility

Single reusable engine untuk:

```text
mm ↔ cm ↔ m
length
area
volume
conversion
dimensions
```

Tidak boleh setiap domain membuat conversion engine sendiri.

---

# 7. Currency & Money

Canonical currency dictionary:

```text
IDR
SGD
USD
```

Shared:

```text
formatMoney()
parseMoney()
roundMoney()
```

Money calculation tidak bergantung pada UI formatter.

---

# 8. Date / Time Policy

Final rule:

> **Store UTC, display Asia/Jakarta by default.**

```text
DATABASE
→ UTC

SHARED CORE / UI
→ Asia/Jakarta (WIB)
```

Jangan mengikuti timezone browser sebagai source of truth.

---

# 9. Normalization

Shared:

```text
normalizeName()
normalizeCode()
normalizeSearchText()
normalizeUnit()
emptyToNull()
trimOrNull()
```

Dipakai oleh:

* search
* import
* Master Data
* BQ
* StudioFlow

---

# 10. Audit Architecture

Audit dikonsolidasikan **secara fisik dan interface**.

Target:

```text
AuditLog
- id
- domain
- entity_type
- entity_id
- action
- actor_id
- before_json
- after_json
- metadata_json
- created_at
```

Domains:

```text
STUDIOFLOW
MASTER_DATA
BQ
```

Audit menjawab:

> siapa mengubah apa dan kapan.

Snapshot menjawab:

> nilai apa yang dipakai project pada waktu itu.

Jangan campur dua fungsi tersebut.

---

# 11. Schema Optimization

Seluruh Prisma schema harus diaudit.

Setiap table/field diklasifikasikan:

```text
KEEP
NORMALIZE
CENTRALIZE
DERIVE
MERGE
REMOVE
```

Tujuan:

* hapus duplicate ownership;
* hilangkan obsolete fields;
* turunkan derived data menjadi calculation bila tidak perlu disimpan;
* hapus dead tables jika benar-benar tidak punya consumer.

---

## 11.1 ProjectTimeline

Jika audit membuktikan:

* write-only;
* zero active reader;
* tidak dipakai audit/report;
* tidak required PRD;

maka:

> **drop `ProjectTimeline` dan hapus write path terkait.**

Jangan mempertahankan dead schema karena “mungkin nanti”.

---

# 12. Master Data Product

Master Data adalah office-wide canonical source.

Contains:

```text
Party
Supplier/Vendor
Brand
Category
SKU
SkuPrice
Work / Service
Sample
```

---

# 13. Party / Supplier Model

Party dapat mempunyai beberapa role.

Contoh:

```text
SUPPLIER
VENDOR
SUBCON
BRAND_OWNER
CONTACT
```

Hindari duplicate company records hanya karena role berbeda.

---

# 14. SKU

SKU adalah product identity + costing profile.

Conceptual:

```text
SKU
- code
- name
- brand
- category
- specification
- dimensions

- usage_unit
- purchase_unit
- conversion

- default_waste
- MOQ
- rounding_increment

- media
```

---

# 15. Final Master Data Pricing Model

Keputusan final:

> **One current price per SKU × Supplier.**

Bukan:

> one price globally per SKU.

Dan bukan:

> unlimited historical price rows sebagai current business state.

Example:

```text
SKU A
├─ Vendor 1 → Rp6.000
├─ Vendor 2 → Rp10.000
└─ Vendor 3 → Rp7.500
```

Schema concept:

```text
SkuPrice
- id
- sku_id
- supplier_party_id
- amount
- currency
- updated_at
- updated_by_id
```

Constraint:

```text
UNIQUE(sku_id, supplier_party_id)
```

Artinya:

```text
SKU + Supplier = one current price
```

---

# 16. Price History

Current:

```text
SkuPrice
```

History:

```text
AuditLog
```

BQ historical cost:

```text
BQ Snapshot
```

Jadi tidak perlu membuat historical pricing lifecycle yang rumit hanya untuk menyimpan perubahan lama.

---

# 17. Price Unit Rule

Final rule:

> **SkuPrice selalu menggunakan `sku.purchase_unit`.**

Example:

```text
SKU:
usage_unit    = m2
purchase_unit = sheet
conversion    = 2.88 m2 / sheet

Vendor A:
Rp350.000 / sheet

Vendor B:
Rp370.000 / sheet
```

Jangan simpan:

```text
Vendor A = /sheet
Vendor B = /m2
```

Jika quotation supplier datang `/m2`, normalisasi dahulu ke purchase unit sebelum commit.

Idealnya `SkuPrice.unit` bukan SSOT terpisah.

---

# 18. Updated By

`SkuPrice` wajib menyimpan:

```text
updated_by_id
updated_at
```

Display name dapat di-resolve dari actor/user.

Optional name snapshot boleh tetap ada sebagai fallback bila dibutuhkan audit display.

---

# 19. Work / Service Pricing

Work tetap separate entity.

Example:

```text
Painting work
Installation
Carpentry labor
Custom fabrication
```

Work price tidak harus dipecah menjadi fake material BOM jika quotation memang commercial lump-sum/material+labor.

---

# 20. Master Data Exposure

Master Data harus menjadi reusable typed source untuk:

```text
StudioFlow
BQ
```

Tetapi consumer tidak boleh menulis langsung ke Master Data sesuka hati.

Target:

```text
Master Data
→ Query/API/Service Boundary
→ Consumer
```

Bukan:

```text
BQ → Prisma MasterData direct everywhere
StudioFlow → Prisma MasterData direct everywhere
```

---

# 21. StudioFlow Product Simplification

StudioFlow tetap menggunakan design lifecycle:

```text
MOODBOARD
LAYOUT
DESIGN 3D
CD
SUPERVISION
COMPLETED
```

Tetapi UX harus lebih ringan.

Phase tidak boleh terasa seperti rigid workflow engine.

---

# 22. Phase Simplification

User-facing presentation disederhanakan.

Status utama:

```text
Working
Internal Review
Client Review
Approved
Done
```

Phase tetap sebagai context:

```text
Moodboard
Layout
3D
CD
Supervision
```

Tetapi user tidak harus “menavigasi state machine” untuk bekerja.

Target:

> phase = work context, bukan bureaucracy.

---

# 23. Project Navigation

Project Home harus menjadi pusat.

Target mental model:

```text
Project
├─ Overview
├─ Tasks
├─ Design
├─ Schedule
├─ Material / FF&E
├─ Render
├─ MOM
└─ Supervision
```

Kurangi:

* duplicate navigation;
* redundant cards;
* stats yang tidak actionable;
* terlalu banyak state indicators.

---

# 24. Project Snapshot Architecture

Master Data/reference dapat digunakan dalam StudioFlow.

Tetapi project menyimpan snapshot jika historical consistency diperlukan.

Example:

```text
Master Data SKU
        ↓
Project Schedule Entry Snapshot
```

Jika Master Data SKU berubah/dihapus:

```text
Project lama tetap valid.
```

---

# 25. BQ Product Vision

BQ harus menjadi:

> **Excel replacement khusus estimator.**

Tidak boleh terasa seperti ERP form.

Priority:

1. speed;
2. inline editing;
3. keyboard usage;
4. clarity;
5. flexibility.

---

# 26. BQ Hierarchy

Final:

```text
L1 OBJECT
└─ L2 SUB-OBJECT
   ├─ L3 MATERIAL
   └─ L3 SERVICE
```

No L4.

---

# 27. L1 Object

Contains:

```text
code
name
qty
unit
markup
notes
lock
derived rate
total
```

---

# 28. L2 Sub-object

Example:

```text
Wall Display
├─ Main Body ×1
├─ Shelf ×5
├─ Drawer ×2
└─ Signage ×1
```

Each subobject has multiplier.

---

# 29. L3 Material

Contains:

```text
material
supplier/source
qty
usage unit
purchase unit
conversion
price snapshot
waste
cost
```

---

# 30. L3 Service

Contains:

```text
service
qty
unit
price snapshot
cost
```

No waste/conversion/MOQ semantics unless genuinely relevant.

---

# 31. Canonical BQ Calculation

Existing `calc.ts` remains canonical.

Concept:

```text
Material Qty
× Waste
× L2 Qty
× Price / Conversion
= Cost
```

Then:

```text
Σ Material
+ Σ Service
= Object Base Cost
```

Then:

```text
Base Cost
+ Markup
= Unit Rate
```

Then:

```text
Unit Rate × L1 Qty
= Object Total
```

Do not rewrite unless regression tests prove a defect.

---

# 32. BQ Snapshot Rule — Critical Invariant

Snapshot occurs **when data is pulled/selected**.

Example:

### Day 1

```text
Master Data
HPL Vendor A = Rp5.000
```

Pulled into:

```text
BQ Project A
Wall Panel → HPL
snapshot = Rp5.000
```

---

### Day 8

Master Data updated:

```text
HPL Vendor A = Rp10.000
```

Existing line remains:

```text
Wall Panel → Rp5.000
```

---

### Day 8 — same SKU used again

Another BQ line changes:

```text
Solid Surface
→ HPL Vendor A
```

New acquisition:

```text
snapshot = Rp10.000
```

So within **one BQ project**:

```text
HPL line #1 = 5.000
HPL line #2 = 10.000
```

This is valid.

---

# 33. No Refresh Existing BQ Snapshot

There must be:

```text
NO Refresh All
NO Refresh Selected
NO stale-price sync
NO auto-update
NO upstream propagation
```

Existing snapshot is immutable relative to Master Data.

If user chooses material again, that is a new acquisition event.

---

# 34. BQ Supplier Selection

If SKU has:

```text
Vendor 1 = 6.000
Vendor 2 = 10.000
Vendor 3 = 7.500
```

BQ picker should allow estimator to select:

```text
SKU + Supplier + Current Price
```

Example:

```text
HPL A
Vendor 1     6.000
Vendor 2    10.000
Vendor 3     7.500
```

After selected:

```text
supplier
supplier name
price
unit
conversion
timestamp
```

are snapshotted.

---

# 35. BQ Project-Local Data

Estimator may create material/service locally if Master Data is unavailable.

Source:

```text
PROJECT_LOCAL
```

Minimum project-local material:

```text
name
code optional
brand optional
supplier optional

usage unit
purchase unit
conversion
price
waste
MOQ
rounding
```

Does not modify Master Data.

---

# 36. BQ Project Cost Database

Project Cost Database remains useful as estimator-owned project workspace.

But it must not force:

```text
one SKU = one project-wide price forever
```

It may act as:

* project material list;
* local source;
* reusable selected cost entries.

Each L3 line still owns its own acquisition snapshot.

---

# 37. BQ Library

Reusable levels:

```text
Object Library
Sub-object Library
```

Commands:

```text
Save Object to Library
Save Sub-object to Library
```

Workflow:

```text
real estimator work
→ save recipe
→ reuse later
```

Not only blank-template creation.

---

# 38. BQ Copy-on-Write

When library item is instantiated:

```text
Library Recipe
→ Project-owned BQ structure
```

Editing project instance does not modify template automatically.

---

# 39. BQ Outputs

### Client BQ

Show:

```text
Object
Qty
Unit
Rate
Amount
```

Hide:

```text
supplier
raw material price
waste
markup detail
```

---

### Internal Detail

Show:

```text
L1/L2/L3
supplier
qty
unit
conversion
waste
snapshot price
cost
override
source
```

---

### Purchase Summary

Aggregate purchasing requirement.

---

# 40. BQ Revision

Minimum:

```text
Tender Rev 01
Tender Rev 02
Final Cost
```

No need to recreate Google Sheets-style granular version history.

---

# 41. BQ Backend Lifecycle

Central guard:

```text
assertBqProjectEditable()
```

Rules:

```text
deleted → no mutation
archived → no mutation
locked object → descendant mutation blocked
```

Server-side enforcement mandatory.

---

# 42. BQ UX Rebuild

BQ UI should behave like spreadsheet.

Required:

* inline text edit;
* inline number edit;
* inline select;
* keyboard navigation;
* rapid row creation;
* fast picker;
* predictable focus;
* expandable hierarchy;
* sticky/frozen relevant columns/header;
* minimal modal usage.

Avoid forcing estimator through CRUD forms.

---

# 43. UI Engine v2

Target:

```text
Theme
+
Primitives
+
Patterns
+
Layouts
+
Templates
```

Structure:

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

# 44. UI Engine Domain Purification

At foundation phase, domain knowledge must be removed.

Move out:

```text
PhaseLiveProvider
ProjectLiveProvider
PhaseReading
PhaseLockNotice
StudioFlow-specific Project components
business status mappings
```

UI Engine cannot know:

```text
MOODBOARD
DIC
SKU
BqObject
SampleStatus
```

---

# 45. StatusBadge

Wrong:

```text
StatusBadge("ON_REVIEW_CLIENT")
```

Correct:

```text
StatusBadge(tone="warning")
```

Domain owns:

```text
PhaseStatus → tone
SkuStatus → tone
BqStatus → tone
```

---

# 46. Shared UI Patterns

Examples:

```text
InlineTextCell
InlineNumberCell
InlineSelectCell

SearchPicker
CreatablePicker

DataTable
Pagination

EmptyState
LoadingState
ErrorState

ConfirmAction
```

Domain adapters may exist:

```text
SkuPicker
PartyPicker
WorkPicker
BrandPicker
```

---

# 47. AppShell

StudioFlow, Master Data, BQ must share application shell.

Target:

```tsx
<AppShell app={definition}>
  {children}
</AppShell>
```

Centralize:

* header;
* rail;
* content width;
* navigation frame;
* app switch;
* responsive behavior.

No duplicated copies of shell code.

---

# 48. Template Engine

UI Engine must become template-driven.

Templates:

```text
DashboardTemplate
DirectoryTemplate
DetailTemplate
WorkspaceTemplate
ProjectTemplate
SpreadsheetTemplate
SettingsTemplate
```

---

# 49. Template Execution Plan

During UI Engine foundation:

> create **contract/skeleton only**.

Define:

* directory;
* TS slots;
* template interfaces.

No broad page rewrite yet.

Full visual implementation/migration occurs during template migration phase.

---

# 50. SpreadsheetTemplate

Designed especially for BQ:

```text
Toolbar
Frozen Header
Grid
Optional Inspector
Summary
```

BQ should be the strongest test case for UI Engine's spreadsheet template.

---

# 51. DirectoryTemplate

Used for:

```text
SKU
Brand
Supplier
Samples
Services
```

Slots:

```text
Header
Actions
Search
Filters
Content
Pagination
```

---

# 52. WorkspaceTemplate

Used for:

```text
Render
Supervision
Design workspace
```

Slots:

```text
Navigation
Primary Content
Secondary Panel
Actions
```

---

# 53. AGENTS.md Authority

Final rule:

> **AGENTS.md governs AI behavior only.**

Examples:

```text
delegation
branch discipline
review process
test requirements
migration safety
agent permissions
```

Product requirements do not belong there.

If `AGENTS.md` contains product/business requirements and conflicts with PRD:

> **PRD wins.**

Authority by subject:

```text
AGENTS.md
→ Agent execution governance

FINAL PRD
→ Product/business truth

DOMAIN CONTRACTS
→ Detailed domain rules

SCHEMA
→ Technical implementation

CODE/TEST
→ Current implementation

ROADMAP
→ Execution order

CHANGELOG
→ History
```

Cleanup must move valid product rules out of `AGENTS.md`.

---

# 54. Execution Roadmap

Total:

> **R0–R12 = 13 stages**

---

## R0 — Baseline Freeze

* capture current schema;
* tests green;
* critical behavior regression baseline;
* freeze unrelated feature work.

---

## R1 — Schema & Ownership Audit

Classify:

```text
KEEP
NORMALIZE
CENTRALIZE
DERIVE
MERGE
REMOVE
```

Audit all domains.

---

## R2 — Shared Core SSOT

Implement:

* Unit;
* Currency;
* Money;
* Measurement;
* Date;
* Normalization;
* provenance.

---

## R3 — Platform Consolidation

Implement:

* generic Audit;
* action/error contract;
* pagination;
* soft delete;
* shared platform helpers.

---

## R4 — Pricing Cleanup

Finalize:

```text
SKU × Supplier = current price
```

* supplier stays in SkuPrice;
* current row per pair;
* updated_by;
* updated_at;
* unit follows SKU purchase unit;
* history via Audit.

---

## R5 — UI Engine v2 Foundation

* new architecture;
* remove domain knowledge;
* tone-only status;
* move StudioFlow components out;
* template contracts/skeleton only.

---

## R6 — AppShell Migration

Migrate:

```text
Master Data
BQ
StudioFlow
```

to one generic shell.

---

## R7 — Template Migration

Implement and adopt:

```text
Dashboard
Directory
Detail
Workspace
Project
Spreadsheet
Settings
```

---

## R8 — Master Data Cleanup

* canonical units;
* price integration;
* selector consolidation;
* remove redundant utilities;
* cleanup schema.

---

## R9 — BQ Cleanup & UX

* spreadsheet interaction;
* snapshot correctness;
* supplier-price picker;
* project-local cost;
* lifecycle guards;
* library workflow;
* remove refresh semantics.

---

## R10 — StudioFlow Simplification

* phase presentation simplification;
* Project Home;
* project navigation;
* task interaction cleanup;
* shared templates;
* remove duplicate UI behavior.

---

## R11 — Dependency Boundary Enforcement

Lint/build rules:

```text
core -X→ domains
ui_engine -X→ domains
```

Zero violations.

---

## R12 — Legacy Purge

Remove:

* dead schema;
* dead utilities;
* obsolete components;
* duplicate shells;
* dead docs;
* stale AGENTS product rules;
* temporary compatibility code.

Only after parity.

---

# 55. Definition of Done

R0–R12 complete only when:

### Architecture

* clear domain ownership;
* shared concepts centralized;
* no unwanted cross-domain imports;
* dead architecture removed.

### Master Data

* SSOT usable by both StudioFlow and BQ;
* multi-supplier pricing works;
* one current price per SKU × supplier;
* history auditable.

### BQ

* behaves like estimator spreadsheet;
* snapshot per acquisition event;
* old snapshots never upstream-refresh;
* same SKU may legitimately have different prices in one project;
* supplier selection explicit;
* project-local fallback works.

### StudioFlow

* project workflow simpler;
* phase presentation lighter;
* design workflow preserved;
* Master Data exposed cleanly.

### UI Engine

* common AppShell;
* reusable page templates;
* no domain knowledge;
* UI changes can propagate through templates.

### Regression

Required green:

```text
Prisma validate
TypeScript
Unit tests
Integration tests
Production build
Boundary enforcement
Critical workflow regression tests
```

---

# 56. Final Product Rule Summary

```text
Master Data
= canonical office information
```

```text
SKU × Supplier
= one current supplier price
```

```text
Audit
= historical changes
```

```text
BQ acquisition
= immutable snapshot at moment of pull
```

```text
Same SKU pulled later
= current price at that later moment
```

```text
Existing snapshot
= never refreshed from Master Data
```

```text
Project Local
= allowed operational fallback
```

```text
StudioFlow
= simplified design-project workflow
```

```text
BQ
= spreadsheet-first estimating tool
```

```text
UI Engine
= reusable template/layout engine
```

```text
Shared Core
= canonical cross-domain infrastructure
```

```text
AGENTS.md
= AI governance only
```

---

## Final North Star

> **Setelah rebuild, StudioFlow bukan menjadi aplikasi baru. Ia menjadi aplikasi yang sama secara tujuan, tetapi dengan arsitektur yang jauh lebih sederhana, UX lebih cepat, data ownership lebih jelas, Master Data benar-benar menjadi SSOT, BQ benar-benar bekerja dengan snapshot yang aman, dan UI Engine benar-benar menjadi fondasi reusable untuk seluruh aplikasi.**
