// パートナーの絵。assets/ のSVGをそのまま重ねる(どうぶつの体・身につけた作品・編み地・左右の手・頭飾り)。
// 新しい絵(assets/art/ のPNG)がある子は、PNGを同じ重なりで置く(部品ごとに、PNGがなければSVG)。
// 絵は最初に1回だけ作り、数えるたびに作り直さない。動きはすべて CSS(app.css、速さは tokens.css)。
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { BODY_TONE, ITEM_SHADE } from '../config/room';
import { ANIMAL_NAMES, DECORATION_SCALE, animalSvg, decorationAnchor, decorationSvg, defaultDecoration } from '../data/animals';
import { animalArt, decorationArt, wearArt } from '../data/art';
import { hatDecorationY, wornSvg } from '../data/wear';
import type { Placed } from '../lib/artConfig';
import { useArtUrls, type ArtTint } from '../lib/artImage';
import { darken, mix, shade } from '../lib/color';
import type { AnimalId, KnitTool } from '../lib/db';
import { KNIT_MAX, KNIT_MIN, eyeFill, knitHeight, preparePartner, preparePngPartner } from '../lib/partnerSvg';
import { uniquePrefix } from '../lib/svgPrep';
import type { Look } from '../lib/wardrobe';
import type { WearInput } from '../lib/wearSvg';

/** 新しい絵の画像1枚と、付ける色 */
type Slot = { placed: Placed; tint?: ArtTint };
/** 身につけた作品の画像の番号(手袋は左右) */
type WearSlots = { body: number } | { left: number; right: number };

/** 頭飾りの絵の上の端(頭飾りの viewBox -22 -40 44 44 の y=-40) */
const DECO_TOP = -40;

/** 体の色・目の色の CSS 変数(null はもとの色なので何も渡さない) */
function lookColors(look?: Look): Record<string, string> {
  const out: Record<string, string> = {};
  if (look?.bodyColor) {
    const b = look.bodyColor;
    out['--body-0'] = mix(b, '#ffffff', BODY_TONE.light);
    out['--body-1'] = b;
    out['--body-2'] = shade(b, BODY_TONE.shadow);
    out['--body-stitch'] = shade(b, BODY_TONE.stitch);
    out['--body-tail'] = mix(b, '#ffffff', BODY_TONE.tail);
  }
  if (look?.eyeColor) out['--eye'] = look.eyeColor;
  return out;
}

/** 素材の編み地の色。この色のときは素材の色をそのまま使う */
const ASSET_KNIT_COLOR = '#5aa3df';

/** 編む・ほどくの動き。n が変わるたびに動きが始まり直す */
export type PartnerMotion = { kind: 'knit' | 'unravel'; n: number };

/** ふれあいのしぐさ */
const REACTIONS = ['hop', 'wiggle', 'tilt', 'blink'] as const;
type Reaction = (typeof REACTIONS)[number];

