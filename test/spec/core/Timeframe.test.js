import { expect } from '@bundled-es-modules/chai';
import Timeframe from '../../../src/core/Timeframe.js';

describe('Timeframe', () => {
  describe('#constructor', () => {
    it('initializes with provided values', () => {
      const options = {
        anchor: 1,
        realEnd: 10,
        currentTime: 5,
        playDuration: 9,
        offset: 0,
      };
      const timeframe = new Timeframe(options);

      expect(timeframe.anchor).to.equal(1);
      expect(timeframe.realEnd).to.equal(10);
      expect(timeframe.currentTime).to.equal(5);
      expect(timeframe.playDuration).to.equal(9);
      expect(timeframe.offset).to.equal(0);
    });

    it('initializes with undefined values when empty', () => {
      const timeframe = new Timeframe();
      expect(timeframe.anchor).to.be.undefined;
      expect(timeframe.realEnd).to.be.undefined;
    });
  });

  describe('#update', () => {
    it('updates properties and returns itself', () => {
      const timeframe = new Timeframe();
      const result = timeframe.update({
        anchor: 2,
        realEnd: 20,
        currentTime: 10,
        playDuration: 18,
        offset: 5,
      });

      expect(result).to.equal(timeframe);
      expect(timeframe.anchor).to.equal(2);
      expect(timeframe.realEnd).to.equal(20);
      expect(timeframe.currentTime).to.equal(10);
      expect(timeframe.playDuration).to.equal(18);
      expect(timeframe.offset).to.equal(5);
    });

    it('does not overwrite anchor if undefined is passed', () => {
      const timeframe = new Timeframe({ anchor: 10 });
      timeframe.update({ anchor: undefined, realEnd: 20 });
      expect(timeframe.anchor).to.equal(10); // Remains unchanged
      expect(timeframe.realEnd).to.equal(20);
    });
  });

  describe('#setAnchor', () => {
    it('calculates the anchor based on context time and track time', () => {
      const timeframe = new Timeframe();
      const result = timeframe.setAnchor(100, 20); // context time 100, track time 20

      expect(result).to.equal(80);
      expect(timeframe.anchor).to.equal(80);
    });
  });

  describe('#calculateRealStart', () => {
    it('calculates the real start time relative to the anchor', () => {
      const timeframe = new Timeframe({ anchor: 50 });
      const realStart = timeframe.calculateRealStart({ start: 10 }); // segment starts at 10

      expect(realStart).to.equal(60);
    });

    it('returns 0 if the calculated start is negative', () => {
      const timeframe = new Timeframe({ anchor: -20 });
      const realStart = timeframe.calculateRealStart({ start: 10 });

      expect(realStart).to.equal(0);
    });
  });

  describe('#calculateOffset', () => {
    it('calculates the offset based on current time and start', () => {
      const timeframe = new Timeframe({ currentTime: 15 });
      const offset = timeframe.calculateOffset({ start: 10 });

      expect(offset).to.equal(5);
    });

    it('returns 0 if the segment start is in the future', () => {
      const timeframe = new Timeframe({ currentTime: 10 });
      const offset = timeframe.calculateOffset({ start: 15 }); // start is ahead of currentTime

      expect(offset).to.equal(0);
    });
  });

  describe('#end getter', () => {
    it('returns offset plus playDuration', () => {
      const timeframe = new Timeframe({ offset: 5, playDuration: 10 });
      expect(timeframe.end).to.equal(15);
    });
  });
});
