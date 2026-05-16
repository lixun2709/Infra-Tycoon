export type TickHandler = (dt: number, totalTime: number) => void;

export class SimulationLoop {
  private lastTime: number = 0;
  private totalTime: number = 0;
  private isRunning: boolean = false;
  private rafId: number | null = null;
  private fixedDeltaTime: number = 1000 / 60;
  private accumulator: number = 0;
  private onTick: TickHandler;

  constructor(onTick: TickHandler) {
    this.onTick = onTick;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop() {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private loop = (currentTime: number) => {
    if (!this.isRunning) return;

    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Clamp delta time to avoid spiral of death
    const clampedDelta = Math.min(deltaTime, 250);
    this.accumulator += clampedDelta;

    while (this.accumulator >= this.fixedDeltaTime) {
      this.onTick(this.fixedDeltaTime / 1000, this.totalTime / 1000);
      this.totalTime += this.fixedDeltaTime;
      this.accumulator -= this.fixedDeltaTime;
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  setTickRate(rate: number) {
    this.fixedDeltaTime = 1000 / rate;
  }
}
