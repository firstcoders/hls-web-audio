import Observer from './Observer.js';
import AudioContext from '../lib/AudioContext.js';
import { fadeIn, fadeOut } from '../lib/fade.js';
import isIOS from '../lib/isIOS.js';
import unmuteAudioContext from '../lib/unmuteAudioContext.js';
import TrackGroup from './TrackGroup.js';
import PlaybackTimeline from './PlaybackTimeline.js';
import PlaybackEngine from './PlaybackEngine.js';

/**
 * A controller is used to control the playback of one or more HLS tracks
 * @class Controller
 */
export default class Controller extends Observer {
  constructor({ ac, acOpts, refreshRate, destination, duration, loop, unmuteAc = true } = {}) {
    super();

    this.ac = ac || new AudioContext(acOpts);
    if (unmuteAc && isIOS()) unmuteAudioContext(this.ac);
    this.closeAcOnDestroy = !ac;
    this.destination = destination || this.ac.destination;
    this.gainNode = this.ac.createGain();
    this.gainNode.connect(this.destination);

    this.refreshRate = refreshRate || 250;
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
  observe(track) {
    this.trackGroup.observe(track);
  }

  unobserve(track) {
    this.trackGroup.unobserve(track);
    this.notifyUpdated('duration', this.duration);
  }

  get canPlay() {
    return this.trackGroup.canPlay;
  }
  get isSeeking() {
    return this.trackGroup.isSeeking;
  }
  get audioDuration() {
    return this.trackGroup.audioDuration;
  }
  get tracks() {
    return this.trackGroup.tracks;
  }

  // --- Engine Delegation ---
  play() {
    return this.engine.play();
  }
  pause() {
    return this.engine.pause();
  }
  get desiredState() {
    return this.engine.desiredState;
  }
  get state() {
    return this.ac.state;
  }
  get isBuffering() {
    return this.engine.isBuffering;
  }

  async playOnceReady() {
    try {
      await this.play();
    } catch (err) {
      this.once('pause-end', () => this.play());
    }
  }

  // --- Timeline Delegation ---
  get playDuration() {
    return this.timeline.playDuration;
  }
  set playDuration(v) {
    this.timeline.playDuration = v;
  }
  get offset() {
    return this.timeline.offset;
  }
  set offset(v) {
    this.timeline.offset = v;
  }
  get currentTime() {
    return this.timeline.currentTime;
  }
  set currentTime(v) {
    this.timeline.setCurrentTime(v);
  }
  get pct() {
    return this.timeline.pct;
  }
  set pct(v) {
    this.timeline.pct = v;
  }
  get remaining() {
    return this.timeline.remaining;
  }
  get rawCurrentTime() {
    return this.timeline.rawCurrentTime;
  }

  /** @deprecated use set playDuration */
  set duration(v) {
    this.timeline.playDuration = v;
  }

  get duration() {
    return this.timeline.audioDuration;
  }
  get currentTimeframe() {
    return this.timeline.currentTimeframe;
  }
  get adjustedEnd() {
    return this.timeline.adjustedEnd;
  }
  get adjustedStart() {
    return this.timeline.adjustedStart;
  }
  set adjustedStart(v) {
    this.timeline.adjustedStart = v;
  }

  setRegion(offset, playDuration) {
    this.timeline.setRegion(offset, playDuration);
  }

  // --- Notifications & Events ---
  end() {
    this.engine.reset();
    this.fireEvent('end');
  }

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

  notifyUpdated(property, newvalue) {
    this.$notifyUpdatedPropertyCache = this.$notifyUpdatedPropertyCache || {};
    if (this.$notifyUpdatedPropertyCache[property] !== newvalue) {
      this.fireEvent(property, newvalue);
      this.$notifyUpdatedPropertyCache[property] = newvalue;
    }
  }

  // --- Volume/Gain Helpers ---
  get volume() {
    return this.gainNode.gain.value;
  }
  set volume(v) {
    this.gainNode.gain.value = v;
  }

  fadeIn(duration = 1) {
    fadeIn(this.gainNode, { duration });
  }
  fadeOut(duration = 1) {
    fadeOut(this.gainNode, { duration });
  }
}
