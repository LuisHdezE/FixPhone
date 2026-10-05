# FIXPHONE-THREAT-001 — Threat Model

## Scope

FixPhone web, mobile, Laravel API, MySQL, file storage and external-provider integration boundaries.

## Primary assets

- unique physical inventory and availability;
- customer/internal identity;
- financial/cost/margin data;
- provenance/IMEI evidence;
- payment state;
- integration credentials/tokens;
- audit history.

## Threats and required mitigations

| Threat | Impact | Mitigation |
|---|---|---|
| Double sale through concurrent requests/channels | Financial/customer loss | transactional reservation, row locks/version checks, provider sync/outbox |
| Forged payment webhook | Free merchandise / false paid state | provider authenticity verification, event identity, authoritative reconciliation |
| Replay of webhook/command | Duplicate order/refund/movement | idempotency keys + unique provider-event constraints |
| Privilege escalation | Financial/inventory tampering | backend RBAC, least privilege, audit, protected admin flows |
| Credential leakage | Account/provider takeover | secret management, encryption, redaction, rotation |
| Malicious upload | Code/content compromise | MIME/size validation, isolated storage, optional scanning |
| IMEI/provenance manipulation | Unsafe/illicit sale | immutable evidence/history, restricted state, authorized override only |
| Direct stock mutation bypass | Oversell / loss of trace | stock-movement service boundary, DB constraints, no ungoverned quantity edits |
| Customer data exposure | Privacy harm | ownership checks, minimal data, protected endpoints/log redaction |
| Integration outage | Stale channel availability | internal authority, outbox retries, discrepancy visibility, pause/fail-safe behavior |
| Audit deletion/tampering | Loss of accountability | append-oriented durable audit, restricted access, backup |
| Mobile device loss | Unauthorized staff access | secure token storage, revocation, short/appropriate token policy |
| Enumeration/brute force | Account takeover | rate limit, secure recovery UX, monitoring |
| SQL/injection/XSS | Data/system compromise | framework parameterization, output encoding, validation, CSP later where applicable |

## Residual risk

External providers can be unavailable or change capabilities. Architecture treats this as integration degradation, not permission to corrupt internal truth.

Security testing and operational controls are required later; this document is design evidence, not proof of implementation.
