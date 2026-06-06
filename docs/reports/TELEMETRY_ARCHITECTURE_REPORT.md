# Telemetry Architecture Report
Ad-hoc console.log instances have been superseded by a dedicated Telemetry Logger (src/core/telemetry/Logger.ts). The logger maps directly to the Event Bus, tagging all output with operational context, source IDs, and severity levels (TRACE, INFO, WARN, FATAL) mirroring SRE standard practices.
