/**
 * Copyright (C) 2019-2023 First Coders LTD
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import Observer from './observer.js';
import AudioContext from './lib/audio-context.js';
import { fadeIn, fadeOut } from './lib/fade.js';

/**
 * A controller is used to control the playback of one or more HLS tracks
 * @class Controller
 */
class Controller extends Observer {
  /**
   * @property {Integer|undefined} adjustedStart - A number inidicating where, relative to the audioContext.currentTime the hypothetical time t=0 would be. Depending on seeking, this can be a negative number.
   * @example
   * t = 10 9 8 7 6 5 4 3 2 1 0 1 2 3 4 5 6 7 8 9 10
   *                                    ----------------------   // a 10 second track, seeked to 0s at t = 5 => adjustedStart = 5
   *                          ----------------------             // a 10 second track, seeked to 0s at t = 0 => adjustedStart = 0
   *                ---------------------                        // a 10 second track, seeked to 5s at t = 0 => adjustedStart = -5
   *        ---------------------                                // a 10 second track, seeked to 9s at t = 0 => adjustedStart = -9
   */
  _adjustedStart;

  /**
   * @property {Array} hls - The HLS tracks being controlled by this controller
   * @private
   */
  hls = [];

  /**
   * @constructor
   * @param {Object} param0 [{}] - A parameter object
   * @param {AudioContext} [AudioContext] - An instance of an audiocontext
   * @param {Object} acOpts - An object representing options for auto-instantiating an audiocontext
   * @param {String} refreshRate [250] - How often a "timeupdate" event is triggered
   * @param {Object} destination [audioContext.destination] - The destination audio node on which all audionodes send data
   * @param {Integer} duration - The duration in seconds
   */
  constructor({ ac, acOpts, refreshRate, destination, duration, loop } = {}) {
    super();

    // use or create a new audioContext
    this.ac = ac || new AudioContext(acOpts);

    // if we create a new audiocontext here, we will want to destroy it later to free up memory
    // see https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/close
    this.closeAcOnDestroy = !ac;

    // how often a "timeupdate" event is triggered
    // this also determines how often the controller checks if the current|next segments need loading
    // and if the playback needs to be paused due to buffering
    this.refreshRate = refreshRate || 250;

    // The destination audio node on which all audionodes send data
    this.destination = destination || this.ac.destination;

    // create a gainnode for the master volume
    this.gainNode = this.ac.createGain();

    // connect it to the destination
    this.gainNode.connect(this.destination);

    // store the handler so that we can remove it
    this.onStateChange = () => {
      if (this.ac.state === 'running') this.tick();
      else this.untick();
    };

    this.ac.addEventListener('statechange', this.onStateChange);

    // make sure we stop the clock
    this.ac.suspend();

    // by default we are suspended
    this.desiredState = 'suspended';

    // set the duration, if supplied
    if (duration) this.duration = duration;

    this.loop = loop;
  }

  /**
   * Destructor for cleanup
   */
  destroy() {
    // stop time
    this.untick();

    // remove references
    this.hls = [];

    // disconect volume
    this.gainNode.disconnect();
    this.gainNode = null;

    // unset
    this.ac.removeEventListener('statechange', this.onStateChange);

    // close the audiocontext, if it was created by the controller
    if (this.closeAcOnDestroy) this.ac.close();

    this.ac = null;

    // remove all event listeners
    this.unAll();
  }

  /**
   * Register a HLS instance which is to be controlled by this controller
   * @param {HLS} hls - An instance of a HLS track
   */
  observe(hls) {
    if (this.hls.indexOf(hls) === -1) this.hls.push(hls);
  }

  /**
   * Unregister a HLS instance which is no longer to be controlled by this controller
   * @param {HLS} hls - An instance of a HLS track
   */
  unobserve(hls) {
    this.hls.splice(this.hls.indexOf(hls), 1);
  }

  /**
   * Start playback
   *
   * TODO inconsistent return
   *
   * @throws {Error} - Will throw an error if no HLS tracks that are observed by this controller have been loaded and duration cannot be determined.
   */
  async play() {
    this.desiredState = 'resumed';

    if (typeof this.duration !== 'number') throw new Error('Cannot play before loading content');
    if (this.isBuffering) throw new Error('The player is buffering');
    // seek to 0 when starting playback for the first time
    if (typeof this.adjustedStart !== 'number') this.fixAdjustedStart(0);

    if (this.ac.state === 'suspended') await this.ac.resume();

    this.fireEvent('start');
  }

