# SDDC Orchestrator (Infra-Tycoon)

SDDC Orchestrator is a highly realistic enterprise-grade hyperscaler operations simulator. Build, scale, and manage a sprawling Software-Defined Data Center (SDDC) from the ground up.

## Key Features

- **Authoritative Infrastructure Shell**: A fully functional pseudo-kernel terminal allowing you to execute commands to manage your fleet, network interfaces, power states, and DNS configurations.
- **Enterprise-Grade Observability**: Complete NOC Operations Dashboard providing full visibility into telemetry, logs, diagnostics, and event streams.
- **Deterministic Simulation**: Real-time simulation of power draw, cooling BTUs, bandwidth, latency, and hardware health over time using a high-performance ECS (Entity Component System) architecture.
- **Advanced Network Topologies**: Realistically simulate Layer 2 / Layer 3 protocols, DHCP assignments, DNS resolution, and physical cabling constraints.
- **Multi-Cloud Bursting**: Scale beyond on-premises infrastructure using cloud providers to absorb workload spikes dynamically.

## Tech Stack

- **React 18** + **TypeScript**
- **Vite** for fast, optimized builds
- **Zustand** for complex, highly optimized state management (`useShallow` enforced for performance)
- **Framer Motion** for micro-animations and seamless UI transitions
- **Three.js / React Three Fiber** for immersive, performant 3D rack visualization

## Running the Simulator

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Development & Best Practices

- **Strict TypeScript**: This project strictly enforces `noImplicitAny` and avoids runtime type failures.
- **ECS-Compatible**: When adding new mechanics, keep state deterministic by relying on `SimulationEngine` and worker-compatible patterns.
- **UX Consistency**: We utilize standard UI primitives (`Card`, `Modal`, `Badge`) to maintain the "glass-panel" enterprise operating system aesthetic. Avoid hardcoded styles where standard tokens can be used.

## License
Proprietary (Internal Use Only)
