-- Phase B.4: Optional contact purpose, separate from the career profile.
BEGIN;

CREATE TABLE "AlumniContact" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alumniId" UUID NOT NULL,
    "displayName" TEXT,
    "email" TEXT,

    CONSTRAINT "AlumniContact_pkey" PRIMARY KEY ("id")
);

-- One contact per Alumni; this unique index also covers the owner FK.
-- Email is deliberately not unique and has no database format rule.
CREATE UNIQUE INDEX "AlumniContact_alumniId_key" ON "AlumniContact"("alumniId");

ALTER TABLE "AlumniContact" ADD CONSTRAINT "AlumniContact_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "Alumni"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Together these SQL-only CHECKs require at least one nonblank value.
ALTER TABLE "AlumniContact"
    ADD CONSTRAINT "AlumniContact_displayName_nonblank" CHECK ("displayName" IS NULL OR "displayName" ~ '[^[:space:]]'),
    ADD CONSTRAINT "AlumniContact_email_nonblank" CHECK ("email" IS NULL OR "email" ~ '[^[:space:]]'),
    ADD CONSTRAINT "AlumniContact_contact_present" CHECK ("displayName" IS NOT NULL OR "email" IS NOT NULL);

COMMIT;
