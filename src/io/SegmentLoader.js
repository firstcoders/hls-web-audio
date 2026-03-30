/**
 * Loads raw segment bytes and supports aborting in-flight network requests.
 */
export default class SegmentLoader {
  constructor() {
    this.abortController = new AbortController();
  }

  /**
   * Fetches segment bytes from the network.
   *
   * @param {string} src
   * @param {RequestInit} [fetchOptions={}]
   * @returns {Promise<ArrayBuffer>}
   */
  async load(src, fetchOptions = {}) {
    const response = await fetch(src, {
      signal: this.abortController.signal,
      ...fetchOptions,
    });
    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }
    return response.arrayBuffer();
  }

  /**
   * Aborts the active fetch request.
   */
  cancel() {
    this.abortController.abort();
  }
}
