import { expect } from '@bundled-es-modules/chai';
import sinon from 'sinon';
import PlaybackTimeline from '../../../src/core/PlaybackTimeline.js';
import Timeframe from '../../../src/core/Timeframe.js';

describe('PlaybackTimeline', () => {
  let controllerMock;
  let timeline;

  beforeEach(() => {
    controllerMock = {
      notifyUpdated: sinon.spy(),
      fireEvent: sinon.spy(),
      ac: {
        currentTime: 10,
        suspend: sinon.stub().resolves(),
        resume: sinon.stub().resolves(),
      },
      engine: {
        isBuffering: false,
      },
      trackGroup: {
        audioDuration: 100,
      },
      desiredState: 'resumed',
    };
    timeline = new PlaybackTimeline(controllerMock);
  });

  describe('#constructor', () => {
    it('initializes with default offset and timeframe', () => {
      expect(timeline.offset).to.equal(0);
      expect(timeline.timeframe).to.be.instanceOf(Timeframe);
    });
  });

  describe('#anchor', () => {
    it('getting returns timeframe anchor', () => {
      timeline.timeframe.anchor = 50;
      expect(timeline.anchor).to.equal(50);
    });

    it('setting updates timeframe anchor', () => {
      timeline.anchor = 20;
      expect(timeline.timeframe.anchor).to.equal(20);
    });
  });

  describe('#playDuration', () => {
    it('sets and notifies playDuration', () => {
      timeline.playDuration = 60;
      expect(timeline.playDuration).to.equal(60);
      expect(controllerMock.notifyUpdated.calledWith('playDuration', 60)).to.be.true;
    });

    it('throws error if setting invalid playDuration', () => {
      expect(() => {
        timeline.playDuration = 'invalid';
      }).to.throw('The property "playDuration" must be of type number');
    });

    it('returns audioDuration if playDuration is not set', () => {
      expect(timeline.playDuration).to.equal(100);
    });
  });

  describe('#offset', () => {
    it('sets and notifies offset', () => {
      timeline.offset = 25;
      expect(timeline.offset).to.equal(25);
      expect(controllerMock.notifyUpdated.calledWith('offset', 25)).to.be.true;
    });

    it('throws error if setting invalid offset', () => {
      expect(() => {
        timeline.offset = 'invalid';
      }).to.throw('The property "offset" must be of type number');
    });
  });

  describe('#setRegion', () => {
    it('updates both offset and playDuration and notifies if they changed', () => {
      timeline.setRegion(10, 50);
      expect(timeline.offset).to.equal(10);
      expect(timeline.playDuration).to.equal(50);
      expect(controllerMock.notifyUpdated.calledWith('offset', 10)).to.be.true;
      expect(controllerMock.notifyUpdated.calledWith('playDuration', 50)).to.be.true;
    });

    it('throws on invalid offset or playDuration types', () => {
      expect(() => timeline.setRegion('invalid', 50)).to.throw(
        'The property "offset" must be of type number',
      );
      expect(() => timeline.setRegion(10, 'invalid')).to.throw(
        'The property "playDuration" must be of type number',
      );
    });

    it('does not notify if values are unchanged', () => {
      timeline.setRegion(0, 100); // 0 is default offset, 100 is default (playDuration based on audioDuration initially undefined)
      controllerMock.notifyUpdated.resetHistory();
      timeline.setRegion(0, 100);
      expect(controllerMock.notifyUpdated.called).to.be.false;
    });
  });

  describe('#currentTime & rawCurrentTime', () => {
    it('returns undefined if anchor is undefined', () => {
      expect(timeline.rawCurrentTime).to.be.undefined;
      expect(timeline.currentTime).to.be.undefined;
    });

    it('calculates based on ac.currentTime and anchor', () => {
      timeline.anchor = 5; // ac.currentTime is 10
      expect(timeline.rawCurrentTime).to.equal(5);
      expect(timeline.currentTime).to.equal(5);
    });
  });

  describe('#setCurrentTime', () => {
    beforeEach(() => {
      timeline.playDuration = 50; // offset = 0, playDuration = 50, duration = 100
    });

    it('throws if t is out of bounds', () => {
      expect(() => timeline.setCurrentTime(-5)).to.throw();
      expect(() => timeline.setCurrentTime(150)).to.throw();
    });

    it('constrains seeking outside the play region to the offset', () => {
      const fixStub = sinon.stub(timeline, 'fixAnchor');
      timeline.setCurrentTime(60); // outside 0 to 50
      expect(fixStub.calledWith(0)).to.be.true;
    });

    it('fixes adjusted start within the play region', () => {
      const fixStub = sinon.stub(timeline, 'fixAnchor');
      timeline.setCurrentTime(20); // within 0 to 50 bounds
      expect(fixStub.calledWith(20)).to.be.true;
    });

    it('suspends and conditionally resumes the audio context', async () => {
      timeline.setCurrentTime(20);
      expect(controllerMock.ac.suspend.calledOnce).to.be.true;

      // simulate promise resolution
      await Promise.resolve();
      expect(controllerMock.ac.resume.calledOnce).to.be.true;
    });

    it('does not resume if buffered or state not resumed', async () => {
      controllerMock.desiredState = 'suspended'; // Not 'resumed'
      timeline.setCurrentTime(20);

      await Promise.resolve();
      expect(controllerMock.ac.resume.called).to.be.false;
    });
  });

  describe('#fixAnchor', () => {
    it('adjusts start relative to context time and fires seek event', () => {
      controllerMock.ac.currentTime = 50;
      timeline.fixAnchor(10); // target track time

      expect(timeline.anchor).to.equal(40);
      expect(
        controllerMock.fireEvent.calledWith('seek', {
          t: 10,
          pct: 10 / 100, // duration 100
          remaining: 90,
        }),
      ).to.be.true;
    });
  });

  describe('#pct & #remaining', () => {
    beforeEach(() => {
      timeline.anchor = 0; // currentTime becomes 10 (10 - 0)
    });

    it('calculates the current pct based on current time and audioDuration', () => {
      expect(timeline.pct).to.equal(0.1); // 10 / 100
    });

    it('calculates the remaining time based on current time and audioDuration', () => {
      expect(timeline.remaining).to.equal(90); // 100 - 10
    });

    it('sets the current time as a fraction of audio duration', () => {
      const setCurrentTimeStub = sinon.stub(timeline, 'setCurrentTime');
      timeline.pct = 0.5;

      expect(setCurrentTimeStub.calledWith(50)).to.be.true;
    });

    it('constrains pct setting between 0 and 1', () => {
      const setCurrentTimeStub = sinon.stub(timeline, 'setCurrentTime');
      timeline.pct = 1.5;
      expect(setCurrentTimeStub.calledWith(100)).to.be.true;

      timeline.pct = -0.5;
      expect(setCurrentTimeStub.calledWith(0)).to.be.true;
    });
  });

  describe('#realEnd', () => {
    it('returns the calculated end position based on bounds', () => {
      timeline.anchor = 10;
      timeline.offset = 5;
      timeline.playDuration = 40;

      expect(timeline.realEnd).to.equal(55); // 10 + 5 + 40
    });
  });

  describe('#currentTimeframe', () => {
    it('updates and returns the internal timeframe', () => {
      timeline.anchor = 10;
      timeline.playDuration = 40;

      const frame = timeline.currentTimeframe;
      expect(frame).to.be.instanceOf(Timeframe);
      expect(frame.anchor).to.equal(10);
      expect(frame.offset).to.equal(0);
      expect(frame.playDuration).to.equal(40);
      expect(frame.currentTime).to.equal(0); // ac is 10, start is 10
      expect(frame.realEnd).to.equal(50);
    });
  });
});
