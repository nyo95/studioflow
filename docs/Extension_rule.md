# 🚨 SYSTEM DIRECTIVE — STRICT EXECUTION MODE

You are an implementation agent working inside a production-grade codebase.

You are NOT allowed to:

* simplify requirements
* skip fields
* rename structures
* reinterpret logic
* assume missing values
* optimize by removing constraints

You MUST follow the specification EXACTLY as written.

If ANY requirement is unclear:
→ You MUST STOP and ASK.
→ DO NOT GUESS.

---

# 🧠 CORE ARCHITECTURE (NON-NEGOTIABLE)

System consists of TWO MAIN MODULES:

## 1. Schedule (Project आधारित SNAPSHOT SYSTEM)

## 2. Product Catalog (GLOBAL SOURCE OF TRUTH)

RELATION FLOW:

Schedule (mutable input)
→ Queue (approval request)
→ Product Catalog (validated global data)
→ Override back to ALL schedules

THIS FLOW IS MANDATORY. DO NOT CHANGE.

---

# 📦 PRODUCT DATA STRUCTURE (STRICT)

Each Product MUST follow:

* type: "material" | "fixture"

* category: REQUIRED

* subcategory: OPTIONAL

* images:

  * original_image (REQUIRED for catalog)
  * thumbnail_1_1 (AUTO GENERATED)

* primary:

  * sku (OPTIONAL but preferred)
  * name (OPTIONAL but preferred)
    RULE: At least ONE must exist

* secondary (MANDATORY MINIMUM):

  * color (REQUIRED MINIMUM)
  * pattern (OPTIONAL)
  * finishing_type (OPTIONAL)

  ❗ IF color DOES NOT EXIST → PRODUCT CANNOT BE CREATED

* tertiary (OPTIONAL):

  * dimensions
  * smart_tags (FLEXIBLE KEY VALUE / JSON)

* brand_id:
  REQUIRED when pushing to Product Catalog

---

# 🏷️ BRAND / VENDOR RULES

* name: REQUIRED
* multiple contact_person allowed
* MUST support merging duplicate brands

DO NOT create duplicate brands without checking similarity.

---

# 📍 INVENTORY SYSTEM (PHYSICAL SAMPLE TRACKING)

MUST TRACK:

* rack_number

* box_number

* movement logs:

  * taken_by
  * date_out
  * date_return

* status:

  * available
  * borrowed
  * sent_to_client

---

# 📦 SAMPLE REQUEST SYSTEM

MUST SUPPORT:

* request tracking per product
* link to inventory AFTER sample received

---

# 📊 SCHEDULE (FFNE TABLE) — CRITICAL RULES

## PRIMARY FOCUS:

* VISUAL FIRST (image must be dominant)
* USER FRIENDLY

## CORE RELATION:

CODE → PRODUCT → BRAND

---

## 🔑 CODE SYSTEM (STRICT)

CODE FORMAT:
[prefix_category + increment_number]

EXAMPLE:
HT-001

RULES:

* increment MUST be unique per category
* codes CAN be swapped ONLY within same category

---

## 🔁 ALTERNATIVE SYSTEM (MANDATORY)

Each CODE can have MULTIPLE product options:

Example:
HT-001:
Option A → Product A
Option B → Product B

UI MUST allow switching between options.

---

## 📌 DATA BINDING

* PRODUCT INFO is bound to CODE
* LOCATION & QTY (fixture only) bound to CODE

---

## 📂 SNAPSHOT BEHAVIOR

* Schedule = PROJECT-SPECIFIC SNAPSHOT
* Each project MUST have independent Schedule

---

## 🔄 PUSH TO PRODUCT CATALOG

Allowed ONLY IF:

* image EXISTS
* primary info EXISTS
* brand EXISTS

---

## 🚫 LOCK RULE

Once Product is APPROVED in Product Catalog:

* Product data CANNOT be edited via Schedule
* Only snapshot-level fields may change

---

# 🏪 PRODUCT CATALOG RULES

## PURPOSE:

* GLOBAL LIBRARY
* CLEAN DATA ONLY

## UI RULES:

* Must behave like E-COMMERCE UI
* Large images
* Read-only modal for normal users
* Edit ONLY via RBAC (admin/staff)

---

## 🔄 SYNC RULE

When Product Catalog is UPDATED:
→ ALL linked schedules MUST UPDATE

When Product Catalog item is DELETED:
→ Schedule MUST NOT BREAK
→ Use CACHE / FALLBACK

---

# ⚠️ CRITICAL UX INPUT FLOW (MANDATORY)

INPUT MUST BE STEP-BY-STEP:

1. Primary (sku OR name)
2. Secondary (MINIMUM: color REQUIRED)
3. Tertiary (optional)
4. Category (REQUIRED)
5. Subcategory (optional)
6. Brand (createable search)

DO NOT SKIP ORDER.

---

# 🚫 FORBIDDEN BEHAVIOR

DO NOT:

* store "N/A", "unknown", "pending"
* show empty fields
* allow product without color
* allow catalog push without image
* allow editing catalog product via schedule

---

# 🧪 BEFORE IMPLEMENTATION

You MUST:

1. Restate requirements in structured format
2. Validate ALL constraints are preserved
3. Highlight potential conflicts

ONLY THEN proceed to code.

---

# 🧾 OUTPUT FORMAT (MANDATORY)

When implementing:

* Provide DATA MODEL
* Provide API STRUCTURE
* Provide UI BEHAVIOR
* Map EACH FEATURE back to requirement

---

# FINAL RULE

If your implementation deviates EVEN SLIGHTLY from this spec:

→ It is considered WRONG.

If you violate ANY rule above, you must explicitly list the violation.
Silence = failure.