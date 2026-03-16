export class CronLikeScheduler {
  constructor({ intervalMs, onTick, onError }) {
    this.intervalMs = intervalMs;
    this.onTick = onTick;
    this.onError = onError;
    this.timer = null;
    this.running = false;
    this.inFlight = false;
    this.tickId = 0;

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.running) {
        this.executeTick(true);
      }
    });
  }

  start() {
    if (this.running) {
      return;
    }
    this.running = true;
    this.executeTick(true);
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  scheduleNext() {
    if (!this.running) {
      return;
    }
    const now = Date.now();
    const nextBoundary = Math.ceil(now / this.intervalMs) * this.intervalMs;
    const delay = Math.max(50, nextBoundary - now);
    this.timer = setTimeout(() => this.executeTick(false), delay);
  }

  async executeTick(force = false) {
    if (!this.running) {
      return;
    }
    if (this.inFlight && !force) {
      this.scheduleNext();
      return;
    }

    this.inFlight = true;
    this.tickId += 1;
    const currentTick = this.tickId;

    try {
      await this.onTick(currentTick);
    } catch (error) {
      if (this.onError) {
        this.onError(error, currentTick);
      }
    } finally {
      this.inFlight = false;
      this.scheduleNext();
    }
  }
}
