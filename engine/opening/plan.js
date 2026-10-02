// OPENING TREATMENTS — which scenes are "the opening" and what each treatment may
// show. Plain JavaScript shared by the composition (src/opening/*.tsx), the
// Node side (lib/produce.mjs chunk keys) and Nova's art director
// (src/pipeline/docu-art-director.js picks script.opening.kind per video).
//
// A treatment never changes narration, timing, order or sources, and never
// invents a fact: every stamp, quote, headline or place name it draws is read
// from the opening's own narration (`say`) or its scene fields (caption,
// label, sub, kicker, a map scene's points). Anything it cannot find makes the
// kind ineligible; an ineligible or unknown kind renders today's opening.

// 'montage' = the classic signature: fast montage with slammed hook words, then the title (the
// engine's own opening, drawn without a treatment). The user asked to keep it in the rotation.
export const OPENING_KINDS = ['headlines', 'timestamps', 'cold-open', 'evidence', 'map-dive', 'quote', 'montage'];

/** Map regions the engine can draw (src/geo.ts REGIONS). */
export const MAP_REGIONS = ['pacific-northwest', 'bosphorus', 'north-atlantic', 'urals', 'wall-street', 'solar-system'];

/** Without a main title, the opening is the first scenes up to this long (seconds of written `dur`). */
const OPEN_MAX_SEC = 42;
/** A quote opens the video only when it is spoken within the first beats. */
const QUOTE_BEATS = 3;

const isCard = (s) => s?.type === 'title' && !!s.chapterCard;
const stripTags = (t) => String(t ?? '').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
const isTr = (locale) => /^tr/i.test(String(locale ?? 'en'));

/**
 * The opening: the cold-open beats before the video's main title, and the
 * title itself (where every treatment lands). Only scenes before the first
 * chapter card (or chapter change) take part. Without a main title, the
 * first ~40 s of chapter 0.
 * @returns {{beats:number[], title:number, end:number} | null}  end = last opening index (the title when there is one)
 */
export function openingSpan(scenes) {
  const S = Array.isArray(scenes) ? scenes : [];
  const ch0 = S[0]?.chapter ?? 0;
  let stop = S.length;
  for (let i = 0; i < S.length; i++) {
    if (isCard(S[i]) || (S[i]?.chapter ?? ch0) !== ch0) {
      stop = i;
      break;
    }
  }
  const title = S.slice(0, stop).findIndex((s) => s?.type === 'title' && !s.chapterCard);
  let beats = [];
  if (title > 0) beats = Array.from({ length: title }, (_, i) => i);
  else if (title < 0) {
    let t = 0;
    for (let i = 0; i < stop && t < OPEN_MAX_SEC; i++) {
      beats.push(i);
      t += Number(S[i]?.dur) || 4;
    }
  }
  if (beats.length < 2) return null;
  return { beats, title, end: title >= 0 ? title : beats[beats.length - 1] };
}

/* ================================================================ numbers in words */

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const ORD = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13,
  fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30,
};
const ONE_RX = ONES.join('|');
const TEN_RX = Object.keys(TENS).join('|');
const ORD_RX = Object.keys(ORD).join('|');
/** "seventy-one", "thirteen", "forty five" (0-99). */
const N99 = `(?:(?:${TEN_RX})(?:[- ](?:${ONES.slice(1, 10).join('|')}))?|${ONE_RX})`;

