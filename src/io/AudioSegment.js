import SegmentBuffer from './SegmentBuffer.js';
import SegmentPlayer from './SegmentPlayer.js';

/**
 * Wraps the loading, decoding, and playback lifecycle for a single audio segment.
 */
class AudioSegment {
  /**
   * @param {Object} options
   * @param {string} options.src Segment source URL.
   * @param {number} options.duration Segment duration in seconds.
   * @param {RequestInit} [options.fetchOptions={}] Fetch options used while loading the segment.
   */
  constructor({ src, duration, fetchOptions = {} }) {
    this.duration = duration;

    this.buffer = new SegmentBuffer(src, fetchOptions);
    this.player = new SegmentPlayer();
  }

  /**
   * Cancels any in-flight work and releases connected playback resources.
   */
  destroy() {
    this.cancel();
    if (this.isReady) this.disconnect();
    this.unloadCache();
  }

  /**
   * Starts loading the raw segment data.
   *
   * @returns {{ promise: Promise<void>, cancel?: Function }}
   */
  load() {
    return this.buffer.load();
  }

  /**
   * Decodes and connects the segment into the audio graph.
   *
   * @param {Object} options
   * @param {BaseAudioContext} options.ac
   * @param {AudioNode} options.destination
   * @param {number} options.start
   * @param {number} options.offset
   * @param {number} options.stop
   * @returns {Promise<void>}
   */
  async connect({ destination, ac, start, offset, stop }) {
    const connectionId = Symbol('connectionId');
    this.$currentConnection = connectionId;

    const audioBuffer = await this.buffer.getAudioBuffer(ac);

    if (this.$currentConnection !== connectionId) {
      throw new DOMException('Aborted during connection map', 'AbortError');
    }

    this.duration = audioBuffer.duration;

    await this.player.connect({
      ac,
      audioBuffer,
      destination,
      start,
      offset,
      stop,
      onEnded: () => setTimeout(() => this.disconnect(), 0),
    });
  }

  /**
   * Disconnects the currently attached source node, if any.
   */
  disconnect() {
    this.$currentConnection = null;
    this.player.disconnect();
  }

  /**
   * Drops decoded audio cache while keeping any fetched binary data.
   */
  unloadCache() {
    this.buffer.unload();
  }

  /**
   * Returns whether the segment is currently connected for playback.
   *
   * @returns {boolean}
   */
  get isReady() {
    return this.player.isReady;
  }

  /**
   * Cancels the active load or connect operation.
   */
  cancel() {
    this.$currentConnection = null;
    this.buffer.cancel();
  }

  /**
   * Returns the segment end time, when its start is known.
   *
   * @returns {number|undefined}
   */
  get end() {
    return this.start !== undefined ? this.start + this.duration : undefined;
  }

  /**
   * Returns the original segment source URL.
   *
   * @returns {string}
   */
  get src() {
    return this.buffer.src;
  }

  /**
   * Returns whether the segment has either fetched bytes or a decoded buffer cached.
   *
   * @returns {boolean}
   */
  get isLoaded() {
    return this.buffer.isLoaded;
  }
}

export default AudioSegment;
