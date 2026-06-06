# ENTERPRISE STATE GOVERNANCE & EVENT ARCHITECTURE PLAN

## 1. Current State Governance Analysis
Currently, Infra-Tycoon relies on src/store/useInfraStore.ts, a monolithic Zustand store initialized via 16 tightly coupled "slices". 
- **The Problem**: While slices organize code conceptually, they inject all properties into a single runtime store object. This creates cascading reactivity (e.g. a UI change triggers a re-eval of simulation nodes), leading to immense TypeScript ny debt because avoiding circular type definitions requires breaking strict type safety.
- **Cross-Store Dependency**: Slices routinely poll other slices (e.g. economySlice accessing 
odes from simulationSlice). This prevents safe extraction and testing.
- **The Success**: We have successfully proven the extraction pattern by moving useUIStore and useTerminalStore to atomic domains, which stabilized the UI and improved FPS.

## 2. State Boundary & Ownership Plan
State separation fundamentally improves scalability, multiplayer readiness, maintainability, and debugging. By breaking the monolith, we isolate the heavy 1Hz simulation tick (ECS determinism) from high-frequency UI/telemetry renders.

We will partition the remaining useInfraStore into the following domains:
1. **useUIStore**: (Already existing) Handles ephemeral interface states.
2. **useTerminalStore**: (Already existing) Manages terminal sessions and CLI inputs.
3. **useTelemetryStore**: Real-time graphs, logs, and dashboard metrics.
4. **useObservabilityStore**: Audit logs, alarms, post-mortems, and ITSM ticketing.
5. **useGameplayStore**: Economics, reputation, contracts, progression, and player authority boundaries.
6. **useSimulationStore**: The core deterministic ECS engine (Nodes, connections, power, thermal states). *This will be the final step to preserve simulation continuity.*

## 3. Migration & Rollback Strategy
- **Migration Strategy**: "Outside-In Extraction". We will extract Telemetry and Observability first, migrating their references safely.
- **Rollback Strategy**: Every extracted store will maintain interface parity with the monolith. If rendering regressions occur, we restore the slices to the monolith.
- **Compatibility Strategy**: Where useGameplayStore needs simulation data, it will consume it deterministically via the new Event Bus rather than store cross-polling. Transitional selectors will act as bridges during the migration.

## 4. Operational Event Bus Architecture
The platform now requires a true event-driven operational backbone. We will create src/core/events/ containing a centralized EventBus.
- **EventBus.ts**: The core publisher/subscriber singleton.
- **EventTypes.ts**: Strict types for event payloads (SIMULATION_TICK, THERMAL_CRITICAL, CONTRACT_COMPLETED).
- **Domain Events**: Scoped publishers and listener utilities.
- **Why**: The event system unifies gameplay actions, infrastructure changes, and telemetry updates. It remains deterministic, decoupled, and highly scalable.

## 5. Structured Logging & Telemetry Pipeline
We will replace ad-hoc console.log and scattered string arrays with an enterprise observability abstraction in src/core/telemetry/.
- **Logger.ts**: Centralized structured logging service with severity classification (INFO, WARN, FATAL).
- **Operational Context**: Every log will carry context (source, entityId, trace).

## 6. Verification
- We will rigorously verify gameplay flow, ECS determinism, and rendering stability after each domain separation. 
- Playwright E2E testing will act as our safety net against regressions.
