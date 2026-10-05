# FIXPHONE-API-001 — API Contract Design

## 1. Status

- Product: FixPhone
- API version: `v1`
- Base path: `/api/v1`
- Architecture source: `docs/architecture/FIXPHONE_ARCHITECTURE_001.md`
- Requirements source: `docs/requirements/FIXPHONE_REQUIREMENTS_DOMAIN_001.md`
- Contract status: **READY FOR REVIEW**

This artifact defines the operation inventory and cross-cutting contract. It is not yet the generated/validated OpenAPI document.

## 2. Contract principles

- REST over HTTPS.
- JSON request/response except binary upload/download boundaries.
- Problem Details-style errors with stable application error codes and correlation IDs.
- Laravel Sanctum as first-party authentication strategy.
- Backend authorization is authoritative.
- `operationId` values are stable contract identifiers once approved.
- Commands that can be retried with duplicate business effects use explicit idempotency semantics.
- Public catalog operations never expose private provenance, cost, audit or customer data.
- Provider webhooks are isolated under integration endpoints and never bypass application rules.

## 3. Endpoint inventory

### 3.1 Identity and customer account

| API ID | operationId | Method | Path | Auth | Purpose |
|---|---|---:|---|---|---|
| API-AUTH-001 | authLogin | POST | /auth/login | public | Authenticate internal/customer principal. |
| API-AUTH-002 | authLogout | POST | /auth/logout | auth | Revoke current session/token. |
| API-AUTH-003 | authMe | GET | /auth/me | auth | Return current principal/profile/permissions summary. |
| API-AUTH-004 | customerRegister | POST | /customers/register | public | Register storefront customer. |
| API-AUTH-005 | customerProfileShow | GET | /customers/me | customer | Read own customer profile. |
| API-AUTH-006 | customerProfileUpdate | PATCH | /customers/me | customer | Update own profile. |
| API-AUTH-007 | customerAddressesList | GET | /customers/me/addresses | customer | List own addresses. |
| API-AUTH-008 | customerAddressCreate | POST | /customers/me/addresses | customer | Add address. |
| API-AUTH-009 | customerAddressUpdate | PATCH | /customers/me/addresses/{addressId} | customer | Update own address. |
| API-AUTH-010 | customerAddressDelete | DELETE | /customers/me/addresses/{addressId} | customer | Remove own address when allowed. |

### 3.2 Users, roles and permissions

| API ID | operationId | Method | Path | Auth | Purpose |
|---|---|---:|---|---|---|
| API-IAM-001 | usersList | GET | /admin/users | admin | List internal users. |
| API-IAM-002 | usersShow | GET | /admin/users/{userId} | admin | Read internal user. |
| API-IAM-003 | usersCreate | POST | /admin/users | admin | Create internal user. |
| API-IAM-004 | usersUpdate | PATCH | /admin/users/{userId} | admin | Update internal user. |
| API-IAM-005 | usersDeactivate | POST | /admin/users/{userId}/deactivate | admin | Deactivate user. |
| API-IAM-006 | rolesList | GET | /admin/roles | admin | List roles. |
| API-IAM-007 | roleAssignmentsUpdate | PUT | /admin/users/{userId}/roles | admin | Replace role assignments. |

### 3.3 Master catalog

| API ID | operationId | Method | Path | Auth |
|---|---|---:|---|---|
| API-CAT-001 | brandsList | GET | /brands | mixed |
| API-CAT-002 | brandsCreate | POST | /admin/brands | admin |
| API-CAT-003 | brandsUpdate | PATCH | /admin/brands/{brandId} | admin |
| API-CAT-004 | modelsList | GET | /models | mixed |
| API-CAT-005 | modelsCreate | POST | /admin/models | admin |
| API-CAT-006 | modelsUpdate | PATCH | /admin/models/{modelId} | admin |
| API-CAT-007 | productCatalogList | GET | /products | public |
| API-CAT-008 | productCatalogShow | GET | /products/{productId} | public |
| API-CAT-009 | productsAdminList | GET | /admin/products | staff |
| API-CAT-010 | productsAdminCreate | POST | /admin/products | privileged |
| API-CAT-011 | productsAdminUpdate | PATCH | /admin/products/{productId} | privileged |
| API-CAT-012 | productCompatibilityUpdate | PUT | /admin/products/{productId}/compatibility | privileged |

