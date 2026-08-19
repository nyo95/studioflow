# PRD --- Master Data Redesign & Excel Round-Trip

**Status:** Execution-ready draft\
**Product:** Master Data Standalone Dev App\
**Primary source:** `design database masterdata.xlsx` (place the
workbook in the same folder as this PRD)\
**Supporting project context:** `README.md`, `ROADMAP.md`,
`CHANGELOG.md`\
**Audience:** Claude / coding agent + owner review\
**Priority:** Preserve business meaning first; improve staff workflow
second; optimize implementation third.

------------------------------------------------------------------------

## 0. Executive Summary

This application is the **Single Source of Truth (SSOT)** for office
Master Data covering:

-   brands
-   SKUs/materials
-   suppliers/vendors/subcontractors
-   contacts/sales
-   material prices
-   work/service prices
-   material + service commercial quotations
-   samples and related master-data relationships
-   Excel backup, manual editing, import, and round-trip synchronization

The redesign is primarily a **UX/domain-grain correction**, not a
wholesale rewrite of the business model.

### Core product principle

> **Change how staff interact with the data without changing what the
> Excel business model means.**

The workbook remains the authoritative reference for business concepts
and fields. The current database/schema is an implementation that may be
corrected where necessary. Any deviation from the workbook must be
explicit, justified, and approved.

### Non-negotiable anti-regression rule

Do not remove, merge, reinterpret, or silently change an existing
business concept merely because the new schema/UI appears:

-   cleaner
-   more normalized
-   simpler
-   smaller
-   easier to code

A proposed change is acceptable only when:

1.  the business meaning remains representable;
2.  the Excel logic remains recoverable;
3.  staff workflow becomes equal or simpler;
4.  relational integrity improves or remains safe;
5.  import/export semantics remain safe.

------------------------------------------------------------------------

# 1. Source of Truth & Evidence Hierarchy

Use these sources in this order:

1.  **Owner decisions in this PRD** --- highest priority for decisions
    explicitly finalized here.
2.  **`design database masterdata.xlsx`** --- business-model reference
    for Table 1--4.
3.  **Current `prisma/schema.prisma` + migrations** --- implementation
    evidence.
4.  **Current UI/actions** --- existing behavior to audit for
    regression.
5.  **ROADMAP.md** --- history and rationale; do not treat unresolved
    backlog proposals as final requirements.
6.  **CHANGELOG.md** --- implementation history.

If two sources conflict:

-   do not silently choose;
-   identify the conflict;
-   preserve the business meaning;
-   ask the owner if the conflict cannot be resolved from this PRD.

------------------------------------------------------------------------

# 2. Business Model

## 2.1 Brand → SKU

A **Brand** owns many **SKU** records.

Example:

``` text
TACO
├── TH231AA
├── TH005AC
└── ...
```

A SKU contains product/material-level information such as:

-   SKU code
-   material/product name
-   category
-   specification
-   dimensions
-   unit
-   color/motif/finishing where applicable
-   media/links where applicable

### Important workflow decision

**SKU is created only from the Price workflow.**

There is no standalone "Create SKU" action from the Brand page.

Reason:

-   a SKU is normally entered because staff has a material
    price/commercial record to enter;
-   this avoids orphan SKUs;
-   it keeps Brand CRUD small;
-   it makes quick entry natural.

This is an intentional UX decision. The Excel workbook does not
literally mandate this click path. The implementation must therefore
verify that no business capability present in the workbook is lost.

------------------------------------------------------------------------

## 2.2 Brand ↔ Supplier

A Brand can be supplied by multiple suppliers.

Example:

``` text
TACO
├── Toko A
└── Toko B
```

This relationship answers:

> "Where can we buy/source this brand?"

It is **not** the price record.

The existing `BrandSupplier` concept should remain separate.

### Do NOT add `sku_id` to BrandSupplier

Do not turn it into:

``` text
BrandSupplier(
  brand_id,
  supplier_id,
  sku_id
)
```

unless a future, explicitly approved requirement appears for:

> "This supplier is known to provide this specific SKU even though there
> is no price record."

For the current product, SKU-specific commercial availability is
represented by price.

------------------------------------------------------------------------

## 2.3 SKU Price

Price answers:

> "For this exact SKU, what price do we get from this supplier?"

Example:

``` text
TACO
└── TH231AC
    ├── Toko A → Rp150.000
    └── Toko B → Rp120.000
```

Conceptually:

