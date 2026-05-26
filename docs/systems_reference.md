# Simulation Systems Reference

## Thermal System
Models the BTU emission of components. Racks trap heat (micro-climates) which transfers to the room ambient zone. CRAC units extract room BTU. Overheating causes silicon degradation and immediate asset failure.

Architecturally, the Thermal System is divided into purely functional modules:
- **CRACManager**: Extracts Lead-Lag redundancy scheduling, evaluates N+1 availability, calculates standby assignments, and computes CRAC unit BTU extraction and thermal throttling.
- **RoomAmbientEngine**: Simulates massive room-level thermal inertia, BTU dispersion, and localized environmental relative humidity calculations.
- **RackMicroclimate**: Computes isolated hot-aisle/cold-aisle containment recirculation, localized adjacent rack conduction, and rack-specific convection heat trapping.
- **DeviceThermalCalculator**: Computes per-server heat generation based on dynamic workloads, scales fan speeds based on target equilibrium curves, and processes CPU thermal throttling and critical hardware failures.

## Power System
Models a 3-Phase electrical distribution network. Compute nodes draw Apparent Power (VA) based on utilization. Racks balance load across A/B/C phases. Imbalance or exceeding the PDU breaker limit causes a hard power trip. 

Architecturally, the Power System is divided into purely functional modules:
- **UPSManager**: Handles battery discharging/charging rates and backup state transitions based on A/B grid feed availability.
- **DevicePowerCalculator**: Computes Apparent Power (VA), Power Factor, and Dynamic Wattage scaling based on component utilization.
- **PhaseBalancer**: Aggregates child device loads into 3-phase (A, B, C) PDU loads on the parent rack.
- **BreakerManager**: Evaluates total load and phase imbalances against limits, managing overload timers and trip events.
## Network System
Simulates layer 2/3 traffic via a Spine-Leaf topology. Links have bandwidth saturation limits. Packets are queued and dropped if QoS buffers overflow.

