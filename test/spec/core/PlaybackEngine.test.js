import { expect } from '@bundled-es-modules/chai';
import sinon from 'sinon';
import PlaybackEngine from '../../../src/core/PlaybackEngine.js';

describe('PlaybackEngine', () => {
  let controllerMock;
  let engine;
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    controllerMock = {
      fireEvent: sinon.spy(),
      end: sinon.spy(),
      ac: {
        state: 'suspended',
        resume: sinon.stub().resolves(),
        suspend: sinon.stub().resolves(),
      },
      timeline: {
        anchor: undefined,
        fixAnchor: sinon.spy(),
      },
      duration: 100, // Used by play()
      offset: 0,
      playDuration: 100,
      currentTime: 0,
      tracks: [],
      loop: false,
    };

    engine = new PlaybackEngine(controllerMock);
  });

  afterEach(() => {
    clock.restore();
  });

  describe('#constructor', () => {
    it('initializes with default values', () => {
      expect(engine.controller).to.equal(controllerMock);
      expect(engine.isBuffering).to.be.false;
      expect(engine.desiredState).to.equal('suspended');
      expect(engine.tEngineNext).to.be.null;
    });
  });

  describe('#play', () => {
    it('throws if duration is not loaded', async () => {
      controllerMock.duration = undefined;
      try {
        await engine.play();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal('Cannot play before loading content');
      }
    });

    it('throws if already buffering', async () => {
      engine.isBuffering = true;
      try {
        await engine.play();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal('The player is buffering');
      }
    });

    it('resumes the audio context if suspended and fires start event', async () => {
      await engine.play();
      expect(engine.desiredState).to.equal('resumed');
      expect(controllerMock.ac.resume.calledOnce).to.be.true;
      expect(controllerMock.fireEvent.calledWith('start')).to.be.true;
    });

    it('fixes anchor if it is not a number', async () => {
      await engine.play();
      expect(controllerMock.timeline.fixAnchor.calledWith(controllerMock.offset)).to.be.true;
    });

    it('does not fix anchor if it is a number', async () => {
      controllerMock.timeline.anchor = 10;
      await engine.play();
      expect(controllerMock.timeline.fixAnchor.called).to.be.false;
    });
  });

  describe('#pause', () => {
    it('suspends the audio context and fires pause event', async () => {
      controllerMock.ac.state = 'running';
      await engine.pause();
      expect(engine.desiredState).to.equal('suspended');
      expect(controllerMock.ac.suspend.calledOnce).to.be.true;
      expect(controllerMock.fireEvent.calledWith('pause')).to.be.true;
    });

    it('does not suspend the audio context if already suspended', async () => {
      await engine.pause();
      expect(controllerMock.ac.suspend.called).to.be.false;
      expect(controllerMock.fireEvent.calledWith('pause')).to.be.true;
    });
  });

  describe('#tick', () => {
    it('clears previous timeout and calls _engineTick', () => {
      const _engineTickStub = sinon.stub(engine, '_engineTick');
      engine.tEngineNext = setTimeout(() => {}, 100);

      engine.tick();

      expect(engine.tEngineNext).to.be.null;
      expect(_engineTickStub.calledOnce).to.be.true;

      _engineTickStub.restore();
    });
  });

  describe('#_engineTick', () => {
    it('sets a timeout to tick again if ac is running', () => {
      controllerMock.ac.state = 'running';
      controllerMock.currentTime = 50;

      engine._engineTick();

      expect(engine.tEngineNext).to.not.be.null; // A timeout is scheduled
    });

    it('fixes anchor and ticks again if currentTime < offset', () => {
      controllerMock.currentTime = -10;
      controllerMock.offset = 0;

      engine._engineTick();

      expect(controllerMock.timeline.fixAnchor.calledWith(0)).to.be.true;
      expect(engine.tEngineNext).to.not.be.null;
    });

    it('calls end() if effectively at the end of the duration and no loop', () => {
      controllerMock.currentTime = 100.5; // End exactly
      controllerMock.playDuration = 100;
      engine._engineTick();

      expect(controllerMock.end.calledOnce).to.be.true;
    });

    it('loops back to the offset if loop is true and effectively at the end', () => {
      controllerMock.loop = true;
      controllerMock.currentTime = 100.5;

      engine._engineTick();

      expect(controllerMock.timeline.fixAnchor.calledWith(controllerMock.offset)).to.be.true;
      expect(engine.tEngineNext).to.not.be.null; // Loops ticking
    });

    it('starts buffering if needs buffering and not already buffering', () => {
      const trackMock = { shouldAndCanPlay: false, runSchedulePass: sinon.spy() };
      controllerMock.tracks = [trackMock];
      const startStub = sinon.stub(engine, 'bufferingStart');

      engine._engineTick();

      expect(startStub.calledOnce).to.be.true;
      expect(trackMock.runSchedulePass.calledWith(true)).to.be.true;
    });

    it('ends buffering if no longer needs buffering and is buffering', () => {
      const trackMock = { shouldAndCanPlay: true };
      controllerMock.tracks = [trackMock];
      engine.isBuffering = true;
      const endStub = sinon.stub(engine, 'bufferingEnd');

      engine._engineTick();

      expect(endStub.calledOnce).to.be.true;
    });

    it('schedules next check based on valid playing segments', () => {
      controllerMock.ac.state = 'running';
      controllerMock.currentTime = 10;

      const segMock = { isReady: true, end: 15 };
      const stackMock = { getAt: sinon.stub().returns(segMock) };
      const trackMock = { shouldAndCanPlay: true, stack: stackMock };

      controllerMock.tracks = [trackMock];

      engine._engineTick();

      // time to segment end is (15 - 10) = 5 seconds
      // it schedules 5 seconds * 1000 - 10ms = 4990ms (or bounds to min)
      // We don't strictly test exact timing value here, but we check if setTimeout was set
      expect(engine.tEngineNext).to.not.be.null;
    });
  });

  describe('#untick', () => {
    it('cancels clear timeout and sets tEngineNext to null', () => {
      engine.tEngineNext = setTimeout(() => {}, 100);
      engine.untick();
      expect(engine.tEngineNext).to.be.null;
    });
  });

  describe('#bufferingStart', () => {
    it('sets isBuffering, fires pause-start, and suspends running ac', () => {
      controllerMock.ac.state = 'running';
      engine.bufferingStart();

      expect(engine.isBuffering).to.be.true;
      expect(controllerMock.fireEvent.calledWith('pause-start')).to.be.true;
      expect(controllerMock.ac.suspend.calledOnce).to.be.true;
    });
  });

  describe('#bufferingEnd', () => {
    it('clears isBuffering, resumes if desiredState is resumed, and fires pause-end', () => {
      engine.isBuffering = true;
      engine.desiredState = 'resumed';
      engine.bufferingEnd();

      expect(engine.isBuffering).to.be.false;
      expect(controllerMock.ac.resume.calledOnce).to.be.true;
      expect(controllerMock.fireEvent.calledWith('pause-end')).to.be.true;
    });
  });

  describe('#reset', () => {
    it('pauses, clears anchor, and sets state to suspended', async () => {
      controllerMock.timeline.anchor = 100;
      engine.desiredState = 'resumed';
      const pauseStub = sinon.stub(engine, 'pause').resolves();

      await engine.reset();

      expect(pauseStub.calledOnce).to.be.true;
      expect(controllerMock.timeline.anchor).to.be.undefined;
      expect(engine.desiredState).to.equal('suspended');
    });
  });
});
