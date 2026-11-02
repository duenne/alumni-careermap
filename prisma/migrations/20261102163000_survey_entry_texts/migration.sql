-- Editorial content belongs to one survey. NULL keeps the standard wording.
ALTER TABLE "Survey"
  ADD COLUMN "entryHeading" TEXT,
  ADD COLUMN "entryIntro" TEXT,
  ADD COLUMN "entryWelcome" TEXT,
  ADD COLUMN "entryPurpose" TEXT,
  ADD COLUMN "entryContact" TEXT,
  ADD CONSTRAINT "Survey_entryHeading_check" CHECK ("entryHeading" IS NULL OR (length(btrim("entryHeading")) > 0 AND length("entryHeading") <= 160)),
  ADD CONSTRAINT "Survey_entryIntro_check" CHECK ("entryIntro" IS NULL OR (length(btrim("entryIntro")) > 0 AND length("entryIntro") <= 600)),
  ADD CONSTRAINT "Survey_entryWelcome_check" CHECK ("entryWelcome" IS NULL OR (length(btrim("entryWelcome")) > 0 AND length("entryWelcome") <= 3000)),
  ADD CONSTRAINT "Survey_entryPurpose_check" CHECK ("entryPurpose" IS NULL OR (length(btrim("entryPurpose")) > 0 AND length("entryPurpose") <= 1600)),
  ADD CONSTRAINT "Survey_entryContact_check" CHECK ("entryContact" IS NULL OR (length(btrim("entryContact")) > 0 AND length("entryContact") <= 300));
