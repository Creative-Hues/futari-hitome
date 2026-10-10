// 音声で聞き取った文字(確定したもの)から、何目進めるかを読み取る。
// 「あみ」1回で1目、「10目」「十目」「じゅうめ」のような言い方はその数だけ進める。
import { VOICE_COUNT_WORDS } from '../config/tuning';

const KANJI_DIGITS: Record<string, number> = {
  〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

/** 「三十五」「百二十」などの漢数字を数にする(千未満) */
export function kanjiToNumber(s: string): number | null {
  let total = 0;
  let digit: number | null = null;
  for (const ch of s) {
    if (ch in KANJI_DIGITS) {
      digit = KANJI_DIGITS[ch];
    } else if (ch === '十' || ch === '百') {
      total += (digit ?? 1) * (ch === '十' ? 10 : 100);
      digit = null;
    } else {
      return null;
    }
  }
  return total + (digit ?? 0);
}

const KANA_DIGITS: [string, number][] = [
  ['きゅう', 9], ['いち', 1], ['さん', 3], ['よん', 4], ['ろく', 6], ['なな', 7],
  ['はち', 8], ['しち', 7], ['に', 2], ['ご', 5], ['し', 4], ['く', 9],
];

function kanaDigitAt(str: string): [number, string] | null {
  for (const [kana, n] of KANA_DIGITS) if (str.startsWith(kana)) return [n, str.slice(kana.length)];
  return null;
}

/** 「じゅう」「にじゅうご」などのひらがなの数を数にする(百未満) */
export function kanaToNumber(s: string): number | null {
  let rest = s;
  let tens = 0;
  const first = kanaDigitAt(rest);
  if (first && first[1].startsWith('じゅう')) {
    tens = first[0] * 10;
    rest = first[1].slice(3);
  } else if (rest.startsWith('じゅう')) {
    tens = 10;
    rest = rest.slice(3);
  }
  if (rest === '') return tens || null;
  const ones = kanaDigitAt(rest);
  if (!ones || ones[1] !== '') return null;
  return tens + ones[0];
}

const toHalfWidth = (s: string) =>
  s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

const KANA_ONES = '(?:いち|に|さん|よん|ご|ろく|しち|なな|はち|きゅう|く)';
const KANA_NUMBER = `(?:(?:いち|に|さん|よん|ご|ろく|なな|はち|きゅう)?じゅう)?${KANA_ONES}?`;
const NUMBER_PATTERN = new RegExp(
  // 「ごめんね」などを数えないよう、ひらがなの「め」は後ろにひらがなが続かないときだけ
  `([0-9]+|[〇零一二三四五六七八九十百]+|${KANA_NUMBER})\\s*(?:目|め(?![ぁ-ゖ])|もく)`,
  'g',
);

/** 確定した文字から、進める目数を読み取る */
export function countFromTranscript(text: string, words: string[] = VOICE_COUNT_WORDS): number {
  let total = 0;
  let rest = toHalfWidth(text).replace(NUMBER_PATTERN, (whole, num: string) => {
    if (!num) return whole;
    const n = /^[0-9]+$/.test(num) ? parseInt(num, 10) : (kanjiToNumber(num) ?? kanaToNumber(num));
    if (!n) return whole;
    total += n;
    return ' ';
  });

  for (const word of words) {
    const parts = rest.split(word);
    total += parts.length - 1;
    rest = parts.join(' ');
  }
  return total;
}
