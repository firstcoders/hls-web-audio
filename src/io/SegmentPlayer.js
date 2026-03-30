/**
 * Owns the audio buffer source node used to play a single decoded segment.
 */
export default class SegmentPlayer {
  #sourceNode;

  /**
   * Connects a decoded buffer source into the graph and schedules playback.
   *
   * @param {Object} options
   * @param {BaseAudioContext} options.ac
   * @param {AudioBuffer} options.audioBuffer
   * @param {AudioNode} options.destination
   * @param {number} options.start
   * @param {number} options.offset
   * @param {number} options.stop
   * @param {Function} [options.onEnded]
   * @returns {Promise<void>}
   */
  async connect({ ac, audioBuffer, destination, start, offset, stop, onEnded }) {
    if (this.#sourceNode) throw new Error('Cannot connect a segment twice');

    this.#sourceNode = ac.createBufferSource();
    this.#sourceNode.buffer = audioBuffer;
    this.#sourceNode.connect(destination);

    this.#sourceNode.onended = () => {
      if (onEnded) onEnded();
    };

    this.#sourceNode.start(start, offset);
    this.#sourceNode.stop(stop);
  }

  /**
   * Disconnects and disposes the active source node.
   */
  disconnect() {
    const sourceNode = this.#sourceNode;
    if (sourceNode) {
      sourceNode.disconnect();
      sourceNode.stop();
      sourceNode.onended = () => {};
      try {
        sourceNode.buffer = null;
      } catch (ex) {
        // Ignored
      }
      this.#sourceNode = null;
    }
  }

  /**
   * Returns whether a source node is currently attached.
   *
   * @returns {boolean}
   */
  get isReady() {
    return !!this.#sourceNode;
  }
}
