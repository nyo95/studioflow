# StudioFlow (radsaas-2) - Master Single Source of Truth (SSOT)

> **Document Version:** 1.0  
> **Generated:** March 2026  
> **Purpose:** Freeze Pillar 1 - Complete codebase documentation for future AI agents

---

## 1. PRODUCT IDENTITY & AESTHETIC

### Product Name
**StudioFlow** (formerly radsaas-2)

### High-End Minimalist Philosophy
The application follows a strict high-end minimalist design philosophy:
- **Cleanliness:** Ample whitespace, subtle borders (slate-200), no visual clutter
- **Typography-First:** Font choices drive hierarchy; serif for headings, sans-serif for UI
- **Subtle Interactions:** Hover states use color shifts, not animations
- **Purposeful Color:** Minimal color usage - primarily slate neutrals with subtle red accents for urgent/priority items

### UI Engine Rules

#### Typography System (`src/ui_engine/design-system.config.ts`)
| Element | Font Family | Size | Weight | Tracking |
|---------|-------------|------|--------|----------|
| H1 | font-serif (Lora) | text-4xl | font-bold | tracking-tight |
| H2 | font-serif (Lora) | text-3xl | font-bold | tracking-tight |
| H3 | font-serif (Lora) | text-2xl | font-bold | tracking-tight |
| H4 | font-sans (Inter) | text-lg | font-semibold | tracking-tight |
| H5 | font-sans (Inter) | text-base | font-semibold | tracking-tight |
| H6 | font-sans (Inter) | text-sm | font-medium | tracking-tight |
| Body | font-sans (Inter) | text-sm | font-normal | tracking-normal |
| UI Meta | font-sans (Inter) | text-[10px] | font-bold | tracking-[0.18em] uppercase |

#### Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| Canvas (bg-canvas) | slate-50 (#f8fafc) | Main background |
| Card | bg-white | Card backgrounds |
| Sidebar | bg-white | Sidebar backgrounds |
| Borders | border-slate-200 | All borders |
| Accent | bg-slate-900 | Primary actions |
| Urgent/Red | red-100, red-200, rose-50/40 | Priority URGENT items |

#### Spacing & Layout
- **Container Max Width:** `max-w-[1280px]`
- **Card Padding:** `px-8 py-6` (2rem x 1.5rem)
- **Border Radius (Card):** `rounded-[1.5rem]`
- **Sidebar Outer Width:** 64px
- **Sidebar Inner Width:** 256px

---

## 2. TECH STACK & INFRASTRUCTURE

### Core Stack
| Layer | Technology | Version/Notes |
|-------|------------|---------------|
| Framework | Next.js | 15 (App Router) |
| Language | TypeScript | Strict mode |
| Styling | Tailwind CSS | With custom UI Engine tokens |
| Database | PostgreSQL | Supabase Singapore |
| ORM | Prisma | Generated client at `src/generated/prisma` |
| Auth | NextAuth.js | v5 (Auth.js) |
| UI Components | Radix UI | Dialog, Sheet, Tabs, etc. |
| Icons | Lucide React | |
| State | React useTransition | Server Actions pattern |
| Toast | Sonner | |

### Infrastructure
- **Deployment:** Vercel
- **Database Host:** Supabase (Singapore region)
- **Session Storage:** Database-backed (Prisma adapter)

---

## 3. COMPLETE DATABASE SCHEMA & ERD

