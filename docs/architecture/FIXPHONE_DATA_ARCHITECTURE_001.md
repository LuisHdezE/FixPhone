# FIXPHONE-DATA-001 — Data Architecture

## 1. Authoritative database

MySQL with InnoDB is the authoritative database for FixPhone core business state.

UTF-8 encoding/collation must support Spanish product/customer data.

## 2. Logical data groups

### Identity & access
users, roles, permissions, role/permission assignments, sessions/tokens metadata.

### Catalog
brands, device_models, capacities, colors, condition_grades, part_types, compatibilities, products, product_media, channel_product_mappings.

### Acquisition / provenance
suppliers, acquisition_lots, lot_items, acquisition_costs, provenance_documents.

### Consignment
consignors, consignment_agreements, consignment_items, settlements, settlement_lines.

### Devices
devices, device_identifiers, device_media, device_lifecycle_events, device_restriction_checks.

### Diagnostics / routing
diagnostic_templates, diagnostic_runs, diagnostic_findings, economic_evaluations, routing_decisions.

### Workshop
repair_orders, repair_parts, repair_labor, repair_qc;
dismantling_orders, recovered_parts, dismantling_outcomes.

### Inventory
inventory_units, stock_items, locations, stock_movements, reservations, inventory_counts, adjustments.

### Commerce
customers, customer_addresses, carts, cart_items, orders, order_items, order_state_history.

### Payments / fulfillment
payment_transactions, payment_events, refunds;
shipments, fulfillment_events.

### Post-sale
warranty_policies, claims, claim_evidence, claim_resolutions, returns.

### Finance
expenses, expense_payments, cost_allocations, sale_cost_snapshots.

### Integrations
integration_accounts, provider_mappings, inbound_events, outbox_messages, synchronization_failures.

### Audit
audit_events.

## 3. Identity strategy

Business entities use opaque primary IDs suitable for API exposure, preferably ULID/UUID-style identifiers.

Human-readable references may coexist for operational use but are not security boundaries.

IMEI/serial are domain identifiers with uniqueness/status rules, not table primary keys.

## 4. Temporal/history rules

History-sensitive data is append-only or versioned where practical:

- audit_events;
- stock_movements;
- device lifecycle;
- diagnostic history;
- routing decisions;
- order state history;
- payment provider events;
- cost snapshots;
- integration events.

Closed financial/sale history is not silently mutated.

## 5. Deletion policy

Hard delete is limited to data whose removal cannot destroy required business history.

Master/configuration records generally use active/inactive or soft-deactivation semantics where referenced.

Customer/privacy deletion/anonymization requirements will be implemented without destroying legally/operationally required order/accounting/audit facts.

## 6. Keys and constraints

Database constraints are part of integrity, not optional application decoration.

Examples:

- unique active device IMEI/serial as applicable;
- unique provider event identity per integration account;
- unique idempotency key within command scope;
- foreign keys for donor → recovered part;
- foreign keys for order item → physical inventory unit where serialized;
- check/state constraints where supported and stable;
- DECIMAL monetary fields with explicit precision.

## 7. Migration policy

Laravel migrations are the only normal schema-change mechanism.

Rules:

- every schema change versioned in Git;
- production schema never changed manually as the normal path;
- migrations are reviewed with data/backfill/rollback or forward-fix strategy;
- destructive migrations require explicit data-loss review;
- large backfills are separable from blocking DDL when necessary;
- migrations are tested from clean database and supported previous baseline;
- seeders distinguish reference/config data from development/demo fixtures.

## 8. Synthetic and production data

Development/E2E uses synthetic fixtures.

Production real inventory is not loaded until Inventory Entry Readiness is accepted.

Fixtures must be visibly non-production and must not masquerade as business truth.

## 9. Cost integrity

Cost calculations must preserve source facts and snapshots.

A final sold order item retains the cost/margin basis used at sale time even if reference catalog prices or future costs change.

## 10. Media

Database stores media metadata and secure storage keys; binary payloads are external to relational rows unless an explicit later decision proves otherwise.

## 11. Index strategy

Architecture requires indexes for:

- IMEI/serial lookup;
- product/category/model filters;
- inventory state/location;
- reservation expiration;
- order/channel/status/date;
- audit actor/action/entity/time;
- provider event identity/status;
- outbox availability/retry state.

Exact indexes are finalized with schema/query design and measured plans.
