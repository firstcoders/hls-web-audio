// @see https://github.com/swevans/unmute/blob/master/unmute.js
const ua = navigator.userAgent.toLowerCase();

export default () =>
  (ua.indexOf('iphone') >= 0 && ua.indexOf('like iphone') < 0) ||
  (ua.indexOf('ipad') >= 0 && ua.indexOf('like ipad') < 0) ||
  (ua.indexOf('ipod') >= 0 && ua.indexOf('like ipod') < 0) ||
  (ua.indexOf('mac os x') >= 0 && navigator.maxTouchPoints > 0);
