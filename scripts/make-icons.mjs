// 仮のアプリアイコンを作る(正式なアイコンはフェーズ5)。
// assets/animals/sheep.svg を描き直さず、そのまま #fbf7f2 の背景の上に置いてPNGにする。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const sheep = readFileSync(new URL('../assets/animals/sheep.svg', import.meta.url), 'utf8');
const inner = sheep.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

// ひつじの絵は viewBox 0 0 240 240 のうち、だいたい y=35〜225 にある。少し余白をとって中央に置く
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
  <rect width="240" height="240" fill="#fbf7f2"/>
  <svg x="24" y="20" width="192" height="192" viewBox="0 0 240 240">${inner}</svg>
</svg>`;

const outDir = new URL('../public/icons/', import.meta.url);
mkdirSync(outDir, { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const png = new Resvg(icon, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(new URL(name, outDir), png);
  console.log('wrote', name);
}