### 3.4 Acquisition, lots, consignments and devices

| API ID | operationId | Method | Path | Auth |
|---|---|---:|---|---|
| API-ACQ-001 | lotsList | GET | /admin/acquisition-lots | staff |
| API-ACQ-002 | lotsCreate | POST | /admin/acquisition-lots | intake |
| API-ACQ-003 | lotsShow | GET | /admin/acquisition-lots/{lotId} | staff |
| API-ACQ-004 | lotCostCreate | POST | /admin/acquisition-lots/{lotId}/costs | finance |
| API-CON-001 | consignmentsList | GET | /admin/consignments | staff |
| API-CON-002 | consignmentsCreate | POST | /admin/consignments | privileged |
| API-CON-003 | consignmentShow | GET | /admin/consignments/{agreementId} | staff |
| API-DEV-001 | devicesCreate | POST | /admin/devices | intake |
| API-DEV-002 | devicesShow | GET | /admin/devices/{deviceId} | staff |
| API-DEV-003 | devicesUpdate | PATCH | /admin/devices/{deviceId} | intake |
| API-DEV-004 | deviceMediaCreate | POST | /admin/devices/{deviceId}/media | intake |
| API-DEV-005 | deviceRestrictionCheckCreate | POST | /admin/devices/{deviceId}/restriction-checks | privileged |
| API-DEV-006 | deviceTimelineList | GET | /admin/devices/{deviceId}/timeline | staff |

### 3.5 Diagnosis, routing, repair and dismantling

| API ID | operationId | Method | Path | Auth |
|---|---|---:|---|---|
| API-DIA-001 | diagnosisCreate | POST | /admin/devices/{deviceId}/diagnoses | technician |
| API-DIA-002 | diagnosesList | GET | /admin/devices/{deviceId}/diagnoses | staff |
| API-ROU-001 | economicEvaluationCreate | POST | /admin/devices/{deviceId}/evaluations | privileged |
| API-ROU-002 | routingDecisionCreate | POST | /admin/devices/{deviceId}/routing-decisions | privileged |
| API-ROU-003 | routingOverrideCreate | POST | /admin/devices/{deviceId}/routing-overrides | privileged |
| API-REP-001 | repairOrdersCreate | POST | /admin/repair-orders | technician |
| API-REP-002 | repairOrdersShow | GET | /admin/repair-orders/{repairOrderId} | staff |
| API-REP-003 | repairPartConsume | POST | /admin/repair-orders/{repairOrderId}/parts | technician |
| API-REP-004 | repairLaborCreate | POST | /admin/repair-orders/{repairOrderId}/labor | technician |
| API-REP-005 | repairQcComplete | POST | /admin/repair-orders/{repairOrderId}/qc | technician |
| API-DIS-001 | dismantlingOrdersCreate | POST | /admin/dismantling-orders | technician |
| API-DIS-002 | dismantlingOrdersShow | GET | /admin/dismantling-orders/{orderId} | staff |
| API-DIS-003 | recoveredPartsCreate | POST | /admin/dismantling-orders/{orderId}/parts | technician |
| API-DIS-004 | dismantlingComplete | POST | /admin/dismantling-orders/{orderId}/complete | technician |

### 3.6 Inventory

| API ID | operationId | Method | Path | Auth |
|---|---|---:|---|---|
| API-INV-001 | inventoryList | GET | /admin/inventory | staff |
| API-INV-002 | inventoryUnitShow | GET | /admin/inventory/{inventoryId} | staff |
| API-INV-003 | inventoryMove | POST | /admin/inventory/{inventoryId}/movements | inventory |
| API-INV-004 | inventoryAdjustmentCreate | POST | /admin/inventory/{inventoryId}/adjustments | privileged |
| API-INV-005 | inventoryCountsCreate | POST | /admin/inventory-counts | inventory |
| API-INV-006 | inventoryCountComplete | POST | /admin/inventory-counts/{countId}/complete | privileged |
| API-INV-007 | locationsList | GET | /admin/locations | staff |
| API-INV-008 | locationsCreate | POST | /admin/locations | privileged |

### 3.7 Cart, order, payment and fulfillment

