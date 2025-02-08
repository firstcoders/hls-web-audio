import m3u8Parser from '../../vendor/mpd-m3u8-to-json/m3u8Parser.js';

/**
 * Parses a m3u8 manifest into a neat structure
 * @private
 * @param {String} manifest - The m3u8 manifest
 * @param {String} src - The src to the m3u8 file
 * @returns
 */
export default (manifest, src) => {
  const { segments } = m3u8Parser(manifest, src);

  return segments.map(({ url, end, start }) => ({
    src: url,
    duration: end - start,
  }));
};
