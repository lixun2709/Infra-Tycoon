import type { TraceSpan } from './types'

export class ObservabilityTracer {
  private static MAX_SPANS = 100
  // Pre-allocated ring buffer
  private static spans: TraceSpan[] = new Array(ObservabilityTracer.MAX_SPANS).fill(null).map(() => ({
    traceId: 0,
    spanId: 0,
    name: '',
    timestamp: 0,
    status: 'running'
  }))
  private static tailIndex = 0

  private static activeSpans = new Map<number, TraceSpan>()
  private static nextId = 1

  /**
   * Generates a deterministic sequence integer.
   */
  private static generateId(): number {
    return this.nextId++
  }

  /**
   * Starts a new transaction span.
   */
  public static startSpan(name: string, parentSpanId?: number, metadata?: Record<string, unknown>): number {
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
   * Ends a running transaction span and moves it into the rolling ring buffer without allocating arrays.
   */
  public static endSpan(spanId: number, status: 'success' | 'failed', metadata?: Record<string, unknown>): void {
    const activeSpan = this.activeSpans.get(spanId)
    if (!activeSpan) return

    activeSpan.durationMs = Date.now() - activeSpan.timestamp
    activeSpan.status = status
    if (metadata) {
      activeSpan.metadata = { ...activeSpan.metadata, ...metadata }
    }

    this.activeSpans.delete(spanId)

    // Write to pre-allocated ring buffer
    const slot = this.spans[this.tailIndex]
    if (slot) {
      slot.traceId = activeSpan.traceId
      slot.spanId = activeSpan.spanId
      slot.parentSpanId = activeSpan.parentSpanId
      slot.name = activeSpan.name
      slot.timestamp = activeSpan.timestamp
      slot.durationMs = activeSpan.durationMs
      slot.status = activeSpan.status
      slot.metadata = activeSpan.metadata
    }

    this.tailIndex = (this.tailIndex + 1) % this.MAX_SPANS
  }

  /**
   * Retrieves all completed trace spans from the circular ring-buffer.
   */
  public static getSpans(): TraceSpan[] {
    // Return sorted by chronological order (oldest to newest)
    const result: TraceSpan[] = []
    for (let i = 0; i < this.MAX_SPANS; i++) {
      const idx = (this.tailIndex + i) % this.MAX_SPANS
      const span = this.spans[idx]
      if (span && span.spanId !== 0) {
        result.push({ 
          traceId: span.traceId,
          spanId: span.spanId,
          parentSpanId: span.parentSpanId,
          name: span.name,
          timestamp: span.timestamp,
          durationMs: span.durationMs,
          status: span.status,
          metadata: span.metadata
        } as TraceSpan)
      }
    }
    return result
  }

  /**
   * Clears the trace buffer state.
   */
  public static clear(): void {
    this.activeSpans.clear()
    this.nextId = 1
    this.tailIndex = 0
    for (let i = 0; i < this.MAX_SPANS; i++) {
      if (this.spans[i]) {
        this.spans[i]!.spanId = 0
      }
    }
  }
}
