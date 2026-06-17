# StudioFlow Development Log (Changelog)

## [v3.7.6] — 2026-06-17 (Mobile Responsiveness & Design System Reset)

### Added
- **UI Engine Reset to Default**: Added a "Reset to Default" action button in the Design System settings panel (under [studio-settings-panel.tsx](file:///d:/Misc/ProjectsHUB/studioflow/src/components/studio-settings-panel.tsx)), allowing admins to instantly revert all custom visual attributes back to standard design tokens.
- **UI Engine Notice**: Placed an alert box detailing that the UI Engine does not fully function as a template engine yet, noting future development milestones.

### Fixed
- **Database Schema Sync**: Resolved the database connection issue where the `public.SketchupProject` table was missing by pushing the active `schema.prisma` configuration to the PostgreSQL database.
- **UI Engine Token Alignment**: Aligned the fallback values in `DEFAULT_UI_SETTINGS` (inside [ui-settings.ts](file:///d:/Misc/ProjectsHUB/studioflow/src/lib/ui-settings.ts)) and the active `SystemConfig` database settings to match the refined design tokens (`radiusCard: 0.5rem`, `radiusControl: 0.375rem`, `sectionPx: 1.25rem`, `sectionPy: 1.25rem`). This prevents custom settings overrides from displaying bloated values.

### UI Changes
- **Proportional Radius Scaling**: Updated the settings panel inputs so that changing the `Card Radius` automatically scales the control and button radius properties proportionally in live previews and state payloads.
- **Mobile Friendly Project Schedule**:
  - Adjusted main body padding from `p-8` to responsive `p-4 md:p-8` in `ProjectScheduleMain` and `page.tsx` backlink wrapper to save screen width on smaller viewports.
  - Implemented CSS flex wrapping (`flex-wrap`) on `PageHeader` action controls, preventing overflow when view toggles and imports are shown.
  - Converted the Right Inspector Panel to a fixed overlay drawer (`fixed inset-y-0 right-0 z-50 w-full md:relative md:z-40 md:w-[400px]`) on screens smaller than 768px (mobile/tablet), preventing spreadsheet squishing.
  - Wrapped `VisualTable` categories in a horizontal scroll container (`overflow-x-auto`) setting a min-width of `950px` on mobile/tablet viewports, ensuring all columns (specification, status, location, alternatives, actions) stay cleanly aligned and swipable.
- **Mobile Friendly Library Stores & Tables**:
  - Enabled horizontal scroll triggers (`overflow-x-auto flex-nowrap shrink-0`) on the main `LibraryTabs` headers to prevent label squeezing on mobile.
  - Wrapped `ProductTable`, `PhysicalInventoryTable`, `ProductRequestTable`, and `VendorTable` containers with `overflow-x-auto` to allow horizontal scrolling on narrower viewports.
  - Refactored `PromotionQueueTable` pending review card list to stack elements vertically (`flex-col`) on mobile screens and align buttons cleanly.

## [v3.7.5] — 2026-06-17 (WhatsApp-style Hashtag Autocomplete & Locked Phase Protection)

### Added
- **WhatsApp-style Hashtag Autocomplete**: Implemented a floating hashtag auto-complete dropdown for inline task creation in `TodayInlineAdd`.
- **Keyboard Navigation for Dropdown**: Supported navigating options using `ArrowUp`/`ArrowDown` (skipping locked phases) and selecting via `Enter`.
- **Locked Phase Protection**: Enforced strict validation preventing users from adding tasks to locked/inactive phases in both `TodayInlineAdd` and `TodayQuickAddModal`.
- **Locked Indicators**: Added clear `(Locked)` visual badges in autocomplete dropdowns for locked/completed phases.

### Fixed
- **JSX Compilation Mismatch**: Fixed an unbalanced JSX closing brace syntax error in `today-inline-add.tsx`.
- **Comprehensive Project Phase Retrieval**: Adjusted dashboard data query in `page.tsx` to retrieve all project phases (including locked ones) so that they can be resolved for tag matches and autocomplete options.

### UI Changes
- **Right-Aligned Phase Badge**: Moved the selected phase badge to the right side of the inline task input field (inside the border box) to group it as a clean right-aligned label. Used a subtler `text-slate-400` color to fit premium minimalist aesthetics.
- **Consolidated Inline Add Inputs**: Consolidated multiple phase-specific inline add inputs into a single `+ Add task...` box per project, located at the bottom of each project checklist section to prevent separated inputs per phase.
- **Unified Project Checklist & Phase Badges**: Removed separate phase-divided subheaders in Today's View, grouping all tasks of a project into a single, unified checklist. Added right-aligned, muted phase badges (e.g., `Layout`, `General`, `CD`) directly on each task row to indicate its target phase.

## [v3.7.4] — 2026-06-17 (Restrict SketchUp Integration to Admin)

### Security
- **Server Action Role Guard**: Secured all SketchUp server actions (`generateApiKeyAction`, `revokeApiKeyAction`, `queueMergeAction`, `linkSketchupMaterialAction`, `updateSketchupMaterialAction`, `updateSketchupFFEAction`, `pushStagedDataToScheduleAction`, `pushMaterialAsNewEntryAction`, `pushSketchupToSchedule`) with NextAuth session role validation requiring `ADMIN`.
- **Actual User ID Logging**: Updated server actions to extract and pass the active `userId` from the session to the audit logger (`insertAuditLog`) instead of using hardcoded mock/system UUIDs.
- **Page Guards**: Enforced NextAuth role-based protection on the SketchUp integration dashboard (`/projects/[id]/sketchup`) and print export preview (`/projects/[id]/sketchup/export`), returning `notFound()` for unauthorized non-admin roles.

### UI Changes
- **Conditional Submenu Item**: Modified `NavInner` and layout shell props to accept `userRole`, and wrapped the SketchUp sidebar link to only display when the logged-in user is an `ADMIN`.

## [v3.7.3] — 2026-06-17 (Dynamic Phase Tagging for Todo Tasks)

### Added
- **Dynamic Phase Tagging**: Users can now append `#<phase_name>` to Todo inputs (e.g., `#Moodboard`, `#Layout`, `#CD`, `#spv`, `#general`) to route the task to a specific project phase or general tasks from any view.
- **Tag Parser Helper**: Created `src/lib/services/task-tagger.ts` to parse trailing `#` tags and handle phase naming aliases case-insensitively.
- **Cross-Phase Routing**: Integrated the tag parser into both `projectService.executeAddProjectActivity` and `phaseService.executeAddActivity` with fallback handlers.

## [v3.7.2] — 2026-06-16 (StudioFlow Visual Redesign & Programa Aesthetics)

### UI Changes
- **CSS Variable Bridging**: Set tailwind `--radius` to `0.375rem` and bridged Shadcn variables `--border`, `--input`, and `--ring` to point to UI Engine tokens in `src/app/globals.css`.
- **Refined Design Tokens**: Tightened card radius (`--ui-radius-card: 0.5rem` / 8px), control radius (`--ui-radius-control: 0.375rem` / 6px), action/button radius (`--ui-radius-action: 0.25rem` / 4px), and grid spacing (`--ui-section-px`, `--ui-section-py`, `--ui-section-gap`) to `1.25rem` (20px). Lightened borders (`--ui-border-subtle: #f1f5f9`, `--ui-border-default: #e2e8f0`) and reduced shadows in `src/styles/designTokens.css`.
- **Header & Sidebar Heights**: Decreased top header height from `h-16` to `h-14` (56px) and search input height to `h-9` in `src/components/top-header.tsx`. Offset content container with `pt-14` in `src/app/(dashboard)/layout.tsx`. Set `nav-outer.tsx` positioning to `top-14 bottom-0` for full height.
- **Footer Restructuring**: Converted the fixed layout footer into a static inline flow element at the bottom of the main scroll container, enabling the outer sidebar rail to sit borderless at `bottom-0` without overlap.
- **Tightened Padding**: Reduced dashboard shell paddings to `px-6 py-6` and optimized page header margins/divider colors in `src/ui_engine/layout/shells/dashboard-page-shell.tsx` and `src/ui_engine/layout/page-header.tsx`.
- **High Table Density**: Slimmed table head height to `h-9`, headers to uppercase metadata, cell paddings to `py-2.5 px-4`, and set row hovers/borders in `src/ui_engine/components/table-card.tsx` and `src/components/ui/table.tsx`.
- **Inner Sidebar Redesign**: Updated project submenu section headers to `text-[10px]` tracked metadata and redesigned links to use a borderless active state with rounded control radius in `src/components/nav-inner.tsx`.

## [v3.7.1] — 2026-06-16 (Resolve Nested Double Scrollbar UI Bug)

### UI Changes
- **Double Scrollbar Resolution**: Configured `DashboardPageShell` in [page.tsx](file:///d:/Projects/studioflow/src/app/(dashboard)/projects/[id]/extensions/product-catalog/page.tsx) to use full height constraints (`h-full`), disabled nested overflow, and wrapped `<PageBackLink />` to prevent triggering the outer layout container's scrollbar.
- **Flex-Based Workspace Inspector**: Converted the Right Inspector Panel in [ProjectScheduleMain.tsx](file:///d:/Projects/studioflow/src/extensions/schedule/components/ProjectScheduleMain.tsx) from a `fixed` viewport overlay to a flexbox sibling. Animated the panel's width (`w-[400px]` vs `w-0`) using CSS transition variables, which dynamically shifts the spreadsheet scrollbar to remain fully visible and interactive on the screen.
- **Auto-Close on Click-Away**: Integrated an active click-away detection hook in [ProjectScheduleMain.tsx](file:///d:/Projects/studioflow/src/extensions/schedule/components/ProjectScheduleMain.tsx) that automatically closes the right workspace inspector panel and deselects the highlighted item when a click occurs outside the active row, workspace inspector, or modal boundaries.
  - Added row classification markers (`data-schedule-row="true"`) to [VisualRow.tsx](file:///d:/Projects/studioflow/src/extensions/schedule/components/table/VisualRow.tsx) and [ScheduleCard.tsx](file:///d:/Projects/studioflow/src/extensions/schedule/components/board/ScheduleCard.tsx).
  - Added interaction anchors (`data-workspace-inspector="true"` and `data-selection-ignore="true"`) to the inspector container and view selectors.
- **Decoupled Selection and Inspection**: Configured row clicks (single-row clicks, Shift-clicks, and Ctrl/Cmd-clicks) to strictly manage selection and multi-selection (bulk selection) state, rather than opening the workspace inspector automatically. The inspector is now explicitly opened only when the user clicks the "Edit" action button on a selected row or card, which also isolates that row selection.

## [v3.7.0] — 2026-06-16 (Critical Audit Bug Fixes)

### Bug Fixes
- **FIX 1: Concurrency crash in `addEntryToSchedule`**: Replaced hardcoded `index_number` and `schedule_increment` temporary values (9999) with random negative integers (`-Math.floor(Math.random() * 1_000_000) - 1`) to eliminate P2002 unique constraint collisions during concurrent transaction runs.
- **FIX 2: Poisoned transaction in `resolveVendor`**: Fixed transaction crashes due to caught P2002 exceptions by performing a case-insensitive read using `findFirst` followed by `upsert` on `brand_name`.
- **FIX 3: Silent bypass of duplicate check**: Prevented empty manual entries by throwing an explicit `ActionError` when both `catalog_sku` and `catalog_color` are missing in `checkDuplicateProduct`.
- **FIX 4: Sibling option selection promotion**: Resolved parent `active_index` desync in `smartDeleteOption` by querying remaining sibling options ordered by `option_label: "asc"` and computing the exact index position of the promoted option.
- **FIX 5: Timezone query bounds**: Resolved GMT+7 query bounds mismatch in audit log search query builder by applying explicit WIB (`+07:00`) boundary parsing for ranges.

### UI Changes
- **FIX 6: Design System Token Enforcement in `GradualInputForm`**: Replaced hardcoded Tailwind parameters in `GradualInputForm.tsx` with design system tokens:
  - `rounded-lg` → `rounded-[var(--ui-radius-control)]`
  - `shadow-xl shadow-slate-200` & `shadow-emerald-200` → `shadow-[var(--ui-shadow-elevated)]`
  - `text-[10px] uppercase tracking-widest` → `text-[10px] uppercase tracking-[0.15em]` (matching `uiMeta` token from design system config).

## [v3.6.0] — 2026-06-16 (SketchUp Push to Product Schedule Integration)

### API Changes
- **Push SketchUp Project to Product Schedule**: Added the `pushSketchupToSchedule(sketchupProjectId: string)` server action in [sketchup-actions.ts](file:///d:/Projects/studioflow/src/extensions/sketchup/actions/sketchup-actions.ts). This action retrieves synced SketchUp materials and FF&E components, parses their code prefixes, and upserts them into `ProjectScheduleEntry` and `ProjectScheduleOption` tables.
  - Implements Case A (Initials) and Case B (Complete) logic.
  - Resolves `schedule_qty`, `schedule_unit`, and `schedule_location` at the entry level for fixtures (FF&E).
  - Uses separate transactions for each item to allow partial success, gracefully returning errors and updating paths.

### UI Changes
- **Push to Schedule Button**: Created [PushToScheduleButton.tsx](file:///d:/Projects/studioflow/src/extensions/sketchup/components/PushToScheduleButton.tsx) with a loading spinner and transition states, displaying success/warning toast notifications from `sonner`.
- **Integrated Push Control**: Rendered `<PushToScheduleButton>` inside `PageHeader` next to the PDF export button in the SketchUp Integration page [page.tsx](file:///d:/Projects/studioflow/src/app/(dashboard)/projects/[id]/sketchup/page.tsx).

## [v3.5.0] — 2026-06-16 (StudioFlow Visual Redesign & Design Token Enforcement)

### UI Changes
- **CSS Variable Conflict Resolution**: Fixed [designTokens.css](file:///d:/Projects/studioflow/src/styles/designTokens.css) as the single authority for UI styles. Removed all duplicate `:root` variable overrides (`--ui-canvas-bg`, `--ui-radius-card`, etc.) from [globals.css](file:///d:/Projects/studioflow/src/app/globals.css) so that `--ui-radius-card` resolves to exactly `0.75rem` (12px) everywhere in the application.
- **Enforced Design Tokens in Core UI Primitives**:
  - [card.tsx](file:///d:/Projects/studioflow/src/components/ui/card.tsx): Replaced `rounded-xl` with `rounded-[var(--ui-radius-card)]`, applied `border-[var(--ui-border-subtle)]` and `shadow-[var(--ui-shadow-card)]` by default, and set background and text to design system tokens.
  - [button.tsx](file:///d:/Projects/studioflow/src/components/ui/button.tsx): Replaced `rounded-md` with `rounded-[var(--ui-radius-action)]` on all sizes, and refactored default, outline, and ghost variants to use design system variables (`--ui-action-bg`, `--ui-action-text`, `--ui-action-hover`, `--ui-border-default`, `--ui-text-primary`, `--ui-text-secondary`).
  - [input.tsx](file:///d:/Projects/studioflow/src/components/ui/input.tsx): Replaced `rounded-md` with `rounded-[var(--ui-radius-control)]`, set border to `--ui-border-subtle`, and focused states to `--ui-border-focus` (removing hardcoded rings/teal rings).
  - [badge.tsx](file:///d:/Projects/studioflow/src/components/ui/badge.tsx): Replaced `rounded-full` with `rounded-[var(--ui-radius-pill)]`.
  - [dialog.tsx](file:///d:/Projects/studioflow/src/components/ui/dialog.tsx): Wired overlay, content, header, description, and close buttons to design system tokens.
  - [label.tsx](file:///d:/Projects/studioflow/src/components/ui/label.tsx): Standardized label text size to `text-xs` and color to `text-[var(--ui-text-secondary)]`.
- **Standardized Page Shells**:
  - [page.tsx](file:///d:/Projects/studioflow/src/app/(dashboard)/projects/[id]/sketchup/page.tsx): Standardized page layout to use `DashboardPageShell`, `PageBackLink`, and `PageHeader`, removing hardcoded canvas backgrounds and layout paddings.
- **Simplified Page Headers**:
  - [page.tsx](file:///d:/Projects/studioflow/src/app/(dashboard)/extensions/library/page.tsx) and [LibraryTabs.tsx](file:///d:/Projects/studioflow/src/extensions/library/components/LibraryTabs.tsx): Moved `PageHeader` inside the tabs component to consolidate the title ("Product Library"), description, and the "Add Product" button. Positioned `TabsList` immediately below the title block with a clean 24px gap (`mb-8`), and removed the duplicate "Add Product" action button from the filters sidebar.
  - [page.tsx](file:///d:/Projects/studioflow/src/app/(dashboard)/projects/[id]/phases/[phaseId]/page.tsx): Consolidated phase actions, status indicators, `LOCKED` status badge, "Admin Revision Override" button, and the "Revision History" dialog trigger into the single right-aligned `action` slot of `PageHeader`. Removed the stacked `meta` layout row and the duplicate `eyebrow` text.
- **Visual Polish Pass**:
  - Sidebar ([nav-outer.tsx](file:///d:/Projects/studioflow/src/components/nav-outer.tsx)): Adjusted workspaces heading tracking to `tracking-[0.15em]` and links state (hover and active styles to use slate neutrals instead of teal accents).
  - Top Header ([top-header.tsx](file:///d:/Projects/studioflow/src/components/top-header.tsx)): Styled background, borders, search input, and notification dropdown to match the clean design tokens.
  - Tables ([table.tsx](file:///d:/Projects/studioflow/src/components/ui/table.tsx)): Styled the `TableHeader` to render a subtle background (`bg-slate-50/75`) and borders (`border-[var(--ui-border-subtle)]`). Table heads now default to `h-10 px-4 text-[10px] uppercase font-bold tracking-[0.12em] text-slate-400`. Table cells now default to `py-3 px-4`. Table rows transition with `hover:bg-slate-50/60` and use tokenized bottom borders.
  - Interactive States: Replaced the interactive teal hover states (`hover:text-teal-600 hover:bg-teal-50`) in [PhysicalInventoryTable.tsx](file:///d:/Projects/studioflow/src/extensions/library/components/PhysicalInventoryTable.tsx) with slate values (`hover:text-slate-900 hover:bg-slate-100`).

## [v3.4.0] — 2026-06-16 (Workspace Optimization & Right Inspector Panel)

### UI Changes
- **Right Inspector Panel**: Replaced the modal-based spec editor (`ScheduleSpecEditorModal.tsx`) with a persistent `ScheduleWorkspaceInspector` panel. Implemented in a split-pane layout (`pr-[400px]` dynamically added to main content) that remains open, sticky, and scrolls independently (`ScrollArea`) as the user interacts with different table rows.
- **High-Utility Visual Density**: Redesigned `VisualRow.tsx` into a high-density horizontal flow (`Thumbnail -> Code -> Effective Title -> Brand -> Status`). Replaced `w-20` thumbnails with compact `w-14` thumbnails and nested option switchers into compact inline capsules.
- **Progressive Disclosure**: Removed secondary specification details (Color, Motif, Finish, Dimensions) from the list row view to reduce cognitive load; these details are now progressively disclosed in the Right Inspector.
- **Inspected Accent Highlight**: Styled the currently active inspected row with a distinct left-accent indigo border (`border-l-4 border-l-indigo-600 bg-indigo-50/40 pl-1`) and subtle background highlight, which updates reactively as the user navigates.
- **Library Readiness Checklist**: Integrated a compact checklist showing Stage 1 (Project Snapshot) and Stage 2 (Catalog Ready) validation requirements inside the inspector, along with the "Promote to Master Catalog" action trigger.
- **Persistent Inspector Tab State**: Wired the active inspector tab state (`activeInspectorTab`) to the parent workspace container `ProjectScheduleMain.tsx`. The active tab selection ("Identity", "Specs", or "Curation") now persists seamlessly when traversing between previous and next items, eliminating context loss.
- **Keyboard Row Navigation**: Added global keydown event listeners in `ProjectScheduleMain.tsx` when the inspector is active. Users can press `ArrowUp` to inspect and select the previous schedule entry, `ArrowDown` to inspect and select the next entry, and `Escape` to close the inspector panel. Added validation safeguards to ignore navigation keys while editing inputs, textareas, or contenteditable elements.
- **Wave 1 Visual Refinements**:
  - *Borderless List Rows*: Removed 4-sided borders and card containers from `VisualRow.tsx`, replacing them with a clean `border-b border-slate-100/70` bottom-divider line.
  - *Muted Status Dots*: Replaced high-contrast status pills with small glowing indicator dots (`w-1.5 h-1.5` with shadow glow) and uppercase labels to reduce visual noise while keeping scannability.
  - *Hover & Selection-Aware Actions*: Actions are hidden by default and appear on hover, when selected (`isSelected`), or when inspected (`isInspected`) to protect keyboard-nav discoverability.
  - *Lora Typography Polish*: Formatted specification titles to `text-[13px] font-semibold tracking-wide font-serif` and increased vertical padding to improve scanning rhythm.
  - *Borderless Code Badge*: Changed `schedule_code` representation to a borderless, light grey background span pill.

### Architectural & Cleanup Changes
- **Continuous Context & Navigation**: Implemented Next/Previous traversal methods within the Right Inspector that directly navigate the parent schedule list. Enabled auto-inspection on standard single-row click events.
- **Code Pruning**: Safely deleted the unused `ScheduleSpecEditorModal.tsx` file and resolved its references.
- **Type Safety**: Verified type safety across the newly introduced state and navigation properties with a clean TypeScript compiler run.

## [v3.3.0] — 2026-06-15 (SketchUp to Product Schedule Push Integration)

### API Changes
- **Push Actions Implementation**: Implemented `pushStagedDataToScheduleAction` and `pushMaterialAsNewEntryAction` in `sketchup-actions.ts` with complete audit logging and revalidation paths. Features robust Zod schema snapshot validation and split Case A (Initials / placeholder) vs Case B (Primary details) option mapping logic. Handles FF&E quantity synchronization natively by updating the parent entry's `schedule_qty` to match the synced SketchUp instance count.

### UI Changes
- **Mapping Queue Controls**: Updated `SketchupMappingQueue.tsx` to add "Push Staged Data to Schedule" global actions in the tab headers, and inline "Push as New Entry" button controls for unlinked materials. Styled buttons in compliance with the Design System (emerald green accent colors, action radius variables, and loading transitions).

## [v3.2.0] — 2026-06-15 (SketchUp Integration: Printable PDF Schedules)

### Database Changes
- **String Coupling Risk Resolution**: Added `linked_entry_id` (foreign key to `ProjectScheduleEntry`, nullable, onDelete: SetNull) to the `SketchupMaterial` model, and added the `sketchup_materials` back-relation on `ProjectScheduleEntry` to support manual linking.

### API Changes
- **Protected Manual Metadata**: Modified `/api/sketchup/sync/route.ts` to restrict the SketchUp material upsert update block to only technical fields (`code`, `uuid`, `area`, `face_count`, `backface_count`, `layers`, `parents`). Web-owned fields (`brand`, `type`, `finish`, `image_url`, `location_notes`, `linked_entry_id`) are protected from being overwritten by plugin sync payloads.
- **Schedule Document Data Layer Action**: Added type definitions `MaterialScheduleRow`, `FFEScheduleRow`, and `ProjectScheduleDocument`, and implemented the `getProjectScheduleDocument(project_id)` server action in `sketchup-actions.ts`. The action uses efficient single-query resolution mapping for both Materials and FF&E, prioritizing active project schedule option snapshots, with fallback to technical model properties.

### UI Changes
- **Sidebar Integration**: Added "SketchUp" link under the EXTENSIONS group in the project sidebar component `nav-inner.tsx` using the existing `Box` icon and correct active routing states.
- **SketchUp Mapping Queue UI**: Implemented `SketchupMappingQueue.tsx` client component for managing synchronized model integration. Provides interactive tabs for Materials and FF&E, including manual linking dropdown triggers for `SketchupMaterial` mappings and inline editable fallback fields (brand, type, location_notes, product_name) styled to comply with visual design system guidelines.
- **Dynamic Routing Params Fix**: Updated `src/app/(dashboard)/projects/[id]/sketchup/page.tsx` to unwrap the dynamic route `params` Promise cleanly according to Next.js 15+ specifications, integrating the new mapping queue layout and export triggers.
- **Printable PDF Export Page**: Implemented `/projects/[id]/sketchup/export/page.tsx` and the `PrintButton.tsx` helper client component to generate printable HTML tables. Implemented media-query overrides (`@media print`) to hide navigation shell components and display clean tables with strict column width percentages (Material Schedule: Code 8%, Material Type 15%, Brand 12%, Type/SKU 25%, Image 15%, Location 25%; FF&E Schedule: Code 8%, Category 15%, Product Name 27%, Qty 8%, Brand 17%, Location 25%) and italicized Initials fallback styling.

### SketchUp Plugin Changes
- **Auto-populate Project ID**: Updated `api_client.rb` to automatically populate the `project_id` field in the local `config.json` configuration file upon a successful sync response containing the resolved `projectId`.





## [v3.1.0] — 2026-06-14 (Product Library & Schedule Stabilization)

### Bug Fixes
- **Deduplication Crash Prevention**: Added check and fallback logic when checking for duplicate SKUs, categories, and colors in `createProduct` and `updateProduct` of `LibraryService` to avoid crashes on blank/optional fields.
- **Cache Invalidation for Promotions**: Added missing project and library cache invalidation in `createPromotionRequestAction` to ensure ADMIN promotions are immediately visible without page reloads.
- **Staff Edit Permission Alignment**: Modified `updateProductAction` in `library-actions.ts` to allow `assertAdminOrStaff` role checks, ensuring staff can edit their own pending drafts. Added checks preventing non-admins from manually setting statuses to `APPROVED`.
- **CSV Import Quantity Restriction**: Modified `parseGSheetsProductCsv` and `importScheduleFromCsv` to strictly filter out and ignore quantity columns when parsing and importing CSV files for materials, aligning with the "no quantity data for materials" rule.
- **Smart Option Deletion Index Correction**: Improved `smartDeleteOption` in `schedule-service.ts` to sync the schedule entry's `active_index` to point directly to the sibling option marked `is_final` upon deleting a non-final option, preventing layout/desync bugs in spreadsheet rows.

## [v3.0.0] — 2026-06-14 (Reverse-Engineered SSOT Consolidation)

### Bug Fixes
- **Critical Auth Bypass**: Added `/activity` and `/activity-center` to `isDashboardRoute` in `src/auth.config.ts`, protecting the global activity logs from unauthenticated users.
- **CD Drawing Code Validation**: Updated `normalizeDrawingCode` in `src/actions/_shared.ts` to allow "CD" prefix in Construction Drawing phase inputs.
- **Timezone Offset Bounds**: Updated timezone boundary calculation in `src/core/platform/audit/query-builder.ts` by removing forced UTC UTC markers (`Z`) to respect server/local date filters.
- **Option Deletion Index Desync**: Modified `smartDeleteOption` in `src/extensions/schedule/services/schedule-service.ts` to update `active_index` of the parent `ProjectScheduleEntry` when option deletion occurs.
- **Project Overview Icon Compilation**: Imported missing `Loader2` icon from `lucide-react` in `src/components/project-overview-form.tsx`.

### Code Pruning & Refactoring
- **Split Revision Utility**: Resolved overly complex TS overloads on `getActiveRevision` in `src/actions/_shared.ts` by splitting it into two explicit, simplified functions: `getActiveRevision` and `getActiveRevisionWithActivities`.
- **Server Action Redundant Return Cleanups**: Removed manual `{ success: true }` returned from action wrappers (like `reorderScheduleEntriesAction`, `swapScheduleEntriesAction`, `restoreBackupAction`, `deleteBackupAction`, and `mergeVendorsAction`) to avoid double-wrapping.

### UI Changes
- **Activity Layout Flatting**: Removed nested `<TableCard>` wrapper around `<ActivityLogTable>` in both global activity page (`src/app/(dashboard)/activity/page.tsx`) and project activity page (`src/app/(dashboard)/projects/[id]/activity/page.tsx`). This resolves a semantic layout bug (rendering table-like structures wrapping invalid div/article children) and flattens DOM nesting complexity, resolving visual border clutter.
- **SketchUp Integration Dashboard**: Added `src/app/(dashboard)/projects/[id]/sketchup/page.tsx` for generating API keys, viewing synced materials/FF&E, and managing pending merge actions.

### Integrations
- **SketchUp Plugin API**: Implemented dedicated endpoints (`/api/sketchup/sync` and `/api/sketchup/merge/confirm`) for real-time bidirectional syncing of materials and FF&E components directly from SketchUp models via API keys. Supported by new Prisma schema extensions (`SketchupProject`, `SketchupMaterial`, `SketchupFFE`, `SketchupMergeAction`).

### Documentation & Audit
- **Master SSOT Rewrite**: Rewrote `MASTER_SSOT.md` to serve as a complete, reverse-engineered Single Source of Truth based on direct codebase analysis, ensuring exact specs for junior developers.
- **Issue Audit Log**: Documented 7 active defects and vulnerabilities (including the `/activity` public authentication bypass, option deletion `active_index` desync, and timezone-offset bugs) along with detailed mitigations.
- **Visual Compliance Log**: Identified styling violations under the "Zero Hardcode Policy" in `GradualInputForm.tsx`.
## [v2.7.3] — 2026-06-15 (Project-Level Todo List & LAN Exposure Automation)

### Added
- **Project-Level Tasks Action**: Added a new server action `addProjectActivity` to support creating todo items directly bound to a project without a phase or revision.
- **Unbound Todo List in Overview**: Integrated an interactive, client-side reactive "Project Tasks" card component directly into the main Project Overview area.
- **Service Layer Support**: Implemented `executeAddProjectActivity` inside `projectService` with appropriate database creation and audit logging.
- **Today's View Integration**: Incorporated project-level activities as a virtual "General Tasks" phase inside "Today's View".
- **Quick Add Modal & Inline Add Support**: Updated `TodayQuickAddModal` and `TodayInlineAdd` to support choosing and inline adding tasks directly to "General Tasks" at the project scope, dynamically executing the appropriate project action.
- **LAN & IP Sync Automation**: Updated the `sync-ip` Node script to dynamically update `AUTH_URL`, `NEXTAUTH_URL`, and `NEXT_PUBLIC_SITE_URL` in `.env`, and configured `experimental.serverActions.allowedOrigins` in `next.config.ts` to prevent CSRF errors when accessed from other LAN devices.

### UI Changes
- **Project Tasks Component**: Renders general project todo items using the Lora serif and Inter sans typography guidelines, featuring interactive status toggles, inline double-click editing, and delete actions with optimistic rendering updates.
- **Clean Layout**: Divided project activities on the overview page so that phase-deferred tasks are shown separately from general project-level tasks.

## [v2.7.2] — 2026-06-15 (Global Hydration & Layout Fixes)

### Fixed
- **Global Activity Hydration Mismatch**: Resolved Next.js React hydration warnings on `/activity` and `/projects/[id]/activity` pages caused by invalid HTML nesting (`In HTML, <div> cannot be a child of <table>`).
- **Activity Log Layout Wrap**: Replaced the outer `TableCard` container with a `SectionCard padding="none"` wrapper in both the global Activity Page and Project Activity Page, since the child `ActivityLogTable` renders non-tabular elements (`div`, `article`, timeline, etc.).

### UI Changes
- **Activity Page Layout Container**: Replaced `TableCard` with `SectionCard padding="none"` for Activity log displays, preserving identical visual cards and borders while correcting invalid table-div DOM nesting.

## [v2.7.1] — 2026-06-15 (Local Development Setup, Naming & Performance Fixes)

### Changed
- **Flexible Project Naming Format**: Updated the naming protocol regex and validation pattern to allow sequential numbers (Nomor) of any digit length (using `\d+` instead of strictly `\d{3}`), while keeping space as the separator before project name (e.g. `2026-484 Sociolla XMM Bekasi`).
- **Dynamic Imports Performance Optimization**: Refactored static imports of heavy modals and tabs (such as `ScheduleProductPickerModal`, `ScheduleSpecEditorModal`, `VendorTable`, `PhysicalInventoryTable`, `LibraryFormModal`, `ProductRequestTable`, and `PromotionQueueTable`) into Next.js lazy-loaded dynamic imports (`next/dynamic`), improving page load performance and reducing the initial JS bundle size.

### Fixed
- **ScheduleSpecEditorModal Syntax**: Fixed a missing closing `</div>` tag in the ternary conditional statement which caused Turbopack compilation failure.
- **ProjectOverviewForm Import**: Imported missing `Loader2` from `lucide-react` to resolve TypeScript type-checking errors.
- **Branding Panel Text Alignment**: Synchronized naming descriptions in [studio-settings-panel.tsx](file:///d:/Misc/ProjectsHUB/studioflow/src/components/studio-settings-panel.tsx) to show `[YYYY]-[Nomor] [Name]` with a space instead of a dash.
- **Impure Rendering Warnings**: Cached `Date.now()` within `React.useRef` inside `PromotionQueueTable` and `ProductRequestTable` filters to resolve React hooks purity rule warnings.

## [v2.7.0] — 2026-04-29 (Engineering SSOT Alignment Phase 1 & 2)

### Workflow Optimization
- **Smart Input Guard**: Implemented "Actionable Default" for manual entries. Designers can now add items with only **Color/Finish** if SKU/Name is not yet known.
- **Enhanced Gradual Form**: Updated `GradualInputForm` to include editable SKU and Product Name fields during manual entry, with validation logic that supports the `(SKU+Name) OR (Color)` rule.

### Data Integrity
- **Project Code Isolation**: Added a dedicated `project_code` field to the `Project` model to decouple technical identification from display names.
- **Backfill Migration**: Successfully migrated all legacy projects to the new naming protocol, extracting codes (e.g., `2025-429`) into the dedicated field.
- **Duplicate Protection Hardening**: Updated `ScheduleService` to use `catalog_color` as a surrogate identity for duplicate checks when SKUs are missing, ensuring draft entries remain unique.

### Backend Changes
- **Prisma Schema Update**: Finalized `Project.project_code` as a mandatory `@unique` field.
- **Validation Logic**: Refined `ScheduleSnapshotSchema` (Zod) with `superRefine` to enforce the new Smart Input standards.


## [v2.6.3] — 2026-04-28 (Actionable Default UI)

### UI Changes
- **"Actionable Default" Pattern**: Implemented a cleaner workspace by hiding completed/terminal items by default in both **Promotion Queue** and **Product Requests**.
- **History Toggle**: Added a "Show History" button to allow on-demand viewing of recently completed tasks.
- **Auto-Cleanup Logic**: Implemented a 7-day retention rule for the History view. Items older than 7 days are automatically removed from the UI (but preserved in database) to maintain focus on current work.
- **Queue Transparency**: Fixed a bug where approval metadata (Who & When) was missing in the processed list.

### Documentation
- **SSOT v2.4.3**: Formalized the "Actionable Default UI" principles in Section 5.5.

## [v2.6.2] — 2026-04-28 (Lean Request Workflow)

### Backend Changes
- **Prisma Schema Simplification**: Consolidated `ProductRequestStatus` enum from 6 states down to 4 (`REQUESTED`, `IN_PROGRESS`, `RECEIVED`, `UNAVAILABLE`) to optimize for lean team operations.
- **Database Alignment**: Executed schema push to merge legacy statuses (`ORDERED`/`SHIPPED` → `IN_PROGRESS` and `CANCELLED` → `UNAVAILABLE`).

### UI Changes
- **Status Unification**: Updated `ProductRequestTable`, `ScheduleRow`, and `VisualRow` to use the new simplified status lifecycle.
- **Improved Interaction**: Reduced cognitive load in the "Set Status" dropdown by consolidating transitionary states.

### Documentation
- **SSOT v2.4.2**: Formalized the "Lean Request Workflow" in Section 5.5.

## [v2.6.1] — 2026-04-28 (Context-Aware Request Rendering)

### Backend Changes
- **Library Service Enhancement**: Updated `getAllProductRequests` and `getProjectProductRequests` to include `schedule_entry` and `schedule_option` relations. This provides the Procurement team with exact project schedule context (Code & Specs) for each request.
- **Type Safety**: Updated `ProjectProductRequestWithDetails` type definition to reflect the new relational data.

### UI Changes
- **Product Request Table**: 
    - **Contextual Binding**: Integrated **Schedule Codes** (e.g., `PT-01`) directly into the "Product Requested" column as high-visibility badges.
    - **3-Tier Hierarchy Implementation**: Replaced placeholder `[RESERVED]` labels with the **Effective Title** (promoting secondary specs like color/motif) using the canonical `getEffectiveTitle` utility.
    - **Metadata Enrichment**: Improved brand/vendor rendering by extracting data from snapshots when library links are missing, reducing "Custom Source" fallbacks.
- **Schedule Logic**: Standardized `ScheduleRow` to pass the effective title as the fallback name during sample request creation.
- **Board View (ScheduleCard)**: Synchronized title rendering logic with the 3-Tier Hierarchy for visual consistency across views.

### Documentation
- **SSOT v2.4.1**: Formalized Section 5.5 ("Context-Aware Request Rendering") in `MASTER_SSOT.md`.

## [v2.6.0] — 2026-04-28 (Architectural Stabilization Finalized)

### Backend Changes
- **Guard Robustness**: Improved `checkDuplicateProduct` with type-safe `ScheduleSnapshot` casting and case-insensitive normalization for manual entry checks.
- **Parallel Phase Activation**: Enforced `allow_parallel: true` for `LAYOUT`, `DESIGN_3D`, and `CD` phases in `project-service.ts` and patched existing database records via SQL.
- **Heartbeat Hardening**: Implemented `AbortController` and downgraded `console.error` to `console.warn` in `ProjectLiveProvider.tsx` to handle transient network glitches gracefully and prevent dev error overlays.
- **Promotion Audit Trails**: Fixed `reviewPromotionRequest` to correctly capture `reviewed_by_id` and `reviewed_at` when approving requests, ensuring parity with rejection logic.
- **Action Validation**: Hardened `addScheduleEntryWithProductAction` and `addScheduleOptionAction` with strict `catalog_status === "APPROVED"` assertions.

### UI Changes
- **Search Ergonomics**: Consolidated `status: "APPROVED"` filter across all schedule-insertion search points.
- **Payload Cleanup**: Refactored `ScheduleProductPickerModal` to remove unused `fetchVendors` state and established explicit `catalog_sku` vs `catalog_product_name` separation for manual entries.
- **Dead Code Cleanup**: Purged unused `LibraryVendor` imports and state hooks from scheduler components.

### Documentation
- **SSOT v2.3.0**: Formalized Section 5.2 (Search & Selection Rules) and 5.3 (Duplicate Protection Rules) in `MASTER_SSOT.md`.
- **Completion Status**: Successfully executed 100% of the audit-identified stabilization tasks from `implementation_plan_v2.md` and the junior-dev gap analysis.

## [v2.5.2] — 2026-04-28 (Schedule Protection Hardening)

### Security & Hardening
- **Schedule Duplicate Protection**: Implemented strict duplicate product guards in `ScheduleService` to prevent redundant entries within a project.
    - Blocks adding the same catalog item (`catalog` mode).
    - Blocks adding items with identical SKU + Brand combination (`manual` mode).
- **Architectural Cleanup**: Fully removed the deprecated `create_catalog` mode from validation schemas and action handlers, enforcing a strict distinction between catalog selection and manual drafting.
- **Admin Auto-Approve**: Implemented automatic approval for `PromotionRequest` when initiated by an `ADMIN`, streamlining library population.
- **Search Filtering**: Restricted schedule product searches to `APPROVED` items only in `ScheduleSearchBar` and `ScheduleProductPickerModal`.
- **Dead Code Removal**: Deleted the legacy `ensureProductInLibrary` sync method from `LibraryService`.

### Documentation
- **SSOT Update**: Updated `MASTER_SSOT.md` to v2.2.9 reflecting the new duplicate protection rules and search restrictions.

## [v2.5.1] — 2026-04-27 (Phase 3 Completion - Security & Hardening)

### Security & Hardening
- **RBAC Hardening (Catalog)**: Restricted library `ProductCatalog` management to `ADMIN` role only. `STAFF` is now restricted to creating `PENDING` items via `LibraryFormModal` and cannot directly update/delete `APPROVED` global entries.
- **Schedule Domain Validation**: Refactored `ScheduleService.swapEntries` and `swapScheduleEntriesAction` with strict domain validation, blocking cross-project and cross-category swaps at the service level.
- **Vendor Management**: Restricted `Vendor` deletion and merging to `ADMIN` only.
- **Promotion Integrity**: Fixed data loss in the library promotion workflow by correctly mapping `catalog_tags` and `catalog_metadata` from project snapshots during approval.
- **Promotion Deduplication**: Verified robust SKU+Brand deduplication logic in `reviewPromotionRequest` to prevent redundant catalog entries.

### Fixed
- **Audit Consistency**: Ensured all library and schedule mutations (swaps, merges, promotions) call centralized service methods with mandatory audit logging.

### Status
- **Phase 3 Completion**: All 13 stabilization tasks from `implementation_plan_v2.md` are now COMPLETE.
- **Type Safety**: ✅ 100% compliance (`npx tsc --noEmit` exit code 0).

## [v2.5.0] — 2026-04-27 (Audit-Driven Implementation Phase 3)

### Documentation
- **Comprehensive Audit-Driven Implementation Plan**: Created `docs/implementation_plan_v2.md` (v2.1) consolidating audit findings into 13 actionable junior-agent tasks.
- **MASTER_SSOT.md Section 12**: Added "Implementation Status & Critical Audit Fixes" documenting audit context, finding-to-task mapping, roadmap, and execution rules.
- **Audit Reference**: Complete 3-stage audit (`audit.md`) identified 25 findings (7 critical, 18 high/medium) spanning:
  - Architecture & schema alignment (7 findings)
  - Backend workflow integrity (16 findings)  
  - UX operational friction (25 findings total across 3 stages)

### Status
- **Build**: ✅ Passing (v2.4.0+)
- **Type Safety**: ✅ 100% compliance (`npx tsc --noEmit` exit code 0)
- **Blockers**: 13 tasks queued for Phase 3 execution by Junior Agent
- **Target Completion**: All critical blocker fixes by Phase 3 completion

### Deferred to Phase 4
- UX/IA consolidation (#16-25): Modal simplification, design system authority, search ergonomics, library IA restructuring

---

## [v2.4.0] — 2026-04-27 (versi 1.9.0 Beta)

### Production Validation
- **System Stability Verified**: Successfully ran `npx tsc --noEmit` with zero errors, confirming type safety across 100% of the codebase.
- **Production Build Passed**: Executed Next.js optimized production build (`npm run build`) without any static generation or hydration errors.
- **Linting & Code Quality**: Resolved residual ESLint warnings (`prefer-const`, synchronous state in effect) to ensure production-grade cleanliness.
- **Full Application Readiness**: Architecture (View-First, Zero Hardcode) is verified, backend snapshot logic is hardened, and UI inconsistency has been fully patched. The application is now ready for daily usage in the firm.

## [v2.4.3.3] — 2026-04-27 (versi 1.9.3.3)

### Fixed
- **Library Catalog**: Fixed "Remove Item" action not functioning due to missing prop drilling in `LibraryTabs`. Added confirmation dialog for safer deletion.
- **Approval Workflow**: Added an explicit 'Approve' button (CheckCircle icon) directly in Table and Visual rows to fix user confusion between saving snapshots and formal approval.
- **Sample Status Accuracy**: Fixed data fetching logic to include `product_requests` linked directly to schedule options, ensuring status indicators work for custom/manual items.

### UI Changes
- **Studio Controls**: Refactored sidebar navigation into horizontal tabs with manual arrow controls (`ChevronLeft`/`ChevronRight`) for optimized screen real estate.
- **Selection Contrast**: Refined `VisualRow` selection styling from high-contrast dark slate (`bg-slate-900`) to a softer indigo palette (`bg-indigo-50/50`) for better visual comfort.
- **Terminology**: Translated sample status badges from Indonesian ("Diterima", "Dipesan") to English ("Received", "Ordered", etc.) for consistency.

## [v2.4.3.1] — 2026-04-27 (versi 1.9.3.1)

### Fixed
- **Sample Request Accessibility**: Fixed a UI bug where the "Request Sample" button was hidden for items not yet promoted to the Global Library. Users can now request samples for "Custom" project items directly from the Table and Visual views.

## [v2.4.3] — 2026-04-27 (versi 1.9.3)

### Fixed
- **Parallel Phase Activation**: Resolved a data-level inconsistency where `allow_parallel` flags were missing in existing project phases. Enforced SSOT §4.1 via `PhasePolicy.canActivate` to allow concurrent activation of LAYOUT, DESIGN_3D, and CD phases.

### UI Changes
- **Sample Request Visibility (Refinement)**:
    - **ScheduleRow (Table View)**: Refactored the sample request status layout from vertical (`flex-col`) to horizontal (`flex-row`).
    - **VisualRow (Visual/Board View)**: Implemented status-aware indicators for the sample request button, providing visual feedback (colors and labels) based on the current request state (Requested, Ordered, Shipped, Received, Unavailable).
    - **Typography Standard**: Increased status label font size from `8px` to `10px` for better legibility.

## [v2.4.2] — 2026-04-27 (versi 1.9.2 Beta)

### UI Changes
- **TopHeader Layout Fix**:
    - Changed `TopHeader` to `fixed` position at the top of the viewport.
    - Standardized header padding to `px-6`, removing the redundant `78px` offset to align the logo more proportionally with the sidebar.
    - Decoupled header margins from the global design system spacing variables to ensure a stable, fixed layout.
    - Adjusted `DashboardLayout` container with `pt-16` to prevent content overlap with the new fixed header.

## [v2.4.1] — 2026-04-27 (versi 1.9.1 Beta)

### Fixed
- **Cross-Category Drag Deviation (BUG-09)**: Architecturally blocked the ability to drag and drop or swap schedule entries into a different category (e.g., preventing PL-1 from being dragged into the Paint category to become PT-1). This includes explicit UI guardrails (`toast.error`) in `ProjectScheduleMain.tsx` and `ScheduleBoard.tsx`, and backend validation throwing `ActionError` in `schedule-actions.ts` and `schedule-service.ts`.

## [v2.4.0] — 2026-04-27 (versi 1.9.0 Beta)

### UI Changes
- **Zero Hardcode Compliance**: 
    - Replaced hardcoded `font-lora` and `font-inter` with semantic design system tokens (`font-serif` and `font-sans`) across the codebase.
    - Replaced hardcoded "Premium Vibe" colors (`bg-blue-600`, `bg-blue-50`) with semantic accent colors (`bg-slate-900`, `bg-slate-50`) to comply with the Zero Hardcode policy.
- **Animation Encapsulation**: Moved `animate-in fade-in duration-700` into `DashboardPageShell` and removed redundancies from individual pages.

### Changed
- **Library Workflow**: Catalog tab now enforces `APPROVED` item visibility for all roles, resolving UX redundancy where Admin/Staff saw `PENDING` items mixed with production data.

## [v2.3.0] — 2026-04-27 (versi 1.9.4)

### UI Changes
- **Color Selector (BUG-08)**: 
    - Introduced `VisualAsset` component to handle both image URLs and solid color swatches via `color:` prefixing.
    - Updated `OptimizedUploader` with a dual-mode toggle ("Image" vs "Color") for premium asset harvesting.
    - Standardized asset rendering across `ScheduleRow`, `VisualRow`, and `ScheduleSpecEditorModal` hero sections.
- **Sample Request Visibility (BUG-04)**: Moved the "Request Sample" button out of the hover-only group in schedule rows, ensuring it is always visible and accessible for linked products.
- **Terminology Update (BUG-02)**: Renamed "Material Library" to "Product Library" across the application to reflect the broader inclusion of fixtures and samples.

### Fixed
- **Library Auto-Refresh (BUG-01)**: Implemented a robust `refreshAll` callback chain in `LibraryPage`, ensuring that product additions, metadata updates, and promotion reviews trigger immediate UI synchronization without page reloads.
- **Security Hardening (BUG-03 & BUG-05)**:
    - Added category and section validation to `ScheduleService.addOptionToEntry` and `addEntryToSchedule` to prevent cross-category product injection.
    - Enforced project-local and category-specific guards in `swapEntries`, ensuring data integrity during schedule reordering.
- **Promotion Return Type (BUG-07)**: Fixed a return type mismatch in `reviewPromotionRequestAction` that previously caused runtime errors when linking to existing duplicate catalog items.
- **Double Audit Logging (BUG-06)**: Optimized `schedule-actions.ts` by removing redundant `insertAuditLog` calls, deferring all mutation logging to the service layer for a single source of truth.
- **Syntactic Integrity**: Restored `schedule-actions.ts` and `PromotionQueueTable.tsx` after temporary corruption, ensuring production-ready code stability.

### Added
- **Deterministic Code Normalization**: integrated `normalizeCodes` into `swapEntries` to maintain sequential integrity of schedule codes after reordering.

## [v2.2.4] — 2026-04-26 (versi 1.9.3)

### UI Changes
- **Layout Alignment Fix (Miring)**: Removed redundant horizontal padding (`px-[1.5rem]`) from `DashboardPageShell` to perfectly align page content with the `TopHeader` padded container.
- **Container De-nesting**: 
    - Removed redundant background/padding wrappers from `VisualTable` and `ProjectChecklistOverview` to achieve a flatter, cleaner UI as requested.
    - Simplified `ProjectChecklistOverview` by removing internal `Card` and `Heading` elements that duplicated parent sidebar section context.
- **Premium Image Uploader**: Redesigned `UniversalImageUploader` with solid borders, subtle background tints, and refined hover states, replacing generic dashed-border styles.
- **Table Layout Hardening**: 
    - Enforced `table-fixed` layout in `ScheduleTable` and removed `overflow-x-auto` to eliminate unintended horizontal scrolling and ensure consistent column widths (Locked Table Layout).
    - Fixed a UI regression in `TableCardHead` where the `div` wrapper caused `text-[10px]` styling to cascade incorrectly, restoring the correct 10px uppercase metadata typography.
    - Tokenized the interactive column resizer handle using the `UI_ENGINE_INTERACTIVE_RESIZER` design token.
- **Modal Flow Optimization**: Updated `GradualInputForm` to dynamically exclude the "Classification" (TYPE) step when the product section (Material/Fixture) is already known, reducing redundant user input.

### Fixed
- **Table Body Typography Regression**: Restored `text-sm` to the underlying `<table />` container in `TableCard` to fix an issue where the body font size defaulted to `text-base` after stripping the Shadcn container.
- **Resizer Hydration Error**: Fixed a React hydration mismatch in `useTableResizer` by enforcing the default column widths on initial client render and syncing with `localStorage` via a `useEffect`.
- **Schedule Prefix Overwriting**: Resolved a logic defect in `schedule-service.ts` where custom category prefixes in the `PrefixDictionary` were being overwritten by generic two-letter defaults during entry creation.
- **Dynamic Step Counter**: Fixed the step progress indicator in the gradual input form to correctly reflect the total number of active steps after dynamic filtering.

### Added
- **Dynamic Product Type Context**: Improved the `Add Alternative` flow to automatically pass section context, bypassing redundant classification questions.


## [v2.2.3] — 2026-04-26 (versi 1.8)

### UI Changes
- **Phase Detail Hierarchy Flattening**: Removed the redundant `SectionCard` wrapper around the main content area in `PhaseDetailPage` to reduce visual clutter and excess padding.
- **Visual Row Contrast Polish**: Updated the selected row state in `VisualRow` to use a high-contrast dark background (`bg-slate-900`) for improved legibility of the white text overlay.
- **Optimized Uploader Premium Restyling**: Restyled `OptimizedUploader` using design tokens, fixing hardcoded radii and standardizing the gradient/shadow visual profile.
- **Table Card Scroll Fix**: Wrapped `TableCard` children in an `overflow-x-auto` container to restore proper horizontal scrolling.

### Added
- **Standardized UI Placeholder Component**: Introduced `ImagePlaceholder` in `UI_ENGINE`. This component restores the clean, stacked "NO IMAGE" visual design from v1.6 while being fully compliant with the new design system tokens.
- **Visual Identity Alignment (Lora Serif)**: Enforced the use of `font-serif` (Lora) for all product headings in the schedule table (Visual and Standard views), aligning the application with the premium StudioFlow branding rules.

### Changed
- **Visual Row UX Refinement**: 
    - Increased product image preview size from `w-14` (56px) to `w-20` (80px) to match the v1.6 "stable UI" aesthetics and improve specification visibility.
    - Updated metadata styling (Brand/Category) to be bold, uppercase, and tracked-out (`tracking-widest`) for improved readability.
    - Adjusted vertical spacing in table rows to eliminate "messiness" and restore layout balance.
- **Global Consistency**: Standardized image placeholders across `ScheduleRow`, `VisualRow`, and `LibraryFormModal` using the new canonical component.

### Technical Debt
- **Zero Hardcode Compliance**: Replaced remaining hardcoded visual overrides in schedule row components with `UI_ENGINE` tokens.

## [v2.2.2] — 2026-04-26

### Fixed
- **U-02 & U-04 UI Consistency**: Added required field asterisks to Identity and Vendor fields in `ScheduleSpecEditorModal`. Updated placeholder logic to reflect reserved states.
- **U-07 Source Context**: Added `[Shared]` indicator badge in `GradualInputForm` search suggestions to clearly differentiate global library results.
- **U-08 Navigation Hierarchy**: Added "Project Schedule > Specification" breadcrumb context to the `ScheduleSpecEditorModal` header.

### Removed
- `docs/UI_UX_Audit.md` — 100% of gaps resolved. Deferred un-architectural items and deleted the document. SSOT bumped to v2.2.2.

## [v2.2.1] — 2026-04-26

### Fixed
- **U-03 Bug Fix**: `isReadyForPromotion` in `ScheduleSpecEditorModal` now correctly
  requires Stage 1 completeness (`catalog_color`) before enabling Library promotion.
  Previously, items could be promoted without a color specification, violating SSOT §5.2.

### Changed
- **Layout Standardization**: Page animation classes moved from inner wrappers to
  `DashboardPageShell` across Product Catalog, Library, and Phase Detail pages for
  consistent page transitions.

### Removed
- `docs/audit-report.md`, `docs/PLAN.md`, `docs/PLAN2.md` — content reconciled into
  MASTER_SSOT.md and AGENTS.md; documents were stale and created confusion.

### [2.2.0] - 2026-04-25 (versi 1.7)
### System Integrity, Architecture Consolidation & UX Hardening
- **Four-Layer Architecture Migration**:
    - Successfully migrated core platform, RBAC, and domain-shared logic into `src/core`.
    - Encapsulated extension-specific services and actions within their respective `src/extensions` directories.
    - Deleted legacy `src/lib/db.ts`, `src/lib/rbac.ts`, and redundant service files to eliminate architectural debt.
- **Nomenclature & Database Realignment**:
    - Completed global namespacing (`catalog_`, `schedule_`) across Prisma schema, TypeScript interfaces, and UI components.
    - Executed `nomenclature_prefix_alignment` migration to synchronize the PostgreSQL database with the namespaced schema.
    - Renamed all remaining legacy fields in `ProductCatalog` and `PhysicalSample` to strictly use the `catalog_` prefix.
- **UX Safety & View-First Protocol**:
    - Implemented a global "Read-Only by Default" (View-First) model for the Master Product Catalog with an explicit "Modify" gatekeeper.
    - Exempted the Project Schedule from the View-First protocol to prioritize rapid drafting and project-local flexibility.
    - Standardized font hierarchy: Lora (serif) for titles/headings and Inter (sans) for functional UI elements.
- **Build Hardening & Audit Resilience**:
    - Achieved 100% production build success and type-safety verification.
    - Enforced mandatory `insertAuditLog` for every mutation in `LibraryService` and `ScheduleService` to maintain Pillar 2 compliance.
    - Standardized all visual properties (radii, typography, borders) using `UI_ENGINE` semantic tokens, eliminating hardcoded values.
- **Schedule UX Enhancements**:
    - Project Schedule entries now open directly in Edit Mode for a faster user experience.
    - Implemented "Soft Validation" for project snapshots (Color field changed from mandatory block to warning toast).
    - Enhanced `CreatableSearch` with multi-field filtering and improved product mapping in `GradualInputForm`.
- **Governance & Documentation**:
    - Updated `MASTER_SSOT.md` to v2.2.0 reflecting the new architecture and nomenclature standards.
    - Formalized AI "Main Lead" governance and semantic assessment protocols in `AGENTS.md`.
    - Completed a comprehensive three-stage system audit (`audit.md`) covering SSOT drift, backend workflows, and frontend ergonomics.

## [1.16.0] - 2026-04-24 (versi 1.6)
### Added
- **Visual Hierarchy Refactor (Schedule Table)**:
    - Prioritized **Technical Specifications** (Color, Pattern, Finish) for "Generic" items where primary identity (SKU/Name) is missing.
    - Implemented capitalized labels (`Color:`, `Pattern:`, `Finish:`) for professional consistency.
    - Added hyphen separator (`[SKU] - [Name]`) for clearer product identity.
- **Alternative Options UI Redesign**:
    - Consolidated option switcher and "Add Alternative" button into a single, cohesive premium control bar.
    - Improved counter format (`Option X / Y`) using tabular numbers for layout stability.
- **Global Catalog Search Optimization**:
    - Implemented **Category Override** in Source Search: Searching the master library now ignores category filters to maximize recall.
    - Enhanced `CreatableSearch` with multi-field filtering (SKU, Name, and Brand).

### Changed
- **Search visibility**: Improved `GradualInputForm` product mapping to include Name in the searchable dropdown label.

## [1.14.0] - 2026-04-24
### Added
- **Pillar 2 Resilience Refactor**:
    - **Multi-Project Scalability**: Migrated `ProjectScheduleEntry` uniqueness to be scoped by `project_id`, enabling identical schedule codes across different projects.
    - **Immutable Snapshot Contract**: Formalized strict namespaced snapshots (`snapshot_*`, `catalog_*`) and removed all legacy reader/writer aliases.
    - **Smart Deletion**: Implemented deterministic sibling promotion when deleting "Final" options to prevent broken schedule entries.
    - **Stage-Based Gatekeeping**: Enforced server-side validation for Stage 1 (Color mandatory) and Stage 2 (Identity + Media mandatory for promotion).
- **Security Hardening**: 
    - Enforced **ADMIN-only edit policy** for `APPROVED` catalog items. `STAFF` is restricted to editing `PENDING` items only. Removed all implied "Change Request" workflow placeholders.
    - Modified `ProjectProductRequest` to be strictly project-local; removed legacy auto-harvesting logic that created global catalog entries from custom requests.
- **Integration Deferral**: Formally marked all external integrations (CSV Export/Import, SketchUp Plugin) as **Deferred** in documentation. Code implementations remain in the codebase but are explicitly disabled (`FEATURE_DISABLED`) to prioritize core stability.

### Fixed
- **Catalog Linkage**: Refactored `add-from-existing` flow to establish immediate `product_catalog_id` linkage, eliminating the "reserve-then-patch" anti-pattern.
- **Field Mapping**: Corrected field mapping errors where `catalog_motif` was being overwritten by `catalog_product_name` during promotion.
- **Bulk Delete Payload**: Fixed a frontend bug in `ProjectScheduleMain.tsx` where the wrong key was passed during group deletion.

### Changed
- **Auto-Sync Removal**: Disabled auto-propagation of catalog updates to project snapshots to ensure historical integrity (Pillar 2 SSOT).

## [1.13.0] - 2026-04-23
### Added
- **Consolidated Library Management**: Integrated `Approval Queue` and `Sample Logistics` (Product Requests) directly into the `Material Library` extension.
- **RBAC Enforcement**: Enhanced `LibraryTabs` to show `Queue` exclusively to `ADMIN` and `Requests` to both `ADMIN` and `STAFF`.

### Removed
- **Legacy Admin Dashboard**: Purged the redundant `/admin` route and UI.
- **Navigation Cleanup**: Removed the "Admin" sidebar entry to streamline the workspace.

## [1.12.0] - 2026-04-23
### Added
- **Hybrid Quick Draft (UX Unification)**:
    - Replaced legacy multi-step inline creation with a high-performance **QuickDraftDialog** triggered from the search bar.
    - Unified the "Local Project Entry" flow with strict **Stage 1 (Draft)** compliance.
    - Mandated Brand/Vendor selection and Classification (Color/Pattern/Finishing) for all new entries.
- **Documentation Cleanup**: Deleted redundant legacy docs (`Extension_rule.md`, `Extension_byBK.md`) and synchronized terminology with the global `ProductCatalog` schema.

### Fixed
- **Runtime Stabilization**: Resolved a critical `ReferenceError: categories is not defined` in `ScheduleSearchBar.tsx` by removing incomplete/dead code and cleaning up unused imports.

### Changed
- **Terminology Standardization**: Synchronized all references to `GlobalLibrary` and `MaterialCatalog` to the canonical `ProductCatalog` persistence symbol in `MASTER_SSOT.md`.
- **README Alignment**: Updated extension-level documentation to reflect the new creation patterns.

## [1.11.0] - 2026-04-23
### Added
- **View-First UI Protocol**: Implemented a global "Read-Only by Default" pattern for all detail modals.
- **Role-Based Access Control (RBAC)**:
    - **Project Schedule**: Strictly restricted editing and library promotion to `ADMIN`, `DIC`, and `DRIC` roles.
    - **Quick Draft Dialog:** A centralized modal for rapid drafting that satisfies Stage 1 (Draft) requirements in a single step.
    - **Global Search Override:** Searching the Master Library via the selection modal overrides current category filters to ensure all library assets are discoverable regardless of their primary classification.
    - **Product Catalog**: Unified all catalog interactions into a single `LibraryFormModal` with editing restricted to `ADMIN` and `STAFF`.
- **Strict Promotion Gatekeeping**: 
    - Implemented a mandatory **Stage 1 (Color)** check for project snapshot updates.
    - Implemented a mandatory **Stage 2 (Identity + Image)** check for global library promotion.
- **UX Modernization**: Removed redundant "+ ADD PRODUCT" buttons from category headers in favor of the new inline search bar and command menu pattern.

### Changed
- **Modal Unification**: Deprecated and removed the standalone `ProductDetailModal`, unifying its functionality into the `LibraryFormModal`.
- **SSOT v1.8.0**: Updated `MASTER_SSOT.md` with explicit role permissions and View-First UI protocols.
- **Agent Rules**: Updated `AGENTS.md` to enforce the new architectural and UX standards.

### Fixed
- **Radius Hierarchy**: Corrected mismatched radii across schedule and library components using UI engine tokens.

## [1.5.1] - 2026-04-22
### Added
- **Design System Enforcement (Zero Hardcode Policy)**: Updated `AGENTS.md` with a mandatory rule banning hardcoded visual values (radii, spacing) in favor of UI engine tokens (`DESIGN_SYSTEM_CONFIG`, `var(--radius-premium)`).

### Fixed
- **Schedule Code Rendering**: Corrected the `schedule_code` display in the Table View by injecting the computed prefix-increment string directly from the service layer.
- **Zod Validation Regression**: Resolved "Invalid input: expected string, received undefined" in the schedule picker by fixing field namespacing (`schedule_category`) and providing fallbacks for mandatory catalog fields.
- **Visual Parity**: Replaced hardcoded `rounded-xl` with `var(--radius-premium)` across schedule card components.

## [1.10.0] - 2026-04-22
### Added
- **Phased Material Input UX (Pillar 2)**: Implemented a progressive disclosure flow for schedule entries.
    - **Stage 1**: "Initials-First" rapid drafting (Color + Brand + Image).
    - **Stage 2**: "Data Elevation" for catalog readiness (SKU + Name).
- **Promotion Guardrails**: The "Request to Catalog" action is now restricted until Primary data and Brand are finalized.
- **Visual Clarity Refactor**: Simplified UI headings and labels across Library and Schedule extensions.

### Changed
- **SSOT v1.7.5**: Updated `MASTER_SSOT.md` to prioritize Secondary/Initials in the initial drafting phase.


## [1.9.1] - 2026-04-22
### Fixed
- **Build Stabilization**: Resolved critical syntax errors in `LibraryService` and `library-actions.ts`.
- **Type Hardening**: Completed the migration from legacy `ScheduleSection` enum to canonical `ProductType` across 15+ files.
- **Database Synchronization**: Synchronized drifted database schema using `npx prisma db push` and restored the seeding workflow.
- **Login Recovery**: Re-seeded the database with admin and staff credentials.

## [1.9.0] - 2026-04-19
### Phase 3: Global Terminology Refactor & API Foundation
- **Data Migration**: Programmatically renamed legacy keys in JSON columns (`data_snapshot`, `manual_data`) using a direct PG script to ensure data integrity across the version transition.
- **Namespace Hardening**: Enforced `snapshot_` and `catalog_` prefixes across Zod schemas, TypeScript interfaces, and `ScheduleService` logic.
- **UI Legitimacy**: Removed `any` type casts in `ScheduleSpecEditorModal` and `ScheduleEntryRow`, achieving full type safety across the selection workflow.
- **API Spec**: Formalized SketchUp integration endpoints in `src/api/README.md`, specifically documenting the schedule retrieval contract for external renderers.
- **Build Stability**: Verified the namespaced architecture with a zero-error build via `npx tsc --noEmit`.


## [1.8.0] - 2026-04-19
### Added
- **Global Architectural Namespace Refactor (SSOT Alignment)**: Completed the namespacing mandate (`schedule_`, `catalog_`, `core_`) across all layers.
- **Architectural Manifest v1.5**: Hardened naming conventions for Zod Schemas and Payload structures to ensure 100% consistency with the Prisma schema.

### Changed
- **Zod Schema Hardening**: Renamed generic fields (`category`, `sort_order`, `project_type`) to namespaced variants in all validation schemas.
- **Service Layer Cleanup**: Updated `ScheduleService` and `SettingsService` for absolute consistency with namespaced fields.
- **UI Payload Alignment**: Updated `ProjectScheduleMain` and `TemplateManager` to use correctly prefixed keys in transit.
- **Prisma Schema Synchronization**: Renamed `ScheduleTemplate.category` to `schedule_category` for domain-wide consistency.

### Removed
- **Technical Debt Purge**: Deleted legacy `tsc_errors.log` and various `.bak` files.


## [1.7.0] - 2026-04-19
### Added
- **Stage 2 UI Engine Core**: Introduced a stronger settings-backed shell foundation for page containers, section cards, table cards, dialog sizing, and shared surface shadows.
- **Settings-Driven CSS Variables**: Expanded the `uiSettings` bridge to apply container width, dialog sizing, surface shadow, and sidebar rail variables globally.

### Changed
- **Global Shell Surfaces**: Reworked `TopHeader`, `NavOuter`, `SettingsShell`, `DashboardPageShell`, and `PageHeader` toward one centralized StudioFlow layout language.
- **Route Family Alignment**: Standardized the Activity, Project Activity, Library, and Material & Fixtures entry pages around the shared shell and card primitives.
- **Modal System Baseline**: Normalized `Dialog` and `AlertDialog` styling around a shared radius, border, spacing, overlay, and size contract.

## [1.6.0] - 2026-04-19
### Added
- **Canonical Terminology Matrix**: Locked mappings between persistence symbols and canonical names in `MASTER_SSOT.md`.
- **Contract Normalization**: Standardized `ScheduleService` and `UpdateScheduleEntrySchema` to use canonical keys (`schedule_qty`, `schedule_unit`, etc.) in transit.

### Changed
- **Backend Consolidation (Stage 1)**: Initiated backend hardening plan. Prioritizing contract stability over immediate DB schema changes.
- **Audit Integrity**: Verified `insertAuditLog` coverage across all `ScheduleService` and `LibraryService` mutation paths.

### Removed
- **Obsolete Documentation**: Deleted `audit_results.md` after finalizing the Stage 1 system audit. Note: `PROJECT_STATUS.md` was restructured and restored as an active operational status document.

## [1.5.0] - 2026-04-18
### Added
- **catalog_brand Resilience**: Added `catalog_brand` directly to the `MaterialCatalog` model to decouple product identity from volatile vendor relationships.
- **Namespaced Terminology**: Implemented comprehensive namespacing across the entire stack (`catalog_`, `schedule_`).

### Changed
- **Unified Refresh Protocol**: Replaced all `window.location.reload()` calls with `router.refresh()` for a smoother SPA experience.
- **Payload Normalization**: Standardized API responses from `ScheduleService` to use namespaced fields.
- **SSOT Alignment**: Synchronized `MASTER_SSOT.md` and extension READMEs with the new terminology architecture.

### Fixed
- **Database Reset Recovery**: Re-seeded the development database following migration resets to restore user access and sample data.
- **TypeScript Solidification**: Resolved all terminology-related type regressions in `ProjectScheduleMain` and `ScheduleCategorySection`.

## [1.4.0] - 2026-04-17
### Added
- **AI Main Lead Governance**: Formalized the AI Assistant as the "Main Lead" for architectural integrity and documentation custodian.
- **Reserved Entry Notification**: Added a notification banner in the schedule categories to summarize hidden reserved items.
- **Schedule README**: Comprehensive documentation at `src/extensions/schedule/README.md`.

### Changed
- **Schedule Selection Logic**: Implemented anchor-based range selection (Shift-Click) and Ctrl-Click multi-select in `ProjectScheduleMain.tsx`.
- **Interaction Model**: Standardized on Select-on-Click and Edit-on-Double-Click for schedule entries.
- **Table Visibility**: `[RESERVED]` labels are now suppressed from the table view, though the rows remain visible to maintain code sequentiality. A notification indicator replaces the hard text.
- **Editor UX**: Reserved items in the `ScheduleSpecEditorModal` now show a placeholder and notification instead of hard-coded `[RESERVED]` text.
- **Library Sync**: Implemented `getScheduleSuggestionsAction` and `CreatableSearch` in the Editor Modal to sync Brand and Product Information with the Global Library.
- **Product Information Logic**: Standardized display and entry format to `[SKU] - [Name]` with automatic substitution of `motif_or_color` when primary identifiers are missing.

### Fixed
- Selection overlap bugs where product info clicks blocked row selection.
- Double-click/Single-click event conflicts in `ScheduleEntryRow.tsx`.

---

## [1.3.0] - 2026-04-16
### Added
- **Pillar 2 Resilience**: Snapshot-First architecture for Material & Fixtures Schedule.
- **Audit System**: `insertAuditLog` integration for all schedule mutations.
- **Master SSOT**: Initial version of the Single Source of Truth document.
