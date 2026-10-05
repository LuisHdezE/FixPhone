# FIXPHONE-DISCOVERY-001 — Product Discovery

## 1. Status

- Product: **FixPhone**
- Delivery mode: **Greenfield**
- Governing stable Blueprint: `SoftwareDevelopmentBlueprint 0.5.4`
- Multi-agent overlay: `agent-protocol-proposal-1` (explicit opt-in)
- Discovery status: **IN REVIEW**
- Product implementation: **NOT STARTED**

This artifact captures product discovery only. It does not authorize Requirements Ready, architecture, API design, WebBlueprint export, ApiBlueprint reuse, or implementation.

## 2. Product intent

FixPhone is an integrated platform for operating and commercializing a business centered on used mobile phones, recovered devices, refurbished devices, and reusable phone parts.

The primary business objective is to convert a significant existing stock of phones into controlled, traceable and sellable inventory as quickly as practical, while preserving cost visibility, operational discipline and profitability.

FixPhone must support the full operating cycle from device origin through resale, repair, dismantling, part recovery, inventory, publication, sale, fulfillment, post-sale and profitability analysis.

## 3. Business problem

The initial inventory contains many physical devices whose real economic value is not yet represented in a structured system.

For each device, the business must be able to determine whether the best route is:

1. sell the device complete;
2. repair it economically and then sell it;
3. dismantle it and sell recovered parts;
4. retain/reclassify it when a safe or profitable decision cannot yet be made.

Without an integrated system, the business risks losing traceability between donor devices and recovered parts, mispricing stock, duplicating inventory across channels, overspending on repairs, losing physical items, or being unable to measure true profitability.

## 4. Core operating journey

The discovered macro flow is:

```text
Origin / acquisition / consignment
        ↓
Lot or individual intake
        ↓
Device identification
        ↓
IMEI / serial / provenance
        ↓
Technical diagnosis
        ↓
Economic evaluation
        ↓
Routing decision
   ├─ Sell complete
   ├─ Repair and sell
   ├─ Dismantle
   └─ Manual review / restricted
        ↓
Inventory
   ├─ Complete devices
   └─ Recovered / purchased parts
        ↓
Master catalog
        ↓
Channel publication
        ↓
Unified order
        ↓
Payment / fulfillment
        ↓
Warranty / return
        ↓
Financial and operational reporting
```

This flow is a Discovery finding, not yet a frozen requirements contract.

## 5. Product surfaces

FixPhone is expected to have three client targets from the beginning:

### Web

Two major experiences are expected:

- administrative / operational back-office;
- public storefront.

The public storefront must be visually differentiated from the administration interface while sharing product-level design governance.

### Android

A Kotlin Multiplatform mobile client must support Android.

The mobile experience should prioritize workflows where a handheld device provides operational advantage, including scanning, photos, intake, diagnostics, workshop activity, dismantling, inventory location and picking.

### iOS

The Kotlin Multiplatform strategy must also support iOS as an explicit target.

Android and iOS may share KMP implementation, but Blueprint acceptance, QA and platform gates remain independent.

## 6. Commercial channels

The final product target includes real integration with:

- FixPhone web storefront;
- Mercado Libre;
- Facebook;
- Instagram;
- WhatsApp.

These integrations are part of the intended finished product, not merely future ideas.

FixPhone should remain the authoritative source for product catalog, stock and operational state. External channels are distribution and sales surfaces, not independent inventory authorities.

The exact capabilities supported by each external API must be verified at implementation time and may constrain individual channel behaviors.

## 7. Initial capability landscape

The following capability areas are relevant inputs for later Requirements work:

### Product and master data

- brands;
- phone models;
- memory/capacity;
- colors;
- part categories and types;
- compatibility relationships;
- conditions and grades;
- physical locations.

### Acquisition and provenance

- suppliers;
- insurance-origin equipment;
- lots;
- purchases;
- consignors / consignment;
- provenance evidence;
- acquisition and associated costs.

