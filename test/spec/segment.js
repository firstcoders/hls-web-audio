import assert from 'assert';
import sinon from 'sinon';
import { Controller } from '../..';
import Segment from '../../src/segment';

describe('segment', () => {
  let segment;
  beforeEach(() => {
    segment = new Segment({
      src: 'http://localhost:9876/base/test/fixtures/stem1_segment1.mp3',
      duration: 10.005333,
    });
  });

  describe('#constructor', () => {
    it('sets the src', () => {
      assert.strictEqual(
        segment.src,
        'http://localhost:9876/base/test/fixtures/stem1_segment1.mp3'
      );
    });

    it('sets the duration', () => {
      assert.strictEqual(segment.duration, 10.005333);
    });
  });

  describe('#destroy', () => {
    it('cancels any in progress loading', () => {
      segment.cancel = sinon.spy();

      segment.destroy();

      assert(segment.cancel.calledOnce);
    });

    it('disconnects any audio sourceNode', async () => {
      const controller = new Controller();
      await segment.load().promise;
      await segment.connect({ controller, destination: controller.destination });

      assert(segment.isReady);

      segment.destroy();

      assert(!segment.isReady);
    });

    it('cleans up properties', async () => {
      await segment.load().promise;

      assert(segment.arrayBuffer instanceof ArrayBuffer);

      segment.destroy();

      assert(segment.arrayBuffer === null);
    });
  });

  describe('#load', () => {
    beforeEach(async () => {
      await segment.load().promise;
    });

    it('loads the audio', () => {
      assert(segment.arrayBuffer instanceof ArrayBuffer);
    });
  });

  describe('#connect', () => {
    let controller;
    beforeEach(async () => {
      controller = new Controller();
      await segment.load().promise;
      await segment.connect({ controller, destination: controller.destination });
    });

    it('connects a audionode', async () => {
      assert(segment.isReady);
      assert(segment.sourceNode !== null);
    });

    it('cleans up the raw audiodata after connecting', () => {
      assert(segment.arrayBuffer === null);
    });
  });

  describe('#disconnect', () => {
    let controller;
    beforeEach(async () => {
      controller = new Controller();
    });

    it('disconnects the audionode', async () => {
      await segment.load().promise;
      await segment.connect({ controller, destination: controller.destination });

      assert(segment.isReady);

      segment.disconnect();

      assert(!segment.isReady);
      assert(segment.sourceNode === null);
    });
  });

  describe('#isReady', () => {
    let controller;
    beforeEach(async () => {
      controller = new Controller();
    });

    it('returns false if an audionode is not connected', async () => {
      assert(!segment.isReady);
    });

    it('returns true if an audionode is connected', async () => {
      await segment.load().promise;
      await segment.connect({ controller, destination: controller.destination });

      assert(segment.isReady);
    });
  });

  describe('#cancel', () => {
    it('cancels any in-flight xhr requests', async () => {
      let thrownError;

      try {
        const { promise } = segment.load();
        segment.cancel();
        await promise;
      } catch (err) {
        thrownError = err;
      }

      assert.strictEqual(thrownError.name, 'AbortError');
    });
  });

  describe('#end', () => {
    describe('when start is set to 10', () => {
      beforeEach(() => {
        segment.start = 10;
      });
      it('returns the end time', () => {
        assert.strictEqual(segment.end, 20.005333);
      });
    });

    describe('when start is set to undefined', () => {
      it('returns undefined', () => {
        assert.strictEqual(segment.end, undefined);
      });
    });
  });
});
