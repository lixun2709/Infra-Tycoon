# Observability Documentation

The Terminal acts as your enterprise monitoring station, exposing the raw telemetry that powers the game's simulation engine.

## `prom`
Exports a string payload formatted exactly to OpenMetrics/Prometheus standards. You will see internal variable mappings for cooling capacity, power draw, and workload IOPS represented as time-series metrics.

## `ecs-stats`
This command peers directly into the Web Worker's memory boundary. It returns:
* **Tick Latency**: The exact millisecond duration of the last physics calculation loop.
* **Entity Count**: Total objects managed by the system.
* **Cache Hits**: Metrics showing how effectively the ECS querying cache is running.

## `traces`
Every UI interaction creates a trace span. Calling `traces` inside the terminal reads the rolling window buffer of `ObservabilityTracer` and prints a structured log of system operations, nested dependencies, and microsecond latencies.
