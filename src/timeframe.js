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

/**
 * @class Timeframe
 */
export default class Timeframe {
  constructor({ adjustedStart, adjustedEnd, currentTime, playDuration, offset }) {
    this.adjustedStart = adjustedStart;
    this.adjustedEnd = adjustedEnd;
    this.currentTime = currentTime;
    this.playDuration = playDuration;
    this.offset = offset;
  }

  /**
   * Calculate start relative to now.
   * Normally the start time is just this.start. However due to seeking this can vary. It will help to understand the workings of the audiocontext timeline.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/currentTime
   * @see https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start
   *
   * @param {Integer} segment - The segment
   * @param {Integer} segment.start - The start time in seconds
   *
   * @returns {Integer|undefined}
   */
  calculateRealStart({ start }) {
    let realStart = this.adjustedStart + start;

    if (realStart < 0) realStart = 0;

    return realStart;
  }

  /**
   * Calculate offset by taking into consideration the start time.
   * Normally the offset is 0. If the user seeks halfway into a 10 second segment, the offset is 5.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start
   *
   * @param {Integer} t
   * @returns {Integer|undefined}
   */
  calculateOffset({ start }) {
    let offset = this.currentTime - start;

    // offset is < 0 when start is in the future, so offset should be 0 in that case
    if (offset < 0) offset = 0;

    return offset;
  }

  get end() {
    return this.offset + this.playDuration;
  }
}
