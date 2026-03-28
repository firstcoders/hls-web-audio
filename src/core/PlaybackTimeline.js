import Timeframe from './Timeframe.js';

export default class PlaybackTimeline {
  #offset = 0;
  #playDuration;

  constructor(controller) {
    this.controller = controller; // Reference back to dispatcher context
    this.adjustedStart = undefined;
    this.timeframe = new Timeframe();
  }

  get audioDuration() {
    return this.controller.trackGroup.audioDuration;
  }

  set playDuration(duration) {
    if (duration && typeof duration !== 'number')
      throw new TypeError('The property "playDuration" must be of type number');
    this.#playDuration = duration;
    this.controller.notifyUpdated('playDuration', this.playDuration);
  }

  get playDuration() {
    return this.#playDuration || this.audioDuration;
  }

  set offset(offset = 0) {
    if (typeof offset !== 'number')
      throw new TypeError('The property "offset" must be of type number');
    this.#offset = offset;
    this.controller.notifyUpdated('offset', this.offset);
  }

  get offset() {
    return this.#offset;
  }

  setRegion(offset, playDuration) {
    if (typeof offset !== 'number')
      throw new TypeError('The property "offset" must be of type number');
    if (playDuration && typeof playDuration !== 'number')
      throw new TypeError('The property "playDuration" must be of type number');

    const offsetChanged = this.#offset !== offset;
    const durationChanged = this.#playDuration !== playDuration;

    this.#offset = offset;
    this.#playDuration = playDuration;

    // notify after both have been set, so they don't trigger intermediate incomplete bounds
    if (offsetChanged) this.controller.notifyUpdated('offset', this.#offset);
    if (durationChanged) this.controller.notifyUpdated('playDuration', this.playDuration);
  }

  get rawCurrentTime() {
    return this.adjustedStart !== undefined
      ? this.controller.ac.currentTime - this.adjustedStart
      : undefined;
  }

  get currentTime() {
    if (this.rawCurrentTime < this.offset) {
      this.fixAdjustedStart(this.offset);
    }
    if (this.controller.loop && this.rawCurrentTime >= this.offset + this.playDuration) {
      this.fixAdjustedStart(this.offset);
    }
    return this.rawCurrentTime;
  }

  setCurrentTime(t) {
    if (typeof this.audioDuration !== 'number' || t < 0 || t > this.audioDuration)
      throw new Error(`CurrentTime ${t} should be between 0 and duration ${this.audioDuration}`);

    let seekTo = t;
    if (seekTo < this.offset || seekTo > this.offset + this.playDuration) {
      seekTo = this.offset;
    }

    this.fixAdjustedStart(seekTo);

    this.controller.ac.suspend().then(() => {
      if (this.controller.desiredState === 'resumed' && !this.controller.engine.isBuffering) {
        this.controller.ac.resume();
      }
    });
  }

  get currentTimeframe() {
    return this.timeframe.update({
      adjustedStart: this.adjustedStart,
      adjustedEnd: this.adjustedEnd,
      currentTime: this.currentTime,
      playDuration: this.playDuration,
      offset: this.offset,
    });
  }

  fixAdjustedStart(t) {
    this.adjustedStart = this.controller.ac.currentTime - t;
    this.controller.fireEvent('seek', {
      t: this.rawCurrentTime,
      pct: this.rawCurrentTime / this.audioDuration,
      remaining: this.audioDuration - this.rawCurrentTime,
    });
  }

  set pct(n) {
    if (this.audioDuration) {
      let factor = n;
      if (factor < 0) factor = 0;
      if (factor > 1) factor = 1;
      this.setCurrentTime(factor * this.audioDuration);
    }
  }

  get pct() {
    return this.currentTime / this.audioDuration;
  }

  get remaining() {
    return this.audioDuration - this.currentTime;
  }

  get adjustedEnd() {
    return this.adjustedStart + this.offset + this.playDuration;
  }
}
