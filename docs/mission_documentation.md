# Mission Integration Documentation

## The Mission Evaluator
Infra-Tycoon features an objective evaluator (stored in `src/physics/missionLibrary.ts`). It continuously scans the `InfraState` for objective thresholds. The Terminal OS directly influences this state loop.

## Mission 5: Infrastructure Operations OS
This mission explicitly bridges the UI click-and-drag environment with the authoritative terminal shell.

### Objectives:
1. **BMC Initialization**: Players must open a terminal pane connected to a target Compute Node via SSH and dispatch a `poweron` `TERMINAL_CMD`. The resulting Worker execution mutates the physical `systemState` to running, triggering the objective.
2. **Node Identity**: Players execute the `hostname` command, mutating the `InfraState` to populate the `hostname` string, completing the DNS validation phase.
3. **Network Bootstrap**: Players execute `ip setup`, provisioning the logical subnet routing values required by the third objective.

This loop guarantees players internalize real-world orchestration logic over decorative roleplay.
