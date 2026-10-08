-- Phase B.3: Timeline ordering and references only.
BEGIN;

CREATE TYPE "AlumniTimelineItemType" AS ENUM ('DEGREE', 'CAREER_STEP');

CREATE TABLE "AlumniTimelineItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alumniId" UUID NOT NULL,
    "type" "AlumniTimelineItemType" NOT NULL,
    "position" INTEGER NOT NULL,
    "degreeId" UUID,
    "careerStepId" UUID,

    CONSTRAINT "AlumniTimelineItem_pkey" PRIMARY KEY ("id")
);

-- Immediate uniqueness permits gaps and independent Alumni timelines.
-- The leading alumniId also covers the direct owner FK.
CREATE UNIQUE INDEX "AlumniTimelineItem_alumniId_position_key" ON "AlumniTimelineItem"("alumniId", "position");

-- Ordinary NULL-distinct uniqueness allows multiple unused target columns.
-- Each globally unique station reference also covers its composite owner FK.
CREATE UNIQUE INDEX "AlumniTimelineItem_degreeId_key" ON "AlumniTimelineItem"("degreeId");

CREATE UNIQUE INDEX "AlumniTimelineItem_careerStepId_key" ON "AlumniTimelineItem"("careerStepId");

ALTER TABLE "AlumniTimelineItem" ADD CONSTRAINT "AlumniTimelineItem_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "Alumni"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Reuse the immediate owner-target keys established in Phase A and B.2.
-- MATCH SIMPLE permits the inactive target's NULL reference.
ALTER TABLE "AlumniTimelineItem" ADD CONSTRAINT "AlumniTimelineItem_alumniId_degreeId_fkey" FOREIGN KEY ("alumniId", "degreeId") REFERENCES "Degree"("alumniId", "id") MATCH SIMPLE ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "AlumniTimelineItem" ADD CONSTRAINT "AlumniTimelineItem_alumniId_careerStepId_fkey" FOREIGN KEY ("alumniId", "careerStepId") REFERENCES "CareerStep"("alumniId", "id") MATCH SIMPLE ON DELETE CASCADE ON UPDATE NO ACTION;

-- SQL-only invariants: exactly the target matching the type, and positive positions.
ALTER TABLE "AlumniTimelineItem"
    ADD CONSTRAINT "AlumniTimelineItem_type_target" CHECK (
        ("type" = 'DEGREE' AND "degreeId" IS NOT NULL AND "careerStepId" IS NULL)
        OR ("type" = 'CAREER_STEP' AND "degreeId" IS NULL AND "careerStepId" IS NOT NULL)
    ),
    ADD CONSTRAINT "AlumniTimelineItem_position_positive" CHECK ("position" > 0);

COMMIT;
