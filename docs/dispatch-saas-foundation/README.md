# Dispatch SaaS Foundation Roadmap

This package turns the current routing codebase into a versioned, recallable roadmap for a narrow dispatch SaaS foundation.

## Operating Baseline

The product will start as a `local delivery` dispatch planning and execution system with these fixed constraints:

- Single-day planning first
- Single primary depot first
- One dispatcher workflow first
- Modular monolith backend
- Internal optimizer module, not a separate platform
- Planning and execution separated in both schema and workflow

## Why This Reset Exists

The current repo already has useful building blocks in `auth`, `drivers`, `vehicles`, `jobs`, `dispatch`, `tracking`, and `subscriptions`, but it still reflects a broader fleet/routing product shape. This roadmap narrows the product toward dispatch planning, execution tracking, exception handling, and SaaS boundaries.

## Version Map

- `v1.0` = Phase 0: Stabilize Direction
- `v1.1` = Phase 1: Core Domain and Schema
- `v1.2` = Phase 2: Planning Workflow
- `v1.3` = Phase 3: Execution Workflow
- `v1.4` = Phase 4: Optimizer Foundation
- `v1.5` = Phase 5: SaaS Foundation
- `v1.6` = Phase 6: Production Hardening

Versions are cumulative. `v1.3` assumes `v1.0` through `v1.2` are in place.

## Recall Rules

Use any of these references when discussing the roadmap later:

- `v1.0`, `phase 0`, `stabilize direction`
- `v1.1`, `phase 1`, `core domain and schema`
- `v1.2`, `phase 2`, `planning workflow`
- `v1.3`, `phase 3`, `execution workflow`
- `v1.4`, `phase 4`, `optimizer foundation`
- `v1.5`, `phase 5`, `saas foundation`
- `v1.6`, `phase 6`, `production hardening`

## Repo Placement

- Foundation blueprint: [foundation-blueprint.md](/home/logan/Desktop/Routing/Routing-/docs/dispatch-saas-foundation/foundation-blueprint.md)
- Version manifest: [manifest.json](/home/logan/Desktop/Routing/Routing-/docs/dispatch-saas-foundation/manifest.json)
- Phase files:
  - [v1.0-phase-0-stabilize-direction.md](/home/logan/Desktop/Routing/Routing-/docs/dispatch-saas-foundation/v1.0-phase-0-stabilize-direction.md)
  - [v1.1-phase-1-core-domain-and-schema.md](/home/logan/Desktop/Routing/Routing-/docs/dispatch-saas-foundation/v1.1-phase-1-core-domain-and-schema.md)
  - [v1.2-phase-2-planning-workflow.md](/home/logan/Desktop/Routing/Routing-/docs/dispatch-saas-foundation/v1.2-phase-2-planning-workflow.md)
  - [v1.3-phase-3-execution-workflow.md](/home/logan/Desktop/Routing/Routing-/docs/dispatch-saas-foundation/v1.3-phase-3-execution-workflow.md)
  - [v1.4-phase-4-optimizer-foundation.md](/home/logan/Desktop/Routing/Routing-/docs/dispatch-saas-foundation/v1.4-phase-4-optimizer-foundation.md)
  - [v1.5-phase-5-saas-foundation.md](/home/logan/Desktop/Routing/Routing-/docs/dispatch-saas-foundation/v1.5-phase-5-saas-foundation.md)
  - [v1.6-phase-6-production-hardening.md](/home/logan/Desktop/Routing/Routing-/docs/dispatch-saas-foundation/v1.6-phase-6-production-hardening.md)

## Recommended Implementation Order

1. Align the product and architecture decisions in `v1.0`.
2. Refactor schema and modules around `v1.1`.
3. Make the planning workspace the main product in `v1.2`.
4. Build execution and exceptions in `v1.3`.
5. Tighten the optimizer scope in `v1.4`.
6. Add tenant and audit boundaries in `v1.5`.
7. Harden operations and delivery in `v1.6`.
