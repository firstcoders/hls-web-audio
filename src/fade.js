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
