# Terminal Operations Platform

## Overview
The terminal operates as the central nervous system for manual infrastructure interactions. It is not an emulated Linux box, but rather an authoritative Operational Shell acting as a unified API over the datacenter control plane.

## Session Management
- **Global Context**: By default, the terminal operates in a global execution context.
- **Node Context**: Executing `connect console [node_id]` or clicking the Terminal UI from a node's inspect panel shifts the context to `ssh`.
- **Exiting**: Type `exit` to detach the current session context and drop back to global, or close the active pane entirely.

## Input Parsing
The shell supports basic input modifications:
- `$VAR` variable substitutions.
- Command aliases configured in the terminal state map.
- Implicit argument chunking (splitting strictly on whitespace).

## UX Integrity
A forced auto-scroll mechanism is active on all panes to maintain a seamless log-tailing experience during high-volume feedback streams (like POST booting or traceroutes).
