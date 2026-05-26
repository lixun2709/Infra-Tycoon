# Simulation Systems Reference

## Thermal System
Models the BTU emission of components. Racks trap heat (micro-climates) which transfers to the room ambient zone. CRAC units extract room BTU. Overheating causes silicon degradation and immediate asset failure.

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

## Telemetry System
Aggregates performance counters across all active components. Exposes OpenMetrics-compliant endpoints for the NOC dashboard React components to visualize (e.g. Total Power kW, BTU Load).
