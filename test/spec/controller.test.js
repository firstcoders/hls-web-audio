/* eslint-disable no-unused-expressions */
import { expect } from '@bundled-es-modules/chai';
import sinon from 'sinon';
import Controller from '../../src/controller';
import HLS from '../../src/hls';

describe('controller', () => {
  describe('#constructor', () => {
    it('constructs', () => {
      const controller = new Controller();
      expect(controller).to.be.an.instanceof(Controller);
    });

    describe('#ac', () => {
      describe('when #ac = undefined', () => {
        let controller;

        beforeEach(() => {
          controller = new Controller({ acOpts: { sampleRate: 33333 } });
        });

        it('creates a audioContext with #acOpts', () => {
          expect(controller.ac).to.be.an.instanceof(AudioContext);
          expect(controller.ac.sampleRate).equal(33333);
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
          expect(controller.ac).equal(ac);
        });
      });

      describe('ac#onstatechange', () => {
        let controller;
        let ticks = 0;

        beforeEach(() => {
          controller = new Controller();
        });

        it('starts ticking when the audiocontext starts', async () => {
          expect(controller.ac.state).equal('suspended');

          await controller.ac.resume();

          await new Promise((done) => {
            controller.on('timeupdate', done);
            ticks += 1;
          });

          expect(ticks > 0).to.be.true;
        });

        it('stop ticking when the audiocontext stops', async () => {
          await controller.ac.resume();

          expect(controller.ac.state).equal('running');

          const ticksBeforeSuspend = ticks;

          await controller.ac.suspend();

          await new Promise((done) => {
            setTimeout(done, 200);
          });

          expect(ticksBeforeSuspend).equal(ticks);
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
          expect(controller.refreshRate).equal(250);
        });
      });

      describe('when #refreshRate = 500', () => {
        beforeEach(() => {
          controller = new Controller({ refreshRate: 500 });
        });
        it('sets #refreshRate=100', () => {
          expect(controller.refreshRate).equal(500);
        });
      });
    });

    describe('#destination', () => {
      describe('when #destination = undefined (default)', () => {
        it('uses the #ac destination', () => {
          const controller = new Controller();
          expect(controller.destination).equal(controller.ac.destination);
        });
      });
      describe('when #destination = set', () => {
        it('sets #destination', () => {
          const ac = new AudioContext();
          const processor = ac.createScriptProcessor();
          const controller = new Controller({ ac, destination: processor });
          expect(controller.destination).equal(processor);
        });
      });
    });

    describe('#gainNode', () => {
      it('creates a gainNode', () => {
        const controller = new Controller();
        expect(controller.gainNode).to.be.an.instanceof(GainNode);
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
        expect(controller.gainNode.connect.calledWith(controller.destination));
      });
    });
  });

  describe('#destroy', () => {
    let controller;
    beforeEach(() => {
      controller = new Controller();
      controller.observe({ duration: 100, end: 100 });
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

      expect(ticks > 0);

      const ticksBeforeDestroy = ticks;

      controller.destroy();

      await new Promise((done) => {
        setTimeout(done, 100);
      });

      expect(ticksBeforeDestroy).equal(ticks);
    });

    it('disconnects the gainNode', () => {
      const { gainNode } = controller;
      controller.gainNode.disconnect = sinon.spy();

      controller.destroy();

      expect(gainNode.disconnect.calledOnce);
      expect(controller.gainNode).to.be.null;
    });

    it('detaches the audioContext', () => {
      expect(controller.ac).instanceOf(AudioContext);

      controller.destroy();

      expect(controller.ac).to.be.null;
    });

    it('removes any references to hls instances', () => {
      expect(controller.hls.length).greaterThan(0);

      controller.destroy();

      expect(controller.hls.length).equal(0);
    });

    describe('when the controller created the audioContext', () => {
      it('closes the audioContext', () => {
        const spy = sinon.spy();

        controller.ac.close = spy;

        controller.destroy();

        expect(spy.calledOnce);
      });
    });

    describe('when the an audioContext was provided', () => {
      it('does not close the audioContext', () => {
        const ac = new AudioContext();
        ac.close = sinon.spy();

        const controller2 = new Controller({ ac });

        controller2.destroy();

        expect(!ac.close.calledOnce);
      });
    });

    it('unregisters any event listeners', () => {
      controller.unAll = sinon.spy();
      controller.destroy();
      expect(controller.unAll.calledOnce);
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
        expect(controller.hls.length).equal(0);
        controller.observe(hls);
        expect(controller.hls.length).equal(1);
        expect(controller.hls[0]).equal(hls);
      });
    });

    describe('when a hls track is already obseved', () => {
      beforeEach(() => {
        controller.observe(hls);
      });

      it('not observed twice', () => {
        controller.observe(hls);
        expect(controller.hls.length).equal(1);
        expect(controller.hls[0]).equal(hls);
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
        expect(controller.hls.length).equal(0);
      });
    });
    describe('when a hls track is obseved', () => {
      beforeEach(() => {
        controller.observe(hls);
      });

      it('unobserves the hls track', () => {
        expect(controller.hls.length).equal(1);
        controller.unobserve(hls);
        expect(controller.hls.length).equal(0);
      });
    });
  });

  describe('#play', () => {
    let hls;
    let controller;

    beforeEach(() => {
      controller = new Controller();
      hls = { duration: 10, end: 10 };
    });

    describe('when no hls track is loaded', () => {
      it('throws an exception', async () => {
        let thrownError;

        try {
          await controller.play();
        } catch (err) {
          thrownError = err;
        }

        expect(thrownError.message).equal('Cannot play before loading content');
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

          expect(parseInt(controller.currentTime, 10)).equal(0);
        });
      });

      it('resumes the audioContext', async () => {
        controller.ac.resume = sinon.spy();
        await controller.play();
        expect(controller.ac.resume.calledOnce);
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

        expect(typeof result.t === 'number');
        expect(typeof result.pct === 'number');
      });
    });
  });

  describe('#pause', () => {
    let controller;

    beforeEach(async () => {
      controller = new Controller({ refreshRate: 100 });
      controller.observe({ duration: 10, end: 10, destroy: () => {} });
      await controller.play();
    });

    afterEach(async () => {
      controller.destroy();
    });

    it('suspends the audioContext', () => {
      controller.ac.suspend = sinon.stub().resolves();
      controller.pause();
      expect(controller.ac.suspend.calledOnce);
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
        setTimeout(done, 500);
      });

      await controller.pause();

      // count the number of ticks before pause
      const ticksBeforePause = ticks;

      // wait for a few ticks
      await new Promise((done) => {
        setTimeout(done, 500);
      });

      // check that no more ticks happened after pause
      expect(ticksBeforePause).equal(ticks);
    });
  });

  describe('#duration', () => {
    let controller;
    beforeEach(() => {
      controller = new Controller();
    });

    describe('when no hls track is loaded', () => {
      it('returns undefined (default)', () => {
        expect(controller.duration).to.be.undefined;
      });
    });

    describe('when a track with #duration 1 is loaded', () => {
      it('returns 1', () => {
        controller.observe({ duration: 1, end: 1 });
        expect(controller.duration).equal(1);
      });
    });

    describe('when a track with #duration 2 is loaded', () => {
      it('returns 2', () => {
        controller.observe({ duration: 2, end: 2 });
        expect(controller.duration).equal(2);
      });
    });

    describe('when the #playDuration is set manually', () => {
      it('emits the "playDuration" event', () => {
        let emitted = false;
        controller.on('playDuration', () => {
          emitted = true;
        });
        controller.playDuration = 99;
        expect(emitted).equal(true);
      });
      it('overrides the duration of the tracks', () => {
        controller.observe({ duration: 2, end: 2 });
        controller.playDuration = 99;
        expect(controller.audioDuration).equal(2);
        expect(controller.duration).equal(2);
        expect(controller.playDuration).equal(99);
      });
    });

    describe('when the #hls.start is changed', () => {
      it('emits the duration event if the total duration changed', () => {
        const hls = new HLS({ controller, duration: 10 });
        const hls2 = new HLS({ controller, duration: 11 });
        controller.observe(hls);
        controller.observe(hls2);

        let eventIsEmitted = false;

        controller.on('duration', () => {
          eventIsEmitted = true;
        });

        hls.start = 10;

        expect(eventIsEmitted);
      });
    });

    describe('when the #hls.duration manually set', () => {
      it('emits the duration event if the total duration changed', () => {
        const hls = new HLS({ controller, duration: 10 });
        const hls2 = new HLS({ controller, duration: 11 });
        controller.observe(hls);
        controller.observe(hls2);

        let eventIsEmitted = false;

        controller.on('duration', () => {
          eventIsEmitted = true;
        });

        hls.duration = 20;

        expect(eventIsEmitted);
      });
    });
  });

  describe('#currentTime', () => {
    let controller;

    beforeEach(() => {
      controller = new Controller();
    });

    it('returns undefined (default)', () => {
      expect(controller.currentTime).equal(undefined);
    });

    describe('when #duration is undefined (default)', () => {
      it('throws an exception when set set #currentTime=1', () => {
        expect(() => {
          controller.currentTime = 1;
        }, /CurrentTime .* should be between 0 and duration .*/).to.throw();
      });
    });

    describe('when #duration=10', () => {
      beforeEach(() => {
        controller.observe({ duration: 10, end: 10 });
      });

      it('throws an exception if we set #currentTime < 0', () => {
        expect(() => {
          controller.currentTime = -1;
        }, /CurrentTime .* should be between 0 and duration .*/).to.throw();
      });

      it('throws an exception if we set #currentTime to 11', () => {
        expect(() => {
          controller.currentTime = 11;
        }, /CurrentTime .* should be between 0 and duration .*/).to.throw();
      });

      it('sets #currentTime sucessfully to 9', () => {
        controller.currentTime = 1;
        expect(typeof controller.currentTime === 'number');

        // currentTime is set to a float taking into consideration the audioContext.currentTime
        expect(Math.round(controller.currentTime)).equal(1);
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
        expect(() => {
          controller.pct = 0.5;
        }, /CurrentTime .* should be between 0 and duration .*/).to.throw;
      });
    });

    describe('when #duration is 60', () => {
      beforeEach(() => {
        controller = new Controller();
        controller.observe({ duration: 60, end: 60 });
      });

      it('sucessfully returns #pct=0.5 set set #pct=0.5', () => {
        controller.pct = 0.5;
        expect(Math.floor(controller.pct * 10) / 10, 0.5);
      });
    });
  });

  describe('#state', () => {
    let controller;

    beforeEach(() => {
      controller = new Controller();
    });

    it('returns #ac state', () => {
      expect(controller.state).equal('suspended');
    });
  });

  describe('#volume', () => {
    let controller;

    beforeEach(() => {
      controller = new Controller();
    });

    it('returns #gainNode value', () => {
      expect(controller.volume).equal(1);
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
      expect(controller.canPlay);
    });

    it('returns true if one of the hls instances can not play', async () => {
      controller.observe({ shouldAndCanPlay: true });
      controller.observe({ shouldAndCanPlay: false });
      controller.observe({ shouldAndCanPlay: true });
      expect(!controller.canPlay);
    });
  });
});

// describe('getCurrentTimeframe', () => {

// })