``` text
BrandSupplier
TACO ↔ Toko A
TACO ↔ Toko B

SkuPrice
TH231AC ↔ Toko A ↔ Rp150.000
TH231AC ↔ Toko B ↔ Rp120.000
```

Never collapse these two relationships.

------------------------------------------------------------------------

# 3. Party / Supplier / Vendor Model

## 3.1 One Party, multiple roles

A single party can have multiple roles.

Examples:

``` text
Toko Material XYZ
- Supplier
- Retail Store

CV ABC Interior
- Supplier
- Subcontractor
- Service Vendor

PT TACO Indonesia
- Supplier
- Manufacturer
```

The UI must therefore use **one Add Party/Supplier/Vendor entry point**,
with role selection inside the modal.

Do not force staff to choose a mutually exclusive "Material" or "Jasa"
tab when the same party can perform both.

------------------------------------------------------------------------

## 3.2 "Company Categories" from Excel must not be lost

The Excel workbook contains values such as:

-   Supplier
-   Subcon
-   Vendor
-   Retail Store
-   Manufacture

Do **not** reinterpret this as:

> "material categories sold by the supplier."

Do not create `PartyCategory` merely to store HPL/SPC/Sanitary.

Material categories belong to the material/brand/SKU domain.

### Required audit

Before coding, inspect the existing `PartyRole` enum/model and determine
whether it can represent all required business meanings.

If yes: - reuse it.

If no: - propose the smallest correction.

Do not silently discard "Retail Store", "Manufacture", "Subcon", etc.

### Role vs business nature

Keep these concepts distinct unless the existing model proves they are
intentionally the same:

**Role toward the office** - Supplier - Subcontractor - Service Vendor -
etc.

**Business nature** - Manufacturer - Retailer - Distributor -
Contractor - etc.

Only introduce a separate business-nature field/entity if a real
workflow/reporting need exists.

------------------------------------------------------------------------

# 4. Contacts & Sales

A Party can have multiple contacts/sales.

The model must support:

1.  general supplier contact;
2.  brand-specific sales contact.

Example:

``` text
Toko A
├── Asep — general
├── Budi — TOTO
└── Citra — TACO
```

If `PartyContact.brand_id` already exists, expose it through the UI
rather than filtering it away.

The owner must be able to answer:

> "Who is our TACO sales contact at Supplier A?"

without using notes/free text.

------------------------------------------------------------------------

# 5. Materials Page

## 5.1 Page purpose

The Materials page is a **Brand browser**.

Primary grain:

> one table row = one Brand

Not one SKU.

## 5.2 Required behavior

The main table must support:

-   search
-   sort
-   filter
-   pagination where needed
-   expandable/detail view for the Brand's SKUs
-   clear supplier count / SKU count where useful
-   completeness/needs-attention indicators where useful

Example:

``` text
Brand       Category       SKU Count   Suppliers
TACO        HPL            24          4
TOTO        Sanitary       18          3
VALPRA      Sink            7          2
```

Expanding TACO reveals its SKUs.

SKU rows are **read-only from this page**.

## 5.3 Brand CRUD

Brand modal contains only brand-level information, for example:

-   brand name
-   owner/party where applicable
-   brand-level categories
-   links
-   brand-level metadata
-   brand/supplier relationship
-   brand-specific contacts where appropriate

Do not put these in Brand CRUD:

-   SKU code
-   dimensions
-   SKU unit
-   SKU specification
-   price
-   price unit
-   supplier-specific price

------------------------------------------------------------------------

# 6. Price Page --- Main Data Entry Hub

Price is the operational center for commercial entries.

There are three commercial types:

1.  **Material only**
2.  **Material + service**
3.  **Service/work only**

The UI should make the three concepts obvious without requiring staff to
understand database terminology.

------------------------------------------------------------------------

## 6.1 Material Price

Staff flow:

``` text
Add Material Price
→ Search SKU
→ if missing: Create SKU inline
→ if Brand missing: Create Brand inline
→ choose Supplier
→ enter price/unit/specification as applicable
→ save
```

The form should make the relationship obvious:

``` text
SKU
[ TH231AC ]

Brand
TACO

Supplier
[ Toko A ]

Price
[ 150.000 ]

Unit
[ m² ]
```

Brand may be derived from the SKU and should not be redundantly typed
unless required by the schema.

------------------------------------------------------------------------

## 6.2 Inline quick entry

Every searchable master-data selector should avoid dead ends.

Example:

``` text
Brand
[ Search TACO... ]

No result

+ Create "TACO"
```

After creating:

