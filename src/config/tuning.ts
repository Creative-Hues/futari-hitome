// 編みながら使うときの感度の設定。ここの数字を変えるだけで動きが変わる。
// (色・余白・動きの速さは src/styles/tokens.css にまとめている)

/** どこでもタップ:同時に触れていてよい指の数。これを超えたタッチは数えない */
export const MAX_POINTERS = 1;

/** どこでもタップ:前に数えてからこの時間(ミリ秒)以内のタッチは、同じ1回とみなして数えない */
export const TAP_MERGE_MS = 150;

/** 取り消し用に残す操作の数(作品ごと) */
export const UNDO_LIMIT = 50;

/** 音声入力:1カウントになる言葉(聞き取りでは漢字やカタカナになることがあるので、それも含める) */
export const VOICE_COUNT_WORDS = ['あみ', 'アミ', '編み', '網'];

/** 音声入力:勝手に止まったとき、つなぎ直すまでの待ち時間(ミリ秒) */
export const VOICE_RESTART_MS = 300;

/** ドラッグ並び替え:この時間(ミリ秒)長押しすると持ち上がる */
export const LONG_PRESS_MS = 350;

/** ドラッグ並び替え:長押しの間にこれ以上(px)指が動いたら、並び替えではなくスクロールとみなす */
export const LONG_PRESS_SLOP = 8;

/** 編んだ時間の目安:前に数が変わってからこの時間(ミリ秒)より空いたら、休んでいたとみなして足さない */
export const KNIT_GAP_MS = 5 * 60 * 1000;

/** 写真:保存するときの長辺(px)と JPEG の画質(0〜1) */
export const PHOTO_MAX_SIDE = 1600;
export const PHOTO_QUALITY = 0.85;

/** 写真:一覧に出す小さい版の長辺(px) */
export const PHOTO_THUMB_SIDE = 400;

/** 写真を大きく見る画面:拡大の上限(倍) */
export const PHOTO_MAX_ZOOM = 5;

/** 写真を大きく見る画面:この時間(ミリ秒)以内に2回タップすると1倍に戻す */
export const PHOTO_DOUBLE_TAP_MS = 300;
