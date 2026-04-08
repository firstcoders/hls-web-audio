import { expect } from '@bundled-es-modules/chai';
import sinon from 'sinon';
import SegmentPlayer from '../../../src/io/SegmentPlayer.js';

describe('SegmentPlayer', () => {
  let player;
  let acMock;
  let sourceNodeMock;
  let audioBufferMock;
  let destinationMock;

  beforeEach(() => {
    player = new SegmentPlayer();
    sourceNodeMock = {
      connect: sinon.spy(),
      disconnect: sinon.spy(),
      start: sinon.spy(),
      stop: sinon.spy(),
      buffer: null,
      onended: null,
    };
    acMock = {
      createBufferSource: sinon.stub().returns(sourceNodeMock),
    };
    audioBufferMock = {};
    destinationMock = {};
  });

  describe('#connect', () => {
    it('creates a buffer source, connects, and starts it', async () => {
      const onEndedSpy = sinon.spy();

      await player.connect({
        ac: acMock,
        audioBuffer: audioBufferMock,
        destination: destinationMock,
        start: 10,
        offset: 2,
        stop: 15,
        onEnded: onEndedSpy,
      });

      expect(acMock.createBufferSource.calledOnce).to.be.true;
      expect(sourceNodeMock.buffer).to.equal(audioBufferMock);
      expect(sourceNodeMock.connect.calledWith(destinationMock)).to.be.true;
      expect(sourceNodeMock.start.calledWith(10, 2)).to.be.true;
      expect(sourceNodeMock.stop.calledWith(15)).to.be.true;

      // Simulate onended
      expect(typeof sourceNodeMock.onended).to.equal('function');
      sourceNodeMock.onended();
      expect(onEndedSpy.calledOnce).to.be.true;
    });

    it('throws if trying to connect when already connected', async () => {
      await player.connect({
        ac: acMock,
        audioBuffer: audioBufferMock,
        destination: destinationMock,
        start: 0,
        offset: 0,
        stop: 5,
      });

      try {
        await player.connect({
          ac: acMock,
          audioBuffer: audioBufferMock,
          destination: destinationMock,
          start: 0,
          offset: 0,
          stop: 5,
        });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal('Cannot connect a segment twice');
      }
    });

    it('works without onEnded callback', async () => {
      await player.connect({
        ac: acMock,
        audioBuffer: audioBufferMock,
        destination: destinationMock,
        start: 10,
        offset: 2,
        stop: 15,
      });

      // Should not throw
      sourceNodeMock.onended();
    });
  });

  describe('#disconnect', () => {
    it('disconnects and stops the source node, and clears buffer', async () => {
      await player.connect({
        ac: acMock,
        audioBuffer: audioBufferMock,
        destination: destinationMock,
        start: 0,
        offset: 0,
        stop: 5,
      });

      player.disconnect();

      expect(sourceNodeMock.disconnect.calledOnce).to.be.true;
      expect(sourceNodeMock.stop.calledTwice).to.be.true;
      expect(sourceNodeMock.buffer).to.be.null;
      expect(player.isReady).to.be.false;
    });

    it('does nothing if not connected', () => {
      // Should not throw
      player.disconnect();
    });

    it('ignores errors when setting buffer to null', async () => {
      await player.connect({
        ac: acMock,
        audioBuffer: audioBufferMock,
        destination: destinationMock,
        start: 0,
        offset: 0,
        stop: 5,
      });

      // Simulate a browser environment that throws when clearing buffer
      Object.defineProperty(sourceNodeMock, 'buffer', {
        set() {
          throw new Error('Cannot set buffer');
        },
      });

      // Should not throw
      player.disconnect();
      expect(player.isReady).to.be.false;
    });
  });

  describe('#isReady', () => {
    it('returns true when connected and false when disconnected', async () => {
      expect(player.isReady).to.be.false;

      await player.connect({
        ac: acMock,
        audioBuffer: audioBufferMock,
        destination: destinationMock,
        start: 0,
        offset: 0,
        stop: 5,
      });

      expect(player.isReady).to.be.true;

      player.disconnect();

      expect(player.isReady).to.be.false;
    });
  });
});
