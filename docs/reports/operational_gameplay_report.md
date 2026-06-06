# Operational Gameplay Report

## Philosophy
The terminal is no longer a decorative side-feature. It is a mandatory, deeply integrated tool for managing infrastructure in Infra-Tycoon.

## Mission Integration
We have successfully integrated command evaluations directly into the game's progression framework.
* **Mission 5: Infrastructure Operations OS**: A dedicated mission path has been added requiring the player to successfully bootstrap a compute node exclusively via the terminal.
* **Validation**: The objective evaluator scans the `InfraState` for nodes that have reached a `running` status with properly configured `hostname` and `managementIP` fields resulting from direct terminal inputs.

## Troubleshooting Workflows
Players encountering topological failures (e.g., a node failing to power on) must use the terminal's native error output (which now correctly reports `SYSTEM ERROR: Node is logically powered down` or `BOOT ERROR: Unique Hostname not set`) to understand infrastructure prerequisites. This naturally teaches real operational thinking without forced tutorials.
