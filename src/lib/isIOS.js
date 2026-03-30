// @see https://github.com/swevans/unmute/blob/master/unmute.js
const ua = navigator.userAgent.toLowerCase();

/**
 * Detects iOS and iPadOS Safari environments that require the unmute workaround.
 *
 * @returns {boolean}
 */
export default () =>
  (ua.indexOf('iphone') >= 0 && ua.indexOf('like iphone') < 0) ||
  (ua.indexOf('ipad') >= 0 && ua.indexOf('like ipad') < 0) ||
  (ua.indexOf('ipod') >= 0 && ua.indexOf('like ipod') < 0) ||
  (ua.indexOf('mac os x') >= 0 && navigator.maxTouchPoints > 0);
