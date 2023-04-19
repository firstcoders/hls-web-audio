import assert from 'assert';
import sinon from 'sinon';
import Stack from '../../src/stack';

let stack;

describe('stack', () => {
  beforeEach(() => {
    stack = new Stack();
    stack.push(
      { duration: 1.1, end: 1.1 },
      { duration: 2.2, end: 3.3 },
      { duration: 3.3, end: 6.6 }
    );
  });

  describe('#destroy', () => {
    beforeEach(() => {
      stack = new Stack();
    });

    it('destroys all elements', () => {
      const fakeElement = { destroy: sinon.spy() };
      stack.push(fakeElement);
      stack.destroy();

      assert(fakeElement.destroy.calledOnce);
    });
  });

  describe('#push', () => {
    it('adds elements to the stack', () => {
      assert(stack.length === 3);
    });

    it('sets the correct start time', () => {
      assert.strictEqual(stack.elements[0].start, 0);
      assert.strictEqual(stack.elements[1].start, 1.1);
      assert.strictEqual(Math.round(stack.elements[2].start * 10) / 10, 3.3);
    });
  });

  describe('#consume()', () => {
    beforeEach(() => {
      stack.currentTime = 0;
    });

    describe('if #current is not ready and #current is not in transit', () => {
      it('return the current element', () => {
        const element = stack.consume();

        assert.strictEqual(element.start, 0);
        assert.strictEqual(element.$inTransit, true);
      });
    });

    describe('if #current is ready and #next is not in ready', () => {
      it('return the next element', () => {
        stack.elements[0].isReady = true;

        const element = stack.consume();

        assert.strictEqual(element.start, 1.1);
        assert.strictEqual(element.$inTransit, true);
      });
    });

    describe('if #current is in transit and #next is not ready', () => {
      it('return the next element', () => {
        const current = stack.consume();
        const next = stack.consume();

        assert(current !== next);
        assert.strictEqual(next.start, 1.1);
        assert.strictEqual(next.$inTransit, true);
      });
    });

    describe('if #current is ready and #next is ready', () => {
      it('returns undefined', () => {
        stack.elements[0].isReady = true;
        stack.elements[1].isReady = true;

        const element = stack.consume();

        assert(element === undefined);
      });
    });
  });

  describe('#ack()', () => {
    beforeEach(() => {
      stack.currentTime = 0;
    });

    it('marks the element as not in transit so that it could be re-delivered on a next call to #consume', () => {
      const element = stack.consume();

      assert.strictEqual(element.$inTransit, true);

      stack.ack(element);

      assert.strictEqual(element.$inTransit, false);
    });
  });

  describe('#currentTime', () => {
    it('sets the currentTime', () => {
      stack.currentTime = 2;
      assert.strictEqual(stack.currentPointer, 1);
    });
  });

  describe('#duration', () => {
    it('returns the total duration of all elements combined', () => {
      assert.strictEqual(stack.duration, 6.6);
    });
  });

  describe('#current and next', () => {
    beforeEach(() => {
      stack.currentTime = 2;
    });

    it('returns the current element given #currentTime', () => {
      const { current } = stack;
      assert.strictEqual(current.start, 1.1);
    });

    it('returns the next element given #currentTime', () => {
      const { next } = stack;
      assert.strictEqual(Math.round(next.start * 10) / 10, 3.3);
    });
  });

  describe('#disconnectAll()', () => {
    beforeEach(() => {
      stack.elements[0].cancel = sinon.spy();
      stack.elements[1].cancel = sinon.spy();
      stack.elements[2].cancel = sinon.spy();
      stack.elements[0].disconnect = sinon.spy();
      stack.elements[1].disconnect = sinon.spy();
      stack.elements[2].disconnect = sinon.spy();
    });

    it('cancels any elements that are loading', () => {
      stack.disconnectAll();

      assert(stack.elements[0].cancel.calledOnce);
      assert(stack.elements[1].cancel.calledOnce);
      assert(stack.elements[2].cancel.calledOnce);
    });

    it('disconnects any elements that are ready', () => {
      stack.elements[0].isReady = true;
      stack.elements[1].isReady = false;
      stack.elements[2].isReady = true;

      stack.disconnectAll();

      assert(stack.elements[0].disconnect.calledOnce);
      assert(!stack.elements[1].disconnect.calledOnce);
      assert(stack.elements[2].disconnect.calledOnce);
    });

    it('acks any elements that are in transit', () => {
      stack.elements[0].$inTransit = true;

      stack.disconnectAll();

      assert(stack.elements[0].$inTransit === false);
    });
  });

  describe('#length', () => {
    it('returns the number of elements on the stack', () => {
      assert.strictEqual(stack.length, 3);
    });
  });

  describe('#getAt()', () => {
    it('returns element at a time t', () => {
      assert.strictEqual(stack.getAt(1.0), stack.elements[0]);
      assert.strictEqual(stack.getAt(2.3), stack.elements[1]);
      assert.strictEqual(stack.getAt(4.5), stack.elements[2]);
      assert.strictEqual(stack.getAt(9.9), undefined);
    });
  });

  describe('#getIndexAt()', () => {
    it('returns the index of the element at a time t', () => {
      assert.strictEqual(stack.getIndexAt(1.0), 0);
      assert.strictEqual(stack.getIndexAt(2.3), 1);
      assert.strictEqual(stack.getIndexAt(4.5), 2);
      assert.strictEqual(stack.getIndexAt(9.9), -1);
      assert.strictEqual(stack.getIndexAt(-100), -1);
    });
  });
});
