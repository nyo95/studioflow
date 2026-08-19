# StudioFlow — Designer-First Vision & Findings

Planning + findings, written from the seat of the person who uses this most: the **designer** (role `DIC`). The office pipeline is fixed and correct — MOODBOARD → LAYOUT → DESIGN_3D → **CD** → SUPERVISION → COMPLETED — where **CD is the drafter's domain (`DRIC`) and everything else is the designer's.** The goal here is not to change that pipeline. It's to make the software feel like a sidekick instead of a form to feed.

---

## The one-line reframe

**The app already knows who the designer and drafter are — it just doesn't act like it.**

Grounded in the code:
- `Project` stores `pic_designer_id` and `pic_drafter_id`.
- The phase page permissions already encode the exact split you described: `CD` acts belong to `DRIC` + `pic_drafter_id`; every other phase belongs to `DIC` + `pic_designer_id`.
- But that knowledge is used only to *enable/disable buttons*. It never shapes the *experience*. Worse, the home dashboard (`(dashboard)/page.tsx`) redirects anyone who isn't `ADMIN` — so a designer doesn't even get a home base.

That's the whole opportunity: turn latent role-awareness into a role-tailored experience with one clean designer↔drafter handoff at CD.

---

## If I were the designer using this, my day should feel like…

**1. A calm home that answers "what needs me right now" — across all my projects.**
A designer juggles several projects at once. The first screen should separate *waiting on me* from *waiting on the client* from *waiting on the drafter*. Today there's no designer home (it's admin-gated); the designer lands in a project list and has to open each one to find out where things stand. That's the single biggest daily friction.

**2. Each project as a visual story, not a control panel.**
Opening a project, I want one glance: which phase we're in, what it's blocked on, and the *one* next action. A horizontal phase strip (6 stops, current highlighted, a "with client" / "with drafter" pill) beats a heavyweight phase page. The status machine (7 states) should hide behind a few human actions — "Send for internal review", "Send to client", "Approve", "Hand to drafter" — not be something I hand-crank.

**3. Selecting materials & furniture should feel like curating a board, not filling a spreadsheet.**
This is the creative core of my job. The schedule is the *structured output*, but my interaction with it should be visual — image-first cards, pick-and-reuse from the library, drag to arrange. Right now it's table/form-heavy, and the library reuse is undercut because everything is copied into a snapshot with no clear "reuse" feel (see the audit's Library↔Schedule section). Keep the snapshot (specs must freeze), but make *choosing from the library* the obvious, visual front door.

**4. Client reviews as a first-class loop.**
Half my life is "send → wait → revise → approve." That loop is currently buried inside the phase status enum (`ON_REVIEW_INTERNAL`, `ON_REVIEW_CLIENT`, `APPROVED_INTERNAL`…). Surface it directly: one button to send, a clear pending state, approvals visible with who/when. The revisions model already exists to back this.

**5. CD is a handoff, not my homework.**
When DESIGN_3D is approved, I hand the project to the drafter. I should see a clean handoff card — "Design approved → handed to [drafter name]" — and then CD progress as *read-mostly* status. I should not be dragged through CD drafting ceremony; that's the `DRIC`'s screen, with their own focused view. When CD comes back, I move into SUPERVISION.

**6. Supervision = site reality.**
Site visits, issues, minutes. The MOM (minutes-of-meeting) feature already exists — this phase should lean on it and on photo capture, not on abstract status toggles.

---

## Findings — what gets in the way today

- **Role-blind experience.** The roles (`DIC`/`DRIC`) and the CD-vs-rest split exist in permissions but nowhere in *layout*. Everyone sees the same heavy machinery. A designer sees CD ceremony; a drafter sees designer tooling.
- **No designer home.** `(dashboard)/page.tsx` is admin-only. There is no cross-project "my plate" for the person who lives in this tool daily.
- **Phase status leaks engineer vocabulary.** `READY_FOR_NEXT`, `APPROVED_INTERNAL`, etc. are shown as-is. Seven states × six phases is a lot to reason about for a workflow that, to a human, is really "working / in review / approved / done."
- **Silent locking.** `is_locked` gates phases without explaining why, which reads as the tool fighting the user. The rule may be correct (no CD before 3D approval) — it just needs to say so, with an easy override (`allow_parallel` already exists).
- **Form-heavy where it should be visual.** The creative phases (moodboard/layout/3D) have status but no dedicated creative surface; the schedule is tables. Designers think in images.
- **Library reuse is muddy.** Snapshot-on-insert is right, but field duplication across ProductCatalog / snapshot / entry / SketchupMaterial makes "reuse" invisible and the picker/manual/plugin flows inconsistent.
- **SketchUp is an admin island.** The whole SketchUp integration is `ADMIN`-gated and lives on its own long page, disconnected from the designer's material-selection flow — even though that's exactly where synced materials should land.

---

## The plan (planning only — no code yet)

**Phase A — give the designer a home and a glance.**
1. A designer landing view: "waiting on me / waiting on client / waiting on drafter," across projects, built on the existing `pic_designer_id` filter.
2. A horizontal phase strip on each project page: current phase + one primary next-action + a "with client / with drafter" pill. Status machine hidden behind named actions.

**Phase B — make the pipeline feel human.**
3. Relabel statuses to plain language; collapse what the designer *sees* to working / in review / approved / done, deriving the internal-vs-client nuance from the review loop.
4. Explicit, explained locking with a visible override.
5. A first-class review loop (send internal / send client / approve) wired to the revisions model.

**Phase C — the CD handoff and role views.**
6. A handoff card at DESIGN_3D → CD: designer hands to drafter; designer's CD view becomes read-mostly; drafter gets a focused CD workspace.
7. Role-tailored project view: designer sees creative + supervision emphasis; drafter sees CD emphasis. Same data, different lens.

**Phase D — curation over data entry.**
8. Visual, library-first material selection; keep snapshot-freeze, unify snapshot-building, make reuse obvious.
9. Weave synced SketchUp materials into the designer's selection flow instead of an admin island.

---

### The through-line
Everything above is the same theme as the technical audit: the *concepts are right* (real office pipeline, real role split, snapshot specs) — they're just modeled for the database, not for the person. Making it designer-friendly is mostly **surfacing what the system already knows** (who you are, what phase, what's waiting) and **hiding the machinery** behind a few human actions. It's a re-skin of behavior, not a re-architecture.
