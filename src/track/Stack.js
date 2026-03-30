/**
 * Doubly linked list of audio segments with helpers for timeline lookups and cache eviction.
 */
export default class Stack {
  head = null;
  tail = null;
  length = 0;

  startPointer;
  initialStartTime;
  #duration;

  #lastAccessed = null;

  /**
   * @param {{ start?: number }} [options]
   */
  constructor({ start = 0 } = {}) {
    this.initialStartTime = start;
    this.startPointer = start;
  }

  /**
   * Destroys all segments and clears the linked list.
   */
  destroy() {
    let current = this.head;
    while (current) {
      if (current.destroy) current.destroy();
      current = current.next;
    }
    this.head = null;
    this.tail = null;
    this.length = 0;
    this.#lastAccessed = null;
  }

  /**
   * Appends segments and recalculates their absolute start times.
   *
   * @param {...any} elements
   */
  push(...elements) {
    elements.forEach((s) => {
      s.start = this.startPointer;
      this.startPointer += s.duration;

      s.prev = this.tail;
      s.next = null;

      if (!this.head) {
        this.head = s;
        this.tail = s;
      } else {
        this.tail.next = s;
        this.tail = s;
      }
      this.length += 1;
    });
  }

  /**
   * Returns the duration implied by the appended segments.
   *
   * @returns {number}
   */
  get audioDuration() {
    return this.startPointer;
  }

  /**
   * Returns the overridden duration when present, otherwise the computed audio duration.
   *
   * @returns {number}
   */
  get duration() {
    return this.#duration || this.audioDuration;
  }

  /**
   * Sets an explicit duration override.
   *
   * @param {number|undefined} duration
   */
  set duration(duration) {
    this.#duration = duration;
  }

  /**
   * Returns the first segment in the linked list.
   *
   * @returns {any}
   */
  get first() {
    return this.head;
  }

  /**
   * Marks a segment as no longer in transit.
   *
   * @param {any} element
   */
  ack(element) {
    element.$inTransit = false;
  }

  /**
   * Disconnects or cancels all segments, optionally preserving nearby loads during a seek.
   *
   * @param {import('../core/Timeframe.js').default|null} [timeframe=null]
   */
  disconnectAll(timeframe = null) {
    let current = this.head;
    while (current) {
      let preserveLoad = false;

      // When seeking, don't abort the network fetch for segments already loading near the new
      // timeframe — but we still reset $inTransit and abort any in-flight connect() call so
      // the scheduler can re-schedule them with the fresh timeframe params.
      if (timeframe && current.$inTransit && current.start !== undefined) {
        const startDist = Math.abs(current.start - timeframe.currentTime);
        if (startDist <= 15) {
          preserveLoad = true;
        }
      }

      // Disconnect if connected to audio graph, OR if a near in-transit segment needs its
      // stale in-flight connect() aborted (while preserving the underlying network fetch).
      if ((current.isReady || preserveLoad) && current.disconnect) {
        current.disconnect();
      } else if (current.cancel) {
        current.cancel();
      }

      // Always ack so $inTransit is cleared — the scheduler will re-pick this segment up.
      this.ack(current);

      current = current.next;
    }
  }

  /**
   * Returns the segment covering the given track time.
   *
   * @param {number} t
   * @returns {any}
   */
  getAt(t) {
    let current = this.#lastAccessed || this.head;
    if (!current) return undefined;

    if (t < current.start) {
      while (current && t < current.start) {
        current = current.prev;
      }
    } else {
      while (current && t >= current.end) {
        current = current.next;
      }
    }

    if (current && t >= current.start && t < current.end) {
      this.#lastAccessed = current;
      return current;
    }

    return undefined;
  }

  /**
   * Recalculates absolute segment start times from the given segment onward.
   *
   * @param {any} [fromSegment=this.head]
   */
  recalculateStartTimes(fromSegment = this.head) {
    if (!fromSegment) {
      this.startPointer = this.initialStartTime;
      return;
    }

    if (fromSegment === this.head) {
      this.startPointer = this.initialStartTime;
    } else if (fromSegment.prev) {
      this.startPointer = fromSegment.prev.end || this.initialStartTime;
    }

    let current = fromSegment;
    while (current) {
      current.start = this.startPointer;
      this.startPointer = current.start + current.duration;
      current = current.next;
    }
  }

  /**
   * Sets the initial track start offset and recomputes segment timings.
   *
   * @param {number} start
   */
  set start(start) {
    this.initialStartTime = start;
    this.recalculateStartTimes();
  }

  /**
   * Returns the initial track start offset.
   *
   * @returns {number}
   */
  get start() {
    return this.initialStartTime;
  }

  /**
   * Stores the current offset metadata.
   *
   * @param {number} offset
   */
  set offset(offset) {
    this._offset = offset;
  }

  /**
   * Returns the stored offset metadata.
   *
   * @returns {number}
   */
  get offset() {
    return this._offset;
  }
}
