# FIXPHONE-REQ-001 — Requirements & Domain Contract

## 1. Status and provenance

- Product: **FixPhone**
- Mode: Greenfield
- Stable Blueprint: `SoftwareDevelopmentBlueprint 0.5.4`
- Sources:
  - `docs/discovery/FIXPHONE_DISCOVERY_001.md`
  - `docs/discovery/FIXPHONE_TARGET_DEFINITION_001.md`
- Requirements status: **READY FOR REVIEW**
- Architecture and implementation: **NOT STARTED**

This document is the authoritative FixPhone Requirements & Domain contract once approved.

## 2. Actors and authorization intent

Authorization intent is defined here at business level. Exact RBAC permissions and API authorization contracts are deferred to Architecture/API Contract.

| Actor | Intent |
|---|---|
| Owner / Administrator | Full operational/configuration visibility; sensitive overrides; users/roles; financial reporting; integrations. |
| Intake Operator | Register lots/devices, provenance, IMEI/serial, photos and intake data; cannot alter protected financial history. |
| Technician | Diagnose, repair, dismantle, test and classify devices/parts; consume/recover inventory through governed work orders. |
| Inventory Operator | Manage locations, stock movements, picking, counts and controlled adjustments. |
| Sales Operator | Manage customers, assisted sales, orders, channel publications and customer communication within granted limits. |
| Finance / Administrative | Expenses, payments, settlements, cost review, reports and exports; no technical diagnosis authority by default. |
| Post-sale Operator | Warranty claims, returns and resolutions within granted policy. |
| Customer | Browse public catalog, register/login when required, buy, pay, choose fulfillment, view own orders and request post-sale support. |
| Consignor | External party whose goods may be received under agreed settlement terms; no internal application access is required by default. |
| Supplier | External source of devices/parts/services; no internal application access is required by default. |
| External Channel / Provider | Mercado Libre, Meta, WhatsApp, payment, courier, IMEI/fiscal services interacting through governed integrations. |

### Authorization principles

- Backend authorization is authoritative for API-backed clients.
- Sensitive operations require explicit permission and durable audit.
- No actor may gain permissions merely because a UI exposes an action.
- Financial overrides, inventory adjustments, sale cancellation, cost changes, consignment settlement and administrative/security operations require elevated permission.
- A customer can access only their own account/order/post-sale data unless an approved business flow states otherwise.

## 3. Functional requirements

Priority notation:
- **M** = Must for the complete FixPhone target.
- **S** = Should when feasible without compromising Must scope.
- **C** = Could / later optimization.

### 3.1 Master data and catalog

| ID | Requirement | Priority |
|---|---|---|
| FR-CAT-001 | Manage brands with create, view, edit, deactivate and traceable history where relevant. | M |
| FR-CAT-002 | Manage phone models linked to brands. | M |
| FR-CAT-003 | Manage capacities/memory, colors, conditions/grades, categories and part types. | M |
| FR-CAT-004 | Manage compatibility relationships between phone models and sellable parts. | M |
| FR-CAT-005 | Maintain a master commercial product definition separate from physical stock units. | M |
| FR-CAT-006 | Support real product photos, descriptions, attributes, condition, warranty and public/channel visibility. | M |
| FR-CAT-007 | Support reference price for equivalent/new replacement part when available and FixPhone sale price. | M |

### 3.2 Acquisition, lots, provenance and consignment

| ID | Requirement | Priority |
|---|---|---|
| FR-ACQ-001 | Manage suppliers, insurers, auction sources, private sources and consignors. | M |
| FR-ACQ-002 | Register lots with source, date, currency, acquisition cost and supporting provenance documents. | M |
| FR-ACQ-003 | Register lot-level additional costs and allocate them to units through an approved costing rule. | M |
| FR-ACQ-004 | Permit individual device intake outside a lot when the approved business flow allows it. | M |
| FR-ACQ-005 | Register consignment terms including owner, agreed value/percentage, dates, status and settlement basis. | M |
| FR-ACQ-006 | Preserve traceability from a sold consigned item to its settlement obligation. | M |
| FR-ACQ-007 | Prevent complete-device sale when required provenance evidence is missing or the unit is administratively restricted. | M |

