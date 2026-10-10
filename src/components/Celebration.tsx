// 完成のお祝い。編む画面の上に重ねる(下のタップ場所は隠れるので数えない)。
// 動きはすべて CSS(速さ・高さ・回数・紙吹雪の数は tokens.css の「動き」の欄)。
import { useMemo } from 'preact/hooks';
import { ANIMAL_NAMES } from '../data/animals';
import type { PartnerData, Work } from '../lib/db';
import { Partner } from './Partner';
import { Scene } from './Scene';

/** 紙吹雪の色:作品の色・ピンク・青 */
function confetti(color: string) {
  const css = getComputedStyle(document.documentElement);
  const n = parseInt(css.getPropertyValue('--confetti-count'), 10) || 24;
  const colors = [color, 'var(--pink)', 'var(--blue)'];
  return Array.from({ length: n }, (_, i) => ({
    left: `${Math.random() * 100}%`,
    '--size': `${6 + Math.random() * 6}px`,
    '--drift': `${(Math.random() - 0.5) * 40}px`,
    '--delay': `${-Math.random() * 3}s`,
    '--speed': `${0.8 + Math.random() * 0.5}`,
    background: colors[i % colors.length],
  }));
}

export function Celebration({
  work,
  partner,
  onRecord,
  onLater,
}: {
  work: Work;
  partner: PartnerData | null;
  onRecord: () => void;
  onLater: () => void;
}) {
  const dots = useMemo(() => confetti(work.color), [work.color]);
  const name = ANIMAL_NAMES[work.partner];

  return (
    <div class="celebration" role="dialog" aria-modal="true" aria-label="完成おめでとう">
      <section class="celebration-stage">
        <Scene kind="meadow" />
        <div class="confetti" aria-hidden="true">
          {dots.map((style) => (
            <span style={style} />
          ))}
        </div>
        <Partner
          animal={work.partner}
          decoration={partner?.decoration}
          color={work.color}
          progress={1}
          live
          celebrate
        />
        <p class="bubble">できたね!</p>
      </section>
      <div class="celebration-text">
        <h2>{work.name} 完成!</h2>
        <p>{name}が もらってくれました</p>
      </div>
      <div class="celebration-actions">
        <button class="primary-button" onClick={onRecord}>
          記録をつける
        </button>
        <button class="secondary-button" onClick={onLater}>
          あとで
        </button>
      </div>
    </div>
  );
}
