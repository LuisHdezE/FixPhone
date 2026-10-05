# FIXPHONE-ARCH-001 — Architecture / Security / Data

## 1. Status and authority

- Product: FixPhone
- Stable Blueprint: SoftwareDevelopmentBlueprint 0.5.4
- Source requirements: `docs/requirements/FIXPHONE_REQUIREMENTS_DOMAIN_001.md`
- Source interface scope: `.blueprint/ui/interface-scope-baseline.json`
- Architecture status: READY FOR REVIEW

This document defines the approved-target architecture boundary. It does not define the API endpoint inventory or OpenAPI contract.

## 2. Architectural style

FixPhone will start as a **modular monolith** implemented in Laravel, backed by one authoritative MySQL database.

Reasons:

- inventory, reservation, sale, repair, dismantling, consignment and costing require strong transactional consistency;
- the expected initial scale does not justify distributed transactions;
- deployment/operations remain simpler;
- domain modules can later be extracted only if measured operational pressure justifies it.

The architecture must preserve module boundaries so "monolith" does not become "everything imports everything".

## 3. Dependency model

Within each business module:

```text
HTTP / Console / Jobs / Webhooks
          ↓
Application
          ↓
Domain
          ↓
Ports
          ↓
Infrastructure adapters
```

Rules:

- Domain must not depend on Laravel HTTP/controllers, Eloquent models, providers or SDKs.
- Application orchestrates use cases and transactions.
- Infrastructure implements persistence, provider adapters, queues, files and external APIs.
- Presentation translates transport requests/responses only.
- Cross-module coordination occurs through application contracts/domain events, not arbitrary table/model access.

## 4. Domain modules

### IdentityAccess
Users, roles, permissions, sessions, customer/internal identity.

### MasterCatalog
Brands, models, capacities, colors, grades, part types, compatibility and commercial products.

### Acquisition
Suppliers, sources, acquisition lots, provenance and associated costs.

### Consignment
Consignors, agreements, settlement basis and settlement obligations.

### Devices
Physical device identity, IMEI/serial, photos, provenance status, lifecycle and location.

### Diagnostics
Diagnostic templates, executions, findings and grades.

### Routing
Economic evaluation, route recommendation, rule version and authorized override.

### Workshop
Repair orders, dismantling orders, labor, consumed parts, recovered parts and QC.

### Inventory
Inventory units, quantity stock, locations, movements, reservations, counts and adjustments.

### PricingCosting
Allocated acquisition cost, repair/dismantling cost, sale cost snapshot, prices and margin calculations.

### Customers
Customer profile, addresses and customer-specific account data.

### Sales
Cart/reservation intent, unified orders, order items, order state and channel attribution.

### Payments
Payment intents/transactions, provider reconciliation and refund facts.

### Fulfillment
Pickup/shipping selection, picking, packing, dispatch and tracking.

### PostSale
Warranty policy, claims, returns, resolutions and re-entry decisions.

### Finance
Operating expenses, consignor settlements and profitability/reporting projections.

### Channels
Channel publication state, provider mappings, integration events and synchronization health.

### Audit
Durable business/security audit records.

### Reporting
Read-optimized queries/projections for dashboard and reports.

## 5. Aggregate / consistency boundaries

The following require transaction-safe invariants:

- Device: identity + lifecycle state transitions.
- RepairOrder: parts/labor consumption and work-order state.
- DismantlingOrder: donor completion and recovered-part generation.
- InventoryReservation: unit/stock reservation and release.
- Order: items + commercial snapshot + state transitions.
- PaymentTransaction: provider event/idempotency reconciliation.
- ConsignmentSettlement: sale facts to payable state.

Cross-aggregate workflows are coordinated at Application level inside one transaction when data is in the same database and the invariant requires atomicity.

## 6. Authoritative state

MySQL is authoritative for all core business state.

External systems are authoritative only for provider-owned facts such as marketplace listing identifiers, external payment transaction facts or courier tracking events. Those facts are reconciled into FixPhone.

FixPhone remains authoritative for internal stock availability and sellability.

## 7. Integration architecture

Every external provider uses a dedicated adapter behind an application port:

- Mercado Libre
- Meta / Facebook / Instagram
- WhatsApp Business
- Mercado Pago
- future courier providers
- future IMEI verification service
- future fiscal/e-invoicing service

External SDK types must not enter Domain/Application contracts.

### Outbound reliability

Business transaction + integration intent use the **transactional outbox** pattern.

```text
business transaction
   + outbox message
     commit atomically
          ↓
worker dispatches provider call
          ↓
success / retry / dead-letter-visible failure
```

Initial implementation may use Laravel queues with a database-backed queue/outbox. Redis is optional and is not an architecture requirement.

### Inbound reliability

Provider webhooks:

- verify authenticity/signature where supported;
- persist provider event identity;
- enforce idempotency;
- acknowledge only after safe acceptance/persistence;
- process side effects transactionally;
- retain correlation and failure state.

## 8. Concurrency

MySQL InnoDB transactions are mandatory for stock/order critical flows.

Controls include:

- unique constraints for serialized unit identity;
- row locking (`SELECT ... FOR UPDATE` or framework equivalent) on contested inventory/reservation records;
- optimistic version/state preconditions where useful;
- unique idempotency keys for retried command boundaries;
- transactionally consistent reservation → order transitions;
- no "read available, later update" race-prone flow without concurrency control.

## 9. Money

Authoritative money values use fixed precision DECIMAL plus explicit currency.

Rules:

- never authoritative float/double;
- rounding mode defined per financial calculation;
- completed sale stores immutable commercial/cost snapshots;
- exchange conversion, if used, stores rate, source and timestamp.

Initial business currencies: UYU and USD where required by approved flows.

## 10. Files and photos

Business metadata remains in MySQL.

Binary files/photos use a file-storage port with object/file storage implementation chosen by deployment architecture. Database rows store identity, ownership, MIME metadata, hash/checksum, storage key, timestamps and visibility.

Private evidence must not become public merely because product photos are public.

## 11. Reporting

Operational writes remain normalized.

Reporting uses read models/query services and may use denormalized projections/materialized tables when measured need justifies it. Reporting projections never become authoritative stock/order truth.

## 12. Search

Initial architecture does not require an external search engine.

Catalog search must sit behind a query boundary so MySQL indexes/full-text can be replaced later without changing domain contracts.

## 13. Backup and recovery

Required before release:

- automated MySQL backups;
- file/object backup policy;
- encrypted storage where applicable;
- documented restoration procedure;
- periodic restore test producing evidence;
- recovery of outbox/integration processing without duplicate business effects.

Concrete provider/RPO/RTO values are deployment decisions to be finalized before production release.

## 14. Architecture conformance

Implementation must later prove:

- Domain has no framework/infrastructure dependencies;
- module boundaries are respected;
- presentation does not directly mutate persistence;
- external provider SDKs remain in Infrastructure;
- critical application use cases own transactional boundaries;
- architecture violations are tested automatically where feasible.

Architecture design acceptance is not implementation conformance.