### 3.3 Device intake and identity

| ID | Requirement | Priority |
|---|---|---|
| FR-DEV-001 | Assign every physical device a unique internal unit identifier. | M |
| FR-DEV-002 | Record IMEI and/or serial as applicable, preventing accidental active duplicates. | M |
| FR-DEV-003 | Validate IMEI format/check digit where applicable. | M |
| FR-DEV-004 | Record brand, model, capacity, color, source, current state and physical location. | M |
| FR-DEV-005 | Capture multiple intake photos and relevant documentary evidence. | M |
| FR-DEV-006 | Record IMEI/restriction verification result manually or through an integration and retain evidence. | M |
| FR-DEV-007 | Maintain an immutable/reconstructable unit lifecycle timeline for critical transitions. | M |
| FR-DEV-008 | Support controlled batch import for large intake, with validation report and no silent partial corruption. | S |
| FR-DEV-009 | Generate or expose QR/barcode identity for operational scanning. | S |

### 3.4 Diagnosis and grading

| ID | Requirement | Priority |
|---|---|---|
| FR-DIA-001 | Provide configurable diagnostic checklists by device/product context. | M |
| FR-DIA-002 | Record functional findings for screen/touch, battery, cameras, audio, connectors, biometrics, radios/network, sensors, moisture and board condition as applicable. | M |
| FR-DIA-003 | Record account/activation lock findings when relevant. | M |
| FR-DIA-004 | Assign a governed condition/grade and supporting observations/evidence. | M |
| FR-DIA-005 | Preserve who performed a diagnosis and when. | M |
| FR-DIA-006 | Allow re-diagnosis while preserving previous diagnostic history. | M |

### 3.5 Economic evaluation and routing

| ID | Requirement | Priority |
|---|---|---|
| FR-ROU-001 | Calculate or capture expected complete-sale value. | M |
| FR-ROU-002 | Calculate estimated repair cost including parts and labor. | M |
| FR-ROU-003 | Calculate or capture expected repaired-device sale value. | M |
| FR-ROU-004 | Calculate or capture expected dismantling value from recoverable parts. | M |
| FR-ROU-005 | Support demand, risk and target-margin inputs used by routing. | M |
| FR-ROU-006 | Recommend one of: sell complete, repair then sell, dismantle, retain/donor, restricted/manual review, discard/recycle. | M |
| FR-ROU-007 | Permit authorized human override with mandatory reason and audit. | M |
| FR-ROU-008 | Persist the economic values and rule version used for each routing decision. | M |
| FR-ROU-009 | Never route an administratively restricted unit to complete-device sale. | M |

### 3.6 Workshop: repair

| ID | Requirement | Priority |
|---|---|---|
| FR-REP-001 | Create repair work orders linked to one device and approved diagnosis. | M |
| FR-REP-002 | Estimate required parts, labor, external service and total expected repair cost. | M |
| FR-REP-003 | Reserve and consume inventory items used in a repair through stock movements. | M |
| FR-REP-004 | Record labor and other actual repair costs. | M |
| FR-REP-005 | Support work-order states and responsible technician. | M |
| FR-REP-006 | Require final quality control before a repaired device becomes sellable. | M |
| FR-REP-007 | Permit failed/unprofitable repair to return to evaluation for a different disposition without losing sunk-cost history. | M |

### 3.7 Workshop: dismantling

| ID | Requirement | Priority |
|---|---|---|
| FR-DIS-001 | Create dismantling work orders for donor devices. | M |
| FR-DIS-002 | Present expected recoverable parts by model when master data exists. | S |
| FR-DIS-003 | Register each physically recovered part with identity, type, condition/grade, test state and location. | M |
| FR-DIS-004 | Link each recovered part to the donor device. | M |
| FR-DIS-005 | Allocate donor/dismantling cost to recovered sellable parts using the approved costing method. | M |
| FR-DIS-006 | Record defective/scrap/recycled outcomes. | M |
| FR-DIS-007 | Prevent a completed donor device from remaining simultaneously available as a complete sellable unit. | M |

### 3.8 Inventory

