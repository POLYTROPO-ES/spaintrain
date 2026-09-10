export class CronLikeScheduler {
  constructor({ intervalMs, onTick, onError }) {
    this.intervalMs = intervalMs;
    this.onTick = onTick;
    this.onError = onError;
    this.timer = null;
    this.running = false;
    this.inFlight = false;
    this.tickId = 0;
    this.pendingRefresh = false;
    this.hidden = document.hidden;

    document.addEventListener('visibilitychange', () => {
      const wasHidden = this.hidden;
      this.hidden = document.hidden;
      if (this.hidden) {
        this.clearTimer();
        this.pendingRefresh = false;
      } else if (wasHidden && this.running) {
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
    this.pendingRefresh = false;
    this.clearTimer();
  }

  clearTimer() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  scheduleNext() {
    this.clearTimer();
    if (!this.running || document.hidden || this.inFlight) {
      return;
    }
    const now = Date.now();
    const nextBoundary = (Math.floor(now / this.intervalMs) + 1) * this.intervalMs;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.executeTick(false);
    }, nextBoundary - now);
  }

  async executeTick(force = false) {
    this.clearTimer();
    if (!this.running || document.hidden) {
      return;
    }
    if (this.inFlight) {
      // Settings changes and visibility resumes share one deferred refresh.
      this.pendingRefresh ||= force;
      return;
    }

    this.pendingRefresh = false;
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
      if (this.pendingRefresh && this.running && !document.hidden) {
        this.executeTick(true);
      } else {
        this.pendingRefresh = false;
        this.scheduleNext();
      }
    }
  }
}
