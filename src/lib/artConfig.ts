// 新しい絵(PNG)の選び方と置き場所。部品ごとに「PNGがあればPNG、なければ今のSVG」を決める。
// 数字は art-guide と同じキャンバスの点(どうぶつ・身につける作品は 960×960)で読み、
// アプリの絵の座標(どうぶつは 240×240 = 4分の1、頭飾りは頭飾りの座標、部屋に飾る作品はその座標)に直して返す。
// manifest は npm run art が作る(scripts/art.mjs)。art.json の書いていない・おかしな値は、art-guide のとおりの値にする。

/** npm run art が書く、1枚ごとの切り落とした位置(元のキャンバスの点) */
export interface ArtFileInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface ArtManifest {
  art: unknown;
  files: Record<string, ArtFileInfo>;
}

/** 絵の座標に置いた画像 */
export interface Placed {
  href: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Point = { x: number; y: number };

export interface KnitBox {
  x: number;
  y: number;
  width: number;
  minHeight: number;
  maxHeight: number;
}

/** どうぶつのPNGの絵(体があるときだけ)。null の部品は今のSVGを使う */
export interface AnimalArt {
  body: Placed;
  /** 体の色を付ける場所(なければ体の色を付けない) */
  mask: Placed | null;
  eyes: Placed | null;
  /** 左右そろったときだけ。かぎ針がなければ棒針 */
  hands: { knit: { l: Placed; r: Placed } | null; crochet: { l: Placed; r: Placed } | null };
  /** 手の回転の中心(240 の座標) */
  centers: { l: Point; r: Point };
  /** 頭飾りの位置(240 の座標) */
  decoration: Point;
  /** 帽子のときの頭飾りの高さ(240 の座標。帽子のない子は null) */
  hatDecorationY: number | null;
  /** 編み地の四角(240 の座標) */
  knit: KnitBox;
}

/** どうぶつのキャンバス 960 → 絵の座標 240 */
export const ANIMAL_RATIO = 4;
/** 部屋に飾る作品のキャンバス 288×232 → 作品の座標(viewBox -36 -52 72 58) */
export const ROOM_RATIO = 4;

/** art-guide のとおりの値(どうぶつは 960 のキャンバスの点) */
export const GUIDE = {
  handLeft: { x: 408, y: 600 },
  handRight: { x: 552, y: 600 },
  knit: { x: 416, y: 584, width: 128, minHeight: 16, maxHeight: 176 },
  decorationTouch: { x: 136, y: 247 },
  roomTouch: { x: 144, y: 208 },
};

/** 数字として使える値か(キャンバスの外に大きくはみ出す数は使わない) */
function num(v: unknown, fallback: number, min = -2000, max = 3000): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fallback;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function point(v: unknown, fallback: Point): Point {
  const o = obj(v);
  return { x: num(o.x, fallback.x), y: num(o.y, fallback.y) };
}

export interface AnimalDefaults {
  /** 頭飾りの位置(240 の座標。anchors.json) */
  anchor: Point;
  /** 帽子のときの頭飾りの y(240 の座標。wear.json。帽子のない子は null) */
  hatY: number | null;
}

export class ArtBook {
  constructor(
    private manifest: ArtManifest,
    private urls: Record<string, string>,
  ) {}

  private config(): Record<string, unknown> {
    return obj(this.manifest.art);
  }

  /** そのファイルがあれば、元のキャンバスの点で切り落とした位置と、画像のアドレス */
  file(name: string): (ArtFileInfo & { href: string }) | null {
    const info = this.manifest.files[name];
    const href = this.urls[name];
    return info && href ? { ...info, href } : null;
  }

  /** キャンバスの点で (ox, oy) を原点にして ratio で割った座標に置く */
  private place(name: string, ox: number, oy: number, ratio: number): Placed | null {
    const f = this.file(name);
    if (!f) return null;
    return { href: f.href, x: (f.x - ox) / ratio, y: (f.y - oy) / ratio, width: f.width / ratio, height: f.height / ratio };
  }

  private pair(animal: string, tool: string) {
    const l = this.place(`${animal}_hand-left_${tool}`, 0, 0, ANIMAL_RATIO);
    const r = this.place(`${animal}_hand-right_${tool}`, 0, 0, ANIMAL_RATIO);
    return l && r ? { l, r } : null;
  }

  animal(animal: string, d: AnimalDefaults): AnimalArt | null {
    const body = this.place(`${animal}_body`, 0, 0, ANIMAL_RATIO);
    if (!body) return null;
    const c = obj(obj(this.config().animals)[animal]);
    const k = obj(c.knit);
    const g = GUIDE.knit;
    const scale = (p: Point) => ({ x: p.x / ANIMAL_RATIO, y: p.y / ANIMAL_RATIO });
    const deco = point(c.decoration, { x: d.anchor.x * ANIMAL_RATIO, y: d.anchor.y * ANIMAL_RATIO });
    const minHeight = num(k.minHeight, g.minHeight, 0);
    return {
      body,
      mask: this.place(`${animal}_body-mask`, 0, 0, ANIMAL_RATIO),
      eyes: this.place(`${animal}_eyes`, 0, 0, ANIMAL_RATIO),
      hands: { knit: this.pair(animal, 'knit'), crochet: this.pair(animal, 'crochet') },
      centers: { l: scale(point(c.handLeft, GUIDE.handLeft)), r: scale(point(c.handRight, GUIDE.handRight)) },
      decoration: scale(deco),
      hatDecorationY: d.hatY === null ? null : num(c.hatDecorationY, d.hatY * ANIMAL_RATIO) / ANIMAL_RATIO,
      knit: {
        x: num(k.x, g.x) / ANIMAL_RATIO,
        y: num(k.y, g.y) / ANIMAL_RATIO,
        width: num(k.width, g.width, 1) / ANIMAL_RATIO,
        minHeight: minHeight / ANIMAL_RATIO,
        maxHeight: Math.max(minHeight, num(k.maxHeight, g.maxHeight, 0)) / ANIMAL_RATIO,
      },
    };
  }

  /**
   * 頭飾りのPNG。頭飾りの座標(viewBox -22 -40 44 44、(0,0) が頭に触れる点)に置く。
   * pxPerUnit は、頭飾りの座標1つ分がキャンバスの何点か(どうぶつの 4倍 × 頭飾りの大きさ 1.55 = 6.2)
   */
  decoration(id: string, pxPerUnit: number): Placed | null {
    const t = point(obj(this.config().decorations)[id], GUIDE.decorationTouch);
    return this.place(`deco_${id}`, t.x, t.y, pxPerUnit);
  }

  /** 身につける作品のPNG(240 の座標)。手袋は左右そろったときだけ */
  wear(key: string): { body: Placed } | { left: Placed; right: Placed } | null {
    if (key.startsWith('paws_')) {
      const left = this.place(`wear_${key}_left`, 0, 0, ANIMAL_RATIO);
      const right = this.place(`wear_${key}_right`, 0, 0, ANIMAL_RATIO);
      return left && right ? { left, right } : null;
    }
    const body = this.place(`wear_${key}`, 0, 0, ANIMAL_RATIO);
    return body ? { body } : null;
  }

  /** 部屋に飾る作品のPNG。作品の座標((0,0) が床に触れる下の真ん中)に置く */
  room(shape: string): Placed | null {
    const t = point(obj(this.config().room)[shape], GUIDE.roomTouch);
    return this.place(`room_${shape}`, t.x, t.y, ROOM_RATIO);
  }
}
