import Observer from './Observer.js';
import AudioContext from '../lib/AudioContext.js';
import { fadeIn, fadeOut } from '../lib/fade.js';
import isIOS from '../lib/isIOS.js';
import unmuteAudioContext from '../lib/unmuteAudioContext.js';
import TrackGroup from './TrackGroup.js';
import PlaybackTimeline from './PlaybackTimeline.js';
import PlaybackEngine from './PlaybackEngine.js';

/**
 * Coordinates playback state, timeline state, and track scheduling for one or more tracks.
 */
export default class Controller extends Observer {
  /**
   * @param {Object} [options]
   * @param {BaseAudioContext} [options.ac] Existing audio context to reuse.
   * @param {AudioContextOptions} [options.acOpts] Options used when creating an audio context.
   * @param {AudioNode} [options.destination] Destination node for the controller gain node.
   * @param {number} [options.duration] Initial playback duration.
   * @param {boolean} [options.loop] Whether playback should loop.
   * @param {boolean} [options.unmuteAc=true] Whether to attach the iOS unmute helper.
   */
  constructor({ ac, acOpts, destination, duration, loop, unmuteAc = true } = {}) {
    super();

    this.ac = ac || new AudioContext(acOpts);
    if (unmuteAc && isIOS()) unmuteAudioContext(this.ac);
    this.closeAcOnDestroy = !ac;
    this.destination = destination || this.ac.destination;
    this.gainNode = this.ac.createGain();
    this.gainNode.connect(this.destination);

    this.loop = loop;

    this.trackGroup = new TrackGroup();
    this.timeline = new PlaybackTimeline(this);
    this.engine = new PlaybackEngine(this);

    this.onStateChange = () => {
      if (this.ac.state === 'running') this.engine.tick();
      else this.engine.untick();
    };

    this.ac.addEventListener('statechange', this.onStateChange);
    this.ac.suspend();

    if (duration) this.timeline.playDuration = duration;
  }

  /**
   * Tears down engine state, disconnects the gain node, and closes owned resources.
   */
  destroy() {
    this.engine.untick();
    this.trackGroup.tracks = [];
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    this.ac.removeEventListener('statechange', this.onStateChange);
    if (this.closeAcOnDestroy) this.ac.close();
    this.ac = null;
    this.unAll();
  }

  // --- Track Delegation ---
  /**
   * Starts observing a track.
   *
   * @param {import('../track/Track.js').default} track
   */
  observe(track) {
    this.trackGroup.observe(track);
  }

  /**
   * Stops observing a track and refreshes aggregate duration.
   *
   * @param {import('../track/Track.js').default} track
   */
  unobserve(track) {
    this.trackGroup.unobserve(track);
    this.notifyUpdated('duration', this.duration);
  }

  /**
   * Returns whether all observed tracks can currently play.
   *
   * @returns {boolean}
   */
  get canPlay() {
    return this.trackGroup.canPlay;
  }

  /**
   * Returns whether any observed track is currently seeking.
   *
   * @returns {boolean}
   */
  get isSeeking() {
    return this.trackGroup.isSeeking;
  }

  /**
   * Returns the aggregate audio duration across observed tracks.
   *
   * @returns {number|undefined}
   */
  get audioDuration() {
    return this.trackGroup.audioDuration;
  }

  /**
   * Returns the currently observed tracks.
   *
   * @returns {Array<import('../track/Track.js').default>}
   */
  get tracks() {
    return this.trackGroup.tracks;
  }

  // --- Engine Delegation ---
  /**
   * Requests playback via the playback engine.
   *
   * @returns {Promise<void>}
   */
  play() {
    return this.engine.play();
  }

  /**
   * Requests suspension via the playback engine.
   *
   * @returns {Promise<void>}
   */
  pause() {
    return this.engine.pause();
  }

  /**
   * Returns the playback state requested by the engine.
   *
   * @returns {string}
   */
  get desiredState() {
    return this.engine.desiredState;
  }

  /**
   * Returns the current audio context state.
   *
   * @returns {AudioContextState}
   */
  get state() {
    return this.ac.state;
  }

  /**
   * Returns whether the controller is currently buffering.
   *
   * @returns {boolean}
   */
  get isBuffering() {
    return this.engine.isBuffering;
  }

  /**
   * Attempts to play immediately, retrying once buffering has ended.
   *
   * @returns {Promise<void>}
   */
  async playOnceReady() {
    try {
      await this.play();
    } catch (err) {
      this.once('pause-end', () => this.play());
    }
  }

  // --- Timeline Delegation ---
  /**
   * Returns the active play duration bound.
   *
   * @returns {number|undefined}
   */
  get playDuration() {
    return this.timeline.playDuration;
  }

