# Alumni CareerMap – Project Handover

## Purpose

Alumni CareerMap is a self-hostable open-source application for
universities/faculties to conduct alumni career surveys for a specific
study program.

The MVP pilot context is Management Sozialer Innovationen (MSI),
but the software itself must remain program-independent.

Each installation is operated by one university or faculty.
Multi-tenancy is not part of the MVP.

## Technical Stack

- Next.js
- React
- TypeScript
- Prisma
- PostgreSQL 17
- Docker Compose
- Vitest
- GitHub Actions

No mandatory dependencies on:
- Vercel
- Supabase platform services
- external AI providers
- SQLite

PostgreSQL is the only supported database.

## Normative Documents

Read these in this order:

1. `docs/architecture/MVP_DOMAIN_MODEL.md`
   - normative MVP specification
   - highest authority for current domain decisions

2. `docs/architecture/DOMAIN_MODEL_DESIGN_NOTES.md`
   - architectural background only
   - not normative where it differs from the MVP document

3. `docs/legacy/LEGACY_SCHEMA_AUDIT.md`
   - describes the old repository
   - reference only
   - do not reproduce legacy structures automatically

4. `docs/MIGRATION_BASELINE.md`
   - migration context and technical goals

## Product Model

A Survey belongs to exactly one reference Program.

Example:

Institution:
Hochschule München

Program:
Management Sozialer Innovationen

Survey:
MSI Alumni Survey

The Survey defines the program being studied.

An Alumni profile contains the normalized career history.

A SurveyResponse connects:
- Survey
- Alumni
- the explicitly confirmed reference Degree

The reference Degree is NOT a global property of Alumni.

The concrete Degree must:
- belong to the same Alumni
- correspond to the Survey reference Program
- be completed
- be explicitly confirmed

Database constraints guarantee ownership where practical.
Program matching and confirmation are Domain Service responsibilities.

## Privacy Boundary

`Alumni` is pseudonymized.

Do not store in Alumni:
- full name
- email
- LinkedIn ID
- CV file URL
- provider identifiers

Optional contact information belongs in `AlumniContact`.

Development and automated tests use synthetic data only.

Never copy personal fixtures from the legacy repository.

## Implemented

### Bootstrap

Implemented:
- Next.js / TypeScript
- Prisma
- PostgreSQL 17
- Docker Compose
- health endpoint
- Vitest
- ESLint
- GitHub Actions

### Domain Phase A

Implemented:
- Institution
- Program
- Survey
- Alumni
- Degree
- SurveyResponse

Implemented PostgreSQL guarantees include:
- UUID primary keys
- real foreign keys
- Program catalog uniqueness rules
- Survey reference Program
- Degree ownership
- Degree date/status consistency
- SurveyResponse reference Degree ownership
- one SurveyResponse per Survey/Alumni pair
- required confirmation timestamp

Integration tests include positive and negative direct PostgreSQL cases.

Latest local Phase-A implementation commit at handover:
`56ac8f1 feat: establish phase A MVP domain model`

At the latest known state, 37 integration tests passed,
Prisma validation passed, PostgreSQL migration on an empty database
passed, lint and build passed.

## Current Git Status / Remote

Repository:

`duenne/alumni-careermap`

Local main contains the Phase-A implementation.

The GitHub repository was initially created with a separate
`Initial commit` containing LICENSE.

The first push of local main was rejected as non-fast-forward because
the local and remote histories were unrelated.

If this has not already been resolved, the next Git operation is:

    git fetch origin
    git merge origin/main --allow-unrelated-histories

Review the resulting LICENSE and merge commit, then:

    git push -u origin main

Do not force-push merely to solve this history mismatch.

After GitHub CI is green, the repository can be tagged:

    v0.1.0-domain-foundation

## Next Development Step

Next branch:

`feat/domain-model-phase-b`

Implement only:

- Organisation
- CareerStep
- AlumniTimelineItem
- AlumniContact

Do not yet implement:
- LinkedIn
- CV import
- Excel import
- AI
- authentication
- dashboard
- Sankey
- real alumni data

### Phase B invariants

CareerStep:
- belongs to exactly one Alumni
- Organisation is optional
- known start/end years must be consistent
- parallel stations are allowed

AlumniTimelineItem:
- belongs to exactly one Alumni
- references exactly Degree XOR CareerStep
- referenced station belongs to the same Alumni
- position > 0
- position unique per Alumni
- same Degree/CareerStep appears at most once in timeline
- gaps are allowed
- overlapping periods are allowed

AlumniContact:
- optional
- separate from analytical profile
- no empty contact record
- deleting contact must not delete career profile

Work test-driven:
1. tests
2. Prisma model
3. PostgreSQL migration / SQL-only constraints
4. fresh-database migration
5. integration tests
6. lint
7. build

## After Phase B

Development order:

Phase C:
Survey Domain Service

Validate:
- Survey is OPEN
- reference Degree belongs to Alumni
- Degree program matches Survey.referenceProgramId
- Degree status is COMPLETED
- reference Degree was explicitly confirmed

Phase D:
Synthetic fixtures

Copy only verified synthetic:
- LinkedIn-style snapshots
- expected normalized results

Do not use them as production seeds.

Phase E:
Normalizer

Contract:

synthetic source
→ normalize
→ canonical Degree/CareerStep/Timeline representation
→ compare to expected normalized fixture

Phase F:
Persistence/import service

Phase G:
first vertical user flow

Survey
→ profile input/import
→ review career path
→ confirm reference Degree
→ persist
→ show individual timeline

Phase H:
aggregated visualization / Sankey

## Development Rules

Keep tasks small.

One branch = one bounded task.

Prefer:
implementation → tests → commit → fresh review session

Do not ask Codex to migrate or redesign the entire application in one task.

Do not silently change normative architecture.

If a task requires changing `MVP_DOMAIN_MODEL.md`,
stop implementation and make the architecture change explicitly first.

## Model Usage

Default:
GPT-6.1-Sol / Medium

Use GPT-6.1-Sol / High for:
- database constraints
- migrations
- normalization
- importer logic
- difficult regression bugs

Use GPT-6-Astra / High only occasionally for:
- architecture review
- security/privacy review
- review of a completed major milestone

Avoid carrying long Codex chat histories.
Start fresh sessions and let repository documents provide context.