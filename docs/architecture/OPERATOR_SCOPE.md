# Operator Scope Configuration

This note implements the installation operator boundary defined in the
[normative MVP Domain Model](MVP_DOMAIN_MODEL.md), sections 2 and 8.

One installation supplies exactly one trusted scope using this TypeScript contract
from `src/lib/operator-scope.ts`:

```ts
type OperatorScope =
  | Readonly<{ kind: "INSTITUTION"; institutionId: string; faculty?: never }>
  | Readonly<{ kind: "FACULTY"; institutionId: string; faculty: string }>;

type SurveyResponseServiceConfiguration = Readonly<{ operatorScope: OperatorScope }>;
```

Call `createConfirmedSurveyResponse(client, input, configuration)` with configuration
supplied by trusted server code, separately from alumni-supplied response input.
Future instance configuration must supply the same scope for the installation;
request bodies, invitation text and alumni selections must never determine it.
Deployment wiring and environment-variable names are intentionally deferred.
This contract describes organizational affiliation, not user authorization or
tenant isolation. Institution remains an education catalog record.

`institutionId` must be a UUID in the standard hyphenated form and identify an
existing Institution. Uppercase UUID spelling is accepted as the same identity.
INSTITUTION covers every Program belonging to that Institution, regardless of
faculty, including NULL faculty. Providing a faculty in this variant is invalid.
FACULTY additionally requires a nonblank string matching `Program.faculty`
exactly: comparison preserves case, whitespace and Unicode representation.
Blankness validation does not trim or normalize the supplied scalar. NULL Program
faculty, missing scope, malformed scope, missing faculty, and unknown Institution
all fail closed; FACULTY never falls back to INSTITUTION. Names are not identifiers.

Within the existing response transaction, C.1 locks Survey and verifies OPEN.
The service validates the configured Institution and reads the reference Program
under `FOR SHARE`, protecting its affiliation through commit/rollback. Only after
affiliation succeeds do the existing Alumni and Degree validation and persistence
continue. The full lock sequence is Survey `FOR UPDATE`, Program `FOR SHARE`,
Alumni `FOR UPDATE`, Degree `FOR UPDATE`; the existing Survey → Alumni → Degree
order remains intact. Errors use `InvalidOperatorConfigurationError` or
`SurveyOutsideOperatorScopeError`. No second transaction or early commit occurs;
success resolves after commit, and failure creates no response.

No new entities, schema fields or migrations are needed. The service changes
neither `Survey.referenceProgramId` nor `Program.institutionId`. Future Degree
mutation services must retain the existing lock order and protect confirmed
references; those operations are outside this step.
