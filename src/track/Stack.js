export default class Stack {
  head = null;
  tail = null;
  length = 0;

  startPointer;
  initialStartTime;
  #duration;

  #lastAccessed = null;

  constructor({ start = 0 } = {}) {
    this.initialStartTime = start;
    this.startPointer = start;
  }

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

  get audioDuration() {
    return this.startPointer;
  }

  get duration() {
    return this.#duration || this.audioDuration;
  }

  set duration(duration) {
    this.#duration = duration;
  }

  get first() {
    return this.head;
  }

  ack(element) {
    element.$inTransit = false;
  }

  disconnectAll(timeframe = null) {
    let current = this.head;
    while (current) {
      let preserveLoad = false;

      // When seeking, don't abort the network fetch for segments already downloading near
      // the new timeframe — but we still reset $inTransit and abort any in-flight connect()
      // so the scheduler can re-schedule with fresh timeframe params.
      if (timeframe && current.$inTransit && current.start !== undefined) {
        const startDist = Math.abs(current.start - timeframe.currentTime);
        if (startDist <= 15) {
          preserveLoad = true;
        }
      }

      // Merge the isReady and preserveLoad disconnect cases into a single branch so
      // disconnect() is called at most once per segment, regardless of its state.
      // For preserveLoad segments this also aborts any in-flight connect() call via the
      // connectionId guard in AudioSegment, so stale timeframe params are discarded and
      // the scheduler can reconnect with fresh ones.
      if ((current.isReady || preserveLoad) && current.disconnect) {
        current.disconnect();
      }

      if (!preserveLoad) {
        if (current.cancel) current.cancel();
      }

      // Always clear $inTransit so the scheduler can immediately re-pick this segment.
      this.ack(current);

      current = current.next;
    }
  }

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

  set start(start) {
    this.initialStartTime = start;
    this.recalculateStartTimes();
  }

  get start() {
    return this.initialStartTime;
  }

  set offset(offset) {
    this._offset = offset;
  }

  get offset() {
    return this._offset;
  }
}
