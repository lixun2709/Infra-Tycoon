# Enterprise Architecture Documentation

## Core Philosophy
Infra-Tycoon is designed to simulate hyperscaler environments with thousands of interactive entities without compromising the 60 FPS presentation layer.

## ECS (Entity-Component-System)
The ECS architecture is localized in a dedicated Web Worker.
- **Entities**: Represents racks, servers, switches, CRACs.
- **Components**: Holds strictly typed data (Power, Thermal, Network, Storage).
- **Systems**: Iterate over components to apply state mutations per deterministic tick.

## Deterministic Simulation Flow
Ticks are processed uniformly. State is serialized and synchronized via Transferable ArrayBuffers to minimize structured cloning overhead between the worker and the main thread.

## Terminal Operating System (Command Authority)
The terminal subsystem uses an authoritative dispatch model built around a `CommandRegistry`.
- `READ_ONLY` and `OPERATIONAL` commands mutate presentation and logical string states synchronously in the UI.
- `SIMULATION_CRITICAL` commands (power state, security blackholing, network isolation) are dispatched directly into the `SimulationWorkerManager`.
By offloading these mutations to the Web Worker pipeline, the terminal guarantees perfect deterministic synchronization across all multiplayer clients without causing React re-render lockups.

## Rendering Pipeline
The main thread receives interpolated state buffers and applies them to a React Three Fiber scene, applying dynamic GPU Level of Detail (LOD) strategies to handle massive facilities.

## Thread Synchronization
A `SimulationCoordinator` acts as the IPC bridge, ensuring that commands from the UI (like procuring a new rack or running terminal simulations) are sequenced into the worker's queue without disrupting the tick loop.
