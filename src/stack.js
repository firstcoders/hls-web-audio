/**
 * Copyright (C) 2019-2023 First Coders LTD
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
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
  startPointer;

  /**
   * @property {Number} startPointer - the initial start time, if not 0
   */
  initialStartTime;

  /**
   * @property {Number} nextMarginSeconds - a marin, in seconds, that controls a rolling window that checks whether a segment is nearly next
   */
  nextMarginSeconds;

  constructor({ start = 0, nextMarginSeconds = 5 } = {}) {
    this.initialStartTime = start;
    this.startPointer = start;
    this.nextMarginSeconds = nextMarginSeconds;
  }

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
    const { current, next, first } = this;

    const getNextElement = () => {
      if (current && !current.$inTransit && !current.isReady) {
        return current;
      }
      if (next && !next.$inTransit && !next.isReady) {
        return next;
      }

      // when looping, when we no longer have a next element, this means that we're nearing the end
      // we then want to pre-load the first element so that we get a smooth transition that does not halt playback
      if (this.loop && !next && !first.$inTransit && !first.isReady) {
        // mark the element for scheduling in the upcoming loop
        first.isInNextLoop = true;
        return first;
      }

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
    this._currentTime = t;
    this.currentPointer = this.getIndexAt(t);
  }

  get currentTime() {
    return this._currentTime;
  }

  /**
   * Get the total duration
   *
   * @returns {Number|undefined}
   */
  get duration() {
    return this.durationOverride || this.startPointer;
  }

  set duration(duration) {
    this.durationOverride = duration;
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
    // return this.currentPointer >= 0 ? this.elements?.[this.currentPointer + 1] : undefined;
    if (this.currentPointer !== -1) {
      const i = this.currentPointer + 1;
      if (i >= 0) return this.elements?.[i];
    }

    // check if one is upcoming in the near future
    const iNear = this.getIndexAt(this.currentTime + this.nextMarginSeconds);
    if (iNear >= 0) return this.elements?.[iNear];

    return undefined;
  }

  /**
   * @returns {Object} The first element
   */
  get first() {
    return this.elements[0];
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
    this.startPointer = this.initialStartTime;

    this.elements.forEach((s) => {
      // initialise start time of element
      s.start = this.startPointer;

      // increment start pointer
      this.startPointer += s.duration;
    });
  }

  set start(start) {
    this.initialStartTime = start;
    this.disconnectAll();
    this.recalculateStartTimes();
  }

  get start() {
    return this.initialStartTime;
  }
}
