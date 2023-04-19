import assert from 'assert';
import sinon from 'sinon';
import HLS from '../../src/hls';
import Controller from '../../src/controller';

describe('hls', () => {
  describe('#constructor', () => {
    describe('when #controller = undefined', () => {
      it('instantiates a new controller', () => {
        const hls = new HLS();
        assert(hls.controller instanceof Controller);
      });
    });

    describe('when #controller != undefined', () => {
      it('sets #controller', () => {
        const controller = new Controller();
        const hls = new HLS({ controller });
        assert.strictEqual(hls.controller, controller);
      });
    });

    it('notifies the controller to #controller.observe this HLS instance', () => {
      const controller = new Controller();
      controller.observe = sinon.spy();
      const hls = new HLS({ controller });

      assert(controller.observe.calledOnceWith(hls));
    });

    it('subscribes to #controller timeupdate event', () => {
      const controller = new Controller();
      const hls = new HLS({ controller });
      hls.runSchedulePass = sinon.spy();

      controller.fireEvent('timeupdate');

      assert(hls.runSchedulePass.calledOnce);
    });

    it('subscribes to #controller seek event', () => {
      const controller = new Controller();
      const hls = new HLS({ controller });
      hls.runSchedulePass = sinon.spy();

      controller.fireEvent('seek');

      assert(hls.runSchedulePass.calledOnce);
    });

    it('creates a gainNode', () => {
      const hls = new HLS();
      assert(hls.gainNode instanceof GainNode);
    });

    it('connects the gainNode to the #controller.gainNode', () => {
      const controller = new Controller();
      const mockGain = { connect: sinon.spy(), gain: {} };
      controller.ac = { createGain: () => mockGain, addEventListener: () => {} };
      const hls = new HLS({ controller });
      assert(hls.gainNode.connect.calledOnceWith(controller.gainNode));
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

      assert.strictEqual(hls.fetchOptions, fetchOptions);
    });
  });

  describe('#destroy', () => {
    let hls;

    beforeEach(() => {
      hls = new HLS();
    });

    it('cancels any pending get m3u8 playlist requests', async () => {
      hls.load('http://localhost:9876/base/test/fixtures/stem1.m3u8');
      hls.loadHandle = { cancel: sinon.spy() };

      hls.destroy();

      assert(hls.loadHandle.cancel.calledOnce);
    });

    it('tells the controller to stop observing the hls instance', () => {
      const { controller } = hls;
      hls.destroy();

      // TODO, #controller.hls is/should be private(?), so we shouldnt mess with it. Test in another way.
      assert(controller.hls.indexOf(hls) === -1);
    });

    it('destroys the stack', async () => {
      await hls.load('http://localhost:9876/base/test/fixtures/stem1.m3u8').promise;

      // TODO, segments is/should be private(?), so we shouldnt mess with it. Test in another way.
      const mockSegment = { destroy: sinon.spy() };
      hls.stack.push(mockSegment);

      hls.destroy();

      assert(mockSegment.destroy.calledOnce);
    });
  });

  describe('#load', () => {
    let hls;

    beforeEach(() => {
      hls = new HLS();
    });

    it('parses the m3u8 and pushes the segments onto the stack', async () => {
      await hls.load('http://localhost:9876/base/test/fixtures/stem1.m3u8').promise;

      assert.strictEqual(hls.duration, 30.015999);
      assert.strictEqual(hls.stack.length, 3);
      assert.strictEqual(hls.stack.getAt(0).start, 0);
      assert.strictEqual(hls.stack.getAt(11).start, 10.005333);
      assert.strictEqual(hls.stack.getAt(21).start, 20.010666);
    });

    it('returns an object containing #promise and #cancel', () => {
      const { promise, cancel } = hls.load('http://localhost:9876/base/test/fixtures/stem1.m3u8');

      assert(typeof promise === 'object');
      assert(typeof cancel === 'function');
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
          return Promise.resolve({ ok: true, text: () => {} });
        },
      });

      await hls.load('http://localhost:9876/base/test/fixtures/stem1.m3u8').promise;

      assert.strictEqual(requestOptions.headers.Authorization, 'Bearer blah');
    });

    it('sets the accept header', async () => {
      let requestOptions;

      hls = new HLS({
        // inject a mock fetch
        fetch: (url, opts) => {
          requestOptions = opts;
          return Promise.resolve({ ok: true, text: () => {} });
        },
      });

      await hls.load('http://localhost:9876/base/test/fixtures/stem1.m3u8').promise;

      assert.strictEqual(
        requestOptions.headers.Accept,
        'application/x-mpegURL, application/vnd.apple.mpegurl'
      );
    });
  });

  describe('#loadFromM3u8', () => {
    let hls;

    beforeEach(() => {
      hls = new HLS();
    });

    it('constructs segments from the data in the m3u8', async () => {
      const manifest = await fetch('http://localhost:9876/base/test/fixtures/stem1.m3u8').then(
        (response) => response.text()
      );

      hls.loadFromM3u8(manifest);

      assert.strictEqual(hls.duration, 30.015999);
      assert.strictEqual(hls.stack.length, 3);
      assert.strictEqual(hls.stack.getAt(0).start, 0);
      assert.strictEqual(hls.stack.getAt(11).start, 10.005333);
      assert.strictEqual(hls.stack.getAt(21).start, 20.010666);
    });
  });

  describe('#duration', () => {
    let hls;

    beforeEach(() => {
      hls = new HLS();
      return hls.load('http://localhost:9876/base/test/fixtures/stem1.m3u8').promise;
    });

    it('returns the total duration from the combined segments', async () => {
      assert.strictEqual(hls.duration, 30.015999);
    });
  });

  describe('#onSeek', () => {
    let hls;

    beforeEach(async () => {
      hls = new HLS();
      await hls.load('http://localhost:9876/base/test/fixtures/stem1.m3u8').promise;
      hls.controller.adjustedStart = -10; // seek to 10. NOTE: if we seek using .currentTime it will trigger a seek event which will cause a runSchedulePass
    });

    afterEach(() => hls.destroy());

    it('disconnects all segments', async () => {
      await hls.runSchedulePass(); // loads the current one and marks the current segment as ready (only segments that are ready will have to be disconnected)

      const { current } = hls.stack;

      current.disconnect = sinon.spy();

      hls.controller.currentTime = 10; // initiate the seek which will trigger the disconnect

      assert(current.disconnect.calledOnce);
    });

    it('cancels any segment loading', async () => {
      hls.stack.current.cancel = sinon.spy();

      hls.controller.currentTime = 8; // initiate the seek which will trigger the disconnect

      assert(hls.stack.current.cancel.calledOnce);
    });
  });

  describe('runSchedulePass', () => {
    let hls;

    describe('if the current segment is not loaded', () => {
      beforeEach(async () => {
        hls = new HLS();
        await hls.load('http://localhost:9876/base/test/fixtures/stem1.m3u8').promise;
        hls.controller.adjustedStart = -10; // seek to 10. NOTE: if we seek using .currentTime it will trigger a seek event which will cause a runSchedulePass
      });

      it('loads the current segment and connects it', async () => {
        const current = hls.stack.getAt(hls.controller.currentTime);
        current.connect = sinon.spy();

        await hls.runSchedulePass();

        assert(current.connect.calledOnce);
      });
    });

    describe('if the current segment is loaded', () => {
      describe('if the next segment is not loaded', () => {
        beforeEach(async () => {
          hls = new HLS();
          await hls.load('http://localhost:9876/base/test/fixtures/stem1.m3u8').promise;
          hls.controller.adjustedStart = -10; // seek to 10. NOTE: if we seek using .currentTime it will trigger a seek event which will cause a runSchedulePass
          await hls.runSchedulePass(); // loads the current one, so the next call should load the next segment
        });

        it('loads the next segment and connects it', async () => {
          const { current, next } = hls.stack;

          current.connect = sinon.spy();
          next.connect = sinon.spy();

          await hls.runSchedulePass();

          assert(!current.connect.calledOnce);
          assert(next.connect.calledOnce);
        });
      });

      describe('if the next segment is loaded', () => {
        beforeEach(async () => {
          hls = new HLS();
          await hls.load('http://localhost:9876/base/test/fixtures/stem1.m3u8').promise;
          hls.controller.adjustedStart = -10; // seek to 10. NOTE: if we seek using .currentTime it will trigger a seek event which will cause a runSchedulePass
        });

        it('does nothing', async () => {
          // await hls.runSchedulePass(); // loads the current one
          // await hls.runSchedulePass(); // loads the next one

          const { current, next } = hls.stack;

          // sets them as loaded (easier than really loading via runSchedulePass)
          current.sourceNode = {};
          next.sourceNode = {};

          current.connect = sinon.spy();
          next.connect = sinon.spy();

          await hls.runSchedulePass();

          // test that the third run did not call either
          assert(!current.connect.calledOnce);
          assert(!next.connect.calledOnce);
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
      assert.strictEqual(hls.volume, 1);
    });

    it('sets the volume on the gainNode', () => {
      hls.volume = 0.5;
      assert.strictEqual(hls.volume, 0.5);
    });
  });

  describe('#cancel', () => {
    let hls;

    beforeEach(() => {
      hls = new HLS();
    });

    it('does not throw an error when canceling a pending m3u8 request', async () => {
      const { promise, cancel } = hls.load('http://localhost:9876/base/test/fixtures/stem1.m3u8');

      cancel();

      let aborted = false;

      await promise.catch((err) => {
        if (err.name === 'AbortError') aborted = true;
      });

      assert(!aborted);
    });
  });

  describe('canPlay', async () => {
    let hls;

    beforeEach(async () => {
      hls = new HLS();
      await hls.load('http://localhost:9876/base/test/fixtures/stem1.m3u8').promise;
      hls.controller.adjustedStart = -10; // seek to 10. NOTE: if we seek using .currentTime it will trigger a seek event which will cause a runSchedulePass
    });

    it('returns false the current segment is not ready', () => {
      assert(!hls.canPlay);
    });

    it('returns true the current segment is ready', async () => {
      await hls.runSchedulePass(); // loads the current one

      assert(hls.canPlay);
    });
  });
});
