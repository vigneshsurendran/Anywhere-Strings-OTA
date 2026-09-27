# F02 — Load Language Data

Status: specification only. Depends on F01.
Read [MVP](../MVP.md) and [technical plan](../TECHNICAL_PLAN.md).
Contract and error-handling details below are proposed pending original artifacts.

## Objective and scope

Load the existing Android manifest and language files through an authorized
server operation. Establish a coherent original snapshot for later editing and
publishing. Do not add write operations or invent a storage schema.

## Inputs required before implementation

Obtain real redacted manifest/language examples, locale/key/value semantics,
version/checksum fields, bucket/object paths, and Android reader expectations.
Confirm delegated Google user credentials, OAuth scopes, token lifecycle, and
bucket IAM permissions. Preserve metadata not owned by the editor.

## Acceptance criteria

- Unauthenticated users cannot load data. Permission denial is distinct from
  missing/malformed data and temporary storage failure.
- GCS operations live in `src/lib/gcs/` and orchestration in `src/server/`.
- Loading records both the original values and their manifest/storage revision.
- Detect a release changing during a load; retry safely or request a reload.
- A partial or invalid snapshot never becomes editable or publishable.
- Display loading, success, and actionable failure states with a retry action.
- The browser never receives provider credentials or controls arbitrary storage
  paths. Allow only objects belonging to the configured Android dataset.

## Verification

Use representative fixtures and mocked GCS responses for valid data, missing
files, malformed manifest/language data, access denial, expired credentials,
partial failures, and a manifest changing during load. Live production data is
not a test fixture. Run project checks and relevant tests when implemented.
