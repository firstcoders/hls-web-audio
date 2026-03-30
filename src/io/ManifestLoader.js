import parseM3u8 from '../lib/parseM3u8.js';

/**
 * Loads and parses HLS manifests into segment descriptors.
 */
export default class ManifestLoader {
  /**
   * @param {typeof fetch} [fetchFn] Custom fetch implementation.
   */
  constructor(fetchFn) {
    this.fetchFn = fetchFn || window.fetch.bind(window);
  }

  /**
   * Loads a manifest URL and returns a cancellable parse operation.
   *
   * @param {string} src
   * @param {RequestInit} [fetchOptions={}]
   * @returns {{ promise: Promise<Array<{src: string, duration: number}>>, cancel: Function }}
   */
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

  /**
   * Parses a manifest string into segment descriptors.
   *
   * @param {string} manifest
   * @param {string} src
   * @returns {Array<{src: string, duration: number}>}
   */
  static parse(manifest, src) {
    return parseM3u8(manifest, src);
  }
}
