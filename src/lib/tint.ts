// 新しい絵(PNG)に色を付ける計算。画素(赤・緑・青・濃さ の並び)を直接書き換える。
// 色を付けた画像は表示する前に1回だけ作り、動きのたびには計算しない(artImage.ts)。

export type Rgb = [number, number, number];
export type Pixels = Uint8ClampedArray | Uint8Array;

/** 白く描いた絵に色を掛け合わせる(白 → その色、灰色の影 → その分暗く、濃い線 → 濃いまま)。濃さはそのまま */
export function multiply(px: Pixels, rgb: Rgb) {
  for (let i = 0; i < px.length; i += 4) {
    px[i] = Math.round((px[i] * rgb[0]) / 255);
    px[i + 1] = Math.round((px[i + 1] * rgb[1]) / 255);
    px[i + 2] = Math.round((px[i + 2] * rgb[2]) / 255);
  }
}

/** 形だけ使って、その色で塗る(目)。濃さはそのまま */
export function paint(px: Pixels, rgb: Rgb) {
  for (let i = 0; i < px.length; i += 4) {
    px[i] = rgb[0];
    px[i + 1] = rgb[1];
    px[i + 2] = rgb[2];
  }
}

/**
 * マスクの白いところにだけ色を掛け合わせる(体)。mask は同じ大きさ・同じ位置に並べた画素。
 * 白さ×濃さ の割合だけ色が付く(白=全部、灰色=その割合、黒・透明=付けない)
 */
export function multiplyMasked(px: Pixels, mask: Pixels, rgb: Rgb) {
  for (let i = 0; i < px.length; i += 4) {
    const w = (mask[i] * mask[i + 3]) / (255 * 255);
    if (!w) continue;
    for (let c = 0; c < 3; c++) px[i + c] = Math.round(px[i + c] * (1 - w + (w * rgb[c]) / 255));
  }
}
