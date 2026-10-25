import { describe, expect, it } from 'vitest';
import { ArtBook, type ArtFileInfo, type ArtManifest } from './artConfig';

/** 960 のキャンバスで、(x, y) から幅 w・高さ h のところに絵があるファイル */
const f = (x: number, y: number, w: number, h: number, cw = 960, ch = 960): ArtFileInfo => ({
  x,
  y,
  width: w,
  height: h,
  canvasWidth: cw,
  canvasHeight: ch,
});

function book(files: Record<string, ArtFileInfo>, art: unknown = {}) {
  const manifest: ArtManifest = { art, files };
  const urls = Object.fromEntries(Object.keys(files).map((k) => [k, `/art/${k}.png`]));
  return new ArtBook(manifest, urls);
}

const SHEEP = { anchor: { x: 120, y: 50 }, hatY: 35 };

describe('新しい絵(PNG)の選び方', () => {
  it('体のPNGがない子は null(今のSVGのまま)', () => {
    expect(book({ sheep_eyes: f(0, 0, 10, 10) }).animal('sheep', SHEEP)).toBeNull();
  });

  it('体だけのときは、目・手・マスクは null(その部品は今のSVG)', () => {
    const a = book({ sheep_body: f(200, 160, 560, 700) }).animal('sheep', SHEEP)!;
    expect(a.body).toEqual({ href: '/art/sheep_body.png', x: 50, y: 40, width: 140, height: 175 });
    expect(a.mask).toBeNull();
    expect(a.eyes).toBeNull();
    expect(a.hands).toEqual({ knit: null, crochet: null });
  });

  it('手は左右そろったときだけ。かぎ針もそろっていれば別に持つ', () => {
    const one = book({ sheep_body: f(0, 0, 960, 960), 'sheep_hand-left_knit': f(0, 0, 4, 4) }).animal('sheep', SHEEP)!;
    expect(one.hands.knit).toBeNull();
    const both = book({
      sheep_body: f(0, 0, 960, 960),
      'sheep_hand-left_knit': f(320, 520, 160, 160),
      'sheep_hand-right_knit': f(480, 520, 160, 160),
      'sheep_hand-left_crochet': f(320, 520, 160, 160),
      'sheep_hand-right_crochet': f(480, 520, 160, 160),
    }).animal('sheep', SHEEP)!;
    expect(both.hands.knit?.l).toEqual({ href: '/art/sheep_hand-left_knit.png', x: 80, y: 130, width: 40, height: 40 });
    expect(both.hands.crochet?.r.href).toBe('/art/sheep_hand-right_crochet.png');
  });

  it('手のマスクは、あるほうの手だけに使う(ない手には色を付けない)', () => {
    const b = book({
      sheep_body: f(0, 0, 960, 960),
      'sheep_hand-left_knit': f(320, 520, 160, 160),
      'sheep_hand-right_knit': f(480, 520, 160, 160),
      'sheep_hand-left_knit_mask': f(360, 560, 80, 80),
      'sheep_hand-right_crochet_mask': f(480, 520, 160, 160),
    }).animal('sheep', SHEEP)!;
    expect(b.hands.knit?.masks.l).toEqual({ href: '/art/sheep_hand-left_knit_mask.png', x: 90, y: 140, width: 20, height: 20 });
    expect(b.hands.knit?.masks.r).toBeNull();
    // 手がそろっていなければ、マスクだけあっても使わない
    expect(b.hands.crochet).toBeNull();
  });

  it('art.json がなければ art-guide のとおり(今のSVGの位置と同じ)', () => {
    const a = book({ sheep_body: f(0, 0, 960, 960) }).animal('sheep', SHEEP)!;
    expect(a.centers).toEqual({ l: { x: 102, y: 150 }, r: { x: 138, y: 150 } });
    expect(a.decoration).toEqual({ x: 120, y: 50 });
    expect(a.hatDecorationY).toBe(35);
    expect(a.knit).toEqual({ x: 104, y: 146, width: 32, minHeight: 4, maxHeight: 44 });
  });

  it('art.json の数字(960 のキャンバスの点)を 240 の座標に直して使う', () => {
    const a = book(
      { sheep_body: f(0, 0, 960, 960) },
      {
        animals: {
          sheep: {
            decoration: { x: 484, y: 208 },
            hatDecorationY: 120,
            handLeft: { x: 400, y: 604 },
            knit: { y: 600, maxHeight: 160 },
          },
        },
      },
    ).animal('sheep', SHEEP)!;
    expect(a.decoration).toEqual({ x: 121, y: 52 });
    expect(a.hatDecorationY).toBe(30);
    expect(a.centers.l).toEqual({ x: 100, y: 151 });
    expect(a.centers.r).toEqual({ x: 138, y: 150 });
    expect(a.knit).toEqual({ x: 104, y: 150, width: 32, minHeight: 4, maxHeight: 40 });
  });

  it('おかしな値は使わず、art-guide のとおりにする(アプリは止まらない)', () => {
    const a = book(
      { sheep_body: f(0, 0, 960, 960) },
      {
        animals: {
          sheep: {
            decoration: { x: '480', y: null },
            handLeft: 5,
            knit: { width: -10, minHeight: 200, maxHeight: 100, x: 1e9 },
          },
        },
      },
    ).animal('sheep', SHEEP)!;
    expect(a.decoration).toEqual({ x: 120, y: 50 });
    expect(a.centers.l).toEqual({ x: 102, y: 150 });
    // いちばん長いときは、いちばん短いとき以上
    expect(a.knit).toEqual({ x: 104, y: 146, width: 32, minHeight: 50, maxHeight: 50 });
    expect(book({ sheep_body: f(0, 0, 960, 960) }, [1, 2]).animal('sheep', SHEEP)).not.toBeNull();
    expect(book({ sheep_body: f(0, 0, 960, 960) }, 'x').animal('sheep', SHEEP)).not.toBeNull();
  });

  it('帽子のない子は、帽子のときの高さを持たない', () => {
    const a = book({ cat_body: f(0, 0, 960, 960) }, { animals: { cat: { hatDecorationY: 100 } } }).animal('cat', {
      anchor: { x: 120, y: 69 },
      hatY: null,
    })!;
    expect(a.hatDecorationY).toBeNull();
  });

  it('頭飾り:触れる点 (136, 247) を原点にして、頭飾りの座標(1つ = 6.2点)に置く', () => {
    const b = book({ deco_tulip: f(74, 61, 124, 186, 272, 272) }, { decorations: { shell: { x: 136, y: 240 } } });
    expect(b.decoration('tulip', 6.2)).toEqual({ href: '/art/deco_tulip.png', x: -10, y: -30, width: 20, height: 30 });
    expect(b.decoration('coral', 6.2)).toBeNull();
  });

  it('身につける作品:手袋は左右そろったときだけ', () => {
    const b = book({
      wear_head_sheep: f(240, 80, 480, 320),
      wear_paws_cat_left: f(360, 560, 80, 80),
    });
    expect(b.wear('head_sheep')).toEqual({ body: { href: '/art/wear_head_sheep.png', x: 60, y: 20, width: 120, height: 80 } });
    expect(b.wear('paws_cat')).toBeNull();
    expect(b.wear('neck_cat')).toBeNull();
  });

  it('部屋に飾る作品:床に触れる点 (144, 208) を原点にして、4分の1に置く', () => {
    const b = book({ room_cushion: f(20, 16, 248, 200, 288, 232) });
    expect(b.room('cushion')).toEqual({ href: '/art/room_cushion.png', x: -31, y: -48, width: 62, height: 50 });
    expect(b.room('blanket')).toBeNull();
  });

  it('manifest にあっても画像のアドレスがなければ使わない', () => {
    const manifest: ArtManifest = { art: {}, files: { sheep_body: f(0, 0, 960, 960) } };
    expect(new ArtBook(manifest, {}).animal('sheep', SHEEP)).toBeNull();
  });
});
