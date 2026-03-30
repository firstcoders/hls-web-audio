/**
 * Browser audio context constructor with WebKit fallback.
 */
export default window.AudioContext || window.webkitAudioContext;