### Device intake and diagnosis

- unit identification;
- IMEI / serial;
- photos;
- condition;
- diagnostic checklist;
- account/lock state when applicable;
- technical findings;
- history.

### Economic evaluation and routing

- expected complete-device value;
- estimated repair cost;
- expected repaired value;
- expected dismantling value;
- expected demand;
- margin;
- risk;
- routing recommendation;
- human override with traceability.

### Workshop

- repair orders;
- parts consumption;
- labor;
- quality control;
- dismantling orders;
- recovered-part registration;
- scrap / unusable outcomes.

### Inventory

- complete devices;
- individual recovered parts;
- purchased parts;
- stock state;
- reservations;
- physical location;
- movement ledger;
- traceability from recovered part to donor device.

### Commerce

- master sellable catalog;
- channel publication;
- channel-specific pricing;
- customers;
- cart and checkout;
- orders;
- payment;
- shipping;
- pickup;
- marketplace sales;
- WhatsApp-assisted/manual sales.

### Post-sale

- warranty;
- claims;
- returns;
- replacement;
- refund;
- re-entry into inventory when applicable.

### Financial operations

- acquisition cost;
- repair cost;
- labor;
- direct and indirect expenses;
- sales;
- marketplace/payment fees;
- shipping cost;
- consignment settlement;
- gross and operational margin;
- inventory valuation;
- profitability by device, lot, product and channel.

### Governance and administration

- users;
- roles;
- permissions;
- audit;
- integration health;
- configuration;
- notifications;
- reporting and dashboards.

## 8. Important business concepts discovered

### Unit-level traceability

A physical device is not merely a quantity of a SKU. It requires unit-level identity and lifecycle history.

### Donor traceability

A recovered part must be able to retain provenance back to the donor device when the business process requires it.

### Catalog is not physical inventory

FixPhone must distinguish the reusable commercial definition of a product from the concrete physical unit available for sale.

### Routing is economically informed

Repair-versus-dismantle decisions should consider expected value, repair investment, recoverable parts, margin, demand and risk.

The exact formula and thresholds are deferred to Requirements and Domain work.

### One stock authority

FixPhone must prevent external channels from becoming competing sources of truth for stock.

### Multichannel orders converge

Orders from different channels should converge into one internal operational model so inventory, fulfillment, finance and post-sale remain coherent.

## 9. Fixed consumer technology direction

The following are consumer decisions and are not derived from the analyzed ReCell material:

- Backend: Laravel;
- Database: MySQL;
- API: REST;
- API contract/documentation: OpenAPI / Swagger;
- Web: React + TypeScript + Vite;
- styling: Tailwind CSS;
- Mobile: Kotlin Multiplatform for Android and iOS;
- source control and CI: GitHub;
- architecture: clean separation of responsibilities, with approved architecture to be formalized later;
- engineering: SOLID, automated testing, validation, security, auditability, observability and CI/CD.

Redis, queues, object storage, search technology, containerization and hosting are not fixed by Discovery. They require later architectural decisions based on actual requirements.

## 10. Reuse strategy

### WebBlueprint

WebBlueprint is a reusable source to be analyzed after approved requirements establish FixPhone's interface needs.

The process is:

```text
FixPhone interface need
        ↓
inspect WebBlueprint
        ↓
REUSE / ADAPT / EXCLUDE / MISSING
        ↓
build FixPhone template
        ↓
export ZIP through normal WebBlueprint flow
        ↓
integrate selected output into FixPhone
```

WebBlueprint will not be copied wholesale.

### ApiBlueprint

ApiBlueprint will be analyzed only after approved architecture and API needs establish what FixPhone requires.

Capabilities will be classified as:

- REUSE;
- ADAPT;
- EXCLUDE;
- MISSING.

ApiBlueprint will not be copied wholesale.

### PuntoPhone-v2

PuntoPhone-v2 is not a technical base for FixPhone.

Historical domain data or lessons may be consulted if useful, but no architecture or code inheritance is assumed.

