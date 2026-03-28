import parseM3u8 from '../lib/parseM3u8.js';

export default class ManifestLoader {
  constructor(fetchFn) {
    this.fetchFn = fetchFn || window.fetch.bind(window);
  }

  load(src, fetchOptions = {}) {
    this.abortController = new AbortController();

    const promise = this.fetchFn(src, {
      signal: this.abortController.signal,
      ...fetchOptions,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.text();
      })
      .then((manifest) => parseM3u8(manifest, src));

    return {
      promise,
      cancel: () => this.abortController.abort(),
    };
  }

  static parse(manifest, src) {
    return parseM3u8(manifest, src);
  }
}
