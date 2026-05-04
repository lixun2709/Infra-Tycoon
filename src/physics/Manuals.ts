export const TECHNICAL_MANUALS: Record<string, string[]> = {
  terminal: [
    "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓",
    "┃  GLOBAL TERMINAL v1.3 - PROFESSIONAL EDITION         ┃",
    "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛",
    "",
    "POWER-USER SHORTCUTS:",
    "• [[YELLOW]][Ctrl+Shift+V][[RESET]] → Vertical Pane Split",
    "• [[YELLOW]][Ctrl+Shift+H][[RESET]] → Horizontal Pane Split",
    "• [[YELLOW]][Ctrl+L][[RESET]]       → Clear Active Pane",
    "• [[YELLOW]][Tab][[RESET]]          → Auto-Complete (Commands & IPs)",
    "",
    "ADVANCED SHELL SYNTAX:",
    "• PIPING:   [command] | grep [pattern] | tail | head",
    "• REDIRECT: [command] > [filename.txt]",
    "• VARS:     export KEY=VAL  →  Use via $KEY",
    "• WATCH:    watch [command] (Auto-refresh every 2s)",
    "• MONITOR:  [[GREEN]]top[[RESET]] (Live resource monitor)"
  ],
  show: [
    "--- COMMAND: show (Cisco Style) ---",
    "Usage: show ip int brief",
    "       show vlan brief",
    "",
    "DESCRIPTION:",
    "Displays network interface and VLAN status with color-coded health.",
    "[[GREEN]]up/active[[RESET]] = Operational",
    "[[RED]]down/suspended[[RESET]] = Fault Detected"
  ],
  cluster: [
    "--- COMMAND: cluster (ONTAP Style) ---",
    "Usage: cluster health show",
    "",
    "DESCRIPTION:",
    "Displays storage cluster node health and epsilon status."
  ],
  sla: [
    "--- COMMAND: sla (Rubrik Style) ---",
    "Usage: sla list",
    "",
    "DESCRIPTION:",
    "Lists all SLA domains and compliance status."
  ],
  ls: [
    "--- COMMAND: ls (Listing) ---",
    "Usage: ls -la",
    "",
    "COLORS:",
    "[[BLUE]]Blue[[RESET]]   = Directory",
    "[[GREEN]]Green[[RESET]]  = Configuration/Virtual File"
  ],
  alias: [
    "--- COMMAND: alias ---",
    "Usage: alias [name]='[command]'",
    "",
    "EXAMPLE:",
    "alias ll='ls -la'",
    "alias check='show ip int brief | grep up'"
  ],
  export: [
    "--- COMMAND: export ---",
    "Usage: export [NAME]=[VALUE]",
    "",
    "DESCRIPTION:",
    "Sets an environment variable accessible via $NAME.",
    "",
    "EXAMPLE:",
    "export DC_IP=10.0.0.50",
    "ssh $DC_IP"
  ],
  vserver: [
    "--- COMMAND: vserver (ONTAP) ---",
    "Usage: vserver show",
    "",
    "DESCRIPTION:",
    "Displays status of storage virtual machines (SVMs).",
    "Check Admin State and Root Volume status."
  ],
  protection_status: [
    "--- COMMAND: protection_status (Rubrik) ---",
    "Usage: protection_status --all",
    "",
    "DESCRIPTION:",
    "Displays SLA compliance and snapshot schedule for all managed objects."
  ],
  iptables: [
    "--- COMMAND: iptables (Security) ---",
    "Usage: iptables -L",
    "",
    "DESCRIPTION:",
    "Lists all active firewall rules on the current node.",
    "Used to verify port isolation and security policy."
  ],
  nmap: [
    "--- COMMAND: nmap (Security) ---",
    "Usage: nmap -v -A [IP]",
    "",
    "DESCRIPTION:",
    "Performs aggressive port scanning and OS detection.",
    "v1.3: Supports -v (verbose) and -A (aggressive) flags."
  ],
  watch: [
    "--- COMMAND: watch ---",
    "Usage: watch [command]",
    "",
    "DESCRIPTION:",
    "Executes the command repeatedly every 2 seconds.",
    "Ideal for monitoring interface status or storage growth."
  ],
  nano: [
    "--- COMMAND: nano ---",
    "Usage: nano [file]",
    "",
    "DESCRIPTION:",
    "Virtual file editor. v1.3 uses a simplified interface.",
    "To save new content, use: command > filename."
  ],
  ssh: [
    "--- COMMAND: ssh ---",
    "Usage: ssh [IP_Address]",
    "",
    "DESCRIPTION:",
    "Establish encrypted tunnel to infrastructure nodes.",
    "Works with environment variables ($TARGET_IP)."
  ],
  bootstrap: [
    "--- PROTOCOL: BOOTSTRAP (v1.3) ---",
    "1. scan console",
    "2. connect console [ID]",
    "3. ipmi set-ip [IP]",
    "4. exit",
    "5. ssh [IP]"
  ],
  identity: [
    "--- GUIDE: IDENTITY ---",
    "View local security principles via: cat /etc/passwd"
  ]
};
