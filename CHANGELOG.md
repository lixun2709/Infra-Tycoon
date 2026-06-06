# CHANGELOG

## [v4.0.0] - Enterprise Stabilization & Optimization

### Added
- **Unified NOC Dashboard**: Centralized view for operations, observability, metrics, and incident response, eliminating disconnected menus.
- **Visual Consistency System**: Standardized glassmorphism (`glass-panel`), typography, and padding across all HUD elements.

### Changed
- **Web Worker Event Hardening**: Fixed worker initialization memory leaks and strengthened backpressure mechanisms to ensure stability under heavy load.
- **Renderer Performance**: Migrated to `lineSegments` and aggressive primitive Zustand selectors (`useShallow`) across the 3D pipeline, locking simulation framerates at 60 FPS even under heavy server-density scenarios.
- **Dashboard Navigation**: Streamlined contextual top navigation, directly syncing with the NOC tabs.

### Removed
- Unused AI Subsystems, Chat interfaces, and related UI components to refocus the project entirely on deterministic hyperscaler emulation.
- Fragmented individual dashboards (Service Desk, Facility, Fleet) in favor of the new unified NOC operations panel.
## [v3.0.0] - Infrastructure Operating System Evolution

### Added
- **CommandRegistry Framework**: Centralized parsing and safe dispatching of all terminal commands.
- **TERMINAL_CMD Payload System**: Web Worker interface for receiving deterministically structured terminal payloads directly from the UI.
- **Auto-Scrolling Terminal View**: Enhanced gameplay realism via automatic UX log tracking.
- **Mission 5: Infrastructure Operations OS**: New progression tier directly tied to successful node bootstrapping via the console.
- **Enterprise Emulation Docs**: Cisco/ESXi style operating documentation across operations, troubleshooting, and missions.

### Changed
- Re-architected `terminalLogic.ts` to strictly prevent direct ECS physics modifications from the React UI thread.
- `poweron`, `pdu reset`, `format`, `dr-drill`, and `ransomware-drill` now route completely asynchronously to the `SimulationWorkerManager`.
- Node boot conditions require correct utility feeds (A/B) from physical upstream models before returning operational status.

### Removed
- `eval` paths and unsafe node property injections in the terminal layer.
- Obsolete monolithic `handleCommand` if/else logic block.