| ID | Requirement | Priority |
|---|---|---|
| FR-INV-001 | Maintain complete-device inventory at serialized/unit level. | M |
| FR-INV-002 | Maintain part inventory distinguishing individual used/recovered units where traceability matters and quantity-based purchased stock where approved. | M |
| FR-INV-003 | Maintain available, reserved, sold, blocked, returned and other approved inventory states. | M |
| FR-INV-004 | Manage physical locations such as site, shelf, box or drawer. | M |
| FR-INV-005 | Record every authoritative stock movement in a non-destructive movement ledger. | M |
| FR-INV-006 | Reserve stock for carts/orders using a governed reservation lifecycle. | M |
| FR-INV-007 | Release expired/cancelled reservations safely. | M |
| FR-INV-008 | Prevent one serialized physical unit from being allocated to more than one active sale. | M |
| FR-INV-009 | Support controlled inventory counts and adjustments with reason, responsible actor and audit. | M |
| FR-INV-010 | Report inventory aging and immobilized stock. | S |
| FR-INV-011 | Support minimum-stock alerts for applicable purchased/replenishable SKUs. | S |

### 3.9 Pricing and costing

| ID | Requirement | Priority |
|---|---|---|
| FR-CST-001 | Store acquisition and allocated costs without binary floating-point money semantics. | M |
| FR-CST-002 | Accumulate repair, labor, parts, dismantling and directly attributable expenses into true item cost. | M |
| FR-CST-003 | Preserve cost history used for completed sales and financial reporting. | M |
| FR-CST-004 | Support suggested/base sale price and controlled channel-specific price. | M |
| FR-CST-005 | Calculate expected/actual margin including channel commissions and relevant fulfillment costs. | M |
| FR-CST-006 | Prevent unauthorized retroactive alteration of closed/sold cost history. | M |

### 3.10 Customers, sales and orders

| ID | Requirement | Priority |
|---|---|---|
| FR-SAL-001 | Manage customer accounts and contact/address data. | M |
| FR-SAL-002 | Require customer registration/authentication for web purchase. | M |
| FR-SAL-003 | Support a public cart and checkout. | M |
| FR-SAL-004 | Create one internal order model regardless of originating channel. | M |
| FR-SAL-005 | Record order items, sale price, discounts, taxes where applicable, payment, fees and fulfillment. | M |
| FR-SAL-006 | Support assisted/manual orders for approved channels such as WhatsApp. | M |
| FR-SAL-007 | Preserve source channel on every order. | M |
| FR-SAL-008 | Support cancel/refund transitions under permissions and audit. | M |
| FR-SAL-009 | Maintain customer purchase history. | M |

### 3.11 Storefront

| ID | Requirement | Priority |
|---|---|---|
| FR-WEB-001 | Provide a public landing page with value proposition, categories, trust/guarantee, payments, FAQs and contact. | M |
| FR-WEB-002 | Provide product catalog with search, filtering and sorting. | M |
| FR-WEB-003 | Support filtering/discovery by phone model and compatible parts. | M |
| FR-WEB-004 | Provide product detail with real photos, condition/grade, availability, warranty, store price and new/reference price when available. | M |
| FR-WEB-005 | Provide cart, checkout, shipping/pickup selection and payment initiation. | M |
| FR-WEB-006 | Provide customer account area for own orders, addresses and post-sale requests. | M |
| FR-WEB-007 | Provide WhatsApp contact/action from product/customer journeys. | M |
| FR-WEB-008 | Provide required legal/privacy/warranty/return pages. | M |
| FR-WEB-009 | Support public content needed for SEO and AI-assisted discovery. | M |

### 3.12 Payment and fulfillment

| ID | Requirement | Priority |
|---|---|---|
| FR-PAY-001 | Support Mercado Pago for approved online payment flows. | M |
| FR-PAY-002 | Support controlled manual payment methods such as cash/transfer when approved. | M |
| FR-PAY-003 | Reconcile payment status from external providers through authoritative callbacks/webhooks or controlled verification. | M |
| FR-FUL-001 | Support pickup and delivery/shipping. | M |
| FR-FUL-002 | Calculate shipping price from configured zone/method rules for the own storefront. | M |
| FR-FUL-003 | Record actual shipping/fulfillment cost for profitability. | M |
| FR-FUL-004 | Support preparation/picking using physical inventory location. | M |
| FR-FUL-005 | Record tracking/reference and delivery state when applicable. | M |