| API ID | operationId | Method | Path | Auth |
|---|---|---:|---|---|
| API-COM-001 | cartShow | GET | /cart | customer |
| API-COM-002 | cartItemAdd | POST | /cart/items | customer |
| API-COM-003 | cartItemUpdate | PATCH | /cart/items/{itemId} | customer |
| API-COM-004 | cartItemRemove | DELETE | /cart/items/{itemId} | customer |
| API-ORD-001 | checkoutCreate | POST | /checkout | customer |
| API-ORD-002 | customerOrdersList | GET | /customers/me/orders | customer |
| API-ORD-003 | customerOrderShow | GET | /customers/me/orders/{orderId} | customer |
| API-ORD-004 | adminOrdersList | GET | /admin/orders | staff |
| API-ORD-005 | adminOrderShow | GET | /admin/orders/{orderId} | staff |
| API-ORD-006 | assistedOrderCreate | POST | /admin/orders | sales |
| API-ORD-007 | orderCancel | POST | /admin/orders/{orderId}/cancel | privileged |
| API-PAY-001 | paymentIntentCreate | POST | /orders/{orderId}/payments | customer |
| API-PAY-002 | paymentRefundCreate | POST | /admin/orders/{orderId}/refunds | privileged |
| API-FUL-001 | fulfillmentOptionsList | GET | /fulfillment/options | public |
| API-FUL-002 | shipmentUpdate | PATCH | /admin/shipments/{shipmentId} | fulfillment |
| API-FUL-003 | pickConfirm | POST | /admin/orders/{orderId}/picks | inventory |

### 3.8 Post-sale, finance and reporting

| API ID | operationId | Method | Path | Auth |
|---|---|---:|---|---|
| API-WAR-001 | warrantyClaimsCreate | POST | /customers/me/claims | customer |
| API-WAR-002 | warrantyClaimsList | GET | /admin/claims | post-sale |
| API-WAR-003 | warrantyClaimResolve | POST | /admin/claims/{claimId}/resolution | privileged |
| API-FIN-001 | expensesList | GET | /admin/expenses | finance |
| API-FIN-002 | expensesCreate | POST | /admin/expenses | finance |
| API-FIN-003 | expensesUpdate | PATCH | /admin/expenses/{expenseId} | finance |
| API-FIN-004 | consignorSettlementCreate | POST | /admin/consignments/{agreementId}/settlements | privileged |
| API-REP-101 | dashboardShow | GET | /admin/reports/dashboard | staff |
| API-REP-102 | profitabilityReport | GET | /admin/reports/profitability | finance |
| API-REP-103 | inventoryAgingReport | GET | /admin/reports/inventory-aging | staff |

### 3.9 Integrations and webhooks

| API ID | operationId | Method | Path | Auth |
|---|---|---:|---|---|
| API-INT-001 | integrationAccountsList | GET | /admin/integrations | admin |
| API-INT-002 | integrationConnect | POST | /admin/integrations/{provider}/connect | admin |
| API-INT-003 | integrationSyncRequest | POST | /admin/integrations/{provider}/sync | privileged |
| API-INT-004 | integrationFailuresList | GET | /admin/integrations/failures | privileged |
| API-INT-005 | integrationFailureRetry | POST | /admin/integrations/failures/{failureId}/retry | privileged |
| API-WHK-001 | mercadoPagoWebhook | POST | /webhooks/mercado-pago | provider |
| API-WHK-002 | mercadoLibreWebhook | POST | /webhooks/mercado-libre | provider |
| API-WHK-003 | metaWebhook | POST | /webhooks/meta | provider |
| API-WHK-004 | whatsappWebhook | POST | /webhooks/whatsapp | provider |

## 4. Authentication contract

### Public
No principal required. Public endpoints expose only intentionally public commerce/reference data.

### Customer
Sanctum-authenticated customer principal. Ownership checks are mandatory.

### Internal staff
Sanctum-authenticated internal principal with permission checks.

### Provider webhook
Not user-authenticated. Provider authenticity is verified by provider-specific signature/token rules and event identity.

## 5. Permission matrix

Permission names are stable business capabilities, not UI labels.