function n99(w) {
  const t = String(w ?? '').toLowerCase().trim().split(/[- ]+/);
  if (t.length === 1) {
    if (ONES.includes(t[0])) return ONES.indexOf(t[0]);
    if (TENS[t[0]] !== undefined) return TENS[t[0]];
    return null;
  }
  if (t.length === 2 && TENS[t[0]] !== undefined && ONES.indexOf(t[1]) > 0 && ONES.indexOf(t[1]) < 10) return TENS[t[0]] + ONES.indexOf(t[1]);
  return null;
}
function ordinal(w) {
  const t = String(w ?? '').toLowerCase().trim();
  if (/^\d{1,2}(st|nd|rd|th)?$/.test(t)) return parseInt(t, 10);
  const parts = t.split(/[- ]+/);
  if (parts.length === 1) return ORD[parts[0]] ?? null;
  if (parts.length === 2 && TENS[parts[0]] !== undefined && ORD[parts[1]] && ORD[parts[1]] < 10) return TENS[parts[0]] + ORD[parts[1]];
  return null;
}
/** A spoken year: "nineteen seventy-one", "fourteen fifty-three", "two thousand twenty-three", "nineteen oh five". */
const YEAR_WORDS = `(?:(?:${ONE_RX}|${TEN_RX})[- ](?:hundred(?:[- ]and)?[- ])?(?:oh[- ](?:${ONES.slice(1, 10).join('|')})|${N99})|two thousand(?:[- ](?:and[- ])?${N99})?)`;
function yearOf(w) {
  const t = String(w ?? '').toLowerCase().trim();
  if (/^\d{4}$/.test(t)) return parseInt(t, 10);
  const m2 = t.match(/^two thousand(?:[- ](?:and[- ])?(.+))?$/);
  if (m2) return 2000 + (m2[1] ? n99(m2[1]) ?? NaN : 0);
  const m = t.match(new RegExp(`^(${ONE_RX}|${TEN_RX})[- ](?:hundred(?:[- ]and)?[- ])?(?:oh[- ](\\w+)|(.+))$`));
  if (!m) return null;
  const hi = n99(m[1]);
  const lo = m[2] ? ONES.indexOf(m[2]) : n99(m[3]);
  if (hi === null || lo === null || lo < 0 || hi < 10) return null;
  return hi * 100 + lo;
}

/** Turkish number words 1-59 as a clock says them, with the case endings a time takes ("yirmiyi", "dokuza", "üçü"). */
const TR_ONES = { bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6, yedi: 7, sekiz: 8, dokuz: 9 };
const TR_TENS = { on: 10, yirmi: 20, otuz: 30, kırk: 40, elli: 50 };
const TR_NUM_RX = '(?:bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on|yirmi|otuz|kırk|elli)(?:y?[ıiuüae])?';
function trNum(words) {
  const base = (w) => {
    const x = w.toLocaleLowerCase('tr-TR');
    for (const k of [...Object.keys(TR_ONES), ...Object.keys(TR_TENS)].sort((a, b) => b.length - a.length)) if (x === k || (x.startsWith(k) && /^y?[ıiuüae]$/.test(x.slice(k.length)))) return k;
    return null;
  };
  const parts = String(words ?? '').trim().split(/\s+/).map(base);
  if (!parts.length || parts.some((p) => !p)) return null;
  if (parts.length === 1) return TR_ONES[parts[0]] ?? TR_TENS[parts[0]] ?? null;
  if (parts.length === 2 && TR_TENS[parts[0]] && TR_ONES[parts[1]]) return TR_TENS[parts[0]] + TR_ONES[parts[1]];
  return null;
}

/* ================================================================ dates and times */

const MONTHS_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MON_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS_TR = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];
const MON_RX_EN = `(?:${MONTHS_EN.join('|')}|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\\.?`;
const MON_RX_TR = `(?:${MONTHS_TR.join('|')})`;

