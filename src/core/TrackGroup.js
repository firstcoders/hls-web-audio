/**
 * Maintains the set of observed tracks and exposes aggregate track state.
 */
export default class TrackGroup {
  constructor() {
    this.tracks = [];
  }

  /**
   * Adds a track if it is not already being observed.
   *
   * @param {import('../track/Track.js').default} track
   */
  observe(track) {
    if (this.tracks.indexOf(track) === -1) {
      this.tracks.push(track);
    }
  }

  /**
   * Removes a track from observation.
   *
   * @param {import('../track/Track.js').default} track
   */
  unobserve(track) {
    const index = this.tracks.indexOf(track);
    if (index !== -1) {
      this.tracks.splice(index, 1);
    }
  }

  /**
   * Returns the longest observed track duration.
   *
   * @returns {number|undefined}
   */
  get audioDuration() {
    const max = Math.max.apply(
      null,
      this.tracks.map((track) => track.end).filter((duration) => !!duration),
    );
    return max > 0 ? max : undefined;
  }

  /**
   * Returns whether every observed track can play at the current time.
   *
   * @returns {boolean}
   */
  get canPlay() {
    return !this.tracks.find((track) => !track.shouldAndCanPlay);
  }

  /**
   * Returns whether any observed track is currently seeking.
   *
   * @returns {boolean}
   */
  get isSeeking() {
    return !!this.tracks.find((track) => track.isSeeking);
  }
}
