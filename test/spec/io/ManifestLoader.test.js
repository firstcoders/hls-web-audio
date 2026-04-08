import { expect } from '@bundled-es-modules/chai';
import sinon from 'sinon';
import ManifestLoader from '../../../src/io/ManifestLoader.js';

describe('ManifestLoader', () => {
  let loader;
  let fetchMock;

  const MOCK_MANIFEST = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
segment1.ts
#EXTINF:15.0,
segment2.ts`;

  beforeEach(() => {
    fetchMock = sinon.stub().resolves({
      ok: true,
      text: sinon.stub().resolves(MOCK_MANIFEST),
    });

    loader = new ManifestLoader(fetchMock);
  });

  describe('#constructor', () => {
    it('sets a custom fetch function if provided', () => {
      expect(loader.fetchFn).to.equal(fetchMock);
    });

    it('defaults to window.fetch if no custom fetch function is provided', () => {
      const defaultLoader = new ManifestLoader();
      expect(typeof defaultLoader.fetchFn).to.equal('function');
    });
  });

  describe('#load', () => {
    it('returns a promise with parsed segments and a cancel function', async () => {
      const handle = loader.load('http://example.com/playlist.m3u8', {
        headers: { Auth: 'Token' },
      });

      expect(handle).to.have.property('promise');
      expect(handle).to.have.property('cancel');

      const result = await handle.promise;

      expect(fetchMock.calledOnce).to.be.true;

      const [url, options] = fetchMock.firstCall.args;
      expect(url).to.equal('http://example.com/playlist.m3u8');
      expect(options.headers.Auth).to.equal('Token');
      expect(options.signal).to.be.instanceOf(AbortSignal);

      expect(result).to.deep.equal([
        { src: 'http://example.com/segment1.ts', duration: 10 },
        { src: 'http://example.com/segment2.ts', duration: 15 },
      ]);
    });

    it('throws if response is not ok', async () => {
      fetchMock.resolves({
        ok: false,
        status: 404,
      });

      try {
        await loader.load('http://example.com/playlist.m3u8').promise;
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal('Network response was not ok');
      }
    });

    it('should abort fetch when cancel is called', () => {
      const handle = loader.load('http://example.com/playlist.m3u8');
      const abortSpy = sinon.spy(loader.abortController, 'abort');

      handle.cancel();
      expect(abortSpy.calledOnce).to.be.true;
    });
  });

  describe('#parse', () => {
    it('statically parses a manifest string into segment descriptors', () => {
      const result = ManifestLoader.parse(MOCK_MANIFEST, 'http://example.com/playlist.m3u8');

      expect(result).to.deep.equal([
        { src: 'http://example.com/segment1.ts', duration: 10 },
        { src: 'http://example.com/segment2.ts', duration: 15 },
      ]);
    });
  });
});
