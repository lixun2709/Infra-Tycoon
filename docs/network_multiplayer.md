# Network & Multiplayer Architecture

## Current State
The project currently implements a highly robust local deterministic simulation using an Entity-Component-System (ECS) running inside a Web Worker. 
While "true" networked multiplayer (client-server) is not fully exposed to the user layer yet, the foundation is completely designed for it.

## Simulation Decoupling
Because the game runs its ticks at a strict interval and separates presentation (React/Three.js) from simulation (Worker ECS), integrating a WebSocket or WebRTC data channel involves syncing input events rather than full state replication. 

## Determinism
By executing all logic deterministically, clients only need to send actions (e.g. `DEPLOY_RACK`, `POWER_ON`). Both clients will resolve the same tick independently.

## Future Path
- Incorporate WebRTC for P2P connection.
- Implement Rollback Netcode to manage high-latency scenarios.
- Sync the `Zustand` store based on authoritative packets from the host.