  /**
   * Stop playback
   */
  async pause() {
    this.desiredState = 'suspended';

    if (this.ac.state !== 'suspended') await this.ac.suspend();
    this.fireEvent('pause');
  }

  /**
   * Executes the tick callback
   *
   * @private
   * @fires Object#timeupdate
   */
  // eslint-disable-next-line consistent-return
  tick() {
    // Prevent multiple ticks running concurrently
    if (this.tTick) this.untick();

    // Detect if we're reached the end
    if (this.currentTime > this.duration) return this.end();

    // if (this.currentTime + 1 > this.duration) {
    // console.log({ tnext: this.currentTime + 5, duration: this.duration });
    // this.startOffset += this.duration;
    // console.log(this.startOffset);
    // this.fixAdjustedStart(0, this.adjustedStart + this.duration);
    // }

    this.fireEvent('timeupdate', {
      t: this.currentTime,
      pct: this.pct,
      remaining: this.remaining,
      act: this.ac.currentTime,
    });

    // schedule next tick
    if (this.ac.state === 'running') this.tTick = setTimeout(() => this.tick(), this.refreshRate);
  }

  /**
   * Initiate buffering
   * @private
   */
  bufferingStart() {
    this.fireEvent('pause-start');

    this.isBuffering = true;

    if (this.ac.state === 'running') this.ac.suspend();
  }

  /**
   * Terminate buffering
   * @private
   */
  bufferingEnd() {
    if (this.desiredState === 'resumed') this.ac.resume();

    this.isBuffering = false;

    this.fireEvent('pause-end');
  }

  /**
   * A means to let HLSs to notify the controller of an event
   * @param {String} payload - the type of event that occurred in the HLS object
   */
  notify(event, payload) {
    if (event === 'loading-start' && !this.canPlay && !this.isBuffering) this.bufferingStart();
    if (event === 'loading-end' && this.canPlay && this.isBuffering) this.bufferingEnd();
    if (event === 'error') {
      this.fireEvent('error', payload);
      console.error(payload);
    }
    if (event === 'init') {
      this.fireEvent('init', payload);

      // if a stem has initialised, the duration could have changed
      this.fireEvent('duration');
    }
  }

  /**
   * Stops the tick callback
   *
   * @private
   */
  untick() {
    if (this.tTick) clearTimeout(this.tTick);

    this.tTick = null;
  }

  /**
   * Duration is max duration of all tracks being controlled by this controller
   *
   * @returns {Int} - The max of the duration of the hls tracks that are controlled by this controller
   */
  get duration() {
    // if the duration was manually set, return that
    if (this._duration) return this._duration;

    const max = Math.max.apply(
      null,
      this.hls.map((hls) => hls.duration).filter((duration) => !!duration)
    );

    // when there are no durations, -Infinity can come out of the above calc
    return max > 0 ? max : undefined;
  }

  /**
   * Gives the option to override the duration
   * @param {Integer} duration - The duration in seconds
   */
  set duration(duration) {
    this._duration = duration;
    this.fireEvent('duration');
  }

  /**
   * @returns {Integer|undefined} - The index of the loop
   */
  get nLoop() {
    let t = this.adjustedStart !== undefined ? this.ac.currentTime - this.adjustedStart : undefined;

    t /= this.duration;

    return Math.floor(t);
  }

  /**
   * Set the current time
   *
   * @param {Integer} t - The current time, in seconds
   * @fires Object#seek
   */
  set currentTime(t) {
    if (typeof this.duration !== 'number' || t < 0 || t > this.duration)
      throw new Error(`CurrentTime ${t} should be between 0 and duration ${this.duration}`);

    this.fixAdjustedStart(t);

    // seek: suspend the ac before emitting the seek event: disconnecting audio nodes on a runnin ac can cause "cracks" and "pops".
    this.ac.suspend().then(() => {
      this.fireEvent('seek', { t: this.currentTime, pct: this.pct, remaining: this.remaining });
      if (this.desiredState === 'resumed' && !this.isBuffering) this.ac.resume();
    });
  }

