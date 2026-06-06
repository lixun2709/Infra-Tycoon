/* eslint-disable @typescript-eslint/no-explicit-any */
import { config } from '../../utils/config'
import { EventBus } from '../events'
import { EventCategory, EventSeverity } from '../events/EventTypes'

interface OperationalContext {
  source: string
  entityId?: string
  correlationId?: string
  [key: string]: any
}

class TelemetryLogger {
  private currentLevelPriority: number

  private readonly LEVEL_PRIORITY: Record<EventSeverity, number> = {
    TRACE: 0,
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
    CRITICAL: 5
  }

  constructor() {
    const envLevel = (config.VITE_LOG_LEVEL?.toUpperCase() as EventSeverity) || 'INFO'
    this.currentLevelPriority = this.LEVEL_PRIORITY[envLevel] ?? 2
  }

  private shouldLog(level: EventSeverity): boolean {
    return this.LEVEL_PRIORITY[level] >= this.currentLevelPriority
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9)
  }

  public log(severity: EventSeverity, message: string, context: OperationalContext, error?: Error) {
    if (!this.shouldLog(severity)) return

    const event = {
      id: this.generateId(),
      timestamp: Date.now(),
      category: EventCategory.TELEMETRY,
      type: `LOG_${severity}`,
      source: context.source,
      severity,
      payload: {
        message,
        context,
        error: error ? { message: error.message, stack: error.stack } : undefined
      }
    }

    // Publish to the operational event bus for UI/Observability rendering
    EventBus.publish(event as any)

    // Fallback console logging for local dev
    this.printToConsole(severity, message, context, error)
  }

  private printToConsole(severity: EventSeverity, message: string, context: OperationalContext, error?: Error) {
    const ctxString = Object.keys(context).length > 1 ? ` | Ctx: ${JSON.stringify(context)}` : ''
    const formatted = `[${severity}] [${context.source}] ${message}${ctxString}`

    switch (severity) {
      case 'TRACE':
      case 'DEBUG':
        console.debug(formatted)
        break
      case 'INFO':
        console.info(formatted)
        break
      case 'WARN':
        console.warn(formatted)
        break
      case 'ERROR':
      case 'CRITICAL':
        console.error(formatted)
        if (error) console.error(error)
        break
    }
  }

  trace(source: string, message: string, context?: Omit<OperationalContext, 'source'>) {
    this.log('TRACE', message, { source, ...context })
  }

  debug(source: string, message: string, context?: Omit<OperationalContext, 'source'>) {
    this.log('DEBUG', message, { source, ...context })
  }

  info(source: string, message: string, context?: Omit<OperationalContext, 'source'>) {
    this.log('INFO', message, { source, ...context })
  }

  warn(source: string, message: string, context?: Omit<OperationalContext, 'source'>, error?: Error) {
    this.log('WARN', message, { source, ...context }, error)
  }

  error(source: string, message: string, context?: Omit<OperationalContext, 'source'>, error?: Error) {
    this.log('ERROR', message, { source, ...context }, error)
  }

  fatal(source: string, message: string, context?: Omit<OperationalContext, 'source'>, error?: Error) {
    this.log('CRITICAL', message, { source, ...context }, error)
  }
}

export const logger = new TelemetryLogger()
