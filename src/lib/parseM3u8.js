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
