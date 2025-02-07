/**
 * Copyright (C) 2019-2023 First Coders LTD
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
// Fading to zero doesnt work
const ZERO = 0.00001;
const VERY_SHORT = 0.03;

const fadeOut = async (gainNode, { duration = VERY_SHORT, time = undefined } = {}) => {
  const { gain, context } = gainNode;
  const at = time || context.currentTime;

  gain.setValueAtTime(gain.value, at);
  gain.linearRampToValueAtTime(ZERO, at + duration);
  // gain.setTargetAtTime(0, at + duration, duration);
};

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
