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
import Controller from './controller.js';
import Segment from './segment.js';
import Stack from './stack.js';
import parseM3u8 from './lib/parseM3u8.js';

class HLS {
  /**
   * Internal pointer for optimising scheduling
   * @var {Number}
   */
  #scheduleNotBefore;

  /**
   * @param {Object} param - The params
   * @param {Object} param.controller - The controller
   * @param {Object} param.volume - The initial volume
   * @param {Object} param.fetchOptions - Options to use when fetching the hls/m3u8
   */
  constructor({
    controller,
    volume = 1,
    fetch = null,
    fetchOptions = {},
    start = 0,
    duration = undefined,
  } = {}) {
    // optionally set or create controller
    this.controller = controller || new Controller();

    // register this hls track with the controller
    this.controller.observe(this);

    // respond to timeupdates
    this.eTimeUpdate = this.controller.on('timeupdate', () => this.onTimeUpdate());

    // respond to seek
    this.eSeek = this.controller.on('seek', () => this.onSeek());

    // ensure when the duration changes (e.g. because of offset + play duration), we disconnect any scheduled nodes
    // this is because the parameters of those segments may have changed (such as stop time, loop etc)
    this.controller.on('playDuration', () => this.#reset());

    this.controller.on('offset', () => this.#reset());

    // create a gainnode for volume
    this.gainNode = this.controller.ac.createGain();

    // connect this to the destination (normally master gain node)
    this.gainNode.connect(this.controller.gainNode);

    // initialise the volume
    this.volume = volume;

    // The stack contains the stack of segments
    this.stack = new Stack({ start });

    // allows adding to headers for a request
    this.fetchOptions = fetchOptions;

    // allow injecting fetch
    this.fetch = fetch;

    // offset the start time
    this.start = start;

    // duration override
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
    this.stack.disconnectAll();
    this.#scheduleNotBefore = undefined;
  }

  destroy() {
    // cancel loading
    this.cancel();

    // unregister from the controller
    this.controller.unobserve(this);
    this.controller = null;

    // remove event listeners
    this.eTimeUpdate.un();
    this.eSeek.un();

    // destroy the stack
    this.stack.destroy();
    this.stack = null;
  }

  /**
   * Loads the source m3u8 file
   *
   * @param {String} src
   * @returns Object
   */
  load(src) {
    this.src = src;

    const abortController = new AbortController();

    const promise = new Promise((resolve, reject) => {
      (this.fetch || fetch)(src, {
        signal: abortController.signal,
        ...this.fetchOptions,
        headers: {
          Accept: 'application/x-mpegURL, application/vnd.apple.mpegurl',
          ...this.fetchOptions?.headers,
        },
      })
        .then((r) => {
          if (!r.ok) {
            const error = new Error('HLS Fetch failed');
            error.name = 'HLSLoadError';
            error.response = r;
            throw error;
          }
          return r;
        })
        .then((r) => r.text())
        .then((r) => parseM3u8(r, src))
        .then((r) => {
          this.buildSegments(r);
          this.controller?.notify('init', this);
          resolve(r);
        })
        .catch((error) => {
          // dont consider AbortError an error (todo, reconsider?)
          if (error.name === 'AbortError') {
            resolve();
          }

          this.controller?.notify('error', error);
          reject(error);
        });
    });

    this.loadHandle = {
      promise,
      cancel: () => abortController.abort(),
    };

    return this.loadHandle;
  }

  /**
   * Populates the hls track from a text m3u8 manifest
   * @param {String} manifest - The m3u8 manifest
   * @param {String} src - The m3u8 location
   */
  loadFromM3u8(manifest, src) {
    const sources = parseM3u8(manifest, src);
    this.buildSegments(sources);
  }

  /**
   * @private
   * @param {Array} sources - An array containing the segment data
   */
  buildSegments(sources) {
    this.stack?.push(
      ...sources.map((source) => new Segment({ ...source, fetchOptions: this.fetchOptions })),
    );
  }

  set duration(duration) {
    this.stack.duration = duration;
    this.controller?.notify('duration', this);
  }

  /**
   * Gets the playback duration
   *
   * @returns Int
   */
  get duration() {
    return this.stack.duration;
  }

  /**
   * Gets the playback duration
   *
   * @returns Int
   */
  get totalDuration() {
    return this.stack.totalDuration;
  }

  /**
   * Gets end time of the sample
   *
   * @returns Int
   */
  get end() {
    return this.stack.duration + this.stack.start;
  }

  /**
   * Handles a controller's "tick" event
   *
   * @private
   */
  onTimeUpdate() {
    this.runSchedulePass();
  }

  /**
   * Handles a controller's "seek" event
   *
   * @private
   */
  async onSeek() {
    if (this.controller.ac.state === 'running') {
      // eslint-disable-next-line no-console
      console.debug('Disconnecting node when audiocontext is running may cause "ticks"');
    }

    // first disconnect everything
    this.stack.disconnectAll();

    // then run a schedule pass in order to immediately schedule the newly required segments
    this.runSchedulePass(true);
  }

  /**
   * Handles a controller's "timeupdate" event
   */
  async runSchedulePass(force) {
    const timeframe = this.controller.currentTimeframe;

    if (force) this.#scheduleNotBefore = undefined;

    if (timeframe.currentTime < this.#scheduleNotBefore) {
      return;
    }

    // schedule segments that are needed now
    await this.scheduleAt(timeframe);

    // schedule segments that may be needed in the next loop
    // todo prevent buffering
    // await this.scheduleAt(this.controller.calculateFutureTime(5));
  }

  async scheduleAt(timeframe) {
    const { gainNode: destination, controller } = this;

    // get the next segment
    const segment = this.stack.consume(timeframe);

    // if we dont get one, there's nothing to do at this time
    if (!segment) return;

    try {
      // notify to the controller that loading has started
      this.controller.notify('loading-start', this);

      // load the segment
      if (!segment.isLoaded) await segment.load().promise;

      const start = timeframe.calculateRealStart(segment);
      const offset = timeframe.calculateOffset(segment);
      const stop = timeframe.adjustedEnd;

      // connect it to the audio
      // @todo reverse api to controller.connect(segment) or this.connect(segment)
      await segment.connect({ ac: controller.ac, destination, start, offset, stop });

      // keep a pointer so we know we dont need to run schedule again prior to a certain currentTime
      this.#scheduleNotBefore = segment.end - segment.duration / 2;

      this.stack?.recalculateStartTimes();
    } catch (err) {
      if (err.name !== 'AbortError') {
        this.controller?.notify('error', err);
      }
    } finally {
      // release the segment
      this.stack?.ack(segment);

      // notify to the controller that this segment is ready
      this.controller?.notify('loading-end', this);
    }
  }

  get volume() {
    return this.gainNode.gain.value;
  }

  /**
   * @param {Int} volume - The volume
   */
  set volume(volume) {
    this.gainNode.gain.value = volume;
  }

  /**
   * Cancel the loading of the hls playlist
   */
  cancel() {
    if (this.loadHandle) this.loadHandle.cancel();
  }

  /**
   * Whether the track can play the current semgent based on currentTime
   */
  get canPlay() {
    const current = this.stack.getAt(this.controller.currentTime);
    return current?.isReady;
  }

  /**
   * Whether the track should and can play (depends on whether there is a current segment)
   */
  get shouldAndCanPlay() {
    const current = this.stack.getAt(this.controller.currentTime);
    return !current || current?.isReady;
  }
}

export default HLS;