| Permission | Representative operations |
|---|---|
| users.manage | API-IAM-001..007 |
| catalog.manage | API-CAT-002..006, API-CAT-009..012 |
| acquisition.manage | API-ACQ-001..004 |
| consignment.manage | API-CON-001..003 |
| devices.intake | API-DEV-001..004 |
| devices.restrictions.manage | API-DEV-005 |
| diagnosis.manage | API-DIA-001 |
| routing.manage | API-ROU-001..002 |
| routing.override | API-ROU-003 |
| workshop.repair | API-REP-001..005 |
| workshop.dismantle | API-DIS-001..004 |
| inventory.view | API-INV-001..002,007 |
| inventory.move | API-INV-003,005 |
| inventory.adjust | API-INV-004,006,008 |
| orders.view | API-ORD-004..005 |
| orders.manage | API-ORD-006..007 |
| payments.refund | API-PAY-002 |
| fulfillment.manage | API-FUL-002..003 |
| postsale.manage | API-WAR-002..003 |
| finance.manage | API-FIN-001..004 |
| reports.view | API-REP-101..103 |
| integrations.manage | API-INT-001..005 |
| audit.view | later audit-query operation when contract expands |

## 6. Audit-event mapping

| Operation family | Audit event |
|---|---|
| User/role changes | ACCESS.ROLE_CHANGED / ACCESS.PERMISSION_CHANGED |
| Device restriction changes | DEVICE.RESTRICTION_STATUS_CHANGED |
| Routing decision | ROUTING.DECISION |
| Routing override | ROUTING.OVERRIDE |
| Inventory move | INVENTORY.MOVEMENT |
| Inventory adjustment | INVENTORY.ADJUSTMENT |
| Order state/cancel | ORDER.STATE_CHANGED / ORDER.CANCELLED |
| Payment reconciliation | PAYMENT.STATE_CHANGED |
| Refund | REFUND.EXECUTED |
| Cost override | COST.OVERRIDE |
| Consignment settlement | CONSIGNMENT.SETTLED |
| Warranty resolution | WARRANTY.RESOLUTION |
| Integration config/credential change | INTEGRATION.CONFIG_CHANGED / INTEGRATION.CREDENTIAL_ROTATED |

## 7. Idempotency matrix

Required `Idempotency-Key` for first-party retriable commands with duplicate-effect risk:

customerRegister, usersCreate, lotsCreate, consignmentsCreate, devicesCreate,
diagnosisCreate, economicEvaluationCreate, routingDecisionCreate, routingOverrideCreate,
repairOrdersCreate, repairPartConsume, repairLaborCreate, repairQcComplete,
dismantlingOrdersCreate, recoveredPartsCreate, dismantlingComplete,
inventoryMove, inventoryAdjustmentCreate, inventoryCountsCreate, inventoryCountComplete,
cartItemAdd, checkoutCreate, assistedOrderCreate, orderCancel, paymentIntentCreate,
paymentRefundCreate, pickConfirm, warrantyClaimsCreate, warrantyClaimResolve,
expensesCreate, consignorSettlementCreate, integrationSyncRequest, integrationFailureRetry.

Provider webhooks use provider-event identity/signature rather than requiring a client `Idempotency-Key`.

## 8. Error contract

All API errors follow the approved Problem Details policy with:

- `type`
- `title`
- `status`
- safe `detail`
- `code`
- `correlationId`
- field-level `errors` for validation when applicable.

Important conflict codes include:

- `inventory_not_available`
- `reservation_conflict`
- `invalid_state_transition`
- `duplicate_device_identifier`
- `restricted_device`
- `idempotency_conflict`

## 9. Pagination/filter/sort

Collection endpoints use a shared query contract:

- `page[size]`
- cursor pagination by default for large mutable collections where deterministic ordering exists;
- offset pagination only where totals/page navigation materially matter;
- `filter[field]`
- `sort=field,-other`

Allowed fields are endpoint-specific and must be documented in OpenAPI.

## 10. Contract traceability

| Domain outcome | API groups |
|---|---|
| Identity/account | API-AUTH, API-IAM |
| Catalog/storefront | API-CAT |
| Acquisition/provenance | API-ACQ, API-CON, API-DEV |
| Diagnosis/routing | API-DIA, API-ROU |
| Workshop | API-REP, API-DIS |
| Inventory | API-INV |
| Commerce | API-COM, API-ORD, API-PAY, API-FUL |
| Post-sale | API-WAR |
| Finance/reporting | API-FIN, API-REP-1xx |
| External channels | API-INT, API-WHK |

## 11. OpenAPI boundary

The next OpenAPI artifact must implement this approved operation inventory without silently adding business capabilities.

OpenAPI validation occurs in its own Blueprint phase after implementation contract generation.