-   continue the original workflow;
-   mark the newly created record as potentially incomplete;
-   do not force the user to abandon the price entry;
-   do not duplicate the record if the same name already exists.

Quick entry should create the **smallest valid record** and return it to
the current workflow.

------------------------------------------------------------------------

# 7. Material + Service = Single Commercial Quotation

This is a finalized business decision.

Example:

> "Penarikan listrik --- includes cable/material/supporting material +
> installation labor."

This is **one commercial quotation/rate**.

It is not:

-   a BOM
-   a list of component SKUs
-   a material price plus a separate labor price
-   an accounting decomposition

If another scope is needed, create another commercial entry.

Example:

``` text
Penarikan listrik
Penarikan data
```

are two separate entries.

### Schema implication

Do **not** add a `WorkPrice → Sku` relationship merely to model included
material.

The work price represents the commercial offer as quoted by the vendor.

The current `WorkPrice.kind` concept can distinguish:

-   material + labor
-   labor/work-only

but its exact UI terminology must be understandable to staff.

------------------------------------------------------------------------

# 8. Work / Service Price

A work/service price should be entered around:

-   vendor/supplier
-   vendor/service category
-   work category
-   work name/items
-   specification
-   dimensions where applicable
-   quantity
-   unit
-   price
-   project reference
-   notes

The workbook's Table 3 and Table 4 concepts must remain representable.

### Important audit

The existing enum `LABOR_ONLY` must be checked against actual Table 4
semantics.

If Table 4 contains vendor/fabrication/work offerings that are not
literally "labor", do not blindly expose confusing terminology to staff.

Prefer:

-   database compatibility where necessary;
-   clearer UI vocabulary if needed.

Do not rename schema just for UI wording unless approved.

------------------------------------------------------------------------

# 9. Qty, Unit, Specification, Dimensions

These fields must not disappear merely because the new Brand UI no
longer displays them.

## Qty

Retain because it exists in Excel.

Current decision:

> Qty is stored but must not be used in calculations unless a future
> requirement explicitly approves that.

## Unit

Retain and expose where it belongs.

## Specification / Dimensions

Remain SKU/work-level information, not Brand-level information.

------------------------------------------------------------------------

# 10. Completeness / Needs Attention

Do not add a mutable `is_complete` flag unless there is a concrete
requirement.

Prefer deriving completeness from current data.

Examples:

``` text
Brand created through quick entry
→ "Needs completion"

Party has no role
→ "Needs completion"

SKU has no unit
→ "Needs completion"
```

The definition should be explicit and testable.

Do not let "complete" become a hidden business state that can drift away
from the actual data.

------------------------------------------------------------------------

# 11. Excel --- Whole Database Round Trip

## 11.1 Scope

Import/export must cover the **whole Master Data schema**, not only
SKU + SKU Price.

The workbook is a structured editable representation of the master
database.

It must support:

-   backup
-   manual bulk editing
-   offline preparation
-   re-upload
-   synchronization
-   inspection without opening the web application

Recommended sheet design:

-   one sheet per major entity/table;
-   relationship tables represented explicitly where required;
-   stable IDs included;
-   foreign-key IDs available for round-trip integrity;
-   human-readable names can coexist with IDs.

------------------------------------------------------------------------

## 11.2 Excel Identity

Every exported row must carry a stable database identity.

The ID column may be hidden in normal Excel use, but it must remain in
the workbook.

Rules:

``` text
Existing row:
ID = populated

New row:
ID = blank
```

Import:

``` text
ID present
→ UPDATE existing record

ID blank
→ CREATE new record
```

Do not use name/slug as the primary identity when stable ID is
available.

------------------------------------------------------------------------

# 12. Excel Delete Semantics

**Missing Excel row must NEVER mean DELETE.**

If a user deletes a row from Excel and imports:

``` text
database row remains unchanged
```

Default import semantics:

  Excel state                         Action
  ----------------------------------- -----------
  Known ID                            Update
  Blank ID                            Create
  Existing DB ID missing from Excel   No action

No silent deletion.

If deletion is ever required, it must be an explicit future feature with
an explicit operation mechanism.

------------------------------------------------------------------------

# 13. Excel Conflict Detection

The application must protect against overwriting newer database changes.

Export should carry enough version/snapshot metadata to determine
whether the row changed after export.

At minimum evaluate:

``` text
DB updated_at > exported snapshot/version
```

If conflict exists:

-   identify the row;
-   show the conflict;
-   do not silently overwrite;
-   provide a deterministic resolution path.

