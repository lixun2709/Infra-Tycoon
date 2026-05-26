# Simulation Systems Reference

## Thermal System
Models the BTU emission of components. Racks trap heat (micro-climates) which transfers to the room ambient zone. CRAC units extract room BTU. Overheating causes silicon degradation and immediate asset failure.

## Power System
Models a 3-Phase electrical distribution network. Compute nodes draw Apparent Power (VA) based on utilization. Racks balance load across A/B/C phases. Imbalance or exceeding the PDU breaker limit causes a hard power trip.

## Network System
Simulates layer 2/3 traffic via a Spine-Leaf topology. Links have bandwidth saturation limits. Packets are queued and dropped if QoS buffers overflow.

## Telemetry System
Aggregates performance counters across all active components. Exposes OpenMetrics-compliant endpoints for the NOC dashboard React components to visualize (e.g. Total Power kW, BTU Load).
