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
import { m3u8Parser } from './parser';
import Controller from './controller';
import Segment from './segment';
import Stack from './stack';

class HLS {
  /**
   * @param {Object} param - The params
   * @param {Object} param.controller - The controller
   * @param {Object} param.volume - The initial volume
   * @param {Object} param.fetchOptions - Options to use when fetching the hls/m3u8
   */
  constructor({ controller, volume = 1, fetch = null, fetchOptions = {} } = {}) {
    // optionally set or create controller
    this.controller = controller || new Controller();

    // register this hls track with the controller
    this.controller.observe(this);

    // respond to timeupdates
    this.eTimeUpdate = this.controller.on('timeupdate', () => this.onTimeUpdate());

    // respond to seek
    this.eSeek = this.controller.on('seek', () => this.onSeek());

    // create a gainnode for volume
    this.gainNode = this.controller.ac.createGain();

    // connect this to the destination (normally master gain node)
    this.gainNode.connect(this.controller.gainNode);

    // initialise the volume
    this.volume = volume;

    // The stack contains the stack of segments
    this.stack = new Stack();

    // allows adding to headers for a request
    this.fetchOptions = fetchOptions;

    // allow injecting fetch
    this.fetch = fetch;
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
    const abortController = new AbortController();

    const promise = (this.fetch || fetch)(src, {
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
      .then((r) => this.parseM3u8(r, src))
      .then((r) => this.buildSegments(r))
      .then((r) => {
        this.controller?.notify('stem-init', this);
        return r;
      });

    this.loadHandle = {
      promise: promise.catch((err) => {
        if (err.name !== 'AbortError') throw err;
      }),
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
    const sources = this.parseM3u8(manifest, src);
    this.buildSegments(sources);
  }

  /**
   * Parses a m3u8 manifest into a neat structure
   * @private
   * @param {String} manifest - The m3u8 manifest
   * @returns
   */
  parseM3u8(manifest, src) {
    const { segments } = m3u8Parser(manifest, src);

    return segments.map(({ url, end, start }) => ({
      src: url,
      duration: end - start,
    }));
  }

  /**
   * @private
   * @param {Array} sources - An array containing the segment data
   */
  buildSegments(sources) {
    this.stack?.push(...sources.map((source) => new Segment(source)));
  }

  /**
   * Gets the duration of the hls track
   *
   * @returns Int
   */
  get duration() {
    return this.stack.duration;
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
  onSeek() {
    // first disconnect everything
    this.stack.disconnectAll();

    // then run a schedule pass in order to immediately schedule the newly required segments
    this.runSchedulePass();
  }

  /**
   * Handles a controller's "timeupdate" event
   */
  async runSchedulePass() {
    const { gainNode: destination, controller } = this;

    // update the currenttime, so the stack knows what the current and next segment it
    this.stack.currentTime = controller.currentTime;

    // get the next segment
    const segment = this.stack.consume();

    // if we dont get one, there's nothing to do at this time
    if (!segment) return;

    try {
      // notify to the controller that loading has started
      this.controller.notify('loading-start', this);

      // if we're not dealing with a current segment
      // sleep for random short interval in order to stagger loading of segments and spread out load in an attempt to reduce clicks
      if (this.stack.current !== segment) {
        const sleep = Math.floor(Math.random() * (0 - 1000 + 1) + 1000);
        await new Promise((done) => {
          setInterval(() => done(), sleep);
        });
      }

      // load the segment
      await segment.load().promise;

      // connect it to the audio
      await segment.connect({ controller, destination });

      this.stack?.recalculateStartTimes();
    } catch (err) {
      if (err.name !== 'AbortError') {
        this.controller.notify('error', err);
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
    return this.stack.current?.isReady;
  }

  /**
   * Whether the track should and can play (depends on whether there is a current segment)
   */
  get shouldAndCanPlay() {
    return !this.stack.current || this.stack.current?.isReady;
  }
}

export default HLS;