### 3.1 Entity Relationship Diagram (Visual)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    USER                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │      id     │  │    name     │  │    email    │  │    role     │                │
│  │   (UUID)    │  │   String    │  │   String    │  │    Role     │                │
│  └──────┬──────┘  └─────────────┘  └──────┬──────┘  └─────────────┘                │
│         │                                  │                                         │
│         │ 1:N                             │ 1:N                                     │
│         ▼                                  ▼                                         │
│  ┌──────────────────────┐          ┌──────────────────────┐                         │
│  │   projects_as_       │          │   projects_as_      │                         │
│  │   designer           │          │   drafter           │                         │
│  └──────────────────────┘          └──────────────────────┘                         │
│                                                                                      │
│  1:N                                                                                │
│  ◄─────────────────────                                                         
│                                                                                     
│  ┌───────────────────────────────────────────────────────────────────────────────┐   │
│  │                              PROJECT                                          │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────────────────────┐  │   │
│  │  │       id        │  │      name       │  │      pic_designer_id         │  │   │
│  │  │     (UUID)      │  │     String     │  │      (FK → User)             │  │   │
│  │  └─────────────────┘  └─────────────────┘  └───────────────────────────────┘  │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────────────────────┐  │   │
│  │  │    clientId     │  │    priority    │  │    status_progress           │  │   │
│  │  │   (FK → Client) │  │ProjectPriority │  │    ProjectStatus              │  │   │
│  │  └────────┬────────┘  └─────────────────┘  └───────────────────────────────┘  │   │
│  │           │                                                                │   │
│  │           │ 1:N                                                             │   │
│  │           ▼                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │   │
│  │  │                              PHASE                                    │   │   │
│  │  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │   │   │
│  │  │  │     id      │  │  name_enum    │  │      status_enum         │   │   │   │
│  │  │  │   (UUID)    │  │  PhaseName    │  │  PENDING/IN_PROGRESS/    │   │   │   │
│  │  │  │             │  │               │  │  ON_REVIEW_INTERNAL/     │   │   │   │
│  │  │  │             │  │               │  │  ON_REVIEW_CLIENT/etc.   │   │   │   │
│  │  │  └─────────────┘  └──────────────┘  └──────────────────────────┘   │   │   │
│  │  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │   │   │
│  │  │  │ order_index │  │  is_locked   │  │        project_id        │   │   │   │
│  │  │  │    Int      │  │   Boolean    │  │      (FK → Project)      │   │   │   │
│  │  │  └─────────────┘  └──────────────┘  └──────────────────────────┘   │   │   │
│  │  │                                                                     │   │   │
│  │  │  1:N          1:N           1:N          1:N           1:N         │   │   │
│  │  │   │            │             │            │             │          │   │   │
│  │  │   ▼            ▼             ▼            ▼             ▼          │   │   │
│  │  │ ┌────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐        │   │   │
│  │  │ │Revision│ │Comment │ │Checklist │ │ CDList   │ │Timeline │        │   │   │
│  │  │ └────────┘ └─────────┘ └──────────┘ └──────────┘ └─────────┘        │   │   │
│  │  │     │                                                              │   │   │
│  │  │     │ 1:N                                                          │   │   │
│  │  │     ▼                                                               │   │   │
│  │  │ ┌─────────────┐ ┌─────────────┐                                    │   │   │
│  │  │ │  Activity  │ │    File     │                                    │   │   │
│  │  │ └─────────────┘ └─────────────┘                                    │   │   │
│  │  └─────────────────────────────────────────────────────────────────────┘   │   │
│  └───────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────┐        ┌─────────────────────┐                              │
│  │       CLIENT       │        │       VENDOR        │                              │
│  │  ┌─────────────┐   │        │  ┌─────────────┐   │                              │
│  │  │      id     │   │        │  │      id     │   │                              │
│  │  │    name     │   │        │  │    name     │   │                              │
│  │  │   address   │   │        │  │  contact_   │   │                              │
│  │  │  logo_url   │   │        │  │   person    │   │                              │
│  │  └─────────────┘   │        │  │   phone    │   │                              │
│  └─────────────────────┘        │  │  address   │   │                              │
│                                 └─────────────┘   │                              │
│                                                    │ 1:N                           │
└────────────────────────────────────────────────────┼──────────────────────────────┘
                                                     │
                                                     ▼
                                        ┌─────────────────────────┐
                                        │    GLOBAL LIBRARY      │
                                        │  ┌─────────────────┐   │
                                        │  │      id         │   │
                                        │  │ category_enum   │   │
                                        │  │ internal_code  │   │
                                        │  │   item_name    │   │
                                        │  │    price       │   │
                                        │  │    specs       │   │
                                        │  │   vendor_id    │   │
                                        │  │   (FK → Vendor)│   │
                                        │  └─────────────────┘   │
                                        │         │ 1:N           │
                                        │         ▼              │
                                        │  ┌─────────────────┐   │
                                        │  │ PROJECT_       │   │
                                        │  │ SCHEDULE       │   │
                                        │  └─────────────────┘   │
                                        └─────────────────────────┘

LEGEND:
┌─────────┐  = Entity/Model
│  Field  │  = Field with Type
└─────────┘
  │
  │ 1:N    = One-to-Many Relationship
  │ 
  ▼         = Direction of relationship
