import Track from './Track.js';
import Segment from '../io/AudioSegment.js';
import ManifestLoader from '../io/ManifestLoader.js';

/**
 * HLS-backed track that loads a manifest and creates schedulable audio segments.
 */
export default class HLS extends Track {
  /**
   * @param {Object} [options]
   * @param {import('../core/AudioController.js').default} [options.controller]
   * @param {number} [options.volume=1]
   * @param {typeof fetch|null} [options.fetch=null]
   * @param {RequestInit} [options.fetchOptions={}]
   * @param {number} [options.start=0]
   * @param {number} [options.duration]
   */
  constructor({
    controller,
    volume = 1,
    fetch = null,
    fetchOptions = {},
    start = 0,
    duration = undefined,
  } = {}) {
    super({ controller, volume, start, duration });

    this.manifestLoader = new ManifestLoader(fetch);
    this.fetchOptions = fetchOptions;
  }

  /**
   * Loads an HLS manifest from a URL and builds segment instances from it.
   *
   * @param {string} src
   * @returns {{ promise: Promise<Array<{src: string, duration: number}>>, cancel: Function }}
   */
  load(src) {
    this.src = src;

    const loadHandle = this.manifestLoader.load(src, {
      ...this.fetchOptions,
      headers: {
        Accept: 'application/x-mpegURL, application/vnd.apple.mpegurl',
        ...this.fetchOptions?.headers,
      },
    });

    this.cancel = loadHandle.cancel;

    const promise = loadHandle.promise
      .then((sources) => {
        this.buildSegments(sources);
        this.controller?.notify('init', this);
        return sources;
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        this.controller?.notify('error', error);
        throw error;
      });

    return { promise, cancel: this.cancel };
  }

  /**
   * Builds segments from an in-memory manifest payload.
   *
   * @param {string} manifest
   * @param {string} src
   */
  loadFromM3u8(manifest, src) {
    const sources = ManifestLoader.parse(manifest, src);
    this.buildSegments(sources);
  }

  /**
   * Converts manifest entries into audio segment instances.
   *
   * @param {Array<{src: string, duration: number}>} sources
   */
  buildSegments(sources) {
    this.stack?.push(
      ...sources.map((source) => new Segment({ ...source, fetchOptions: this.fetchOptions })),
    );
  }
}
