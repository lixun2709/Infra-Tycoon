# Command Reference

The Command Registry enforces specific authority tiers across all terminal execution vectors.

## READ_ONLY Commands
Safe polling routines.
- `help`: Print the core command lexicon.
- `ls`: Standard directory listing of node artifacts.
- `pwd`: Current working directory of the pane context.
- `cat`: Output artifact text.
- `ping [target]`: Trace reachability utilizing backend routing engines.
- `show ip brief`: Tabular summary of all configured node identities.
- `ecs-stats`: Raw physics tick and memory latency diagnostics.
- `prom`: Prometheus/OpenMetrics formatted facility telemetry snapshot.
- `traces`: System transaction spans within the observability layer.

## OPERATIONAL Commands
Synchronous logical modifications.
- `hostname [name]`: Sets the identity string for a node. Will block if a collision occurs on the subnet.
- `ip setup [ip] [gw] [dns]`: Provisions logical routing parameters.
- `export [var]=[value]`: Binds environment variables into the active session context.

## SIMULATION_CRITICAL Commands
Asynchronous physical mutations processed via the ECS determinism loop.
- `poweron`: Initiates a BMC hardware bootstrap sequence on the connected node.
- `pdu reset [rack_id]`: Cycles the circuit breakers on a targeted rack enclosure.
- `dr-drill [site_id]`: Instigates a facility-wide utility power failure to test redundant feeds.
- `ransomware-drill`: Injects an infection component randomly into the storage array matrix to test security response.
- `isolate [node_id]`: Enacts physical blackholing of the target machine.
- `format [node_id]`: Erases all active storage boundaries and resets the node filesystem.
