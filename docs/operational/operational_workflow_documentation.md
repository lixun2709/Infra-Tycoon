# Operational Workflow Documentation

## Emulating Enterprise Workflows
The terminal in Infra-Tycoon is designed to map 1:1 with authentic infrastructure engineering tasks.

### Workflow 1: Bare Metal Provisioning
1. Physically construct a rack.
2. Deploy a compute node into the rack chassis.
3. Physically patch a network cable from the node to a Top-of-Rack Switch.
4. Open the `Terminal Console`.
5. Run `poweron`. Observe the simulated hardware POST (Power On Self Test).
6. Run `hostname primary-web-01`.
7. Run `ip setup 192.168.10.10 192.168.10.1 8.8.8.8` to bind logic configurations.

### Workflow 2: Disaster Recovery Drills (Chaos Engineering)
1. Ensure your facility has dual utility feeds (Feed A / Feed B).
2. Open the global terminal.
3. Execute `dr-drill [site_id]`.
4. The terminal dispatches a `SIMULATION_CRITICAL` payload to the Web Worker.
5. The Web Worker deterministic loop forces a brown-out event on the specified feeds.
6. Check your Uninterruptible Power Supplies (UPS) and batteries to ensure your rack `PowerComponent` buffers correctly handled the blackout.

### Workflow 3: Incident Response (Ransomware)
1. Run `ransomware-drill`.
2. The Web Worker randomly selects a storage entity and forcibly mutates the `SecurityComponent` state to `infected`.
3. Utilize observability commands to identify the compromised node.
4. SSH into the compromised node.
5. Execute `isolate [node_id]` to blackhole the network traffic.
6. Execute `format [node_id]` to wipe the disk allocation and cleanse the entity.
