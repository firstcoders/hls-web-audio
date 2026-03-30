/**
 * Drives play, pause, buffering, and the periodic playback engine tick.
 */
export default class PlaybackEngine {
  /**
   * @param {import('./AudioController.js').default} controller
   */
  constructor(controller) {
    this.controller = controller;
    this.isBuffering = false;
    this.desiredState = 'suspended';
    this.tEngineNext = null;
  }

  /**
   * Resumes the audio context when playback is allowed and emits the start event.
   *
   * @returns {Promise<void>}
   */
  async play() {
    this.desiredState = 'resumed';

    if (typeof this.controller.duration !== 'number')
      throw new Error('Cannot play before loading content');
    if (this.isBuffering) throw new Error('The player is buffering');

    if (this.controller.ac.state === 'suspended') {
      await this.controller.ac.resume();
    }

    if (typeof this.controller.timeline.adjustedStart !== 'number') {
      this.controller.timeline.fixAdjustedStart(this.controller.offset);
    }

    this.controller.fireEvent('start');
  }

  /**
   * Suspends the audio context and emits the pause event.
   *
   * @returns {Promise<void>}
   */
  async pause() {
    this.desiredState = 'suspended';
    if (this.controller.ac.state !== 'suspended') await this.controller.ac.suspend();
    this.controller.fireEvent('pause');
  }

  /**
   * Restarts the playback engine tick loop.
   */
  tick() {
    this.untick();

    // The logic tick: check bounds and buffering gracefully
    this._engineTick();
  }

  /**
   * Performs a single playback engine cycle and schedules the next wake-up.
   *
   * @private
   */
  _engineTick() {
    if (this.tEngineNext) clearTimeout(this.tEngineNext);
    this.tEngineNext = null;

    const t = this.controller.currentTime;
    const endBound = this.controller.offset + this.controller.playDuration;

    // Determine if we need to buffer because the current playback segments have dried up
    const needsBuffering = this.controller.tracks.some((track) => !track.shouldAndCanPlay);

    // Boundary Enforcement:
    // This replaces the old getter-mutations in PlaybackTimeline.currentTime
    if (t !== undefined) {
      if (t < this.controller.offset) {
        this.controller.timeline.fixAdjustedStart(this.controller.offset);
        this.tEngineNext = setTimeout(() => this._engineTick(), 10);
        return;
      }

      // If we crossed the boundary OR if we are very close to it and the audio ran out
      // (due to e.g. floating point precision ending a segment early), we just wrap/end immediately to avoid deadlocking.
      const isEffectivelyAtEnd = t >= endBound || (endBound - t < 0.15 && needsBuffering);

      if (isEffectivelyAtEnd) {
        if (this.controller.loop) {
          this.controller.timeline.fixAdjustedStart(this.controller.offset);
          this.tEngineNext = setTimeout(() => this._engineTick(), 10);
          return;
        }
        this.controller.end();
        return;
      }
    }

    if (needsBuffering && !this.isBuffering) {
      this.bufferingStart();
    }

    if (needsBuffering) {
      // On every buffering poll tick, ensure the scheduler is actively trying to load the
      // missing segment. The $inTransit guard inside the scheduler prevents double-scheduling;
      // this only makes a real difference when the scheduler has gone idle (e.g. a previous
      // scheduleAt was aborted mid-flight and left no retry timeout behind).
      this.controller.tracks.forEach((track) => {
        if (typeof track.runSchedulePass === 'function') track.runSchedulePass(true);
      });
    } else if (!needsBuffering && this.isBuffering) {
      this.bufferingEnd();
    }

    // Determine when the engine should wake up next.
    if (this.controller.ac.state === 'running' || this.isBuffering) {
      let waitMs = 250;
      if (!this.isBuffering) {
        // calculate time until the end of the timeline
        let timeToNextCheck = this.controller.offset + this.controller.playDuration - t;

        // OR until the current ready segments end
        this.controller.tracks.forEach((track) => {
          const seg = track.stack.getAt(t);
          if (seg && seg.isReady) {
            const timeToSegEnd = seg.end - t;
            if (timeToSegEnd < timeToNextCheck) {
              timeToNextCheck = timeToSegEnd;
            }
          }
        });
        waitMs = timeToNextCheck * 1000 - 10;
      } else {
        // If buffering, poll reasonably fast to unpause immediately when data arrives
        waitMs = 100;
      }

      waitMs = Math.max(50, waitMs);
      this.tEngineNext = setTimeout(() => this._engineTick(), waitMs);
    }
  }

  /**
   * Cancels any pending engine wake-up.
   */
  untick() {
    if (this.tEngineNext) clearTimeout(this.tEngineNext);

    this.tEngineNext = null;
  }

  /**
   * Marks playback as buffering and suspends the audio context if needed.
   */
  bufferingStart() {
    this.controller.fireEvent('pause-start');
    this.isBuffering = true;
    if (this.controller.ac.state === 'running') this.controller.ac.suspend();
  }

  /**
   * Ends buffering and resumes playback when playback is still desired.
   */
  bufferingEnd() {
    if (this.desiredState === 'resumed') this.controller.ac.resume();
    this.isBuffering = false;
    this.controller.fireEvent('pause-end');
  }

  /**
   * Resets playback back to a suspended, unanchored state.
   *
   * @returns {Promise<void>}
   */
  async reset() {
    await this.pause();
    this.controller.timeline.adjustedStart = undefined;
    this.desiredState = 'suspended';
  }
}
