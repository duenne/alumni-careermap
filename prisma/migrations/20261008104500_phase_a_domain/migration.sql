-- Phase A only. SQL-only CHECKs and NULLS NOT DISTINCT are normative;
-- preserve them when generating later Prisma migrations.
BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "DegreeLevel" AS ENUM ('BACHELOR', 'MASTER', 'PHD', 'DIPLOMA', 'CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "DegreeStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ENDED_WITHOUT_DEGREE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Institution" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "location" TEXT,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "institutionId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "faculty" TEXT,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "referenceProgramId" UUID NOT NULL,
    "status" "SurveyStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alumni" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alumni_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Degree" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alumniId" UUID NOT NULL,
    "level" "DegreeLevel" NOT NULL,
    "status" "DegreeStatus" NOT NULL,
    "programId" UUID,
    "institutionId" UUID,
    "title" TEXT,
    "fieldOfStudy" TEXT,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "graduationYear" INTEGER,

    CONSTRAINT "Degree_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "surveyId" UUID NOT NULL,
    "alumniId" UUID NOT NULL,
    "referenceDegreeId" UUID NOT NULL,
    "confirmedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Program_institutionId_name_faculty_key" ON "Program"("institutionId", "name", "faculty") NULLS NOT DISTINCT;

-- CreateIndex
CREATE INDEX "Survey_referenceProgramId_idx" ON "Survey"("referenceProgramId");

-- CreateIndex
CREATE INDEX "Degree_programId_idx" ON "Degree"("programId");

-- CreateIndex
CREATE INDEX "Degree_institutionId_idx" ON "Degree"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Degree_alumniId_id_key" ON "Degree"("alumniId", "id");

-- CreateIndex
CREATE INDEX "SurveyResponse_alumniId_referenceDegreeId_idx" ON "SurveyResponse"("alumniId", "referenceDegreeId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResponse_surveyId_alumniId_key" ON "SurveyResponse"("surveyId", "alumniId");

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_referenceProgramId_fkey" FOREIGN KEY ("referenceProgramId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Degree" ADD CONSTRAINT "Degree_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "Alumni"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Degree" ADD CONSTRAINT "Degree_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Degree" ADD CONSTRAINT "Degree_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "Alumni"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_alumniId_referenceDegreeId_fkey" FOREIGN KEY ("alumniId", "referenceDegreeId") REFERENCES "Degree"("alumniId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- SQL-only invariants. Optional text can be NULL, but never whitespace-only.
ALTER TABLE "Institution"
    ADD CONSTRAINT "Institution_name_nonblank" CHECK ("name" ~ '[^[:space:]]'),
    ADD CONSTRAINT "Institution_location_nonblank" CHECK ("location" IS NULL OR "location" ~ '[^[:space:]]');

ALTER TABLE "Program"
    ADD CONSTRAINT "Program_name_nonblank" CHECK ("name" ~ '[^[:space:]]'),
    ADD CONSTRAINT "Program_faculty_nonblank" CHECK ("faculty" IS NULL OR "faculty" ~ '[^[:space:]]');

ALTER TABLE "Survey"
    ADD CONSTRAINT "Survey_name_nonblank" CHECK ("name" ~ '[^[:space:]]');

ALTER TABLE "Degree"
    -- Zero or one catalog association, never both; no forced placeholder.
    ADD CONSTRAINT "Degree_catalog_exclusion" CHECK ("programId" IS NULL OR "institutionId" IS NULL),
    ADD CONSTRAINT "Degree_title_nonblank" CHECK ("title" IS NULL OR "title" ~ '[^[:space:]]'),
    ADD CONSTRAINT "Degree_fieldOfStudy_nonblank" CHECK ("fieldOfStudy" IS NULL OR "fieldOfStudy" ~ '[^[:space:]]'),
    ADD CONSTRAINT "Degree_named_level_title" CHECK (
        "level" NOT IN ('DIPLOMA', 'OTHER') OR ("title" IS NOT NULL AND "title" ~ '[^[:space:]]')
    ),
    ADD CONSTRAINT "Degree_startYear_range" CHECK ("startYear" IS NULL OR "startYear" BETWEEN 1 AND 9999),
    ADD CONSTRAINT "Degree_endYear_range" CHECK ("endYear" IS NULL OR "endYear" BETWEEN 1 AND 9999),
    ADD CONSTRAINT "Degree_graduationYear_range" CHECK ("graduationYear" IS NULL OR "graduationYear" BETWEEN 1 AND 9999),
    ADD CONSTRAINT "Degree_year_order" CHECK ("startYear" IS NULL OR "endYear" IS NULL OR "startYear" <= "endYear"),
    ADD CONSTRAINT "Degree_open_status_end" CHECK ("status" NOT IN ('IN_PROGRESS', 'UNKNOWN') OR "endYear" IS NULL),
    ADD CONSTRAINT "Degree_graduation_status" CHECK ("graduationYear" IS NULL OR "status" = 'COMPLETED'),
    ADD CONSTRAINT "Degree_graduation_after_start" CHECK ("graduationYear" IS NULL OR "startYear" IS NULL OR "graduationYear" >= "startYear"),
    ADD CONSTRAINT "Degree_graduation_after_end" CHECK ("graduationYear" IS NULL OR "endYear" IS NULL OR "graduationYear" >= "endYear");

-- Program fit, reference completion/confirmation and Survey lifecycle are
-- future domain-service guarantees, not cross-table database constraints.
COMMIT;
