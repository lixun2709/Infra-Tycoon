# Command Authority Report

## Authority Classification Model
Every command registered in the `CommandRegistry` must now explicitly declare an authority tier. This ensures commands cannot unexpectedly bypass synchronization boundaries.

### 1. READ_ONLY
* **Scope**: Monitoring, observability, diagnostics, and data inspection.
* **Examples**: `ping`, `ls`, `cat`, `ecs-stats`, `prom`, `traces`, `alert`, `pwd`, `show ip brief`
* **Impact**: Safe. Executes entirely within the UI thread using synchronous reads of the Zustand store.

### 2. OPERATIONAL
* **Scope**: Standard management procedures that affect logical configurations but not physical simulation determinism.
* **Examples**: `hostname`, `ip setup`, `export`
* **Impact**: Mutates logical attributes on node entities (e.g., DNS, hostname strings, routing rules) which sync instantly across multiplayer peers.

### 3. SIMULATION_CRITICAL
* **Scope**: Commands that mutate physical infrastructure, power draw, cooling loads, or trigger security events.
* **Examples**: `poweron`, `pdu reset`, `isolate`, `format`, `dr-drill`, `ransomware-drill`
* **Impact**: Dispatched to the Web Worker via `TERMINAL_CMD` payloads. Modifies ECS components (PowerComponent, StorageComponent, SecurityComponent) within the physics tick to ensure 100% deterministic evaluation.
