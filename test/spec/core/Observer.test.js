import { expect } from '@bundled-es-modules/chai';
import sinon from 'sinon';
import Observer from '../../../src/core/Observer.js';

describe('Observer', () => {
  let observer;

  beforeEach(() => {
    observer = new Observer();
  });

  afterEach(() => {
    observer.destroy();
  });

  describe('#on', () => {
    it('registers an event handler and returns a descriptor', () => {
      const handler = sinon.spy();
      const descriptor = observer.on('test-event', handler);

      expect(descriptor.name).to.equal('test-event');
      expect(descriptor.callback).to.equal(handler);
      expect(typeof descriptor.un).to.equal('function');

      observer.fireEvent('test-event');
      expect(handler.calledOnce).to.be.true;
    });

    it('throws if event name is not provided', () => {
      expect(() => observer.on(null, () => {})).to.throw('Eventname is null or undefined');
    });
  });

  describe('#un', () => {
    it('removes a specific event handler', () => {
      const handler = sinon.spy();
      observer.on('test-event', handler);
      observer.un('test-event', handler);

      observer.fireEvent('test-event');
      expect(handler.notCalled).to.be.true;
    });

    it('removes all handlers for an event if no handler is specified', () => {
      const handler1 = sinon.spy();
      const handler2 = sinon.spy();

      observer.on('test-event', handler1);
      observer.on('test-event', handler2);
      observer.un('test-event');

      observer.fireEvent('test-event');
      expect(handler1.notCalled).to.be.true;
      expect(handler2.notCalled).to.be.true;
    });
  });

  describe('#unAll', () => {
    it('removes all event handlers', () => {
      const handler1 = sinon.spy();
      const handler2 = sinon.spy();

      observer.on('event1', handler1);
      observer.on('event2', handler2);
      observer.unAll();

      observer.fireEvent('event1');
      observer.fireEvent('event2');

      expect(handler1.notCalled).to.be.true;
      expect(handler2.notCalled).to.be.true;
    });
  });

  describe('#once', () => {
    it('executes the handler and removes it after a tick', (done) => {
      const handler = sinon.spy();
      observer.once('test-event', handler);

      observer.fireEvent('test-event');
      // Due to the setTimeout implementation of #once, we must wait a tick
      // before firing again to see the effects of the handler removal.
      setTimeout(() => {
        observer.fireEvent('test-event');

        expect(handler.calledOnce).to.be.true;
        expect(observer._handlers['test-event'].length).to.equal(0);
        done();
      }, 0);
    });
  });

  describe('#fireEvent', () => {
    it('triggers handlers with provided arguments', () => {
      const handler = sinon.spy();
      observer.on('test-event', handler);

      observer.fireEvent('test-event', 'arg1', 'arg2');
      expect(handler.calledWith('arg1', 'arg2')).to.be.true;
    });

    it('does nothing if no handlers are registered', () => {
      // Should not throw
      observer.fireEvent('non-existent-event');
    });
  });

  describe('#destroy', () => {
    it('cleans up handlers when destroyed', () => {
      const unAllSpy = sinon.spy(observer, 'unAll');
      observer.destroy();
      expect(unAllSpy.calledOnce).to.be.true;
      expect(observer._handlers).to.be.null;
    });
  });
});
