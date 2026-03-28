import SegmentBuffer from './SegmentBuffer.js';
import SegmentPlayer from './SegmentPlayer.js';

class AudioSegment {
  constructor({ src, duration, fetchOptions = {} }) {
    this.duration = duration;

    this.buffer = new SegmentBuffer(src, fetchOptions);
    this.player = new SegmentPlayer();
  }

  destroy() {
    this.cancel();
    if (this.isReady) this.disconnect();
    this.unloadCache();
  }

  load() {
    return this.buffer.load();
  }

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

  disconnect() {
    this.$currentConnection = null;
    this.player.disconnect();
  }

  unloadCache() {
    this.buffer.unload();
  }

  get isReady() {
    return this.player.isReady;
  }

  cancel() {
    this.$currentConnection = null;
    this.buffer.cancel();
  }

  get end() {
    return this.start !== undefined ? this.start + this.duration : undefined;
  }

  get src() {
    return this.buffer.src;
  }

  get isLoaded() {
    return this.buffer.isLoaded;
  }
}

export default AudioSegment;
