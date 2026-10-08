-- Phase B.1: Organisation only. CareerStep relations follow separately.
BEGIN;

CREATE TABLE "Organisation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "sector" TEXT,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- Names and name/location combinations are deliberately not unique.
-- SQL-only invariants: optional text may be NULL, but never blank.
ALTER TABLE "Organisation"
    ADD CONSTRAINT "Organisation_name_nonblank" CHECK ("name" ~ '[^[:space:]]'),
    ADD CONSTRAINT "Organisation_location_nonblank" CHECK ("location" IS NULL OR "location" ~ '[^[:space:]]'),
    ADD CONSTRAINT "Organisation_sector_nonblank" CHECK ("sector" IS NULL OR "sector" ~ '[^[:space:]]');

COMMIT;
