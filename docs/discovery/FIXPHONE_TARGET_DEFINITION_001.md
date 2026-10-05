# FIXPHONE-TARGET-001 — Product Target Definition

## 1. Status and authority

- Product: **FixPhone**
- Blueprint mode: **Greenfield**
- Governing stable Blueprint: `SoftwareDevelopmentBlueprint 0.5.4`
- Source Discovery: `docs/discovery/FIXPHONE_DISCOVERY_001.md`
- Target Definition status: **READY FOR REVIEW**

This artifact defines the intended TO-BE product boundary. It does not replace detailed Requirements, Architecture, API Contract, Interface Inventory or implementation contracts.

## 2. Product target

FixPhone will be a complete, integrated operational and commercial platform for a business that acquires, receives or accepts in consignment mobile phones and related parts, evaluates their technical and economic condition, chooses the most profitable safe disposition, manages resulting inventory, sells through multiple channels, controls fulfillment and post-sale, and measures real profitability.

The target product must support the business from physical intake to final financial visibility without requiring parallel spreadsheets or channel-specific inventory as the authoritative operational system.

## 3. Definition of the finished product

FixPhone is considered functionally complete only when the governed release includes all of the following capability families:

1. Master data and catalog foundations.
2. Acquisition, supplier, lot and provenance management.
3. Consignment management.
4. Device intake with unit-level identity, IMEI/serial and evidence.
5. Technical diagnosis and grading.
6. Economic evaluation and routing decision support.
7. Repair workflow.
8. Dismantling workflow.
9. Dual inventory for complete devices and parts.
10. Donor-to-part traceability.
11. Physical locations and inventory movements.
12. Pricing and cost control.
13. Customer management.
14. Unified sales/orders.
15. Public storefront.
16. Cart and checkout.
17. Payments.
18. Shipping / pickup / fulfillment.
19. Warranty, returns and post-sale.
20. Operating expenses and financial control.
21. Reports and dashboards.
22. User, role, permission and durable audit capabilities.
23. Web administrative client.
24. Web public storefront.
25. Android client through Kotlin Multiplatform.
26. iOS client through Kotlin Multiplatform.
27. Mercado Libre integration.
28. WhatsApp integration.
29. Facebook integration.
30. Instagram integration.
31. Search and AI discoverability for public indexable surfaces.
32. Operational observability, backup/restore and release documentation.

Detailed requirements for each capability are deferred to Requirements & Domain.

## 4. Operating model target

FixPhone must become the operational source of truth for:

- device lifecycle;
- recovered and purchased part inventory;
- availability and reservations;
- product/catalog state;
- internal order state;
- cost and profitability data;
- channel synchronization state;
- critical audit history.

External systems may remain authoritative for their own transactions, payments, shipments or publication metadata, but FixPhone must reconcile those facts into its internal operational model.

## 5. Core value transformation

The defining business transformation is:

```text
Physical phone
   ↓
Traceable intake
   ↓
Technical diagnosis
   ↓
Economic evaluation
   ↓
Controlled decision
   ├─ complete resale
   ├─ repair + resale
   ├─ dismantling
   └─ restricted/manual disposition
   ↓
Sellable inventory
   ↓
Multichannel commercialization
   ↓
Unified operational order
   ↓
Fulfillment / post-sale
   ↓
Measured profitability
```

FixPhone is not successful merely because it can list products. It must preserve this chain end-to-end.

## 6. Primary business outcomes

The product should enable the business owner to answer reliably:

- What physical devices and parts do I have?
- Where is each item physically located?
- Where did a recovered part come from?
- What did a device or lot actually cost?
- Is it more profitable to sell, repair or dismantle a device?
- What has already been invested in a repair?
- What stock is actually available across all channels?
- What was sold, through which channel, at what net margin?
- What amount is owed to a consignor?
- Which stock is becoming immobilized?
- Which product/channel/lots produce or destroy margin?
- What warranty/return costs are affecting profitability?

## 7. Client target

### 7.1 Web administration

A responsive back-office used to operate the business, configure rules, manage catalog/inventory, inspect finances and administer integrations.

### 7.2 Public web storefront

A customer-facing storefront differentiated visually from the administrative interface, with public catalog, search/filtering, product details, cart, checkout, account/ordering features where approved, contact and discoverability.

### 7.3 Android

Kotlin Multiplatform Android target, with emphasis on operational use in intake, workshop, inventory and fulfillment where camera/scanning/mobile ergonomics add value.

### 7.4 iOS

Kotlin Multiplatform iOS target governed as an independent Blueprint platform scope even where code is shared.

## 8. Final multichannel target

The release target includes:

- FixPhone storefront;
- Mercado Libre;
- Facebook;
- Instagram;
- WhatsApp.

The business must not require independent manual stock truth per channel.

The later integration architecture must support:

- publication synchronization where the provider permits it;
- stock/availability synchronization;
- inbound order or assisted-sale reconciliation where supported;
- channel-specific price/cost/fee handling;
- integration health and retry visibility;
- protection against overselling.

Provider-specific capability remains subject to verified current APIs and account eligibility at implementation time.

## 9. Inventory-entry target

The owner has explicitly chosen not to begin registering the real bulk stock before the system is sufficiently complete and validated.

Therefore FixPhone will use synthetic/fixture/test inventory during development.

A project-specific **Inventory Entry Readiness** checkpoint must be defined later in Requirements and implemented as evidence-backed acceptance criteria.

At minimum, that future checkpoint must prove the real-item lifecycle can be executed without re-registration or manual reconciliation across:

- intake/provenance;
- diagnosis;
- economic routing;
- repair;
- dismantling;
- complete-device inventory;
- part inventory;
- donor traceability;
- costing;
- product publication;
- reservation/order;
- sale;
- return/warranty;
- reporting/audit.

Whether every external channel must already be live before the first production inventory record is entered will be made explicit during Requirements. Until then, no assumption may weaken the owner's stated preference for system completeness before bulk entry.

## 10. Reuse target

FixPhone remains an independent product repository.

### WebBlueprint

FixPhone will first define approved requirements and interface needs. Then WebBlueprint will be inspected through its normal capability/view workflow.

Each candidate will be classified:

- `REUSE`
- `ADAPT`
- `EXCLUDE`
- `MISSING`

Only the approved FixPhone selection will be exported through the WebBlueprint template/ZIP mechanism and integrated into FixPhone.

### ApiBlueprint

After FixPhone Architecture and API needs are approved, ApiBlueprint will be analyzed capability by capability.

Each candidate will be classified:

- `REUSE`
- `ADAPT`
- `EXCLUDE`
- `MISSING`

Only approved capabilities are incorporated.

### KMP prior work

Existing KMP work may be studied for reusable engineering patterns, but FixPhone's mobile client remains API-backed and must receive its own approved client architecture and platform evidence.

### PuntoPhone-v2

Not a technical base. Any domain reference use is explicitly non-normative.

## 11. Technology target

Consumer technology direction remains:

- Backend: Laravel;
- Database: MySQL;
- HTTP API: REST;
- API contract: OpenAPI / Swagger;
- Web: React + TypeScript + Vite;
- Styling: Tailwind CSS;
- Mobile: Kotlin Multiplatform;
- source control / delivery governance: GitHub;
- architecture: clean separation of responsibilities under later approved architecture contracts;
- quality: SOLID, validation, automated testing, security, durable audit, observability and CI/CD.

No decision is made here for cache, queues, search engine, object storage, containerization or hosting.

## 12. Product completion boundaries

### In scope for the target product

Everything required to operate the described phone/parts business coherently from intake through multichannel commercialization and financial visibility, including the clients and integrations listed above.

### Explicitly not established as part of this target

Unless Requirements later adopt them:

- full statutory/general-ledger accounting;
- payroll;
- unrelated repair-shop CRM features;
- generic ERP functionality not needed by FixPhone;
- a separate native Android-only or iOS-only product;
- multiple independent inventory masters;
- automatic inheritance of future SoftwareDevelopmentBlueprint releases;
- wholesale copying of WebBlueprint or ApiBlueprint.

## 13. Quality target

The completed system must be:

- traceable;
- auditable;
- secure;
- testable;
- maintainable;
- responsive;
- accessible on applicable public/client surfaces;
- resilient to integration failures;
- safe against double-selling serialized units;
- financially precise;
- recoverable through tested backups;
- observable in production.

Concrete SLOs, thresholds and test obligations belong to Requirements / Architecture.

## 14. Delivery principle

FixPhone will be built incrementally but aimed at the complete target.

```text
complete target
      ↑
governed slices
      ↑
small verified increments
```

Incremental delivery must not be confused with shrinking the agreed final scope.

No implementation increment may bypass the Blueprint phase/gate sequence simply because a reusable Blueprint component already exists.

## 15. Success definition

FixPhone reaches its intended product target when:

1. the full accepted device-to-value lifecycle works end-to-end;
2. real inventory can be entered without parallel shadow tracking;
3. Web, Android and iOS required release slices are accepted independently;
4. the public storefront is functional and discoverable;
5. Mercado Libre, Facebook, Instagram and WhatsApp integrations required by approved requirements are operational;
6. stock and orders remain coherent across channels;
7. costs, sales, expenses, guarantees and consignments produce trustworthy profitability information;
8. security, audit, backup/restore, observability and release documentation pass their applicable gates;
9. the Release Gate passes;
10. the product owner explicitly accepts the release.

## 16. Next phase boundary

After this Target Definition is approved, the next canonical phase is:

`Requirements & Domain`

That phase will formalize actors/authorization intent, functional requirements, non-functional requirements, business rules, use cases, acceptance criteria and traceability.

Target Definition approval does not authorize Architecture or implementation.
