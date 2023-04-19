class Segment {
  constructor({ src, duration }) {
    this.src = src;
    this.duration = duration;
  }

  destroy() {
    // if we're loading currently, cancel
    this.cancel();

    // disconnect any connected audio nodes
    if (this.isReady) this.disconnect();

    // cleanup
    this.arrayBuffer = null;
  }

  load() {
    // dont retry fetch requests that previously failed
    // TODO allow injecting fetchRetry (do not implement retry logic in here)
    if (this.fetchFailed) return { promise: Promise.reject(new Error('Fetch failed')) };

    const abortController = new AbortController();

    const promise = fetch(this.src, {
      signal: abortController.signal,
    })
      .then(async (r) => {
        // store the audio data
        this.arrayBuffer = await r.arrayBuffer();
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

  async connect({ destination, controller }) {
    if (this.sourceNode) throw new Error('Cannot connect a segment twice');
    if (!this.arrayBuffer) throw new Error('Cannot connect. No audio data in buffer.');

    const { ac } = controller;
    const audioBuffer = await ac.decodeAudioData(this.arrayBuffer);

    // update the expected duration (from m3u8 file) with the real duration from the decoded audio
    this.duration = audioBuffer.duration;

    const sourceNode = ac.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(destination);

    const start = controller.calculateRealStart(this.start);
    const offset = controller.calculateOffset(this.start);

    sourceNode.start(start, offset);

    // disconnect with a timeout, otherwise we get a situation whether the removal of the sourceNode
    // causes the "current" segment to be seen as !isReady
    sourceNode.onended = () => setTimeout(() => this.disconnect(), 500);

    // store reference
    this.sourceNode = sourceNode;

    // We no longer need the raw data, clear up memory
    this.arrayBuffer = null;
  }

  disconnect() {
    const { sourceNode } = this;

    if (sourceNode) {
      sourceNode.disconnect();
      sourceNode.stop();
      // Important for memory management. Clearing onended removes any references to the node.
      sourceNode.onended = () => {};

      // some browsers (e.g. edge) don't like nulling the buffer
      try {
        sourceNode.buffer = null;
      } catch (e) {
        // ignore
      }

      // remove reference
      this.sourceNode = null;
    }
  }

  /**
   * Whether the segment is ready for playback
   *
   * @returns {Boolean}
   */
  get isReady() {
    return !!this.sourceNode;
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
}

export default Segment;
