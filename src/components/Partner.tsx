// パートナーの絵。assets/ のSVGをそのまま重ねる(どうぶつの体・編み地・左右の手・頭飾り)。
// 絵は最初に1回だけ作り、数えるたびに作り直さない。動きはすべて CSS(app.css、速さは tokens.css)。
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  ANIMAL_NAMES,
  DECORATION_SCALE,
  animalSvg,
  decorationAnchor,
  decorationSvg,
  defaultDecoration,
  type DecorationId,
} from '../data/animals';
import { darken } from '../lib/color';
import type { AnimalId } from '../lib/db';
import { knitHeight, preparePartner } from '../lib/partnerSvg';
import { uniquePrefix } from '../lib/svgPrep';

/** 素材の編み地の色。この色のときは素材の色をそのまま使う */
const ASSET_KNIT_COLOR = '#5aa3df';

/** 編む・ほどくの動き。n が変わるたびに動きが始まり直す */
export type PartnerMotion = { kind: 'knit' | 'unravel'; n: number };

/** ふれあいのしぐさ */
const REACTIONS = ['hop', 'wiggle', 'tilt', 'blink'] as const;
type Reaction = (typeof REACTIONS)[number];

export function Partner({
  animal,
  decoration,
  color,
  progress = 0,
  live = false,
  motion = null,
  interactive = false,
  celebrate = false,
}: {
  animal: AnimalId;
  decoration?: DecorationId;
  /** 編んでいる作品の色 */
  color?: string;
  /** 編み地の進み具合(0〜1) */
  progress?: number;
  /** 呼吸・まばたき・頭飾りの揺れ */
  live?: boolean;
  motion?: PartnerMotion | null;
  /** タップでしぐさをする */
  interactive?: boolean;
  /** 完成のお祝い(跳ねる・ゆれる・手をふる・頭飾りが大きく揺れる) */
  celebrate?: boolean;
}) {
  const deco = decoration ?? defaultDecoration(animal);
  const markup = useMemo(
    () =>
      preparePartner({
        animal: animalSvg(animal),
        decoration: decorationSvg(deco),
        anchor: decorationAnchor(animal),
        scale: DECORATION_SCALE,
        prefix: uniquePrefix('p'),
      }),
    [animal, deco],
  );

  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const height = knitHeight(progress);

  // 編み地の高さ。属性とCSSの両方に入れる(CSSで高さを変えられないブラウザでも、属性で正しい高さになる)
  useLayoutEffect(() => {
    const rect = box.current?.querySelector<SVGRectElement>('.pt-knit');
    if (!rect) return;
    rect.setAttribute('height', String(height));
    rect.style.height = `${height}px`;
  }, [markup, height]);

  // 最初の高さが決まってから、伸び縮みの動きを付ける(開いたときに伸びる動きが出ないように)
  useLayoutEffect(() => {
    setReady(false);
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [markup]);

  const [reaction, setReaction] = useState<{ name: Reaction; n: number } | null>(null);
  const last = useRef<Reaction | null>(null);
  const react = () => {
    const choices = REACTIONS.filter((r) => r !== last.current);
    const name = choices[Math.floor(Math.random() * choices.length)];
    last.current = name;
    setReaction((r) => ({ name, n: (r?.n ?? 0) + 1 }));
  };

  const colors =
    color && color.toLowerCase() !== ASSET_KNIT_COLOR
      ? { '--knit-color': color, '--knit-shade': darken(color, 10), '--knit-line': darken(color, 20) }
      : {};

  const name = ANIMAL_NAMES[animal];
  return (
    <div
      ref={box}
      class="partner"
      style={colors}
      data-live={live || undefined}
      data-ready={ready || undefined}
      data-move={motion ? `${motion.kind}-${motion.n % 2 ? 'a' : 'b'}` : undefined}
      data-react={reaction ? `${reaction.name}-${reaction.n % 2 ? 'a' : 'b'}` : undefined}
      data-celebrate={celebrate || undefined}
      {...(interactive
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-label': `${name}をなでる`,
            onClick: react,
            onKeyDown: (e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                react();
              }
            },
            onAnimationEnd: (e: AnimationEvent) => {
              if (e.animationName.startsWith('react-')) setReaction(null);
            },
          }
        : { role: 'img', 'aria-label': name })}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