function monthIndex(w) {
  const t = String(w ?? '').toLocaleLowerCase('tr-TR').replace(/\.$/, '').replace(/['’].*$/, '');
  let k = MONTHS_TR.indexOf(t);
  if (k >= 0) return k;
  const e = String(w ?? '').toLowerCase().replace(/\.$/, '');
  k = MONTHS_EN.indexOf(e);
  if (k >= 0) return k;
  return MONTHS_EN.findIndex((m) => e.length >= 3 && m.startsWith(e));
}

/** A clock time, as it is spoken or written, with the marker that makes it a time. */
function findTime(text, tr) {
  const t = text;
  // 8:13 PM, 20.13, 10:00
  let m = t.match(/\b(\d{1,2})[:.](\d{2})\s*(a\.?\s?m\.?|p\.?\s?m\.?)?(?=[^\d]|$)/i);
  if (m && +m[1] <= 24 && +m[2] < 60 && (m[3] || tr || /\b(saat|o'clock|at)\b/i.test(t.slice(Math.max(0, m.index - 8), m.index)))) {
    return clock(+m[1], +m[2], m[3] ? (/p/i.test(m[3]) ? 'pm' : 'am') : null, tr);
  }
  if (tr) {
    m = t.match(/\bsaat\s+(\d{1,2})(?:[:.](\d{2}))?/i);
    if (m && +m[1] <= 24) return clock(+m[1], +(m[2] ?? 0), null, tr);
    // "saat yirmiyi on üç geçe", "saat dokuza çeyrek kala", "saat on bir buçuk"
    m = t.match(new RegExp(`\\bsaat\\s+((?:(?:${TR_NUM_RX}|çeyrek)\\s+){0,3}(?:${TR_NUM_RX}|çeyrek))(?:\\s+(geçe|kala|buçuk))?(?=[^\\p{L}]|$)`, 'iu'));
    if (m) {
      const toks = m[1].split(/\s+/);
      const how = (m[2] ?? '').toLocaleLowerCase('tr-TR');
      // The hour is the first one or two words; the minutes (or "çeyrek") the rest.
      for (const k of [1, 2]) {
        if (toks.length < k) continue;
        let h = trNum(toks.slice(0, k).join(' '));
        const rest = toks.slice(k).join(' ');
        if (h === null || h > 24) continue;
        if (how === 'buçuk' && !rest) return clock(h, 30, null, tr);
        if ((how === 'geçe' || how === 'kala') && rest) {
          let mm = rest.toLocaleLowerCase('tr-TR') === 'çeyrek' ? 15 : trNum(rest);
          if (mm === null || mm >= 60) continue;
          if (how === 'kala') {
            h = (h + 23) % 24;
            mm = 60 - mm;
          }
          return clock(h, mm, null, tr);
        }
        // A bare "saat on" only when the sentence ends there ("saat iki kişi" is not a time).
        if (!how && !rest && /^s*([.,;!?…]|$)/.test(t.slice((m.index ?? 0) + m[0].length))) return clock(h, 0, null, tr);
      }
    }
    return null;
  }
  // "Eight-thirteen PM", "Twelve forty-five at night", "Ten o'clock", "Two-fifty PM", "three in the morning"
  const H = `(${ONES.slice(1, 13).join('|')})`;
  const rx = new RegExp(`\\b${H}(?:[- ](oh[- ](?:${ONES.slice(1, 10).join('|')})|${N99}))?\\s*(a\\.?m\\.?|p\\.?m\\.?|o['’]clock|at night|in the morning|in the evening|in the afternoon|at dawn)(?=[^a-z]|$)`, 'i');
  m = t.match(rx);
  if (m) {
    const h = ONES.indexOf(m[1].toLowerCase());
    const mm = m[2] ? (/^oh/i.test(m[2]) ? ONES.indexOf(m[2].split(/[- ]/)[1].toLowerCase()) : n99(m[2])) : 0;
    if (h >= 1 && h <= 12 && mm !== null && mm >= 0 && mm < 60) {
      const mk = m[3].toLowerCase();
      let ap = null;
      if (/^p|evening|afternoon/.test(mk)) ap = 'pm';
      else if (/^a\.?m|morning|dawn/.test(mk)) ap = 'am';
      else if (/night/.test(mk)) ap = h === 12 || h < 5 ? 'am' : 'pm';
      return clock(h, mm, ap, tr);
    }
  }
  m = t.match(/\b(noon|midnight|dawn|dusk)\b/i);
  if (m) return m[1].toUpperCase();
  return null;
}
function clock(h, m, ap, tr) {
  if (tr) {
    let hh = h;
    if (ap === 'pm' && h < 12) hh += 12;
    if (ap === 'am' && h === 12) hh = 0;
    return `${String(hh).padStart(2, '0')}.${String(m).padStart(2, '0')}`;
  }
  if (h > 12) return `${h - 12}:${String(m).padStart(2, '0')} PM`;
  return `${h}:${String(m).padStart(2, '0')}${ap ? ` ${ap.toUpperCase()}` : ''}`;
}

/** A calendar date (day/month/year, any of them) and how precise it is. */
function findDate(text, tr) {
  const t = text;
  const out = { day: null, day2: null, month: null, year: null, year2: null };
  if (tr) {
    let m = t.match(new RegExp(`\\b(\\d{1,2})(?:\\s*[-–]\\s*(\\d{1,2}))?\\s+(${MON_RX_TR})(?:\\s+(\\d{4}))?`, 'iu'));
    if (m) return { ...out, day: +m[1], day2: m[2] ? +m[2] : null, month: monthIndex(m[3]), year: m[4] ? +m[4] : null };
    m = t.match(new RegExp(`(${MON_RX_TR})\\s+(\\d{4})`, 'iu'));
    if (m) return { ...out, month: monthIndex(m[1]), year: +m[2] };
  } else {
    // "November twenty-fourth, nineteen seventy-one", "April 22nd, 1453", "April 14-15, 1912", "Oct 29, 1929", "January, 1943", "November 2023"
    const day = `(\\d{1,2}(?!\\d)(?:st|nd|rd|th)?|(?:${TEN_RX})[- ](?:${ORD_RX})|${ORD_RX})`;
    const yr = `(\\d{4}|${YEAR_WORDS})`;
    const rx = new RegExp(`\\b(${MON_RX_EN})(?:\\s+(?:the\\s+)?${day}(?:\\s*[-–]\\s*(\\d{1,2}))?)?(?:,?\\s+${yr})?(?=[^a-z]|$)`, 'i');
    let m = t.match(rx);
    // "May" alone is a verb more often than a month: it needs a day or a year.
    while (m && (!m[2] && !m[4])) {
      const rest = t.slice(m.index + m[0].length);
      const n = rest.match(rx);
      if (!n) {
        m = null;
        break;
      }
      n.index = (n.index ?? 0) + m.index + m[0].length;
      m = n;
    }
    if (m) {
      const d = m[2] ? ordinal(m[2]) : null;
      const y = m[4] ? yearOf(m[4]) : null;
      return { ...out, month: monthIndex(m[1]), day: d && d <= 31 ? d : null, day2: m[3] ? +m[3] : null, year: Number.isFinite(y) ? y : null };
    }
    // "the twenty-fourth of November, 1971"
    m = t.match(new RegExp(`\\b(?:the\\s+)?${day}\\s+of\\s+(${MON_RX_EN})(?:,?\\s+${yr})?`, 'i'));
    if (m) {
      const y = m[3] ? yearOf(m[3]) : null;
      return { ...out, day: ordinal(m[1]), month: monthIndex(m[2]), year: Number.isFinite(y) ? y : null };
    }
  }
  // Years: a range "1929-1932", or one year said as a time ("in 1884", "January, 1959" handled above).
  let m = t.match(/(?<![\d$£€₺.,])\b(1[0-9]{3}|20[0-9]{2})\s*[-–]\s*(1[0-9]{3}|20[0-9]{2})\b(?![\d%])/);
  if (m) return { ...out, year: +m[1], year2: +m[2] };
  // A year that only bounds a span ("since 1959", "until 1945") is not when the beat happens.
  m = t.match(/(?<!\b(?:since|until|till|after|before|from|by|for|beri|kadar)\s+)(?<![\d$£€₺.,])\b(1[0-9]{3}|20[0-9]{2})\b(?![\d%.,]\d)(?!\s*(?:%|percent|people|men|women|meters?|m\b|km|feet|ft|miles|tons?|dollars|seats|passengers|years|yıl|kişi|metre))/i);
  if (m) return { ...out, year: +m[1] };
  if (!tr) {
    m = t.match(new RegExp(`\\b(?:in|of)\\s+(${YEAR_WORDS})\\b`, 'i'));
    const y = m ? yearOf(m[1]) : null;
    if (y && y >= 1000 && y <= 2099) return { ...out, year: y };
  }
  return out;
}

function formatDate(d, tr) {
  if (d.month === null || d.month < 0) {
    if (d.year && d.year2) return `${d.year}–${d.year2}`;
    return d.year ? String(d.year) : '';
  }
  if (tr) {
    const mon = MONTHS_TR[d.month].toLocaleUpperCase('tr-TR');
    const day = d.day ? `${d.day}${d.day2 ? `–${d.day2}` : ''} ` : '';
    return `${day}${mon}${d.year ? ` ${d.year}` : ''}`;
  }
  const mon = MON_EN[d.month];
  if (d.day) return `${mon} ${d.day}${d.day2 ? `–${d.day2}` : ''}${d.year ? `, ${d.year}` : ''}`;
  return `${mon}${d.year ? ` ${d.year}` : ''}`;
}

/**
 * A beat's own time stamp: a date and/or a clock time found in its narration
 * or its date-bearing fields (caption, label, sub, kicker, date). Nothing is
 * carried over from another scene.
 * @returns {{text:string, date:string, time:string, precision:'time'|'day'|'month'|'year'} | null}
 */
export function stampOf(scene, locale) {
  if (!scene) return null;
  const tr = isTr(locale);
  const fields = [scene.caption, scene.label, scene.sub, scene.kicker, scene.date].filter((x) => typeof x === 'string' && x.trim());
  const say = stripTags(scene.say);
  const sources = [say, ...fields];
  let time = null;
  let date = null;
  let fromSay = false;
  sources.forEach((s, k) => {
    if (!time) {
      time = findTime(s, tr);
      if (time && k === 0) fromSay = true;
    }
    const d = findDate(s, tr);
    const rank = (x) => (x ? (x.day ? 3 : x.month !== null && x.month >= 0 ? 2 : x.year ? 1 : 0) : 0);
    if (rank(d) > rank(date)) {
      date = d;
      if (k === 0) fromSay = true;
    }
  });
  // A year counter is a date field of its own ("1971", label "November 24").
  if (scene.type === 'counter' && (scene.year || (Number.isInteger(scene.to) && scene.to >= 1000 && scene.to <= 2099 && !scene.prefix && !scene.suffix))) {
    const d = findDate(`${scene.label ?? ''} ${scene.to}`, tr);
    if (!date || (d.month !== null && d.month >= 0 && !(date.month >= 0))) date = d.year ? d : { ...d, year: scene.to };
    else if (!date.year) date = { ...date, year: scene.to };
  }
  const ds = date ? formatDate(date, tr) : '';
  const ts = time || '';
  if (!ds && !ts) return null;
  const precision = ts ? 'time' : date.day ? 'day' : date.month !== null && date.month >= 0 ? 'month' : 'year';
  return { text: [ds, ts].filter(Boolean).join(' · '), date: ds, time: ts, precision, fromSay };
}

/* ================================================================ quotes */

const SPEECH_EN = '(?:said|says|wrote|writes|told [^:.]{1,30}|promised|declared|warned|asked|replied|announced|radioed|cabled|whispered|shouted|reads|read)';
const SPEECH_TR = '(?:dedi|demişti|diyordu|der|yazdı|yazmıştı|yazıyordu|söyledi|söylemişti|haykırdı|fısıldadı|ilan etti)';

/**
 * A real quotation in the scene: words inside quotation marks in the
 * narration (or on-screen text), or the words after a speech verb and a colon
 * ("All he told reporters: I am in too much grief to talk."). At least three words.
 */
export function quoteOf(scene, locale) {
  if (!scene) return null;
  const say = stripTags(scene.say);
  const fields = [say, String(scene.text ?? '')];
  for (const f of fields) {
    const m = f.match(/[“"«„]([^”"»“]{6,}?)[”"»“]/);
    if (m && m[1].trim().split(/\s+/).length >= 3) return m[1].trim();
  }
  const verb = isTr(locale) ? SPEECH_TR : SPEECH_EN;
  const m = say.match(new RegExp(`\\b${verb}\\s*:\\s*(.+)$`, 'i'));
  if (m) {
    const q = m[1].trim();
    const n = q.split(/\s+/).length;
    if (n >= 3 && n <= 32) return q;
  }
  return null;
}

/* ================================================================ map, rewind */

/** The story's place: a map scene with a region the engine draws, and the point the opening is about. */
export function mapTarget(scenes, span) {
  const S = Array.isArray(scenes) ? scenes : [];
  const ok = (p) => String(p?.label ?? '').trim() && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y));
  const maps = S.filter((s) => s?.type === 'map' && MAP_REGIONS.includes(s.region) && Array.isArray(s.points) && s.points.some(ok));
  if (!maps.length) return null;
  const out = (map, p) => ({ region: map.region, point: { label: String(p.label).trim(), x: Number(p.x), y: Number(p.y) } });
  // 1) A point the opening itself names (narration, title, kicker, captions).
  const idx = span ? [...span.beats, span.title].filter((i) => i >= 0) : [];
  const words = idx.map((i) => [stripTags(S[i]?.say), S[i]?.title, S[i]?.kicker, S[i]?.caption, S[i]?.text].filter(Boolean).join(' ')).join(' ').toLowerCase();
  for (const m of maps) {
    const p = m.points.find((q) => ok(q) && String(q.label).trim().length >= 3 && words.includes(String(q.label).toLowerCase().trim()));
    if (p) return out(m, p);
  }
  // 2) The first map's own focus (where the script itself points the camera), 3) else the first map's last stop.
  const withFocus = maps.find((m) => Number.isInteger(m.focus) && ok(m.points[m.focus]));
  if (withFocus) return out(withFocus, withFocus.points[withFocus.focus]);
  const pts = maps[0].points.filter(ok);
  return out(maps[0], pts[pts.length - 1]);
}

/**
 * The short "rewind" caption for the title card of a cold open, only when the
 * script itself rewinds right after the title ("Now, rewind. January, 1959.",
 * "eighty-six years earlier"). Null when it does not.
 */
export function rewindCaption(scenes, span, locale) {
  if (!span || span.title < 0) return null;
  const tr = isTr(locale);
  const S = scenes;
  for (let i = span.title + 1; i < Math.min(S.length, span.title + 10); i++) {
    const s = S[i];
    if (!s || isCard(s)) continue;
    const say = stripTags(s.say);
    const cue = tr
      ? /\b(geri sar|geriye dönelim|başa dönelim|(\S+\s+)?(yıl|ay|gün|saat) önce|her şey .{0,30}başladı)/i.test(say)
      : /\b(rewind|go back|let'?s go back|(\S+[- ]?\S*\s+)?(years?|months?|days?|hours?|weeks?|decades?) (earlier|before)|it (all )?(began|begins|started|starts))\b/i.test(say);
    if (!cue) continue;
    const st = stampOf(s, locale);
    if (st?.date && st.precision !== 'time') return { scene: i, text: st.date };
    const ago = tr ? say.match(/\b(\d+|[\wçğıöşü]+(?:\s[\wçğıöşü]+)?)\s+(yıl|ay|gün|saat)\s+önce/i) : say.match(/\b((?:\d+|[a-z]+(?:[- ][a-z]+)?))\s+(years?|months?|days?|hours?|weeks?|decades?)\s+(earlier|before)\b/i);
    if (ago) {
      if (tr) return { scene: i, text: `${ago[1]} ${ago[2]} önce`.toLocaleUpperCase('tr-TR') };
      const n = /^\d+$/.test(ago[1]) ? +ago[1] : n99(ago[1].replace(/ /g, '-')) ?? n99(ago[1]);
      return { scene: i, text: n !== null ? `${n} ${ago[2]} ${ago[3]}`.toUpperCase() : `${ago[1]} ${ago[2]} ${ago[3]}`.toUpperCase() };
    }
    return null;
  }
  return null;
}

/* ================================================================ eligibility */

const hasPicture = (s) => !!s && !isCard(s) && !!(s.image || s.video || (Array.isArray(s.images) && s.images.length) || s.imagePrompt || (Array.isArray(s.imagePrompts) && s.imagePrompts.length) || s.search || s.layers);
const pictureCount = (s) => (s?.type === 'montage' ? Math.max(s.images?.length ?? 0, s.imagePrompts?.length ?? 0, s.clips?.length ?? 0) : hasPicture(s) && s.type !== 'counter' && s.type !== 'chart' ? 1 : 0);
/** Lines the hook gives a headline: montage words, a slam, a words line. */
export function headlineItems(scene) {
  if (!scene) return [];
  if (scene.type === 'montage' && scene.text) return stripTags(scene.text).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (scene.type === 'slam' && scene.word) return [String(scene.word)];
  if (scene.type === 'words' && scene.text) return [stripTags(scene.text)];
  return [];
}

/**
 * Everything the treatments need, computed once.
 * @returns {null | {span, stamps:(object|null)[], quote:{beat:number, scene:number, text:string}|null, map:object|null, rewind:{scene:number, text:string}|null, pictures:number, headlines:number}}
 */
export function openingFacts(script) {
  const scenes = script?.scenes ?? [];
  const span = openingSpan(scenes);
  if (!span) return null;
  const locale = script?.locale ?? 'tr-TR';
  const stamps = span.beats.map((i) => stampOf(scenes[i], locale));
  let quote = null;
  for (let k = 1; k < Math.min(QUOTE_BEATS, span.beats.length) && !quote; k++) {
    const q = quoteOf(scenes[span.beats[k]], locale);
    if (q) quote = { beat: k, scene: span.beats[k], text: q };
  }
  return {
    span,
    stamps,
    quote,
    map: mapTarget(scenes, span),
    rewind: rewindCaption(scenes, span, locale),
    pictures: span.beats.reduce((n, i) => n + pictureCount(scenes[i]), 0),
    headlines: span.beats.reduce((n, i) => n + headlineItems(scenes[i]).length, 0),
  };
}

/**
 * Which kinds this script can carry, and why not.
 * @returns {Record<string, {ok:boolean, why:string}>}
 */
export function openingEligibility(script, facts = openingFacts(script)) {
  const out = {};
  const no = (why) => ({ ok: false, why });
  const yes = (why) => ({ ok: true, why });
  for (const k of OPENING_KINDS) out[k] = no('no opening (needs 2+ scenes before the title)');
  if (!facts) return out;
  const n = facts.span.beats.length;
  out.headlines = facts.headlines >= 3 ? yes(`${facts.headlines} hook lines`) : no('fewer than 3 hook words/slams/lines');
  const stamped = facts.stamps.filter(Boolean);
  const sharp = stamped.filter((s) => s.precision !== 'year').length;
  out.timestamps = sharp >= 1 || stamped.length >= 2 ? yes(stamped.map((s) => s.text).join(' | ')) : no('no date/time in the opening narration');
  out['cold-open'] = facts.span.title >= 0 && n >= 2 ? yes(facts.rewind ? `rewind: ${facts.rewind.text}` : 'hard cut to the title') : no('no main title to cut to');
  out.evidence = facts.pictures >= 3 ? yes(`${facts.pictures} opening pictures`) : no('fewer than 3 opening pictures');
  out['map-dive'] = facts.map ? yes(`${facts.map.region} → ${facts.map.point.label}`) : no('no map region in the script');
  out.quote = facts.quote ? yes(`“${facts.quote.text.slice(0, 60)}”`) : no('no quotation in beats 2-3 (beat 1 is the hook)');
  const first = script?.scenes?.[0];
  out.montage = first?.type === 'montage' && String(first.text || '').trim() ? yes(`hook words: ${String(first.text).trim()}`) : no('the script does not open on a montage with hook words');
  return out;
}

/**
 * The treatment the engine draws: script.opening.kind when it is known and
 * eligible, else null (today's opening).
 */
export function resolveOpening(script) {
  const kind = script?.opening?.kind;
  // The classic montage hook is the engine's own opening: no treatment layer.
  if (!OPENING_KINDS.includes(kind) || kind === 'montage') return null;
  const facts = openingFacts(script);
  if (!facts) return null;
  if (!openingEligibility(script, facts)[kind]?.ok) return null;
  return { kind, hook: hookStyle(script), ...facts };
}

/** Last scene index a treatment can touch (for render cache keys); -1 without one. */
export function openingEnd(script) {
  const o = resolveOpening(script);
  if (!o) return -1;
  // The quote's hit lands on the scene after it; a cold open's rewind caption on the scene that rewinds.
  return Math.max(o.span.end + (o.kind === 'quote' ? 1 : 0), o.kind === 'cold-open' && o.rewind ? o.rewind.scene : -1);
}

/* ================================================================ hook style */

/** How hard the opening's hook lands: a slam with a hit and a flash, a dramatic cinematic reveal, or a quiet wonder. */
export const HOOK_STYLES = ['impact', 'cinematic', 'quiet'];
const GENRE_HOOK = { crime: 'impact', horror: 'impact', finance: 'impact', documentary: 'cinematic', epic: 'cinematic', science: 'quiet', inspire: 'quiet' };
const CALM_MOODS = new Set(['calm', 'sad']);

/**
 * The hook's intensity: script.opening.hook when set (the art director's
 * choice from the story's tone and the first scenes' mood and energy), else
 * the genre's: crime, horror and finance crashes hit hard; documentary and
 * epic are dramatic but cinematic; science and biography open in quiet
 * wonder. A calm, sad first beat takes it one step quieter.
 */
export function hookStyle(script) {
  const want = script?.opening?.hook;
  if (HOOK_STYLES.includes(want)) return want;
  const base = GENRE_HOOK[script?.genre] ?? 'cinematic';
  const span = openingSpan(script?.scenes ?? []);
  const first = (span?.beats ?? []).slice(0, 2).map((i) => script.scenes[i]).filter(Boolean);
  if (first.length && first.every((s) => CALM_MOODS.has(s.mood))) return HOOK_STYLES[Math.min(HOOK_STYLES.length - 1, HOOK_STYLES.indexOf(base) + 1)];
  return base;
}
