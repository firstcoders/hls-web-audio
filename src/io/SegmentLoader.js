export default class SegmentLoader {
  constructor() {
    this.abortController = new AbortController();
  }

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

  cancel() {
    this.abortController.abort();
  }
}
