# FixPhone Architecture Decision Records

## ADR-ARCH-001 — Modular monolith first

**Status:** Proposed for approval.

Use one Laravel deployable with explicit domain modules and one MySQL authoritative database. Do not introduce microservices until measured scaling/ownership needs justify extraction.

## ADR-ARCH-002 — MySQL is core authority

**Status:** Proposed for approval.

MySQL/InnoDB is authoritative for stock, orders, costs, settlements, audit and integration coordination. Provider systems remain authoritative only for provider-owned external facts.

## ADR-ARCH-003 — Transactional outbox for external effects

**Status:** Proposed for approval.

Persist business change and outbound integration intent atomically, dispatch asynchronously and retry idempotently. Provider outages do not roll back already accepted internal truth unless the business command itself requires synchronous provider confirmation.

## ADR-ARCH-004 — Fixed-precision money

**Status:** Proposed for approval.

Authoritative money uses DECIMAL + currency. Final commercial/cost snapshots are immutable historical facts.

## ADR-ARCH-005 — Framework-independent domain

**Status:** Proposed for approval.

Domain/Application contracts do not expose Eloquent models, HTTP requests, provider SDK types or Laravel-specific persistence concerns.

## ADR-ARCH-006 — Sanctum first-party identity

**Status:** Proposed for approval.

Prefer Laravel Sanctum for first-party web/mobile authentication, with backend RBAC. Exact transport/login endpoints are deferred to API Contract.

## ADR-ARCH-007 — External binary storage

**Status:** Proposed for approval.

Store media/evidence binaries through a storage port; MySQL stores metadata and secure storage keys. Deployment provider remains undecided.

## ADR-ARCH-008 — No mandatory Redis/search engine at baseline

**Status:** Proposed for approval.

Begin with database-backed queue/outbox and MySQL query/search capabilities behind abstractions. Introduce Redis or dedicated search only from measured need.
