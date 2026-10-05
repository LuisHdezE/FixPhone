# FIXPHONE-API-POLICY-001 — API Architecture Policies

## Authentication

Laravel Sanctum is the preferred first-party authentication mechanism.

Authentication and authorization remain separate:
- authentication establishes principal;
- authorization evaluates permission/business ownership at the backend.

## Error contract

HTTP APIs will use a consistent Problem Details style response aligned with RFC 7807 semantics.

Minimum fields:

- `type`
- `title`
- `status`
- `detail` when safe
- `instance` or request reference when useful
- `correlationId`
- validation errors collection for 422 where applicable
- stable application error code

Security-sensitive errors must not leak stack traces, SQL details, provider secrets or authorization internals.

Expected status families include 400, 401, 403, 404, 409, 422, 429 and 5xx.

## Versioning

Initial public API namespace: `/api/v1`.

Rules:

- version only at governed compatibility boundary;
- stable OpenAPI `operationId` values once contract approved;
- additive compatible changes do not require arbitrary new major URL version;
- breaking contract change requires impact analysis and governed version/migration decision;
- external provider versions stay isolated inside adapters.

## Correlation

Every API/integration request obtains or propagates an approved correlation identifier.

Correlation ID is included in structured logs and safe error responses and linked to audit/integration events when relevant.

## Idempotency

Commands susceptible to client/provider retry use explicit idempotency semantics, especially:

- checkout/order creation;
- payment/refund commands;
- webhook consumption;
- external publication/synchronization effects where provider model allows.

Exact operation matrix belongs to API Contract Design.
