# Backend & Service Boundary Strategy

## Overview
This document outlines the architectural boundaries between the client-side rendering/UI, the core simulation logic, and the future authoritative backend services for Infra-Tycoon. It is designed to ensure multiplayer scalability, cheat prevention, and decoupled scaling.

## Current State (Monolithic Client)
Currently, Infra-Tycoon runs entirely in the browser:
- **Simulation**: Ticks run on the main browser thread or a single Web Worker.
- **State**: Zustand monolithic store (`useInfraStore`) holds all state (gameplay, rendering, telemetry).
- **Persistence**: LocalStorage handles saves.

## Target Architecture (Decoupled Services)
To support large-scale datacenter simulation and multiplayer functionality, the architecture must transition to a service-oriented model.

### 1. The Simulation Authority Boundary
The authoritative state of the datacenter (power grids, thermal output, network topology) MUST reside on the backend.
- **Client Role**: The client becomes a "dumb" viewer and intent dispatcher. It predicts state changes for smooth UX but reconciles with the server.
- **Server Role**: The server runs the ECS (Entity Component System) simulation tick.

### 2. Proposed Service Decomposition
The backend will be split into the following modular services:

#### a. Simulation Engine Service (ECS)
- **Responsibility**: Calculates power, thermals, and network propagation.
- **Characteristics**: High CPU usage, deterministic ticks, worker-compatible.
- **Communication**: WebSockets for real-time tick broadcasts.

#### b. Gameplay & Persistence Service
- **Responsibility**: Manages player balance, reputation, contracts, and persistence (saving/loading).
- **Characteristics**: Transactional (ACID compliant).
- **Communication**: REST / gRPC API.

#### c. Telemetry & Observability Pipeline
- **Responsibility**: Aggregates metrics from simulated racks and networks.
- **Characteristics**: High write throughput, structured logging.
- **Technology**: OpenTelemetry exporter, time-series database (e.g., Prometheus/InfluxDB).

### 3. Transition Plan
1. **Phase A (Current)**: Refactor client state to separate `gameplay`, `rendering`, and `telemetry`. Introduce Web Workers for simulation to prepare the codebase for server migration.
2. **Phase B**: Implement a mock backend using a local Node.js process. Move the Web Worker logic into this local process.
3. **Phase C**: Deploy the mock backend as a cloud service. Introduce WebSockets for state synchronization.
4. **Phase D**: Scale out the Simulation Engine service using a distributed orchestrator (e.g., Kubernetes or Agones).

## Terminal Operational Authority
Commands executed in the in-game Terminal must be validated against authority levels:
- `LEVEL_1` (Guest/Observer): Read-only commands (`ping`, `top`, `status`).
- `LEVEL_2` (Operator): Safe mutations (`reboot`, `restart-service`).
- `LEVEL_3` (Admin): Critical infrastructure changes (`format`, `reconfigure-network`).

*The backend will reject any command payload that exceeds the player's current authenticated authority level.*
