import Controller from '../core/AudioController.js';
import Stack from './Stack.js';
import TrackScheduler from './TrackScheduler.js';

export default class Track {
  /**
   * @param {Object} param - The params
   * @param {Object} param.controller - The controller
   * @param {Object} param.volume - The initial volume
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

  set start(start) {
    this.stack.start = parseFloat(start);
    this.controller?.notify('start', this);
  }

  get start() {
    return this.stack.start;
  }

  #reset() {
    this.scheduler.reset();
    this.scheduler.runSchedulePass(this.controller.currentTimeframe, true);
  }

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

  set duration(duration) {
    this.stack.duration = duration;
    this.controller?.notify('duration', this);
  }

  get duration() {
    return this.stack.duration;
  }

  get end() {
    return this.stack.duration + this.stack.start;
  }

  get canPlay() {
    const current = this.stack.getAt(this.controller.currentTime);
    return current?.isReady;
  }

  get shouldAndCanPlay() {
    const current = this.stack.getAt(this.controller.currentTime);
    return !current || current?.isReady;
  }

  async onSeek() {
    this.stack.disconnectAll(this.controller.currentTimeframe);
    this.scheduler.runSchedulePass(this.controller.currentTimeframe, true);
  }

  async runSchedulePass(force) {
    return this.scheduler.runSchedulePass(this.controller.currentTimeframe, force);
  }

  get volume() {
    return this.gainNode.gain.value;
  }

  set volume(value) {
    this.gainNode.gain.value = value;
  }
}
