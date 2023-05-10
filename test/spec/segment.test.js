import { expect } from '@bundled-es-modules/chai';
import sinon from 'sinon';
import Controller from '../../src/controller';
import Segment from '../../src/segment';

describe('segment', () => {
  let segment;
  beforeEach(() => {
    segment = new Segment({
      src: 'http://localhost:9876/test/fixtures/stem1_segment1.mp3',
      duration: 10.005333,
    });
  });

  describe('#constructor', () => {
    it('sets the src', () => {
      expect(segment.src.toString()).equal(
        'http://localhost:9876/test/fixtures/stem1_segment1.mp3'
      );
    });

    it('sets the duration', () => {
      expect(segment.duration).equal(10.005333);
    });
  });

  describe('#destroy', () => {
    it('cancels any in progress loading', () => {
      segment.cancel = sinon.spy();

      segment.destroy();

      expect(segment.cancel.calledOnce);
    });

    it('disconnects any audio sourceNode', async () => {
      const controller = new Controller();
      await segment.load().promise;
      await segment.connect({ controller, destination: controller.destination });

      expect(segment.isReady);

      segment.destroy();

      expect(!segment.isReady);
    });

    it('cleans up properties', async () => {
      await segment.load().promise;

      expect(segment.arrayBuffer instanceof ArrayBuffer);

      segment.destroy();

      expect(segment.arrayBuffer === null);
    });
  });

  describe('#load', () => {
    beforeEach(async () => {
      await segment.load().promise;
    });

    it('loads the audio', () => {
      expect(segment.arrayBuffer instanceof ArrayBuffer);
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
      expect(segment.isReady);
      expect(segment.sourceNode !== null);
    });

    it('cleans up the raw audiodata after connecting', () => {
      expect(segment.arrayBuffer === null);
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

      expect(segment.isReady);

      segment.disconnect();

      expect(!segment.isReady);
      expect(segment.sourceNode === null);
    });
  });

  describe('#isReady', () => {
    let controller;
    beforeEach(async () => {
      controller = new Controller();
    });

    it('returns false if an audionode is not connected', async () => {
      expect(!segment.isReady);
    });

    it('returns true if an audionode is connected', async () => {
      await segment.load().promise;
      await segment.connect({ controller, destination: controller.destination });

      expect(segment.isReady);
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

      expect(thrownError.name).equal('AbortError');
    });
  });

  describe('#end', () => {
    describe('when start is set to 10', () => {
      beforeEach(() => {
        segment.start = 10;
      });
      it('returns the end time', () => {
        expect(segment.end).equal(20.005333);
      });
    });

    describe('when start is set to undefined', () => {
      it('returns undefined', () => {
        expect(segment.end).equal(undefined);
      });
    });
  });
});