### 3.13 Warranty and returns

| ID | Requirement | Priority |
|---|---|---|
| FR-WAR-001 | Configure warranty policy by approved product/condition context. | M |
| FR-WAR-002 | Create claims linked to customer, order item and physical unit/part where applicable. | M |
| FR-WAR-003 | Record evidence, assessment, resolution and responsible actor. | M |
| FR-WAR-004 | Support repair, replacement, full/partial refund or rejection under approved rules. | M |
| FR-WAR-005 | Re-evaluate returned physical stock before making it available again. | M |
| FR-WAR-006 | Record warranty/return cost for profitability. | M |

### 3.14 Expenses, consignments and reporting

| ID | Requirement | Priority |
|---|---|---|
| FR-FIN-001 | Record operating expenses with date, amount, currency, category, source/payee, description, payment state and evidence. | M |
| FR-FIN-002 | Classify expenses as direct/indirect and optionally attribute them to lot, device, order or channel. | M |
| FR-FIN-003 | Support recurring expense templates. | S |
| FR-FIN-004 | Record payments/partial payments against expenses when required. | M |
| FR-FIN-005 | Calculate consignor payable/settlement based on approved consignment terms and actual sale facts. | M |
| FR-FIN-006 | Report profitability by physical device. | M |
| FR-FIN-007 | Report profitability/recovery by acquisition lot. | M |
| FR-FIN-008 | Report profitability by product/SKU and channel. | M |
| FR-FIN-009 | Report inventory valuation and aging. | M |
| FR-FIN-010 | Report gross margin, operating contribution and simplified operating result. | M |
| FR-FIN-011 | Dashboard key operational/financial indicators. | M |
| FR-FIN-012 | Export approved reports to common formats. | S |

### 3.15 Administration, security and audit

| ID | Requirement | Priority |
|---|---|---|
| FR-ADM-001 | Manage users, roles and granular permissions. | M |
| FR-ADM-002 | Record durable audit events for sensitive CRUD, permissions, financial actions, inventory changes, routing overrides, order state changes and integration administration. | M |
| FR-ADM-003 | Manage business configuration without editing source code. | M |
| FR-ADM-004 | Manage integration credentials/status through secure administrative boundaries. | M |
| FR-ADM-005 | Expose integration errors/retries sufficiently for operational recovery. | M |
| FR-ADM-006 | Provide internal notifications/alerts for approved operational conditions. | S |

### 3.16 Mercado Libre

| ID | Requirement | Priority |
|---|---|---|
| FR-ML-001 | Connect an authorized Mercado Libre seller account using the supported authorization flow. | M |
| FR-ML-002 | Create/update/pause supported listings from FixPhone catalog data. | M |
| FR-ML-003 | Synchronize supported price/availability changes. | M |
| FR-ML-004 | Receive and reconcile sales/orders through supported APIs/webhooks. | M |
| FR-ML-005 | Record marketplace fees/shipping/payment facts required for channel profitability. | M |
| FR-ML-006 | Prevent a unique physical unit sold elsewhere from remaining sellable in Mercado Libre. | M |

### 3.17 Meta: Facebook and Instagram

| ID | Requirement | Priority |
|---|---|---|
| FR-META-001 | Connect approved Meta business/catalog assets using supported authorization. | M |
| FR-META-002 | Synchronize supported catalog/product data for Facebook and Instagram. | M |
| FR-META-003 | Keep provider identifiers mapped to the internal master product/physical availability model. | M |
| FR-META-004 | Reconcile supported customer/order/interaction events adopted by the approved channel design. | M |
| FR-META-005 | Surface synchronization failures without corrupting internal stock. | M |

### 3.18 WhatsApp

| ID | Requirement | Priority |
|---|---|---|
| FR-WA-001 | Integrate the approved WhatsApp Business/Meta capability used by FixPhone. | M |
| FR-WA-002 | Support product/customer journeys that can initiate WhatsApp contact with product context. | M |
| FR-WA-003 | Support creation/reconciliation of assisted sales originating in WhatsApp. | M |
| FR-WA-004 | Support approved transactional notifications when provider policy allows them. | M |
| FR-WA-005 | Preserve customer consent/template/provider constraints required by the adopted implementation. | M |

