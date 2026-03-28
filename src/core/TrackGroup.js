export default class TrackGroup {
  constructor() {
    this.tracks = [];
  }

  observe(track) {
    if (this.tracks.indexOf(track) === -1) {
      this.tracks.push(track);
    }
  }

  unobserve(track) {
    const index = this.tracks.indexOf(track);
    if (index !== -1) {
      this.tracks.splice(index, 1);
    }
  }

  get audioDuration() {
    const max = Math.max.apply(
      null,
      this.tracks.map((track) => track.end).filter((duration) => !!duration),
    );
    return max > 0 ? max : undefined;
  }

  get canPlay() {
    return !this.tracks.find((track) => !track.shouldAndCanPlay);
  }

  get isSeeking() {
    return !!this.tracks.find((track) => track.isSeeking);
  }
}
