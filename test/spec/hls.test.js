import { expect } from '@bundled-es-modules/chai';
import sinon from 'sinon';
import HLS from '../../src/hls';
import Controller from '../../src/controller';

describe('hls', () => {
  describe('#constructor', () => {
    describe('when #controller = undefined', () => {
      it('instantiates a new controller', () => {
        const hls = new HLS();
        expect(hls.controller instanceof Controller);
      });
    });

    describe('when #controller != undefined', () => {
      it('sets #controller', () => {
        const controller = new Controller();
        const hls = new HLS({ controller });
        expect(hls.controller).equal(controller);
      });
    });

    it('notifies the controller to #controller.observe this HLS instance', () => {
      const controller = new Controller();
      controller.observe = sinon.spy();
      const hls = new HLS({ controller });

      expect(controller.observe.calledOnceWith(hls));
    });

    it('subscribes to #controller timeupdate event', () => {
      const controller = new Controller();
      const hls = new HLS({ controller });
      hls.runSchedulePass = sinon.spy();

      controller.fireEvent('timeupdate');

      expect(hls.runSchedulePass.calledOnce);
    });

    it('subscribes to #controller seek event', () => {
      const controller = new Controller();
      const hls = new HLS({ controller });
      hls.runSchedulePass = sinon.spy();

      controller.fireEvent('seek');

      expect(hls.runSchedulePass.calledOnce);
    });

    it('creates a gainNode', () => {
      const hls = new HLS();
      expect(hls.gainNode instanceof GainNode);
    });

    it('connects the gainNode to the #controller.gainNode', () => {
      const controller = new Controller();
      const mockGain = { connect: sinon.spy(), gain: {} };
      controller.ac = { createGain: () => mockGain, addEventListener: () => {} };
      const hls = new HLS({ controller });
      expect(hls.gainNode.connect.calledOnceWith(controller.gainNode));
    });

    it('sets #fetchOptions', async () => {
      const fetchOptions = {
        headers: {
          Authorization: 'Bearer blah',
        },
      };

      const hls = new HLS({
        fetchOptions,
      });

      expect(hls.fetchOptions).equal(fetchOptions);
    });
  });

  describe('#destroy', () => {
    let hls;

    beforeEach(() => {
      hls = new HLS();
    });

    it('cancels any pending get m3u8 playlist requests', async () => {
      hls.load('http://localhost:9876/test/fixtures/stem1.m3u8');
      hls.loadHandle = { cancel: sinon.spy() };

      hls.destroy();

      expect(hls.loadHandle.cancel.calledOnce);
    });

    it('tells the controller to stop observing the hls instance', () => {
      const { controller } = hls;
      hls.destroy();

      // TODO, #controller.hls is/should be private(?), so we shouldnt mess with it. Test in another way.
      expect(controller.hls.indexOf(hls)).equal(-1);
    });

    it('destroys the stack', async () => {
      await hls.load('http://localhost:9876/test/fixtures/stem1.m3u8').promise;

      // TODO, segments is/should be private(?), so we shouldnt mess with it. Test in another way.
      const mockSegment = { destroy: sinon.spy() };
      hls.stack.push(mockSegment);

      hls.destroy();

      expect(mockSegment.destroy.calledOnce);
    });
  });

  describe('#load', () => {
    let hls;

    beforeEach(() => {
      hls = new HLS();
    });

    it('parses the m3u8 and pushes the segments onto the stack', async () => {
      await hls.load('http://localhost:9876/test/fixtures/stem1.m3u8').promise;

      expect(hls.duration).equal(30.015999);
      expect(hls.stack.length).equal(3);
      expect(hls.stack.getAt(0).start).equal(0);
      expect(hls.stack.getAt(11).start).equal(10.005333);
      expect(hls.stack.getAt(21).start).equal(20.010666);
    });

    it('returns an object containing #promise and #cancel', () => {
      const { promise, cancel } = hls.load('http://localhost:9876/test/fixtures/stem1.m3u8');

      expect(typeof promise === 'object');
      expect(typeof cancel === 'function');
    });

    it('uses #fetchOptions if these are set', async () => {
      let requestOptions;

      hls = new HLS({
        fetchOptions: {
          headers: {
            Authorization: 'Bearer blah',
          },
        },
        // inject a mock fetch
        fetch: (url, opts) => {
          requestOptions = opts;
          return fetch(url, opts);
        },
      });

      await hls.load('http://localhost:9876/test/fixtures/stem1.m3u8').promise;

      expect(requestOptions.headers.Authorization).equal('Bearer blah');
    });

    it('sets the accept header', async () => {
      let requestOptions;

      hls = new HLS({
        // inject a mock fetch
        fetch: (url, opts) => {
          requestOptions = opts;
          return fetch(url, opts);
        },
      });

      await hls.load('http://localhost:9876/test/fixtures/stem1.m3u8').promise;

      expect(requestOptions.headers.Accept).equal(
        'application/x-mpegURL, application/vnd.apple.mpegurl',
      );
    });
  });

  describe('#loadFromM3u8', () => {
    let hls;

    beforeEach(() => {
      hls = new HLS();
    });

    it('constructs segments from the data in the m3u8', async () => {
      const manifest = await fetch('http://localhost:9876/test/fixtures/stem1.m3u8').then(
        (response) => response.text(),
      );

      hls.loadFromM3u8(manifest, 'http://localhost:9876/test/fixtures/stem1.m3u8');

      expect(hls.duration).equal(30.015999);
      expect(hls.stack.length).equal(3);
      expect(hls.stack.getAt(0).start).equal(0);
      expect(hls.stack.getAt(11).start).equal(10.005333);
      expect(hls.stack.getAt(21).start).equal(20.010666);
    });
  });

  describe('#duration', () => {
    let hls;

    beforeEach(() => {
      hls = new HLS();
      return hls.load('http://localhost:9876/test/fixtures/stem1.m3u8').promise;
    });

    it('returns the total duration from the combined segments', async () => {
      expect(hls.duration).equal(30.015999);
    });
  });

  describe('#onSeek', () => {
    let hls;

    beforeEach(async () => {
      hls = new HLS();
      await hls.load('http://localhost:9876/test/fixtures/stem1.m3u8').promise;
      hls.controller.adjustedStart = -10; // seek to 10. NOTE: if we seek using .currentTime it will trigger a seek event which will cause a runSchedulePass
    });

    afterEach(() => hls.destroy());

    it('disconnects all segments', async () => {
      await hls.runSchedulePass(); // loads the current one and marks the current segment as ready (only segments that are ready will have to be disconnected)

      const current = hls.stack.getAt(0);

      current.disconnect = sinon.spy();

      hls.controller.currentTime = 10; // initiate the seek which will trigger the disconnect

      expect(current.disconnect.calledOnce);
    });

    it('cancels any segment loading', async () => {
      const current = hls.stack.getAt(0);

      current.cancel = sinon.spy();

      hls.controller.currentTime = 8; // initiate the seek which will trigger the disconnect

      expect(current.cancel.calledOnce);
    });
  });

  describe('runSchedulePass', () => {
    let hls;

    describe('if the current segment is not loaded', () => {
      beforeEach(async () => {
        hls = new HLS();
        await hls.load('http://localhost:9876/test/fixtures/stem1.m3u8').promise;
        hls.controller.adjustedStart = -10; // seek to 10. NOTE: if we seek using .currentTime it will trigger a seek event which will cause a runSchedulePass
      });

      it('loads the current segment and connects it', async () => {
        const current = hls.stack.getAt(hls.controller.currentTime);
        current.connect = sinon.spy();

        await hls.runSchedulePass();

        expect(current.connect.calledOnce);
      });
    });

    describe('if the current segment is loaded', () => {
      describe('if the next segment is not loaded', () => {
        beforeEach(async () => {
          hls = new HLS();
          await hls.load('http://localhost:9876/test/fixtures/stem1.m3u8').promise;
          hls.controller.adjustedStart = -10; // seek to 10. NOTE: if we seek using .currentTime it will trigger a seek event which will cause a runSchedulePass
          await hls.runSchedulePass(); // loads the current one, so the next call should load the next segment
        });

        it('loads the next segment and connects it', async () => {
          const currentIndex = hls.stack.getIndexAt(0);
          const current = hls.stack.elements[currentIndex];
          const next = hls.stack.elements[currentIndex + 1];

          current.connect = sinon.spy();
          next.connect = sinon.spy();

          await hls.runSchedulePass();

          expect(!current.connect.calledOnce);
          expect(next.connect.calledOnce);
        });
      });

      describe('if the next segment is loaded', () => {
        beforeEach(async () => {
          hls = new HLS();
          await hls.load('http://localhost:9876/test/fixtures/stem1.m3u8').promise;
          hls.controller.adjustedStart = -10; // seek to 10. NOTE: if we seek using .currentTime it will trigger a seek event which will cause a runSchedulePass
        });

        it('does nothing', async () => {
          // await hls.runSchedulePass(); // loads the current one
          // await hls.runSchedulePass(); // loads the next one

          const currentIndex = hls.stack.getIndexAt(0);
          const current = hls.stack.elements[currentIndex];
          const next = hls.stack.elements[currentIndex + 1];

          // sets them as loaded (easier than really loading via runSchedulePass)
          current.sourceNode = {};
          next.sourceNode = {};

          current.connect = sinon.spy();
          next.connect = sinon.spy();

          await hls.runSchedulePass();

          // test that the third run did not call either
          expect(!current.connect.calledOnce);
          expect(!next.connect.calledOnce);
        });
      });
    });
  });

  describe('#volume', () => {
    let hls;

    beforeEach(async () => {
      hls = new HLS();
    });

    it('return #volume = 1 (default)', () => {
      expect(hls.volume).equal(1);
    });

    it('sets the volume on the gainNode', () => {
      hls.volume = 0.5;
      expect(hls.volume).equal(0.5);
    });
  });

  describe('#cancel', () => {
    let hls;

    beforeEach(() => {
      hls = new HLS();
    });

    it('does not throw an error when canceling a pending m3u8 request', async () => {
      const { promise, cancel } = hls.load('http://localhost:9876/test/fixtures/stem1.m3u8');

      cancel();

      let aborted = false;

      await promise.catch((err) => {
        if (err.name === 'AbortError') aborted = true;
      });

      expect(!aborted);
    });
  });

  describe('canPlay', async () => {
    let hls;

    beforeEach(async () => {
      hls = new HLS();
      await hls.load('http://localhost:9876/test/fixtures/stem1.m3u8').promise;
      hls.controller.adjustedStart = -10; // seek to 10. NOTE: if we seek using .currentTime it will trigger a seek event which will cause a runSchedulePass
    });

    it('returns false the current segment is not ready', () => {
      expect(!hls.canPlay);
    });

    it('returns true the current segment is ready', async () => {
      await hls.runSchedulePass(); // loads the current one

      expect(hls.canPlay);
    });
  });
});
