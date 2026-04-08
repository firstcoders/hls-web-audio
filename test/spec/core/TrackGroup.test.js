import { expect } from '@bundled-es-modules/chai';
import sinon from 'sinon';
import TrackGroup from '../../../src/core/TrackGroup.js';

describe('TrackGroup', () => {
  let group;

  beforeEach(() => {
    group = new TrackGroup();
  });

  describe('#observe', () => {
    it('adds a track to the group', () => {
      const track1 = { id: 1 };
      const track2 = { id: 2 };

      group.observe(track1);
      group.observe(track2);

      expect(group.tracks.length).to.equal(2);
      expect(group.tracks[0]).to.equal(track1);
      expect(group.tracks[1]).to.equal(track2);
    });

    it('does not add a track if it is already observed', () => {
      const track1 = { id: 1 };

      group.observe(track1);
      group.observe(track1); // Add again

      expect(group.tracks.length).to.equal(1);
    });
  });

  describe('#unobserve', () => {
    it('removes an observed track from the group', () => {
      const track1 = { id: 1 };
      const track2 = { id: 2 };

      group.observe(track1);
      group.observe(track2);

      group.unobserve(track1);

      expect(group.tracks.length).to.equal(1);
      expect(group.tracks[0]).to.equal(track2);
    });

    it('does nothing when unobserving an unseen track', () => {
      const track1 = { id: 1 };
      group.unobserve({ id: 99 });

      expect(group.tracks.length).to.equal(0);
    });
  });

  describe('#audioDuration', () => {
    it('returns the maximum duration among all observed tracks', () => {
      const track1 = { end: 10 };
      const track2 = { end: 20 };
      const track3 = { end: 15 };

      group.observe(track1);
      group.observe(track2);
      group.observe(track3);

      expect(group.audioDuration).to.equal(20);
    });

    it('filters out tracks without a valid end', () => {
      const track1 = { end: undefined };
      const track2 = { end: 12 };

      group.observe(track1);
      group.observe(track2);

      expect(group.audioDuration).to.equal(12);
    });

    it('returns undefined if no tracks have an end', () => {
      group.observe({ end: undefined });
      expect(group.audioDuration).to.be.undefined;
    });

    it('returns undefined if there are no observed tracks', () => {
      expect(group.audioDuration).to.be.undefined;
    });
  });

  describe('#canPlay', () => {
    it('returns true if all tracks can play', () => {
      const track1 = { shouldAndCanPlay: true };
      const track2 = { shouldAndCanPlay: true };

      group.observe(track1);
      group.observe(track2);

      expect(group.canPlay).to.be.true;
    });

    it('returns false if any track cannot play', () => {
      const track1 = { shouldAndCanPlay: true };
      const track2 = { shouldAndCanPlay: false };

      group.observe(track1);
      group.observe(track2);

      expect(group.canPlay).to.be.false;
    });

    it('returns true if there are no tracks', () => {
      expect(group.canPlay).to.be.true;
    });
  });

  describe('#isSeeking', () => {
    it('returns true if any track is seeking', () => {
      const track1 = { isSeeking: false };
      const track2 = { isSeeking: true };

      group.observe(track1);
      group.observe(track2);

      expect(group.isSeeking).to.be.true;
    });

    it('returns false if no tracks are seeking', () => {
      const track1 = { isSeeking: false };
      const track2 = { isSeeking: false };

      group.observe(track1);
      group.observe(track2);

      expect(group.isSeeking).to.be.false;
    });

    it('returns false if there are no tracks', () => {
      expect(group.isSeeking).to.be.false;
    });
  });
});
