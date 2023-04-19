export default class {
  /**
   * @property {Number} startPointer - an internal pointer pointing to where the current element is
   */
  currentPointer = 0;

  /**
   * @property {Array} elements - The ordered elements that jointly compose this HLS track
   * @private
   */
  elements = [];

  /**
   * @property {Number} startPointer - an internal pointer pointing to where the start of the next element is
   */
  startPointer = 0;

  /**
   * Destructor
   */
  destroy() {
    // destroy all elements
    this.elements.forEach((element) => element.destroy());

    // remove references
    this.elements = [];
  }

  /**
   * Add elements to the stack
   *
   * @param  {...any} element
   */
  push(...element) {
    element.forEach((s) => {
      // initialise start time of element
      s.start = this.startPointer;

      // push to stack
      this.elements.push(s);

      // increment start pointer
      this.startPointer += s.duration;
    });
  }

  /**
   * Try to get the next element that is not ready
   * @returns {Object|undefined}
   */
  consume() {
    const { current, next } = this;

    const getNextElement = () => {
      if (current && !current.$inTransit && !current.isReady) return current;
      if (next && !next.$inTransit && !next.isReady) return next;
      return undefined;
    };

    const element = getNextElement();

    if (element) {
      // store a signpost that we're currently $inTransit the element
      // so that it wont be loaded again by the next timeupdate event, while it is still being prepared
      element.$inTransit = true;
    }

    return element;
  }

  /**
   * Ack an element, freeing it up for future consumption
   *
   * @param {Object} element
   */
  ack(element) {
    element.$inTransit = false;
  }

  /**
   * Update the current time pointer
   *
   * @param {Number} t - the current time
   */
  set currentTime(t) {
    this.currentPointer = this.getIndexAt(t);
  }

  /**
   * Get the total duration
   *
   * @returns {Number|undefined}
   */
  get duration() {
    return this.startPointer;
  }

  /**
   * @returns {Object} The current element, based on the currentTime
   */
  get current() {
    return this.elements[this.currentPointer];
  }

  /**
   * @returns {Object} The next elements, based on the currentTime, and a margin
   */
  get next() {
    return this.currentPointer >= 0 ? this.elements?.[this.currentPointer + 1] : undefined;
  }

  /**
   * Handles a controller's "seek" event
   */
  disconnectAll() {
    // disconnect all elements. A new set will need to be resheduled
    this.elements.forEach((element) => {
      // cancel any loading in progress
      element.cancel();

      // disconnect any connected audio nodes
      if (element.isReady) element.disconnect();

      // ensure element is again available for consumption
      this.ack(element);
    });
  }

  /**
   * Get the length of the stack
   */
  get length() {
    return this.elements.length;
  }

  /**
   * Get the index of the current element
   * @param {Number} t - the time
   * @returns
   */
  getIndexAt(t) {
    return this.elements.findIndex((s) => t >= s.start && t <= s.end);
  }

  /**
   * Get the current element
   * @param {Number} t - the time
   * @returns
   */
  getAt(t) {
    return this.elements.find((s) => t >= s.start && t <= s.end);
  }

  /**
   * Recalculates the start times, taking into account any later adjustments from learning the real durations
   * of a segment after decoding the audio data.
   */
  recalculateStartTimes() {
    this.startPointer = 0;

    this.elements.forEach((s) => {
      // initialise start time of element
      s.start = this.startPointer;

      // increment start pointer
      this.startPointer += s.duration;
    });
  }
}
