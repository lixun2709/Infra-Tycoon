# Changelog

## [v2.2.0] - 2026-05-25
### Added
- Comprehensive documentation synchronization for enterprise features.
- In-App Document Center mapping via AST.
- Dynamic rendering LOD based on camera zoom and active node count.

### Changed
- ECS Simulation moved to independent Web Worker for strictly deterministic lock-steps.
- React components refactored to consume Zustand store updates driven by Worker IPC.

### Fixed
- Fixed cascading thermal propagation where open slots did not accurately trigger bypass air leaks.
- Resolved 3-Phase power imbalance issue during rack rapid provisioning.
