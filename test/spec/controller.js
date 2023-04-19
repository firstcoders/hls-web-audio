import assert from 'assert';
import sinon from 'sinon';
import Controller from '../../src/controller';

describe('controller', () => {
  describe('#constructor', () => {
    it('constructs', () => {
      const controller = new Controller();
      assert(controller instanceof Controller);
    });

    describe('#ac', () => {
      describe('when #ac = undefined', () => {
        let controller;

        beforeEach(() => {
          controller = new Controller({ acOpts: { sampleRate: 33333 } });
        });

        it('creates a audioContext with #acOpts', () => {
          assert(controller.ac instanceof AudioContext);
          assert.strictEqual(controller.ac.sampleRate, 33333);
        });
      });

      describe('when #ac is provided', () => {
        let controller;
        let ac;

        beforeEach(() => {
          ac = new AudioContext();
          controller = new Controller({ ac });
        });

        it('sets the #ac', () => {
          assert.strictEqual(controller.ac, ac);
        });
      });

      describe('ac#onstatechange', () => {
        let controller;
        let ticks = 0;

        beforeEach(() => {
          controller = new Controller();
        });

        it('starts ticking when the audiocontext starts', async () => {
          assert(controller.ac.state === 'suspended');

          await controller.ac.resume();

          await new Promise((done) => {
            controller.on('timeupdate', done);
            ticks += 1;
          });

          assert(ticks > 0);
        });

        it('stop ticking when the audiocontext stops', async () => {
          await controller.ac.resume();

          assert(controller.ac.state === 'running');

          const ticksBeforeSuspend = ticks;

          await controller.ac.suspend();

          await new Promise((done) => {
            setTimeout(done, 200);
          });

          assert(ticksBeforeSuspend === ticks);
        });
      });
    });

    describe('#refreshRate', () => {
      let controller;

      describe('when #refreshRate = undefined', () => {
        beforeEach(() => {
          controller = new Controller();
        });
        it('sets #refreshRate=250 (default)', () => {
          assert.strictEqual(controller.refreshRate, 250);
        });
      });

      describe('when #refreshRate = 500', () => {
        beforeEach(() => {
          controller = new Controller({ refreshRate: 500 });
        });
        it('sets #refreshRate=100', () => {
          assert.strictEqual(controller.refreshRate, 500);
        });
      });
    });

    describe('#destination', () => {
      describe('when #destination = undefined (default)', () => {
        it('uses the #ac destination', () => {
          const controller = new Controller();
          assert.strictEqual(controller.destination, controller.ac.destination);
        });
      });
      describe('when #destination = set', () => {
        it('sets #destination', () => {
          const ac = new AudioContext();
          const processor = ac.createScriptProcessor();
          const controller = new Controller({ ac, destination: processor });
          assert.strictEqual(controller.destination, processor);
        });
      });
    });

    describe('#gainNode', () => {
      it('creates a gainNode', () => {
        const controller = new Controller();
        assert(controller.gainNode instanceof GainNode);
      });
      it('connects the gainNode to the destination', () => {
        const controller = new Controller({
          ac: {
            destination: {},
            createGain() {
              return {
                connect: sinon.spy(),
              };
            },
            suspend() {},
            addEventListener: () => {},
          },
        });
        assert(controller.gainNode.connect.calledWith(controller.destination));
      });
    });
  });

  describe('#destroy', () => {
    let controller;
    beforeEach(() => {
      controller = new Controller();
      controller.observe({ duration: 100 });
    });

    it('stops ticking', async () => {
      let ticks = 0;
      controller.on('timeupdate', () => {
        ticks += 1;
      });

      await controller.play();

      await new Promise((done) => {
        setTimeout(done, 100);
      });

      assert(ticks > 0);

      const ticksBeforeDestroy = ticks;

      controller.destroy();

      await new Promise((done) => {
        setTimeout(done, 100);
      });

      assert.strictEqual(ticksBeforeDestroy, ticks);
    });

    it('disconnects the gainNode', () => {
      const { gainNode } = controller;
      controller.gainNode.disconnect = sinon.spy();

      controller.destroy();

      assert(gainNode.disconnect.calledOnce);
      assert(controller.gainNode === null);
    });

    it('detaches the audioContext', () => {
      assert(controller.ac instanceof AudioContext);

      controller.destroy();

      assert(controller.ac === null);
    });

    it('removes any references to hls instances', () => {
      assert(controller.hls.length > 0);

      controller.destroy();

      assert(controller.hls.length === 0);
    });

    describe('when the controller created the audioContext', () => {
      it('closes the audioContext', () => {
        const spy = sinon.spy();

        controller.ac.close = spy;

        controller.destroy();

        assert(spy.calledOnce);
      });
    });

    describe('when the an audioContext was provided', () => {
      it('does not close the audioContext', () => {
        const ac = new AudioContext();
        ac.close = sinon.spy();

        const controller2 = new Controller({ ac });

        controller2.destroy();

        assert(!ac.close.calledOnce);
      });
    });

    it('unregisters any event listeners', () => {
      controller.unAll = sinon.spy();
      controller.destroy();
      assert(controller.unAll.calledOnce);
    });
  });

  describe('#observe', () => {
    let hls;
    let controller;

    beforeEach(() => {
      controller = new Controller();
      hls = {};
    });

    describe('when a hls track is not yet observed', () => {
      it('is obseved by the controller', () => {
        assert(controller.hls.length === 0);
        controller.observe(hls);
        assert(controller.hls.length === 1);
        assert.strictEqual(controller.hls[0], hls);
      });
    });

    describe('when a hls track is already obseved', () => {
      beforeEach(() => {
        controller.observe(hls);
      });

      it('not observed twice', () => {
        controller.observe(hls);
        assert(controller.hls.length === 1);
        assert.strictEqual(controller.hls[0], hls);
      });
    });
  });

  describe('#unobserve', () => {
    let hls;
    let controller;

    beforeEach(() => {
      controller = new Controller();
      hls = {};
    });

    describe('when a hls track is not yet observed', () => {
      it('does nothing', () => {
        controller.unobserve(hls);
        assert(controller.hls.length === 0);
      });
    });
    describe('when a hls track is obseved', () => {
      beforeEach(() => {
        controller.observe(hls);
      });

      it('unobserves the hls track', () => {
        assert(controller.hls.length === 1);
        controller.unobserve(hls);
        assert(controller.hls.length === 0);
      });
    });
  });

  describe('#play', () => {
    let hls;
    let controller;

    beforeEach(() => {
      controller = new Controller();
      hls = { duration: 10 };
    });

    describe('when no hls track is loaded', () => {
      it('throws an exception', async () => {
        let thrownError;

        try {
          await controller.play();
        } catch (err) {
          thrownError = err;
        }

        assert.equal(thrownError.message, 'Cannot play before loading content');
      });
    });

    describe('when tracks are loaded', () => {
      beforeEach(() => {
        controller.observe(hls);
      });

      describe('when starting playback for the first time', () => {
        it('seeks to #currentTime = 0', async () => {
          controller.play();

          await new Promise((done) => {
            controller.on('start', () => done());
          });

          assert.strictEqual(parseInt(controller.currentTime, 10), 0);
        });
      });

      it('resumes the audioContext', () => {
        controller.ac.resume = sinon.spy();
        controller.play();
        assert(controller.ac.resume.calledOnce);
      });

      it('fires a "start" event', async () => {
        controller.play();
        await new Promise((done) => {
          controller.on('start', done);
        });
      });

      it('schedules the "tick" timeout', async () => {
        controller.play();
        const result = await new Promise((done) => {
          controller.on('timeupdate', done);
        });

        assert(typeof result.t === 'number');
        assert(typeof result.pct === 'number');
      });
    });
  });

  describe('#pause', () => {
    let controller;

    beforeEach(async () => {
      controller = new Controller({ refreshRate: 100 });
      controller.observe({ duration: 10, destroy: () => {} });
      await controller.play();
    });

    afterEach(async () => {
      controller.destroy();
    });

    it('suspends the audioContext', () => {
      controller.ac.suspend = sinon.stub().resolves();
      controller.pause();
      assert(controller.ac.suspend.calledOnce);
    });

    it('fires a "pause" event', async () => {
      controller.pause();
      await new Promise((done) => {
        controller.on('pause', done);
      });
    });

    // it no longer stops the tick timeout
    it('stops the "tick" timeout', async () => {
      let ticks = 0;
      controller.on('timeupdate', () => {
        ticks += 1;
      });

      // wait for a few ticks
      await new Promise((done) => {
        setTimeout(done, 200);
      });

      // count the number of ticks before pause
      const ticksBeforePause = ticks;

      controller.pause();

      // wait for a few ticks
      await new Promise((done) => {
        setTimeout(done, 500);
      });

      // check that no more ticks happened after pause
      assert.strictEqual(ticksBeforePause, ticks);
    });
  });

  describe('#duration', () => {
    let controller;
    beforeEach(() => {
      controller = new Controller();
    });

    describe('when no hls track is loaded', () => {
      it('returns undefined (default)', () => {
        assert.strictEqual(controller.duration, undefined);
      });
    });

    describe('when a track with #duration 1 is loaded', () => {
      it('returns 1', () => {
        controller.observe({ duration: 1 });
        assert.strictEqual(controller.duration, 1);
      });
    });

    describe('when a track with #duration 2 is loaded', () => {
      it('returns 2', () => {
        controller.observe({ duration: 2 });
        assert.strictEqual(controller.duration, 2);
      });
    });
  });

  describe('#currentTime', () => {
    let controller;

    beforeEach(() => {
      controller = new Controller();
    });

    it('returns undefined (default)', () => {
      assert.strictEqual(controller.currentTime, undefined);
    });

    describe('when #duration is undefined (default)', () => {
      it('throws an exception when set set #currentTime=1', () => {
        assert.throws(() => {
          controller.currentTime = 1;
        }, /CurrentTime .* should be between 0 and duration .*/);
      });
    });

    describe('when #duration=10', () => {
      beforeEach(() => {
        controller.observe({ duration: 10 });
      });

      it('throws an exception if we set #currentTime < 0', () => {
        assert.throws(() => {
          controller.currentTime = -1;
        }, /CurrentTime .* should be between 0 and duration .*/);
      });

      it('throws an exception if we set #currentTime to 11', () => {
        assert.throws(() => {
          controller.currentTime = 11;
        }, /CurrentTime .* should be between 0 and duration .*/);
      });

      it('sets #currentTime sucessfully to 9', () => {
        controller.currentTime = 1;
        assert(typeof controller.currentTime === 'number');

        // currentTime is set to a float taking into consideration the audioContext.currentTime
        assert.strictEqual(Math.round(controller.currentTime), 1);
      });
    });
  });

  describe('#pct', () => {
    let controller;

    beforeEach(() => {
      controller = new Controller();
    });

    describe('when #duration is undefined', () => {
      it('throws an exception when set set #pct=0.5', () => {
        assert.throws(() => {
          controller.pct = 0.5;
        }, /CurrentTime .* should be between 0 and duration .*/);
      });
    });

    describe('when #duration is 60', () => {
      beforeEach(() => {
        controller = new Controller();
        controller.observe({ duration: 60 });
      });

      it('sucessfully returns #pct=0.5 set set #pct=0.5', () => {
        controller.pct = 0.5;
        assert.strictEqual(Math.floor(controller.pct * 10) / 10, 0.5);
      });
    });
  });

  describe('#calculateRealStart', () => {
    let controller;

    beforeEach(() => {
      controller = new Controller();
    });

    describe('when #adjustedStart = undefined (default)', () => {
      it('returns undefined', () => {
        assert.strictEqual(controller.calculateRealStart(60), undefined);
      });
    });

    describe('when #adjustedStart = 0', () => {
      beforeEach(() => {
        controller.adjustedStart = 0;
      });

      it('returns the default start time #start = 60', () => {
        assert.strictEqual(controller.calculateRealStart(60), 60);
      });
    });

    describe('when #adjustedStart = -30', () => {
      beforeEach(() => {
        controller.adjustedStart = -30;
      });

      it('returns an adjusted start time', () => {
        assert.strictEqual(controller.calculateRealStart(60), 30);
      });
    });
  });

  describe('#calculateOffset', () => {
    let controller;

    beforeEach(() => {
      controller = new Controller();
    });

    describe('when #currentTime = undefined (default)', () => {
      it('returns undefined', () => {
        assert.strictEqual(controller.calculateOffset(60), undefined);
      });
    });

    describe('when #currentTime = 30', () => {
      beforeEach(() => {
        controller.observe({ duration: 60 });
        controller.currentTime = 30;
      });

      it('returns #offset=0 for a #start=60 in the future', () => {
        assert.strictEqual(Math.round(controller.calculateOffset(60)), 0);
      });

      it('returns #offset = 10 for #start = 20 in the past', () => {
        assert.strictEqual(Math.round(controller.calculateOffset(20)), 10);
      });
    });
  });

  describe('#state', () => {
    let controller;

    beforeEach(() => {
      controller = new Controller();
    });

    it('returns #ac state', () => {
      assert.strictEqual(controller.state, 'suspended');
    });
  });

  describe('#volume', () => {
    let controller;

    beforeEach(() => {
      controller = new Controller();
    });

    it('returns #gainNode value', () => {
      assert.strictEqual(controller.volume, 1);
    });
  });

  describe('#canPlay', () => {
    let controller;

    beforeEach(async () => {
      controller = new Controller();
    });

    it('returns true if all hls instances can play', async () => {
      controller.observe({ shouldAndCanPlay: true });
      controller.observe({ shouldAndCanPlay: true });
      controller.observe({ shouldAndCanPlay: true });
      assert(controller.canPlay);
    });

    it('returns true if one of the hls instances can not play', async () => {
      controller.observe({ shouldAndCanPlay: true });
      controller.observe({ shouldAndCanPlay: false });
      controller.observe({ shouldAndCanPlay: true });
      assert(!controller.canPlay);
    });
  });
});
