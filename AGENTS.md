
# Alumni CareerMap – Agent Instructions

## Source of truth

Read before making changes:

1. `docs/architecture/MVP_DOMAIN_MODEL.md`
2. `docs/requirements/REQUIREMENTS.md`
3. `docs/requirements/UC-01_ALUMNI_DATA_DONATION.md`
4. Relevant existing code, tests and migrations.

The MVP Domain Model is normative for domain
architecture, entities and database invariants.

Requirements describe intended product behavior.
Draft requirements must not silently override
normative architectural decisions.

If implementation requires a domain architecture
change, stop and explain the conflict first.

## Development rules

- Work test-driven: RED -> GREEN -> REFACTOR.
- Keep changes small, reviewable and commit-ready.
- Do not redesign working architecture unnecessarily.
- Do not implement unrelated features.
- Use only synthetic test data.
- Never copy personal legacy data into this repository.
- PostgreSQL 17 is the only supported database.
- Use versioned Prisma/PostgreSQL migrations.
- Preserve SQL-only constraints and real foreign keys.
- Do not use `prisma db push` as a migration substitute.
- No mandatory Vercel, Supabase platform or AI services.
- Do not introduce LinkedIn or CV import unless requested.

## Verification

Run the relevant tests first, then as appropriate:

npm run lint
npm test
npm run db:validate
npm run test:integration
npm run typecheck
npm run build

Report test results and any checks that could not run.
Do not claim success for tests not executed.

Do not commit or push without explicit instruction.
