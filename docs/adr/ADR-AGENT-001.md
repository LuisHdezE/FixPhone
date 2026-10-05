# ADR-AGENT-001 — Adopt Blueprint multi-agent proposal

## Status

Accepted for FixPhone bootstrap.

## Context

FixPhone is a new Greenfield consumer of `LuisHdezE/SoftwareDevelopmentBlueprint`.

The stable Blueprint baseline is `0.5.4`. The multi-agent model currently exists as proposal-stage work and is not part of the stable release.

FixPhone will be developed while the canonical Blueprint evolves toward that multi-agent model.

## Decision

FixPhone explicitly opts in to:

- `agent-protocol-proposal-1`;
- Orchestrator-led task routing;
- Task Packets;
- Agent Handoffs;
- consumer-local orchestration state under `.blueprint/agents/`;
- explicit human merge decisions.

The proposal does not replace stable Blueprint phases, checks or gates.

`AGENT STATUS != BLUEPRINT GATE STATUS`

## Governance

- Stable Blueprint authority remains `0.5.4` until an explicit consumer adoption changes it.
- Proposal artifacts cannot silently promote stable gates to PASS.
- Implementers cannot self-certify governed completion.
- Auditor has no merge authority.
- Human merge approval remains mandatory.
- Future Blueprint releases require explicit Compliance Review before FixPhone adopts them.

## Consequences

FixPhone becomes an intentional pilot consumer of the Blueprint multi-agent model while preserving truthful version provenance and stable-gate authority.