## 11. Inputs reviewed

Discovery considered the following non-normative inputs:

- direct product decisions supplied by the product owner;
- prior analysis of a used-parts commerce model inspired by Autopartes Gil;
- the supplied ReCell technical/functional document;
- existing product-direction decisions for WebBlueprint and ApiBlueprint;
- existing KMP experience from prior projects.

These are inputs only. Approved repository-owned FixPhone artifacts become the product authority.

## 12. Initial actors / stakeholders

Potential actors identified for Requirements analysis:

- owner / administrator;
- intake operator;
- technician;
- inventory / warehouse operator;
- salesperson;
- customer;
- consignor;
- supplier;
- dispatch / logistics operator;
- finance / administrative user;
- post-sale operator;
- external commerce and payment systems.

No permission matrix is approved in Discovery.

## 13. Initial constraints

- A large existing stock must eventually be registered only after the system is ready for real inventory entry.
- The product must support used, recovered and refurbished goods where condition materially affects value.
- Unit-level and donor-to-part traceability are central.
- Financial calculations must avoid floating-point money semantics.
- External-channel failures must not corrupt authoritative internal stock.
- Security and authorization must be enforced by the backend for API-backed clients.
- Mobile must be designed as an API-backed client, even if later architecture permits cache or temporary offline/degraded operation.

## 14. Major risks discovered

### R-DISC-001 — Inventory model ambiguity

If SKU/product definitions are confused with physical serialized units, dismantling, reservations, cost and channel synchronization will become unreliable.

### R-DISC-002 — Premature bulk inventory entry

Loading hundreds of real devices before the lifecycle and data contracts stabilize could create expensive migration and reconciliation work.

### R-DISC-003 — Channel oversell

Publishing the same unique unit across multiple channels without centralized reservations and synchronization can generate double sales.

### R-DISC-004 — Unprofitable repair

Without a controlled evaluation model, repair investment may exceed the value recovered by selling the device.

### R-DISC-005 — Integration coupling

Embedding Mercado Libre or Meta semantics directly into the core domain could make the product fragile when external APIs change.

### R-DISC-006 — Provenance / restricted-sale risk

Devices without sufficient provenance or with blocking conditions must not accidentally become sellable complete units.

### R-DISC-007 — Overbuilding before revenue

FixPhone is intended to be a complete system, but sequencing must still prioritize the capabilities required to safely register inventory and reach market without compromising the final architecture.

## 15. Questions intentionally deferred to Requirements / later analysis

The following are not decided by Discovery:

- exact device grading scale and definitions;
- precise IMEI verification provider and automation level;
- exact economic routing formulas and thresholds;
- exact warranty periods by product/condition;
- precise consignment settlement rules;
- precise tax/e-invoicing implementation;
- exact shipping providers and zone pricing;
- exact marketplace publication rules and fee formulas;
- offline depth for the KMP app;
- exact authorization matrix;
- exact inventory costing method per category;
- exact return and RMA policy;
- queue/cache/search/hosting infrastructure;
- exact social-commerce API capability available at implementation time.

## 16. Discovery conclusions

FixPhone is viable as one integrated product with a single authoritative operational core and multiple clients/channels.

The highest-value domain is not storefront presentation. It is the controlled transformation:

```text
physical device
   → technical/economic decision
   → complete-device inventory OR recovered-part inventory
   → multichannel sale
   → measurable profitability
```

The next Blueprint phase after Discovery is **Target Definition**, followed by **Requirements / Domain**.

## 17. Discovery review boundary

Discovery can close when the product owner confirms that this document accurately represents:

- the problem FixPhone must solve;
- its intended operating cycle;
- Web + Android + iOS targets;
- final multichannel target;
- selective WebBlueprint / ApiBlueprint reuse strategy;
- the fixed technology direction;
- the distinction between discovered product intent and not-yet-approved requirements.

Closing Discovery does not approve individual requirements, architecture, schema, endpoints, views or implementation.
