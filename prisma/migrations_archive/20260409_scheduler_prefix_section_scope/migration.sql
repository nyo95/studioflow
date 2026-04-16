ALTER TABLE "PrefixDictionary"
  DROP CONSTRAINT IF EXISTS "PrefixDictionary_category_key";

ALTER TABLE "PrefixDictionary"
  ADD CONSTRAINT "PrefixDictionary_section_category_key" UNIQUE ("section", "category");

ALTER TABLE "ProjectScheduleEntry"
  DROP CONSTRAINT IF EXISTS "ProjectScheduleEntry_project_id_code_key";

ALTER TABLE "ProjectScheduleEntry"
  ADD CONSTRAINT "ProjectScheduleEntry_project_id_section_code_key" UNIQUE ("project_id", "section", "code");