### 3.19 Mobile KMP

| ID | Requirement | Priority |
|---|---|---|
| FR-MOB-001 | Provide Android and iOS clients through Kotlin Multiplatform. | M |
| FR-MOB-002 | Prioritize operational flows for intake, photos/scanning, diagnosis, workshop, dismantling, stock location, picking and lookup. | M |
| FR-MOB-003 | Consume the authoritative FixPhone API for business/security decisions. | M |
| FR-MOB-004 | Permit cache/queue/degraded operation only under an approved later offline policy; local data must not become an independent business authority. | M |
| FR-MOB-005 | Android and iOS acceptance remain independently evidenced. | M |

### 3.20 Search and AI discoverability

| ID | Requirement | Priority |
|---|---|---|
| FR-SEO-001 | Public indexable pages must expose crawlable semantic content and canonical/indexing policy. | M |
| FR-SEO-002 | Provide sitemap and metadata for applicable public surfaces. | M |
| FR-SEO-003 | Provide applicable Product/Offer structured data consistent with authoritative product price/availability. | M |
| FR-SEO-004 | Maintain clear entity/product/category semantics and internal linking for traditional and AI-assisted discovery. | M |
| FR-SEO-005 | Define AI crawler/search-discovery policy explicitly rather than treating robots/noindex as security controls. | M |

### 3.21 Inventory Entry Readiness

| ID | Requirement | Priority |
|---|---|---|
| FR-IER-001 | Development and validation must use synthetic/fixture inventory before production bulk entry. | M |
| FR-IER-002 | A formal Inventory Entry Readiness checkpoint must pass before bulk registration of the real existing stock. | M |
| FR-IER-003 | The checkpoint must validate at least complete-sale, repair-then-sale, dismantling/part-sale and consignment end-to-end scenarios. | M |
| FR-IER-004 | The checkpoint must prove intake, provenance, diagnosis, routing, inventory, costing, order, post-sale, reporting and audit do not require parallel shadow tracking. | M |
| FR-IER-005 | Channel integrations required for final release may be validated with sandbox/test fixtures before production credentials are available; this does not remove them from final Release scope. | M |

## 4. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-001 | Security: HTTPS, secure password hashing, least privilege, OWASP-oriented controls, rate limiting where applicable, secure secret handling and no secrets in logs/audit. |
| NFR-002 | Authorization: every sensitive server operation must enforce authoritative backend authorization. |
| NFR-003 | Financial precision: monetary calculations use decimal/fixed precision with explicit currency and rounding rules, never binary float for authoritative amounts. |
| NFR-004 | Transaction integrity: inventory reservation, sale and critical financial mutations must preserve consistency under concurrency. |
| NFR-005 | Auditability: critical business/security audit records must be durable and non-destructively traceable. |
| NFR-006 | Integration resilience: webhooks/jobs must support idempotency, retries/backoff and recoverable failure visibility where applicable. |
| NFR-007 | Availability: provider outages must not corrupt authoritative FixPhone state; degraded external integration must be visible. |
| NFR-008 | Performance: common operational API and UI interactions must remain responsive under the expected initial inventory and at least 10x catalog growth without architectural rewrite. Exact SLOs are deferred to Architecture. |
| NFR-009 | Backup/restore: authoritative data and required business files must have automated backup and proven restoration before release. |
| NFR-010 | Observability: structured logs, correlation, metrics/health signals and actionable integration failure visibility. |
| NFR-011 | Privacy: collect only necessary personal data, preserve access boundaries and support applicable privacy obligations. |
| NFR-012 | Accessibility: public storefront and applicable web/client interactions target WCAG 2.1 AA principles. |
| NFR-013 | Responsive UX: web administration/storefront must support relevant desktop/tablet/mobile widths. |
| NFR-014 | Testability: domain/business logic and integration boundaries must be automated-test friendly; exact coverage policy is an Architecture/QA decision. |
| NFR-015 | Maintainability: approved clean separation of responsibilities and dependency boundaries must be enforceable/reviewable. |
| NFR-016 | API contract: HTTP operations are specified through validated OpenAPI/Swagger before executable clients depend on them. |
| NFR-017 | Data integrity: destructive deletion of historical financial, inventory, audit and provenance facts is prohibited where history is required. |
| NFR-018 | Internationalization baseline: Spanish is required; money must support UYU and USD where business flows require them. |
| NFR-019 | Mobile platform independence: shared KMP code does not imply shared platform acceptance or gate PASS. |
| NFR-020 | Public discoverability: SEO/AI optimization must not expose private/admin/customer-protected information. |

