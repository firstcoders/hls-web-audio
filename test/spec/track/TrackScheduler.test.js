import { expect } from '@bundled-es-modules/chai';
import sinon from 'sinon';
import TrackScheduler from '../../../src/track/TrackScheduler.js';
import Track from '../../../src/track/Track.js';
import Stack from '../../../src/track/Stack.js';
import Controller from '../../../src/core/AudioController.js';
import Timeframe from '../../../src/core/Timeframe.js';

describe('TrackScheduler', () => {
  let track;
  let stack;
  let scheduler;
  let controller;
  let timeframe;

  beforeEach(() => {
    controller = new Controller();
    track = new Track({ controller });
    stack = new Stack();
    scheduler = new TrackScheduler(track, stack);
    timeframe = new Timeframe({
      anchor: 0,
      realEnd: 100,
      currentTime: 0,
      playDuration: 100,
      offset: 0,
    });
  });

  afterEach(() => {
    scheduler.reset();
  });

  describe('#reset', () => {
    it('disconnects stack and clears state', () => {
      const disconnectSpy = sinon.spy(stack, 'disconnectAll');
      scheduler.reset();
      expect(disconnectSpy.calledOnce).to.be.true;
    });
  });

  describe('#getNextSegments', () => {
    it('returns segments within the lookahead window', () => {
      const segment1 = { start: 0, duration: 4, end: 4, $inTransit: false, isReady: false };
      const segment2 = {
        start: 4,
        duration: 4,
        end: 8,
        $inTransit: false,
        isReady: false,
        prev: segment1,
      };
      const segment3 = {
        start: 8,
        duration: 4,
        end: 12,
        $inTransit: false,
        isReady: false,
        prev: segment2,
      };
      segment1.next = segment2;
      segment2.next = segment3;

      const segments = scheduler.getNextSegments(timeframe, segment1);

      // Should include segment1, segment2, segment3 since they fit in 10s lookahead
      expect(segments).to.include(segment1);
      expect(segments).to.include(segment2);
      expect(segments).to.include(segment3);
      expect(segments.length).to.equal(3);
    });

    it('ignores segments outside of timeframe window', () => {
      timeframe = new Timeframe({
        anchor: 0,
        realEnd: 2,
        currentTime: 0,
        playDuration: 2,
        offset: 0,
      });

      const segment1 = { start: 0, duration: 5, end: 5, $inTransit: false, isReady: false };
      const segment2 = {
        start: 5,
        duration: 5,
        end: 10,
        $inTransit: false,
        isReady: false,
        prev: segment1,
      };
      segment1.next = segment2;

      const segments = scheduler.getNextSegments(timeframe, segment1);

      // segment2 is outside the timeframe end (2)
      expect(segments).to.include(segment1);
      expect(segments).to.not.include(segment2);
    });

    it('ignores in-transit or ready segments', () => {
      const segment1 = { start: 0, duration: 4, end: 4, $inTransit: true, isReady: false };
      const segment2 = {
        start: 4,
        duration: 4,
        end: 8,
        $inTransit: false,
        isReady: true,
        prev: segment1,
      };
      const segment3 = {
        start: 8,
        duration: 4,
        end: 12,
        $inTransit: false,
        isReady: false,
        prev: segment2,
      };
      segment1.next = segment2;
      segment2.next = segment3;

      const segments = scheduler.getNextSegments(timeframe, segment1);
      expect(segments).to.not.include(segment1); // in transit
      expect(segments).to.not.include(segment2); // is ready
      expect(segments).to.include(segment3);
      expect(segments.length).to.equal(1);
    });
  });

  describe('#evictOldCaches', () => {
    it('unloads caches perfectly out of immediate playback scope', () => {
      const segmentMock = (i) => ({
        id: i,
        isLoaded: true,
        isReady: false,
        unloadCache: sinon.spy(),
      });

      const sPrev5 = segmentMock(-5);
      const sPrev4 = segmentMock(-4);
      const sPrev3 = segmentMock(-3);
      const sPrev2 = segmentMock(-2);
      const sPrev1 = segmentMock(-1);
      const sCurr = segmentMock(0);
      const sNext1 = segmentMock(1);
      const sNext2 = segmentMock(2);
      const sNext3 = segmentMock(3);
      const sNext4 = segmentMock(4);
      const sNext5 = segmentMock(5);

      sPrev5.next = sPrev4;
      sPrev4.prev = sPrev5;
      sPrev4.next = sPrev3;
      sPrev3.prev = sPrev4;
      sPrev3.next = sPrev2;
      sPrev2.prev = sPrev3;
      sPrev2.next = sPrev1;
      sPrev1.prev = sPrev2;
      sPrev1.next = sCurr;
      sCurr.prev = sPrev1;
      sCurr.next = sNext1;
      sNext1.prev = sCurr;
      sNext1.next = sNext2;
      sNext2.prev = sNext1;
      sNext2.next = sNext3;
      sNext3.prev = sNext2;
      sNext3.next = sNext4;
      sNext4.prev = sNext3;
      sNext4.next = sNext5;
      sNext5.prev = sNext4;

      scheduler.evictOldCaches(sCurr);

      expect(sPrev4.unloadCache.calledOnce).to.be.true; // prev 4
      expect(sNext4.unloadCache.calledOnce).to.be.true; // next 4

      // Ensure others weren't touched
      [sPrev5, sPrev3, sPrev2, sPrev1, sCurr, sNext1, sNext2, sNext3, sNext5].forEach((s) => {
        expect(s.unloadCache.called).to.be.false;
      });
    });
  });

  describe('#scheduleAt', () => {
    it('loads and connects segments, updates timings', async () => {
      const loadPromise = Promise.resolve();
      const segment = {
        isLoaded: false,
        duration: 10,
        end: 15,
        load: sinon.stub().returns({ promise: loadPromise }),
        connect: sinon.stub().resolves(),
      };

      const calcOffsetSpy = sinon.stub(timeframe, 'calculateOffset').returns(2);
      const calcStartSpy = sinon.stub(timeframe, 'calculateRealStart').returns(5);

      const emitSpy = sinon.spy(track.controller, 'notify');
      const recalcSpy = sinon.spy(stack, 'recalculateStartTimes');

      await scheduler.scheduleAt(timeframe, segment);

      expect(segment.$inTransit).to.be.false;
      expect(segment.load.calledOnce).to.be.true;

      expect(
        segment.connect.calledWith({
          ac: track.controller.ac,
          destination: track.gainNode,
          start: 5,
          offset: 2,
          stop: 100, // realEnd
        }),
      ).to.be.true;

      expect(recalcSpy.calledWith(segment)).to.be.true;
      expect(emitSpy.calledWith('loading-start', track)).to.be.true;
      expect(emitSpy.calledWith('loading-end', track)).to.be.true;
    });

    it('catches errors gracefully and fires error events', async () => {
      const error = new Error('Connection failed');
      const segment = {
        isLoaded: true,
        duration: 10,
        end: 15,
        connect: sinon.stub().rejects(error),
      };

      const emitSpy = sinon.spy(track.controller, 'notify');

      await scheduler.scheduleAt(timeframe, segment);

      expect(segment.$inTransit).to.be.false;
      expect(emitSpy.calledWith('error', error)).to.be.true;
    });

    it('ignores AbortError errors silently', async () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      const segment = {
        isLoaded: true,
        duration: 10,
        end: 15,
        connect: sinon.stub().rejects(error),
      };

      const emitSpy = sinon.spy(track.controller, 'notify');

      await scheduler.scheduleAt(timeframe, segment);

      expect(segment.$inTransit).to.be.false;
      expect(emitSpy.calledWith('error', error)).to.be.false;
    });
  });

  describe('#runSchedulePass', () => {
    it('sets $inTransit to true on next segments and calls scheduleAt', async () => {
      const segment1 = { start: 0, duration: 5, end: 5, $inTransit: false, isReady: false };
      sinon.stub(stack, 'getAt').returns(segment1);

      sinon.stub(scheduler, 'getNextSegments').returns([segment1]);
      const scheduleAtStub = sinon.stub(scheduler, 'scheduleAt').resolves();

      await scheduler.runSchedulePass(timeframe);

      expect(segment1.$inTransit).to.be.true;
      expect(scheduleAtStub.calledOnceWith(timeframe, segment1)).to.be.true;
    });
  });
});
