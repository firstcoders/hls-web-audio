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
import * as Parser from '@soundws/mpd-m3u8-to-json';

const { m3u8Parser } = Parser.default;

/**
 * Parses a m3u8 manifest into a neat structure
 * @private
 * @param {String} manifest - The m3u8 manifest
 * @param {String} src - The src to the m3u8 file
 * @returns
 */
export default (manifest, src) => {
  try {
    const { segments } = m3u8Parser(manifest, src);

    return segments.map(({ url, end, start }) => ({
      src: url,
      duration: end - start,
    }));
  } catch (error) {
    const e = new Error(`Failed to parse m3u8 ${src}`);
    e.originalError = error;
    throw e;
  }
};