```

### 3.2 Relationship Cardinality Summary

| Parent Entity | Child Entity | Relationship | Description |
|--------------|--------------|-------------|-------------|
| User | Project | 1:N (Designer) | One user can be PIC Designer for many projects |
| User | Project | 1:N (Drafter) | One user can be PIC Drafter for many projects |
| Client | Project | 1:N | One client can have many projects |
| Project | Phase | 1:N | One project has exactly 5 phases |
| Phase | Revision | 1:N | One phase has many revisions (only 1 ACTIVE) |
| Revision | Activity | 1:N | One revision has many activities |
| Revision | File | 1:N | One revision has many files/deliverables |
| Phase | Comment | 1:N | One phase has many comments |
| Phase | CDList | 1:N | CD phase has many drawing items |
| Phase | ProjectChecklist | 1:N | Phase has its own checklists |
| Project | ProjectChecklist | 1:N | Project has global checklists (phase_id = null) |
| Project | ProjectTimeline | 1:N | Project has timeline entries |
| Project | ProjectSchedule | 1:N | Project has scheduled library items |
| Vendor | GlobalLibrary | 1:N | Vendor supplies many library items |
| GlobalLibrary | ProjectSchedule | 1:N | Library item can be scheduled in many projects |

### 3.3 Database Schema Notes

- **Soft Deletes:** Not implemented - use hard delete
- **Cascade Deletes:** Prisma handles cascading deletes for relations
- **Indexes:** Auto-generated by Prisma on @id, @unique, and FK fields

### Enums

```prisma
enum Role {
  ADMIN    // Full system access
  DIC      // Designer In Charge - handles all phases except CD
  DRIC     // Drafter In Charge - handles CD phase only
  STAFF    // Read-only access
}

enum PhaseName {
  MOODBOARD     // Phase 1
  LAYOUT        // Phase 2
  DESIGN_3D     // Phase 3
  CD            // Phase 4 - Construction Documentation
  SUPERVISION   // Phase 5 - Final phase
}

enum ProjectStatus {
  ACTIVE
  COMPLETED
  ON_HOLD
}

