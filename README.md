# Infra-Tycoon (SDDC Orchestrator)

## The Vision & Goal

**Infra-Tycoon** is a deeply interconnected, enterprise-grade hyperscaler operations simulator. It is designed from the ground up to reflect the true operational realism, infrastructure authenticity, and strategic complexity of managing large-scale data centers and software-defined data center (SDDC) fabrics.

**What this project IS:**
- A high-fidelity, deterministic simulation of enterprise datacenter architecture.
- A strategic operations simulator enforcing physical laws (power constraints, thermal runaway, bandwidth limitations, latency).
- A unified control plane featuring a Network Operations Center (NOC) dashboard and an authoritative Global Kernel Shell (Terminal OS).
- A scalable, worker-thread compatible Entity-Component-System (ECS) architecture built for deterministic multiplayer-ready state.

**What this project IS NOT:**
- A casual sandbox.
- A generic, clicker-based "tycoon" game.
- A purely decorative frontend viewer with fake complexity.
- A disconnected collection of mechanics without physical or logical consequences.

## Core Pillars & Architecture

1. **Enterprise Infrastructure Simulation**
   - **Physics & Facilities:** Realistic modeling of thermal zones, BTU outputs, power redundancy (A/B feeds), and cooling systems.
   - **Network Fabric:** Granular Layer 2 / Layer 3 modeling with patch panels, VLANs, subnet orchestration (DHCP/DNS/NTP), and simulated ICMP limits.
   - **Hardware Lifecycle:** Asset tracking, degradation, and MTBF (Mean Time Between Failures) modeling across racks, blades, and network appliances.

2. **Terminal Operating System (Global Kernel Shell)**
   - Designed to mimic enterprise CLI experiences (similar to `kubectl` or `virsh`).
   - Deeply integrated into the simulation state—commands directly manipulate the global infrastructure, manage deployments, and observe real-time telemetry.

3. **NOC Operations Dashboard**
   - A true "Single Pane of Glass" integrating Fleet Management, Facility Telemetry, Observability, Ticketing (ITSM), and Alerts into a unified control layer.
   - Features real-time sparklines, system metrics, and ECS timing profiles.

4. **Technical Foundation**
   - **Framework:** React + Vite
   - **Language:** Strict TypeScript (no `any` fallbacks, strict type checking)
   - **State Management:** Zustand with advanced slice-based modularity, middleware persistence, and `useShallow` render optimization.
   - **Rendering:** High-performance 3D visualization using Three.js (via React Three Fiber), utilizing BufferGeometry and LineSegments for rendering thousands of U-slots with single-digit draw calls.
   - **Simulation Engine:** Deterministic tick-based ECS engine designed for worker-thread offloading and massive scale.

## Coding Guidelines & Governance

- **Strict TypeScript Only:** No unused imports, no dead code, and absolute type safety.
- **Scalable Architecture:** Modular design prioritizing composition over inheritance, decoupled systems, and clean abstractions.
- **Performance First:** Aggressive optimization of React rerenders using granular state selection and memoization.
- **Independent Subsystems:** Networking, Simulation, and Rendering are entirely decoupled, adhering to enterprise architecture standards.

## Getting Started

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Build for production
npm run build
```
