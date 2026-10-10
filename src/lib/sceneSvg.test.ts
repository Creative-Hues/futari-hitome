// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { prepareScene } from './sceneSvg';
import { parseSvg } from './svgPrep';

const read = (p: string) => readFileSync(`assets/backgrounds/${p}`, 'utf8');

describe('原っぱ', () => {
  const root = parseSvg(prepareScene(read('meadow.svg'), 'meadow', 'm0-'));

  it('空の3色・雲2つ・花8つに目印が付く', () => {
    expect(root.querySelectorAll('[style*="--sky-"]')).toHaveLength(3);
    expect(root.querySelectorAll('.sc-cloud')).toHaveLength(2);
    expect(root.querySelectorAll('.sc-sway')).toHaveLength(8);
  });

  it('大きな雲は下の影と一緒に動く', () => {
    const big = root.querySelector('.sc-cloud')!;
    expect(big.querySelector('ellipse[fill="#e2f0fb"]')).not.toBeNull();
  });

  it('星は少し黄色寄りの白', () => {
    const stars = root.querySelector('.sc-stars')!;
    expect(stars.getAttribute('fill')).toBe('#fffbe8');
    expect(stars.querySelectorAll('circle').length).toBeGreaterThan(3);
  });
});

describe('部屋', () => {
  const root = parseSvg(prepareScene(read('room_example_0.svg'), 'room', 'r0-'));

  it('窓の雲2つと鉢植えの花1つに目印が付く(花びらの白は雲にしない)', () => {
    expect(root.querySelectorAll('.sc-cloud')).toHaveLength(2);
    const sway = root.querySelectorAll('.sc-sway');
    expect(sway).toHaveLength(1);
    // 鉢(台形)は揺れない
    expect(sway[0].querySelector('path[fill="#e8956c"]')).toBeNull();
  });

  it('星は窓の中だけに出る', () => {
    expect(root.querySelector('.sc-stars')!.getAttribute('clip-path')).toBe('url(#r0-win)');
    expect(root.querySelector('[id="r0-win"]')).not.toBeNull();
  });
});