enum ProjectPriority {
  URGENT   // Displayed with red accents (rose-50/40, border-red-100)
  NORMAL   // Default priority
  LOW      // Lowest sort priority
}
```

### Models

#### User
```prisma
model User {
  id                   String    @id @default(uuid())
  name                 String
  email                String    @unique
  password             String    // bcrypt hashed
  role                 Role      @default(STAFF)
  projects_as_designer Project[] @relation("Designer")
  projects_as_drafter  Project[] @relation("Drafter")
  assigned_cd_drawings CDList[]
  comments             Comment[]
}
```

#### Client
```prisma
model Client {
  id         String    @id @default(uuid())
  name       String    @unique
  address    String?
  logo_url   String?
  updated_at DateTime  @updatedAt
  projects   Project[]
}
```

#### Project
```prisma
model Project {
  id              String             @id @default(uuid())
  name            String             // Format: YYYY-NNN-Name (auto-generated or manual)
  pic_designer_id String
  designer        User               @relation("Designer", fields: [pic_designer_id], references: [id])
  pic_drafter_id  String
  drafter         User               @relation("Drafter", fields: [pic_drafter_id], references: [id])
  clientId        String?
  client          Client?            @relation(fields: [clientId], references: [id])
  opening_date    DateTime?
  project_type    String             @default("RETAIL") // RETAIL, NON_RETAIL
  status_progress ProjectStatus      @default(ACTIVE)
  priority        ProjectPriority    @default(NORMAL)
  client_contact  String?
  address         String?
  area            Float?
  phases          Phase[]
  checklists      ProjectChecklist[]
  timelines       ProjectTimeline[]
  schedules       ProjectSchedule[]
}
```

#### Phase
```prisma
model Phase {
  id          String             @id @default(uuid())
  project_id  String
  project     Project            @relation(fields: [project_id], references: [id])
  name_enum   PhaseName
  status_enum String             @default("PENDING")
              // PENDING | IN_PROGRESS | ON_REVIEW_INTERNAL | APPROVED_INTERNAL |
              // ON_REVIEW_CLIENT | READY_FOR_NEXT | COMPLETED
  order_index Int
  is_locked   Boolean            @default(false)
  revisions   Revision[]
  checklists  ProjectChecklist[]
  cd_lists    CDList[]
  timelines   ProjectTimeline[]
  comments    Comment[]
}
```

#### Revision
```prisma
model Revision {
  id          String     @id @default(uuid())
  phase_id    String
  phase       Phase      @relation(fields: [phase_id], references: [id])
  major       Int        @default(1)
  minor       Int        @default(0)
  status_enum String     @default("ACTIVE") // ACTIVE | COMPLETED
  activities  Activity[]
  files       File[]
}
```

#### Activity
```prisma
model Activity {
  id          String   @id @default(uuid())
  revision_id String
  revision    Revision @relation(fields: [revision_id], references: [id])
  content     String
  mode        String   // TODO | FEEDBACK
  status      String   @default("OPEN") // OPEN | DONE
}
```

#### File
```prisma
model File {
  id          String   @id @default(uuid())
  revision_id String
  revision    Revision @relation(fields: [revision_id], references: [id])
  file_url    String
  file_name   String
  file_type   String
  uploaded_by String
  link_url    String?  // Google Drive link
  is_external Boolean  @default(false)
  created_at  DateTime @default(now())
}
```

#### ProjectChecklist
```prisma
model ProjectChecklist {
  id         String  @id @default(uuid())
  project_id String
  project    Project @relation(fields: [project_id], references: [id])
  phase_id   String?
  phase      Phase?  @relation(fields: [phase_id], references: [id])
  label      String
  is_checked Boolean @default(false)
}
```

#### CDList
```prisma
model CDList {
  id             String  @id @default(uuid())
  phase_id       String  // Must point to Phase with name_enum = CD
  phase          Phase   @relation(fields: [phase_id], references: [id])
  group_code     String  // e.g., "ARS", "MEP", "INT", normalized to "ID_X"
  drawing_name   String
  status_enum    String  @default("PENDING") // PENDING, ON_PROGRESS, DELIVERED
  assigned_to_id String?
  assigned_to    User?   @relation(fields: [assigned_to_id], references: [id])
}
```

#### Comment
```prisma
model Comment {
  id         String   @id @default(uuid())
  content    String
  author_id  String
  author     User     @relation(fields: [author_id], references: [id])
  phase_id   String
  phase      Phase    @relation(fields: [phase_id], references: [id])
  task_id    String?  // Optional - for future task-level links
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt
}
```

#### Supporting Models
- **AuditLog:** Tracks all mutations (action, entity_type, entity_id, user_id, details, created_at)
- **ProjectTimeline:** Stores NOT_STARTED | IN_PROGRESS | COMPLETED status with start_date/end_date
- **ProjectSchedule:** PRD 2 extension - library items assigned to projects with snapshots
- **GlobalLibrary:** PRD 2 extension - master library of materials/fixtures
- **Vendor:** PRD 2 extension - vendor management
- **TimelineTemplate:** Per-phase duration settings (days)
- **ChecklistTemplate:** Reusable checklist templates
- **SystemConfig:** Single-row config (app_title, is_auto_naming_enabled, ui_settings)

---

## 4. CORE WORKFLOWS & STATE MACHINES

### 4.1 Phase Lifecycle State Machine

```
[PENDING] 
    │
    ├──[activatePhase]──> [IN_PROGRESS] (creates Revision 1.0)
    │                         │
    │                         ├──[submitForInternalReview]──> [ON_REVIEW_INTERNAL]
    │                         │                                   │
    │                         │                                   ├──[rejectPhase(INTERNAL)]──> [IN_PROGRESS] (creates 1.1)
    │                         │                                   │
    │                         │                                   └──[approveInternal]──> [APPROVED_INTERNAL]
    │                         │                                            │
    │                         │                                            ├──[submitForClientReview]──> [ON_REVIEW_CLIENT]
    │                         │                                            │                              │
    │                         │                                            │                              ├──[rejectPhase(CLIENT)]──> [IN_PROGRESS] (creates 2.0)
    │                         │                                            │                              │
    │                         │                                            └──(auto-approved via approvalClientPhase)──> [READY_FOR_NEXT] (locks phase)
    │                         │                                                                                              │
    │                         │                                                                                              ├──[activate next phase]──> next phase becomes IN_PROGRESS
    │                         │                                                                                              │
    │                         └──(SUPERVISION phase only)──> [COMPLETED] (via completeSupervisionPhase)
    │
    └──(if previous phase not ready)──> ERROR: "Fase sebelumnya harus diselesaikan terlebih dahulu."
