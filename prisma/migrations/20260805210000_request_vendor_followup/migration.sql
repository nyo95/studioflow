-- Migration: 20260805210000_request_vendor_followup
-- R9: vendor follow-up fields on ProjectProductRequest.
--
-- A designer files a request in StudioFlow; staff work it from Master Data.
-- These columns record that work: who contacted the vendor, when, what price
-- was quoted and any notes from the conversation.
--
-- vendor_contacted_by is a plain TEXT, not a FK to User, so the audit trail
-- survives a staff account being deactivated — same reasoning as
-- master_data.MaterialPrice.updated_by_name.

ALTER TABLE studioflow."ProjectProductRequest"
  ADD COLUMN IF NOT EXISTS "vendor_contacted_by" TEXT,
  ADD COLUMN IF NOT EXISTS "vendor_contacted_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "vendor_quoted_price" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "vendor_quoted_unit"  TEXT,
  ADD COLUMN IF NOT EXISTS "vendor_notes"        TEXT;

-- The Master Data notification panel filters on status; without this index it
-- is a sequential scan over every request ever filed.
CREATE INDEX IF NOT EXISTS "ProjectProductRequest_status_idx"
  ON studioflow."ProjectProductRequest" ("status");
