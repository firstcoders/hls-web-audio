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

  /**
   * @property {Number|undefined} - a duration set externally rather than derived from loaded audio
   */
  #duration;

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
  consume(timeframe) {
    const iCurrent = this.getIndexAt(timeframe.currentTime);
    const current = this.elements[iCurrent];
    const next = this.elements[iCurrent + 1];

    const getNextElement = () => {
      if (current && !current.$inTransit && !current.isReady) {
        return current;
      }

      // do not schedule next unless current is ready
      if (!current?.isReady) return undefined;

      // ensure the next is in the play window (<timeframe.end)
      if (next && next.start < timeframe.end && !next.$inTransit && !next.isReady) {
        return next;
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
   * The default duration as defined by the audio segments
   */
  get audioDuration() {
    return this.startPointer;
  }

  /**
   * Get the total duration
   *
   * @returns {Number|undefined}
   */
  get duration() {
    return this.#duration || this.audioDuration;
  }

  /**
   * Manually set the duration
   *
   * @param {Number} duration - the duration
   */
  set duration(duration) {
    this.#duration = duration;
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

    this.elements.forEach((s, i) => {
      const start = this.elements[i - 1]?.end || this.startPointer;

      // initialise start time of element
      s.start = start;

      // increment start pointer
      this.startPointer += s.duration;
    });
  }

  /**
   * @deprecated
   */
  set start(start) {
    this.initialStartTime = start;
    this.disconnectAll();
    this.recalculateStartTimes();
  }

  get start() {
    return this.initialStartTime;
  }

  set offset(offset) {
    this._offset = offset;
    this.disconnectAll();
    this.recalculateStartTimes();
  }

  get offset() {
    return this._offset;
  }
}
