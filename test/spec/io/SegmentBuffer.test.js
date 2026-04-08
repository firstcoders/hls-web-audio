import { expect } from '@bundled-es-modules/chai';
import sinon from 'sinon';
import SegmentBuffer from '../../../src/io/SegmentBuffer.js';
import SegmentLoader from '../../../src/io/SegmentLoader.js';

describe('SegmentBuffer', () => {
  let buffer;
  let loaderLoadStub;
  let fetchStub;
  let arrayBufferMock;
  let acMock;
  let audioBufferMock;

  beforeEach(() => {
    buffer = new SegmentBuffer('http://example.com/segment.ts', { auth: 'token' });
    arrayBufferMock = new ArrayBuffer(8);
    audioBufferMock = {};

    // Stub out the SegmentLoader's load implementation
    loaderLoadStub = sinon.stub(SegmentLoader.prototype, 'load').resolves(arrayBufferMock);

    acMock = {
      decodeAudioData: sinon.stub().resolves(audioBufferMock),
    };
  });

  afterEach(() => {
    loaderLoadStub.restore();
  });

  describe('#constructor', () => {
    it('initializes default properties', () => {
      expect(buffer.src).to.equal('http://example.com/segment.ts');
      expect(buffer.fetchOptions.auth).to.equal('token');
      expect(buffer.fetchFailed).to.be.false;
      expect(buffer.loading).to.be.false;
      expect(buffer.loadHandle).to.be.null;
    });
  });

  describe('#load', () => {
    it('returns a fetch error immediately if fetchFailed is true', async () => {
      buffer.fetchFailed = true;
      try {
        await buffer.load().promise;
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal('Fetch failed');
      }
    });

    it('returns the same loadHandle if loading is already in progress', () => {
      const handle1 = buffer.load();
      const handle2 = buffer.load();

      expect(handle1).to.equal(handle2);
      expect(loaderLoadStub.calledOnce).to.be.true;
    });

    it('loads the segment, stores the arrayBuffer, and resets state on success', async () => {
      const handle = buffer.load();

      expect(buffer.loading).to.be.true;

      await handle.promise;

      expect(buffer.loading).to.be.false;
      expect(buffer.loadHandle).to.be.undefined;

      // Wait for internal promises to settle
      await Promise.resolve();

      expect(buffer.isLoaded).to.be.true;
    });

    it('sets fetchFailed on non-AbortError failures', async () => {
      loaderLoadStub.rejects(new Error('Network error'));

      try {
        await buffer.load().promise;
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal('Network error');
        expect(buffer.fetchFailed).to.be.true;
      }

      // Check that loader is still cleared out.
      expect(buffer.loading).to.be.false;
      expect(buffer.loadHandle).to.be.undefined;
    });

    it('does not set fetchFailed on AbortError', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      loaderLoadStub.rejects(abortError);

      try {
        await buffer.load().promise;
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.name).to.equal('AbortError');
        expect(buffer.fetchFailed).to.be.false;
      }
    });

    it('provides a cancel function that aborts the load', () => {
      const handle = buffer.load();

      const loader = SegmentLoader.prototype.load.thisValues[0];
      const cancelSpy = sinon.spy(loader, 'cancel');

      handle.cancel();
      expect(cancelSpy.calledOnce).to.be.true;
      expect(buffer.loadHandle).to.be.null; // Reset
    });
  });

  describe('#cancel', () => {
    it('does nothing if not loading', () => {
      buffer.cancel();
      expect(buffer.loadHandle).to.be.null;
    });

    it('cancels the active loader if it exists', () => {
      buffer.load();

      const loader = SegmentLoader.prototype.load.thisValues[0];
      const cancelSpy = sinon.spy(loader, 'cancel');

      buffer.cancel();
      expect(cancelSpy.calledOnce).to.be.true;
      expect(buffer.loadHandle).to.be.null;
    });
  });

  describe('#getAudioBuffer', () => {
    it('throws if arrayBuffer is not loaded', async () => {
      try {
        await buffer.getAudioBuffer(acMock);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal('Cannot connect. No audio data in buffer.');
      }
    });

    it('decodes audio data and caches the buffer', async () => {
      await buffer.load().promise;

      const audioBuffer = await buffer.getAudioBuffer(acMock);

      expect(audioBuffer).to.equal(audioBufferMock);
      expect(acMock.decodeAudioData.calledOnce).to.be.true;

      // Calling again returns cached buffer immediately
      const cachedBuffer = await buffer.getAudioBuffer(acMock);

      expect(cachedBuffer).to.equal(audioBufferMock);
      expect(acMock.decodeAudioData.calledOnce).to.be.true; // Still 1 call
    });
  });

  describe('#unload', () => {
    it('clears audioBuffer to free memory, but keeps arrayBuffer to prevent refetching', async () => {
      await buffer.load().promise;
      await buffer.getAudioBuffer(acMock);

      expect(buffer.isLoaded).to.be.true;

      buffer.unload();

      // We check that isLoaded is STILL true because arrayBuffer hasn't cleared
      expect(buffer.isLoaded).to.be.true;

      // To strictly check if audioBuffer was cleared, acMock should be called AGAIN on next getAudioBuffer.
      await buffer.getAudioBuffer(acMock);
      expect(acMock.decodeAudioData.calledTwice).to.be.true;
    });
  });

  describe('#isLoaded', () => {
    it('returns false initially', () => {
      expect(buffer.isLoaded).to.be.false;
    });

    it('returns true after load finishes', async () => {
      await buffer.load().promise;
      expect(buffer.isLoaded).to.be.true;
    });
  });
});
