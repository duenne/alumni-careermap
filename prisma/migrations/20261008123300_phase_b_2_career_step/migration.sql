-- Phase B.2: CareerStep only; Timeline relations follow separately.
BEGIN;

CREATE TYPE "CareerStepType" AS ENUM ('EMPLOYMENT', 'INTERNSHIP', 'EDUCATION', 'VOCATIONAL_TRAINING', 'VOLUNTEERING', 'SELF_EMPLOYMENT', 'UNEMPLOYED', 'OTHER');

CREATE TYPE "CareerStepTemporalStatus" AS ENUM ('ONGOING', 'ENDED', 'UNKNOWN');

CREATE TABLE "CareerStep" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alumniId" UUID NOT NULL,
    "type" "CareerStepType" NOT NULL,
    "temporalStatus" "CareerStepTemporalStatus" NOT NULL,
    "organisationId" UUID,
    "roleTitle" TEXT,
    "roleCategory" TEXT,
    "functionArea" TEXT,
    "location" TEXT,
    "startYear" INTEGER,
    "endYear" INTEGER,

    CONSTRAINT "CareerStep_pkey" PRIMARY KEY ("id")
);

-- Immediate owner-target key for future composite Timeline FKs. Its leading
-- alumniId also covers the owner FK; no duplicate alumniId index is needed.
CREATE UNIQUE INDEX "CareerStep_alumniId_id_key" ON "CareerStep"("alumniId", "id");

CREATE INDEX "CareerStep_organisationId_idx" ON "CareerStep"("organisationId");

ALTER TABLE "CareerStep" ADD CONSTRAINT "CareerStep_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "Alumni"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "CareerStep" ADD CONSTRAINT "CareerStep_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- SQL-only invariants, using the same nonblank pattern as Phase A and B.1.
ALTER TABLE "CareerStep"
    ADD CONSTRAINT "CareerStep_roleTitle_nonblank" CHECK ("roleTitle" IS NULL OR "roleTitle" ~ '[^[:space:]]'),
    ADD CONSTRAINT "CareerStep_roleCategory_nonblank" CHECK ("roleCategory" IS NULL OR "roleCategory" ~ '[^[:space:]]'),
    ADD CONSTRAINT "CareerStep_functionArea_nonblank" CHECK ("functionArea" IS NULL OR "functionArea" ~ '[^[:space:]]'),
    ADD CONSTRAINT "CareerStep_location_nonblank" CHECK ("location" IS NULL OR "location" ~ '[^[:space:]]'),
    ADD CONSTRAINT "CareerStep_other_roleTitle" CHECK (
        "type" <> 'OTHER' OR ("roleTitle" IS NOT NULL AND "roleTitle" ~ '[^[:space:]]')
    ),
    ADD CONSTRAINT "CareerStep_startYear_range" CHECK ("startYear" IS NULL OR "startYear" BETWEEN 1 AND 9999),
    ADD CONSTRAINT "CareerStep_endYear_range" CHECK ("endYear" IS NULL OR "endYear" BETWEEN 1 AND 9999),
    ADD CONSTRAINT "CareerStep_year_order" CHECK ("startYear" IS NULL OR "endYear" IS NULL OR "startYear" <= "endYear"),
    ADD CONSTRAINT "CareerStep_open_status_end" CHECK ("temporalStatus" NOT IN ('ONGOING', 'UNKNOWN') OR "endYear" IS NULL);

COMMIT;
