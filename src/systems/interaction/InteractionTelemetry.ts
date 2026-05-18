import { useInfraStore } from '../../store/useInfraStore'

export class InteractionTelemetry {
  public static MAX_LOGS_LIMIT = 50

  /**
   * Returns all current interaction logs from the circular ring buffer.
   */
  public static getLogs(): string[] {
    return useInfraStore.getState().interactionLogs
  }

  /**
   * Logs a new interaction event, strictly enforcing circular ring buffer bounds.
   */
  public static logAction(event: string): void {
    const store = useInfraStore.getState()
    const newLogs = [...store.interactionLogs, event]
    if (newLogs.length > InteractionTelemetry.MAX_LOGS_LIMIT) {
      newLogs.shift()
    }
    useInfraStore.setState({ interactionLogs: newLogs })
  }

  /**
   * Clears the telemetry log state inside the store.
   */
  public static clearLogs(): void {
    useInfraStore.setState({ interactionLogs: [] })
  }

  /**
   * Computes simple analytics: total actions in the ring buffer.
   */
  public static getActionCount(): number {
    return useInfraStore.getState().interactionLogs.length
  }

  /**
   * Returns a structured telemetry JSON payload for multiplayer audit logs.
   */
  public static serializeTelemetry(): string {
    const state = useInfraStore.getState()
    return JSON.stringify({
      mode: state.interactionMode,
      activeHoverNodeId: state.activeHoverNodeId,
      activeHoverType: state.activeHoverType,
      logCount: state.interactionLogs.length,
      timestamp: Date.now()
    })
  }
}
