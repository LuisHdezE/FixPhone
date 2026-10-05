# FIXPHONE-AUDIT-RETENTION-001 — Audit Retention Policy

## Principle

Durable business/security audit is retained independently from ordinary application logs.

## Retention classes

- Security and access-administration audit: minimum 5 years unless legal/business review requires longer.
- Financial, inventory, routing, settlement and order audit: minimum 5 years unless fiscal/legal obligations require longer.
- Provider/integration diagnostic logs: operational retention may be shorter, but durable business effects remain represented in audit/business history.
- Technical debug logs: short operational retention, configurable by environment.

## Integrity

Audit records are append-oriented. Corrections create new events rather than silently rewriting prior evidence.

Deletion/anonymization requests must be evaluated against legal/business retention obligations. Where identity minimization is required, audit accountability must remain sufficient without retaining unnecessary personal content.

## Access

Audit read/export is restricted to authorized administrative roles and itself may be audited.

## Backup

Audit data participates in authoritative database backups and restoration tests.
