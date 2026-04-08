import { expect } from '@bundled-es-modules/chai';
import sinon from 'sinon';
import SegmentLoader from '../../../src/io/SegmentLoader.js';

describe('SegmentLoader', () => {
  let loader;
  let fetchStub;

  beforeEach(() => {
    loader = new SegmentLoader();
    fetchStub = sinon.stub(window, 'fetch');
  });

  afterEach(() => {
    fetchStub.restore();
  });

  describe('#constructor', () => {
    it('initializes an AbortController', () => {
      expect(loader.abortController).to.be.instanceOf(AbortController);
    });
  });

  describe('#load', () => {
    it('fetches segment bytes and returns an ArrayBuffer', async () => {
      const arrayBufferMock = new ArrayBuffer(8);
      const responseMock = {
        ok: true,
        arrayBuffer: sinon.stub().resolves(arrayBufferMock),
      };

      fetchStub.resolves(responseMock);

      const result = await loader.load('http://example.com/segment.ts', {
        headers: { Auth: 'Token' },
      });

      expect(fetchStub.calledOnce).to.be.true;

      const [url, options] = fetchStub.firstCall.args;
      expect(url).to.equal('http://example.com/segment.ts');
      expect(options.headers.Auth).to.equal('Token');
      expect(options.signal).to.equal(loader.abortController.signal);

      expect(result).to.equal(arrayBufferMock);
    });

    it('throws if response is not ok', async () => {
      const responseMock = {
        ok: false,
        status: 404,
      };

      fetchStub.resolves(responseMock);

      try {
        await loader.load('http://example.com/segment.ts');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal('Fetch failed with status 404');
      }
    });

    it('throws fetch errors (like network failure)', async () => {
      fetchStub.rejects(new Error('Network error'));

      try {
        await loader.load('http://example.com/segment.ts');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal('Network error');
      }
    });
  });

  describe('#cancel', () => {
    it('aborts the fetch request', () => {
      const abortSpy = sinon.spy(loader.abortController, 'abort');

      loader.cancel();

      expect(abortSpy.calledOnce).to.be.true;
    });
  });
});