  /**
   * Sets the active play duration bound.
   *
   * @param {number|undefined} v
   */
  set playDuration(v) {
    this.timeline.playDuration = v;
  }

  /**
   * Returns the current playback offset.
   *
   * @returns {number}
   */
  get offset() {
    return this.timeline.offset;
  }

  /**
   * Sets the current playback offset.
   *
   * @param {number} v
   */
  set offset(v) {
    this.timeline.offset = v;
  }

  /**
   * Returns the current track time.
   *
   * @returns {number|undefined}
   */
  get currentTime() {
    return this.timeline.currentTime;
  }

  /**
   * Seeks to a track time.
   *
   * @param {number} v
   */
  set currentTime(v) {
    this.timeline.setCurrentTime(v);
  }

  /**
   * Returns current playback position as a fraction of total duration.
   *
   * @returns {number}
   */
  get pct() {
    return this.timeline.pct;
  }

  /**
   * Seeks by normalized playback position.
   *
   * @param {number} v
   */
  set pct(v) {
    this.timeline.pct = v;
  }

  /**
   * Returns the remaining playback time.
   *
   * @returns {number}
   */
  get remaining() {
    return this.timeline.remaining;
  }

  /**
   * Returns the raw, unbounded track time.
   *
   * @returns {number|undefined}
   */
  get rawCurrentTime() {
    return this.timeline.rawCurrentTime;
  }

  /** @deprecated use set playDuration */
  set duration(v) {
    this.timeline.playDuration = v;
  }

  /**
   * Returns the aggregate duration.
   *
   * @returns {number|undefined}
   */
  get duration() {
    return this.timeline.audioDuration;
  }

  /**
   * Returns a scheduler-ready snapshot of the current timeframe.
   *
   * @returns {import('./Timeframe.js').default}
   */
  get currentTimeframe() {
    return this.timeline.currentTimeframe;
  }

  /**
   * Returns the adjusted playback end time.
   *
   * @returns {number}
   */
  get adjustedEnd() {
    return this.timeline.adjustedEnd;
  }

  /**
   * Returns the adjusted playback start anchor.
   *
   * @returns {number|undefined}
   */
  get adjustedStart() {
    return this.timeline.adjustedStart;
  }

  /**
   * Sets the adjusted playback start anchor.
   *
   * @param {number|undefined} v
   */
  set adjustedStart(v) {
    this.timeline.adjustedStart = v;
  }

  /**
   * Sets both the offset and play duration bounds in one operation.
   *
   * @param {number} offset
   * @param {number} playDuration
   */
  setRegion(offset, playDuration) {
    this.timeline.setRegion(offset, playDuration);
  }

  // --- Notifications & Events ---
  /**
   * Resets playback state and emits the end event.
   */
  end() {
    this.engine.reset();
    this.fireEvent('end');
  }

  /**
   * Receives notifications from tracks and translates them into controller events and state updates.
   *
   * @param {string} event
   * @param {any} payload
   */
  notify(event, payload) {
    if (event === 'loading-start' && !this.canPlay && !this.isBuffering)
      this.engine.bufferingStart();
    if (event === 'loading-end' && this.canPlay && this.isBuffering) this.engine.bufferingEnd();
    if (event === 'error') {
      this.fireEvent('error', payload);
    }
    if (event === 'init') {
      this.fireEvent('init', payload);
      this.notifyUpdated('duration', this.duration);
    }
    if (event === 'start' || event === 'duration') {
      this.notifyUpdated('duration', this.duration);
    }
  }

  /**
   * Emits a property event only when the value has changed since the last notification.
   *
   * @param {string} property
   * @param {any} newvalue
   */
  notifyUpdated(property, newvalue) {
    this.$notifyUpdatedPropertyCache = this.$notifyUpdatedPropertyCache || {};
    if (this.$notifyUpdatedPropertyCache[property] !== newvalue) {
      this.fireEvent(property, newvalue);
      this.$notifyUpdatedPropertyCache[property] = newvalue;
    }
  }

  // --- Volume/Gain Helpers ---
  /**
   * Returns the controller output gain value.
   *
   * @returns {number}
   */
  get volume() {
    return this.gainNode.gain.value;
  }

  /**
   * Sets the controller output gain value.
   *
   * @param {number} v
   */
  set volume(v) {
    this.gainNode.gain.value = v;
  }

  /**
   * Fades the controller output in.
   *
   * @param {number} [duration=1]
   */
  fadeIn(duration = 1) {
    fadeIn(this.gainNode, { duration });
  }

  /**
   * Fades the controller output out.
   *
   * @param {number} [duration=1]
   */
  fadeOut(duration = 1) {
    fadeOut(this.gainNode, { duration });
  }
}