```

#### Valid Transitions Table
| From Status | Allowed Actions |
|-------------|-----------------|
| PENDING | activatePhase |
| IN_PROGRESS | submitForInternalReview, rejectPhase (if in review) |
| ON_REVIEW_INTERNAL | approveInternal, rejectPhase(INTERNAL) |
| APPROVED_INTERNAL | submitForClientReview |
| ON_REVIEW_CLIENT | approveClientPhase, rejectPhase(CLIENT) |
| READY_FOR_NEXT | reopenPhase (ADMIN/DIC/DRIC only) |
| COMPLETED | (terminal state) |

### 4.2 Revision System

- **Creation:** Automatic when phase activates (v1.0)
- **Versioning:** Major.Minor format
- **ACTIVE vs ARCHIVED:** Only ONE active revision per phase at any time

#### Version Bump Rules
| Trigger | New Version | Activity Carryover |
|---------|-------------|-------------------|
| Client Rejection | major+1.0 | FEEDBACK+OPEN → TODO |
| Internal Rejection | minor+1 | FEEDBACK+OPEN → TODO |
| Reopen (Major Reset) | major+1.0 | Activities archived |

### 4.3 Today's View vs Project List Logic

#### Today's View (`/today`)
- **Purpose:** Daily task management
- **Filter:** Only phases with `status_enum = "IN_PROGRESS"`
- **Data:** Shows TODO activities from active revisions
- **Sorting:**
  ```typescript
  orderBy: [
    { priority: "asc" },  // URGENT first
    { name: "asc" },
  ]
  ```
- **Visual:** Urgent projects show red background (`bg-rose-50/40`)

#### Project List (`/`)
- **Purpose:** Full project overview
- **Visibility:** ADMIN sees all; DIC/DRIC see assigned projects
- **Data:** All projects with current phase info and latest revision version
- **Sorting:**
  ```typescript
  orderBy: [
    { priority: "asc" },
    { name: "asc" },
  ]
  ```

### 4.4 Heartbeat / Live Sync Logic

**Endpoint:** `/api/phases/[phaseId]/heartbeat`

**Purpose:** Poll-based live sync for real-time updates

**Implementation (`src/lib/phase-heartbeat.ts`):**
```typescript
// Returns snapshot of last 24 hours:
- comments: Comments created in last 24 hours
- checklistItems: All checklist items for phase
- activities: All activities from ACTIVE revision
```

**Usage:** Client-side polling (typically 5-30 second intervals) via `PhaseLiveProvider`

---

## 5. SECURITY & PERMISSION MATRIX

### Role Definitions

| Role | Full Name | Scope |
|------|-----------|-------|
| ADMIN | Administrator | Full system access |
| DIC | Designer In Charge | All phases except CD |
| DRIC | Drafter In Charge | CD phase only |
| STAFF | Staff | Read-only |

### Permission Rules (`src/lib/permissions.ts`)

#### Phase Editing (`canEditPhase`)
```typescript
canEditPhase(role, phaseName):
  ADMIN      → true
  STAFF      → false
  DIC        → phaseName !== "CD"
  DRIC       → phaseName === "CD"
```

#### Project Metadata Editing (`canEditProjectMetadata`)
```typescript
canEditProjectMetadata(role, userId, picDesignerId):
  ADMIN      → true
  DIC        → userId === picDesignerId
  Others     → false
