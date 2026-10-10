// 時間帯で変わる空の設定。区切りの時刻と色はここだけで変える。
// (動きの速さ・揺れ幅は src/styles/tokens.css にまとめている)

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';

/** 各時間帯が始まる時刻(時)。朝5〜10時・昼10〜16時・夕方16〜19時・夜19〜5時 */
export const PERIOD_START: Record<TimeOfDay, number> = {
  morning: 5,
  day: 10,
  evening: 16,
  night: 19,
};

export interface SkyColors {
  /** 空のグラデーション(上・中・下)。null は素材そのままの色 */
  sky: [string, string, string] | null;
  /** 雲の色と、雲の下の影の色。null は素材そのままの色 */
  cloud: string | null;
  cloudShade: string | null;
  /** 景色全体を暗くする強さ(0で暗くしない)。原っぱと部屋で別々に */
  dim: { meadow: number; room: number };
  /** 星を出すか */
  stars: boolean;
}

export const SKY: Record<TimeOfDay, SkyColors> = {
  morning: {
    sky: ['#86c3ef', '#bfe0f6', '#fbe4d4'],
    cloud: '#ffffff',
    cloudShade: '#eaeef8',
    dim: { meadow: 0, room: 0 },
    stars: false,
  },
  // 昼は素材の色のまま
  day: {
    sky: null,
    cloud: null,
    cloudShade: null,
    dim: { meadow: 0, room: 0 },
    stars: false,
  },
  evening: {
    sky: ['#7184c6', '#e7a3ac', '#f8cf9c'],
    cloud: '#fde7dc',
    cloudShade: '#f3c8c0',
    dim: { meadow: 0.08, room: 0 },
    stars: false,
  },
  night: {
    sky: ['#1c2857', '#2c3c74', '#4d5d96'],
    cloud: '#6f7099',
    cloudShade: '#5c5d87',
    dim: { meadow: 0.28, room: 0.1 },
    stars: true,
  },
};

/** 暗くするときに重ねる色 */
export const DIM_COLOR = '#1d2442';

/** 星の色(少し黄色寄りの白) */
export const STAR_COLOR = '#fffbe8';
