# FIX-F7C-001 Audit Evidence

## Scope

Audit of PR #10 for FixPhone RBAC and IAM.

- Base: `main@7072fc461dc1011e701de1819eddf87ab4611d66`
- Reviewed implementation head: `bb5ac2cf86daf185e7d186a320819a228b61b688`
- CI run: #7 / 37386066777
- CI conclusion: **SUCCESS**

## Result

**PASS FOR F7C RBAC/IAM INCREMENT**

This is not an `api_implemented` PASS.

## Verified contract operations

- API-IAM-001 `usersList`
- API-IAM-002 `usersShow`
- API-IAM-003 `usersCreate`
- API-IAM-004 `usersUpdate`
- API-IAM-005 `usersDeactivate`
- API-IAM-006 `rolesList`
- API-IAM-007 `roleAssignmentsUpdate`

## Verified authorization behavior

- IAM is protected by authoritative backend permission `users.manage`.
- Direct API calls without the permission return 403.
- Login and `authMe` expose effective roles and permissions.
- User deactivation revokes Sanctum tokens.
- Self-deactivation through the IAM endpoint is blocked.
- Roles map to stable business permissions from the approved API contract.

## Verified data model

- Relational roles, permissions, role-permission assignments and user-role assignments.
- Base FixPhone roles reflect approved business actors.
- Transitional single-role storage is no longer authoritative.

## Verified idempotency

- `usersCreate` requires `Idempotency-Key`.
- Identical retries can replay the completed response.
- Conflicting key reuse returns `idempotency_conflict`.

## Verified audit

- User create/update/deactivate events are durable.
- Role assignment changes emit `ACCESS.ROLE_CHANGED`.
- Effective permission changes emit `ACCESS.PERMISSION_CHANGED`.

## Verified tests

- authentication remains green after RBAC migration.
- user administration lifecycle is covered.
- role replacement and effective permission projection are covered.
- unauthorized IAM access is covered.
- invalid role/idempotency input is covered.

## Product sequencing

By explicit product decision, after F7C merge work shifts to a WebBlueprint audit and FixPhone web MVP integration. Remaining backend endpoint families are retained as explicit implementation debt.

## Gate state

`api_implementation = IN_PROGRESS`

`api_implemented = PENDING`

## Human boundary

Auditor PASS does not authorize merge. Explicit human merge approval remains required.
