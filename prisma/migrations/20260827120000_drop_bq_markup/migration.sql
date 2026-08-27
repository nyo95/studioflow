-- BQ-39: pricing is coefficient x snapshot price only. Markup, OH, profit,
-- tax, and discount are outside the BQ model.
ALTER TABLE "bq"."BqObject"
  DROP COLUMN "markup_pct";

ALTER TABLE "bq"."BqSettings"
  DROP COLUMN "default_markup_pct";

ALTER TABLE "bq"."BqLibraryObject"
  DROP COLUMN "markup_pct";