```

#### Content Mutation Access (`assertPhaseContentMutationAccess`)
- **CD Phase:** Both Drafter (owner) AND Designer can edit
- **Other Phases:** Only Designer (DIC) can edit
- **Locked phases:** No mutations allowed

#### Global Checklist Access
- ADMIN: Full access
- Designer/Drafter: Can only toggle items on their own projects

### Audit Error Constants
```typescript
ERR = {
  UNAUTHORIZED_ACTION,
  INVALID_PHASE_STATE,
  PHASE_ALREADY_LOCKED,
  UNRESOLVED_ACTIVITIES_EXIST,
  RACE_CONDITION_PREVENTED,
  ITEM_NOT_APPROVED,
}
```

---

## 6. SERVER ACTIONS & DATA MUTATIONS

### New Structure (Pillar 1 Freeze)

All Server Actions have been refactored into domain-specific files in `src/actions/`:

```
src/actions/
├── _shared.ts           # Shared helpers (insertAuditLog, getActiveRevision)
├── index.ts             # Barrel export
├── phase-actions.ts     # Phase lifecycle, activities, checklists, CD items
├── project-actions.ts   # Project CRUD, priority, sync
├── client-actions.ts    # Client management
├── settings-actions.ts  # Templates, UI settings
├── user-actions.ts      # User management, auth
└── library-actions.ts   # PRD 2: Library, scheduling
```

### Phase Actions (`src/actions/phase-actions.ts`)

#### Phase Workflow Actions
| Action | Purpose | Prerequisites |
|--------|---------|--------------|
| `activatePhase(phaseId)` | Start a pending phase | Previous phase READY_FOR_NEXT or COMPLETED |
| `submitForInternalReview(phaseId)` | Move to internal review | All TODOs resolved |
| `approveInternal(phaseId)` | Approve internal review | All activities resolved |
| `submitForClientReview(phaseId)` | Send to client | Approved internally |
| `approveClientPhase(phaseId)` | Client approval received | Locks phase, advances to next |
| `rejectPhase(phaseId, type)` | Reject (INTERNAL/CLIENT) | Creates new revision with feedback |
| `reopenPhase(phaseId)` | Reopen locked phase | Major version bump |
| `completeSupervisionPhase(phaseId)` | Complete final phase | Sets project to COMPLETED |

#### Project Actions (`src/actions/project-actions.ts`)
| Action | Purpose | Access |
|--------|---------|--------|
| `bootstrapProject(data)` | Create new project with phases | ADMIN only |
| `updateProjectMetadata(data)` | Edit project details | ADMIN or DIC (own project) |
| `deleteProject(projectId)` | Delete project and all data | ADMIN only |
| `updateProjectPriority(projectId, priority)` | Set URGENT/NORMAL/LOW | ADMIN only |
| `syncProjectChecklists(projectId)` | Sync with templates | ADMIN/DIC |

#### Activity Actions (`src/actions/phase-actions.ts`)
| Action | Purpose |
|--------|---------|
| `addActivity(revisionId, content, mode)` | Add TODO or FEEDBACK |
| `updateActivityContent(activityId, content)` | Edit activity |
| `toggleActivityStatus(activityId)` | Toggle OPEN/DONE |
| `deleteActivity(activityId)` | Remove activity |

#### Checklist Actions (`src/actions/phase-actions.ts`)
| Action | Purpose |
|--------|---------|
| `toggleChecklist(checklistId, isChecked)` | Toggle checkbox |
| `addChecklistItem(phaseId, label)` | Add new checklist item |

#### CD List Actions (`src/actions/phase-actions.ts`) - Phase 4
| Action | Purpose |
|--------|---------|
| `createCDItem(phaseId, data)` | Add drawing item |
| `updateCDItem(itemId, data)` | Edit drawing item |
| `updateCDStatus(itemId, status)` | Update PENDING/ON_PROGRESS/DELIVERED |
| `deleteCDItem(itemId)` | Remove drawing |

#### Deliverables (`src/actions/phase-actions.ts`)
| Action | Purpose |
|--------|---------|
| `addDeliverable(revisionId, data)` | Upload file or link |

#### Client Actions (`src/actions/client-actions.ts`)
| Action | Purpose | Access |
|--------|---------|--------|
| `deleteClient(clientId)` | Delete client | ADMIN only |
| `mergeClients(data)` | Merge two clients | ADMIN only |
| `updateClientBranding(data)` | Update client logo/address | ADMIN only |

#### Settings & Templates (`src/actions/settings-actions.ts`)
| Action | Purpose | Access |
|--------|---------|--------|
| `upsertTimelineTemplate(phaseEnum, days)` | Set phase duration | ADMIN |
| `createChecklistTemplate(phaseEnum, label)` | Add template | ADMIN |
| `deleteChecklistTemplate(id)` | Remove template | ADMIN |
| `setAutoNamingEnabled(bool)` | Toggle auto-naming | ADMIN |
| `updateUISettings(settings)` | Update UI config | ADMIN |

#### Library & Scheduling (`src/actions/library-actions.ts`) - PRD 2
| Action | Purpose |
|--------|---------|
| `createLibraryItem(data)` | Add library item |
| `updateGlobalItemStatus(id, status)` | Approve/pending item |
| `addToProjectSchedule(projectId, itemId)` | Assign to project |
| `createVendor(data)` | Create vendor | ADMIN |

#### User Management (`src/actions/user-actions.ts`)
| Action | Purpose | Access |
|--------|---------|--------|
| `createUser(data)` | Create new user | ADMIN |
| `updateUserRole(userId, role)` | Change role | ADMIN |
| `updateUserName(userId, name)` | Edit name | ADMIN or self |
| `logout()` | Sign out | All |

#### Shared Helpers (`src/actions/_shared.ts`)
| Helper | Purpose |
|--------|---------|
| `insertAuditLog(tx, ...)` | Audit logging (used internally) |
| `getActiveRevision(tx, phaseId)` | Get active revision for phase |

### useServerAction Hook Pattern

```typescript
// src/hooks/use-server-action.ts
function useServerAction<T, P extends any[]>(
  action: (...args: P) => Promise<T>,
  options?: {
    onSuccess?: (result: T) => void;
    successMessage?: string;
  }
) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const runAction = async (...args: P) => {
    startTransition(async () => {
      try {
        const result = await action(...args);
        toast.success(options?.successMessage || "Action successful");
        router.refresh();
        if (options?.onSuccess) options.onSuccess(result);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error");
      }
    });
  };

  return { runAction, isPending };
}
```

**Usage Pattern:**
```typescript
const { runAction, isPending } = useServerAction(someServerAction);
<button onClick={() => runAction(arg1, arg2)} disabled={isPending}>
  {isPending ? "Loading..." : "Submit"}
