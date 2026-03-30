// Fading to zero doesnt work
const ZERO = 0.00001;
const VERY_SHORT = 0.03;

/**
 * Ramps a gain node down to near-silence.
 *
 * @param {GainNode} gainNode
 * @param {{ duration?: number, time?: number }} [options]
 */
const fadeOut = async (gainNode, { duration = VERY_SHORT, time = undefined } = {}) => {
  const { gain, context } = gainNode;
  const at = time || context.currentTime;

  gain.setValueAtTime(gain.value, at);
  gain.linearRampToValueAtTime(ZERO, at + duration);
  // gain.setTargetAtTime(0, at + duration, duration);
};

/**
 * Ramps a gain node up from near-silence.
 *
 * @param {GainNode} gainNode
 * @param {{ duration?: number, volume?: number, time?: number }} [options]
 */
const fadeIn = async (gainNode, { duration = VERY_SHORT, volume = 1, time = undefined } = {}) => {
  const { gain, context } = gainNode;
  const at = time || context.currentTime;

  gain.setValueAtTime(ZERO, at);

  // NOTE: fadein, does not require a delay in resolving as it can happen when the clock ticks
  let to = volume;

  if (to === 0) to = ZERO;

  gain.linearRampToValueAtTime(to, at + duration);
  // gain.setTargetAtTime(to, at + duration, duration);
};

export { fadeIn, fadeOut };
