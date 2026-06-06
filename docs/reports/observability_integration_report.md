# Observability Integration Report

## Enterprise Tooling Emulation
The terminal acts as the primary conduit for inspecting the health of the underlying ECS engine and facility telemetry. The output schemas are designed to mimic enterprise platforms (Prometheus, Jaeger).

## Native Observability Commands
* `ecs-stats`: Provides direct access to tick durations, entity counts, query hit/miss ratios, and ECS cache performance.
* `sim-diagnostics`: Renders frame timings and worker latency statistics.
* `prom` (Prometheus Exporter): Dumps raw, OpenMetrics-compliant text representations of the data center's thermal, power, and workload state directly into the console.
* `traces`: Displays a sliding window of system transaction spans with success/failure statuses and millisecond-level execution durations.
* `alerts`: Dumps the current observability rules registry and threshold configurations.

By surfacing this data through the terminal, the platform empowers players (and developers) to perform deep diagnostics using authentic enterprise observability workflows.
