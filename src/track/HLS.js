import Track from './Track.js';
import Segment from '../io/AudioSegment.js';
import ManifestLoader from '../io/ManifestLoader.js';

export default class HLS extends Track {
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

  loadFromM3u8(manifest, src) {
    const sources = ManifestLoader.parse(manifest, src);
    this.buildSegments(sources);
  }

  buildSegments(sources) {
    this.stack?.push(
      ...sources.map((source) => new Segment({ ...source, fetchOptions: this.fetchOptions })),
    );
  }
}
