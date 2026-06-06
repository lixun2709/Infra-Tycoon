# Infra-Tycoon User Guide

Welcome to the enterprise-grade datacenter operating environment.

## 1. Operating the Infrastructure Terminal
Unlike standard tycoon games, Infra-Tycoon requires you to explicitly configure your equipment via a realistic command-line interface. 

To open the terminal, click on the **Operations Console** tab when managing a Rack or Compute Node.
- Type `help` to list available commands.
- Use `man [topic]` to pull up the technical manual for specific infrastructure systems.

## 2. Establishing Connectivity
You cannot configure nodes if they are isolated. 
Ensure you have physically patched your Compute Nodes into a Top-Of-Rack (TOR) Leaf Switch. Only then will SSH command parsing become available over the Out-Of-Band (OOB) link.

## 3. Power Operations
Servers do not start automatically.
- Connect to the console of a specific node.
- Run `poweron`. 
- Monitor the resulting POST (Power-On Self-Test) logs. If the unit fails to boot, verify the Rack's PDU status via `pdu status`.

## 4. Addressing and Identification
A running server is useless without identity.
- Execute `hostname [name]` to provide DNS structure.
- Execute `ip setup [IP] [Gateway] [DNS]` to provision logical pathways.

## 5. NOC Operations Dashboard
The centralized NOC Operations Dashboard replaces fragmented systems (Service Desk, Facilities, Fleet) into a unified viewport. Use this panel to:
- Monitor global health and active incidents.
- Acknowledge alerts and review post-mortems.
- Audit infrastructure logs and telemetry.

## 6. Deprecation Notice
The experimental AI Subsystems (AI Assistant, generative workflows) have been removed. The simulator is now entirely focused on deterministic, hyperscaler infrastructure operations.

*Note: Proceeding through the objective missions will guide you through these exact workflows.*
