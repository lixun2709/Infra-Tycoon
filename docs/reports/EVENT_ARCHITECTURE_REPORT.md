# Event Architecture Report
A centralized EventBus has been implemented at src/core/events/EventBus.ts. It acts as a deterministic, synchronous payload router, decoupling gameplay simulation logic from UI alerts and cross-store dependencies. Strict event typings such as SIMULATION_TICK and THERMAL_CRITICAL are now enforced.
