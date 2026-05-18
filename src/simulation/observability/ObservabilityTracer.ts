import type { TraceSpan } from './types'

export class ObservabilityTracer {
  private static MAX_SPANS = 100
  private static spans: TraceSpan[] = []

  private static activeSpans = new Map<string, TraceSpan>()

  /**
   * Generates a simple UUID-like random identifier.
   */
  private static generateId(): string {
    return Math.random().toString(36).substring(2, 11)
  }

  /**
   * Starts a new transaction span.
   */
  public static startSpan(name: string, parentSpanId?: string, metadata?: Record<string, unknown>): string {
    const spanId = this.generateId()
    const traceId = parentSpanId 
      ? (this.activeSpans.get(parentSpanId)?.traceId || this.generateId())
      : this.generateId()

    const span: TraceSpan = {
      traceId,
      spanId,
      parentSpanId,
      name,
      timestamp: Date.now(),
      status: 'running',
      metadata
    }

    this.activeSpans.set(spanId, span)
    return spanId
  }

  /**
   * Ends a running transaction span and shifts older logs into the rolling ring buffer.
   */
  public static endSpan(spanId: string, status: 'success' | 'failed', metadata?: Record<string, unknown>): void {
    const span = this.activeSpans.get(spanId)
    if (!span) return

    span.durationMs = Date.now() - span.timestamp
    span.status = status
    if (metadata) {
      span.metadata = { ...span.metadata, ...metadata }
    }

    this.activeSpans.delete(spanId)

    // Append to rolling log buffer
    this.spans.push(span)
    if (this.spans.length > this.MAX_SPANS) {
      this.spans.shift()
    }
  }

  /**
   * Retrieves all completed trace spans from the circular ring-buffer.
   */
  public static getSpans(): TraceSpan[] {
    return [...this.spans]
  }

  /**
   * Clears the trace buffer state.
   */
  public static clear(): void {
    this.spans = []
    this.activeSpans.clear()
  }
}