Preferred first implementation:

1.  detect;
2.  report;
3.  reject conflicting update;
4.  allow user to re-export/reconcile.

Do not build automatic three-way merge unless a real use case justifies
it.

------------------------------------------------------------------------

# 14. Excel Round-Trip Relationship Integrity

This is critical.

The workbook must preserve relationships such as:

``` text
Brand → SKU
Brand → Supplier
SKU → Supplier via Price
Party → Contact
Contact → Brand (when brand-specific)
SKU → Category
WorkPrice → Vendor
WorkPrice → Project Reference
```

Do not rely only on display names when an ID relationship can be
preserved.

A human-readable name column may be included for usability, but the
stable ID is the identity.

------------------------------------------------------------------------

# 15. Audit & SSOT

The database is the application SSOT.

Excel is an editable offline representation/synchronization mechanism.

The system must not silently create a second independent source of
truth.

Every import should be traceable:

-   who imported
-   when
-   what was created
-   what was updated
-   what conflicted
-   what failed

If the current `MasterDataAudit` model exists but is not being written,
audit logging should be addressed before claiming the system is
production-safe.

------------------------------------------------------------------------

# 16. Existing Technical Constraints

Read `README.md` and `ROADMAP.md` before modifying the codebase.

Known project concerns from the existing project context include:

-   Prisma ↔ migration drift around `WorkPrice`
-   broken/unfinished `extensions/library` dependency on StudioFlow
    models
-   incomplete RBAC enforcement
-   audit model not consistently written
-   inconsistent slugification
-   current Excel scope limited to SKU + SKU Price
-   current UI/domain naming inconsistencies

These are not automatically permission to refactor everything.

For every technical change classify it:

-   **A --- UI only**
-   **B --- schema correction**
-   **C --- behavior change**
-   **D --- optimization**
-   **E --- removal/merge of business concept**

For B/C/D/E, provide:

-   existing behavior
-   proposed behavior
-   reason
-   Excel evidence
-   schema impact
-   migration impact
-   regression risk

------------------------------------------------------------------------

# 17. UX Acceptance Criteria

The implementation is not accepted merely because the code compiles.

A staff user must be able to complete these workflows naturally.

## A --- Create Brand

``` text
Materials
→ Add Brand
→ enter brand-level data
→ save
```

No SKU/price clutter.

## B --- Price for existing SKU

``` text
Price
→ Add Material Price
→ search SKU
→ select supplier
→ enter price
→ save
```

## C --- Price for new SKU

``` text
Price
→ Add Material Price
→ search SKU
→ not found
→ Create SKU
→ choose/create Brand
→ complete price
→ save
```

No dead end.

## D --- New Brand during Price Entry

``` text
Price
→ Create SKU
→ Brand not found
→ + Create Brand
→ continue
```

## E --- New Supplier during Price Entry

``` text
Price
→ Supplier not found
→ + Create Supplier
→ choose roles
→ continue
```

## F --- Compare supplier prices

``` text
TH231AC
Supplier A → Rp150k
Supplier B → Rp120k
```

The user can understand this without opening raw database records.

## G --- Brand supplier discovery

``` text
TACO
→ Suppliers
→ Toko A
→ Toko B
```

## H --- Brand-specific sales contact

``` text
Toko A
→ Contacts
→ TACO → Asep
```

## I --- Material + service quote

``` text
Price
→ Material + Service
→ Vendor
→ Work
→ Specification
→ Unit
→ Price
→ Save
```

No BOM/SKU breakdown required.

## J --- Work/service quote

Same pattern, with the correct vendor/work semantics.

## K --- Whole Excel export

``` text
Export
→ complete workbook
→ all required sheets
→ stable IDs
→ relationship integrity
```

## L --- Excel update

``` text
Export
→ manually edit row
→ import
→ existing record updates
```

## M --- Excel create

``` text
Export
→ add row with blank ID
→ import
→ new record created
```

## N --- Excel delete

``` text
Export
→ delete row
→ import
→ DB record remains
```

## O --- Excel conflict

``` text
Export
→ DB changes
→ Excel changes same record
→ Import
→ conflict detected
→ no silent overwrite
```

------------------------------------------------------------------------

# 18. Anti-Regression Matrix

