# Changelog

### Added
- **SLA Violation Penalties**: Automatic penalty calculation and payout deductions when uptime drops below contract target SLA.
- **Ransomware Drills & Formatting**: Node infection propagation mechanics with `ransomware-drill` simulation command, paired with `format [node_id]` functionality.
- **Node Isolation & Terminal Extension**: `isolate [node_id]` and `format [node_id]` commands added to bootstrap kernel, preventing lateral movement of zero-day exploits.
- **DR Drills (RPO Validation)**: DR Drills now strictly evaluate Recovery Point Objectives (RPO). Storage split-brain scenarios are automatically detected if replication is broken during isolation events.
- **Ticketing Priority Queue**: `TicketingSystem` now supports P1-P4 SLA priorities. Emergency tickets override queue limits to ensure critical systems recover rapidly.
- **Incident Root Cause Analysis**: Replaced naive anomaly detection with intelligent clustering. Mass failures are traced to a single root cause (e.g., Rack Power Overload) preventing alert fatigue.
- **Ransomware Microsegmentation**: Added `microsegmentationEnabled` and `isImmutable` backup rules to severely restrict malware lateral spread. Zero-Day exploits introduced.
- **VMware DRS CPU Overcommit**: Hypervisor now dynamically tracks vCPU overcommit against pCPUs. Ratios above 4:1 impose CPU Ready Time degradation penalties.
- **Storage vMotion (svMotion)**: DRS now actively evacuates VMs from datastores reaching 90% utilization.
- **Kubernetes Quorum Mechanics**: Losing etcd quorum (`cluster.masters.length < totalMasters / 2 + 1`) halts scheduling and evictions, forcing the control plane to read-only.
- **Kubernetes OOMKilled Simulation**: Pods now dynamically jitter memory usage; breaching `memoryLimit` immediately terminates the pod with `OOMKilled` status and applies crashloop backoffs.
- **Enterprise Testing Coverage**: Extensive unit tests built for `HypervisorSystem`, `KubernetesSystem`, and `IncidentSystem` to validate deterministic DRS, Quorum handling, and RPO/RTO validation.
- Comprehensive documentation synchronization for enterprise features.
- In-App Document Center mapping via AST.
- Dynamic rendering LOD based on camera zoom and active node count.

### Changed
- ECS Simulation moved to independent Web Worker for strictly deterministic lock-steps.
- React components refactored to consume Zustand store updates driven by Worker IPC.

### Fixed
- Fixed cascading thermal propagation where open slots did not accurately trigger bypass air leaks.
- Resolved 3-Phase power imbalance issue during rack rapid provisioning.
