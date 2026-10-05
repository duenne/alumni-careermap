# Migration Baseline

## Existing architecture

- Next.js
- React
- TypeScript
- Prisma
- PostgreSQL
- deployment currently associated with Vercel
- database currently hosted through Supabase
- no Supabase client dependency required by core domain
- AI functionality must be optional

## Target architecture

- self-hosted
- Docker Compose
- Next.js
- PostgreSQL
- Prisma
- D3
- optional Python analytics
- optional AI provider

## Canonical domain model

- Alumni
- Degree
- CareerStep
- AlumniTimelineItem
- Program
- Institution
- Organisation

## Security / migration rules

- no personal fixtures
- no secrets
- no debug endpoints from legacy app
- no legacy authentication implementation
- synthetic test data only