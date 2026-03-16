export class PlaybackPlayer {
  constructor() {
    this.snapshots = [];
    this.index = 0;
    this.timer = null;
    this.speed = 1;
    this.onFrame = null;
    this.onState = null;
  }

  loadSnapshots(snapshots) {
    this.snapshots = snapshots;
    this.index = 0;
    this.emitState();
  }

  setSpeed(speed) {
    this.speed = speed;
    this.emitState();
  }

  play() {
    if (this.timer || this.snapshots.length < 2) {
      return;
    }

    const baseStepMs = 1000;
    this.timer = setInterval(() => {
      this.index += 1;
      if (this.index >= this.snapshots.length) {
        this.pause();
        this.index = this.snapshots.length - 1;
      }
      this.emitFrame();
      this.emitState();
    }, Math.max(50, baseStepMs / this.speed));

    this.emitState();
  }

  pause() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.emitState();
  }

  seek(index) {
    if (!this.snapshots.length) {
      return;
    }
    this.index = Math.max(0, Math.min(index, this.snapshots.length - 1));
    this.emitFrame();
    this.emitState();
  }

  emitFrame() {
    if (this.onFrame && this.snapshots[this.index]) {
      this.onFrame(this.snapshots[this.index]);
    }
  }

  emitState() {
    if (this.onState) {
      this.onState({
        hasData: this.snapshots.length > 0,
        isPlaying: Boolean(this.timer),
        index: this.index,
        total: this.snapshots.length,
        speed: this.speed,
      });
    }
  }
}
