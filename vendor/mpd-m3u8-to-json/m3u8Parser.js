/**
 * Custom ESM build of https://github.com/xiyuyizhi/mpd-m3u8-to-json. Credits to xiyuyizhi.
 *
 * Copyright (c) xiyuyizhi
 */
/* eslint-disable */
const PREFIX_TAG_PATTERN = /#EXT(?:-X-)?([^:]+):?(.*)$/;
const TAG_PAIR_SPLIT_PATTERN = /([^,="]+)((="[^"]+")|(=[^,]+))*/g;
function formatNameToCamel(str) {
  return str.split('-').reduce((all, c) => {
    if (!all) {
      all += c.toLowerCase();
      return all;
    }
    all += c.charAt(0) + c.slice(1).toLowerCase();
    return all;
  }, '');
}
function parseTag(tagStr) {
  if (!(/^#EXT/.test(tagStr) || !/^\s*#/.test(tagStr))) return null;
  let tagName;
  let attr;
  let matched = PREFIX_TAG_PATTERN.exec(tagStr);
  if (matched) {
    tagName = formatNameToCamel(matched[1]);
    attr = parseTagAttr(matched[2]);
  } else {
    tagName = 'url';
    attr = tagStr;
  }
  return { [tagName]: attr };
}
function parseTagAttr(attrStr) {
  if (!attrStr) return null;
  let attrList = attrStr.match(TAG_PAIR_SPLIT_PATTERN).map((pairStr) => parseTagAttrPairs(pairStr));
  if (attrList.length === 1) return attrList[0];
  if (attrList.filter((x) => typeof x === 'object').length === 0) {
    return attrList;
  }
  return attrList.reduce((all, c) => {
    return {
      ...all,
      ...c,
    };
  }, {});
}
function parseTagAttrPairs(attrPairStr) {
  let attrPairs = attrPairStr.trim().replace('=', '|').split('|');
  if (attrPairs.length == 2) {
    let key = formatNameToCamel(attrPairs[0]);
    return {
      [key]: attrPairs[1].replace(/("|')/g, ''),
    };
  }
  let v = parseFloat(attrPairs[0]);
  return Number.isNaN(v) ? attrPairs[0] : v;
}
function geneAbsUrl(url, base) {
  if (/^https?/.test(url) || /^data:/.test(url) || /^sdk:/.test(url)) {
    return url;
  }
  base = base.split('/').slice(0, -1);
  url = url.split('/');
  while (url.length) {
    let c = url.shift();
    if (base.indexOf(c) == -1) {
      base.push(c);
    }
  }
  return base.join('/');
}
function mergeTags(tagList, result, postHooks) {
  let master = result.master;
  let len = tagList.length;
  let cc = 0;
  let duration = 0;
  let startSN = 0;
  let segCount = 0;
  let levelCount = 0;
  let keyIndex = -1;
  for (let i = 0; i < len; i++) {
    let tagInfo = tagList[i];
    for (let key in tagInfo) {
      let v = tagInfo[key];
      if (v && v['uri']) {
        v['url'] = geneAbsUrl(v['uri'], result['m3u8Url']);
      }
      switch (key) {
        case 'inf':
          let segment = {
            start: duration,
            end: duration + (Array.isArray(v) ? v[0] : v),
            cc,
            sn: startSN + segCount,
          };
          if (keyIndex >= 0) {
            segment['keyIndex'] = keyIndex;
          }
          segCount++;
          duration = segment['end'];
          result['segments'].push(segment);
          break;
        case 'start':
          duration = v;
          break;
        case 'discontinuity':
          cc++;
          break;
        case 'mediaSequence':
          startSN = v;
          break;
        case 'streamInf':
          levelCount++;
          v['levelId'] = levelCount;
          result['levels'].push(v);
          break;
        case 'media':
          result['medias'].push(v);
          break;
        case 'endlist':
          result['live'] = false;
          break;
        case 'key':
          keyIndex++;
          if (result['key']) {
            result['key'].push(v);
          } else {
            result['key'] = [v];
          }
          break;
        case 'url':
          let list = master ? result['levels'] : result['segments'];
          if (!list.length) {
            throw new Error('invalid m3u8');
          }
          if (master) {
            list[levelCount - 1].url = geneAbsUrl(v, result['m3u8Url']);
          } else {
            list[segCount - 1].url = geneAbsUrl(v, result['m3u8Url']);
          }
          break;
        default:
          if (v) {
            result[key] = v;
          }
      }
    }
    if (postHooks) {
      result = postHooks(tagInfo, result);
    }
  }
  if (!master) {
    result['startSN'] = startSN;
    result['endSN'] = startSN + segCount - 1;
    result['duration'] = duration;
  }
  return result;
}
function m3u8Parser(text, m3u8Url, postHooks) {
  if (!text || !m3u8Url) {
    return { error: 1, msg: 'invalid input' };
  }
  const tagList = text
    .split('\n')
    .filter(Boolean)
    .map((x) => parseTag(x.trim()))
    .filter(Boolean);
  if (!tagList.length) {
    return { error: 1, msg: 'invalid m3u8' };
  }
  const isMaster = tagList.filter((x) => !!x['streamInf']).length !== 0;
  let result;
  if (isMaster) {
    result = {
      master: true,
      m3u8Url,
      levels: [],
      medias: [],
    };
  } else {
    result = {
      master: false,
      m3u8Url,
      duration: 0,
      startSN: 0,
      endSN: 0,
      segments: [],
      live: true,
    };
  }
  try {
    result = mergeTags(tagList, result, postHooks);
  } catch (e) {
    return { error: 1, msg: e.message };
  }
  return result;
}
export default m3u8Parser;