</button>
```

---

### 6.2 Service Layer Architecture

All business logic is now separated into pure service functions in `src/lib/services/`:

```
src/lib/services/
├── phase-service.ts      # Phase business logic (526 lines)
├── project-service.ts    # Project business logic (387 lines)
├── client-service.ts     # Client business logic (124 lines)
├── user-service.ts       # User business logic (80 lines)
└── settings-service.ts  # Settings business logic (106 lines)
```

#### Service Pattern:
```typescript
// src/lib/services/project-service.ts
export const projectService = {
  async executeBootstrapProject(tx: PrismaTransaction, params: {...}) {
    // Pure business logic - no HTTP/UI concerns
    // Returns domain objects
  }
}
```

#### Action Pattern (using createAction):
```typescript
// src/actions/project-actions.ts
export const bootstrapProject = createAction(async ({ input, ctx, tx }) => {
  assertAdmin(ctx.role);
  
  const result = await projectService.executeBootstrapProject(tx, {
    ...input,
    userId: ctx.userId,
  });
  
  revalidatePath("/");
  return result;
});
```

#### Key Improvements:
1. **Separation of Concerns:** Actions = thin layer (auth, revalidation), Services = business logic
2. **Type Safety:** Uses `PrismaTransaction` instead of `any`
3. **Testability:** Services are pure functions, easily unit testable
4. **Consistency:** All 41+ actions use the same `createAction` pattern
5. **Error Handling:** Uses `ActionError` class with error codes

---

## 7. USER WORKFLOW WALKTHROUGH

### 7.1 Authentication Flow

```
1. User navigates to /login
2. Enters email + password
3. NextAuth validates credentials against User table (bcrypt)
4. On success: JWT stored in HTTP-only cookie, redirect to /
5. On failure: Error toast displayed
```

### 7.2 Project Creation Flow (ADMIN only)

```
1. ADMIN clicks "New Project" button on Dashboard
2. Modal opens with form:
   - Project name (e.g., "Toko Baju Jakarta")
   - Select Designer (DIC) from dropdown
   - Select Drafter (DRIC) from dropdown
   - Client name (auto-creates if new)
   - Opening date (optional)
   - Project type (RETAIL/NON_RETAIL)
   - Area (sqm)
   - Address, Contact info
3. ADMIN clicks "Create"
4. System generates: YYYY-NNN-Name format (if auto-naming enabled)
5. Project created with ALL 5 phases in PENDING status
6. First phase (MOODBOARD) automatically set to IN_PROGRESS
7. Revision 1.0 created for MOODBOARD phase
8. Redirect to project detail page
```

### 7.3 Phase Progression Workflow (Typical)

```
SCENARIO: DIC working on MOODBOARD phase

Step 1: View Today's Tasks
  - User goes to /today
  - Sees all IN_PROGRESS phases across assigned projects
  - Each phase shows TODO items

Step 2: Add TODO Item
  - User clicks "Add todo" inline in phase section
  - Enters task description
  - Clicks save
  - Activity created with mode=TODO, status=OPEN

Step 3: Work on Deliverables
  - User navigates to /projects/[id]/phases/[moodboardId]
  - Uploads files or adds Google Drive links
  - Marks checklist items as done
  - Resolves TODO items (toggle to DONE)

Step 4: Submit for Internal Review
  - User clicks "Submit for Review"
  - System checks: All TODOs must be DONE
  - If yes: Phase status → ON_REVIEW_INTERNAL
  - If no: Error "Unresolved activities exist"

Step 5: Internal Approval (by DIC or ADMIN)
  - Reviewer sees phase in ON_REVIEW_INTERNAL
  - Can approve → APPROVED_INTERNAL
  - Or reject → Creates Revision 1.1, back to IN_PROGRESS

Step 6: Submit to Client
  - DIC clicks "Submit to Client"
  - Phase status → ON_REVIEW_CLIENT
  - Client reviews (external)

Step 7: Client Approval
  - Client approves (via DIC/ADMIN action)
  - Phase status → READY_FOR_NEXT
  - Phase is LOCKED
  - Next phase automatically available for activation
```

### 7.4 CD (Construction Documentation) Phase Workflow

```
Special workflow for Phase 4 (CD):

1. CD Phase activated by DRIC (not DIC)
2. DRIC creates CD Drawing Items:
   - Group code: ARS (Architecture), MEP, INT, etc.
   - Drawing name: Floor plan, elevation, etc.
   - Assigned to: Optional (DRIC or external)

