ALTER TABLE "User"
ADD COLUMN "email" TEXT,
ADD COLUMN "password" TEXT;

ALTER TABLE "SystemConfig"
ADD COLUMN "app_title" TEXT NOT NULL DEFAULT 'StudioFlow';

INSERT INTO "SystemConfig" ("id", "app_title", "is_auto_naming_enabled")
VALUES ('default', 'StudioFlow', true)
ON CONFLICT ("id") DO NOTHING;

UPDATE "User"
SET
  "email" = CASE LOWER("name")
    WHEN 'andre' THEN 'andre@studioflow.local'
    WHEN 'berkah' THEN 'berkah@studioflow.local'
    WHEN 'iwan' THEN 'iwan@studioflow.local'
    WHEN 'raychie' THEN 'raychie@studioflow.local'
    WHEN 'virly' THEN 'virly@studioflow.local'
    ELSE CONCAT(
      LOWER(REGEXP_REPLACE("name", '[^a-zA-Z0-9]+', '', 'g')),
      '+',
      LEFT("id", 8),
      '@studioflow.local'
    )
  END,
  "password" = '$2b$12$dywwQcIzJmQGBWmoJrNmVODjY4TMdX5fVKyy4V/deIPJFhhPtl71y'
WHERE "email" IS NULL OR "password" IS NULL;

ALTER TABLE "User"
ALTER COLUMN "email" SET NOT NULL,
ALTER COLUMN "password" SET NOT NULL;

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
