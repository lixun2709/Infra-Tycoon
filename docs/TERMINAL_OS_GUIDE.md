# Terminal Operating System Guide

Welcome to the Infra-Tycoon Enterprise Terminal Operating System.

## Architecture & Authority
The terminal is deeply integrated with the ECS engine. It is an authoritative tool, and commands execute synchronously or asynchronously depending on their impact on the infrastructure layout:

* **READ_ONLY**: Safe to execute anytime (e.g. `ping`, `ecs-stats`, `prom`). Returns contextual telemetry.
* **OPERATIONAL**: Standard management commands that mutate state synchronously (e.g. `hostname`, `ip setup`).
* **SIMULATION_CRITICAL**: Commands that affect power, cooling, or the physical structure. These dispatch via Web Worker to ensure ECS determinism (e.g. `poweron`, `pdu reset`, `format`, `dr-drill`).

## Mission Integration
Certain operations in the terminal (such as bootstrapping nodes via `poweron` or setting IP configurations via `ip setup`) feed directly into mission validation. You will need to use the terminal to clear progression blockages.

## Observability Toolkit
You can query Prometheus exporter outputs (`prom`), trace pipelines (`traces`), and view node properties directly from the console. The environment feels exactly like navigating real Enterprise management tools (similar to ESXi or Cisco NX-OS).

## Safety & Hardening
The shell runs without arbitrary script execution (`eval` is disabled). The `CommandRegistry` parses all incoming commands through strongly typed definitions to prevent race conditions during multiplayer sessions.

