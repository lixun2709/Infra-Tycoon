# Performance Report

## UI Thread Latency
The terminal rewrite yielded massive performance improvements for the main React thread. By migrating `if/else` evaluations to O(1) hash map lookups in `CommandRegistry`, command dispatch time is virtually zero.

## Physics Thread Offloading
Historically, the terminal calculated massive topological assertions synchronously. By dispatching `TERMINAL_CMD` messages, the heavy-lifting of component updates is offloaded to the ECS Web Worker, freeing up the UI thread entirely and maintaining a smooth 60 FPS rendering target even when executing sweeping commands like `format` or `ransomware-drill` against hundreds of nodes.

## Memory Management
Strict clipping on `logs` and `history` boundaries guarantees terminal component memory stays bounded, passing all regression tests for memory leakage during long-lived application sessions.
