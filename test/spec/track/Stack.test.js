import { expect } from '@bundled-es-modules/chai';
import sinon from 'sinon';
import Stack from '../../../src/track/Stack.js';

let stack;

describe('stack', () => {
  beforeEach(() => {
    stack = new Stack();
    stack.push(
      { duration: 1.1, end: 1.1 },
      { duration: 2.2, end: 3.3 },
      { duration: 3.3, end: 6.6 },
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

      expect(fakeElement.destroy.calledOnce);
    });
  });

  describe('#push', () => {
    it('adds elements to the stack', () => {
      expect(stack.length).equal(3);
    });

    it('sets the correct start time', () => {
      expect(stack.head.start).equal(0);
      expect(stack.head.next.start).equal(1.1);
      expect(Math.round(stack.head.next.next.start * 10) / 10).equal(3.3);
    });
  });

  describe('#ack()', () => {
    beforeEach(() => {
      stack.currentTime = 0;
    });

    it('marks the element as not in transit so that it could be re-delivered on a next call to #consume', () => {
      const element = stack.head;
      element.$inTransit = true;

      expect(element.$inTransit).equal(true);

      stack.ack(element);

      expect(element.$inTransit).equal(false);
    });
  });

  describe('#duration', () => {
    it('returns the total duration of all elements combined', () => {
      expect(stack.duration).equal(6.6);
    });
  });

  // describe('#current and next', () => {
  //   beforeEach(() => {
  //     stack.currentTime = 2;
  //   });

  //   it('returns the current element given #currentTime', () => {
  //     const { current } = stack;
  //     expect(current.start).equal(1.1);
  //   });

  //   it('returns the next element given #currentTime', () => {
  //     const { next } = stack;
  //     expect(Math.round(next.start * 10) / 10).equal(3.3);
  //   });
  // });

  describe('#disconnectAll()', () => {
    beforeEach(() => {
      stack.head.cancel = sinon.spy();
      stack.head.next.cancel = sinon.spy();
      stack.head.next.next.cancel = sinon.spy();
      stack.head.disconnect = sinon.spy();
      stack.head.next.disconnect = sinon.spy();
      stack.head.next.next.disconnect = sinon.spy();
    });

    it('cancels any elements that are loading', () => {
      stack.disconnectAll();

      expect(stack.head.cancel.calledOnce).equal(true);
      expect(stack.head.next.cancel.calledOnce).equal(true);
      expect(stack.head.next.next.cancel.calledOnce).equal(true);
    });

    it('disconnects any elements that are ready', () => {
      stack.head.isReady = true;
      stack.head.next.isReady = false;
      stack.head.next.next.isReady = true;

      stack.disconnectAll();

      expect(stack.head.disconnect.calledOnce).equal(true);
      expect(stack.head.next.disconnect.calledOnce).equal(false);
      expect(stack.head.next.next.disconnect.calledOnce).equal(true);
    });

    it('acks any elements that are in transit', () => {
      stack.head.$inTransit = true;

      stack.disconnectAll();

      expect(stack.head.$inTransit).equal(false);
    });

    it('preserves loading elements if they are close to the target timeframe', () => {
      stack.head.start = 10;
      stack.head.$inTransit = true;

      const timeframe = { currentTime: 12 }; // within 15 seconds
      stack.disconnectAll(timeframe);

      expect(stack.head.cancel.called).equal(false);
      expect(stack.head.$inTransit).equal(true); // did not ack
    });

    it('cancels loading elements if they are far from the target timeframe', () => {
      stack.head.start = 10;
      stack.head.$inTransit = true;

      const timeframe = { currentTime: 30 }; // further than 15 seconds
      stack.disconnectAll(timeframe);

      expect(stack.head.cancel.calledOnce).equal(true);
      expect(stack.head.$inTransit).equal(false); // acked
    });
  });

  describe('#length', () => {
    it('returns the number of elements on the stack', () => {
      expect(stack.length).equal(3);
    });
  });

  describe('#getAt()', () => {
    it('returns element at a time t', () => {
      expect(stack.getAt(1.0)).equal(stack.head);
      expect(stack.getAt(2.3)).equal(stack.head.next);
      expect(stack.getAt(4.5)).equal(stack.head.next.next);
      expect(stack.getAt(9.9)).equal(undefined);
    });
  });
});