Before implementation, produce and get owner approval for this matrix.

  ---------------------------------------------------------------------------------------
  Excel concept   Target UX                 Data preserved?         Behavior Approval
                                                                    changed? 
  --------------- ------------------------ ---------------- ---------------- ------------
  Company / Brand Brand page                            Yes               No Required

  Product Brand   Brand/SKU                             Yes               No Required

  Product         Brand/SKU category                    Yes               No Required
  Category                                                                   

  Sales Name      PartyContact                          Yes      UX improved Required

  Contact         PartyContact                          Yes      UX improved Required

  Supplier        Party / BrandSupplier                 Yes      UX improved Required
  Company                                                                    

  Company         Party role/type           **Must verify**         Possibly Required
  Categories                                                                 

  SKU             Price-created SKU                     Yes        **Yes --- Required
                                                                  workflow** 

  Specification   SKU/work price                        Yes               No Required

  Dimensions      SKU/work price                        Yes               No Required

  Qty             Stored field                          Yes      Calculation Required
                                                                  prohibited 

  Unit            SKU/work price                        Yes               No Required

  Price           Price/WorkPrice                       Yes      UX improved Required

  Supplied by     BrandSupplier/SkuPrice                Yes   Relationalized Required

  Project         WorkPriceProjectRef                   Yes               No Required
  Reference                                                                  

  Notes           Relevant record                       Yes               No Required

  Update by/time  Audit/update metadata                 Yes               No Required
  ---------------------------------------------------------------------------------------

No implementation should proceed if a row marked "Must verify" has an
unresolved meaning.

------------------------------------------------------------------------

# 19. Implementation Phases

## Phase 0 --- Evidence & Baseline

Before code:

1.  Read this PRD.
2.  Read `design database masterdata.xlsx`.
3.  Read `ROADMAP.md`.
4.  Read current Prisma schema/migrations.
5.  Inspect current actions and pages.
6.  Build the Anti-Regression Matrix.
7.  Build current-vs-target entity/relationship map.
8.  Identify unresolved contradictions.

**Deliverable:** analysis only.

------------------------------------------------------------------------

## Phase 1 --- Schema/Contract Safety

Resolve only changes proven necessary.

Priority:

1.  `WorkPrice` schema/migration consistency.
2.  Party roles/types required to preserve Excel Company Categories.
3.  BrandSupplier write/read path.
4.  PartyContact brand-specific path.
5.  Audit/import metadata needed for safe Excel round-trip.
6.  Any required relationship constraints.

Do not perform unrelated refactors.

------------------------------------------------------------------------

## Phase 2 --- Materials / Brand UX

Implement:

-   brand-grain table
-   search/filter/sort
-   brand detail/expand
-   SKU read-only list
-   simplified Brand CRUD
-   completeness indicators

Remove SKU/price fields from Brand modal.

------------------------------------------------------------------------

## Phase 3 --- Party/Supplier UX

Implement:

-   unified Add Party/Supplier/Vendor entry
-   multi-role selection
-   contact management
-   brand-specific contact
-   brand-supplier relationship management

Do not create material-category supplier relation unless separately
approved.

------------------------------------------------------------------------

## Phase 4 --- Price UX

Implement:

-   Material Price
-   Material + Service
-   Work/Service Price
-   inline searchable quick entry
-   SKU creation only here
-   Brand creation from SKU workflow
-   Supplier creation from relevant workflow
-   clear supplier/SKU relationships

------------------------------------------------------------------------

## Phase 5 --- Whole-Schema Excel

Implement:

-   full workbook export
-   stable IDs
-   hidden ID columns where appropriate
-   relationship sheets
-   blank-ID creation
-   ID-based update
-   no-delete semantics
-   row-level validation/errors
-   conflict detection
-   import summary
-   audit trail

------------------------------------------------------------------------

## Phase 6 --- Regression & Acceptance

Run:

-   TypeScript check
-   schema/migration verification
-   unit tests
-   action tests
-   import/export round-trip tests
-   relationship integrity tests
-   conflict tests
-   no-delete tests
-   quick-entry tests
-   UI workflow tests

Then manually walk every UX acceptance workflow in §17.

------------------------------------------------------------------------

# 20. Excel Import/Export Test Requirements

At minimum test:

### Test 1 --- Exact round trip

``` text
DB
→ Export
→ Import without changes
```

Expected:

-   no duplicate rows
-   no changes
-   no deletion
-   no relationship corruption

### Test 2 --- Existing update

``` text
Export
→ change Brand Name
→ Import
```

Expected:

-   same ID
-   updated record
-   no duplicate

### Test 3 --- New row

``` text
Export
→ blank ID
→ add valid row
→ Import
```

Expected:

