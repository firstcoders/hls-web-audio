/**
 * Copyright (c) 2012-2023, katspaugh and contributors
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * * Redistributions of source code must retain the above copyright notice, this
 *   list of conditions and the following disclaimer.
 *
 * * Redistributions in binary form must reproduce the above copyright notice,
 *   this list of conditions and the following disclaimer in the documentation
 *   and/or other materials provided with the distribution.
 *
 * * Neither the name of the copyright holder nor the names of its
 *   contributors may be used to endorse or promote products derived from
 *   this software without specific prior written permission.
 */

/* eslint-disable */

/**
 * @typedef {Object} ListenerDescriptor
 * @property {string} name The name of the event
 * @property {function} callback The callback
 * @property {function} un The function to call to remove the listener
 */

/**
 * Observer class
 */
export default class Observer {
  /**
   * Instantiate Observer
   */
  constructor() {
    /**
     * @private
     * @todo Initialise the handlers here already and remove the conditional
     * assignment in `on()`
     */
    this._handlers = null;
  }

  destroy() {
    this.unAll();
  }

  /**
   * Attach a handler function for an event.
   *
   * @param {string} event Name of the event to listen to
   * @param {function} fn The callback to trigger when the event is fired
   * @return {ListenerDescriptor} The event descriptor
   */
  on(event, fn) {
    if (!event) throw new Error('Eventname is null or undefined');

    if (!this._handlers) {
      this._handlers = {};
    }

    let handlers = this._handlers[event];
    if (!handlers) {
      handlers = this._handlers[event] = [];
    }
    handlers.push(fn);

    // Return an event descriptor
    return {
      name: event,
      callback: fn,
      un: () => {
        this.un(event, fn);
      },
    };
  }

  /**
   * Remove an event handler.
   *
   * @param {string} event Name of the event the listener that should be
   * removed listens to
   * @param {function} fn The callback that should be removed
   */
  un(event, fn) {
    if (!this._handlers) {
      return;
    }

    const handlers = this._handlers[event];
    let i;
    if (handlers) {
      if (fn) {
        for (i = handlers.length - 1; i >= 0; i--) {
          if (handlers[i] == fn) {
            handlers.splice(i, 1);
          }
        }
      } else {
        handlers.length = 0;
      }
    }
  }

  /**
   * Remove all event handlers.
   */
  unAll() {
    this._handlers = null;
  }

  /**
   * Attach a handler to an event. The handler is executed at most once per
   * event type.
   *
   * @param {string} event The event to listen to
   * @param {function} handler The callback that is only to be called once
   * @return {ListenerDescriptor} The event descriptor
   */
  once(event, handler) {
    const fn = (...args) => {
      /*  eslint-disable no-invalid-this */
      handler.apply(this, args);
      /*  eslint-enable no-invalid-this */
      setTimeout(() => {
        this.un(event, fn);
      }, 0);
    };
    return this.on(event, fn);
  }

  /**
   * Manually fire an event
   *
   * @param {string} event The event to fire manually
   * @param {...any} args The arguments with which to call the listeners
   */
  fireEvent(event, ...args) {
    if (!this._handlers) {
      return;
    }
    const handlers = this._handlers[event];
    handlers &&
      handlers.forEach((fn) => {
        fn(...args);
      });
  }
}
