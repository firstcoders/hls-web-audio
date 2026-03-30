import Controller from '../core/AudioController.js';
import Stack from './Stack.js';
import TrackScheduler from './TrackScheduler.js';

/**
 * Base track implementation that binds a segment stack to a controller and scheduler.
 */
export default class Track {
  /**
   * @param {Object} param - The params
   * @param {Object} param.controller - The controller
   * @param {number} param.volume - The initial volume
   * @param {number} param.start - The start offset in seconds
   * @param {number} param.duration - Optional fixed duration override
   */
  constructor({ controller, volume = 1, start = 0, duration = undefined } = {}) {
    this.controller = controller || new Controller();
    this.controller.observe(this);

    this.eSeek = this.controller.on('seek', () => this.onSeek());
    this.eStart = this.controller.on('start', () => this.runSchedulePass());
    this.ePlayDuration = this.controller.on('playDuration', () => this.#reset());
    this.eOffset = this.controller.on('offset', () => this.#reset());

    this.gainNode = this.controller.ac.createGain();
    this.gainNode.connect(this.controller.gainNode);
    this.volume = volume;

    this.stack = new Stack({ start });
    this.scheduler = new TrackScheduler(this, this.stack);

    this.start = start;
    this.duration = duration;
  }

  /**
   * Sets the track start offset and notifies the controller.
   *
   * @param {number} start
   */
  set start(start) {
    this.stack.start = parseFloat(start);
    this.controller?.notify('start', this);
  }

  /**
   * Returns the track start offset.
   *
   * @returns {number}
   */
  get start() {
    return this.stack.start;
  }

  /**
   * Resets scheduling state after bounds changes.
   *
   * @private
   */
  #reset() {
    this.scheduler.reset();
    this.scheduler.runSchedulePass(this.controller.currentTimeframe, true);
  }

  /**
   * Releases all controller subscriptions, scheduling state, and audio nodes.
   */
  destroy() {
    this.cancel?.();
    this.scheduler?.reset();

    this.controller.unobserve(this);
    this.controller = null;

    this.eOffset.un();
    this.ePlayDuration.un();
    this.eStart.un();
    this.eSeek.un();

    this.stack.destroy();
    this.stack = null;

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
  }

  /**
   * Sets a fixed track duration override and notifies the controller.
   *
   * @param {number|undefined} duration
   */
  set duration(duration) {
    this.stack.duration = duration;
    this.controller?.notify('duration', this);
  }

  /**
   * Returns the configured track duration.
   *
   * @returns {number}
   */
  get duration() {
    return this.stack.duration;
  }

  /**
   * Returns the absolute end time for the track.
   *
   * @returns {number}
   */
  get end() {
    return this.stack.duration + this.stack.start;
  }

  /**
   * Returns whether the currently active segment is ready to play.
   *
   * @returns {boolean}
   */
  get canPlay() {
    const current = this.stack.getAt(this.controller.currentTime);
    return current?.isReady;
  }

  /**
   * Returns whether the current segment is either absent or ready to play.
   *
   * @returns {boolean}
   */
  get shouldAndCanPlay() {
    const current = this.stack.getAt(this.controller.currentTime);
    return !current || current?.isReady;
  }

  /**
   * Rebuilds scheduling state after a seek.
   *
   * @returns {Promise<void>}
   */
  async onSeek() {
    this.stack.disconnectAll(this.controller.currentTimeframe);
    this.scheduler.runSchedulePass(this.controller.currentTimeframe, true);
  }

  /**
   * Triggers a scheduling pass for the current playback timeframe.
   *
   * @param {boolean} force
   * @returns {Promise<void>}
   */
  async runSchedulePass(force) {
    return this.scheduler.runSchedulePass(this.controller.currentTimeframe, force);
  }

  /**
   * Returns the track gain value.
   *
   * @returns {number}
   */
  get volume() {
    return this.gainNode.gain.value;
  }

  /**
   * Sets the track gain value.
   *
   * @param {number} value
   */
  set volume(value) {
    this.gainNode.gain.value = value;
  }
}