export function Partner({
  animal,
  look,
  name: label,
  color,
  progress = 0,
  live = false,
  motion = null,
  interactive = false,
  celebrate = false,
  tool,
}: {
  animal: AnimalId;
  /** 頭飾り・体の色・目の色・身につけているもの(なければ素材のまま) */
  look?: Look;
  /** 読み上げ用の呼び名(名前があれば名前) */
  name?: string;
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
  /** 手に持つ道具(新しい絵でかぎ針の手を使う)。なければ、その子が今編んでいる作品の編み方 */
  tool?: KnitTool;
}) {
  const deco = look?.decoration ?? defaultDecoration(animal);
  const usedTool = tool ?? look?.tool ?? 'knit';
  const wearKey = look?.wear.map((w) => `${w.dept}:${w.color}`).join(',') ?? '';
  const bodyColor = look?.bodyColor ?? null;
  const eyeColor = look?.eyeColor ?? null;

  // 新しい絵(PNG)の子:使う画像と付ける色を決め、色を付けた画像がそろうのを待つ
  const art = animalArt(animal);
  const plan = useMemo(() => {
    if (!art) return null;
    const slots: Slot[] = [];
    const add = (placed: Placed, tint?: ArtTint) => slots.push({ placed, tint }) - 1;
    const body = add(
      art.body,
      bodyColor && art.mask
        ? { mode: 'masked', color: mix(bodyColor, '#ffffff', BODY_TONE.png), body: art.body, mask: art.mask }
        : undefined,
    );
    const eyes = art.eyes ? add(art.eyes, { mode: 'paint', color: eyeColor ?? eyeFill(animalSvg(animal)) }) : null;
    const pair = (usedTool === 'crochet' && art.hands.crochet) || art.hands.knit;
    const hands = pair ? { l: add(pair.l), r: add(pair.r) } : null;
    const decoPng = decorationArt(deco);
    const decoration = decoPng ? add(decoPng) : null;
    const wear = (look?.wear ?? []).map((w): WearSlots | null => {
      const p = wearArt(w.dept, animal);
      const t: ArtTint = { mode: 'multiply', color: w.color };
      if (!p) return null;
      return 'left' in p ? { left: add(p.left, t), right: add(p.right, t) } : { body: add(p.body, t) };
    });
    return { slots, body, eyes, hands, decoration, wear };
  }, [animal, deco, wearKey, bodyColor, eyeColor, usedTool]);
  const loaded = useArtUrls(plan ? plan.slots.map((s) => ({ href: s.placed.href, tint: s.tint })) : null);
  /** PNGの絵を使う(読み込めなかったときは今のSVGに戻す) */
  const png = art && plan && loaded.state !== 'failed' ? { art, plan } : null;

  // 帽子をかぶっているときは、頭飾りの y を帽子の上に変える(x と大きさはそのまま)
  const wearsHat = !!look?.wear.some((w) => w.dept === 'head');
  const hatY = wearsHat ? (png ? png.art.hatDecorationY : hatDecorationY(animal)) : null;
  const baseAnchor = png ? png.art.decoration : decorationAnchor(animal);
  const anchor = hatY !== null ? { ...baseAnchor, y: hatY } : baseAnchor;
  const decoTop = png && png.plan.decoration !== null ? png.plan.slots[png.plan.decoration].placed.y : DECO_TOP;
  /** 頭飾りが絵の上の端より上にはみ出す(ひつじの帽子)。枠のある場所では絵を少し縮めて切れないようにする */
  const tall = anchor.y + decoTop * DECORATION_SCALE < 0;
  const urls = loaded.state === 'ready' ? loaded.urls : null;
  const markup = useMemo(() => {
    const wear: WearInput[] = [];
    (look?.wear ?? []).forEach((w, n) => {
      const svg = wornSvg(w.dept, animal);
      if (!svg) return;
      const item: WearInput = { dept: w.dept, svg, color: w.color, shade: shade(w.color, ITEM_SHADE) };
      const p = png && urls ? png.plan.wear[n] : null;
      if (p && urls) {
        const at = (i: number): Placed => ({ ...png!.plan.slots[i].placed, href: urls[i] });
        item.png = 'left' in p ? { left: at(p.left), right: at(p.right) } : { body: at(p.body) };
      }
      wear.push(item);
    });
    const input = {
      animal: animalSvg(animal),
      decoration: decorationSvg(deco),
      anchor,
      scale: DECORATION_SCALE,
      prefix: uniquePrefix('p'),
      wear,
    };
    if (!png) return preparePartner(input);
    // 画像がそろうまでは、絵の場所を空けたまま待つ
    if (!urls) return '';
    const { art, plan } = png;
    const at = (i: number): Placed => ({ ...plan.slots[i].placed, href: urls[i] });
    return preparePngPartner({
      ...input,
      png: {
        body: at(plan.body),
        eyes: plan.eyes === null ? null : at(plan.eyes),
        hands: plan.hands ? { l: at(plan.hands.l), r: at(plan.hands.r) } : null,
        centers: art.centers,
        knit: art.knit,
        decoration: plan.decoration === null ? null : at(plan.decoration),
      },
    });
  }, [animal, deco, wearKey, anchor.y, plan, urls?.join(','), !!png]);

  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const height = png
    ? knitHeight(progress, png.art.knit.minHeight, png.art.knit.maxHeight)
    : knitHeight(progress, KNIT_MIN, KNIT_MAX);

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

  const colors = {
    ...(color && color.toLowerCase() !== ASSET_KNIT_COLOR
      ? { '--knit-color': color, '--knit-shade': darken(color, 10), '--knit-line': darken(color, 20) }
      : {}),
    ...lookColors(look),
  };

  const name = label ?? ANIMAL_NAMES[animal];
  return (
    <div
      ref={box}
      class="partner"
      style={colors}
      data-tall={tall || undefined}
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
