# Terminal Architecture Report

## Overview
The terminal subsystem has been fully decoupled from the UI component layer, transitioning from a monolithic, script-like `if/else` block into an authoritative dispatch model. This aligns the architecture with enterprise-grade shell environments like Cisco NX-OS and Kubernetes `kubectl`.

## Structural Changes
1. **CommandRegistry Class**: All terminal commands are now registered via a centralized `CommandRegistry`. This class acts as the single source of truth for parsing, validation, and execution routing.
2. **Contextual Dispatch**: Commands receive a heavily sanitized context, including safe accessors to `get()` and `set()` state, rather than mutating React state directly.
3. **Piping & Redirection**: Baseline architectural support for output manipulation has been hardened.

## Integration Boundaries
The UI no longer executes complex topological checks. When a command impacts the infrastructure, the command execution payload explicitly dispatches into the Web Worker's domain or through standard node lifecycle handlers. This establishes a clean divide between the presentation layer (Terminal UX) and the simulation layer (ECS Physics).
