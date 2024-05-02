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
class Segment {
  #sourceNode;
  #arrayBuffer;
  #audioBuffer;
  #cacheClearTimeout;

  /**
   * @param {Object} param - The params
   * @param {Object} param.src - The src url
   * @param {Object} param.duration - The duration
   * @param {Object} param.fetchOptions - Options to use when fetching the hls/m3u8
   */
  constructor({ src, duration, fetchOptions = {} }) {
    this.src = src;
    this.duration = duration;
    this.fetchOptions = fetchOptions;
  }

  destroy() {
    // if we're loading currently, cancel
    this.cancel();

    // disconnect any connected audio nodes
    if (this.isReady) this.disconnect();

    // cleanup
    this.#arrayBuffer = null;
    this.#audioBuffer = null;
    // this.#sourceNode = null; // reference is cleared on disconnect
  }

  load() {
    // dont retry fetch requests that previously failed
    // TODO allow injecting fetchRetry (do not implement retry logic in here)
    if (this.fetchFailed) return { promise: Promise.reject(new Error('Fetch failed')) };

    const abortController = new AbortController();

    const promise = fetch(this.src, {
      signal: abortController.signal,
      ...this.fetchOptions,
    })
      .then(async (r) => {
        // store the audio data
        this.#arrayBuffer = await r.arrayBuffer();
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          // place a signpost so that repeated calls to `load` (due to a ticking clock) won't try and try again
          this.fetchFailed = true;
        }

        // rethrow
        // note we also rethrow AbortError as the promise must fail in this case so that the caller can handle it
        throw err;
      })
      .finally(() => {
        // unset signpost
        this.loading = false;

        // remove reference to promise
        this.loadHandle = undefined;
      });

    // store reference to promise
    this.loadHandle = {
      promise,
      cancel: () => abortController.abort(),
    };

    return this.loadHandle;
  }

  async connect({ destination, ac, start, offset, stop }) {
    if (this.#sourceNode) throw new Error('Cannot connect a segment twice');

    if (this.#cacheClearTimeout) clearTimeout(this.#cacheClearTimeout);

    if (!this.#audioBuffer) {
      if (!this.#arrayBuffer) throw new Error('Cannot connect. No audio data in buffer.');
      this.#audioBuffer = await ac.decodeAudioData(this.#arrayBuffer);
    }

    // We no longer need the raw data, clear up memory
    this.#arrayBuffer = null;

    // update the expected duration (from m3u8 file) with the real duration from the decoded audio
    this.duration = this.#audioBuffer.duration;

    this.#sourceNode = ac.createBufferSource();
    this.#sourceNode.buffer = this.#audioBuffer;
    this.#sourceNode.connect(destination);
    this.#sourceNode.onended = (e) => setTimeout(() => this.disconnect(e), 0);
    this.#sourceNode.start(start, offset);
    this.#sourceNode.stop(stop);
  }

  disconnect() {
    const sourceNode = this.#sourceNode;

    if (sourceNode) {
      sourceNode.disconnect();
      sourceNode.stop();
      // Important for memory management. Clearing onended removes any references to the node.
      sourceNode.onended = () => {};

      // some browsers (e.g. edge) don't like nulling the buffer
      try {
        sourceNode.buffer = null;
      } catch (ex) {
        // ignore
      }

      // remove reference
      this.#sourceNode = null;

      // schedule the cleanup of the cache
      // we dont do this immediately so that if the sement is re-scheduled soon after it can benefit
      // from an already decoded audio buffer. However we do need to clean it eventually for memory management.
      this.#cacheClearTimeout = setTimeout(() => {
        this.#audioBuffer = undefined;
      }, 10000);
    }
  }

  /**
   * Whether the segment is ready for playback
   *
   * @returns {Boolean}
   */
  get isReady() {
    return !!this.#sourceNode;
  }

  /**
   * Cancel any inflight xhr request
   */
  cancel() {
    // cancel any in-flight request
    if (this.loadHandle) this.loadHandle.cancel();
    this.loadHandle = null;
  }

  /**
   * Get the end time for this segment
   *
   * @returns {Number}
   */
  get end() {
    return this.start !== undefined ? this.start + this.duration : undefined;
  }

  /**
   * Whether the sement has audio data that is loaded
   */
  get isLoaded() {
    return !!this.#audioBuffer;
  }
}

export default Segment;
