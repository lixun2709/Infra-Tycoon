# Changelog

### Added
- **Ransomware Microsegmentation**: Added `microsegmentationEnabled` and `isImmutable` backup rules to severely restrict malware lateral spread. Zero-Day exploits introduced.
- **VMware DRS CPU Overcommit**: Hypervisor now dynamically tracks vCPU overcommit against pCPUs. Ratios above 4:1 impose CPU Ready Time degradation penalties.
- **Storage vMotion (svMotion)**: DRS now actively evacuates VMs from datastores reaching 90% utilization.
- **Kubernetes Quorum Mechanics**: Losing etcd quorum (`cluster.masters.length < totalMasters / 2 + 1`) halts scheduling and evictions, forcing the control plane to read-only.
- **Kubernetes OOMKilled Simulation**: Pods now dynamically jitter memory usage; breaching `memoryLimit` immediately terminates the pod with `OOMKilled` status and applies crashloop backoffs.
- Comprehensive documentation synchronization for enterprise features.
- In-App Document Center mapping via AST.
- Dynamic rendering LOD based on camera zoom and active node count.

### Changed
- ECS Simulation moved to independent Web Worker for strictly deterministic lock-steps.
- React components refactored to consume Zustand store updates driven by Worker IPC.

### Fixed
- Fixed cascading thermal propagation where open slots did not accurately trigger bypass air leaks.
- Resolved 3-Phase power imbalance issue during rack rapid provisioning.
