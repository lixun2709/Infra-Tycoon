import { globalEventBus } from '../events/EventBus';

export interface PerformanceMetrics {
  fps: number;
  tickTimeMs: number;
  entitiesCount: number;
  memoryUsageMB?: number;
}

export class Telemetry {
  private metrics: PerformanceMetrics = {
    fps: 0,
    tickTimeMs: 0,
    entitiesCount: 0
  };

  private lastFpsUpdate: number = 0;
  private framesSinceLastUpdate: number = 0;

  constructor() {
    globalEventBus.subscribe('tick', ({ dt }) => this.recordTick(dt));
  }

  private recordTick(dt: number) {
    this.framesSinceLastUpdate++;
    const now = performance.now();
    
    if (now - this.lastFpsUpdate >= 1000) {
      this.metrics.fps = (this.framesSinceLastUpdate * 1000) / (now - this.lastFpsUpdate);
      this.framesSinceLastUpdate = 0;
      this.lastFpsUpdate = now;
      
      // Update memory if available
      const perf = performance as unknown as { memory?: { usedJSHeapSize: number } };
      if (perf.memory) {
        this.metrics.memoryUsageMB = perf.memory.usedJSHeapSize / (1024 * 1024);
      }
      
      this.logMetrics();
    }
    
    this.metrics.tickTimeMs = dt;
  }

  public updateEntityCount(count: number) {
    this.metrics.entitiesCount = count;
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  private logMetrics() {
    // In a real app, this could send to an external service or a local buffer
    // console.debug('[Telemetry]', this.metrics);
  }
}

export const telemetry = new Telemetry();