## 5. Business rules

| ID | Rule |
|---|---|
| BR-001 | FixPhone is the authoritative operational source for inventory availability. |
| BR-002 | One serialized physical unit cannot be reserved/sold in more than one active sale. |
| BR-003 | A recovered part retains donor provenance when the physical/business process requires unit-level traceability. |
| BR-004 | A donor marked completely dismantled cannot remain sellable as a complete device. |
| BR-005 | Complete-device sale is blocked when provenance/restriction state fails the approved sellability rules. |
| BR-006 | Routing compares expected complete-sale, repair and dismantling value using versioned approved rules and recorded inputs. |
| BR-007 | Human routing override requires permission, reason and durable audit. |
| BR-008 | Repair sunk costs remain attributed even when the final route changes to dismantling. |
| BR-009 | Stock mutations originate from governed business actions/movements, not direct quantity editing without trace. |
| BR-010 | Product/catalog definition is distinct from physical stock identity. |
| BR-011 | External channel listing state cannot override internal inventory truth without reconciliation. |
| BR-012 | Every order records its originating channel. |
| BR-013 | A sale of a unique unit triggers removal/unavailability propagation to other active channels. |
| BR-014 | A returned item is not automatically available until re-evaluated. |
| BR-015 | Cost history used by closed sales cannot be silently rewritten. |
| BR-016 | Consignment sale creates/updates the consignor settlement obligation according to the approved agreement. |
| BR-017 | Customer web purchase requires a registered/authenticated customer account. |
| BR-018 | Warranty starts from the approved delivery/fulfillment event, not merely order creation. |
| BR-019 | Payment-provider confirmation must be verified through an authoritative provider mechanism before treating an online payment as final. |
| BR-020 | Integration retries must be idempotent for operations that could duplicate business effects. |
| BR-021 | Private/admin surfaces rely on access control, never robots/noindex as a security boundary. |
| BR-022 | Real bulk inventory entry cannot begin until Inventory Entry Readiness is explicitly accepted. |
| BR-023 | WebBlueprint/ApiBlueprint availability never creates a FixPhone requirement by itself. |
| BR-024 | Android and iOS remain separate acceptance scopes even when implemented through KMP. |
| BR-025 | Mobile licensing is not part of FixPhone's current product model unless explicitly re-adopted through governed change. |

## 6. Mobile licensing decision

Because Android is enabled, Blueprint requires an explicit decision.

**Decision: `mobile_licensing = false`.**

FixPhone does not currently use the offline signed trial/activation licensing capability governed by the Blueprint mobile-licensing profile.

This decision does not prevent future monetization/business access controls. A future adoption of Blueprint mobile licensing requires a governed scope/requirements change and applicable security/release revalidation.

## 7. Use cases

| ID | Use case |
|---|---|
| UC-001 | Register acquisition lot and provenance. |
| UC-002 | Receive and identify a physical device. |
| UC-003 | Verify/register IMEI or restriction evidence. |
| UC-004 | Diagnose and grade a device. |
| UC-005 | Evaluate economics and choose disposition. |
| UC-006 | Override routing under authorization. |
| UC-007 | Repair device using internal/purchased stock. |
| UC-008 | Quality-control repaired device. |
| UC-009 | Dismantle donor and register recovered parts. |
| UC-010 | Locate/move/count inventory. |
| UC-011 | Create/manage master product and compatibility. |
| UC-012 | Price product/unit for one or more channels. |
| UC-013 | Browse/filter/search storefront. |
| UC-014 | Register customer and complete web purchase. |
| UC-015 | Process payment and fulfillment. |
| UC-016 | Register WhatsApp-assisted sale. |
| UC-017 | Synchronize/publish Mercado Libre listing and receive sale. |
| UC-018 | Synchronize Meta catalog for Facebook/Instagram. |
| UC-019 | Handle warranty/return and re-entry decision. |
| UC-020 | Register operating expense. |
| UC-021 | Settle consignor after sale. |
| UC-022 | Analyze profitability by device/lot/product/channel. |
| UC-023 | Administer users/roles/permissions. |
| UC-024 | Diagnose/recover an integration failure. |
| UC-025 | Execute operational mobile flow on Android. |
| UC-026 | Execute operational mobile flow on iOS. |
| UC-027 | Validate Inventory Entry Readiness with synthetic scenarios. |

