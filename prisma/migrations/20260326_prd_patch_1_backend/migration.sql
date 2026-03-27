ALTER TABLE "ChecklistTemplate"
ALTER COLUMN "phase_enum" DROP NOT NULL;

ALTER TABLE "ProjectChecklist"
ALTER COLUMN "phase_id" DROP NOT NULL;
