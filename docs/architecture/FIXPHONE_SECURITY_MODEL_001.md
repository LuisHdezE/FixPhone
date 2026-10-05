# FIXPHONE-SEC-001 — Security Model

## 1. Trust boundary

Laravel API/backend is the authoritative security boundary.

React, Android, iOS and external providers are untrusted clients/inputs and cannot authorize themselves.

## 2. Authentication strategy

Preferred first-party authentication technology: Laravel Sanctum.

- Web storefront/admin may use secure same-site/session-cookie SPA authentication when deployment topology allows.
- Mobile uses revocable API tokens issued through authenticated flows.
- Tokens are stored using platform-secure credential storage.
- Passwords use Laravel-supported strong adaptive hashing.
- Account recovery must not disclose whether arbitrary identities exist beyond acceptable UX/security tradeoffs.

Exact endpoint shapes belong to API Contract.

## 3. Authorization

Server-side RBAC/permission checks are mandatory for every protected operation.

High-risk capabilities include:

- user/role/permission administration;
- inventory adjustment;
- routing override;
- cost modification;
- refund/cancellation;
- consignment settlement;
- integration credential/configuration changes;
- audit access/export.

UI visibility is convenience only.

## 4. Data protection

- HTTPS in transit.
- Secrets only through environment/secret-management boundary, never committed.
- Sensitive provider credentials encrypted at rest using framework/platform mechanisms.
- Logs/audit redact credentials, tokens, payment secrets and unnecessary PII.
- Public media and private provenance/evidence use separate authorization/visibility rules.

## 5. Payments

FixPhone must not store raw card PAN/CVV.

Payment collection is delegated to Mercado Pago/provider-hosted approved mechanisms.

Provider callbacks/webhooks are verified and reconciled before payment is treated as final.

## 6. Input/file safety

- Validate request shape and business rules separately.
- Normalize identifiers.
- Enforce upload size/MIME policies.
- Do not trust client filename or MIME alone.
- Store uploads outside executable/public paths unless explicitly public product media.
- Malware scanning may be added if deployment/risk analysis requires it.

## 7. Abuse controls

Applicable endpoints use rate limits/throttling, especially:

- authentication/recovery;
- public search if abused;
- checkout/payment initiation;
- webhook endpoints where provider retry behavior permits safe limits.

## 8. Session/token lifecycle

- revocation supported;
- logout invalidates relevant session/token;
- privilege changes can invalidate/re-authorize sessions as appropriate;
- mobile token loss is recoverable via revocation.

## 9. Security audit

Required durable evidence includes authentication/authorization administration, sensitive CRUD, inventory adjustments, routing overrides, financial actions, refunds, integration administration and security-relevant failures.

Technical logs and business/security audit are separate stores/concepts.

## 10. Public indexing

robots/noindex is never an access-control mechanism.

Admin/customer/private API data requires authentication/authorization regardless of discoverability policy.