## 8. Acceptance criteria

### AC-CORE-001 — Complete-sale lifecycle
Given a valid synthetic device with provenance and sellable status, when it is diagnosed, economically routed to complete sale, inventoried, published, reserved, sold and fulfilled, then its unit history, stock state, order, cost, margin and audit trail remain coherent.

### AC-CORE-002 — Repair lifecycle
Given a synthetic repair candidate, when a repair order reserves/consumes parts and labor and passes quality control, then actual repair cost is included in its sellable cost and subsequent margin.

### AC-CORE-003 — Dismantling lifecycle
Given a synthetic donor, when dismantling completes, then the donor is no longer sellable complete, recovered sellable parts enter inventory with donor provenance/cost allocation, and scrap is recorded.

### AC-CORE-004 — Consignment lifecycle
Given a consigned synthetic unit, when it is sold, then FixPhone records the sale, channel costs, owner settlement obligation and store margin without losing the consignment agreement link.

### AC-INV-001 — No double allocation
Given one serialized unit, concurrent/resubmitted attempts cannot result in two successful active reservations/sales.

### AC-CHAN-001 — Channel source of truth
Given a stock transition in FixPhone, external-channel synchronization may be pending/failed, but FixPhone preserves one authoritative availability state and exposes the integration discrepancy.

### AC-CHAN-002 — Cross-channel sold unit
Given a unique unit listed in multiple supported channels, once a sale is authoritatively accepted, other channel availability is removed/paused through the governed synchronization process, with retry/error visibility.

### AC-WEB-001 — Store purchase
A registered customer can discover a compatible product, see condition/price/warranty, add it to cart, select fulfillment, initiate an approved payment and obtain an order.

### AC-MOB-001 — Android operational flow
Android can complete an approved operational slice against the real API using platform-appropriate scanning/photo capabilities where included.

### AC-MOB-002 — iOS operational flow
iOS can complete its independently accepted equivalent slice against the real API.

### AC-FIN-001 — Profitability trace
For a completed sale, an authorized user can trace sale revenue, item COGS, attributable channel/fulfillment costs and resulting margin back to underlying records.

### AC-SEC-001 — Authorization
A user lacking permission cannot perform a protected backend action even if the request is crafted outside the official UI.

### AC-AUD-001 — Durable evidence
A sensitive state-changing action records who, what, when and relevant before/after/reference facts without exposing secrets.

### AC-IER-001 — Inventory Entry Readiness
Using synthetic data, complete-sale, repair, dismantling/part-sale and consignment scenarios pass end-to-end with no spreadsheet/manual shadow source required for authoritative inventory/cost/order/audit truth.

### AC-IER-002 — Real inventory block
Before explicit human acceptance of Inventory Entry Readiness, the project process does not begin bulk entry of the existing real stock.

### AC-SEO-001 — Public discoverability
Applicable public product/category pages expose consistent indexable semantics, metadata and structured product facts without exposing protected information.

### AC-REL-001 — Final channel target
Release acceptance cannot claim the complete FixPhone target while required approved integrations for Mercado Libre, Facebook, Instagram and WhatsApp remain unimplemented or unvalidated.

## 9. Domain language

The following terms are canonical business concepts for subsequent Architecture. They are not yet a database schema or class design.

