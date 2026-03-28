export default class SegmentPlayer {
  #sourceNode;

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

  get isReady() {
    return !!this.#sourceNode;
  }
}
