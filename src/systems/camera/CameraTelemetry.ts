export interface CameraTelemetryEvent {
  timestamp: number
  eventType: 'mode_change' | 'focus_node' | 'panning' | 'reset' | 'spectator_sync'
  message: string
  details?: Record<string, unknown>
}

class CameraTelemetry {
  private logBuffer: CameraTelemetryEvent[] = []
  private readonly maxBufferSize = 200

  public log(
    eventType: CameraTelemetryEvent['eventType'],
    message: string,
    details?: Record<string, unknown>
  ): void {
    const event: CameraTelemetryEvent = {
      timestamp: Date.now(),
      eventType,
      message,
      details
    }

    this.logBuffer.push(event)
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift() // Maintain ring buffer size limits
    }

    // Console logging in dev environment for NOC realism and diagnostics
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      // Intentional silencer: telemetry logic previously lived here
    }
  }

  public getLogs(): CameraTelemetryEvent[] {
    return [...this.logBuffer]
  }

  public clearLogs(): void {
    this.logBuffer = []
  }
}

export const cameraTelemetry = new CameraTelemetry()
