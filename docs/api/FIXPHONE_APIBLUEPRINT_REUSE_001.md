# FIXPHONE-APIBLUEPRINT-REUSE-001 — ApiBlueprint Capability Review

## Source

Repository: `LuisHdezE/ApiBlueprint`

Reviewed against FixPhone architecture and API contract, not used as a requirements source.

## Decision classes

- **REUSE**: semantics and architecture align closely.
- **ADAPT**: useful foundation but FixPhone requires meaningful changes.
- **EXCLUDE**: does not fit FixPhone architecture/domain as implemented.
- **MISSING**: required by FixPhone but ApiBlueprint has no equivalent implemented capability.

## Review

| ApiBlueprint capability | Decision | Rationale |
|---|---|---|
| Clean Architecture boundaries | REUSE | Matches FixPhone dependency direction. |
| Laravel 13 baseline / composer structure | REUSE | Compatible subject to runtime confirmation at bootstrap. |
| CorrelationIdMiddleware | REUSE | Direct match. |
| ProblemDetails support | ADAPT | Add FixPhone stable `code` taxonomy and exact problem conventions. |
| Sanctum auth infrastructure | ADAPT | FixPhone needs customer + internal principal semantics and ownership rules. |
| auth.login | ADAPT | Useful implementation, adapt identity behavior and web/mobile auth modes. |
| auth.logout | REUSE/ADAPT | Revocation pattern aligns. |
| users.list/show/create | ADAPT | Good slice skeleton, but FixPhone RBAC is richer. |
| admin gate pattern | ADAPT | Replace simplistic admin gate with granular business permissions. |
| list query support | REUSE | Pagination/filter/sort infrastructure is broadly applicable. |
| products.list/show | ADAPT | Patterns useful, demo Product model far too small. |
| SQLite demo database | EXCLUDE | FixPhone authority is MySQL/InnoDB. |
| LogAuditTrail | EXCLUDE as final adapter | FixPhone requires durable relational audit. |
| AuditTrail port | REUSE | Fits architecture; bind durable MySQL adapter. |
| CacheIdempotencyStore | ADAPT | Critical FixPhone commands need durable replay semantics. |
| Idempotency middleware | ADAPT | Keep protocol, bind durable store. |
| Rate limiting | REUSE | Fits security model. |
| OpenAPI generation/traceability | REUSE | Strong fit. |
| Postman generation/coverage | REUSE | Useful later in Postman Contract phase. |
| Architecture boundary tests | REUSE | Extend for FixPhone modules. |
| Feature recipe registry/export engine | REUSE | Useful for selective bootstrap. |
| Blank export | REUSE | Good foundation. |
| Generic commerce preset | ADAPT | Composition hint only, FixPhone domain is much richer. |
| production deploy to Eliasworks | DEFER | FixPhone deployment target not yet fixed. |
| generated Swagger/live catalog admin | EXCLUDE from product runtime | Factory capability, not FixPhone business functionality. |

## Missing FixPhone capabilities

ApiBlueprint currently lacks implemented canonical features for:

- acquisitions/lots/provenance;
- consignments/settlements;
- serialized device identity and IMEI evidence;
- diagnostics/grading;
- economic routing;
- repair orders;
- dismantling and donor traceability;
- inventory reservations and movement ledger;
- fixed-precision costing snapshots;
- carts/orders/payments/fulfillment at FixPhone depth;
- warranty/returns;
- expenses/profitability;
- Mercado Libre adapters;
- Meta catalog adapters;
- WhatsApp integration;
- transactional outbox/provider-event inbox.

## Adoption strategy

1. Do not copy ApiBlueprint wholesale.
2. Export/reuse only approved cross-cutting capabilities.
3. Preserve source SHA/provenance for imported/generated capability.
4. Replace demo SQLite assumptions with FixPhone MySQL.
5. Upgrade audit/idempotency adapters before production use.
6. Build FixPhone domain modules in FixPhone.
7. Generalize back into ApiBlueprint only through its own governed process.

## Recommended initial ApiBlueprint selection

- clean architecture skeleton;
- correlation ID;
- Problem Details;
- Sanctum plumbing;
- auth login/logout;
- users base slice as scaffolding;
- shared pagination/filter/sort;
- audit port;
- idempotency port/middleware;
- rate limiting;
- OpenAPI/Postman generation contracts;
- architecture tests;
- blank/export composition machinery.

Final import/export occurs only after this API Contract PR is approved.
