# TYPE HARDENING & TECHNICAL DEBT BACKLOG

## 1. Unsafe \ny\ Usage Audit
The following core modules still heavily utilize \: any\ typings. They must be typed incrementally over the next few releases:
- \src/store/slices/simulationSlice.ts\ (Many payload casts and filtering functions)
- \src/store/terminalLogic.ts\ (Command arguments array uses \ny[]\)
- \src/components/ui/Dashboard.tsx\ (Zustand state mappings bypass strict typechecking)
- \src/simulation/SimulationWorkerManager.ts\ (Worker message payloads)

## 2. Weak Interfaces
- \infraStoreTypes.ts\ currently lacks strong payload contracts for deeply nested JSON objects like \
odes\.

## 3. Tech Debt & Architecture Next Steps
- Completely deprecate \useInfraStore\ monolith and rely entirely on atomic stores (\useGameplayStore\, \useTelemetryStore\, \useObservabilityStore\, \useSimulationStore\).
- Remove the \migrationLayer.ts\ bridge once all React components are successfully rewritten to natively use atomic stores.
- Convert the physics ECS logic to interface strictly with the new \EventBus.ts\ rather than direct array mutations.