3. DRIC updates status:
   - PENDING → ON_PROGRESS → DELIVERED

4. In CD phase, BOTH Designer and Drafter can:
   - Add/edit activities
   - Upload deliverables
   - Manage checklist

5. Same review/approval flow as other phases
```

### 7.5 Today's View Usage

```
1. User navigates to /today
2. System shows:
   - All projects where user is Designer OR Drafter
   - Only phases with status = IN_PROGRESS
   - TODO items from active revisions

3. Features:
   - Quick-add TODO: Add task to any IN_PROGRESS phase
   - Toggle completion: Click checkbox to mark done
   - Progress bar: Shows % complete per project
   - Urgent highlighting: Red background for URGENT priority

4. Sorting:
   - Projects sorted by: Priority (URGENT first) → Name
```

### 7.6 Settings Management (ADMIN only)

```
/settings/studio:
  - App title customization
  - Auto project naming toggle
  - Phase duration templates (days per phase)
  - Checklist templates (global + per-phase)

/settings/clients:
  - View all clients
  - Edit client: name, address, logo
  - Delete client (if no projects)
  - Merge clients

/settings/users:
  - Create new user
  - Edit user: name, role
  - Delete user
```

### 7.7 Live Collaboration (Heartbeat)

```
1. User opens phase detail page
2. PhaseLiveProvider initializes
3. Polls /api/phases/[phaseId]/heartbeat every 30 seconds
4. Returns:
   - Comments from last 24 hours
   - All checklist items
   - Activities from active revision
5. UI updates automatically via router.refresh()
```

---

## 8. ROUTE STRUCTURE

```
/                           → Dashboard (Project List)
/today                      → Today's View
/login                      → Authentication
/projects/[id]              → Project Detail
/projects/[id]/phases/[id]  → Phase Detail
/settings                   → Settings Overview
/settings/studio            → Studio Settings
/settings/clients           → Client Management
/settings/users             → User Management
/library                    → Global Library (PRD 2)
```

---

## 9. KEY COMPONENT EXPORTS (`@/ui_engine`)

| Export | Purpose |
|--------|---------|
| `DashboardPageShell` | Main dashboard layout wrapper |
| `PageHeader` | Page title, description, action slot |
| `ProjectSectionItem` | Collapsible project card |
| `PhaseSectionItem` | Collapsible phase card |
| `SimpleCard` | Basic card container |
| `SimpleCardBadge` | Status badges |
| `SimpleCardBody` | Card content wrapper |
| `Heading` | Typography component (H1-H6) |
| `PhaseLink` | Phase name with status badge |
| `PhaseLiveProvider` | Context provider for heartbeat |
| `SectionCard` | Styled section container |
| `TableCard` | Table wrapper |
| `PageBackLink` | Back navigation |
| `SettingsShell` | Settings page layout |
| `DESIGN_SYSTEM_CONFIG` | Design tokens object |
| `UI_ENGINE_*_CLASS` | CSS class tokens |

---

## 10. CRITICAL IMPLEMENTATION NOTES

### Database Validation Rules
1. **Auto-naming:** Projects named `YYYY-NNN-Name` (e.g., "2026-001-Toko_Baju")
2. **Phase Order:** Fixed sequence MOODBOARD → LAYOUT → DESIGN_3D → CD → SUPERVISION
3. **One Active Revision:** Maximum ONE revision with `status_enum = "ACTIVE"` per phase
4. **CD Phase:** Only ONE phase per project can have `name_enum = "CD"`
5. **Checklist Sync:** Global checklists (`phase_id = null`) apply to all projects

### Business Rules
1. **Unresolved TODOs:** Cannot submit for review if any TODO is OPEN
2. **Sequence Enforcement:** Cannot activate phase N if phase N-1 is not READY_FOR_NEXT or COMPLETED
3. **Supervision Completion:** Completing SUPERVISION sets project to COMPLETED
4. **Reopen Rule:** Reopening creates new MAJOR version (e.g., 2.0 from 1.x)

### Authentication
- **Provider:** NextAuth.js v5 with Credentials
- **Session:** JWT stored in HTTP-only cookie
- **Password:** bcrypt hashed with cost factor 12

---

## 11. DEPLOYMENT NOTES

- **Prisma Client:** Generated to `src/generated/prisma`
- **Database URL:** `DATABASE_URL` env var (Supabase Singapore)
- **Auth Secret:** `AUTH_SECRET` env var
- **Build:** `npm run build` generates production artifacts
- **Lint:** `npm run lint` (verify before commit)

---

*End of Master SSOT - Pillar 1 Freeze*
