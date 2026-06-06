# CHANGELOG

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