Architecturally, network simulation routing and congestion are divided into purely functional modules:
- **TrafficRouter**: Evaluates shortest path connectivity (Dijkstra's SSSP) and aggregates required traffic flow across links.
- **MalwarePropagator**: Simulates probabilistic lateral spread of infectious agents across adjacent network hops.
- **QoSEngine**: Translates saturated bandwidth utilization into distinct V2 QoS priorities (Control, Application, Bulk), applying scaled latency penalties and packet drops.

## Storage System
Simulates enterprise datacenter storage fabrics, including SAS/FC SAN aggregations, dual-parity RAID-6 failures, IOPS workload queuing, and active data replication.

Architecturally, the Storage System is divided into purely functional modules:
- **SANAggregator**: Discovers and aggregates capacity and IOPS from cabled disk shelves to their SAN controllers using Breadth-First Search.
- **RAIDManager**: Processes drive wear degradation, computes Write Amplification Factor (WAF), manages RAID failure thresholds, and dynamic array rebuilding.
- **ReplicationManager**: Calculates path bandwidth and syncs active data replication loops between primary and secondary sites.
- **IOPSCalculator**: Resolves IOPS workloads from applications, calculates deduplication/compression overheads, and cascades thermal storage thrashing to the hardware stack.

## Telemetry System
Aggregates performance counters across all active components. Exposes OpenMetrics-compliant endpoints for the NOC dashboard React components to visualize (e.g. Total Power kW, BTU Load).
## Observability System
Simulates distributed tracing and metric aggregation to fuel the NOC dashboard and alert triage rules. Tracks node-level CPU temperatures, global network congestion, facility power demands, and distributed backend telemetry spans.

Architecturally, the Observability System is divided into purely functional modules:
- **ObservabilityRulesEngine**: Stateless deterministic function evaluating threshold alarms. Uses nested pointer maps internally to avoid string key allocations (zero-allocation physics processing).
- **ObservabilityTracer**: Zero-allocation circular ring buffer utilizing deterministic integer IDs and pre-allocated arrays to track microservice spanning without GC spikes.
- **ObservabilityAlerting**: Independent rules configuration store, exposing static schemas without tightly coupling to the ECS environment for pure WebWorker compatibility.
## Telemetry System
Responsible for gathering simulation performance and operational statistics. It calculates metrics such as average uptime, PUE, WUE, power constraints, and temperature aggregation.

Architecturally, the Telemetry System follows a strictly zero-allocation pipeline during update ticks. It utilizes persistent Map properties and primitive counter accumulations to prevent Garbage Collector (GC) pressure when rendering thousands of entities at once. Aggregated telemetry metrics are natively injected into CircularBuffer instances, preventing internal Array expansions or object cloning throughout long-running server simulations.

### Observability Dashboard Architecture
The observability dashboard is built on a zero-polling transient subscription architecture. It avoids expensive setInterval calls by connecting directly to the Zustand store via useInfraStore.subscribe. To ensure the React frontend maintains 60 FPS, the subscription intelligently throttles incoming WebWorker telemetry updates, updating the DOM at a maximum rate of 2 Hz without global rerenders.

### Prometheus Exporter
The PrometheusExporter generates OpenMetrics standard exposition formats deterministically. It avoids per-frame string allocation overheads by internally utilizing a cached Map array for static # HELP metadata components, appending values sequentially into a fast string builder buffer before .join() formatting.
### Rack System Integrity Verification
The RackSystem manages strict physical, thermal, and electrical limits of datacenter equipment. It employs state-transition alert throttling (hasSlotCollision, hasBoundaryViolation) to intelligently suppress event stream spam during structural invalidations. This system runs deterministically, omitting global random functions (e.g. Math.random()) in favor of synced internal execution tick counters.
### Thermal Cooling Subsystem Encapsulation
The ThermalSystem offloads all dedicated CRAC (Computer Room Air Conditioning) unit state tracking, water flow calculations, and thermal target relaxation directly to the CRACManager. This unified approach prevents divergence between active cooling load evaluations and physical node temperature responses. To maintain multiplayer synchronization, all thermal processing utilizes a local executionTickCounter instead of volatile JS Math.random() calls.
### Power Systems Event Flow Optimization
The BreakerManager and UPSManager enforce strict structural bounds on telemetry propagation. Event throttling guarantees that recurring states (e.g. UPS battery countdown or persistent breaker faults) do not result in console.log flooding or event-bus saturation across the worker thread boundary. A dedicated lastUpsAlertSecond parameter exists within PowerComponent to lock event transitions to whole-integer thresholds, preventing GC spikes.
### Network Systems Routing Optimization
The TrafficRouter handles Single-Source Shortest Path (SSSP) multi-flow distribution logic. O(N²) destination array filtering was successfully pre-computed into categorized O(N) static target lists per network simulation tick. This strictly mitigates runtime memory spikes and massive JavaScript GC stutters during complex datacenter topologies. Telemetry and observability publishing is locked behind a strict modulus tick counter (executionTickCounter) rather than floating random intervals, maintaining synchronization precision between parallel WebWorker ECS instantiations.
### Storage Systems Memory Optimizations
The Storage subsystem has been heavily optimized for massive concurrent IOPS load testing. IOPSCalculator utilizes static Map pooling (hostToApps) to completely eradicate the O(N*M) nested cascading failure lookup loop. Storage networking via SANAggregator flattens its internal Breadth-First-Search object queue into lightweight, paired primitive arrays (pathQueueNodes and pathQueueBws). Finally, global topological connections via StorageSystem.adjMap dynamically reuse array length mutation (rr.length = 0) instead of executing full .clear() wipes. These zero-allocation changes entirely prevent JavaScript GC stutters when simulating large SAN fabrics.
### Thermal Engine Memory Optimizations
The thermodynamic simulation now computes spatial node conduction utilizing static 42-slot memory arrays instead of standard dynamic sort() evaluations, stripping thousands of garbage collection spikes per simulation tick. Lateral convective math drops Euclidean root functions (Math.sqrt) in favor of squared distance checks, speeding up spatial lookups exponentially across large datacenters. Finally, Room vs In-Row cooling subsystems evaluate localized redundancies independently, preserving strict operational realism for cold/hot aisle containment systems.