  /**
   * @returns {Integer|undefined} - The current time, in seconds.
   */
  get currentTime() {
    let t = this.adjustedStart !== undefined ? this.ac.currentTime - this.adjustedStart : undefined;

    if (this.loop) t %= this.duration;

    return t;
  }

  /**
   * Calculates the adjusted start time (determining where the "0" point lies) relative to the ac time
   * @param {Float} t
   */
  fixAdjustedStart(t) {
    // We round as extreme precise floating point numbers were causing slight rounding(?) errors in scheduling, resulting in ticks
    this.adjustedStart = Math.floor((this.ac.currentTime - t) * 10) / 10;
  }

  /**
   * Sets the current time, in percent
   * @param {Integer} pct - The current time between 0 and 1
   */
  set pct(pct) {
    let factor = pct;

    if (factor < 0) factor = 0;
    if (factor > 1) factor = 1;

    this.currentTime = factor * this.duration;
  }

  /**
   * Gets the current time, in percent
   * @returns The current time, in percent
   */
  get pct() {
    return this.currentTime / this.duration;
  }

  /**
   * Calculate start relative to now.
   * Normally the start time is just this.start. However due to seeking this can vary. It will help to understand the workings of the audiocontext timeline.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/currentTime
   * @see https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start
   *
   * @param {Integer} segment - The segment
   * @param {Integer} segment.start - The start time in seconds
   * @param {Integer} segment.isInNextLoop - Whether to schedule for the upcoming loop
   *
   * @returns {Integer|undefined}
   */
  calculateRealStart({ start, isInNextLoop }) {
    const { adjustedStart } = this;

    if (adjustedStart === undefined) return undefined;

    let realStart = adjustedStart + start;

    if (this.loop) {
      let { nLoop } = this;

      // a segment has this property if it is being pre-loaded for playback in the near future
      // this means that _at that time_ nLoop is still less than what it will be when playback
      // for that segment commences - so we need to increase it
      if (isInNextLoop) nLoop += 1;

      // when looping we need to take the number of loops into consideration when calculating start time
      realStart += nLoop * this.duration;
    }

    if (realStart < 0) realStart = 0;

    return realStart;
  }

  /**
   * Calculate offset by taking into consideration the start time.
   * Normally the offset is 0. If the user seeks halfway into a 10 second segment, the offset is 5.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start
   *
   * @param {Integer} t
   * @returns {Integer|undefined}
   */
  calculateOffset({ start, isInNextLoop }) {
    if (this.currentTime === undefined) return undefined;

    let offset = this.currentTime - start;

    // offset is < 0 when start is in the future, so offset should be 0 in that case
    // if isInNextLoop is true, then the segment is being pre-loaded and we want to play all of it so offset should be 0
    if (offset < 0 || isInNextLoop) offset = 0;

    return offset;
  }

  /**
   * Get the playback state
   * @returns {String} The audiocontext state
   */
  get state() {
    return this.ac.state;
  }

  /**
   * Get the master volume
   * @returns {Integer} The master volume
   */
  get volume() {
    return this.gainNode.gain.value;
  }

  /**
   * Set the master volume
   * @param {Integer} v - The master volume
   */
  set volume(v) {
    this.gainNode.gain.value = v;
  }

  /**
   * Resets the controller
   * @private
   */
  async reset() {
    await this.pause();
    this.adjustedStart = undefined;
    this.desiredState = 'suspended';
  }

  /**
   * Whether the controller can play the current segments of all the hls tracks under it's control
   */
  get canPlay() {
    return !this.hls.find((hls) => !hls.shouldAndCanPlay);
  }

  get isSeeking() {
    return !!this.hls.find((hls) => hls.isSeeking);
  }

  /**
   * @private
   */
  end() {
    this.reset();
    this.fireEvent('end');
  }

  /**
   * Get the remaining time (in seconds)
   */
  get remaining() {
    return this.duration - this.currentTime;
  }

  fadeIn(duration = 1) {
    fadeIn(this.gainNode, { duration });
  }

  fadeOut(duration = 1) {
    fadeOut(this.gainNode, { duration });
  }

  async playOnceReady() {
    try {
      await this.play();
    } catch (err) {
      this.once('pause-end', () => this.play());
    }
  }
}

export default Controller;
