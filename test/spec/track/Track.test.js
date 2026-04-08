import { expect } from '@bundled-es-modules/chai';
import sinon from 'sinon';
import Track from '../../../src/track/Track.js';
import Controller from '../../../src/core/AudioController.js';
import Stack from '../../../src/track/Stack.js';
import TrackScheduler from '../../../src/track/TrackScheduler.js';
import Timeframe from '../../../src/core/Timeframe.js';

describe('Track', () => {
  let controller;
  let track;

  beforeEach(() => {
    controller = new Controller();
    track = new Track({ controller, volume: 0.5, start: 10, duration: 60 });
  });

  afterEach(() => {
    if (track && track.controller) track.destroy();
  });

  describe('#constructor', () => {
    it('sets up controller, gainNode, volume, start, duration', () => {
      expect(track.controller).to.equal(controller);
      expect(track.volume).to.equal(0.5);
      expect(track.start).to.equal(10);
      expect(track.duration).to.equal(60);
      expect(track.stack).to.be.instanceOf(Stack);
      expect(track.scheduler).to.be.instanceOf(TrackScheduler);
    });

    it('creates a new controller if not provided', () => {
      const defaultTrack = new Track();
      expect(defaultTrack.controller).to.be.instanceOf(Controller);
      defaultTrack.destroy();
    });
  });

  describe('property getters/setters', () => {
    it('start updates stack.start and notifies controller', () => {
      const notifySpy = sinon.spy(controller, 'notify');
      track.start = 20;
      expect(track.start).to.equal(20);
      expect(track.stack.start).to.equal(20);
      expect(notifySpy.calledWith('start', track)).to.be.true;
    });

    it('duration updates stack.duration and notifies controller', () => {
      const notifySpy = sinon.spy(controller, 'notify');
      track.duration = 120;
      expect(track.duration).to.equal(120);
      expect(track.stack.duration).to.equal(120);
      expect(notifySpy.calledWith('duration', track)).to.be.true;
    });

    it('volume gets and sets gainNode.gain.value', () => {
      track.volume = 0.8;
      expect(track.volume).to.be.closeTo(0.8, 0.01);
      expect(track.gainNode.gain.value).to.be.closeTo(0.8, 0.01);
    });

    it('end returns stack duration + start', () => {
      expect(track.end).to.equal(70); // 60 + 10
    });
  });

  describe('canPlay / shouldAndCanPlay', () => {
    it('returns false/true appropriately when no segment exists at current time', () => {
      // no segments in stack
      expect(track.canPlay).to.be.undefined;
      expect(track.shouldAndCanPlay).to.be.true;
    });

    it('returns isReady of current segment', () => {
      const mockSegment = { start: 0, end: 100, isReady: true };
      sinon.stub(track.stack, 'getAt').returns(mockSegment);

      expect(track.canPlay).to.be.true;
      expect(track.shouldAndCanPlay).to.be.true;
    });
  });

  describe('controller events', () => {
    it('calls onSeek on seek event', async () => {
      const onSeekSpy = sinon.stub(track, 'onSeek');
      controller.fireEvent('seek');
      expect(onSeekSpy.calledOnce).to.be.true;
    });

    it('calls runSchedulePass on start event', () => {
      const runSchedulePassSpy = sinon.stub(track, 'runSchedulePass');
      controller.fireEvent('start');
      expect(runSchedulePassSpy.calledOnce).to.be.true;
    });

    it('calls #reset on playDuration and offset events', () => {
      const resetSpy = sinon.stub(track.scheduler, 'reset');
      const runScheduleSpy = sinon.stub(track.scheduler, 'runSchedulePass');

      controller.fireEvent('playDuration');
      expect(resetSpy.calledOnce).to.be.true;
      expect(runScheduleSpy.calledOnce).to.be.true;

      controller.fireEvent('offset');
      expect(resetSpy.calledTwice).to.be.true;
      expect(runScheduleSpy.calledTwice).to.be.true;
    });
  });

  describe('#onSeek', () => {
    it('disconnects all from stack and runs scheduling pass', async () => {
      const disconnectSpy = sinon.spy(track.stack, 'disconnectAll');
      const runScheduleSpy = sinon.stub(track.scheduler, 'runSchedulePass');

      await track.onSeek();

      expect(disconnectSpy.calledWith(controller.currentTimeframe)).to.be.true;
      expect(runScheduleSpy.calledWith(controller.currentTimeframe, true)).to.be.true;
    });
  });

  describe('#destroy', () => {
    it('cleans up resources', () => {
      const stackDestroySpy = sinon.spy(track.stack, 'destroy');
      const schedulerResetSpy = sinon.spy(track.scheduler, 'reset');
      const gainNodeDisconnectSpy = sinon.spy(track.gainNode, 'disconnect');
      const unobserveSpy = sinon.spy(controller, 'unobserve');

      track.destroy();

      expect(stackDestroySpy.calledOnce).to.be.true;
      expect(schedulerResetSpy.calledOnce).to.be.true;
      expect(gainNodeDisconnectSpy.calledOnce).to.be.true;
      expect(unobserveSpy.calledWith(track)).to.be.true;
      expect(track.controller).to.be.null;
      expect(track.stack).to.be.null;
      expect(track.gainNode).to.be.null;
    });
  });
});