- **Lot**: group of acquired devices/items sharing an acquisition context.
- **Source / Supplier**: party or origin supplying devices, parts or services.
- **Consignor**: owner providing an item under a settlement agreement.
- **Device**: unique physical phone/equipment unit.
- **Device Identity**: internal ID plus applicable IMEI/serial identifiers.
- **Provenance Evidence**: evidence supporting legitimate source/possession and sellability review.
- **Diagnosis**: timestamped technical assessment.
- **Grade / Condition**: governed physical/functional classification.
- **Economic Evaluation**: comparison inputs/results for possible dispositions.
- **Routing Decision**: governed selected disposition with rule/input history.
- **Repair Work Order**: controlled repair execution/cost record.
- **Dismantling Work Order**: controlled donor-to-parts transformation.
- **Donor**: device used as source of recovered parts.
- **Part Unit**: individual physical recovered/traceable part.
- **SKU / Product**: reusable commercial/catalog identity.
- **Inventory Unit**: physical sellable/operational stock identity.
- **Stock Movement**: authoritative change in location/state/availability.
- **Reservation**: temporary allocation preventing conflicting sale.
- **Publication**: channel-specific representation of a sellable product/unit.
- **Channel**: own web, Mercado Libre, Facebook, Instagram, WhatsApp or future approved channel.
- **Customer**: purchaser/account party.
- **Order**: unified internal commercial transaction.
- **Order Item**: sold product/unit with frozen commercial/cost facts.
- **Payment**: money collection state/evidence.
- **Fulfillment / Shipment**: pickup/delivery lifecycle.
- **Warranty Claim**: post-sale claim linked to sold item.
- **Expense**: business outflow categorized and optionally attributable.
- **Consignment Settlement**: amount/status owed to consignor.
- **Audit Event**: durable accountable record of critical activity.
- **Integration Event**: inbound/outbound provider synchronization fact, distinct from business audit.

## 10. Traceability matrix

| Outcome / concern | Requirements | Use cases | Acceptance |
|---|---|---|---|
| Device intake/provenance | FR-ACQ-001..007, FR-DEV-001..009 | UC-001..003 | AC-CORE-001 |
| Diagnosis/routing | FR-DIA-001..006, FR-ROU-001..009 | UC-004..006 | AC-CORE-001, AC-CORE-002 |
| Repair | FR-REP-001..007 | UC-007..008 | AC-CORE-002 |
| Dismantling | FR-DIS-001..007 | UC-009 | AC-CORE-003 |
| Inventory | FR-INV-001..011 | UC-010 | AC-INV-001 |
| Catalog/pricing | FR-CAT-001..007, FR-CST-001..006 | UC-011..012 | AC-FIN-001 |
| Web commerce | FR-WEB-001..009, FR-SAL-001..009 | UC-013..015 | AC-WEB-001 |
| Payment/fulfillment | FR-PAY-001..003, FR-FUL-001..005 | UC-015 | AC-WEB-001 |
| Warranty | FR-WAR-001..006 | UC-019 | AC-CORE-001 |
| Finance/consignment | FR-FIN-001..012, FR-ACQ-005..006 | UC-020..022 | AC-CORE-004, AC-FIN-001 |
| Administration/security | FR-ADM-001..006, NFR-001..020 | UC-023..024 | AC-SEC-001, AC-AUD-001 |
| Mercado Libre | FR-ML-001..006 | UC-017 | AC-CHAN-001, AC-CHAN-002 |
| Facebook/Instagram | FR-META-001..005 | UC-018 | AC-CHAN-001, AC-REL-001 |
| WhatsApp | FR-WA-001..005 | UC-016 | AC-CHAN-001, AC-REL-001 |
| KMP Android/iOS | FR-MOB-001..005 | UC-025..026 | AC-MOB-001, AC-MOB-002 |
| Discoverability | FR-SEO-001..005 | UC-013 | AC-SEO-001 |
| Inventory Entry Gate | FR-IER-001..005 | UC-027 | AC-IER-001, AC-IER-002 |

## 11. Requirements Ready boundary

`requirements_ready` may be proposed PASS only if review confirms:

- actors/authorization intent are adequate;
- all Must functional requirements are coherent and non-contradictory;
- non-functional requirements cover the known quality risks;
- business rules preserve the core device-to-value model;
- use cases cover all mandatory capability families;
- acceptance criteria include critical end-to-end and negative/security outcomes;
- traceability has no orphaned mandatory capability area;
- `mobile_licensing = false` is explicitly accepted.

Requirements Ready does not authorize client implementation. The next canonical phase is Interface Scope Baseline.
