// 音声入力で数える言葉(設定で変えられる)を、聞き取りの文字と比べる形にする
import { VOICE_COUNT_WORDS } from '../config/tuning';

/** ひらがなをカタカナに(聞き取りではカタカナになることがあるため) */
const toKatakana = (s: string) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

/**
 * 設定の言葉から、実際に探す言葉の一覧を作る。
 *  - 「あみ」は今までどおり「アミ」「編み」「網」も数える
 *  - ほかの言葉もカタカナで聞き取られたときに数える
 *  - 長い言葉から先に探す(「あみあみ」と「あみ」を両方入れても二重に数えないように)
 */
export function countWordsFor(words: string[]): string[] {
  const out = new Set<string>();
  for (const raw of words) {
    const w = raw.trim();
    if (!w) continue;
    out.add(w);
    out.add(toKatakana(w));
    if (w === VOICE_COUNT_WORDS[0]) VOICE_COUNT_WORDS.forEach((v) => out.add(v));
  }
  return [...out].sort((a, b) => b.length - a.length);
}

/** 入力された言葉を整える(前後の空白を消す)。使えなければ null */
export function cleanWord(s: string): string | null {
  const w = s.trim().replace(/\s+/g, '');
  return w.length > 0 && w.length <= 12 ? w : null;
}
