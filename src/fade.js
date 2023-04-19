// Fading to zero doesnt work
const ZERO = 0.00001;

const fadeOut = (gainNode, { duration = 1 } = {}) => {
  const { gain, context } = gainNode;
  gain.setValueAtTime(gain.value, context.currentTime);
  gain.linearRampToValueAtTime(ZERO, context.currentTime + duration);
};

const fadeIn = (gainNode, { duration = 1 } = {}) => {
  const { gain, context } = gainNode;

  gain.setValueAtTime(ZERO, context.currentTime);

  // NOTE: fadein, does not require a delay in resolving as it can happen when the clock ticks
  let to = gain.stateValue !== undefined ? gain.stateValue : 1;

  if (to === 0) to = ZERO;

  gain.linearRampToValueAtTime(to, context.currentTime + duration);
};

export { fadeIn, fadeOut };
