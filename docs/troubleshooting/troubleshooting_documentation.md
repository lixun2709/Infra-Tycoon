# Troubleshooting Documentation

When your servers are not performing, turn to the terminal.

## "Node is logically powered down"
* **Diagnosis**: You tried to assign an IP or hostname to a node that has not completed POST.
* **Resolution**: Run `poweron`. You cannot configure an OS if the hardware isn't powered.

## "No Serial/OOB connection to [node_id]"
* **Diagnosis**: The Terminal context attempted an SSH session into a node, but the ECS network path validation failed.
* **Resolution**: Go to the Cabling interface. Verify you have physically connected the target server to a Switch device. Out-of-Band management requires an intact topological layer.

## "Unique Hostname not set"
* **Diagnosis**: The server booted successfully, but you attempted to apply logical network configurations without a fully qualified domain identity.
* **Resolution**: Execute `hostname [name]`. The command will block if you attempt to use a name already active on the subnet.
