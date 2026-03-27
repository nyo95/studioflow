CREATE TABLE "Client" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "logo_url" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Client_name_key" ON "Client"("name");

ALTER TABLE "Project"
ADD COLUMN "clientId" TEXT;

INSERT INTO "Client" ("id", "name", "address", "logo_url", "updated_at")
SELECT
  'client_' || md5(LOWER(BTRIM("client_name"))),
  BTRIM("client_name"),
  NULLIF(MAX(NULLIF(BTRIM("address"), '')), ''),
  NULL,
  CURRENT_TIMESTAMP
FROM "Project"
WHERE "client_name" IS NOT NULL
  AND BTRIM("client_name") <> ''
GROUP BY LOWER(BTRIM("client_name")), BTRIM("client_name")
ON CONFLICT ("name") DO NOTHING;

UPDATE "Project" AS p
SET "clientId" = c."id"
FROM "Client" AS c
WHERE p."client_name" IS NOT NULL
  AND BTRIM(p."client_name") <> ''
  AND LOWER(BTRIM(p."client_name")) = LOWER(c."name");

ALTER TABLE "Project"
ADD CONSTRAINT "Project_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

ALTER TABLE "Project"
DROP COLUMN "client_name";