-   exactly one new record
-   generated stable ID
-   relationship valid

### Test 4 --- Deleted Excel row

``` text
Export
→ remove row
→ Import
```

Expected:

-   database row remains

### Test 5 --- Conflict

``` text
Export
→ modify DB
→ modify same Excel row
→ Import
```

Expected:

-   conflict
-   no silent overwrite

### Test 6 --- Relationship integrity

Change/create:

``` text
Brand
SKU
Supplier
BrandSupplier
SkuPrice
Contact
Brand-specific Contact
WorkPrice
```

Export and import.

Expected:

-   all IDs/relationships remain correct.

------------------------------------------------------------------------

# 21. Definition of Done

The redesign is complete only when all are true:

### Business

-   Brand → SKU relationship preserved.
-   Brand → multiple suppliers preserved.
-   SKU → supplier-specific prices preserved.
-   Supplier/Party multi-role behavior preserved.
-   Sales/contact relationships preserved.
-   Brand-specific sales contact preserved.
-   Material-only pricing preserved.
-   Material + service commercial quotation preserved.
-   Work/service pricing preserved.
-   Table 3/4 information remains representable.
-   Qty remains stored but does not enter calculations.
-   Project references remain representable.

### UX

-   Materials is brand-centric.
-   Brand CRUD is simple.
-   SKU is created from Price workflow.
-   Price is the main commercial entry hub.
-   Quick entry prevents dead ends.
-   Supplier creation does not force material vs service exclusivity.
-   Users can discover supplier prices easily.

### Excel

-   Whole schema exported.
-   Stable IDs preserved.
-   Blank ID creates.
-   Existing ID updates.
-   Missing row does not delete.
-   Conflicts are detected.
-   Relationships survive round trip.
-   Import gives row-level errors/results.
-   Import is auditable.

### Technical

-   Prisma and migrations agree.
-   No known runtime dependency on unavailable StudioFlow models remains
    in the standalone app path.
-   TypeScript passes.
-   Tests pass.
-   No silent destructive migration.
-   No business concept removed without approval.

------------------------------------------------------------------------

# 22. Explicitly Out of Scope Unless Approved

Do NOT implement these merely because they seem useful:

-   `PartyCategory` for material categories.
-   `sku_id` on `BrandSupplier`.
-   `WorkPrice → Sku`.
-   BOM/component breakdown for Material + Service.
-   automatic deletion from Excel.
-   automatic conflict merge.
-   mutable `is_complete` database field.
-   additional normalized entities without a business requirement.
-   replacing stable IDs with names/slugs.
-   unrelated StudioFlow refactoring.
-   redesign of `ui_engine`.
-   broad visual redesign unrelated to this product flow.

------------------------------------------------------------------------

# 23. Owner Approval Gates

Claude must stop and ask the owner before implementing any of the
following:

1.  A schema change not explicitly required by this PRD.
2.  Removal of an existing Excel field/concept.
3.  Change to meaning of `Company Categories`.
4.  Change to `PartyRole`.
5.  Change to `BrandSupplier` semantics.
6.  Change to `SkuPrice` semantics.
7.  Change to `WorkPrice` semantics.
8.  Any deletion behavior in Excel.
9.  Any automatic conflict resolution.
10. Any change that makes an Excel workflow impossible to reproduce.

------------------------------------------------------------------------

# 24. Required First Response From Coding Agent

Before writing code, Claude must return:

## A. Business Model Map

``` text
Party
Brand
SKU
BrandSupplier
SkuPrice
WorkPrice
PartyContact
...
```

with relationship cardinalities.

## B. Excel Mapping

Table 1--4 → target entity/field.

## C. Anti-Regression Matrix

Use §18.

## D. Current vs Target UX

Show each page and the intended staff workflow.

## E. Schema Changes

Classify each:

-   none
-   required correction
-   optional optimization

## F. Blocking Questions

Ask only questions that cannot be resolved from this PRD + Excel +
current code.

## G. Implementation Plan

Phases 0--6 with files/modules likely affected.

**Do not code until the owner approves this analysis.**

------------------------------------------------------------------------

# 25. Final Product Principle

The application should feel like:

> **"I am entering and maintaining office material/vendor
> information."**

not:

> **"I am editing normalized database tables."**

The database should protect the relationships.

The UI should hide unnecessary relational complexity.

Excel should remain a safe, complete, manually editable representation.

And the redesign succeeds only if:

> **staff workflow becomes simpler while the business logic encoded in
> the original Excel remains intact.**
