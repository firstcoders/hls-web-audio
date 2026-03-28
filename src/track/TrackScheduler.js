export default class TrackScheduler {
  #scheduleNotBefore;
  #timeoutId;

  constructor(track, stack) {
    this.track = track;
    this.stack = stack;
  }

  reset() {
    this.stack.disconnectAll();
    this.#scheduleNotBefore = undefined;
    if (this.#timeoutId) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }
  }

  async runSchedulePass(timeframe, force) {
    if (this.#timeoutId) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }

    if (force) this.#scheduleNotBefore = undefined;

    if (this.#scheduleNotBefore !== undefined && timeframe.currentTime < this.#scheduleNotBefore) {
      this.#queueNextPass(timeframe);
      return;
    }

    const currentSegment = this.stack.getAt(timeframe.currentTime);
    this.evictOldCaches(currentSegment);

    const segments = this.getNextSegments(timeframe, currentSegment);
    if (!segments.length) {
      this.#queueNextPass(timeframe);
      return;
    }

    // Immediately mark them as in-transit to prevent concurrent runSchedulePass calls
    // (triggered by rapid ticks) from picking up the same segments before the loop reaches them.
    segments.forEach((segment) => {
      segment.$inTransit = true;
    });

    await Promise.all(
      segments.map(async (segment) => {
        // Re-check just in case they were ready'd or disconnected externally
        if (!segment.isReady) {
          await this.scheduleAt(timeframe, segment);
        } else {
          segment.$inTransit = false;
        }
      }),
    );

    this.#queueNextPass(timeframe);
  }

  #queueNextPass(timeframe) {
    // Guard against being called after the track has been destroyed (controller or ac may
    // be null after destroy()).
    if (!this.track.controller?.ac) return;

    // If nothing is scheduled yet, we still need a recovery heartbeat while the audio
    // context is not running (e.g. suspended during buffering after an aborted scheduleAt).
    // Without this, the scheduler can go completely idle and never re-trigger loading.
    if (this.#scheduleNotBefore === undefined) {
      if (this.track.controller.ac.state !== 'running') {
        this.#timeoutId = setTimeout(() => {
          if (!this.track.controller?.ac) return;
          this.runSchedulePass(this.track.controller.currentTimeframe, true);
        }, 500);
      }
      return;
    }

    // We want to run slightly before the scheduled boundary to give networking a headstart,
    // though the lookahead loop handles 10 seconds ahead anyway.
    let waitMs = (this.#scheduleNotBefore - timeframe.currentTime) * 1000;

    // We enforce a minimum safe wait time so it doesn't spin wildly,
    // but caps out to pause/background safeties.
    if (waitMs < 0 || Number.isNaN(waitMs)) waitMs = 0;

    // We only wait a maximum of 1000ms while paused, just to ensure if the state
    // changes beneath us the scheduler will eventually catch up and re-sync.
    if (this.track.controller.ac.state !== 'running') {
      waitMs = Math.min(waitMs, 1000);
    }

    // Minimum 10ms boundary
    waitMs = Math.max(10, waitMs);

    this.#timeoutId = setTimeout(() => {
      // Re-read current timeframe to get actual current time, rather than the cached one
      if (!this.track.controller?.ac) return;
      this.runSchedulePass(this.track.controller.currentTimeframe);
    }, waitMs);
  }

  async scheduleAt(timeframe, segment) {
    try {
      this.track.controller?.notify('loading-start', this.track);
      // Let scheduleAt strictly rely on the caller setting it, but re-assert just in case
      segment.$inTransit = true;

      // load the segment
      if (!segment.isLoaded) await segment.load().promise;

      const start = timeframe.calculateRealStart(segment);
      const offset = timeframe.calculateOffset(segment);
      const stop = timeframe.adjustedEnd;

      // connect it to the audio
      await segment.connect({
        ac: this.track.controller.ac,
        destination: this.track.gainNode,
        start,
        offset,
        stop,
      });

      this.#scheduleNotBefore = segment.end - segment.duration / 2;
      this.stack.recalculateStartTimes(segment);
    } catch (err) {
      if (err.name !== 'AbortError') {
        this.track.controller?.notify('error', err);
      }
    } finally {
      segment.$inTransit = false;
      this.track.controller?.notify('loading-end', this.track);
    }
  }

  getNextSegments(timeframe, currentSegment) {
    if (!currentSegment) return [];

    const segments = [];
    const LOOKAHEAD_DURATION_SECONDS = 10;

    let segment = currentSegment;
    let accumulatedLookahead = 0;

    while (segment && accumulatedLookahead < LOOKAHEAD_DURATION_SECONDS) {
      // If we crossed the timeframe boundary, wrap around or stop
      if (segment.start >= timeframe.end) {
        if (this.track.controller.loop) {
          // Logically loop around to the timeframe start
          segment = this.stack.getAt(timeframe.offset);
          if (!segment) break; // safety fallback
        } else {
          break; // Stop looking once outside of the buffering window
        }
      }

      if (!segment.$inTransit && !segment.isReady && !segments.includes(segment)) {
        segments.push(segment);
      }

      // Increment our window by the duration (relative), measuring only what's left for the current segment
      const segmentDurationLeft =
        segment === currentSegment
          ? Math.max(0, segment.end - timeframe.currentTime)
          : segment.duration;

      accumulatedLookahead += segmentDurationLeft;

      segment = segment.next;
    }

    return segments;
  }

  evictOldCaches(currentSegment) {
    if (!currentSegment) return;

    // Fast eviction. We only attempt to clean up bounds exactly slightly outside the target play window.
    const evictQueue = [];

    let lookbehind = currentSegment;
    let i = 0;
    while (i < 4) {
      if (lookbehind) lookbehind = lookbehind.prev;
      i += 1;
    }
    if (lookbehind) evictQueue.push(lookbehind);

    let lookahead = currentSegment;
    i = 0;
    while (i < 4) {
      if (lookahead) lookahead = lookahead.next;
      i += 1;
    }
    if (lookahead) evictQueue.push(lookahead);

    evictQueue.forEach((segment) => {
      if (segment && segment.isLoaded && !segment.isReady) {
        segment.unloadCache();
      }
    });
  }
}
