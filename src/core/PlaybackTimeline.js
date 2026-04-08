import Timeframe from './Timeframe.js';

/**
 * Tracks playback bounds, seek state, and the mapping between audio context time and track time.
 */
export default class PlaybackTimeline {
  #offset = 0;
  #playDuration;

  /**
   * @param {import('./AudioController.js').default} controller
   */
  constructor(controller) {
    this.controller = controller; // Reference back to dispatcher context
    this.timeframe = new Timeframe();
  }

  /**
   * @returns {number|undefined}
   */
  get anchor() {
    return this.timeframe.anchor;
  }

  /**
   * @param {number|undefined} v
   */
  set anchor(v) {
    this.timeframe.anchor = v;
  }

  /**
   * @returns {number|undefined}
   */
  get audioDuration() {
    return this.controller.trackGroup.audioDuration;
  }

  /**
   * Sets the active play duration bound and notifies listeners.
   *
   * @param {number|undefined} duration
   */
  set playDuration(duration) {
    if (duration && typeof duration !== 'number')
      throw new TypeError('The property "playDuration" must be of type number');
    this.#playDuration = duration;
    this.controller.notifyUpdated('playDuration', this.playDuration);
  }

  /**
   * @returns {number|undefined}
   */
  get playDuration() {
    return this.#playDuration || this.audioDuration;
  }

  /**
   * Sets the playback offset and notifies listeners.
   *
   * @param {number} offset
   */
  set offset(offset = 0) {
    if (typeof offset !== 'number')
      throw new TypeError('The property "offset" must be of type number');
    this.#offset = offset;
    this.controller.notifyUpdated('offset', this.offset);
  }

  /**
   * @returns {number}
   */
  get offset() {
    return this.#offset;
  }

  /**
   * Updates offset and duration together to avoid intermediate invalid bounds.
   *
   * @param {number} offset
   * @param {number|undefined} playDuration
   */
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

  /**
   * Returns current track time without any boundary adjustments.
   *
   * @returns {number|undefined}
   */
  get rawCurrentTime() {
    return this.anchor !== undefined ? this.controller.ac.currentTime - this.anchor : undefined;
  }

  /**
   * Returns the current track time.
   *
   * @returns {number|undefined}
   */
  get currentTime() {
    return this.rawCurrentTime;
  }

  /**
   * Seeks to a track time and reanchors the playback timeframe.
   *
   * @param {number} t
   */
  setCurrentTime(t) {
    if (typeof this.audioDuration !== 'number' || t < 0 || t > this.audioDuration)
      throw new Error(`CurrentTime ${t} should be between 0 and duration ${this.audioDuration}`);

    let seekTo = t;
    if (seekTo < this.offset || seekTo > this.offset + this.playDuration) {
      seekTo = this.offset;
    }

    this.fixAnchor(seekTo);

    this.controller.ac.suspend().then(() => {
      if (this.controller.desiredState === 'resumed' && !this.controller.engine.isBuffering) {
        this.controller.ac.resume();
      }
    });
  }

  /**
   * Builds the current timeframe snapshot used by the scheduler.
   *
   * @returns {Timeframe}
   */
  get currentTimeframe() {
    return this.timeframe.update({
      anchor: this.anchor,
      realEnd: this.realEnd,
      currentTime: this.currentTime,
      playDuration: this.playDuration,
      offset: this.offset,
    });
  }

  /**
   * Reanchors the track timeline to the given track time.
   *
   * @param {number} t
   */
  fixAnchor(t) {
    this.timeframe.setAnchor(this.controller.ac.currentTime, t);

    this.controller.fireEvent('seek', {
      t,
      pct: t / this.audioDuration,
      remaining: this.audioDuration - t,
    });
  }

  /**
   * Sets current time as a fraction of the audio duration.
   *
   * @param {number} n
   */
  set pct(n) {
    if (this.audioDuration) {
      let factor = n;
      if (factor < 0) factor = 0;
      if (factor > 1) factor = 1;
      this.setCurrentTime(factor * this.audioDuration);
    }
  }

  /**
   * @returns {number}
   */
  get pct() {
    return this.currentTime / this.audioDuration;
  }

  /**
   * @returns {number}
   */
  get remaining() {
    return this.audioDuration - this.currentTime;
  }

  /**
   * @returns {number}
   */
  get realEnd() {
    return this.anchor + this.offset + this.playDuration;
  }
}
